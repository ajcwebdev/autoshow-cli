import { lstat, readdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join, relative, resolve, posix } from 'node:path'
import { compactCompletedTtsRun } from '~/cli/commands/audio/tts/compact-tts-run'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import type { CanonicalAudioProviderProjection, CompactTargetRender } from '~/types'
import { UsageError } from '~/utils/error-handler'
import { toProjectRelativePath } from '~/utils/project-root'

const derivedReports = new Set(['provider-comparison-report.json', 'provider-comparison-report.md'])
const unassessedEvaluations = new Set([
  'Execution evidence and locally decoded audio integrity only. No listening assessment or roundtrip transcription was performed. Spoken-text correctness and perceptual quality remain unassessed.',
  'Transport completed and local audio integrity was verified. Spoken words and audible control effectiveness have not been assessed. Successful synthesis is not a controls-quality pass.'
])
const slotName = /^[a-f0-9]{64}(?:-[a-f0-9]{64})?\.wav$/

export const discoverTtsBenchmarkRuns = async (root: string): Promise<string[]> => {
  const runs: string[] = []
  const visit = async (directory: string) => {
    if (await Bun.file(join(directory, 'manifest.json')).exists()) {
      runs.push(directory)
      const children = await readdir(directory, { withFileTypes: true })
      if (children.some(entry => entry.name === 'reruns' && entry.isDirectory())) await visit(join(directory, 'reruns'))
      return
    }
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === '.DS_Store' || entry.isSymbolicLink() || !entry.isDirectory()) continue
      await visit(join(directory, entry.name))
    }
  }
  await visit(root)
  return runs.sort()
}

export const planTtsBenchmarkCompaction = async (root: string): Promise<{ root: string; remove: string[]; skipped: boolean }> => {
  const manifest = await readManifest(root)
  if (!manifest || manifest.command !== 'tts') throw UsageError(`Not a verified TTS benchmark: ${toProjectRelativePath(root)}`)
  const providers = manifest.items.flatMap(item => item.providers)
  if (manifest.items.some(item => item.status !== 'full') || providers.some(provider => provider.status !== 'succeeded' && provider.status !== 'skipped')) return { root, remove: [], skipped: true }
  const keep = new Set(['manifest.json', 'input.md', 'input.txt', 'controls.json', 'benchmark-fingerprint.txt'])
  const retainedDirectories = new Set<string>()
  for (const provider of providers.filter(provider => provider.status === 'succeeded')) {
    const projection = provider.result?.['ttsAudio'] as CanonicalAudioProviderProjection | undefined
    if (!projection?.archive || projection.activeWork) return { root, remove: [], skipped: true }
    const archive = projection.archive
    for (const ref of [archive.renderRef, archive.timelineRef, archive.finalRef]) keep.add(ref.path)
    retainedDirectories.add(provider.artifactDir)
    const dialogue = provider.options['dialoguePlan'] as { path: string }
    keep.add(dialogue.path)
    const render = await Bun.file(join(root, archive.renderRef.path)).json() as CompactTargetRender
    const slots = posix.join(posix.dirname(posix.dirname(archive.renderRef.path)), 'slots')
    keep.add(posix.join(slots, 'audio.zip'))
    for (const slot of render.slots) keep.add(slot.audioArtifactRef ?? posix.join(slots, slot.slotHash + '.wav'))
  }
  const remove: string[] = []
  const visit = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === '.DS_Store') continue
      const path = join(directory, entry.name), ref = relative(root, path).split('\\').join('/')
      if (entry.isSymbolicLink()) throw UsageError(`Refusing to compact a benchmark containing a symlink: ${toProjectRelativePath(path)}`)
      if (entry.isDirectory()) { if (ref !== 'reruns' && ref !== '.locks') await visit(path); continue }
      if (!entry.isFile() || keep.has(ref)) continue
      const obsoleteProvider = ref.startsWith('providers/') || (ref.startsWith('tts-synthesis--') && ![...retainedDirectories].some(dir => ref.startsWith(dir + '/')))
      const obsoleteSlot = posix.dirname(ref).endsWith('slots') && slotName.test(entry.name)
      const obsoletePlan = ref.startsWith('metadata/tts-dialogue-plans/')
      const temporary = ref.startsWith('.tts-tmp-') || ref.startsWith('work/')
      const supersededFinal = !ref.includes('/') && /^speech-.*\.wav$/.test(ref)
      const evaluation = ref === 'consensus-evaluation.txt' ? (await readFile(path, 'utf8')).trim() : ''
      const generatedEvaluation = unassessedEvaluations.has(evaluation) || evaluation.startsWith('Evaluation covers retained execution evidence and locally decoded audio integrity only. No listening assessment or roundtrip transcription was performed.')
      if (obsoleteProvider || obsoleteSlot || obsoletePlan || temporary || supersededFinal || generatedEvaluation || derivedReports.has(ref)) remove.push(ref)
    }
  }
  await visit(root)
  return { root, remove: remove.sort(), skipped: false }
}

export const compactTtsBenchmarkRun = async (root: string) => {
  const plan = await planTtsBenchmarkCompaction(root)
  if (plan.skipped) return { run: toProjectRelativePath(root), skipped: true }
  // The selected artifact graph was verified before removing only known,
  // unreferenced generated files. Keep run directories and all selected media.
  let removedBytes = 0
  for (const ref of plan.remove) { const path = join(root, ref); removedBytes += (await lstat(path)).size; await unlink(path) }
  const compressed = await compactCompletedTtsRun(root)
  const manifestPath = join(root, 'manifest.json'), before = await readFile(manifestPath, 'utf8'), after = JSON.stringify(JSON.parse(before)) + '\n'
  await writeFile(manifestPath, after)
  return { run: toProjectRelativePath(root), skipped: false, removedFiles: plan.remove.length, removedBytes: removedBytes + Buffer.byteLength(before) - Buffer.byteLength(after), compressed }
}

if (import.meta.main) {
  const args = Bun.argv.slice(2)
  if (args.includes('--help')) {
    console.log('Usage: bun src/tools/compact-tts-benchmarks.ts [root] [--apply]\nDefault: inspect docs/benchmarks/tts without writes. --apply bundles reusable source audio and removes obsolete generated files from verified, completed runs. Final audio, manifests, settings, timing/cost evidence, control fixtures and fingerprints remain. Incomplete runs are left intact. No provider calls.')
  } else {
    if (args.some(arg => arg.startsWith('--') && arg !== '--apply') || args.filter(arg => !arg.startsWith('--')).length > 1) throw UsageError('Expected one benchmark root and optional --apply.')
    const root = resolve(args.find(arg => !arg.startsWith('--')) ?? 'docs/benchmarks/tts')
    const runs = await discoverTtsBenchmarkRuns(root)
    // Check every run before the first mutation.
    const plans = []
    for (const run of runs) plans.push(await planTtsBenchmarkCompaction(run))
    const results = []
    for (const plan of plans) results.push(args.includes('--apply') ? await compactTtsBenchmarkRun(plan.root) : { run: toProjectRelativePath(plan.root), skipped: plan.skipped, removableFiles: plan.remove.length })
    console.log(JSON.stringify({ applied: args.includes('--apply'), runs: results }, null, 2))
  }
}
