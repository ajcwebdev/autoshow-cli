import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, mkdir, open, readFile, readdir, realpath, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, resolve } from 'node:path'

const MEDIA_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.heic', '.heif', '.bmp', '.tif', '.tiff', '.svg', '.ico', '.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v', '.mpeg', '.mpg', '.wav', '.mp3', '.m4a', '.aac', '.flac', '.ogg', '.opus', '.aiff', '.aif', '.wma', '.mpga', '.m2ts', '.pgm', '.ppm', '.pbm', '.pnm', '.pdf', '.jp2', '.j2k', '.djvu', '.djv'])
const PROHIBITED_PARTS = /^(?:\.git|\.autoshow|\.env(?:\..*)?|credentials?(?:\..*)?|protected-voice-assets|secrets?(?:\..*)?)$/i
const SECRET_EXTENSIONS = new Set(['.pem', '.key', '.p12', '.pfx'])
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0
const hash = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex')
const nested = (parent: string, child: string): boolean => child === parent || child.startsWith(`${parent}/`)

export type MediaConsolidationConfig = {
  schemaVersion: 1
  groups: Array<{ id: string; roots: string[]; keeperRoots?: string[]; extensions: string[] }>
  preservationRoots?: string[]
  preservationExtensions?: string[]
}
type Baseline = { path: string; bytes: number; sha256: string; mode: number; mtimeMs: number; dev: number; ino: number; nlink: number }
type MediaBaseline = Baseline & { group: string; sourceKind: 'target' | 'keeper'; plannedReplacement: boolean; requiresExtraReview: boolean; replacementBlockedReason?: 'source-has-hardlinks'; keeperPath?: string }
type DuplicateSet = { sha256: string; bytes: number; keeperPath: string; paths: string[]; replacementPaths: string[] }
export type MediaConsolidationPlan = {
  schemaVersion: 1
  operation: 'prepare-only'
  strategy: 'copy-on-write-regular-file-replacement'
  requiresSeparateApproval: true
  preserveSourcePaths: true
  createdAt: string
  input: { scopeConfigPath: string; scopeConfigSha256: string }
  groups: MediaConsolidationConfig['groups']
  mediaFiles: MediaBaseline[]
  preservedFiles: Baseline[]
  duplicateSets: DuplicateSet[]
  summary: {
    mediaFiles: number; mediaBytes: number; uniqueContentFiles: number; uniqueContentBytes: number
    redundantBytes: number; plannedReplacementFiles: number; plannedReplacementBytes: number
    blockedReplacementFiles: number; blockedReplacementBytes: number
    preservationFiles: number; preservationBytes: number
    groups: Array<{ id: string; files: number; bytes: number; keeperFiles: number; replacementFiles: number; replacementBytes: number }>
  }
}

const relativePath = (value: unknown): string => {
  if (typeof value !== 'string' || !value || isAbsolute(value) || /^[a-z]:/i.test(value) || /[\\\x00-\x1f\x7f]/.test(value) || value.split('/').some(part => !part || part === '.' || part === '..')) throw new Error(`Expected a clean repository-relative path: ${String(value)}`)
  if (value.split('/').some(part => PROHIBITED_PARTS.test(part)) || SECRET_EXTENSIONS.has(extname(value).toLowerCase())) throw new Error(`Protected or secret path is excluded: ${value}`)
  return value
}

const checkedPath = async (root: string, value: string, allowMissing = false): Promise<string> => {
  relativePath(value)
  let path = root
  for (const part of value.split('/')) {
    path = join(path, part)
    try {
      if ((await lstat(path)).isSymbolicLink()) throw new Error(`Symlinks are not accepted: ${value}`)
    } catch (error) {
      if (allowMissing && (error as NodeJS.ErrnoException).code === 'ENOENT') continue
      throw error
    }
  }
  return path
}

const rootDirectory = async (root: string): Promise<string> => {
  const path = resolve(root)
  if (!(await lstat(path)).isDirectory() || (await lstat(path)).isSymbolicLink()) throw new Error('The project root must be a real directory')
  return await realpath(path)
}

const configValue = (value: unknown): MediaConsolidationConfig => {
  const config = value as MediaConsolidationConfig
  if (!config || config.schemaVersion !== 1 || !Array.isArray(config.groups) || !config.groups.length) throw new Error('Expected schemaVersion 1 and at least one media group')
  const ids = new Set<string>()
  const roots: Array<{ path: string; group: string; keeper: boolean }> = []
  for (const group of config.groups) {
    if (!group || typeof group.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(group.id) || ids.has(group.id)) throw new Error('Invalid or duplicate media group id')
    ids.add(group.id)
    if (!Array.isArray(group.roots) || !group.roots.length || !Array.isArray(group.extensions) || !group.extensions.length || group.keeperRoots !== undefined && !Array.isArray(group.keeperRoots)) throw new Error(`Invalid roots or extensions: ${group.id}`)
    for (const ext of group.extensions) if (typeof ext !== 'string' || !MEDIA_EXTENSIONS.has(ext)) throw new Error(`Nonmedia extension is not permitted: ${String(ext)}`)
    for (const [keeper, values] of [[false, group.roots], [true, group.keeperRoots ?? []]] as const) for (const path of values) {
      relativePath(path)
      for (const earlier of roots) if ((nested(earlier.path, path) || nested(path, earlier.path)) && !(earlier.group === group.id && earlier.keeper !== keeper)) throw new Error(`Overlapping media roots: ${earlier.path} and ${path}`)
      roots.push({ path, group: group.id, keeper })
    }
  }
  if (config.preservationRoots !== undefined && !Array.isArray(config.preservationRoots)) throw new Error('Invalid preservationRoots')
  for (const path of config.preservationRoots ?? []) relativePath(path)
  if (config.preservationExtensions !== undefined && (!Array.isArray(config.preservationExtensions) || config.preservationExtensions.some(ext => typeof ext !== 'string' || !/^\.[a-z0-9-]+$/.test(ext) || MEDIA_EXTENSIONS.has(ext) || SECRET_EXTENSIONS.has(ext)))) throw new Error('Invalid preservationExtensions')
  return config
}

const walk = async (root: string, relative: string): Promise<string[]> => {
  if (relative.split('/').includes('.DS_Store')) return []
  const path = await checkedPath(root, relative)
  const info = await lstat(path)
  if (info.isFile()) return [relative]
  if (!info.isDirectory()) throw new Error(`Expected a regular file or directory: ${relative}`)
  const result: string[] = []
  for (const entry of (await readdir(path)).sort(compare)) {
    if (entry === '.DS_Store') continue
    result.push(...await walk(root, `${relative}/${entry}`))
  }
  return result
}

const fileBaseline = async (root: string, path: string): Promise<Baseline> => {
  const absolute = await checkedPath(root, path)
  const file = await open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const before = await file.stat()
    if (!before.isFile()) throw new Error(`Expected a regular file: ${path}`)
    const digest = createHash('sha256')
    for await (const chunk of file.createReadStream({ autoClose: false })) digest.update(chunk)
    const after = await file.stat()
    for (const key of ['size', 'mtimeMs', 'ctimeMs', 'mode', 'dev', 'ino', 'nlink'] as const) if (before[key] !== after[key]) throw new Error(`File changed during hashing: ${path}`)
    const current = await lstat(absolute)
    if (!current.isFile() || current.ino !== after.ino || current.dev !== after.dev || current.size !== after.size || current.mtimeMs !== after.mtimeMs) throw new Error(`File changed during hashing: ${path}`)
    return { path, bytes: after.size, sha256: digest.digest('hex'), mode: after.mode & 0o7777, mtimeMs: after.mtimeMs, dev: after.dev, ino: after.ino, nlink: after.nlink }
  } finally { await file.close() }
}

const outputOutsideInputs = (config: MediaConsolidationConfig, configPath: string, output: string): void => {
  relativePath(output)
  const allRoots = config.groups.flatMap(group => [...group.roots, ...group.keeperRoots ?? []]).concat(config.preservationRoots ?? [], configPath)
  for (const path of allRoots) if (nested(path, output) || nested(output, path)) throw new Error(`Output overlaps a source or config path: ${path}`)
}

export const buildMediaConsolidationPlan = async (projectRoot: string, scopeConfigPath: string): Promise<MediaConsolidationPlan> => {
  const root = await rootDirectory(projectRoot)
  relativePath(scopeConfigPath)
  const configBytes = await readFile(await checkedPath(root, scopeConfigPath))
  const config = configValue(JSON.parse(configBytes.toString('utf8')))
  const mediaFiles: MediaBaseline[] = []
  const selected = new Map<string, MediaBaseline>()
  for (const group of config.groups) {
    const paths = new Map<string, 'target' | 'keeper'>()
    for (const [kind, roots] of [['target', group.roots], ['keeper', group.keeperRoots ?? []]] as const) for (const path of roots) {
      if (path.split('/').includes('.DS_Store')) continue
      const found = await walk(root, path)
      const media = found.filter(file => group.extensions.includes(extname(file).toLowerCase()))
      if ((await lstat(await checkedPath(root, path))).isFile() && !media.length) throw new Error(`Nonmedia file selected: ${path}`)
      for (const file of media) if (kind === 'keeper' || !paths.has(file)) paths.set(file, kind)
    }
    for (const [path, sourceKind] of [...paths].sort(([a], [b]) => compare(a, b))) {
      if (selected.has(path)) throw new Error(`A media path belongs to multiple groups: ${path}`)
      const row: MediaBaseline = { ...await fileBaseline(root, path), group: group.id, sourceKind, plannedReplacement: false, requiresExtraReview: false }
      selected.set(path, row); mediaFiles.push(row)
    }
  }
  if (!mediaFiles.length) throw new Error('No media files matched the configured scopes')
  mediaFiles.sort((a, b) => compare(a.path, b.path))
  const preservedPaths = new Set<string>([scopeConfigPath])
  for (const path of config.preservationRoots ?? []) for (const file of await walk(root, path)) {
    if (selected.has(file)) continue
    const ext = extname(file).toLowerCase()
    if (config.preservationExtensions && !config.preservationExtensions.includes(ext)) continue
    if (MEDIA_EXTENSIONS.has(ext)) throw new Error(`Unselected media file in preservation roots: ${file}`)
    preservedPaths.add(file)
  }
  if (selected.has(scopeConfigPath)) throw new Error('The scope config cannot be a media input')
  const preservedFiles: Baseline[] = []
  for (const path of [...preservedPaths].sort(compare)) preservedFiles.push(await fileBaseline(root, path))
  const streams = new Map<string, MediaBaseline[]>()
  for (const row of mediaFiles) {
    const key = `${row.bytes}:${row.sha256}`
    const stream = streams.get(key) ?? []; stream.push(row); streams.set(key, stream)
  }
  const duplicateSets: DuplicateSet[] = []
  let uniqueContentBytes = 0
  for (const stream of streams.values()) {
    stream.sort((a, b) => Number(b.sourceKind === 'keeper') - Number(a.sourceKind === 'keeper') || compare(a.path, b.path))
    const keeper = stream[0]!
    uniqueContentBytes += keeper.bytes
    if (stream.length < 2) continue
    for (const row of stream) if (row !== keeper && row.sourceKind !== 'keeper') {
      row.keeperPath = keeper.path
      if (row.nlink > 1) { row.requiresExtraReview = true; row.replacementBlockedReason = 'source-has-hardlinks' }
      else row.plannedReplacement = true
    }
    duplicateSets.push({ sha256: keeper.sha256, bytes: keeper.bytes, keeperPath: keeper.path, paths: stream.map(row => row.path), replacementPaths: stream.filter(row => row.plannedReplacement).map(row => row.path) })
  }
  duplicateSets.sort((a, b) => compare(a.keeperPath, b.keeperPath))
  const mediaBytes = mediaFiles.reduce((sum, row) => sum + row.bytes, 0)
  return {
    schemaVersion: 1, operation: 'prepare-only', strategy: 'copy-on-write-regular-file-replacement', requiresSeparateApproval: true, preserveSourcePaths: true,
    createdAt: new Date().toISOString(), input: { scopeConfigPath, scopeConfigSha256: hash(configBytes) }, groups: config.groups,
    mediaFiles, preservedFiles, duplicateSets,
    summary: {
      mediaFiles: mediaFiles.length, mediaBytes, uniqueContentFiles: streams.size, uniqueContentBytes, redundantBytes: mediaBytes - uniqueContentBytes,
      plannedReplacementFiles: mediaFiles.filter(row => row.plannedReplacement).length,
      plannedReplacementBytes: mediaFiles.filter(row => row.plannedReplacement).reduce((sum, row) => sum + row.bytes, 0),
      blockedReplacementFiles: mediaFiles.filter(row => row.requiresExtraReview).length,
      blockedReplacementBytes: mediaFiles.filter(row => row.requiresExtraReview).reduce((sum, row) => sum + row.bytes, 0),
      preservationFiles: preservedFiles.length, preservationBytes: preservedFiles.reduce((sum, row) => sum + row.bytes, 0),
      groups: config.groups.map(group => {
        const rows = mediaFiles.filter(row => row.group === group.id)
        return { id: group.id, files: rows.length, bytes: rows.reduce((sum, row) => sum + row.bytes, 0), keeperFiles: rows.filter(row => row.sourceKind === 'keeper').length, replacementFiles: rows.filter(row => row.plannedReplacement).length, replacementBytes: rows.filter(row => row.plannedReplacement).reduce((sum, row) => sum + row.bytes, 0) }
      })
    }
  }
}

const artifacts = (plan: MediaConsolidationPlan): { contents: string; fileList: Buffer } => {
  const files = [...plan.mediaFiles, ...plan.preservedFiles].sort((a, b) => compare(a.path, b.path))
  return { contents: files.map(row => `${row.sha256}  ${row.path}\n`).join(''), fileList: Buffer.from(files.map(row => `${row.path}\0`).join('')) }
}
const comparable = (plan: MediaConsolidationPlan): string => JSON.stringify({ ...plan, createdAt: '' })

export const prepareMediaConsolidation = async (projectRoot: string, scopeConfigPath: string, output: string): Promise<MediaConsolidationPlan> => {
  const root = await rootDirectory(projectRoot)
  const config = configValue(JSON.parse(await readFile(await checkedPath(root, scopeConfigPath), 'utf8')))
  outputOutsideInputs(config, scopeConfigPath, output)
  const outputPath = await checkedPath(root, output, true)
  try {
    if ((await readdir(outputPath)).some(name => name !== '.DS_Store')) throw new Error('Preparation output must be absent or empty')
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  const plan = await buildMediaConsolidationPlan(root, scopeConfigPath)
  if (comparable(plan) !== comparable(await buildMediaConsolidationPlan(root, scopeConfigPath))) throw new Error('Source baseline changed during preparation')
  await mkdir(outputPath, { recursive: true })
  const planBytes = `${JSON.stringify(plan, null, 2)}\n`, companion = artifacts(plan)
  for (const [name, data] of [
    ['plan.json', planBytes], ['plan.sha256', `${hash(planBytes)}  plan.json\n`],
    ['sources.contents.sha256', companion.contents], ['sources.files0', companion.fileList],
    ['verification.json', `${JSON.stringify({ verified: true, operation: 'prepare-only', planSha256: hash(planBytes), verifiedAt: new Date().toISOString(), sourceFiles: plan.mediaFiles.length + plan.preservedFiles.length, ...plan.summary }, null, 2)}\n`]
  ] as const) await writeFile(join(outputPath, name), data, { flag: 'wx', mode: 0o644 })
  return plan
}

export const verifyMediaConsolidation = async (projectRoot: string, planPath: string): Promise<MediaConsolidationPlan['summary']> => {
  const root = await rootDirectory(projectRoot)
  const absolute = await checkedPath(root, planPath)
  const bytes = await readFile(absolute)
  const checksum = await readFile(await checkedPath(root, `${dirname(planPath)}/plan.sha256`), 'utf8')
  if (checksum !== `${hash(bytes)}  ${basename(planPath)}\n`) throw new Error('Preparation plan checksum mismatch')
  const plan = JSON.parse(bytes.toString('utf8')) as MediaConsolidationPlan
  if (plan.schemaVersion !== 1 || plan.operation !== 'prepare-only' || plan.strategy !== 'copy-on-write-regular-file-replacement' || plan.requiresSeparateApproval !== true || plan.preserveSourcePaths !== true || !plan.input) throw new Error('Unsupported preparation plan')
  const current = await buildMediaConsolidationPlan(root, plan.input.scopeConfigPath)
  outputOutsideInputs(configValue(JSON.parse(await readFile(await checkedPath(root, plan.input.scopeConfigPath), 'utf8'))), plan.input.scopeConfigPath, dirname(planPath))
  if (comparable(plan) !== comparable(current)) throw new Error('Preparation source or metadata baseline mismatch')
  const companion = artifacts(plan)
  if (await readFile(await checkedPath(root, `${dirname(planPath)}/sources.contents.sha256`), 'utf8') !== companion.contents || !Buffer.from(await readFile(await checkedPath(root, `${dirname(planPath)}/sources.files0`))).equals(companion.fileList)) throw new Error('Preparation companion artifact mismatch')
  return plan.summary
}

if (import.meta.main) {
  const args = Bun.argv.slice(2), values = new Map<string, string>()
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: prepare-media-consolidation.ts --root PATH (--scope-config RELATIVE.json --output RELATIVE_DIRECTORY | --verify RELATIVE_PLAN.json)\nCreates or verifies a preparation-only copy-on-write consolidation plan; never deletes or replaces source files. Config: {schemaVersion:1,groups:[{id,roots,keeperRoots?,extensions}],preservationRoots?,preservationExtensions?}. Stored paths remain repository-relative. Protected stores, secrets, symlinks, overlapping groups, and output/input overlap are rejected. Source media and metadata must remain unchanged for verification. No apply/delete mode is implemented.')
    process.exit(0)
  }
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]!, value = args[index + 1]
    if (!['--root', '--scope-config', '--output', '--verify'].includes(key) || !value || value.startsWith('--') || values.has(key)) throw new Error('Usage: prepare-media-consolidation.ts --root PATH (--scope-config RELATIVE.json --output RELATIVE_DIRECTORY | --verify RELATIVE_PLAN.json)')
    values.set(key, value)
  }
  const root = values.get('--root')
  if (!root || (values.has('--verify') ? values.size !== 2 : !values.has('--scope-config') || !values.has('--output') || values.size !== 3)) throw new Error('Expected --root and either --verify or --scope-config with --output; this tool has no apply/delete mode')
  const summary = values.has('--verify') ? await verifyMediaConsolidation(root, values.get('--verify')!) : (await prepareMediaConsolidation(root, values.get('--scope-config')!, values.get('--output')!)).summary
  console.log(JSON.stringify({ verified: true, operation: 'prepare-only', ...summary }))
}
