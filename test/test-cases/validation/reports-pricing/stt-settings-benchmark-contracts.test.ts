import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { cp, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { withLocalTestDir } from '../../../test-utils/temp-dirs'
import {
  LEDGER_PATH, appendAttempt, assertApprovedBudget, assessLosslessFeasibility, buildExtractArgs, buildReferenceSource, buildRunFlags, buildVariantRecord,
  classifyDispatchFailure, computeCumulativeSpentCents, countReferenceSpeakers, ledgerRunState, normalizeSingleProviderLayout, parseLedger, readMp3Format,
  resolveAttempt, runMaxCents
} from '~/tools/stt-settings-benchmark-plan'

// Mocked/no-network contracts. The runner's price path spawns the CLI with an empty environment and no
// .env file, so no provider credential exists; these tests prove plan, command and ledger behavior only
// (no transport, decoded-integrity or transcript-correctness claims).

const TOOL = resolve('src/tools/stt-settings-benchmark.ts')
const AUDIO = resolve('input/examples/audio/1-audio.mp3')

const recording = (overrides: Record<string, unknown> = {}) => ({ id: 'clip', source: 'clip.mp3', reference: 'reference.txt', durationSeconds: 59.585306, ...overrides })
const variant = (overrides: Record<string, unknown> = {}) => ({ id: 'grok-verbatim', baseline: { service: 'grok', model: 'grok-voice-transcribe-2.0' }, provider: 'grok=grok-voice-transcribe-2.0', settings: ['--stt-verbatim', 'true'], ...overrides })
const ledger = (overrides: Record<string, unknown> = {}) => ({
  schemaVersion: 2, benchmarkDate: '2026-11-20', outputBase: 'out', cumulativeSpentCents: 0, approvals: [],
  recordings: [recording()], variants: [variant()], skips: [], runs: [], ...overrides
})
const REFERENCE = '[00:00:00] [speaker-1] Hello there.\n[00:00:02] [speaker-2] Thanks, mention [speaker-9] inline only.\n[00:00:05] [speaker-1] Bye.\n'

const invokeWith = async (extraEnv: Record<string, string>, cwd: string, ...args: string[]) => {
  const child = Bun.spawn([process.execPath, '--no-env-file', TOOL, ...args], {
    cwd, env: { PATH: Bun.env['PATH'] ?? '', HOME: Bun.env['HOME'] ?? '', BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0', ...extraEnv }, stdout: 'pipe', stderr: 'pipe'
  })
  const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  return { code, stdout, stderr }
}
const invoke = async (cwd: string, ...args: string[]) => await invokeWith({}, cwd, ...args)

// A local stand-in for the autoshow CLI: no network, no credentials. --price prints a 10¢ dry-run estimate;
// otherwise FAKE_MODE decides the outcome: succeed (9.5¢ manifest), refuse (usage exit 2 before any output),
// or post-dispatch (a manifest that records a remote job id, exit 1).
const FAKE_CLI = `
const args = Bun.argv.slice(2)
const [service, model] = args[args.indexOf('--provider') + 1].split('=')
const outputDir = args[args.indexOf('--output-dir') + 1]
if (args.includes('--price')) {
  console.log(JSON.stringify({ type: 'result', status: 'success', data: { dryRun: true, estimate: { totalEstimatedCostCents: 10, steps: [{ provider: service, model }] } } }))
  process.exit(0)
}
const mode = Bun.env.FAKE_MODE
const provider = { service, model, artifactDir: '.', options: { diarizationOptions: { enabled: true } }, attempts: 1 }
if (mode === 'refuse') { console.error('Unknown flag'); process.exit(2) }
if (mode === 'post-dispatch') {
  await Bun.write(outputDir + '/manifest.json', JSON.stringify({ command: 'extract', scope: 'single', items: [{ outputDir, status: 'incomplete', providers: [{ ...provider, status: 'failed', error: { message: 'socket closed' }, metadata: { runtime: { mode: 'fresh', stage: 'polling', remoteJobId: 'job-1' } } }] }] }))
  process.exit(1)
}
await Bun.write(outputDir + '/result.json', '{"segments":[]}')
await Bun.write(outputDir + '/manifest.json', JSON.stringify({ command: 'extract', scope: 'single', items: [{ outputDir, status: 'full', metadata: { cost: { actual: { totalCost: 9.5 } } }, providers: [{ ...provider, status: 'succeeded' }] }] }))
`
const fakeRunner = async (root: string) => {
  const entry = join(root, 'fake-cli.ts')
  await Bun.write(entry, FAKE_CLI)
  return async (mode: string, ...args: string[]) => await invokeWith({ STT_SETTINGS_BENCHMARK_CLI_ENTRY: entry, FAKE_MODE: mode }, root, ...args)
}
const run = (variantId: string, overrides: Record<string, unknown> = {}) => ({ variantId, recordingId: 'clip', attempt: 1, recordedAt: 'then', ...overrides })

const setup = async (root: string, plan: Record<string, unknown>): Promise<string> => {
  await cp(AUDIO, join(root, 'clip.mp3'))
  await Bun.write(join(root, 'reference.txt'), REFERENCE)
  const path = join(root, 'plan.json')
  await Bun.write(path, JSON.stringify(plan, null, 2) + '\n')
  return path
}

const succeededManifest = (service: string, model: string, artifactDir: string, outputDir: string, totalCost = 0.5) => ({
  command: 'extract', scope: 'single',
  items: [{ outputDir, status: 'full', metadata: { cost: { actual: { totalCost, steps: [{ step: 'stt', provider: service, model, cost: totalCost }] } } }, providers: [{ service, model, artifactDir, status: 'succeeded', options: { diarizationOptions: { enabled: true } }, result: { segments: [] } }] }]
})

describe('STT settings benchmark plan', () => {
  test('the committed ledger validates, pins 2026-11-20 and records the promoted 3.5 Pro spend and the user approval', async () => {
    const parsed = parseLedger(await Bun.file(LEDGER_PATH).json())
    expect(parsed.benchmarkDate).toBe('2026-11-20')
    expect(parsed.outputBase).toBe('docs/benchmarks/stt/settings')
    expect(parsed.recordings.map(r => r.id)).toEqual(['1-audio', '2022-09-30-widgets-fsjam-40-minutes', '2023-03-15-jsjam-qwik-misko-hevery', '2023-04-05-jsjam-react-miami-2023-10-minutes'])
    const promoted = parsed.runs.filter(run => run.variantId === 'assemblyai-3-5-pro-rerun-2026-11-20')
    expect(promoted).toHaveLength(4)
    expect(promoted.every(run => run.status === 'completed')).toBe(true)
    expect(promoted.reduce((sum, run) => sum + run.actualCents!, 0)).toBeCloseTo(62.956, 3)
    // The live ledger grows with every paid run; assert only internal consistency, never a fixed total.
    expect(parsed.cumulativeSpentCents).toBeCloseTo(computeCumulativeSpentCents(parsed.runs), 6)
    expect(parsed.approvals[0]).toMatchObject({ approvedTotalCents: 795.956 })
    expect(parsed.approvals[0]!.note).toContain('up to $7.33')
    const refused = parsed.runs.filter(run => run.status === 'refused')
    expect(refused.every(run => run.actualCents === 0 && run.reason)).toBe(true)
    expect(refused.filter(run => run.archivedPath).map(run => run.archivedPath!.split('/').pop()).sort()).toEqual([
      'gladia-solaria-3-speaker-count__1-audio__invalid-auth',
      'lossless-assemblyai-3-7__2023-04-05-jsjam-react-miami-2023-10-minutes__upload-socket-closed',
      'lossless-deepgram-nova-3__1-audio__invalid-auth',
      'lossless-speechmatics-melia-1__1-audio__missing-api-key'
    ])
    expect(parsed.skips.map(skip => `${skip.variantId}/${skip.recordingId}`).sort()).toEqual([
      'lossless-gladia-solaria-3', 'lossless-grok-voice-2-0', 'lossless-mistral-voxtral-mini-2602', 'lossless-soniox-stt-async-v5', 'lossless-speechmatics-melia-1'
    ].map(id => `${id}/2023-03-15-jsjam-qwik-misko-hevery`))
  })

  test('schema rejects bad ids, runner-owned flags, unknown references and a drifted cumulative spend', () => {
    expect(() => parseLedger(ledger())).not.toThrow()
    expect(() => parseLedger(ledger({ variants: [variant({ id: 'Bad_ID' })] }))).toThrow(/variants/)
    expect(() => parseLedger(ledger({ variants: [variant({ settings: ['--diarization'] })] }))).toThrow(/must not include --diarization/)
    expect(() => parseLedger(ledger({ variants: [variant({ settings: ['--speaker-count', '2'] })] }))).toThrow(/--speaker-count/)
    expect(() => parseLedger(ledger({ recordings: [recording({ source: '/abs/clip.mp3' })] }))).toThrow(/repository-relative/)
    expect(() => parseLedger(ledger({ skips: [{ variantId: 'missing', recordingId: 'clip', reason: 'x' }] }))).toThrow(/Unknown variant/)
    expect(() => parseLedger(ledger({ variants: [variant(), variant()] }))).toThrow(/Duplicate variant id/)
    expect(() => parseLedger(ledger({ cumulativeSpentCents: 1 }))).toThrow(/differs from its run records/)
    expect(() => parseLedger(ledger({ cumulativeSpentCents: 2.5, runs: [run('grok-verbatim', { status: 'failed', estimatedCents: 2.5 })] }))).not.toThrow()
    expect(() => parseLedger(ledger({ runs: [run('grok-verbatim', { status: 'refused', actualCents: 0 })] }))).toThrow(/actualCents 0 and a reason/)
    expect(() => parseLedger(ledger({ cumulativeSpentCents: 2, runs: [run('grok-verbatim', { status: 'failed', estimatedCents: 1 }), run('grok-verbatim', { status: 'failed', estimatedCents: 1 })] }))).toThrow(/Duplicate run attempt/)
    expect(() => parseLedger(ledger({ cumulativeSpentCents: 2, runs: [run('grok-verbatim', { status: 'completed', actualCents: 1 }), run('grok-verbatim', { attempt: 2, status: 'completed', actualCents: 1 })] }))).toThrow(/Duplicate completed run/)
    expect(() => parseLedger(ledger({ runs: [run('grok-verbatim', { status: 'completed' })] }))).toThrow(/needs actualCents/)
    expect(() => parseLedger({ ...ledger(), extra: true })).toThrow()
  })

  test('each committed variant builds its exact CLI flags with --diarization and reference speaker counts', async () => {
    const parsed = parseLedger(await Bun.file(LEDGER_PATH).json())
    const counts: Record<string, number> = {}
    for (const r of parsed.recordings) counts[r.id] = countReferenceSpeakers(await Bun.file(r.reference).text())
    expect(counts).toEqual({ '1-audio': 2, '2022-09-30-widgets-fsjam-40-minutes': 2, '2023-03-15-jsjam-qwik-misko-hevery': 12, '2023-04-05-jsjam-react-miami-2023-10-minutes': 6 })
    const flags = Object.fromEntries(parsed.variants.map(v => [v.id, buildRunFlags(v, v.speakerCountFromReference ? counts['2023-03-15-jsjam-qwik-misko-hevery'] : undefined)]))
    expect(flags).toEqual({
      'assemblyai-3-7-filler-words': ['--provider', 'assemblyai=assemblyai-stt-3-7', '--diarization', '--stt-filler-words', 'true'],
      'assemblyai-3-7-spoken-numbers': ['--provider', 'assemblyai=assemblyai-stt-3-7', '--diarization', '--stt-number-format', 'spoken'],
      'assemblyai-3-7-speaker-count': ['--provider', 'assemblyai=assemblyai-stt-3-7', '--diarization', '--speaker-count', '12'],
      'gladia-solaria-3-speaker-count': ['--provider', 'gladia=solaria-3', '--diarization', '--speaker-count', '12'],
      'grok-voice-2-0-verbatim': ['--provider', 'grok=grok-voice-transcribe-2.0', '--diarization', '--stt-verbatim', 'true'],
      'lossless-assemblyai-3-7': ['--provider', 'assemblyai=assemblyai-stt-3-7', '--diarization', '--stt-audio-profile', 'lossless'],
      'lossless-deepgram-nova-3': ['--provider', 'deepgram=nova-3', '--diarization', '--stt-audio-profile', 'lossless'],
      'lossless-gemini-3-5-transcribe': ['--provider', 'gemini=gemini-3.5-transcribe', '--diarization', '--stt-audio-profile', 'lossless'],
      'lossless-gladia-solaria-3': ['--provider', 'gladia=solaria-3', '--diarization', '--stt-audio-profile', 'lossless'],
      'lossless-grok-voice-2-0': ['--provider', 'grok=grok-voice-transcribe-2.0', '--diarization', '--stt-audio-profile', 'lossless'],
      'lossless-mistral-voxtral-mini-2602': ['--provider', 'mistral=voxtral-mini-2602', '--diarization', '--stt-audio-profile', 'lossless'],
      'lossless-soniox-stt-async-v5': ['--provider', 'soniox=stt-async-v5', '--diarization', '--stt-audio-profile', 'lossless'],
      'lossless-speechmatics-melia-1': ['--provider', 'speechmatics=melia-1', '--diarization', '--stt-audio-profile', 'lossless'],
      'assemblyai-3-5-pro-rerun-2026-11-20': ['--provider', 'assemblyai=universal-3-5-pro', '--diarization']
    })
    const speakerVariant = parsed.variants.find(v => v.id === 'gladia-solaria-3-speaker-count')!
    expect(() => buildRunFlags(speakerVariant, undefined)).toThrow(/speaker count/)
    expect(buildVariantRecord(speakerVariant, buildRunFlags(speakerVariant, 6))).toEqual({
      schemaVersion: 1, variantId: 'gladia-solaria-3-speaker-count', label: 'speaker-count=6', baseline: { service: 'gladia', model: 'solaria-3' },
      flags: ['--provider', 'gladia=solaria-3', '--diarization', '--speaker-count', '6']
    })
    expect(buildExtractArgs('a.mp3', ['--provider', 'x=y'], 'out/v__r', 'price')).toEqual(['extract', 'a.mp3', '--provider', 'x=y', '--output-dir', 'out/v__r', '--price', '--json'])
    expect(buildExtractArgs('a.mp3', [], 'out/v__r', { maxCents: runMaxCents(43.271) })).toEqual(['extract', 'a.mp3', '--output-dir', 'out/v__r', '--max-model-cents', '45'])
  })

  test('speaker counts come from line-leading [speaker-N] labels only', () => {
    expect(countReferenceSpeakers(REFERENCE)).toBe(2)
    expect(countReferenceSpeakers('[speaker-3] a\n[speaker-1] b\n[00:01] [speaker-12] c')).toBe(3)
    expect(() => countReferenceSpeakers('no labels here')).toThrow(/no \[speaker-N\]/)
  })

  test('reference-source records the repository-relative path and sha256 of the reference bytes', async () => {
    expect(buildReferenceSource('docs/x/consensus-transcription.txt', 'abc')).toEqual({
      schemaVersion: 1, path: 'docs/x/consensus-transcription.txt', sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    })
    const parsed = parseLedger(await Bun.file(LEDGER_PATH).json())
    for (const r of parsed.recordings) {
      const sidecar = await Bun.file(`${parsed.outputBase}/assemblyai-3-5-pro-rerun-2026-11-20__${r.id}/reference-source.json`).json()
      expect(sidecar).toEqual(buildReferenceSource(r.reference, await Bun.file(r.reference).arrayBuffer()))
    }
  })

  test('the approved total must cover recorded spend plus remaining batch headroom', () => {
    expect(() => assertApprovedBudget(undefined, { cumulativeSpentCents: 0, remainingCapCents: 1 })).toThrow(/approved-budget-cents/)
    expect(() => assertApprovedBudget(9.99, { cumulativeSpentCents: 0, remainingCapCents: 10 })).toThrow(/at least 10.000¢/)
    expect(() => assertApprovedBudget(15, { cumulativeSpentCents: 9.5, remainingCapCents: 11 })).toThrow(/recorded spend 9.500¢ \+ remaining batch headroom 11.000¢/)
    expect(() => assertApprovedBudget(20.5, { cumulativeSpentCents: 9.5, remainingCapCents: 11 })).not.toThrow()
    expect(() => assertApprovedBudget(0, { cumulativeSpentCents: 0, remainingCapCents: 0 })).not.toThrow()
  })

  test('attempts are appended, final attempts are never replaced, and only unresolved attempts block', () => {
    const parsed = parseLedger(ledger({ cumulativeSpentCents: 0 }))
    const first = appendAttempt(parsed, { variantId: 'grok-verbatim', recordingId: 'clip', status: 'dispatched', estimatedCents: 10, recordedAt: 'a' })
    expect(ledgerRunState(parsed, 'grok-verbatim', 'clip')).toMatchObject({ kind: 'unresolved' })
    resolveAttempt(parsed, first, { status: 'refused', actualCents: 0, reason: 'usage' })
    expect(() => resolveAttempt(parsed, first, { status: 'failed' })).toThrow(/final and is never replaced/)
    expect(ledgerRunState(parsed, 'grok-verbatim', 'clip')).toEqual({ kind: 'retryable', attempts: 1 })
    const second = appendAttempt(parsed, { variantId: 'grok-verbatim', recordingId: 'clip', status: 'dispatched', estimatedCents: 10, recordedAt: 'b' })
    expect(second.attempt).toBe(2)
    resolveAttempt(parsed, second, { status: 'failed', reason: 'post-dispatch' })
    expect(computeCumulativeSpentCents(parsed.runs)).toBe(10)
    second.archivedPath = 'output/archived/grok-verbatim__clip__failed'
    expect(ledgerRunState(parsed, 'grok-verbatim', 'clip')).toEqual({ kind: 'retryable', attempts: 2 })
    const third = appendAttempt(parsed, { variantId: 'grok-verbatim', recordingId: 'clip', status: 'dispatched', estimatedCents: 10, recordedAt: 'c' })
    resolveAttempt(parsed, third, { status: 'completed', actualCents: 9.5 })
    expect(() => resolveAttempt(parsed, third, { actualCents: 1 })).toThrow(/never replaced/)
    expect(parsed.runs.map(r => [r.attempt, r.status])).toEqual([[1, 'refused'], [2, 'failed'], [3, 'completed']])
    expect(computeCumulativeSpentCents(parsed.runs)).toBe(19.5)
    expect(ledgerRunState(parsed, 'grok-verbatim', 'clip')).toMatchObject({ kind: 'completed', record: { attempt: 3 } })
  })

  test('failed dispatches are 0¢ refusals only with pre-dispatch evidence; anything else stays reserved', () => {
    const manifest = (provider: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ items: [{ ...extra, providers: [{ service: 'x', model: 'y', status: 'failed', attempts: 1, ...provider }] }] })
    expect(classifyDispatchFailure(2, undefined)).toMatchObject({ refused: true })
    expect(classifyDispatchFailure(1, undefined)).toMatchObject({ refused: false })
    expect(classifyDispatchFailure(2, manifest({ status: 'pending', attempts: 0 }))).toMatchObject({ refused: true })
    expect(classifyDispatchFailure(1, manifest({ error: { message: 'Gladia upload failed (401): {"message":"gladia user not found"}' } }))).toMatchObject({ refused: true })
    expect(classifyDispatchFailure(1, manifest({ error: { message: 'Deepgram transcription failed (401): {"err_code":"INVALID_AUTH"}' } }))).toMatchObject({ refused: true })
    expect(classifyDispatchFailure(1, manifest({ error: { message: 'SPEECHMATICS_API_KEY environment variable is required for Speechmatics transcription' } }))).toMatchObject({ refused: true })
    // Conservative: a socket close, a usage-coded post-request error, a remote job or a recorded cost keep the reservation.
    expect(classifyDispatchFailure(1, manifest({ error: { message: 'The socket connection was closed unexpectedly.' } }))).toMatchObject({ refused: false })
    expect(classifyDispatchFailure(2, manifest({ error: { message: 'Gemini returned an unrecognized batch state' } }))).toMatchObject({ refused: false })
    expect(classifyDispatchFailure(1, manifest({ error: { message: '(401)' }, metadata: { runtime: { remoteJobId: 'j' } } }))).toMatchObject({ refused: false })
    expect(classifyDispatchFailure(2, manifest({ status: 'pending', attempts: 0 }, { metadata: { cost: { actual: { totalCost: 1 } } } }))).toMatchObject({ refused: false })
  })

  test('lossless feasibility skips only splits the WAV adds over the default-profile baseline', async () => {
    const format = readMp3Format(new Uint8Array(await Bun.file(AUDIO).slice(0, 1 << 16).arrayBuffer()))
    expect(format.channels).toBeGreaterThan(0)
    const qwik = { durationSeconds: 6772, baselineBytes: 81274797, format: { sampleRate: 48000, channels: 1 } }
    const grok = assessLosslessFeasibility({ service: 'grok', model: 'grok-voice-transcribe-2.0' }, qwik, { effectiveBytes: 524288000 })
    expect(grok).toMatchObject({ feasible: false, wavBytes: 6772 * 48000 * 4 + 4096 })
    expect(grok.reason).toContain('exceeds the 524,288,000 B upload cap')
    expect(assessLosslessFeasibility({ service: 'assemblyai', model: 'assemblyai-stt-3-7' }, qwik, { effectiveBytes: 2362232013, durationSeconds: 36000 })).toMatchObject({ feasible: true })
    // Gemini's 30-minute diarization cap splits both the default MP3 and the WAV, so the profile stays isolated.
    expect(assessLosslessFeasibility({ service: 'gemini-stt', model: 'gemini-3.5-transcribe' }, qwik, { effectiveBytes: 2147483648, durationSeconds: 1800 })).toMatchObject({ feasible: true, sharedSplit: true })
  })

  test('single-provider runs are normalized into providers/<service>-<model>/ with a consistent manifest', async () => {
    await withLocalTestDir('stt-settings-normalize', async root => {
      await Bun.write(join(root, 'manifest.json'), JSON.stringify(succeededManifest('gemini-stt', 'gemini-3.5-transcribe', '.', 'output/x')))
      await Bun.write(join(root, 'result.json'), '{"segments":[]}')
      await Bun.write(join(root, 'transcription.txt'), 'text')
      const changes = await normalizeSingleProviderLayout(root)
      expect(changes).toContain('manifest items[0].providers[0].artifactDir: "." -> "providers/gemini-stt-gemini-3.5-transcribe"')
      expect(await Bun.file(join(root, 'providers/gemini-stt-gemini-3.5-transcribe/result.json')).text()).toBe('{"segments":[]}')
      expect(existsSync(join(root, 'result.json'))).toBe(false)
      const manifest = await Bun.file(join(root, 'manifest.json')).json()
      expect(manifest.items[0]).toMatchObject({ outputDir: '.', providers: [{ artifactDir: 'providers/gemini-stt-gemini-3.5-transcribe' }] })
      expect(await normalizeSingleProviderLayout(root)).toEqual([])
    })
  })
})

describe('STT settings benchmark runner (price-only subprocess, no credentials)', () => {
  test('--run refuses before any dispatch when the approved budget is below the estimate', async () => {
    await withLocalTestDir('stt-settings-budget', async root => {
      const plan = await setup(root, ledger())
      const before = await Bun.file(plan).text()
      const refused = await invoke(root, '--run', '--approved-budget-cents', '0', '--ledger', plan)
      expect(refused.code).not.toBe(0)
      expect(refused.stderr + refused.stdout).toContain('--run requires --approved-budget-cents (the approved cumulative total) of at least 1.000¢')
      expect(refused.stdout).toContain('| grok-verbatim | clip      | planned |')
      expect(refused.stdout).toContain('bun autoshow extract clip.mp3 --provider grok=grok-voice-transcribe-2.0 --diarization --stt-verbatim true --output-dir out/grok-verbatim__clip --max-model-cents 1')
      expect(existsSync(join(root, 'out'))).toBe(false)
      expect(await Bun.file(plan).text()).toBe(before)
    })
  }, 60_000)

  test('completed runs are skipped and never re-priced or re-dispatched', async () => {
    await withLocalTestDir('stt-settings-completed', async root => {
      const plan = await setup(root, ledger({ cumulativeSpentCents: 0.5, runs: [run('grok-verbatim', { status: 'completed', actualCents: 0.5 })] }))
      await Bun.write(join(root, 'out/grok-verbatim__clip/manifest.json'), JSON.stringify(succeededManifest('grok', 'grok-voice-transcribe-2.0', 'providers/grok-grok-voice-transcribe-2.0', '.')))
      const ran = await invoke(root, '--run', '--approved-budget-cents', '0', '--ledger', plan)
      expect(ran.code).toBe(0)
      expect(ran.stdout).toContain('| completed |')
      expect(ran.stdout).toContain('Commands --run would execute (0):')
      expect(ran.stdout).toContain('Completed 0 run(s). Ledger cumulative spend: 0.500¢')
    })
  }, 60_000)

  test('an existing directory without a succeeded manifest blocks --run as incomplete', async () => {
    await withLocalTestDir('stt-settings-incomplete', async root => {
      const plan = await setup(root, ledger())
      await mkdir(join(root, 'out/grok-verbatim__clip'), { recursive: true })
      const ran = await invoke(root, '--run', '--approved-budget-cents', '100', '--ledger', plan)
      expect(ran.code).not.toBe(0)
      expect(ran.stdout).toContain('| incomplete |')
      expect(ran.stderr + ran.stdout).toContain('--run refused')
    })
  }, 60_000)

  test('an infeasible lossless run must be recorded as skipped, and is then reported with its reason', async () => {
    await withLocalTestDir('stt-settings-infeasible', async root => {
      const lossless = variant({ id: 'lossless-grok', settings: ['--stt-audio-profile', 'lossless'] })
      const long = recording({ durationSeconds: 6772 })
      const unrecorded = await setup(root, ledger({ variants: [lossless], recordings: [long] }))
      const failed = await invoke(root, '--price', '--ledger', unrecorded)
      expect(failed.code).not.toBe(0)
      expect(failed.stderr + failed.stdout).toContain('Infeasible run is not recorded as skipped in the ledger: lossless-grok/clip')
      const recorded = await setup(root, ledger({ variants: [lossless], recordings: [long], skips: [{ variantId: 'lossless-grok', recordingId: 'clip', reason: 'WAV exceeds the grok upload cap' }] }))
      const priced = await invoke(root, '--price', '--ledger', recorded)
      expect(priced.code).toBe(0)
      expect(priced.stdout).toContain('| skipped |')
      expect(priced.stdout).toContain('lossless-grok/clip [skipped]: WAV exceeds the grok upload cap')
      expect(priced.stdout).toContain('Commands --run would execute (0):')
    })
  }, 60_000)

  test('--promote copies a paid run without its audio, normalizes it and records its actual cost', async () => {
    await withLocalTestDir('stt-settings-promote', async root => {
      const promotedVariant = variant({ id: 'rerun', label: 'rerun=x', baseline: { service: 'assemblyai', model: 'universal-3-5-pro' }, provider: 'assemblyai=universal-3-5-pro', settings: [], promotedFrom: 'paid' })
      const plan = await setup(root, ledger({ variants: [promotedVariant] }))
      await Bun.write(join(root, 'paid/clip/manifest.json'), JSON.stringify(succeededManifest('assemblyai', 'universal-3-5-pro', '.', 'paid/clip', 0.377)))
      await Bun.write(join(root, 'paid/clip/result.json'), JSON.stringify({ segments: [], evidence: { words: [{ text: 'hi' }] } }))
      await Bun.write(join(root, 'paid/clip/transcription.txt'), 'hi')
      await cp(AUDIO, join(root, 'paid/clip/clip.mp3'))
      const promoted = await invoke(root, '--promote', 'rerun', '--ledger', plan)
      expect(promoted.code).toBe(0)
      const dir = join(root, 'out/rerun__clip')
      expect(existsSync(join(dir, 'clip.mp3'))).toBe(false)
      expect(existsSync(join(root, 'paid/clip/clip.mp3'))).toBe(true)
      expect(existsSync(join(root, 'paid/clip/result.json'))).toBe(true)
      const manifest = await Bun.file(join(dir, 'manifest.json')).json()
      expect(manifest.items[0]).toMatchObject({ outputDir: '.', providers: [{ artifactDir: 'providers/assemblyai-universal-3-5-pro' }] })
      expect(manifest.items[0].providers[0].result).toBeUndefined()
      expect(await Bun.file(join(dir, 'variant.json')).json()).toEqual({ schemaVersion: 1, variantId: 'rerun', label: 'rerun=x', baseline: { service: 'assemblyai', model: 'universal-3-5-pro' }, flags: ['--provider', 'assemblyai=universal-3-5-pro', '--diarization'] })
      const updated = parseLedger(await Bun.file(plan).json())
      expect(updated.cumulativeSpentCents).toBeCloseTo(0.377, 6)
      expect(updated.runs[0]).toMatchObject({ variantId: 'rerun', recordingId: 'clip', attempt: 1, status: 'completed', actualCents: 0.377 })
      const again = await invoke(root, '--promote', 'rerun', '--ledger', plan)
      expect(again.code).not.toBe(0)
      expect(again.stderr + again.stdout).toContain('Refusing to overwrite existing')
    })
  }, 60_000)

  test('a completed attempt whose directory is missing is incomplete and never re-dispatched', async () => {
    await withLocalTestDir('stt-settings-moved', async root => {
      const call = await fakeRunner(root)
      const plan = await setup(root, ledger({ cumulativeSpentCents: 9.5, runs: [run('grok-verbatim', { status: 'completed', actualCents: 9.5 })] }))
      const before = await Bun.file(plan).text()
      const ran = await call('succeed', '--run', '--approved-budget-cents', '1000', '--ledger', plan)
      expect(ran.code).not.toBe(0)
      expect(ran.stdout).toContain('| incomplete |')
      expect(ran.stdout).toContain('ledger records completed attempt 1 but out/grok-verbatim__clip is missing')
      expect(ran.stdout).toContain('Commands --run would execute (0):')
      expect(existsSync(join(root, 'out'))).toBe(false)
      expect(await Bun.file(plan).text()).toBe(before)
    })
  }, 60_000)

  test('the approved total is enforced across split --variant invocations using recorded spend', async () => {
    await withLocalTestDir('stt-settings-split', async root => {
      const call = await fakeRunner(root)
      const plan = await setup(root, ledger({ variants: [variant({ id: 'a' }), variant({ id: 'b' })] }))
      // Each run estimates 10¢ (headroom 11¢); the whole batch needs 22¢ even when only --variant a is selected.
      const tooLow = await call('succeed', '--run', '--variant', 'a', '--approved-budget-cents', '15', '--ledger', plan)
      expect(tooLow.code).not.toBe(0)
      expect(tooLow.stderr + tooLow.stdout).toContain('of at least 22.000¢')
      expect(existsSync(join(root, 'out'))).toBe(false)
      const first = await call('succeed', '--run', '--variant', 'a', '--approved-budget-cents', '22', '--approval-note', 'user approved 22¢', '--ledger', plan)
      expect(first.code).toBe(0)
      let parsed = parseLedger(await Bun.file(plan).json())
      expect(parsed.cumulativeSpentCents).toBe(9.5)
      expect(parsed.approvals).toEqual([expect.objectContaining({ approvedTotalCents: 22, note: 'user approved 22¢' })])
      // The second half cannot reset the threshold: 9.5¢ recorded + 11¢ headroom > 15¢.
      const split = await call('succeed', '--run', '--variant', 'b', '--approved-budget-cents', '15', '--ledger', plan)
      expect(split.code).not.toBe(0)
      expect(split.stderr + split.stdout).toContain('recorded spend 9.500¢ + remaining batch headroom 11.000¢')
      expect(existsSync(join(root, 'out/b__clip'))).toBe(false)
      const second = await call('succeed', '--run', '--variant', 'b', '--approved-budget-cents', '22', '--ledger', plan)
      expect(second.code).toBe(0)
      parsed = parseLedger(await Bun.file(plan).json())
      expect(parsed.cumulativeSpentCents).toBe(19)
      expect(parsed.approvals).toHaveLength(1)
      expect(parsed.runs.map(r => [r.variantId, r.attempt, r.status, r.estimatedCents, r.actualCents])).toEqual([['a', 1, 'completed', 10, 9.5], ['b', 1, 'completed', 10, 9.5]])
    })
  }, 60_000)

  test('a CLI refusal before dispatch is recorded at 0¢ and a retry appends a new attempt', async () => {
    await withLocalTestDir('stt-settings-refused', async root => {
      const call = await fakeRunner(root)
      const plan = await setup(root, ledger())
      const refused = await call('refuse', '--run', '--approved-budget-cents', '11', '--ledger', plan)
      expect(refused.code).not.toBe(0)
      expect(refused.stderr + refused.stdout).toContain('recorded at 0¢')
      let parsed = parseLedger(await Bun.file(plan).json())
      expect(parsed.runs).toEqual([expect.objectContaining({ attempt: 1, status: 'refused', estimatedCents: 10, actualCents: 0, reason: 'CLI usage refusal (exit 2) before any provider attempt' })])
      expect(parsed.cumulativeSpentCents).toBe(0)
      const retried = await call('succeed', '--run', '--approved-budget-cents', '11', '--ledger', plan)
      expect(retried.code).toBe(0)
      parsed = parseLedger(await Bun.file(plan).json())
      expect(parsed.runs.map(r => [r.attempt, r.status, r.actualCents])).toEqual([[1, 'refused', 0], [2, 'completed', 9.5]])
      expect(parsed.cumulativeSpentCents).toBe(9.5)
    })
  }, 60_000)

  test('a failure after a provider request keeps the reservation and blocks the next --run', async () => {
    await withLocalTestDir('stt-settings-post-dispatch', async root => {
      const call = await fakeRunner(root)
      const plan = await setup(root, ledger())
      const failed = await call('post-dispatch', '--run', '--approved-budget-cents', '11', '--ledger', plan)
      expect(failed.code).not.toBe(0)
      expect(failed.stderr + failed.stdout).toContain('the estimate stays reserved')
      const parsed = parseLedger(await Bun.file(plan).json())
      expect(parsed.runs).toEqual([expect.objectContaining({ attempt: 1, status: 'failed', estimatedCents: 10, reason: 'exit 1; manifest records a remote provider job or asset' })])
      expect(parsed.cumulativeSpentCents).toBe(10)
      expect(existsSync(join(root, 'out/grok-verbatim__clip/manifest.json'))).toBe(true)
      const again = await call('succeed', '--run', '--approved-budget-cents', '100', '--ledger', plan)
      expect(again.code).not.toBe(0)
      expect(again.stdout).toContain('| incomplete |')
      expect(parseLedger(await Bun.file(plan).json()).runs).toHaveLength(1)
    })
  }, 60_000)
})
