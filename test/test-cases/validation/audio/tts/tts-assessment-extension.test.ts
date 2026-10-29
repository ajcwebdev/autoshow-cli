import { expect, test } from 'bun:test'
import { renderHistoricalTtsPlaybackLinks, renderPermanentTtsAssessmentNoteLinks, verifyTtsAssessmentManifestExtension } from '~/tools/extend-tts-assessment'

const directory = 'reruns/eleven-v4-2026-10-29'
const original = {
  command: 'tts', scope: 'single', updatedAt: '2026-09-25T00:00:00Z',
  items: [{ input: 'test/fixtures/tts.txt', metadata: { characterCount: 87, benchmarkReruns: [{ directory: 'reruns/original', providerKeys: ['elevenlabs/eleven_v3'] }] },
    providers: [{ service: 'elevenlabs', model: 'eleven_v3', status: 'succeeded', metadata: { audioSha256: 'original-hash', voice: 'original-voice' } }] }]
}
const extended = () => {
  const current = structuredClone(original)
  current.updatedAt = '2026-10-29T00:00:00Z'
  current.items[0]!.metadata.benchmarkReruns.push({ directory, providerKeys: ['elevenlabs/eleven_v4'] })
  return current
}

test('approved MP3 playback links retain the measured WAV hash and do not relabel its assessment', () => {
  const markdown = '[Selected audio](run/speech.wav); Audio SHA-256: `original-wav-hash`. WER 1.00%.\n[Selected audio](new/recording.wav)'
  const rendered = renderHistoricalTtsPlaybackLinks(markdown, [{ sourcePath: 'run/speech.wav', path: 'run/speech.mp3' }])
  expect(rendered).toContain('[Approved MP3 playback](run/speech.mp3); Measured WAV SHA-256: `original-wav-hash`. WER 1.00%.')
  expect(rendered).toContain('[Selected audio](new/recording.wav)')
})

test('assessment notes point to the permanent report/archive and preserve their case anchor on repeated repair', () => {
  const note = 'Offline ASR assessment: See runtime/tts-benchmark-assessment/extensions/stage/new/assessment.md#case-id and assessment.evidence.zip.\nStrict WER stays unchanged.\n'
  const expected = 'Offline ASR assessment: See docs/benchmarks/tts/assessment.md#case-id and docs/benchmarks/tts/assessment.evidence.zip.\nStrict WER stays unchanged.\n'
  expect(renderPermanentTtsAssessmentNoteLinks(note, 'docs/benchmarks/tts')).toBe(expected)
  expect(renderPermanentTtsAssessmentNoteLinks(expected, 'docs/benchmarks/tts')).toBe(expected)
})

test('assessment extension admits only a new model selection and preserves the original provider evidence', () => {
  const current = extended(), beforeBytes = JSON.stringify(original), afterBytes = JSON.stringify(current)
  expect(() => verifyTtsAssessmentManifestExtension(original, current, directory)).not.toThrow()
  expect(JSON.stringify(original)).toBe(beforeBytes)
  expect(JSON.stringify(current)).toBe(afterBytes)
})

for (const field of ['input', 'characterCount', 'model', 'voice', 'audioSha256'] as const) {
  test(`assessment extension rejects altered historical ${field}`, () => {
    const current = extended(), item = current.items[0]!, provider = item.providers[0]!
    if (field === 'input') item.input = 'different-source.txt'
    else if (field === 'characterCount') item.metadata.characterCount++
    else if (field === 'model') provider.model = 'eleven_v4'
    else provider.metadata[field] = 'changed'
    expect(() => verifyTtsAssessmentManifestExtension(original, current, directory)).toThrow('changed original input, provider result or unrelated metadata')
  })
}

test('assessment extension rejects missing, duplicate and unrelated rerun changes', () => {
  expect(() => verifyTtsAssessmentManifestExtension(original, original, directory)).toThrow('exact v4 rerun selection')
  const duplicate = extended()
  duplicate.items[0]!.metadata.benchmarkReruns.push({ directory, providerKeys: ['elevenlabs/eleven_v4'] })
  expect(() => verifyTtsAssessmentManifestExtension(original, duplicate, directory)).toThrow('exact v4 rerun selection')
  const changedEarlierSelection = extended()
  changedEarlierSelection.items[0]!.metadata.benchmarkReruns[0]!.directory = 'different-earlier-rerun'
  expect(() => verifyTtsAssessmentManifestExtension(original, changedEarlierSelection, directory)).toThrow('exact v4 rerun selection')
})
