import { describe, expect, test } from 'bun:test'
import { serializesComicDelivery } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/comic-segmented-audio'
import { buildFinalTimelineLayout } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/attempt-success-builders'

describe('comic authored-delivery capability accounting', () => {
  test('recognizes only provider/model paths that actually serialize the direction', () => {
    expect(serializesComicDelivery({ service: 'hume', model: 'octave-1' }, 'flat, professional')).toBe(true)
    expect(serializesComicDelivery({ service: 'elevenlabs', model: 'eleven_v3' }, 'deadpan')).toBe(true)
    expect(serializesComicDelivery({ service: 'elevenlabs', model: 'eleven_v3' }, 'flat, professional')).toBe(false)
    expect(serializesComicDelivery({ service: 'fish', model: 's2.1-pro' }, 'deadpan')).toBe(true)
    expect(serializesComicDelivery({ service: 'fish', model: 's2.1-pro' }, 'flat, professional')).toBe(false)
    expect(serializesComicDelivery({ service: 'minimax', model: 'speech-2.8-hd' }, 'rushing')).toBe(false)
    expect(serializesComicDelivery({ service: 'inworld', model: 'realtime-tts-2' }, 'rushing')).toBe(false)
    expect(serializesComicDelivery({ service: 'deepinfra', model: 'Qwen/Qwen3-TTS' }, 'rushing')).toBe(false)
  })

  test('uses mastered segment durations instead of provider-container duration estimates', () => {
    const layout = buildFinalTimelineLayout({
      turns: [],
      slots: [],
      batchResultFiles: [],
      comicDialoguePlan: {
        nodes: [
          { kind: 'turn', turn: { turnId: 'turn-1', subjectKey: 'chat' } },
          { kind: 'turn', turn: { turnId: 'turn-2', subjectKey: 'bishop' } },
        ],
        pacing: { profile: 'loose-comedy', interTurnMs: 350 },
      } as never,
      masteredTurnDurationMs: new Map([['turn-1', 1000], ['turn-2', 2000]]),
      masteredTimingSegmentDurationMs: new Map([['turn-1:0', 1000], ['turn-2:0', 2000]]),
    })
    expect(layout.turns).toEqual([
      { turnId: 'turn-1', subjectKey: 'chat', startMs: 0, endMs: 1000 },
      { turnId: 'turn-2', subjectKey: 'bishop', startMs: 1350, endMs: 3350 },
    ])
  })
})
