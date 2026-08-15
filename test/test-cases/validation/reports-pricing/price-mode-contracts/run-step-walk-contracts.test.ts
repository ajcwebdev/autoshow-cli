import { describe, expect, test } from 'bun:test'
import type { ComputeActualCostsInput, ComputeActualProcessingTimesInput } from '~/types'
import { computeActualCosts } from '~/cli/commands/pricing-orchestration/compute-actual-costs'
import { computeActualProcessingTimes } from '~/cli/commands/pricing-orchestration/compute-processing-time'

const fixture = {
  audioDurationSeconds: 12,
  ttsCharacterCount: 1000,
  step2: [{
    transcriptionService: 'whisper',
    transcriptionModel: '/models/ggml-large-v3.bin',
    processingTime: 1200,
    tokenCount: 120,
    billing: { totalCost: 1, source: 'provider_quote' }
  }, {
    transcriptionService: 'whisperfile',
    transcriptionModel: 'tiny',
    processingTime: 2400,
    tokenCount: 240,
    billing: { totalCost: 2, source: 'provider_quote' }
  }],
  partialStep2: {
    extractionMethod: 'pdf+openai-ocr',
    totalPages: 3,
    ocrPages: 2,
    textPages: 1,
    processingTime: 3000,
    dpi: 300,
    languages: 'eng',
    tokenEstimate: 300,
    ocrService: 'openai',
    ocrModel: 'gpt-5.4-nano',
    promptTokens: 30,
    completionTokens: 15,
    providerCostCents: 3,
    providerCostSource: 'provider_usage',
    status: 'failed_partial',
    artifactDir: 'providers/openai-gpt-5.4-nano',
    completedPages: 2,
    failedPages: 1,
    failure: { message: 'page failed' }
  },
  step3: {
    llmService: 'openai',
    llmModel: 'gpt-5.4-nano',
    processingTime: 4000,
    inputTokenCount: 40,
    outputTokenCount: 20,
    outputFileName: 'output.json',
    outputFormat: 'json',
    structuredMode: 'native',
    structuredPresetNames: []
  },
  step4: {
    ttsService: 'openai',
    ttsModel: 'gpt-4o-mini-tts-2025-12-15',
    processingTime: 5000,
    audioFileName: 'speech.wav',
    audioFileSize: 500,
    chunkCount: 1
  },
  step5: {
    imageService: 'openai',
    imageModel: 'gpt-image-2',
    processingTime: 6000,
    imageFileNames: ['image.png'],
    imageCount: 1,
    imageFileSize: 600,
    imageWidth: 1024,
    imageHeight: 1024,
    requestMode: 'generation',
    providerCostCents: 6,
    providerCostSource: 'provider_quote'
  },
  step6: {
    videoGenService: 'gemini',
    videoGenModel: 'veo-test',
    processingTime: 7000,
    videoFileName: 'video.mp4',
    videoFileSize: 700,
    videoDuration: 7,
    providerCostCents: 7,
    providerCostSource: 'provider_quote'
  },
  step7: {
    musicService: 'gemini',
    musicModel: 'lyria-test',
    processingTime: 8000,
    musicFileName: 'music.wav',
    musicFileSize: 800,
    musicDurationMs: 8000,
    lyricsSource: 'none',
    providerCostCents: 8,
    providerCostSource: 'provider_quote'
  }
} satisfies ComputeActualCostsInput & ComputeActualProcessingTimesInput

describe('actual run-step walker contracts', () => {
  test('cost and timing preserve their serialized valid-run projections', () => {
    expect(JSON.stringify(computeActualCosts(fixture))).toBe('{"totalCost":28.2633,"steps":[{"step":"extract","provider":"openai","model":"gpt-5.4-nano","cost":3,"costSource":"partial_provider_usage","inputMetric":"tokens","inputValue":45,"promptTokens":30,"completionTokens":15},{"step":"stt","provider":"whisper","model":"large-v3","cost":1,"costSource":"provider_quote","inputMetric":"durationSeconds","inputValue":12},{"step":"stt","provider":"whisperfile","model":"tiny","cost":2,"costSource":"provider_quote","inputMetric":"durationSeconds","inputValue":12},{"step":"llm","provider":"openai","model":"gpt-5.4-nano","cost":0.0033,"costSource":"computed_usage","inputMetric":"tokens","inputValue":60,"promptTokens":40,"completionTokens":20},{"step":"tts","provider":"openai","model":"gpt-4o-mini-tts-2025-12-15","cost":1.26,"costSource":"computed_usage","inputMetric":"characters","inputValue":1000},{"step":"image","provider":"openai","model":"gpt-image-2","cost":6,"costSource":"provider_quote","inputMetric":"images","inputValue":1},{"step":"video","provider":"gemini","model":"veo-test","cost":7,"costSource":"provider_quote","inputMetric":"durationSeconds","inputValue":7},{"step":"music","provider":"gemini","model":"lyria-test","cost":8,"costSource":"provider_quote","inputMetric":"durationMs","inputValue":8000}]}')
    expect(JSON.stringify(computeActualProcessingTimes(fixture))).toBe('{"totalProcessingTimeMs":36600,"steps":[{"step":"stt","provider":"whisper","model":"large-v3","processingTimeMs":1200,"inputMetric":"durationSeconds","inputValue":12,"rateBasis":"durationSecond","msPerUnit":100,"throughputValue":10,"throughputUnit":"x","timingScope":"wall"},{"step":"stt","provider":"whisperfile","model":"tiny","processingTimeMs":2400,"inputMetric":"durationSeconds","inputValue":12,"rateBasis":"durationSecond","msPerUnit":200,"throughputValue":5,"throughputUnit":"x","timingScope":"wall"},{"step":"extract","provider":"openai","model":"gpt-5.4-nano","processingTimeMs":3000,"inputMetric":"pages","inputValue":2,"timingNote":"Partial failed provider; timing covers cached page artifacts through failure.","rateBasis":"page","msPerUnit":1500,"throughputValue":40,"throughputUnit":"pagesPerMinute","timingScope":"wall"},{"step":"llm","provider":"openai","model":"gpt-5.4-nano","processingTimeMs":4000,"inputMetric":"tokens","inputValue":60,"rateBasis":"1KTokens","msPerUnit":66666.667,"throughputValue":15,"throughputUnit":"tokensPerSecond","timingScope":"wall"},{"step":"tts","provider":"openai","model":"gpt-4o-mini-tts-2025-12-15","processingTimeMs":5000,"inputMetric":"characters","inputValue":1000,"rateBasis":"1KCharacters","msPerUnit":5000,"throughputValue":200,"throughputUnit":"charactersPerSecond","timingScope":"wall"},{"step":"image","provider":"openai","model":"gpt-image-2","processingTimeMs":6000,"inputMetric":"images","inputValue":1,"rateBasis":"image","msPerUnit":6000,"throughputValue":10,"throughputUnit":"imagesPerMinute","timingScope":"wall"},{"step":"video","provider":"gemini","model":"veo-test","processingTimeMs":7000,"inputMetric":"durationSeconds","inputValue":7,"rateBasis":"durationSecond","msPerUnit":1000,"throughputValue":1,"throughputUnit":"x","timingScope":"wall"},{"step":"music","provider":"gemini","model":"lyria-test","processingTimeMs":8000,"inputMetric":"durationSeconds","inputValue":8,"rateBasis":"durationSecond","msPerUnit":1000,"throughputValue":1,"throughputUnit":"x","timingScope":"wall"}]}')
  })

  test('malformed and ambiguous step2 objects are skipped consistently', () => {
    const malformed = { unexpected: true }
    const ambiguous = {
      ...fixture.step2[0],
      extractionMethod: 'pdf-text',
      totalPages: 1,
      ocrPages: 0,
      textPages: 1,
      dpi: 300,
      languages: 'eng',
      tokenEstimate: 10
    }

    for (const step2 of [malformed, ambiguous]) {
      const cost = computeActualCosts({ step2 } as unknown as ComputeActualCostsInput)
      const timing = computeActualProcessingTimes({ step2 } as unknown as ComputeActualProcessingTimesInput)
      expect(cost).toEqual({ totalCost: 0, steps: [] })
      expect(timing).toEqual({ totalProcessingTimeMs: 0, steps: [] })
    }
  })
})
