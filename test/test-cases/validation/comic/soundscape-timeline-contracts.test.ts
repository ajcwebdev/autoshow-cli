import { describe, expect, test } from 'bun:test'
import type { ComicDialoguePlan, FinalTimeline, SoundEffectRenderResult, SoundscapePlan } from '~/types'
import { hashCanonicalTtsValue } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import { resolveSoundscapeTimeline } from '~/cli/commands/process-steps/step-4-tts/soundscape/soundscape-timeline'
import { DEFAULT_COMIC_SOUNDSCAPE_MIX_PROFILE } from '~/cli/commands/process-steps/step-4-tts/soundscape/soundscape-planner'

const hash = (value: unknown) => hashCanonicalTtsValue(value)
const span = { kind: 'sound-effect' as const, start: 1, end: 2, indexUnit: 'unicode-scalar-value' as const, text: 'x' }
const dialoguePlan = {
  schemaVersion: 2, dialoguePlanId: 'd'.repeat(64), sceneRunIdentity: 's'.repeat(64), sourceIdentity: { schemaVersion: 1, canonicalPath: 'input/x.md', scriptSlug: 'x', contentSha256: 'a'.repeat(64), identityHash: 'b'.repeat(64) }, structuredScript: { path: 'metadata/structured-script.json', artifactSchemaVersion: 5, sha256: 'c'.repeat(64) }, createdAt: '2026-08-13T00:00:00.000Z', pacing: { profile: 'none', interTurnMs: 0 },
  nodes: [{ kind: 'turn', turn: { turnId: 'turn-1', sourceSegmentId: 'beat-0001', subjectKey: 'pilot', originalSpeakerLabel: 'PILOT', canonicalText: 'Hello world', sourceSpans: [{ kind: 'spoken-text', start: 0, end: 11, indexUnit: 'unicode-scalar-value', text: 'Hello world' }] } }],
} as ComicDialoguePlan
const timeline = {
  schemaVersion: 1, timelineId: hash('timeline'), renderIdentity: hash('render'),
  timing: { availability: 'timed', clock: 'final-audio-ms', provenance: 'provider-alignment', turns: [{ turnId: 'turn-1', subjectKey: 'pilot', startMs: 100, endMs: 1100 }], words: [{ turnId: 'turn-1', subjectKey: 'pilot', text: 'Hello', startMs: 100, endMs: 500, canonicalStart: 0, canonicalEnd: 5 }, { turnId: 'turn-1', subjectKey: 'pilot', text: 'world', startMs: 600, endMs: 1100, canonicalStart: 6, canonicalEnd: 11 }] },
  speechSources: [], transformLedgerRef: { path: 'ledger.json', sha256: hash('ledger') },
} as FinalTimeline
const plan = {
  schemaVersion: 1, soundscapePlanId: hash('plan'), sceneRunIdentity: dialoguePlan.sceneRunIdentity, sourceIdentity: dialoguePlan.sourceIdentity, structuredScript: dialoguePlan.structuredScript, structuredScriptHash: dialoguePlan.structuredScript.sha256, dialoguePlanId: dialoguePlan.dialoguePlanId,
  timingPolicy: 'strict', cues: [
    { cueId: 'pre', kind: 'action-sfx', prompt: 'pre', required: true, anchor: { kind: 'source-segment-edge', sourceSegmentId: 'beat-0001', edge: 'start', offsetMs: -250 }, sourceSpan: span },
    { cueId: 'middle', kind: 'vocal-reaction', prompt: 'middle', required: true, anchor: { kind: 'source-text-offset', sourceSegmentId: 'beat-0001', textOffset: 5, indexUnit: 'unicode-scalar-value', offsetMs: 0 }, sourceSpan: span },
  ], ambientBeds: [{ cueId: 'bed', kind: 'ambience', prompt: 'bed', required: true, range: { kind: 'full-scene' }, sourceSpan: span }], synthesisTasks: [], mixProfile: DEFAULT_COMIC_SOUNDSCAPE_MIX_PROFILE, mixProfileHash: hash(DEFAULT_COMIC_SOUNDSCAPE_MIX_PROFILE), mixIdentity: hash('mix'), createdAt: '2026-08-13T00:00:00.000Z',
} as SoundscapePlan
const result = {
  schemaVersion: 1, resultId: hash('result'), renderPlanId: hash('render-plan'), soundscapePlanId: plan.soundscapePlanId, targetKey: 'sfx', status: 'succeeded', createdAt: '2026-08-13T00:00:00.000Z', entries: [
    { cueId: 'pre', taskId: '1', generationIdentity: hash('1'), requestIdentity: hash('r1'), status: 'succeeded', source: 'provider-dispatch', audio: { path: 'pre.wav', sha256: hash('pre'), format: { codec: 'pcm_s16le', container: 'wav', sampleRate: 48000, channels: 1 }, durationMs: 300 } },
    { cueId: 'middle', taskId: '2', generationIdentity: hash('2'), requestIdentity: hash('r2'), status: 'succeeded', source: 'provider-dispatch', audio: { path: 'middle.wav', sha256: hash('middle'), format: { codec: 'pcm_s16le', container: 'wav', sampleRate: 48000, channels: 1 }, durationMs: 200 } },
    { cueId: 'bed', taskId: '3', generationIdentity: hash('3'), requestIdentity: hash('r3'), status: 'succeeded', source: 'provider-dispatch', audio: { path: 'bed.wav', sha256: hash('bed'), format: { codec: 'pcm_s16le', container: 'wav', sampleRate: 48000, channels: 1 }, durationMs: 400 } },
  ],
} as SoundEffectRenderResult

describe('ADR-018 strict soundscape timeline resolution', () => {
  test('resolves exact source edges and text offsets while shifting every bus for negative pre-roll', () => {
    const resolved = resolveSoundscapeTimeline({ plan, dialoguePlan, dialogueTimeline: timeline, dialogueAudioRunId: hash('audio-run'), renderResult: result })
    expect(resolved.preRollMs).toBe(150)
    expect(resolved.entries.find(entry => entry.cueId === 'pre')?.finalRangeMs).toEqual({ start: 0, end: 300 })
    expect(resolved.entries.find(entry => entry.cueId === 'middle')?.finalRangeMs).toEqual({ start: 650, end: 850 })
    expect(resolved.entries.find(entry => entry.cueId === 'bed')?.finalRangeMs).toEqual({ start: 0, end: 1250 })
  })

  test('fails unresolved mid-token anchors instead of clamping or guessing', () => {
    const unresolved = { ...plan, cues: [{ ...plan.cues[1]!, anchor: { kind: 'source-text-offset' as const, sourceSegmentId: 'beat-0001', textOffset: 3, indexUnit: 'unicode-scalar-value' as const, offsetMs: 0 } }] }
    expect(() => resolveSoundscapeTimeline({ plan: unresolved, dialoguePlan, dialogueTimeline: timeline, dialogueAudioRunId: hash('audio-run'), renderResult: { ...result, entries: [result.entries[1]!] } })).toThrow(/no exact .*timing evidence/iu)
  })

  test('records an explicit proportional estimate and worst-case error bound', () => {
    const proportional = { ...plan, timingPolicy: 'proportional' as const, cues: [{ ...plan.cues[1]!, anchor: { kind: 'source-text-offset' as const, sourceSegmentId: 'beat-0001', textOffset: 3, indexUnit: 'unicode-scalar-value' as const, offsetMs: 0 } }] }
    const resolved = resolveSoundscapeTimeline({ plan: proportional, dialoguePlan, dialogueTimeline: timeline, dialogueAudioRunId: hash('audio-run'), renderResult: { ...result, entries: [result.entries[1]!, result.entries[2]!] } })
    const entry = resolved.entries[0]
    expect(entry?.finalRangeMs).toEqual({ start: 373, end: 573 })
    expect(entry?.anchorResolutions).toEqual([expect.objectContaining({ policy: 'proportional', algorithm: 'canonical-offset-linear-v1', positionMs: 373, errorBoundMs: 727 })])
  })

  test('resolves explicit ambient ranges from computed scene edges and source-segment bounds', () => {
    const ranged = {
      ...plan,
      ambientBeds: [{
        cueId: 'bed',
        kind: 'ambience' as const,
        prompt: 'bed',
        required: true,
        range: {
          kind: 'anchors' as const,
          start: { kind: 'resolved-scene-edge' as const, edge: 'start' as const },
          end: { kind: 'source-segment-edge' as const, sourceSegmentId: 'beat-0001', edge: 'start' as const, offsetMs: 0 },
        },
        sourceSpan: span,
      }],
    }
    const resolved = resolveSoundscapeTimeline({ plan: ranged, dialoguePlan, dialogueTimeline: timeline, dialogueAudioRunId: hash('audio-run'), renderResult: result })
    expect(resolved.entries.find(entry => entry.cueId === 'bed')?.finalRangeMs).toEqual({ start: 0, end: 250 })
    expect(resolved.entries.find(entry => entry.cueId === 'bed')?.anchorResolutions).toEqual([
      expect.objectContaining({ algorithm: 'resolved-scene-edge-v1', positionMs: -150 }),
      expect.objectContaining({ algorithm: 'source-segment-edge-v1', positionMs: 100 }),
    ])
  })
})
