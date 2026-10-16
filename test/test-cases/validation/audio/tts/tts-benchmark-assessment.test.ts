import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { characterErrorRate, compareCountingWords, compareWords, normalizeAssessmentText, parseSilences, publishAssessment, turnSilenceMetrics, verifyAssessmentAudio } from '~/tools/assess-tts-benchmarks'
import type { AssessmentSource } from '~/tools/assess-tts-benchmarks'
import { withTempDir } from '../../../../test-utils/temp-dirs'
import { createSyntheticWavBytes } from '../../../../test-utils/media-fixtures'
import { childEnv } from '~/utils/child-env'

test('assessment help remains plain stdout and invalid options fail before loading any local model', () => {
  const help = Bun.spawnSync([process.execPath, '--no-env-file', 'src/tools/assess-tts-benchmarks.ts', '--help'], { env: childEnv() })
  expect(help.exitCode).toBe(0)
  expect(help.stderr.toString()).toBe('')
  expect(help.stdout.toString()).toBe('Usage: bun src/tools/assess-tts-benchmarks.ts [--run | --transcribe-only] [--concurrency 2] [--limit N]\nDefault: inspect selected recordings without writes. --run uses installed small.en/ffmpeg offline and updates fixed assessment.md/evidence.zip. Reuses hash-bound caches; never downloads models or calls providers.\n')
  const invalid = Bun.spawnSync([process.execPath, '--no-env-file', 'src/tools/assess-tts-benchmarks.ts', '--unsupported'], { env: childEnv() })
  expect(invalid.exitCode).not.toBe(0)
  expect(invalid.stdout.toString()).toBe('')
  expect(invalid.stderr.toString()).toContain('Unknown assessment option')
})

test('two hash-bound cached transcripts emit separate undecorated JSON progress rows without ASR execution', async () => {
  await withTempDir('tts-assessment-progress-', async cacheRoot => {
    const engineSha256 = 'test-only-engine-hash', sources = []
    for (const [index, seconds] of [2, 1].entries()) {
      const cacheKey = `cache-${index}`, cache = join(cacheRoot, cacheKey), transcript = `Retained transcript ${index}.\n`
      mkdirSync(cache)
      writeFileSync(join(cache, 'transcript.txt'), transcript)
      writeFileSync(join(cache, 'binding.json'), JSON.stringify({ schemaVersion: 1, cacheKey, engineSha256, elapsedMs: 1, transcriptSha256: createHash('sha256').update(transcript).digest('hex') }))
      // Cache hits require only the bound transcript; there is deliberately no engine or audio to synthesize/transcribe.
      sources.push({ id: `case-${index}`, cacheKey, durationSeconds: seconds })
    }
    const child = Bun.spawn([process.execPath, '--no-env-file', '--eval', `
      import { runAssessmentQueue } from '~/tools/assess-tts-benchmarks'
      await runAssessmentQueue(JSON.parse(process.argv[1]), process.argv[2], process.argv[3], 1)
    `, JSON.stringify(sources), cacheRoot, engineSha256], { env: childEnv(), stdin: 'ignore', stdout: 'pipe', stderr: 'pipe' })
    const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(exitCode).toBe(0)
    expect(stderr).toBe('')
    expect(stdout).toBe('{"case":"case-0","status":"reused","seconds":2}\n{"case":"case-1","status":"reused","seconds":1}\n')
  })
})

test('ASR screening identifies explicit omissions, additions and substitutions without a perceptual score', () => {
  const comparison = compareWords('The red fox jumps over the gate.', 'The blue fox jumps the gate today.')
  expect(comparison).toMatchObject({ referenceWords: 7, hypothesisWords: 7, substitutions: 1, deletions: 1, insertions: 1, wer: 3 / 7 })
  expect(comparison.differences).toEqual([
    { kind: 'substitution', reference: 'red', hypothesis: 'blue' },
    { kind: 'deletion', reference: 'over', hypothesis: '' },
    { kind: 'insertion', reference: '', hypothesis: 'today' }
  ])
  expect(compareWords('Three repeated words words words.', 'Three repeated words words.').deletions).toBe(1)
  expect(compareWords('Preserve these words.', '').wer).toBe(1)
  expect(() => compareWords('', 'hallucination')).toThrow('Empty assessment reference')
})

test('normalization preserves number and pronunciation uncertainty across Unicode and punctuation', () => {
  expect(normalizeAssessmentText('CAFÉ’s co-op, ２９ naïve!')).toBe('café s co op 29 naïve')
  expect(compareWords('One, two, three.', 'one two three').wer).toBe(0)
  expect(compareWords('One two three four five. Then I speak.', '1 2 3 4 5.').wer).toBe(1)
  expect(compareCountingWords('One two three four five. Then I speak.', '1 2 3 4 5.')).toMatchObject({ substitutions: 0, deletions: 3, wer: 3 / 8 })
  expect(compareCountingWords('29', 'twenty nine').wer).toBe(2)
  expect(compareWords('February 29', 'February twenty nine').wer).toBe(1)
  expect(compareWords('résumé', 'resume').wer).toBe(1)
  expect(characterErrorRate('abc def', 'abc deX')).toBe(1 / 7)
  expect(characterErrorRate('你好', '您好')).toBe(1 / 2)
  expect(characterErrorRate('a'.repeat(1200) + 'X' + 'b'.repeat(1200), 'a'.repeat(1200) + 'b'.repeat(1200))).toBe(1 / 2401)
  expect(characterErrorRate('a'.repeat(100), 'b'.repeat(100))).toBe(1)
})

test('signal measurements trim turn edges and keep qualitative gaps distinct from exact pause requests', () => {
  const silences = parseSilences('silence_start: 0\nsilence_end: 0.1\nsilence_start: 1\nsilence_end: 1.5\nsilence_start: 2.8', 3)
  expect(silences).toEqual([{ start: 0, end: 0.1 }, { start: 1, end: 1.5 }, { start: 2.8, end: 3 }])
  const measured = turnSilenceMetrics({ turnId: 'four', startMs: 0, endMs: 3000 }, silences, 'I pause here. Then I speak.')
  expect(measured.trimmedWindowSeconds).toBeCloseTo(2.7)
  expect(measured.longestInternalSilenceSeconds).toBe(0.5)
  expect(measured.referenceWordsPerMinute).toBeCloseTo(6 * 60 / 2.7)
  expect(parseSilences('no silence', 3)).toEqual([])
  expect(() => parseSilences('silence_start: 2\nsilence_end: 1', 3)).toThrow('Invalid detected silence')
  const silent = turnSilenceMetrics({ turnId: 'silent', startMs: 1000, endMs: 4000 }, [{ start: 0, end: 6 }], 'Unheard words stay in the reference.')
  expect(silent).toMatchObject({ entireTurnBelowThreshold: true, trimmedWindowSeconds: 0, referenceWordsPerMinute: null, leadingSeconds: 3, trailingSeconds: 0 })
  expect(() => turnSilenceMetrics({ turnId: 'invalid', startMs: 4000, endMs: 1000 }, [], 'reference')).toThrow('Invalid assessment turn interval')
})

test('full waveform decoding accepts real PCM and rejects malformed audio without provider calls', async () => {
  await withTempDir('tts-assessment-audio-', async dir => {
    const valid = join(dir, 'valid.wav'), invalid = join(dir, 'invalid.wav')
    writeFileSync(valid, createSyntheticWavBytes({ durationSeconds: 0.3, sampleRate: 16000, amplitude: 0.1, frequencyHz: 440 }))
    writeFileSync(invalid, 'RIFF malformed bytes are not audio')
    await verifyAssessmentAudio(valid)
    await expect(verifyAssessmentAudio(invalid)).rejects.toThrow('ffmpeg failed')
  })
})

test('a diagnostic limit cannot publish a partial assessment or replace full evidence', () => {
  const child = Bun.spawnSync(['bun', 'src/tools/assess-tts-benchmarks.ts', '--run', '--limit', '1'])
  expect(child.exitCode).not.toBe(0)
  expect(child.stderr.toString()).toContain('Partial queues cannot publish')
})

test('published evidence reserves pause conditions for speed-pauses while retaining emotion silence measurements', async () => {
  await withTempDir('tts-assessment-suites-', async dir => {
    const root = join(dir, 'tts'), cacheRoot = join(dir, 'cache', 'v1')
    mkdirSync(root, { recursive: true })
    const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex')
    const audio = join(root, 'source.wav'), engineSha256 = hash('local-fixture-engine')
    writeFileSync(audio, createSyntheticWavBytes({ durationSeconds: 5, sampleRate: 16000, amplitude: 0.1, frequencyHz: 440 }))
    const spokenLines = ['I speak normally.', 'I speak slowly.', 'I speak quickly.', 'I finish this line.', 'I finish the last line.']
    const reference = spokenLines.join('\n'), sources: AssessmentSource[] = []
    for (const suite of ['narration', 'emotion', 'speed-pauses']) {
      const run = join(root, suite), cacheKey = hash(suite), cache = join(cacheRoot, cacheKey)
      mkdirSync(run); mkdirSync(cache, { recursive: true })
      const input = join(run, 'input.txt'), manifest = join(run, 'manifest.json')
      writeFileSync(input, reference); writeFileSync(manifest, '{}')
      const transcript = reference + '\n'
      writeFileSync(join(cache, 'transcript.txt'), transcript)
      writeFileSync(join(cache, 'asr.json'), JSON.stringify({ text: reference }))
      writeFileSync(join(cache, 'transcription.json'), JSON.stringify({ text: reference }))
      writeFileSync(join(cache, 'binding.json'), JSON.stringify({ schemaVersion: 1, cacheKey, engineSha256, elapsedMs: 1, transcriptSha256: hash(transcript) }))
      sources.push({ id: suite, suite, run: suite, providerKey: 'fixture/tts', manifest, manifestSha256: hash(readFileSync(manifest)),
        audio, audioSha256: hash(readFileSync(audio)), input, inputSha256: hash(reference), reference,
        renderIdentity: hash('render'), resultIdentity: hash('result'), durationSeconds: 5, cacheKey,
        bindings: [{ path: input, sha256: hash(reference) }, { path: manifest, sha256: hash(readFileSync(manifest)) }],
        turns: spokenLines.map((_, index) => ({ turnId: `turn-${index + 1}`, startMs: index * 1000, endMs: (index + 1) * 1000 })),
        controls: suite === 'narration' ? null : { spokenLines, mechanism: 'fixture inline controls', lines: suite === 'emotion'
          ? spokenLines.map(line => `[calm] ${line}`)
          : [...spokenLines.slice(0, 3), '<break time="500ms"/> ' + spokenLines[3], '[pause] ' + spokenLines[4]] }
      })
    }
    await publishAssessment(root, sources, cacheRoot, engineSha256)
    const archive = join(root, 'assessment.evidence.zip')
    const extract = (entry: string) => {
      const result = Bun.spawnSync(['unzip', '-p', archive, entry])
      expect(result.exitCode).toBe(0)
      return result.stdout
    }
    const evidence = JSON.parse(extract('assessment.json').toString())
    const narration = evidence.rows.find((row: { suite: string }) => row.suite === 'narration')
    const emotion = evidence.rows.find((row: { suite: string }) => row.suite === 'emotion')
    const pauses = evidence.rows.find((row: { suite: string }) => row.suite === 'speed-pauses')
    expect(narration).toMatchObject({ perTurn: [], pauseMeasurement: [], exactPause: false, speedOrder: null })
    expect(emotion).toMatchObject({ pauseMeasurement: [], exactPause: false, speedOrder: null, humanSpeechScore: null })
    expect(emotion.perTurn).toHaveLength(5)
    expect(emotion.silences).toBeArray()
    expect(pauses.pauseMeasurement).toEqual([
      expect.objectContaining({ turnId: 'turn-4', mechanism: 'exact SSML request', requestedSeconds: 0.5 }),
      expect.objectContaining({ turnId: 'turn-5', mechanism: 'qualitative cue', requestedSeconds: null })
    ])
    expect(pauses.exactPause).toBe(true)
    const markdown = readFileSync(join(root, 'assessment.md'), 'utf8')
    const emotionSection = markdown.split('### emotion —')[1]!.split('### speed-pauses —')[0]!
    expect(emotionSection).toContain('Below-threshold intervals:')
    expect(emotionSection).not.toContain('Requested seconds')
    expect(markdown.split('### speed-pauses —')[1]).toContain('Requested seconds')
    const sums = extract('SHA256SUMS').toString().trim().split('\n')
    expect(sums).toHaveLength(10)
    for (const line of sums) {
      const [expected, entry] = line.split('  ')
      expect(hash(extract(entry!))).toBe(expected!)
    }
    writeFileSync(join(cacheRoot, sources[0]!.cacheKey, 'transcript.txt'), 'stale cache')
    const originalArchive = hash(readFileSync(archive))
    await expect(publishAssessment(root, sources, cacheRoot, engineSha256)).rejects.toThrow('Stale assessment transcript')
    expect(hash(readFileSync(archive))).toBe(originalArchive)
  })
})
