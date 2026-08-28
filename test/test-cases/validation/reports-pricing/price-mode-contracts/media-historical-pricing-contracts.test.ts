import { describe,expect,test } from 'bun:test'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import type { Step5Metadata,Step7MusicMetadata } from '~/types'

describe('price mode contracts', () => {

  test('retired MiniMax music-2.6 still reprices from historical rates', () => {
      const archived: Step7MusicMetadata = {
        musicService: 'minimax',
        musicModel: 'music-2.6',
        processingTime: 240_000,
        musicFileName: 'music.mp3',
        musicFileSize: 1234,
        musicDurationMs: 176_875,
        lyricsSource: 'generated'
      }

      expect(computeActualCosts({ step7: archived }).steps[0]).toMatchObject({
        step: 'music',
        provider: 'minimax',
        model: 'music-2.6',
        cost: 16,
        costSource: 'registry_fallback'
      })

      expect(computeActualCosts({
        step7: { ...archived, lyricsSource: 'provided' }
      }).steps[0]).toMatchObject({ cost: 15 })

      expect(computeActualCosts({
        step7: { ...archived, providerCostCents: 21 }
      }).steps[0]).toMatchObject({ cost: 21 })
    })

  test('retired Gemini image benchmark results retain historical output pricing', () => {
      expect(computeActualCosts({
        step5: {
          imageService: 'gemini',
          imageModel: 'gemini-3.1-flash-image-preview',
          processingTime: 16_107,
          imageFileNames: ['generated-image.png'],
          imageCount: 1,
          imageFileSize: 1234
        } as unknown as Step5Metadata
      }).steps[0]).toMatchObject({
        step: 'image',
        provider: 'gemini',
        model: 'gemini-3.1-flash-image-preview',
        cost: 6.7,
        costSource: 'registry_fallback'
      })
    })
})
