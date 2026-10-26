import { readdir, realpath } from 'node:fs/promises'
import { isAbsolute, relative, resolve, sep } from 'node:path'
import * as v from 'valibot'
import { AppUsageError, AppValidationError } from '~/utils/error-handler'
import { writeCommandPayload } from '~/utils/app-logger/result-emitter'
import { PROJECT_ROOT } from '~/utils/project-root'
import { writePortableFileSync } from '../../.codex/skills/consensus/scripts/shared/portable_paths'

export const OCR_ARCHIVE_PATH = 'docs/benchmarks/text/ocr'
export const OCR_COHORT_PLAN_PATH = `${OCR_ARCHIVE_PATH}/newspaper-expansion-execution-plan.json`
export const OCR_EXPANSION_REPORT_PATH = 'docs/reports/repository-improvement-actions.md'
export interface OcrArchiveOptions { projectRoot?: string, archivePath?: string, planPath?: string, reportPath?: string }
const nonempty = v.pipe(v.string(), v.trim(), v.nonEmpty())
const caseId = v.pipe(nonempty, v.regex(/^[a-z0-9][a-z0-9-]*$/))
const positive = v.pipe(v.number(), v.integer(), v.minValue(1))
const target = v.object({ provider: nonempty, model: nonempty })
const targets = v.pipe(v.array(target), v.minLength(1))
const status = v.picklist(['succeeded', 'failed', 'missing', 'running'])
const manifestSchema = v.object({
  command: v.literal('extract'), scope: v.literal('single'),
  source: v.optional(v.object({ sourceCaseId: v.optional(caseId) })),
  items: v.pipe(v.array(v.object({ extractRoute: v.literal('document'),
    metadata: v.object({ step1: v.object({ pageCount: positive }) }),
    providers: v.pipe(v.array(v.object({ service: nonempty, model: nonempty, status,
      metadata: v.optional(v.object({ totalPages: v.optional(positive) })) })), v.minLength(1))
  })), v.length(1))
})
const planSchema = v.object({ targets, currentCohort: v.optional(v.object({ targets: v.optional(targets) })) })
type ArchiveEntry = { id: string, sourceCaseId: string, pageCount: number,
  providers: Array<{ providerKey: string, status: v.InferOutput<typeof status> }> }
const key = (value: v.InferOutput<typeof target>): string => `${value.provider}/${value.model}`
const table = (headers: string[], rows: string[][]): string => {
  const widths = headers.map((header, index) => Math.max(3, header.length, ...rows.map(row => row[index]!.length)))
  const line = (cells: string[]) => `| ${cells.map((cell, index) => cell.padEnd(widths[index]!)).join(' | ')} |`
  return [line(headers), line(widths.map(width => '-'.repeat(width))), ...rows.map(line)].join('\n')
}
const within = async (root: string, path: string): Promise<string> => {
  if (isAbsolute(path) || /[:\\\x00]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) throw new AppValidationError('Expected a normalized project-relative OCR artifact path')
  let actual: string
  try { actual = await realpath(resolve(root, path)) } catch { throw new AppValidationError(`Missing OCR artifact: ${path}`) }
  const rel = relative(root, actual)
  if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) throw new AppValidationError(`OCR artifact escapes project root: ${path}`)
  return actual
}
const readJson = async (root: string, path: string): Promise<unknown> => {
  const actual = await within(root, path)
  try { return await Bun.file(actual).json() as unknown } catch { throw new AppValidationError(`Invalid OCR JSON artifact: ${path}`) }
}

/** Read current public manifests only. No providers, source texts, billing changes or archive writes. */
export const inspectOcrArchive = async (options: OcrArchiveOptions = {}) => {
  const root = await realpath(options.projectRoot ?? PROJECT_ROOT)
  const archivePath = options.archivePath ?? OCR_ARCHIVE_PATH, planPath = options.planPath ?? OCR_COHORT_PLAN_PATH
  const plan = v.parse(planSchema, await readJson(root, planPath)), currentTargets = plan.currentCohort?.targets ?? plan.targets
  const targetKeys = currentTargets.map(key), retained = new Set(targetKeys)
  if (retained.size !== targetKeys.length) throw new AppValidationError('Duplicate retained OCR target')
  const entries: ArchiveEntry[] = []
  for (const directory of (await readdir(await within(root, archivePath), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (directory.name === '.DS_Store' || !directory.isDirectory()) continue
    const path = `${archivePath}/${directory.name}/manifest.json`
    if (!await Bun.file(resolve(root, path)).exists()) continue
    const id = v.parse(caseId, directory.name), manifest = v.parse(manifestSchema, await readJson(root, path))
    const item = manifest.items[0]!, pageCount = item.metadata.step1.pageCount
    const providers = item.providers.map(provider => ({ providerKey: `${provider.service}/${provider.model}`, status: provider.status }))
    if (new Set(providers.map(provider => provider.providerKey)).size !== providers.length || providers.some(provider => !retained.has(provider.providerKey))) throw new AppValidationError(`Duplicate or unretained OCR provider: ${id}`)
    if (item.providers.some(provider => provider.metadata?.totalPages !== undefined && provider.metadata.totalPages !== pageCount)) throw new AppValidationError(`OCR provider page count differs from its document: ${id}`)
    const sourceCaseId = manifest.source?.sourceCaseId ?? id.replace(/^(bc|d|efg)-rerun-/, '')
    entries.push({ id, sourceCaseId, pageCount, providers })
  }
  if (!entries.length) throw new AppValidationError('OCR archive contains no direct child manifests')
  const byId = new Map(entries.map(entry => [entry.id, entry]))
  for (const entry of entries) {
    const base = byId.get(entry.sourceCaseId)
    if (!base || base.sourceCaseId !== base.id || base.pageCount !== entry.pageCount) throw new AppValidationError(`OCR rerun has no matching original source/page count: ${entry.id}`)
  }
  const sources = entries.filter(entry => entry.id === entry.sourceCaseId).map(base => {
    const runs = entries.filter(entry => entry.sourceCaseId === base.id)
    const gaps = targetKeys.flatMap(providerKey => {
      const states = runs.flatMap(run => run.providers.filter(provider => provider.providerKey === providerKey).map(provider => provider.status))
      if (states.includes('succeeded')) return []
      return [{ providerKey, status: states.includes('running') ? 'running' : states.includes('failed') ? 'failed' : 'missing' }]
    })
    return { sourceCaseId: base.id, pageCount: base.pageCount, runIds: runs.map(run => run.id), gaps }
  })
  const outcomes = entries.flatMap(entry => entry.providers.map(provider => ({ caseId: entry.id, sourceCaseId: entry.sourceCaseId, ...provider })))
  const incompleteOutputs = outcomes.filter(outcome => outcome.status !== 'succeeded')
  const sourceSlots = sources.length * targetKeys.length
  return { kind: 'ocr-current-archive-reconciliation', archivePath, cohortPlanPath: planPath,
    completionSemantics: 'Source coverage groups successful results across saved protocols. It does not establish completion of every original dispatch protocol, exhaustive text recognition or perceptual correctness.',
    targetCount: targetKeys.length, targets: currentTargets, runCount: entries.length,
    pageInstances: entries.reduce((sum, entry) => sum + entry.pageCount, 0), uniqueSources: sources.length,
    sourcePages: sources.reduce((sum, source) => sum + source.pageCount, 0),
    selectedSlots: outcomes.length, completedSlots: outcomes.filter(outcome => outcome.status === 'succeeded').length,
    failedSlots: outcomes.filter(outcome => outcome.status === 'failed').length,
    notDispatchedSlots: outcomes.filter(outcome => outcome.status === 'missing').length,
    runningSlots: outcomes.filter(outcome => outcome.status === 'running').length,
    unselectedSlots: entries.length * targetKeys.length - outcomes.length,
    sourceSlots, completedSourceSlots: sourceSlots - sources.reduce((sum, source) => sum + source.gaps.length, 0),
    incompleteSourceCount: sources.filter(source => source.gaps.length).length,
    entries: entries.map(({ providers, ...entry }) => ({ ...entry, selectedSlots: providers.length, completedSlots: providers.filter(provider => provider.status === 'succeeded').length })),
    incompleteOutputs, sources }
}
export type OcrArchiveAnalysis = Awaited<ReturnType<typeof inspectOcrArchive>>

export const ocrCurrentArchiveMarkdown = (analysis: OcrArchiveAnalysis): string => {
  const gaps = analysis.sources.filter(source => source.gaps.length)
  const lines = ['### Current retained archive',
    `Current public manifests contain **${analysis.runCount} run entries / ${analysis.pageInstances} page instances**, representing **${analysis.uniqueSources} source inputs / ${analysis.sourcePages} source pages** across ${analysis.targetCount} retained targets. Selected output coverage is **${analysis.completedSlots}/${analysis.selectedSlots}**; grouped source/target coverage is **${analysis.completedSourceSlots}/${analysis.sourceSlots}**.`,
    `${analysis.failedSlots} selected outputs failed, ${analysis.notDispatchedSlots} selected outputs were not dispatched and ${analysis.runningSlots} remain running. ${analysis.unselectedSlots} entry/target combinations were not selected. Historical approved cohorts and lifetime accounting remain recorded separately.`, analysis.completionSemantics]
  if (gaps.length) lines.push(table(['Source input', 'Targets without a successful saved result'], gaps.map(source => [`\`${source.sourceCaseId}\``, source.gaps.map(gap => `\`${gap.providerKey}\` (${gap.status})`).join('; ')])))
  return lines.join('\n\n')
}

/** Replace one marked section; otherwise insert inside the unified OCR section, or before the legacy Corpus heading. */
export const updateOcrCurrentArchiveSection = async (analysis: OcrArchiveAnalysis, options: OcrArchiveOptions = {}) => {
  const root = await realpath(options.projectRoot ?? PROJECT_ROOT)
  const path = await within(root, options.reportPath ?? OCR_EXPANSION_REPORT_PATH), existing = await Bun.file(path).text()
  const start = '<!-- ocr-current-archive:start -->', end = '<!-- ocr-current-archive:end -->'
  const from = existing.indexOf(start), to = existing.indexOf(end)
  if ((from < 0) !== (to < 0) || existing.split(start).length > 2 || existing.split(end).length > 2 || from >= 0 && from >= to) throw new AppValidationError('Invalid OCR current-archive report markers')
  const section = `${start}\n\n${ocrCurrentArchiveMarkdown(analysis)}\n\n${end}`
  const ocrBenchmark = /^## OCR benchmark[ \t]*(?:\r?\n(?:[ \t]*\r?\n)*)?/m.exec(existing)
  const corpus = existing.search(/^## Corpus\s*$/m)
  const insertion = ocrBenchmark ? ocrBenchmark.index + ocrBenchmark[0].length : corpus
  if (from < 0 && insertion < 0) throw new AppValidationError('OCR action report has no OCR benchmark or Corpus insertion point')
  const prefix = existing.slice(0, insertion), headingSpacing = ocrBenchmark && !prefix.endsWith('\n') ? '\n\n' : ''
  const updated = from >= 0 ? existing.slice(0, from) + section + existing.slice(to + end.length)
    : prefix + headingSpacing + section + '\n\n' + existing.slice(insertion)
  writePortableFileSync(path, updated)
}

export const parseOcrArchiveArguments = (args: readonly string[]) => {
  const usage = 'Usage: bun src/tools/ocr-benchmark-reconciliation.ts [--analyze | --generate | --help]'
  const action = args[0] ?? '--analyze'
  if (args.length > 1 || !['--analyze', '--generate', '--help'].includes(action)) throw new AppUsageError(usage)
  return { action, usage }
}
if (import.meta.main) {
  try {
    const args = parseOcrArchiveArguments(Bun.argv.slice(2))
    if (args.action === '--help') writeCommandPayload(`${args.usage}\nDefault/--analyze reads public manifests and emits JSON. --generate updates only the marked current-archive section of the consolidated report. No provider calls.\n`)
    else {
      const analysis = await inspectOcrArchive()
      if (args.action === '--generate') await updateOcrCurrentArchiveSection(analysis)
      const output = args.action === '--generate' ? { cohort: 'current-retained', targetCount: analysis.targetCount,
        runCount: analysis.runCount, pageInstances: analysis.pageInstances, uniqueSources: analysis.uniqueSources,
        sourcePages: analysis.sourcePages, selectedSlots: analysis.selectedSlots, completedSlots: analysis.completedSlots,
        sourceSlots: analysis.sourceSlots, completedSourceSlots: analysis.completedSourceSlots, reportPath: OCR_EXPANSION_REPORT_PATH } : analysis
      writeCommandPayload(JSON.stringify(output, null, 2) + '\n')
    }
  } catch (error) { writeCommandPayload((error instanceof Error ? error.message : 'OCR archive reconciliation failed') + '\n', 'stderr'); process.exitCode = 1 }
}
