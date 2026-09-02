import { existsSync } from 'node:fs'
import { mkdir, readdir } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { BlooperCaptureInput, BlooperCaptureResult, BlooperCategory, BlooperRecord, PageQaEntry } from '~/types'
import { joinOutputRoot } from '~/cli/commands/process-steps/output-root'
import { comicLog } from './comic-logger'

export const BLOOPERS_DIRECTORY_NAME = 'bloopers'

/** `output/bloopers/` by default, and the configured output root's `bloopers/` when `--output-dir` moves the run. */
export const getBloopersDirectory = (): string => joinOutputRoot(BLOOPERS_DIRECTORY_NAME)
export const BLOOPER_LEDGER_FILENAME = 'bloopers.json'
export const BLOOPER_README_FILENAME = 'README.md'
export const BLOOPER_LEDGER_SCHEMA_VERSION = 1

const ATTEMPT_IMAGE = /^attempt-(\d+)\.png$/u

/** Blocking audit statuses map onto the shared blooper vocabulary; everything else is `other`. */
const CATEGORY_BY_BLOCKING_STATUS: Readonly<Record<string, BlooperCategory>> = {
  'side-swapped': 'side-flip',
  'posture-wrong': 'seat-swap',
  'wardrobe-wrong': 'wardrobe-swap',
  'unlisted-on-stage': 'intruder',
  'missing-on-mark': 'vanishing-crowd',
  'excluded-extra-present': 'intruder',
  'crowd-uniform': 'vanishing-crowd',
}

export const categorizeBlooper = (entry: PageQaEntry | undefined, panelNumber: number): BlooperCategory => {
  const panel = entry?.result.panels.find(candidate => candidate.panelNumber === panelNumber)
  for (const item of panel?.blockingAudit ?? []) {
    const category = CATEGORY_BY_BLOCKING_STATUS[item.status]
    if (category) return category
  }
  if (panel?.axisSideMatch === false) return 'side-flip'
  if (panel && panel.setContinuityAudit.some(item => item.status === 'mirrored' || item.status === 'relocated' || item.status === 'redesigned')) return 'furniture-spin'
  return 'other'
}

const hardFailureKeysOf = (entry: PageQaEntry | undefined): string[] => entry?.repairPolicy?.repeatedHardFailures ?? []

const readAttemptEntry = async (attemptsDirectory: string, attempt: number): Promise<PageQaEntry | undefined> => {
  const path = join(attemptsDirectory, `attempt-${attempt}-qa.json`)
  if (!existsSync(path)) return undefined
  try { return JSON.parse(await Bun.file(path).text()) as PageQaEntry } catch { return undefined }
}

const sha256Of = async (path: string): Promise<string> =>
  new Bun.CryptoHasher('sha256').update(new Uint8Array(await Bun.file(path).arrayBuffer())).digest('hex')

const readLedger = async (path: string): Promise<BlooperRecord[]> => {
  if (!existsSync(path)) return []
  try {
    const parsed = JSON.parse(await Bun.file(path).text()) as { records?: BlooperRecord[] }
    return Array.isArray(parsed.records) ? parsed.records : []
  } catch { return [] }
}

export const buildBlooperReadme = (records: readonly BlooperRecord[]): string => {
  const byCategory = new Map<BlooperCategory, number>()
  for (const record of records) byCategory.set(record.category, (byCategory.get(record.category) ?? 0) + 1)
  return [
    '# Blooper ledger',
    '',
    'Non-promoted panel attempts kept deliberately for the continuity blooper reel. Every file here failed QA or was not the promoted candidate; none of it is canonical, and nothing here changes any QA or review status.',
    '',
    'This directory only exists when `comic generate-images --bloopers` was passed. That flag is opt-in and governed by the project policy proposal for retaining failed attempts; the ordinary attempt cleanup is unaffected by it.',
    '',
    `Records: ${records.length}.`,
    '',
    '| Category | Count |',
    '|:---|---:|',
    ...[...byCategory.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([category, count]) => `| ${category} | ${count} |`),
    '',
    '| Episode | Scene | Panel | Attempt | Category | Lineage | Model | File |',
    '|:---|:---|---:|---:|:---|:---|:---|:---|',
    ...records.map(record => `| ${record.episode} | ${record.sceneSlug} | ${record.panelNumber} | ${record.attemptNumber} | ${record.category} | ${record.lineage} | ${record.lastHopModel} | ${record.file} |`),
    '',
  ].join('\n')
}

/** Copies every non-promoted attempt image for one panel into the blooper tree and appends to the shared ledger. */
export const captureBloopers = async (input: BlooperCaptureInput): Promise<BlooperCaptureResult> => {
  const bloopersRoot = input.bloopersRoot ?? getBloopersDirectory()
  const ledgerPath = join(bloopersRoot, BLOOPER_LEDGER_FILENAME)
  const readmePath = join(bloopersRoot, BLOOPER_README_FILENAME)
  const copied: BlooperRecord[] = []
  if (existsSync(input.attemptsDirectory)) {
    const promotedSha256 = existsSync(input.promotedPath) ? await sha256Of(input.promotedPath) : undefined
    const destinationDirectory = join(bloopersRoot, input.episode, input.sceneSlug)
    const entries = (await readdir(input.attemptsDirectory))
      .map(name => ({ name, attempt: Number(ATTEMPT_IMAGE.exec(name)?.[1] ?? Number.NaN) }))
      .filter(item => Number.isInteger(item.attempt))
      .sort((left, right) => left.attempt - right.attempt)
    const now = (input.now ?? (() => new Date()))().toISOString()
    for (const item of entries) {
      const sourcePath = join(input.attemptsDirectory, item.name)
      const sha256 = await sha256Of(sourcePath)
      if (sha256 === promotedSha256) continue
      const qaEntry = await readAttemptEntry(input.attemptsDirectory, item.attempt)
      const restarted = qaEntry?.repairPolicy?.action === 'restart'
      const file = `${input.sceneSlug}/panel-${String(input.panelNumber).padStart(2, '0')}-attempt-${item.attempt}.png`
      const destination = join(destinationDirectory, basename(file))
      await mkdir(destinationDirectory, { recursive: true })
      await Bun.write(destination, Bun.file(sourcePath))
      const record: BlooperRecord = {
        schemaVersion: BLOOPER_LEDGER_SCHEMA_VERSION,
        runId: input.runId,
        episode: input.episode,
        sceneSlug: input.sceneSlug,
        panelNumber: input.panelNumber,
        attemptNumber: item.attempt,
        file: join(input.episode, file),
        sha256,
        lastHopModel: input.imageModel,
        cleanLineage: item.attempt === 0 || restarted,
        lineage: item.attempt === 0 || restarted ? 'clean' : 'mixed',
        qaVerdict: qaEntry === undefined ? 'not-judged' : qaEntry.hardFailure ? 'hard-failure' : 'passed',
        hardFailureKeys: hardFailureKeysOf(qaEntry),
        category: categorizeBlooper(qaEntry, input.panelNumber),
        capturedAt: now,
      }
      await Bun.write(`${destination}.json`, `${JSON.stringify(record, null, 2)}\n`)
      copied.push(record)
    }
  }
  const existing = await readLedger(ledgerPath)
  const records = [...existing, ...copied]
  await mkdir(bloopersRoot, { recursive: true })
  await Bun.write(ledgerPath, `${JSON.stringify({ schemaVersion: BLOOPER_LEDGER_SCHEMA_VERSION, records }, null, 2)}\n`)
  await Bun.write(readmePath, buildBlooperReadme(records))
  if (copied.length > 0) comicLog.line(`  Kept ${copied.length} blooper attempt(s) for panel ${input.panelNumber} under ${join(bloopersRoot, input.episode, input.sceneSlug)}`)
  return { copied, ledgerPath, readmePath }
}
