import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, symlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { collectAssessmentSources, publishAssessment, runAssessmentQueue } from './assess-tts-benchmarks'
import { collectTtsDashboardSamples, readTtsAssessment } from '../../.codex/skills/consensus/scripts/tts/build_tts_dashboard'
import { writePortableFileSync } from '../../.codex/skills/consensus/scripts/shared/portable_paths'
import { PROJECT_ROOT, toProjectRelativePath } from '~/utils/project-root'
import { UsageError, ValidationError } from '~/utils/error-handler'

type JsonObject = Record<string, unknown>
interface SourceBinding { path: string; scope: string; sha256: string }
interface AssessmentRow extends JsonObject { run: string; providerKey: string; input: string; inputSha256: string; inputSnapshot: string }
interface AssessmentReport extends JsonObject { schemaVersion: number; sources: SourceBinding[]; rows: AssessmentRow[] }
interface SnapshotIndex { archiveSha256: string; snapshots: Array<{ path: string; sha256: string }> }
const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const object = (value: unknown): JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {}
const rowKey = (row: { run: string; providerKey: string }) => `${row.run}\0${row.providerKey}`

export function renderHistoricalTtsPlaybackLinks(markdown: string, copies: ReadonlyArray<{ sourcePath: string; path: string }>): string {
  const playback = new Map(copies.map(copy => [copy.sourcePath, copy.path]))
  return markdown.replace(/\[Selected audio\]\(([^)]+)\)/g, (link, path: string) => playback.has(path) ? `[Approved MP3 playback](${playback.get(path)})` : link)
    .replaceAll('Audio SHA-256:', 'Measured WAV SHA-256:')
}

export function renderPermanentTtsAssessmentNoteLinks(note: string, root: string): string {
  const report = toProjectRelativePath(join(root, 'assessment.md')), evidence = toProjectRelativePath(join(root, 'assessment.evidence.zip'))
  return note.replace(/See \S*assessment\.md(#[^ \n]+) and \S*assessment\.evidence\.zip\./g, (_, anchor: string) => `See ${report}${anchor} and ${evidence}.`)
}

function repairPermanentNoteLinks(root: string, rows: readonly AssessmentRow[]): void {
  for (const row of rows) {
    if (row.providerKey !== 'elevenlabs/eleven_v4' || typeof row['manifest'] !== 'string') continue
    const path = join(dirname(row['manifest']), 'consensus-evaluation.txt')
    if (!existsSync(path)) continue
    const previous = readFileSync(path, 'utf8'), next = renderPermanentTtsAssessmentNoteLinks(previous, root)
    if (next !== previous) writePortableFileSync(path, next)
  }
}

/** A new selection can extend metadata without rewriting previously assessed synthesis. */
export function verifyTtsAssessmentManifestExtension(before: unknown, after: unknown, directory: string): void {
  const original = structuredClone(object(before)), current = structuredClone(object(after))
  if (!Array.isArray(original['items']) || !Array.isArray(current['items']) || original['items'].length !== 1 || current['items'].length !== 1) throw ValidationError('Assessment extension requires one original narration item')
  const originalMetadata = object(object(original['items'][0])['metadata'])
  const currentMetadata = object(object(current['items'][0])['metadata'])
  const oldReruns = originalMetadata['benchmarkReruns'] ?? [], newReruns = currentMetadata['benchmarkReruns']
  if (!Array.isArray(oldReruns) || !Array.isArray(newReruns)) throw ValidationError('Invalid assessment rerun selection')
  const addition = { directory, providerKeys: ['elevenlabs/eleven_v4'] }
  if (newReruns.filter(entry => Bun.deepEquals(entry, addition)).length !== 1 || !Bun.deepEquals(newReruns.filter(entry => !Bun.deepEquals(entry, addition)), oldReruns)) throw ValidationError('Assessment extension may only add the exact v4 rerun selection')
  if (originalMetadata['benchmarkReruns'] === undefined) delete currentMetadata['benchmarkReruns']
  else currentMetadata['benchmarkReruns'] = originalMetadata['benchmarkReruns']
  if (original['updatedAt'] === undefined) delete current['updatedAt']
  else current['updatedAt'] = original['updatedAt']
  if (!Bun.deepEquals(original, current)) throw ValidationError('Assessment extension changed original input, provider result or unrelated metadata')
}

function archiveEntries(path: string): Map<string, Buffer> {
  const entry = (name: string) => {
    if (!name || isAbsolute(name) || name.split('/').some(part => !part || part === '..' || part === '.')) throw ValidationError('Unsafe assessment archive entry')
    const result = Bun.spawnSync(['unzip', '-p', path, name])
    if (result.exitCode !== 0) throw ValidationError(`Missing assessment archive entry: ${name}`)
    return result.stdout
  }
  const files = new Map<string, Buffer>()
  for (const line of entry('SHA256SUMS').toString().trim().split('\n')) {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line)
    if (!match) throw ValidationError('Invalid assessment archive checksums')
    const name = match[2]!
    if (basename(name) === '.DS_Store') continue
    if (files.has(name)) throw ValidationError('Duplicate assessment archive entry')
    const bytes = entry(name)
    if (hash(bytes) !== match[1]) throw ValidationError(`Assessment archive checksum mismatch: ${name}`)
    files.set(name, bytes)
  }
  return files
}

export async function extendTtsAssessment(root: string, snapshotDirectory: string): Promise<void> {
  const previousArchive = join(snapshotDirectory, 'original.evidence.zip')
  const index = JSON.parse(readFileSync(join(snapshotDirectory, 'snapshots.json'), 'utf8')) as SnapshotIndex
  const originalArchiveBytes = readFileSync(previousArchive)
  if (hash(originalArchiveBytes) !== index.archiveSha256) throw ValidationError('Original assessment archive snapshot changed')
  const currentArchive = join(root, 'assessment.evidence.zip'), oldFiles = archiveEntries(previousArchive)
  const oldReport = JSON.parse(oldFiles.get('assessment.json')!.toString()) as AssessmentReport
  const samples = collectTtsDashboardSamples(root)
  if (hash(readFileSync(currentArchive)) !== index.archiveSha256) {
    const current = JSON.parse(archiveEntries(currentArchive).get('assessment.json')!.toString()) as AssessmentReport
    if (object(current['extension'])['originalArchiveSha256'] !== index.archiveSha256) throw ValidationError('Current assessment is not the snapshotted base')
    readTtsAssessment(root, samples)
    repairPermanentNoteLinks(root, current.rows)
    console.log('Matching extended assessment is complete; cached evidence reused and permanent note links verified.')
    return
  }
  const rebindings = []
  for (const snapshot of index.snapshots) {
    const originalBytes = readFileSync(join(snapshotDirectory, basename(dirname(snapshot.path)) + '.json'))
    if (hash(originalBytes) !== snapshot.sha256) throw ValidationError('Original narration manifest snapshot changed')
    const currentBytes = readFileSync(join(root, snapshot.path))
    verifyTtsAssessmentManifestExtension(JSON.parse(originalBytes.toString()), JSON.parse(currentBytes.toString()), 'reruns/eleven-v4-2026-10-29')
    const binding = oldReport.sources.find(source => source.scope === 'benchmark' && source.path === snapshot.path)
    if (!binding || binding.sha256 !== snapshot.sha256) throw ValidationError('Narration snapshot is not bound by the original assessment')
    binding.sha256 = hash(currentBytes)
    const oldEntry = `history/manifests/original/${snapshot.path}`, currentEntry = `history/manifests/current/${snapshot.path}`
    oldFiles.set(oldEntry, originalBytes); oldFiles.set(currentEntry, currentBytes)
    rebindings.push({ path: snapshot.path, previousSha256: snapshot.sha256, currentSha256: binding.sha256, originalSnapshot: oldEntry, currentSnapshot: currentEntry,
      reason: 'Only updatedAt and the exact Eleven v4 benchmarkReruns selection changed; original input, provider projections and all other metadata were verified unchanged.' })
  }
  const oldKeys = new Set(oldReport.rows.map(rowKey))
  const newSamples = samples.filter(sample => sample.status === 'succeeded' && !oldKeys.has(rowKey(sample)))
  if (newSamples.length !== 6 || newSamples.some(sample => sample.providerKey !== 'elevenlabs/eleven_v4') || samples.filter(sample => sample.status === 'succeeded').length !== oldReport.rows.length + 6) throw ValidationError('Extension requires exactly six new successful Eleven v4 recordings')
  const missingAudio = new Set(samples.flatMap(sample => [sample.audioHref, sample.delivery?.sourceHref].filter((value): value is string => typeof value === 'string').map(path => resolve(dirname(root), path))))
  for (const source of oldReport.sources) {
    const path = resolve(source.scope === 'benchmark' ? root : PROJECT_ROOT, source.path)
    if (!existsSync(path) && missingAudio.has(path)) continue
    if (!existsSync(path) && source.scope === 'project') {
      const retained = oldReport.rows.find(row => row.input === source.path && row.inputSha256 === source.sha256)
      if (retained && hash(oldFiles.get(retained.inputSnapshot)!) === source.sha256) continue
    }
    if (!existsSync(path) || hash(readFileSync(path)) !== source.sha256) throw ValidationError(`Inherited assessment source changed: ${source.path}`)
  }
  const enginePath = 'runtime/bin/whisperfile/whisper-small.en.llamafile', engineSha256 = hash(readFileSync(enginePath))
  const sources = collectAssessmentSources(root, engineSha256).filter(source => source.providerKey === 'elevenlabs/eleven_v4' && !oldKeys.has(rowKey(source)))
  const cacheRoot = 'runtime/tts-benchmark-assessment/v1'
  await runAssessmentQueue(sources, cacheRoot, engineSha256, 2)
  const stage = join(cacheRoot, '..', 'extensions', new Date().toISOString().replace(/[:.]/g, '-')), generated = join(stage, 'new')
  mkdirSync(generated, { recursive: true })
  await publishAssessment(generated, sources, cacheRoot, engineSha256)
  const newFiles = archiveEntries(join(generated, 'assessment.evidence.zip'))
  const newReport = JSON.parse(newFiles.get('assessment.json')!.toString()) as AssessmentReport
  const rows = [...oldReport.rows, ...newReport.rows]
  const bindings = new Map(oldReport.sources.map(source => [`${source.scope}\0${source.path}`, source]))
  for (const source of newReport.sources) {
    const absolute = resolve(source.scope === 'benchmark' ? generated : PROJECT_ROOT, source.path)
    const within = relative(resolve(root), absolute).split('\\').join('/')
    const normalized = within.startsWith('..') ? source : { ...source, scope: 'benchmark', path: within }
    const key = `${normalized.scope}\0${normalized.path}`, previous = bindings.get(key)
    if (previous && previous.sha256 !== normalized.sha256) throw ValidationError('Conflicting assessment source binding')
    bindings.set(key, normalized)
  }
  for (const [path, bytes] of newFiles) {
    if (path === 'assessment.json') continue
    if (oldFiles.has(path)) throw ValidationError(`Assessment evidence collision: ${path}`)
    oldFiles.set(path, bytes)
  }
  oldFiles.set('history/original-assessment.evidence.zip', originalArchiveBytes)
  oldFiles.set('history/original-assessment.md', readFileSync(join(snapshotDirectory, 'original.md')))
  const merged = { ...oldReport, generatedAt: newReport['generatedAt'], sources: [...bindings.values()], rows,
    extension: { originalArchiveSha256: index.archiveSha256, originalGeneratedAt: oldReport['generatedAt'], preservedRows: oldReport.rows.length, newRows: newReport.rows.length,
      newEngine: newReport['engine'], originalEvidence: 'history/original-assessment.evidence.zip', manifestRebindings: rebindings,
      measurementPolicy: 'Original rows and transcript/input bytes are unchanged historical WAV measurements. Only new Eleven v4 WAVs received ASR. Approved MP3 playback copies were not re-assessed or substituted for measured audio.' } }
  const combined = join(stage, 'combined')
  mkdirSync(combined, { recursive: true })
  writePortableFileSync(join(combined, 'assessment.json'), JSON.stringify(merged, null, 2) + '\n')
  oldFiles.set('assessment.json', readFileSync(join(combined, 'assessment.json')))
  for (const [path, bytes] of oldFiles) { mkdirSync(dirname(join(combined, path)), { recursive: true }); writeFileSync(join(combined, path), bytes) }
  writeFileSync(join(combined, 'SHA256SUMS'), [...oldFiles].map(([path, bytes]) => `${hash(bytes)}  ${path}`).join('\n') + '\n')
  const nextArchive = resolve(stage, 'next.evidence.zip')
  const zip = Bun.spawnSync(['zip', '-q', nextArchive, ...oldFiles.keys(), 'SHA256SUMS'], { cwd: combined })
  if (zip.exitCode !== 0 || Bun.spawnSync(['unzip', '-tq', nextArchive]).exitCode !== 0) throw ValidationError('Could not build extended assessment archive')
  archiveEntries(nextArchive)
  const validationRoot = join(stage, 'validation', basename(root))
  mkdirSync(validationRoot, { recursive: true })
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'assessment.evidence.zip') continue
    symlinkSync(resolve(root, entry.name), join(validationRoot, entry.name), entry.isDirectory() ? 'dir' : 'file')
  }
  writeFileSync(join(validationRoot, 'assessment.evidence.zip'), readFileSync(nextArchive))
  readTtsAssessment(validationRoot, samples)
  const delivery = JSON.parse(readFileSync(join(root, 'audio-delivery.json'), 'utf8')) as { copies: Array<{ sourcePath: string; path: string }> }
  const oldMarkdown = renderHistoricalTtsPlaybackLinks(readFileSync(join(snapshotDirectory, 'original.md'), 'utf8'), delivery.copies)
  const newMarkdown = readFileSync(join(generated, 'assessment.md'), 'utf8')
  const details = newMarkdown.slice(newMarkdown.indexOf('## Selected recordings')).split('## Reproduce')[0]!
  const introduction = `\nThis report retains the original ${oldReport.rows.length} WAV assessments below and adds ${newReport.rows.length} Eleven v4 WAV assessments in the dated extension at the end (${rows.length} total). The original report and byte-identical evidence ZIP are preserved inside assessment.evidence.zip under history/. Historical rows retain their measured WAV hashes; approved MP3 playback copies were not re-assessed. The archive records and verifies the metadata-only narration-manifest rebindings.\n`
  const markdown = oldMarkdown.replace('\n', '\n' + introduction) + `\n## Eleven v4 extension — 2026-10-29\n\nOnly six new Eleven v4 recordings received installed small.en ASR and full waveform decoding. Subjective ratings and audible control correctness remain excluded and unscored. The pause-only case uses qualitative tags; it is not a slow/fast or exact-timing test. Original archive SHA-256: \`${index.archiveSha256}\`.\n\n${details}`
  renameSync(nextArchive, currentArchive)
  writePortableFileSync(join(root, 'assessment.md'), markdown.trimEnd() + '\n')
  readTtsAssessment(root, samples)
  repairPermanentNoteLinks(root, rows)
  console.log(JSON.stringify({ preservedRows: oldReport.rows.length, newRows: newReport.rows.length, totalRows: rows.length, report: toProjectRelativePath(join(root, 'assessment.md')) }))
}

if (import.meta.main) {
  const args = Bun.argv.slice(2)
  if (args.length !== 2 || args[0] !== '--snapshot-dir' || !args[1]) throw UsageError('Usage: bun src/tools/extend-tts-assessment.ts --snapshot-dir <verified-pre-extension-snapshot> (offline; no provider calls)')
  await extendTtsAssessment('docs/benchmarks/tts', args[1])
}
