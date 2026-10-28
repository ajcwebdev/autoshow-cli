import { createHash, randomUUID } from 'node:crypto'
import { lstat, open, readFile, readdir, realpath, rename, rm, unlink } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { configureCharactersRoot, getCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import {
  extractPanelBundleData, getPromptBundleFilename, PANEL_DIRECTORY_PATTERN,
  resolveDesignReferencesAcrossPanels, resolveLocationReferencesAcrossPanels, resolvePrimaryCharacterReferencesAcrossPanels,
} from '~/cli/commands/visuals/comic/comic-utils/panel-prompt-utils'
import type { PanelPrimaryReferenceInput } from '~/types'
import { writeCommandPayload } from '~/utils/app-logger/result-emitter'
import { UsageError, ValidationError } from '~/utils/error-handler'
import { acquireProjectMaintenanceLease } from '~/utils/project-maintenance-lease'

const SNAPSHOT_ROOTS = ['character-references', 'location-references', 'design-references', 'character-references.json', 'location-references.json', 'location-reference.json', 'design-references.json']
const IMAGE_EXTENSIONS = /\.(?:png|jpe?g|webp|gif|avif|heic|svg)$/i
const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex')
const absent = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT'
type Baseline = { path: string; bytes: number; sha256: string; dev: number; ino: number; mode: number }
type Bundle = { before: Baseline; content: string; next: string; input: PanelPrimaryReferenceInput }
type Removal = { path: string; files: Baseline[] }
type Plan = { workspaces: string[]; bundles: Bundle[]; removals: Removal[]; references: Baseline[] }

export type LiveComicReferenceMigrationReport = {
  schemaVersion: 1
  operation: 'dry-run' | 'applied'
  workspaces: number
  bundlesValidated: number
  bundlesWithLegacyIds: number
  bundlesRewritten: number
  canonicalReferenceFilesValidated: number
  snapshotRoots: number
  snapshotFiles: number
  snapshotImageFiles: number
  snapshotBytes: number
  snapshotImageBytes: number
}

const regularBaseline = async (path: string): Promise<Baseline> => {
  const info = await lstat(path)
  if (!info.isFile() || info.isSymbolicLink()) throw ValidationError(`Migration requires a regular file: ${path}`)
  const bytes = await readFile(path)
  return { path, bytes: bytes.length, sha256: sha256(bytes), dev: info.dev, ino: info.ino, mode: info.mode }
}

const discoverWorkspaces = async (output: string): Promise<string[]> => {
  const found: string[] = []
  try { await lstat(output) } catch (error) { if (absent(error)) return found; throw error }
  const visit = async (path: string): Promise<void> => {
    const info = await lstat(path)
    if (info.isSymbolicLink()) throw ValidationError(`Migration does not follow symbolic links: ${path}`)
    if (!info.isDirectory()) return
    const entries = (await readdir(path, { withFileTypes: true })).filter(entry => entry.name !== '.DS_Store').sort((a, b) => a.name.localeCompare(b.name))
    if (basename(path) === 'metadata' && entries.some(entry => entry.name === 'panel-prompts')) {
      found.push(dirname(path))
      return
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) throw ValidationError(`Migration does not follow symbolic links: ${join(path, entry.name)}`)
      if (entry.isDirectory() && !['diagnostics', '.autoshow-workspace-leases'].includes(entry.name)) await visit(join(path, entry.name))
    }
  }
  await visit(output)
  return found
}

const withoutLegacyIds = (content: string): string => {
  const match = [...content.matchAll(/(```json\s*)([\s\S]*?)(\s*```)/g)].at(-1)
  if (!match || match.index === undefined) throw ValidationError('Reviewed panel bundle requires a JSON block')
  const value = JSON.parse(match[2]!) as { snapshotId?: unknown; panels: Array<{ locationSnapshotId?: unknown; designSnapshotId?: unknown }> }
  let changed = Object.hasOwn(value, 'snapshotId')
  delete value.snapshotId
  for (const panel of value.panels) {
    changed ||= Object.hasOwn(panel, 'locationSnapshotId') || Object.hasOwn(panel, 'designSnapshotId')
    delete panel.locationSnapshotId
    delete panel.designSnapshotId
  }
  if (!changed) return content
  const start = match.index + match[1]!.length
  const next = content.slice(0, start) + JSON.stringify(value, null, 2) + content.slice(start + match[2]!.length)
  extractPanelBundleData(next)
  return next
}

const workspaceBundles = async (workspace: string): Promise<Bundle[]> => {
  const directory = join(workspace, 'metadata', 'panel-prompts')
  const info = await lstat(directory)
  if (!info.isDirectory() || info.isSymbolicLink()) throw ValidationError(`Panel prompts must be a real directory: ${directory}`)
  const bundles: Bundle[] = []
  for (const entry of (await readdir(directory, { withFileTypes: true })).filter(entry => entry.name !== '.DS_Store').sort((a, b) => a.name.localeCompare(b.name))) {
    if (!PANEL_DIRECTORY_PATTERN.test(entry.name)) continue
    const panelDirectory = join(directory, entry.name)
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw ValidationError(`Panel prompts must be a real directory: ${panelDirectory}`)
    const entries = (await readdir(panelDirectory, { withFileTypes: true })).filter(entry => entry.name !== '.DS_Store')
    if (entries.some(item => item.isSymbolicLink())) throw ValidationError(`Panel prompts cannot contain symbolic links: ${panelDirectory}`)
    const path = join(panelDirectory, getPromptBundleFilename(panelDirectory, entries))
    const before = await regularBaseline(path)
    const content = await readFile(path, 'utf8')
    if (sha256(Buffer.from(content)) !== before.sha256) throw ValidationError(`Panel bundle changed during migration preflight: ${path}`)
    const bundleData = extractPanelBundleData(content)
    bundles.push({ before, content, next: withoutLegacyIds(content), input: { panelDirectory, entries, bundleData } })
  }
  return bundles
}

const removalFiles = async (path: string): Promise<Baseline[]> => {
  const info = await lstat(path)
  if (info.isSymbolicLink()) throw ValidationError(`Snapshot cleanup cannot follow symbolic links: ${path}`)
  if (info.isFile()) return [await regularBaseline(path)]
  if (!info.isDirectory()) throw ValidationError(`Unexpected snapshot filesystem entry: ${path}`)
  const files: Baseline[] = []
  for (const entry of (await readdir(path, { withFileTypes: true })).filter(entry => entry.name !== '.DS_Store').sort((a, b) => a.name.localeCompare(b.name))) files.push(...await removalFiles(join(path, entry.name)))
  return files
}

const preparePlan = async (root: string): Promise<Plan> => {
  const workspaces = await discoverWorkspaces(join(root, 'output'))
  const plan: Plan = { workspaces, bundles: [], removals: [], references: [] }
  const referencePaths = new Set<string>()
  for (const workspace of workspaces) {
    const bundles = await workspaceBundles(workspace)
    const inputs = bundles.map(bundle => bundle.input)
    if (inputs.length) {
      const characters = resolvePrimaryCharacterReferencesAcrossPanels(inputs, { composeDerived: false })
      const locations = resolveLocationReferencesAcrossPanels(inputs)
      const designs = resolveDesignReferencesAcrossPanels(inputs)
      for (const path of [...characters.primaryCharacterRefs, ...(characters.rosterCharacterReferences ?? []).map(reference => reference.path), ...locations.flatMap(location => location.views.map(view => view.path)), ...designs.map(design => design.path)]) referencePaths.add(resolve(path))
    }
    plan.bundles.push(...bundles)
    const assets = join(workspace, 'assets')
    try {
      const info = await lstat(assets)
      if (!info.isDirectory() || info.isSymbolicLink()) throw ValidationError(`Scene assets must be a real directory: ${assets}`)
    } catch (error) { if (absent(error)) continue; throw error }
    for (const name of SNAPSHOT_ROOTS) {
      const path = join(assets, name)
      try { await lstat(path) } catch (error) { if (absent(error)) continue; throw error }
      plan.removals.push({ path, files: await removalFiles(path) })
    }
  }
  if (plan.bundles.length) for (const path of ['input/characters/characters-reference.json', 'input/characters/character-sketches.json', 'input/locations/locations-reference.json', 'input/locations/location-sketches.json']) referencePaths.add(join(root, path))
  for (const path of [...referencePaths].sort()) plan.references.push(await regularBaseline(path))
  return plan
}

const assertUnchanged = async (files: Baseline[]): Promise<void> => {
  for (const before of files) {
    const after = await regularBaseline(before.path)
    if (after.bytes !== before.bytes || after.sha256 !== before.sha256 || after.dev !== before.dev || after.ino !== before.ino || after.mode !== before.mode) throw ValidationError(`Migration source changed after preflight: ${before.path}`)
  }
}

const assertRemovalUnchanged = async (removal: Removal): Promise<void> => {
  const actual = await removalFiles(removal.path)
  if (actual.map(file => file.path).join('\0') !== removal.files.map(file => file.path).join('\0')) throw ValidationError(`Snapshot source tree changed after preflight: ${removal.path}`)
  await assertUnchanged(removal.files)
}

const applyPlan = async (plan: Plan, assertHeld: () => Promise<void>): Promise<void> => {
  const staged: Array<{ bundle: Bundle; temp: string }> = []
  try {
    for (const bundle of plan.bundles.filter(bundle => bundle.next !== bundle.content)) {
      const temp = join(dirname(bundle.before.path), `.${basename(bundle.before.path)}.live-references-${randomUUID()}.tmp`)
      const handle = await open(temp, 'wx', bundle.before.mode & 0o777)
      staged.push({ bundle, temp })
      try { await handle.writeFile(bundle.next); await handle.sync() } finally { await handle.close() }
    }
    await assertHeld()
    await assertUnchanged([...plan.bundles.map(bundle => bundle.before), ...plan.references])
    for (const removal of plan.removals) await assertRemovalUnchanged(removal)
    for (const { bundle, temp } of staged) { await assertHeld(); await rename(temp, bundle.before.path) }
    for (const removal of plan.removals) { await assertHeld(); await assertRemovalUnchanged(removal); await rm(removal.path, { recursive: true }) }
  } finally {
    for (const { temp } of staged) await unlink(temp).catch(error => { if (!absent(error)) throw error })
  }
}

export const migrateLiveComicReferences = async ({ root: requested, apply = false }: { root: string; apply?: boolean }): Promise<LiveComicReferenceMigrationReport> => {
  const requestedRoot = resolve(requested)
  const info = await lstat(requestedRoot)
  if (!info.isDirectory() || info.isSymbolicLink()) throw UsageError('Migration root must be a real project directory')
  const root = await realpath(requestedRoot)
  const previousCwd = process.cwd(), previousCharactersRoot = getCharactersRoot()
  const lease = apply ? await acquireProjectMaintenanceLease(root) : undefined
  try {
    process.chdir(root)
    configureCharactersRoot(join(root, 'input', 'characters'))
    const plan = await preparePlan(root)
    if (apply) await applyPlan(plan, () => lease!.assertHeld())
    const files = plan.removals.flatMap(removal => removal.files), images = files.filter(file => IMAGE_EXTENSIONS.test(file.path))
    const changed = plan.bundles.filter(bundle => bundle.content !== bundle.next).length
    return { schemaVersion: 1, operation: apply ? 'applied' : 'dry-run', workspaces: plan.workspaces.length, bundlesValidated: plan.bundles.length, bundlesWithLegacyIds: changed, bundlesRewritten: apply ? changed : 0, canonicalReferenceFilesValidated: plan.references.length, snapshotRoots: plan.removals.length, snapshotFiles: files.length, snapshotImageFiles: images.length, snapshotBytes: files.reduce((sum, file) => sum + file.bytes, 0), snapshotImageBytes: images.reduce((sum, file) => sum + file.bytes, 0) }
  } finally {
    process.chdir(previousCwd)
    configureCharactersRoot(previousCharactersRoot)
    await lease?.release()
  }
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2)
    let root: string | undefined, apply = false
    for (let index = 0; index < args.length; index++) {
      if (args[index] === '--apply') apply = true
      else if (args[index] === '--root' && args[index + 1] && !args[index + 1]!.startsWith('--')) root = args[++index]
      else throw UsageError('Usage: migrate-live-comic-references --root PROJECT [--apply]')
    }
    if (!root) throw UsageError('Usage: migrate-live-comic-references --root PROJECT [--apply]')
    writeCommandPayload(`${JSON.stringify(await migrateLiveComicReferences({ root, apply }), null, 2)}\n`)
  } catch (error) {
    writeCommandPayload(`${error instanceof Error ? error.message : String(error)}\n`, 'stderr')
    process.exitCode = 1
  }
}
