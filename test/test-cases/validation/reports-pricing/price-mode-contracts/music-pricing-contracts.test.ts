import { describe,expect,test } from 'bun:test'
import { estimateMusicCosts } from '~/cli/commands/process-steps/step-7-music/music-utils/music-pricing'

describe('price mode contracts', () => {

  test('Gemini music estimates use per-song Lyria 3 pricing', () => {
      const estimates = estimateMusicCosts({
        geminiMusicModels: ['lyria-3-pro-preview'],
        musicDuration: 90
      })

      expect(estimates.map((estimate) => ({
        provider: estimate.provider,
        model: estimate.model,
        totalCost: estimate.totalCost
      }))).toEqual([
        { provider: 'gemini', model: 'lyria-3-pro-preview', totalCost: 8 }
      ])
    })
})
