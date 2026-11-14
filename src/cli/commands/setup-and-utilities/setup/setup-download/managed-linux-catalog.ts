import { mkdir } from 'node:fs/promises'
import { basename, join, posix } from 'node:path'
import { InfraError } from '~/utils/error-handler'
import { pathIsPhysicallyWithinRoot } from '~/utils/runtime-containment'

export type LinuxDebianControl = {
  fields: ReadonlyMap<string, string>
  groups: Array<{ name: string; lines: string[] }>
}

export type LinuxCatalogPackage = {
  controlText: string
  packagePaths: readonly string[]
  md5sumsText?: string | undefined
  conffilesText?: string | undefined
  expected?: { name: string; version: string } | undefined
}

function fail(message: string): never { throw InfraError(message, { stage: 'setup:linux-catalog' }) }
const field = (control: LinuxDebianControl, name: string): string | undefined =>
  [...control.fields].find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1]

export const parseLinuxDebianControl = (text: string): LinuxDebianControl[] => {
  const result: LinuxDebianControl[] = []
  for (const paragraph of text.replace(/\r\n/g, '\n').split(/\n[ \t]*\n/).filter(value => value.trim().length > 0)) {
    const groups: LinuxDebianControl['groups'] = []
    const keys = new Set<string>()
    for (const line of paragraph.replace(/\n+$/, '').split('\n')) {
      if (/^[ \t]/.test(line)) {
        const previous = groups.at(-1)
        if (!previous) fail('Debian control continuation has no preceding field')
        previous.lines.push(line)
        continue
      }
      const matched = line.match(/^([A-Za-z0-9][-A-Za-z0-9]*):[ \t]*(.*)$/)
      const name = matched?.[1]
      if (!name) fail('Malformed Debian control field')
      const key = name.toLowerCase()
      if (keys.has(key)) fail(`Duplicate Debian control field: ${name}`)
      keys.add(key)
      groups.push({ name, lines: [line] })
    }
    const fields = new Map(groups.map(group => [group.name, group.lines.map((line, index) => index === 0 ? line.slice(line.indexOf(':') + 1).trimStart() : line).join('\n')]))
    result.push({ fields, groups })
  }
  return result
}

const prefixPath = (prefix: string): string => {
  if (!prefix.startsWith('/') || /[\0\r\n]/.test(prefix) || prefix.split('/').includes('..')) fail('Linux catalog prefix must be a normalized absolute managed path')
  const normalized = posix.normalize(prefix)
  if (normalized === '/') fail('Linux catalog prefix cannot identify the system root')
  return normalized.replace(/\/$/, '')
}

/** Ownership paths describe the active payload location, not the image build source tree. */
export const relocateLinuxCatalogPath = (path: string, catalogPrefix: string): string | undefined => {
  const prefix = prefixPath(catalogPrefix)
  if (/[\0\r\n]/.test(path) || path.split('/').includes('..')) fail('Unsafe path in Linux package ownership metadata')
  let value = path
  while (value.startsWith('./')) value = value.slice(2)
  if (value === '.') value = ''
  if (basename(value) === '.DS_Store') return undefined
  if (value === prefix || value.startsWith(`${prefix}/`)) return posix.normalize(value)
  return posix.join(prefix, value.replace(/^\/+/, ''))
}

const relocateMd5sums = (text: string, prefixes: readonly string[]): string => {
  const lines: string[] = []
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if (!line.trim()) continue
    const match = line.match(/^([a-fA-F0-9]{32})[ \t]+(.+)$/)
    if (!match?.[1] || !match[2]) fail('Malformed Debian package MD5 ownership record')
    for (const prefix of prefixes) {
      const path = relocateLinuxCatalogPath(match[2], prefix)
      // Debian md5sums files are relative to the scanned filesystem root.
      if (path) lines.push(`${match[1]}  ${path.replace(/^\//, '')}`)
    }
  }
  return lines.length > 0 ? `${lines.join('\n')}\n` : ''
}

const relocateConffileLine = (line: string, prefix: string, statusField: boolean): string | undefined => {
  const value = line.trimStart()
  if (!value) return undefined
  const directive = statusField ? null : value.match(/^(remove-on-upgrade)[ \t]+(.+)$/)
  const pathValue = directive?.[2] ?? value
  const match = pathValue.match(/^(.+?)[ \t]+([a-fA-F0-9]{32})(?:[ \t]+(.*))?$/)
  const path = relocateLinuxCatalogPath(match?.[1] ?? pathValue, prefix)
  if (!path) return undefined
  return `${statusField ? ' ' : ''}${directive?.[1] ? `${directive[1]} ` : ''}${path}${match?.[2] ? ` ${match[2]}${match[3] ? ` ${match[3]}` : ''}` : ''}`
}

const serializeStatus = (control: LinuxDebianControl, prefixes: readonly string[]): string => {
  const lines: string[] = []
  let statusWritten = false
  for (const group of control.groups) {
    if (group.name.toLowerCase() === 'status') {
      if (!/^(?:install|hold) ok installed$/.test(field(control, 'Status') ?? '')) fail('Selected Linux package is not fully installed')
      lines.push(...group.lines)
      statusWritten = true
    } else if (group.name.toLowerCase() === 'conffiles') {
      lines.push('Conffiles:')
      const first = group.lines[0]?.slice(group.lines[0].indexOf(':') + 1).trim()
      const entries = [...(first ? [first] : []), ...group.lines.slice(1)]
      for (const line of entries) {
        for (const prefix of prefixes) {
          const relocated = relocateConffileLine(line, prefix, true)
          if (relocated) lines.push(relocated)
        }
      }
    } else lines.push(...group.lines)
  }
  if (!statusWritten) lines.splice(1, 0, 'Status: install ok installed')
  return `${lines.join('\n')}\n`
}

const containedWrite = (root: string, path: string): string => {
  if (!pathIsPhysicallyWithinRoot(root, path)) fail('Linux catalog writes must remain inside the selected payload')
  return path
}

const ensureDirectory = async (root: string, path: string): Promise<void> => {
  containedWrite(root, path)
  await mkdir(path, { recursive: true })
  containedWrite(root, path)
}

const identity = (control: LinuxDebianControl, expected?: LinuxCatalogPackage['expected']): { name: string; version: string; architecture: string; infoName: string } => {
  const name = field(control, 'Package') ?? ''
  const version = field(control, 'Version') ?? ''
  const architecture = field(control, 'Architecture') ?? ''
  if (!/^[a-z0-9][a-z0-9+.-]*$/.test(name) || !version || /[\0\r\n]/.test(version) || !/^[a-z0-9][a-z0-9-]*$/.test(architecture)) fail('Debian catalog record has an invalid package identity')
  if (expected) {
    if (!/^[a-z0-9][a-z0-9+.-]*(?::[a-z0-9][a-z0-9-]*)?$/.test(expected.name)) fail('Selected Linux package has an invalid binary identity')
    const [expectedName, expectedArch] = expected.name.split(':')
    if (expectedName !== name || expected.version !== version || (expectedArch && expectedArch !== architecture)) fail(`Selected Linux package identity differs from its metadata: ${expected.name}`)
  }
  const infoName = architecture !== 'all' && (field(control, 'Multi-Arch') === 'same' || expected?.name.includes(':')) ? `${name}:${architecture}` : name
  return { name, version, architecture, infoName }
}

export const writeLinuxPackageCatalog = async (options: {
  payloadRoot: string
  catalogPrefix: string
  /** Additional real copies of the same payload, such as the immutable Docker seed. */
  additionalCatalogPrefixes?: readonly string[] | undefined
  packages: readonly LinuxCatalogPackage[]
}): Promise<{ packages: number; files: number }> => {
  const prefixes = [...new Set([options.catalogPrefix, ...(options.additionalCatalogPrefixes ?? [])].map(prefixPath))]
  const seen = new Set<string>()
  const infoNames = new Set<string>()
  const records = options.packages.map(record => {
    const controls = parseLinuxDebianControl(record.controlText)
    if (controls.length !== 1 || !controls[0]) fail('A package catalog record must contain exactly one Debian control stanza')
    const control = controls[0]
    const details = identity(control, record.expected)
    const key = `${details.name}:${details.architecture}`
    if (seen.has(key)) fail(`Duplicate selected Linux package metadata: ${key}`)
    seen.add(key)
    if (infoNames.has(details.infoName)) fail(`Ambiguous Linux package ownership metadata: ${details.infoName}`)
    infoNames.add(details.infoName)
    const paths = [...new Set(record.packagePaths.flatMap(path => prefixes.flatMap(prefix => {
      const relocated = relocateLinuxCatalogPath(path, prefix)
      return relocated ? [relocated] : []
    })))].sort()
    const conffiles = record.conffilesText?.replace(/\r\n/g, '\n').split('\n').flatMap(line => prefixes.flatMap(prefix => {
      const relocated = relocateConffileLine(line, prefix, false)
      return relocated ? [relocated] : []
    }))
    return {
      infoName: details.infoName, status: serializeStatus(control, prefixes),
      list: paths.length ? `${paths.join('\n')}\n` : '',
      md5sums: record.md5sumsText === undefined ? undefined : relocateMd5sums(record.md5sumsText, prefixes),
      conffiles: conffiles?.length ? `${conffiles.join('\n')}\n` : undefined
    }
  }).sort((a, b) => a.infoName.localeCompare(b.infoName))
  const database = join(options.payloadRoot, 'var/lib/dpkg')
  const info = join(database, 'info')
  await ensureDirectory(options.payloadRoot, info)
  let files = 1
  for (const record of records) {
    await Bun.write(containedWrite(options.payloadRoot, join(info, `${record.infoName}.list`)), record.list)
    files++
    if (record.md5sums !== undefined) {
      await Bun.write(containedWrite(options.payloadRoot, join(info, `${record.infoName}.md5sums`)), record.md5sums)
      files++
    }
    if (record.conffiles !== undefined) {
      await Bun.write(containedWrite(options.payloadRoot, join(info, `${record.infoName}.conffiles`)), record.conffiles)
      files++
    }
  }
  await Bun.write(containedWrite(options.payloadRoot, join(database, 'status')), `${records.map(record => record.status).join('\n')}${records.length ? '\n' : ''}`)
  return { packages: records.length, files }
}

const readOptional = async (root: string, path: string): Promise<string | undefined> => {
  if (!pathIsPhysicallyWithinRoot(root, path)) fail('Linux catalog source metadata escapes its selected source root')
  const file = Bun.file(path)
  return await file.exists() ? await file.text() : undefined
}

export const writeInstalledLinuxCatalog = async (options: {
  sourceRoot: string
  payloadRoot: string
  catalogPrefix: string
  additionalCatalogPrefixes?: readonly string[] | undefined
  packages: readonly { name: string; version: string }[]
}): Promise<{ packages: number; files: number }> => {
  const database = join(options.sourceRoot, 'var/lib/dpkg')
  const statusPath = join(database, 'status')
  const status = await readOptional(options.sourceRoot, statusPath)
  if (status === undefined) fail('Installed Linux package status metadata is unavailable')
  const available = parseLinuxDebianControl(status)
  const packages: LinuxCatalogPackage[] = []
  for (const expected of options.packages) {
    const [name, architecture] = expected.name.split(':')
    const matches = available.filter(record => field(record, 'Package') === name && (!architecture || field(record, 'Architecture') === architecture))
    if (matches.length !== 1 || !matches[0]) fail(`Selected Linux package status metadata is missing or ambiguous: ${expected.name}`)
    const control = matches[0]
    const details = identity(control, expected)
    const candidates = [...new Set([expected.name, `${details.name}:${details.architecture}`, details.name])]
    let list: string | undefined
    let md5sumsText: string | undefined
    let conffilesText: string | undefined
    for (const candidate of candidates) {
      list ??= await readOptional(options.sourceRoot, join(database, 'info', `${candidate}.list`))
      md5sumsText ??= await readOptional(options.sourceRoot, join(database, 'info', `${candidate}.md5sums`))
      conffilesText ??= await readOptional(options.sourceRoot, join(database, 'info', `${candidate}.conffiles`))
    }
    if (list === undefined) fail(`Selected Linux package file ownership metadata is unavailable: ${expected.name}`)
    packages.push({
      controlText: control.groups.flatMap(group => group.lines).join('\n'),
      packagePaths: list.replace(/\r\n/g, '\n').split('\n').filter(Boolean),
      md5sumsText, conffilesText, expected
    })
  }
  return await writeLinuxPackageCatalog({ payloadRoot: options.payloadRoot, catalogPrefix: options.catalogPrefix, additionalCatalogPrefixes: options.additionalCatalogPrefixes, packages })
}
