import { UsageError } from '~/utils/error-handler'
import { validateTtsBenchmarkContent } from './tts-benchmark-content'
import * as v from 'valibot'
import { resolve } from 'node:path'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { collectTtsTargets } from '~/cli/commands/audio/tts/tts-targets'
import { prepareTtsInput, runSingleTtsInput } from '~/cli/commands/audio/tts/tts-single-run'
import { buildTtsEstimateForInput } from '~/cli/commands/audio/tts/tts-batch-estimates'
import { validateTtsRenderInputsForTargets } from '~/cli/commands/audio/tts/run-tts'
import { normalizeTtsTurnControls } from '~/cli/commands/audio/tts/tts-targets/tts-invocation-controls'
import { configurePinnedRunDir } from '~/cli/commands/command-shared/run-dir'
import type { TtsTurnControls } from '~/types'

const controlValue = v.union([v.string(), v.number(), v.boolean(), v.null()])
const planSchema = v.object({
  schemaVersion: v.literal(1),
  cases: v.array(v.object({
    id: v.pipe(v.string(), v.regex(/^[a-z0-9.-]+$/)),
    provider: v.picklist(['elevenlabs', 'hume', 'grok', 'cartesia', 'inworld']),
    model: v.string(),
    input: v.string(),
    flags: v.record(v.string(), v.unknown()),
    turnControls: v.record(v.string(), v.record(v.picklist(['elevenlabs', 'openai', 'hume', 'grok', 'cartesia', 'inworld']), v.record(v.string(), controlValue))),
    mechanism: v.string(),
    source: v.pipe(v.string(), v.url()),
    lines: v.pipe(v.array(v.string()), v.length(5)),
    spokenLines: v.pipe(v.array(v.string()), v.length(5))
  }))
})

const args = Bun.argv.slice(2)
if (args.includes('--help')) {
  console.log('Usage: bun src/tools/tts-controls-benchmark.ts [--price | --run] [--suite all|emotion|speed-pauses] [--spent-cents N] [--output-dir BASE] [--approved-budget-cents N]\nDefaults to no-cost pricing of both suites under docs/benchmarks/tts. Prior conservative spending and the active output directory are read from the shared ledger. Raising the 25-cent ceiling requires explicit user approval. Matching completed outputs are reused; incomplete outputs must be reconciled. No nonverbal cues or all-provider calls. Plans: input/examples/tts/controls/{emotion,speed-pauses}/benchmark-plan.json')
  process.exit(0)
}
const ledgerPath = 'input/examples/tts/controls/benchmark-plan.json'
const ledger = await Bun.file(ledgerPath).json()
if (ledger.schemaVersion !== 2 || !Number.isFinite(ledger.priorEstimatedCents) || ledger.priorEstimatedCents < 0) throw UsageError('Invalid controls benchmark spending ledger')
let run = false
let spentCents: number = ledger.priorEstimatedCents
let approvedBudgetCents = 25
let suite = 'all'
let outputDir: string | undefined
for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  if (arg === '--run') run = true
  else if (arg === '--price') { /* price is the default */ }
  else if (arg === '--suite') suite = args[++i] ?? ''
  else if (arg === '--approved-budget-cents') approvedBudgetCents = Number(args[++i])
  else if (arg === '--spent-cents') spentCents = Number(args[++i])
  else if (arg === '--output-dir') {
    const value = args[++i]
    if (!value || value.startsWith('--')) throw UsageError('--output-dir requires a path')
    outputDir = value
  } else throw UsageError(`Unknown argument: ${arg}`)
}
if (args.includes('--run') && args.includes('--price')) throw UsageError('Choose --run or --price')
if (!Number.isFinite(spentCents) || spentCents < 0) throw UsageError('--spent-cents must be a nonnegative number')
if (spentCents < ledger.priorEstimatedCents) throw UsageError('--spent-cents cannot reduce the recorded cumulative estimate')
if (!['all', 'emotion', 'speed-pauses'].includes(suite)) throw UsageError('--suite must be emotion, speed-pauses or all')
if (!Number.isFinite(approvedBudgetCents) || approvedBudgetCents < 0) throw UsageError('--approved-budget-cents must be nonnegative; values above 25 require explicit user approval')
const suites = suite === 'all' ? ['emotion', 'speed-pauses'] : [suite]
const cases = []
for (const category of suites) {
  const parsed = v.parse(planSchema, await Bun.file(`input/examples/tts/controls/${category}/benchmark-plan.json`).json())
  cases.push(...parsed.cases.map(entry => ({ ...entry, category })))
}
const plan = { cases }
if (new Set(plan.cases.map(c => `${c.category}/${c.id}`)).size !== plan.cases.length) throw UsageError('Duplicate benchmark case ID')
const preparedCases = []
for (const entry of plan.cases) {
  validateTtsBenchmarkContent(entry)
  const fixtureText = await Bun.file(entry.input).text()
  const speaker = Array.isArray(entry.flags['tts-speaker']) ? String(entry.flags['tts-speaker'][0]).split('=')[0] : undefined
  const lines = entry.lines.map(line => speaker ? `${speaker}: ${line}` : line).join('\n')
  const expectedText = lines
  if (fixtureText.trim() !== expectedText) throw UsageError(`Fixture and five-line plan differ: ${entry.id}`)
  if (/\[(?:laugh[^\]]*|cry(?:ing)?|sob[^\]]*|sigh[^\]]*|cough[^\]]*|yawn[^\]]*|clear[^\]]*throat|sings?|singing|snort[^\]]*|breathe?|inhale|exhale|hum-tune|wheezing)\]/i.test(fixtureText)) throw UsageError(`Nonverbal cue excluded: ${entry.id}`)
  if (entry.category === 'emotion' && /<speed\b|<break\b|\[(?:slow|slowly|fast|rushed|normal pace|.*pause)\]|"(?:speed|trailingSilence)"/.test(fixtureText + JSON.stringify(entry.turnControls))) throw UsageError(`Timing controls belong in speed-pauses: ${entry.id}`)
  const options = {
    ...buildOptsFromFlags(entry.flags, {}, new Set(Object.keys(entry.flags)), { scope: 'tts' }),
    batchConcurrency: 1,
    ttsTurnControls: normalizeTtsTurnControls(entry.turnControls as TtsTurnControls),
    ttsProviderConcurrency: 1,
    ttsChunkConcurrency: 1
  }
  const targets = collectTtsTargets(options)
  if (targets.length !== 1 || targets[0]?.service !== entry.provider || targets[0]?.model !== entry.model) {
    throw UsageError(`Case ${entry.id} must select exactly its documented provider/model`)
  }
  const prepared = await prepareTtsInput(entry.input, options, new Date().toISOString())
  validateTtsRenderInputsForTargets(targets, prepared.text, options, prepared)
  // Native Hume planning includes speaker labels in its billable-text estimate.
  const estimateInput = entry.provider === 'hume' && entry.model === 'octave-2'
    ? { ...prepared, ttsCharacterCount: prepared.text.trim().length }
    : prepared
  const estimate = await buildTtsEstimateForInput(estimateInput, options, targets)
  if (!Number.isFinite(estimate.totalEstimatedCost) || estimate.totalEstimatedCost < 0) throw UsageError(`Unknown cost for ${entry.id}`)
  // Adding an evaluation reference must not invalidate unchanged, already-paid synthesis.
  const { spokenLines: _spokenLines, ...synthesisEntry } = entry
  const fingerprint = new Bun.CryptoHasher('sha256').update(JSON.stringify(synthesisEntry)).update(prepared.sourceBytes).digest('hex')
  const directory = resolve(outputDir ?? ledger.outputBase ?? 'docs/benchmarks/tts', entry.category === 'emotion' ? '2026-09-12_05-tts-emotion' : '2026-09-12_06-tts-speed-pauses', entry.id)
  const existing = Bun.file(`${directory}/manifest.json`)
  let reuse = false
  if (!await existing.exists() && await Bun.file(`${directory}/benchmark-fingerprint.txt`).exists()) throw UsageError(`Interrupted preparation at ${directory}; inspect it before retrying`)
  if (await existing.exists()) {
    const stamp = Bun.file(`${directory}/benchmark-fingerprint.txt`)
    if (!await stamp.exists() || (await stamp.text()).trim() !== fingerprint) throw UsageError(`Existing run differs: ${directory}; preserve it and choose a new directory`)
    const prior = await existing.json()
    reuse = prior.items?.length === 1 && prior.items[0].providers?.length === 1 && prior.items[0].providers[0].status === 'succeeded'
    if (!reuse) throw UsageError(`Incomplete run at ${directory}; reconcile it before another paid attempt`)
    const ref = prior.items[0].providers[0].metadata.ttsAudio.archive.finalRef
    const hash = new Bun.CryptoHasher('sha256').update(await Bun.file(`${directory}/${ref.path}`).arrayBuffer()).digest('hex')
    if (hash !== ref.sha256) throw UsageError(`Cached audio hash mismatch: ${directory}`)
  }
  preparedCases.push({ entry, options, targets, estimate, fingerprint, directory, reuse })
}
const incrementalCents = preparedCases.reduce((sum, c) => sum + (c.reuse ? 0 : c.estimate.totalEstimatedCost), 0)
console.log(JSON.stringify({ mode: run ? 'run' : 'price', spentCents, incrementalCents, combinedCents: spentCents + incrementalCents, cases: preparedCases.map(c => ({ suite: c.entry.category, id: c.entry.id, reuse: c.reuse, estimatedCents: c.estimate.totalEstimatedCost, source: c.entry.source })) }, null, 2))
if (run && spentCents + incrementalCents > approvedBudgetCents) throw UsageError('Combined estimate exceeds the spending ceiling; approval is required before raising --approved-budget-cents above 25')
if (run) for (const c of preparedCases) {
  if (c.reuse) continue
  configurePinnedRunDir(c.directory)
  await Bun.write(`${c.directory}/benchmark-fingerprint.txt`, c.fingerprint + '\n')
  await Bun.write(`${c.directory}/input.txt`, await Bun.file(c.entry.input).text())
  await Bun.write(`${c.directory}/controls.json`, JSON.stringify(c.entry, null, 2) + '\n')
  const remainingCents = approvedBudgetCents - spentCents
  // Reserve the full estimate before dispatch: failures and interruption never reset spending.
  spentCents += c.estimate.totalEstimatedCost
  ledger.priorEstimatedCents = spentCents
  await Bun.write(ledgerPath, JSON.stringify(ledger, null, 2) + '\n')
  await runSingleTtsInput(c.entry.input, c.options, c.targets, remainingCents)
  const result = await Bun.file(`${c.directory}/manifest.json`).json()
  if (result.items?.[0]?.providers?.[0]?.status !== 'succeeded') throw UsageError(`Generation failed: ${c.directory}; preserve outputs before retrying`)
}
