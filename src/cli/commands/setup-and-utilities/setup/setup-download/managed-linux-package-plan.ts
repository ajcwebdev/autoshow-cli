import { readFile, realpath, stat } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path'
import { InfraError } from '~/utils/error-handler'

export type LinuxPackageDownload = {
  url: string
  fileName: string
  size: number
  sha256: string
}

export const LINUX_TOOLCHAIN_PACKAGES = [
  'ffmpeg', 'mupdf-tools', 'qpdf', 'calibre', 'tesseract-ocr', 'tesseract-ocr-eng',
  'imagemagick', 'pango1.0-tools', 'fontconfig', 'fonts-dejavu-core', 'python3'
] as const

/** APT reads APT_CONFIG before its host configuration fragments, unlike late -o overrides. */
export const managedAptBootstrapConfig = (): string =>
  'Dir::Etc::main "-";\nDir::Etc::parts "-";\n'

/** All mutable APT paths are private; host source lists and signing keys are read-only bootstrap inputs. */
export const buildManagedAptOptions = (stateRoot: string): string[] => [
  '-o', 'Dir::Etc::parts=-', '-o', 'Dir::Etc::main=-',
  '-o', `Dir::State=${stateRoot}`, '-o', `Dir::State::status=${join(stateRoot, 'status')}`,
  '-o', `Dir::State::lists=${join(stateRoot, 'lists')}`,
  '-o', `Dir::Cache=${join(stateRoot, 'cache')}`,
  '-o', `Dir::Cache::archives=${join(stateRoot, 'cache/archives')}`,
  '-o', `Dir::Log=${join(stateRoot, 'log')}`,
  '-o', 'Debug::NoLocking=true', '-o', 'APT::Get::List-Cleanup=false',
  '-o', 'APT::Install-Recommends=false', '-o', 'APT::Install-Suggests=false',
  '-o', 'Acquire::AllowInsecureRepositories=false', '-o', 'APT::Get::AllowUnauthenticated=false'
]

export const buildManagedAptPlanArgs = (stateRoot: string, packages: readonly string[]): string[] => [
  ...buildManagedAptOptions(stateRoot), '-o', `Dir::Cache::archives=${join(stateRoot, 'plan-cache/archives')}`,
  '--print-uris', '--yes', '--download-only', '--reinstall',
  '--no-install-recommends', 'install', ...packages
]

const safeDebName = (name: string): boolean =>
  name === basename(name) && /^[A-Za-z0-9][A-Za-z0-9.+_%:~=-]*\.deb$/.test(name)

export const parseManagedAptUris = (text: string): Array<Omit<LinuxPackageDownload, 'sha256'> & { hash: string }> => {
  const entries = text.split('\n').flatMap(line => {
    const trimmed = line.trim()
    if (!trimmed.startsWith("'")) return []
    const match = trimmed.match(/^'([^']+)'\s+(\S+)\s+(\d+)(?:\s+(\S+))?$/)
    if (!match) throw InfraError('APT returned a malformed package download entry', { stage: 'setup:linux' })
    const [, url, fileName, rawSize, rawHash] = match
    const hash = rawHash ?? ''
    if (!url || !fileName || !rawSize || !safeDebName(fileName)) throw InfraError('APT returned an unsafe package download entry', { stage: 'setup:linux' })
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw InfraError('APT package URL must be an HTTP(S) distribution archive without embedded credentials', { stage: 'setup:linux' })
    const size = Number(rawSize)
    if (!Number.isSafeInteger(size) || size <= 0) throw InfraError('APT returned an invalid package size', { stage: 'setup:linux' })
    return [{ url, fileName, size, hash }]
  })
  if (entries.length === 0) throw InfraError('APT did not resolve any packages for the managed toolchain', { stage: 'setup:linux' })
  if (new Set(entries.map(entry => entry.fileName)).size !== entries.length) throw InfraError('APT returned duplicate package destinations', { stage: 'setup:linux' })
  return entries
}

/** Resolve APT's local mirror-list transport without permitting local package archives. */
export const resolveManagedAptUris = async (text: string, mirrorRoot = '/etc/apt'): Promise<ReturnType<typeof parseManagedAptUris>> => {
  const within = (root: string, path: string): boolean => {
    const suffix = relative(root, path)
    return suffix !== '' && suffix !== '..' && !suffix.startsWith(`..${sep}`) && !isAbsolute(suffix)
  }
  const lists = new Map<string, string>()
  const resolved: string[] = []
  for (const line of text.split('\n')) {
    const raw = line.trim().match(/^'([^']+)'/)
    if (!raw?.[1]?.startsWith('mirror+file:')) { resolved.push(line); continue }
    const uri = new URL(raw[1])
    const path = decodeURIComponent(uri.pathname)
    if (!isAbsolute(mirrorRoot) || mirrorRoot === sep || !within(mirrorRoot, path) || uri.host || uri.search || uri.hash || path.includes('\\') || path.includes('\0') || path.split('/').some(part => part === '..' || part === '.')) throw InfraError('APT mirror lists must be read-only files inside the OS APT configuration directory', { stage: 'setup:linux' })
    let listPath = dirname(path)
    let target: string | undefined
    while (within(mirrorRoot, listPath)) {
      let info
      try { info = await stat(listPath) } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        if (code !== 'ENOENT' && code !== 'ENOTDIR') throw error
      }
      if (info?.isFile()) {
        const physicalRoot = await realpath(mirrorRoot), physicalList = await realpath(listPath)
        if (!within(physicalRoot, physicalList) || info.size > 1024 * 1024 || !uri.pathname.startsWith(`${listPath}/`)) throw InfraError('APT mirror list escapes its OS configuration directory or exceeds its size limit', { stage: 'setup:linux' })
        let mirror = lists.get(listPath)
        if (!mirror) {
          const candidates = (await readFile(physicalList, 'utf8')).split('\n').flatMap((entry, index) => {
            const trimmed = entry.trim()
            if (!trimmed || trimmed.startsWith('#')) return []
            const [address, ...metadata] = trimmed.split(/\s+/)
            const base = new URL(address!)
            if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) throw InfraError('APT mirrors must be HTTP(S) distribution archives without embedded credentials', { stage: 'setup:linux' })
            if (metadata.some(field => !/^priority:\d+$/.test(field))) throw InfraError('Managed APT mirror lists support only unconditional HTTP(S) mirrors and numeric priorities', { stage: 'setup:linux' })
            const priority = Number(metadata.find(field => field.startsWith('priority:'))?.slice('priority:'.length) ?? Number.MAX_SAFE_INTEGER)
            if (!Number.isSafeInteger(priority)) throw InfraError('APT mirror list contains an invalid priority', { stage: 'setup:linux' })
            return [{ address: base.href.endsWith('/') ? base.href : `${base.href}/`, priority, index }]
          }).sort((a, b) => a.priority - b.priority || a.index - b.index)
          mirror = candidates[0]?.address
          if (!mirror) throw InfraError('APT mirror list has no HTTP(S) distribution archives', { stage: 'setup:linux' })
          lists.set(listPath, mirror)
        }
        const suffix = uri.pathname.slice(listPath.length + 1)
        const base = new URL(mirror), archive = new URL(suffix, base)
        if (!suffix || suffix.startsWith('/') || archive.origin !== base.origin || !archive.pathname.startsWith(base.pathname)) throw InfraError('APT mirror package path escapes its distribution archive', { stage: 'setup:linux' })
        target = archive.href
        break
      }
      listPath = dirname(listPath)
    }
    if (!target) throw InfraError('APT package URI does not reference a readable OS mirror list', { stage: 'setup:linux' })
    resolved.push(line.replace(`'${raw[1]}'`, `'${target}'`))
  }
  return parseManagedAptUris(resolved.join('\n'))
}

export const resolveManagedAptSha256 = (entry: ReturnType<typeof parseManagedAptUris>[number], metadata: string): string => {
  const direct = entry.hash.match(/^SHA256:([a-f0-9]{64})$/i)?.[1]
  if (direct) return direct.toLowerCase()
  const urlPath = decodeURIComponent(new URL(entry.url).pathname)
  for (const paragraph of metadata.split(/\n\s*\n/)) {
    const fields = Object.fromEntries(paragraph.split('\n').flatMap(line => {
      const match = line.match(/^([A-Za-z0-9-]+):\s*(.*)$/)
      return match?.[1] && match[2] !== undefined ? [[match[1], match[2]]] : []
    }))
    const filename = fields['Filename']
    const sha256 = fields['SHA256']
    const size = Number(fields['Size'])
    if (filename && urlPath.endsWith(`/${filename}`) && size === entry.size && sha256 && /^[a-f0-9]{64}$/i.test(sha256)) return sha256.toLowerCase()
  }
  throw InfraError(`The signed distribution index has no matching SHA256 for ${entry.fileName}`, { stage: 'setup:linux' })
}

export const readCachedLinuxPackagePlan = (value: unknown): LinuxPackageDownload[] | undefined => {
  if (!Array.isArray(value) || value.length === 0) return undefined
  const entries: LinuxPackageDownload[] = []
  for (const entry of value) {
    if (entry === null || typeof entry !== 'object') return undefined
    const record = entry as Record<string, unknown>
    if (typeof record['url'] !== 'string' || typeof record['fileName'] !== 'string' || typeof record['size'] !== 'number' || typeof record['sha256'] !== 'string' || !/^[a-f0-9]{64}$/.test(record['sha256'])) return undefined
    try {
      const [parsed] = parseManagedAptUris(`'${record['url']}' ${record['fileName']} ${record['size']} SHA256:${record['sha256']}`)
      if (!parsed) return undefined
      entries.push({ url: parsed.url, fileName: parsed.fileName, size: parsed.size, sha256: record['sha256'] })
    } catch { return undefined }
  }
  return new Set(entries.map(entry => entry.fileName)).size === entries.length ? entries : undefined
}

export type InstalledLinuxPackage = { name: string; version: string; dependencies: string }

export const parseInstalledLinuxPackages = (text: string): Map<string, InstalledLinuxPackage> => {
  const entries = new Map<string, InstalledLinuxPackage>()
  for (const line of text.split('\n')) {
    const [name, version, dependencies = '', preDependencies = ''] = line.split('\t')
    if (!name || !version) continue
    const entry = { name, version, dependencies: [dependencies, preDependencies].filter(Boolean).join(', ') }
    entries.set(name, entry)
    entries.set(name.replace(/:[a-z0-9]+$/, ''), entry)
  }
  return entries
}

export const resolveInstalledLinuxPackageClosure = (installed: Map<string, InstalledLinuxPackage>, requested: readonly string[]): InstalledLinuxPackage[] => {
  const resolved = new Map<string, InstalledLinuxPackage>()
  const queue = [...requested]
  while (queue.length > 0) {
    const name = queue.shift()
    if (!name) continue
    const entry = installed.get(name)
    if (!entry) throw InfraError(`The image toolchain package ${name} is not installed`, { stage: 'setup:linux-package' })
    if (resolved.has(entry.name)) continue
    resolved.set(entry.name, entry)
    for (const group of entry.dependencies.split(',')) {
      const alternatives = group.split('|').map(value => value.trim().split(/\s|\(/)[0]?.replace(/:(any|native)$/, '')).filter((value): value is string => Boolean(value))
      if (alternatives.length === 0) continue
      const available = alternatives.find(value => installed.has(value))
      // Virtual dependencies have no files of their own; their concrete providers are already installed.
      if (available) queue.push(available)
    }
  }
  return [...resolved.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export const parseLinuxDebContents = (text: string): string[] => text.split('\n').flatMap(line => {
  if (!line.trim()) return []
  const match = line.match(/^([dlhcbps-][rwxstST-]{9})\s+\S+\s+\d+\s+\S+\s+\S+\s+(.+)$/)
  if (!match?.[1] || !match[2]) throw InfraError('Cannot read distribution package file ownership metadata', { stage: 'setup:linux-package' })
  let path = match[2]
  if (match[1].startsWith('l')) path = path.split(' -> ')[0] ?? path
  if (match[1].startsWith('h')) path = path.split(' link to ')[0] ?? path
  path = path.replace(/^\.\//, '')
  if (path.split('/').includes('..')) throw InfraError('Unsafe distribution package ownership path', { stage: 'setup:linux-package' })
  if (path === '.DS_Store' || path.endsWith('/.DS_Store')) return []
  return [`/${path.replace(/^\/+/, '')}`]
})
