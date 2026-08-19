import { describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ResolvedSoundscapeTimeline, SoundEffectRenderPlan, SoundEffectRenderResult, SoundscapePlan } from '~/types'
import { hashCanonicalTtsValue, sha256Bytes } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import { mixSoundscape } from '~/cli/commands/process-steps/step-4-tts/soundscape/soundscape-mixer'
import { DEFAULT_COMIC_SOUNDSCAPE_MIX_PROFILE } from '~/cli/commands/process-steps/step-4-tts/soundscape/soundscape-planner'
import { inspectSoundscapeAudio } from '~/cli/commands/process-steps/step-4-tts/soundscape/soundscape-audio'
import { createSyntheticWavBytes } from '../../../test-utils/media-fixtures'

const h = (value: unknown) => hashCanonicalTtsValue(value)

const pcm24Metrics = async (path: string, rangeMs?: { start: number, end: number }): Promise<{ peak: number, rms: number }> => {
  const bytes = await readFile(path)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let cursor = 12
  let channels = 0
  let sampleRate = 0
  let bits = 0
  let dataOffset = 0
  let dataSize = 0
  while (cursor + 8 <= bytes.byteLength) {
    const name = bytes.subarray(cursor, cursor + 4).toString('ascii')
    const size = view.getUint32(cursor + 4, true)
    if (name === 'fmt ') {
      channels = view.getUint16(cursor + 10, true)
      sampleRate = view.getUint32(cursor + 12, true)
      bits = view.getUint16(cursor + 22, true)
    }
    if (name === 'data') { dataOffset = cursor + 8; dataSize = size; break }
    cursor += 8 + size + (size % 2)
  }
  if (bits !== 24 || channels < 1 || sampleRate < 1 || dataSize < 3) throw new Error('Expected PCM 24-bit WAV fixture output.')
  const startFrame = Math.max(0, Math.floor((rangeMs?.start ?? 0) * sampleRate / 1000))
  const endFrame = Math.min(Math.floor(dataSize / (channels * 3)), Math.ceil((rangeMs?.end ?? Number.POSITIVE_INFINITY) * sampleRate / 1000))
  let peak = 0
  let squareSum = 0
  let count = 0
  for (let frame = startFrame; frame < endFrame; frame++) for (let channel = 0; channel < channels; channel++) {
    const offset = dataOffset + (frame * channels + channel) * 3
    let sample = bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16)
    if (sample & 0x800000) sample |= ~0xffffff
    const normalized = sample / 0x800000
    peak = Math.max(peak, Math.abs(normalized))
    squareSum += normalized * normalized
    count++
  }
  return { peak, rms: count === 0 ? 0 : Math.sqrt(squareSum / count) }
}

describe('ADR-017 deterministic four-bus mixer', () => {
  test('writes semantic stems, loops and ducks ambience, limits the master, and remains checksum deterministic', async () => {
    const root = await mkdtemp(join(tmpdir(), 'autoshow-soundscape-mixer-'))
    try {
      const writeSource = async (name: string, durationSeconds: number, amplitude: number, frequencyHz: number) => {
        const path = `sources/${name}.wav`
        const bytes = createSyntheticWavBytes({ durationSeconds, amplitude, frequencyHz, sampleRate: 48000 })
        await Bun.write(join(root, path), bytes)
        return { path, sha256: sha256Bytes(bytes), durationMs: Math.round(durationSeconds * 1000), format: { codec: 'pcm_s16le', container: 'wav', sampleRate: 48000, channels: 1 } as const }
      }
      const dialogue = await writeSource('dialogue', 1, 0.45, 220)
      const vocal = await writeSource('vocal', 0.25, 0.4, 330)
      const impact = await writeSource('impact', 0.35, 0.9, 110)
      const bed = await writeSource('bed', 0.4, 0.3, 55)
      const span = { kind: 'sound-effect' as const, start: 1, end: 2, indexUnit: 'unicode-scalar-value' as const, text: 'x' }
      const plan = {
        schemaVersion: 1, soundscapePlanId: h('plan'), sceneRunIdentity: h('scene'), sourceIdentity: { schemaVersion: 1, canonicalPath: 'input/x.md', scriptSlug: 'x', contentSha256: h('source'), identityHash: h('source-id') }, structuredScript: { path: 'metadata/structured-script.json', artifactSchemaVersion: 5, sha256: h('structured') }, structuredScriptHash: h('structured'), dialoguePlanId: h('dialogue-plan'),
        timingPolicy: 'strict', cues: [
          { cueId: 'vocal', kind: 'vocal-reaction', prompt: 'gasp', required: true, anchor: { kind: 'scene-clock', positionMs: 100 }, sourceSpan: span, pan: -0.4 },
          { cueId: 'impact', kind: 'action-sfx', prompt: 'impact', required: true, anchor: { kind: 'scene-clock', positionMs: 700 }, sourceSpan: span, gainDb: 3, pan: 0.6 },
        ], ambientBeds: [{ cueId: 'bed', kind: 'ambience', prompt: 'hum', required: true, range: { kind: 'full-scene' }, sourceSpan: span }], synthesisTasks: [], mixProfile: DEFAULT_COMIC_SOUNDSCAPE_MIX_PROFILE, mixProfileHash: h(DEFAULT_COMIC_SOUNDSCAPE_MIX_PROFILE), mixIdentity: h('mix'), createdAt: '2026-08-13T00:00:00.000Z',
      } as SoundscapePlan
      const renderResult = {
        schemaVersion: 1, resultId: h('result'), renderPlanId: h('render-plan'), soundscapePlanId: plan.soundscapePlanId, targetKey: 'sfx', status: 'succeeded', createdAt: plan.createdAt,
        entries: [
          { cueId: 'vocal', taskId: 'v', generationIdentity: h('v'), requestIdentity: h('rv'), status: 'succeeded', source: 'provider-dispatch', audio: vocal },
          { cueId: 'impact', taskId: 'i', generationIdentity: h('i'), requestIdentity: h('ri'), status: 'succeeded', source: 'provider-dispatch', audio: impact },
          { cueId: 'bed', taskId: 'b', generationIdentity: h('b'), requestIdentity: h('rb'), status: 'succeeded', source: 'provider-dispatch', audio: bed },
        ],
      } as SoundEffectRenderResult
      const timeline = {
        schemaVersion: 1, timelineId: h('timeline'), soundscapePlanId: plan.soundscapePlanId, dialogueAudioRunId: h('dialogue-run'),
        dialogueTiming: { availability: 'timed', clock: 'final-audio-ms', provenance: 'assembled-segments', turns: [{ turnId: 'turn', subjectKey: 'pilot', startMs: 200, endMs: 1200 }] },
        preRollMs: 200, durationMs: 1400,
        entries: [
          { cueId: 'vocal', bus: 'vocal-reaction', required: true, status: 'placed', sourceRangeMs: { start: 0, end: 250 }, finalRangeMs: { start: 300, end: 550 }, sourceAudioSha256: vocal.sha256 },
          { cueId: 'impact', bus: 'action-sfx', required: true, status: 'placed', sourceRangeMs: { start: 0, end: 350 }, finalRangeMs: { start: 900, end: 1250 }, sourceAudioSha256: impact.sha256 },
          { cueId: 'bed', bus: 'ambience', required: true, status: 'placed', sourceRangeMs: { start: 0, end: 400 }, finalRangeMs: { start: 0, end: 1400 }, sourceAudioSha256: bed.sha256, loopIterations: 5 },
        ],
      } as ResolvedSoundscapeTimeline
      const renderPlan = { renderPlanId: renderResult.renderPlanId } as SoundEffectRenderPlan
      const run = async () => await mixSoundscape({
        rootDir: root, plan, planRef: { path: 'metadata/soundscape-plan.json', sha256: h('plan-ref') }, timeline,
        dialogueAudioRun: { audioRunId: timeline.dialogueAudioRunId, path: 'dialogue-audio-run.json', sha256: h('dialogue-run-ref'), finalAudio: { path: dialogue.path, sha256: dialogue.sha256 } },
        renderPlan: { value: renderPlan, ref: { path: 'render-plan.json', sha256: h('render-plan-ref') } }, renderResult: { value: renderResult, ref: { path: 'render-result.json', sha256: h('render-result-ref') } },
      })
      const first = await run()
      expect(first.mix.stems.map(stem => stem.bus)).toEqual(['dialogue', 'vocal-reaction', 'action-sfx', 'ambience'])
      expect(first.mix.transforms.some(transform => transform.kind === 'duck')).toBe(true)
      expect(first.mix.transforms.some(transform => transform.kind === 'loop')).toBe(true)
      expect((await inspectSoundscapeAudio(join(root, first.mix.master.path))).durationMs).toBeGreaterThanOrEqual(1390)
      expect(first.mix.master.format).toMatchObject({ codec: 'pcm_s24le', container: 'wav', sampleRate: 48000, channels: 2 })
      const ambienceStem = first.mix.stems.find(stem => stem.bus === 'ambience')!
      const ambienceBeforeSpeech = await pcm24Metrics(join(root, ambienceStem.path), { start: 40, end: 160 })
      const ambienceDuringSpeech = await pcm24Metrics(join(root, ambienceStem.path), { start: 500, end: 650 })
      expect(ambienceDuringSpeech.rms).toBeLessThan(ambienceBeforeSpeech.rms * 0.8)
      expect((await pcm24Metrics(join(root, first.mix.master.path))).peak).toBeLessThanOrEqual(0.96)
      const second = await run()
      expect(second.mix.mixId).toBe(first.mix.mixId)
      expect(second.mix.master.sha256).toBe(first.mix.master.sha256)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
