import { describe, expect, test } from 'bun:test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import {
  alignTokens, alignmentCost, applyOrthographicEquivalences, buildViewTokenStreams, collapseImmediateRepeats, levenshteinBreakdown,
  levenshteinDistance, loadProviderRuns, NEUTRAL_VIEWS, normalizeViewPhrases, parseSpokenNumbers, providerSettingsLabel,
  scoreNeutralViews, settingsProviderKey, splitFalseStartFragments, tokenize, viewWerDetailed,
  type NormalizationView, type Segment, type ViewToken,
  resolveReferenceTranscript, SCORING_VERSION,
} from '../../../../.codex/skills/consensus/scripts/stt/transcript_lib'
import { buildSttCombinedReport } from '../../../../.codex/skills/consensus/scripts/stt/build_combined_report'
import { REPOSITORY_ROOT } from '../../../../.codex/skills/consensus/scripts/shared/portable_paths'
import { writeMultiProviderManifestFixture } from '../../../test-utils/manifest-helpers'
import { readBunSpawnStreamText as readStreamText } from '../../../test-utils/stream-text'
import { withTempDir } from '../../../test-utils/temp-dirs'

const RUN_SCRIPT = resolve(import.meta.dir, '../../../../.codex/skills/consensus/scripts/run.ts')
const ALL_VIEWS: ReadonlySet<NormalizationView> = new Set(NEUTRAL_VIEWS)

const seg = (text: string, speaker = 'speaker-1', start = 0, end = 1): Segment => ({ start, end, speaker, text, rawStart: '', rawEnd: '' })
const viewText = (text: string, views: ReadonlySet<NormalizationView> = ALL_VIEWS): string =>
  buildViewTokenStreams([seg(text)], [], views).reference.filter(token => !token.optional).map(token => token.text).join(' ')
const neutralWer = (reference: string, candidate: string): number =>
  viewWerDetailed([seg(reference)], [seg(candidate)], false, undefined, ALL_VIEWS).wer

// Independent oracle: the pre-version-2 full-matrix breakdown (match whenever equal, then sub > del > ins).
function oracleBreakdown(reference: string[], candidate: string[]) {
  const n = reference.length
  const m = candidate.length
  const dp = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  const ops: string[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? 'ins' : j === 0 ? 'del' : '')))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (reference[i - 1] === candidate[j - 1]) { dp[i]![j] = dp[i - 1]![j - 1]!; ops[i]![j] = 'match'; continue }
      const sub = dp[i - 1]![j - 1]!; const del = dp[i - 1]![j]!; const ins = dp[i]![j - 1]!
      const min = Math.min(sub, del, ins)
      dp[i]![j] = min + 1
      ops[i]![j] = min === sub ? 'sub' : min === del ? 'del' : 'ins'
    }
  }
  const counts = { distance: dp[n]![m]!, substitutions: 0, deletions: 0, insertions: 0 }
  let i = n; let j = m
  while (i > 0 || j > 0) {
    const op = ops[i]![j]!
    if (op === 'match' || op === 'sub') { if (op === 'sub') counts.substitutions++; i--; j-- } else if (op === 'del') { counts.deletions++; i-- } else { counts.insertions++; j-- }
  }
  return counts
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32 }
}

function mutatedPair(random: () => number, length: number, vocabulary: number): [string[], string[]] {
  const reference = Array.from({ length }, () => `w${Math.floor(random() * vocabulary)}`)
  const candidate: string[] = []
  for (const token of reference) {
    const roll = random()
    if (roll < 0.05) continue
    if (roll < 0.12) candidate.push(`w${Math.floor(random() * vocabulary)}`)
    else candidate.push(token)
    if (random() < 0.04) candidate.push(`x${Math.floor(random() * vocabulary)}`)
  }
  return [reference, candidate]
}

describe('STT neutral views: disfluency', () => {
  test('false-start fragments ending in an attached dash become optional chunks', () => {
    expect(splitFalseStartFragments('you got fired— you got laid off')).toEqual([
      { text: 'you got fired', optional: true }, { text: ' you got laid off', optional: false },
    ])
    expect(splitFalseStartFragments('So, I—I think so')).toEqual([
      { text: 'So,', optional: false }, { text: ' I', optional: true }, { text: 'I think so', optional: false },
    ])
    expect(splitFalseStartFragments('we were -- no')).toEqual([{ text: 'we were -- no', optional: false }])
    expect(splitFalseStartFragments('the thing—which I love—is great').every(chunk => !chunk.optional)).toBe(true)
    expect(splitFalseStartFragments('a well-known 2010–2020 range').every(chunk => !chunk.optional)).toBe(true)
  })

  test('repeats collapse within one speaker turn and fillers are removed on both sides', () => {
    expect(viewText('I, I think so.')).toBe('i think so')
    expect(viewText('um so uh I I I mean you know you know')).toBe('so i mean you know')
    const tokens = (texts: Array<[string, string]>): ViewToken[] => texts.map(([text, speaker]) => ({ text, speaker, optional: false }))
    expect(collapseImmediateRepeats(tokens([['yes', 'a'], ['yes', 'b']])).map(token => token.text)).toEqual(['yes', 'yes'])
    expect(neutralWer('I, I think, you got fired— you got laid off.', 'I think, you got laid off.')).toBe(0)
    // Fragments longer than three words without a restart stay required.
    expect(neutralWer('I think you got fired— you got laid off.', 'I think you got laid off.')).toBeGreaterThan(0)
    expect(neutralWer('I think, you got laid off.', 'I I think, you got fired— you got laid off.')).toBe(0)
    // A provider that keeps an optional false start is matched for free, not penalized.
    expect(neutralWer('you got fired— you got laid off', 'you got fired you got laid off')).toBe(0)
  })
})

describe('STT neutral views: numbers', () => {
  const equivalentNumbers: Array<[string, string]> = [
    ['twenty-five people', '25 people'], ['twenty five', '25'], ['1,250', 'one thousand two hundred fifty'],
    ['one thousand two hundred and fifty', '1250'], ['3rd', 'third'], ['twenty first century', '21st century'],
    ['25%', 'twenty five percent'], ['twenty five per cent', '25 percent'], ['$5 million', 'five million dollars'],
    ['3.5', 'three point five'], ['a hundred', '100'], ['2023', 'twenty twenty three'], ['1999', 'nineteen ninety nine'],
    ['2005', 'twenty oh five'], ['2005', 'two thousand and five'], ['1,250,000', 'one point two five million'],
  ]
  test('spelled, digit, ordinal, decimal, percent, currency, and year forms share one canonical form', () => {
    for (const [left, right] of equivalentNumbers) expect([left, viewText(left)]).toEqual([left, viewText(right)])
  })

  test('phrase boundaries and non-year sequences stay separate', () => {
    expect(parseSpokenNumbers(['two', 'thirty'])).toEqual(['2', '30'])
    expect(parseSpokenNumbers(['wait', 'a', 'second'])).toEqual(['wait', 'a', '2nd'])
    expect(parseSpokenNumbers(['the', 'point', 'is'])).toEqual(['the', 'point', 'is'])
    expect(parseSpokenNumbers(['007'])).toEqual(['007'])
    expect(viewText('twenty, twenty three')).toBe('20 23')
    expect(viewText('twenty-five', new Set())).toBe('twenty five')
  })
})

describe('STT neutral views: orthographic', () => {
  test('equivalence table and hyphenated compounds', () => {
    expect(applyOrthographicEquivalences(['ok', 'all', 'right', 'can', 'not'])).toEqual(['okay', 'alright', 'cannot'])
    expect(viewText('ok')).toBe(viewText('okay'))
    expect(viewText('O.K.')).toBe('okay')
    expect(viewText('All right')).toBe(viewText('alright'))
    expect(viewText("it's", ALL_VIEWS)).toBe('it is')
    expect(viewText('just. first.')).toBe('just 1st')
    expect(normalizeViewPhrases('e-mail state-of-the-art twenty-five', new Set(['orthographic-neutral'])).phrases.flat())
      .toEqual(['email', 'stateoftheart', 'twenty', 'five'])
    expect(neutralWer('send a follow-up e-mail', 'send a follow up email')).toBe(0)
    expect(neutralWer('the state-of-the-art website', 'the state of the art web site')).toBe(0)
  })

  test('informal reductions expand symmetrically so only form differences are forgiven (scoring version 2.1)', () => {
    expect(SCORING_VERSION).toBe(2.1)
    expect(applyOrthographicEquivalences(['gonna', 'wanna', 'gotta', 'kinda', 'sorta']))
      .toEqual(['going', 'to', 'want', 'to', 'got', 'to', 'kind', 'of', 'sort', 'of'])
    expect(neutralWer("We're going to ship it because we want to.", "We're gonna ship it 'cause we wanna.")).toBe(0)
    expect(neutralWer('I got to go, it is kind of late, sort of.', 'I gotta go, it is kinda late, sorta.')).toBe(0)
    expect(viewText("‘cause it’s late")).toBe('because it is late')
    // Motion "going to" is untouched on both sides, so matching full forms still match.
    expect(viewText('going to the store')).toBe('going to the store')
    expect(neutralWer('we are going to the store', 'we are going to the store')).toBe(0)
    // Bare "cause" stays a noun; only the apostrophe-initial reduction reads as "because".
    expect(viewText('the cause')).toBe('the cause')
    expect(neutralWer('the cause', 'the because')).toBeGreaterThan(0)
    // A genuinely different word is still an error.
    expect(neutralWer('we are going to ship', 'we are gonna skip')).toBeGreaterThan(0)
    // Without the orthographic view the reductions remain legacy tokens.
    expect(viewText('gonna', new Set())).toBe('gonna')
  })

  test('short split words never merge into a joined form', () => {
    expect(neutralWer('come into the house', 'come in to the house')).toBeGreaterThan(0)
    expect(neutralWer('right away', 'right a way')).toBeGreaterThan(0)
  })

  test('with no views the pipeline equals the legacy tokenizer', () => {
    for (const text of ["Hello, world. It's 1,250 — yes! first.", 'Mr. Smith paid $5 (25%) for #3', 'state-of-the-art e-mail, O.K.?']) {
      expect(normalizeViewPhrases(text, new Set()).phrases.flat()).toEqual(tokenize(text))
    }
  })
})

describe('STT exact alignment', () => {
  test('matches the legacy full-matrix breakdown on random medium inputs', () => {
    const random = seededRandom(7)
    for (let trial = 0; trial < 25; trial++) {
      const [reference, candidate] = mutatedPair(random, 50 + Math.floor(random() * 400), 3 + Math.floor(random() * 40))
      const expected = oracleBreakdown(reference, candidate)
      expect(levenshteinBreakdown(reference, candidate)).toEqual(expected)
      expect(expected.distance).toBe(levenshteinDistance(reference, candidate))
      expect(alignmentCost(reference, candidate)).toBe(expected.distance)
    }
    expect(levenshteinBreakdown([], ['a'])).toEqual({ distance: 1, substitutions: 0, deletions: 0, insertions: 1 })
    expect(levenshteinBreakdown(['a', 'b'], [])).toEqual({ distance: 2, substitutions: 0, deletions: 2, insertions: 0 })
  })

  test('returns exact non-negative counts for long transcripts in reasonable time', () => {
    const [reference, candidate] = mutatedPair(seededRandom(11), 15_000, 400)
    const started = performance.now()
    const alignment = alignTokens(reference, candidate, { includeSteps: true })
    expect(performance.now() - started).toBeLessThan(30_000)
    expect(Math.min(alignment.substitutions, alignment.deletions, alignment.insertions)).toBeGreaterThanOrEqual(0)
    expect(alignment.substitutions + alignment.deletions + alignment.insertions).toBe(alignment.distance)
    expect(alignment.matches + alignment.substitutions + alignment.deletions).toBe(reference.length)
    expect(alignment.matches + alignment.substitutions + alignment.insertions).toBe(candidate.length)
    expect(alignment.steps).toHaveLength(alignment.matches + alignment.substitutions + alignment.deletions + alignment.insertions)
  })

  test('optional tokens are free to drop or add but still match', () => {
    const alignment = alignTokens(['a', 'b', 'c'], ['a', 'c', 'd'], { referenceOptional: [false, true, false], candidateOptional: [false, false, true] })
    expect(alignment).toMatchObject({ distance: 0, matches: 2, optionalDeletions: 1, optionalInsertions: 1, deletions: 0, insertions: 0 })
    expect(alignTokens(['a', 'b'], ['a', 'b'], { referenceOptional: [false, true] }).matches).toBe(2)
  })
})

describe('STT error attribution and speaker metrics', () => {
  test('ablation counts forgiven edits per view and classifies the remaining edits', () => {
    const reference = [seg('Um, I I think it was twenty five, okay?', 'speaker-1', 0, 5), seg('Yes it was great.', 'speaker-2', 5, 10)]
    const candidate = [seg('I think it was 25 ok?', 'A', 0, 5), seg('Yes it was good.', 'A', 5, 10)]
    const speakerMap = { A: 'speaker-1' }
    const strict = viewWerDetailed(reference, candidate, true, speakerMap, new Set())
    const strictEdits = strict.substitutions + strict.deletions + strict.insertions
    const scoring = scoreNeutralViews(reference, candidate, speakerMap, strictEdits)
    expect(scoring.attribution.strictEdits).toBe(strictEdits)
    expect(scoring.attribution.forgivenByView).toEqual({ disfluency: 1, orthographic: 1, numberFormat: 2 })
    expect(scoring.attribution.remaining).toEqual({ speakerAttribution: 1, numberFormat: 0, otherLexical: 1 })
    expect(scoring.attribution.neutralEdits).toBe(strictEdits - 4)
    expect(scoring.textOnly).toMatchObject({ substitutions: 1, deletions: 0, insertions: 0 })
    // 10 matched words; the 3 after the missed speaker change are attributed to the wrong speaker.
    expect(scoring.wordSpeakerAttribution).toEqual({ matchedWords: 9, correctlyAttributedWords: 6, accuracy: 6 / 9 })
  })
})

describe('STT settings-aware provider identity', () => {
  test('defaults keep the historical key and non-default settings get a stable sorted label', () => {
    const defaults = { request: { model: 'm', diarization: { enabled: true }, verbatim: false }, local: { local: false, audioProfile: 'default', split: false } }
    expect(providerSettingsLabel(defaults)).toBeNull()
    expect(providerSettingsLabel(undefined)).toBeNull()
    expect(settingsProviderKey('assemblyai', 'universal-3-5-pro', providerSettingsLabel(defaults))).toBe('assemblyai/universal-3-5-pro')
    const variant = {
      request: { model: 'm', numberFormat: 'spoken', fillerWords: true, verbatim: true, responseFormat: 'srt', diarization: { enabled: true, speakerCount: 2 } },
      local: { audioProfile: 'lossless' },
    }
    expect(providerSettingsLabel(variant)).toBe('audioProfile=lossless,fillerWords=true,numberFormat=spoken,responseFormat=srt,speakerCount=2,verbatim=true')
    expect(providerSettingsLabel({ request: { fillerWords: false } })).toBe('fillerWords=false')
  })
})

const REFERENCE_TEXT = '[00:00:00] [speaker-1] Twenty five people came.\n[00:00:04] [speaker-2] I, I agree.\n'

async function writeSttRun(runDir: string, settings?: Record<string, unknown>): Promise<void> {
  const segments = [
    { start: '00:00:00', end: '00:00:04', speaker: 'A', text: '25 people came.' },
    { start: '00:00:04', end: '00:00:08', speaker: 'B', text: 'I agree.' },
  ]
  await writeMultiProviderManifestFixture(runDir, {
    command: 'extract',
    extractRoute: 'media',
    metadata: { step1: { durationSeconds: 8, duration: '00:00:08' } },
    providerMetadata: { tokenCount: 4 },
    providers: [{
      dir: 'assemblyai-universal-3-5-pro', provider: 'assemblyai', model: 'universal-3-5-pro', processingTime: 1000, cost: 0.2,
      result: { text: '25 people came. I agree.', segments, evidence: { timingQuality: 'segment', capabilities: { hasSpeakerLabels: true } } },
    }],
  })
  if (settings) {
    const manifestPath = join(runDir, 'manifest.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    manifest.items[0].providers[0].settings = settings
    await writeFile(manifestPath, JSON.stringify(manifest))
  }
}

async function runBuildReport(runDir: string): Promise<{ exitCode: number, stderr: string }> {
  const proc = Bun.spawn([process.execPath, RUN_SCRIPT, 'stt', 'build-report', runDir], { stdout: 'pipe', stderr: 'pipe' })
  const [stderr, exitCode] = await Promise.all([readStreamText(proc.stderr), proc.exited])
  return { exitCode, stderr }
}

const reportRows = (report: { providerGroups: Record<string, { providers: any[] }> }): any[] =>
  Object.values(report.providerGroups).flatMap(group => group.providers)

describe('STT reference report: settings variants and reference-source.json', () => {
  test('a settings variant run scores against a verified reference-source.json under a labeled key', async () => {
    await withTempDir('stt-neutral-variant-', async root => {
      const referenceRun = join(root, 'reference-run')
      const variantRun = join(root, 'variant-run')
      await mkdir(referenceRun, { recursive: true })
      await mkdir(variantRun, { recursive: true })
      await writeFile(join(referenceRun, 'consensus-transcription.txt'), REFERENCE_TEXT)
      await writeSttRun(referenceRun)
      await writeSttRun(variantRun, { request: { model: 'universal-3-5-pro', numberFormat: 'written', diarization: { enabled: true, speakerCount: 2 } }, local: { audioProfile: 'default' } })
      const sha256 = new Bun.CryptoHasher('sha256').update(REFERENCE_TEXT).digest('hex')
      const repoRelative = relative(REPOSITORY_ROOT, join(referenceRun, 'consensus-transcription.txt'))
      await writeFile(join(variantRun, 'reference-source.json'), JSON.stringify({ schemaVersion: 1, path: repoRelative, sha256 }))

      expect(resolveReferenceTranscript(variantRun, null).referenceSource).toEqual({ schemaVersion: 1, path: repoRelative, sha256 })
      expect(await runBuildReport(referenceRun)).toEqual({ exitCode: 0, stderr: '' })
      expect(await runBuildReport(variantRun)).toEqual({ exitCode: 0, stderr: '' })

      const base = await Bun.file(join(referenceRun, 'reference-comparison-report.json')).json()
      const variant = await Bun.file(join(variantRun, 'reference-comparison-report.json')).json()
      expect(base.scoringVersion).toBe(SCORING_VERSION)
      expect(variant.referenceSource).toEqual({ schemaVersion: 1, path: repoRelative, sha256 })
      const [baseRow] = reportRows(base)
      const [variantRow] = reportRows(variant)
      expect(baseRow!.providerKey).toBe('assemblyai/universal-3-5-pro')
      expect(variantRow!.providerKey).toBe('assemblyai/universal-3-5-pro[numberFormat=written,speakerCount=2]')
      expect(variantRow!.model).toBe('universal-3-5-pro')
      expect(variantRow!.settingsLabel).toBe('numberFormat=written,speakerCount=2')
      // "25" vs "Twenty five" and the repeated "I, I" are neutral; the legacy score counts them.
      expect(baseRow!.metrics.score).toBe(100)
      expect(baseRow!.metrics.legacyScore).toBeLessThan(100)
      expect(baseRow!.speakerMetrics).toEqual({
        referenceSpeakerCount: 2, providerSpeakerCount: 2, speakerCountAbsoluteError: 0, matchedWords: 5, correctlyAttributedWords: 5, wordAttributionAccuracy: 1,
      })
      const markdown = await Bun.file(join(variantRun, 'reference-comparison-report.md')).text()
      expect(markdown).toContain('## Error Attribution (Speaker-aware)')
      expect(markdown).toContain('## Speaker Metrics')
      expect(markdown).toContain('Scoring version 2 changes the headline')

      await writeFile(join(variantRun, 'variant.json'), JSON.stringify({ variantId: 'spoken-numbers', label: 'numbers=spoken' }))
      expect(await runBuildReport(variantRun)).toEqual({ exitCode: 0, stderr: '' })
      const relabeled = await Bun.file(join(variantRun, 'reference-comparison-report.json')).json()
      expect(reportRows(relabeled)[0]!.providerKey).toBe('assemblyai/universal-3-5-pro[numbers=spoken]')

      const combined = buildSttCombinedReport(root, '2026-01-01T00:00:00.000Z')
      const keys = combined.groupedProviders.thirdPartyServiceDiarization.map(provider => provider.providerKey)
      expect(keys.sort()).toEqual(['assemblyai/universal-3-5-pro', 'assemblyai/universal-3-5-pro[numbers=spoken]'])
      const baseAggregate = combined.groupedProviders.thirdPartyServiceDiarization.find(provider => provider.providerKey === 'assemblyai/universal-3-5-pro')!
      expect(baseAggregate.meanQualityScore).toBe(100)
      expect(baseAggregate.meanLegacyQualityScore).toBe(baseRow!.metrics.legacyScore)
      expect(baseAggregate.meanWordAttributionAccuracy).toBe(1)
      expect(baseAggregate.errorAttributionTotals).toMatchObject({ runs: 1, neutralEdits: 0 })
      expect(combined.markdown).toContain('## Error Attribution')
      expect((combined.report as { scoringVersions: number[] }).scoringVersions).toEqual([SCORING_VERSION])
    })
  })

  test('reference-source.json fails clearly on a sha256 mismatch or an absolute path', async () => {
    await withTempDir('stt-neutral-reference-mismatch-', async root => {
      const runDir = join(root, 'run')
      await mkdir(runDir, { recursive: true })
      await writeSttRun(runDir)
      const referencePath = join(root, 'consensus-transcription.txt')
      await writeFile(referencePath, REFERENCE_TEXT)
      const path = relative(REPOSITORY_ROOT, referencePath)
      await writeFile(join(runDir, 'reference-source.json'), JSON.stringify({ schemaVersion: 1, path, sha256: '0'.repeat(64) }))
      expect(() => resolveReferenceTranscript(runDir, null)).toThrow(/sha256 mismatch/)
      const result = await runBuildReport(runDir)
      expect(result.exitCode).not.toBe(0)
      expect(result.stderr).toContain('sha256 mismatch')
      expect(await Bun.file(join(runDir, 'reference-comparison-report.json')).exists()).toBe(false)

      const sha256 = new Bun.CryptoHasher('sha256').update(REFERENCE_TEXT).digest('hex')
      await writeFile(join(runDir, 'reference-source.json'), JSON.stringify({ schemaVersion: 1, path: referencePath, sha256 }))
      expect(() => resolveReferenceTranscript(runDir, null)).toThrow(/repository-relative/)
      // An explicit reference or a local consensus file takes precedence over the pointer.
      expect(resolveReferenceTranscript(runDir, referencePath)).toEqual({ referencePath, referenceSource: null })
    })
  })

  test('default provider runs keep their existing keys', async () => {
    await withTempDir('stt-neutral-default-key-', async runDir => {
      await writeSttRun(runDir, { request: { model: 'universal-3-5-pro', diarization: { enabled: true } }, local: { local: false, audioProfile: 'default' } })
      const { providers } = loadProviderRuns(runDir)
      expect(providers.map(provider => [provider.providerKey, provider.settingsLabel, provider.displayName])).toEqual([
        ['assemblyai/universal-3-5-pro', null, 'assemblyai-universal-3-5-pro'],
      ])
    })
  })
})
