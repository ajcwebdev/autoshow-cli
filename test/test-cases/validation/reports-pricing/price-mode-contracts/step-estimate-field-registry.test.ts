import { describe, expect, test } from 'bun:test'
import type { AggregatedPriceEstimate } from '~/types'
import { preflightToEstimated } from '~/utils/pricing/compute-costs'
import { stepEstimateToReport } from '~/utils/pricing/step-estimate-fields'

const recordedEstimate = {
  totalEstimatedCost: 28,
  steps: [{
    step: 'stt',
    provider: 'deepgram',
    model: 'nova-3',
    totalCost: 1,
    costMultiplier: 1.1,
    durationSeconds: 60,
    estimateType: 'exact'
  }, {
    step: 'extract',
    provider: 'openai',
    model: 'gpt-5.4-nano',
    totalCost: 2,
    costMultiplier: 1.2,
    costPer1kPagesCents: 3,
    pageCount: 4,
    rasterizedPages: 5,
    singlePagePdfFallbackPages: 6,
    estimatedOutputChars: 7,
    inputCostPer1MCents: 8,
    outputCostPer1MCents: 9,
    pricingBand: 'standard',
    pricingNote: 'recorded pricing note',
    promptTokens: 10,
    completionTokens: 11,
    ocrMode: 'rendered',
    tokenEstimateSource: 'profile',
    tokenEstimateConfidence: 'healthy',
    tokenProfileSampleCount: 12,
    tokenProfilePromptTokensPerPage: 13,
    tokenProfileCompletionTokensPerPage: 14,
    estimateType: 'heuristic',
    note: 'not serialized'
  }, {
    step: 'llm',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    totalCost: 3,
    costMultiplier: 1.3,
    inputCostPer1MCents: 15,
    outputCostPer1MCents: 16,
    estimatedInputTokens: 17,
    estimatedOutputTokens: 18,
    pricingBand: 'long-context',
    pricingNote: 'recorded LLM note'
  }, {
    step: 'tts',
    provider: 'elevenlabs',
    model: 'eleven_v3',
    totalCost: 4,
    costMultiplier: 1.4,
    costPer1kCharactersCents: 19,
    inputCostPer1MCharactersCents: 20,
    outputCostPer1MCharactersCents: 21,
    characterCount: 22,
    chunkConcurrency: 2,
    setupCostCents: 0,
    setupTimeMs: 23,
    estimateType: 'exact',
    note: 'not serialized'
  }, {
    step: 'image',
    provider: 'openai',
    model: 'gpt-image-1.5',
    totalCost: 5,
    costMultiplier: 1.5,
    imageCount: 24
  }, {
    step: 'video',
    provider: 'gemini',
    model: 'veo-3.1-generate-preview',
    totalCost: 6,
    costMultiplier: 1.6,
    durationSeconds: 25
  }, {
    step: 'music',
    provider: 'minimax',
    model: 'music-3.0',
    totalCost: 7,
    costMultiplier: 1.7,
    durationSeconds: 26,
    lyricsSource: 'generated',
    note: 'not serialized'
  }]
} satisfies AggregatedPriceEstimate

describe('step estimate field registry contracts', () => {
  test('preflight conversion preserves the recorded field set and key order for every step', () => {
    expect(JSON.stringify(preflightToEstimated(recordedEstimate))).toBe(JSON.stringify({
      totalCost: 28,
      steps: [{
        step: 'stt',
        provider: 'deepgram',
        model: 'nova-3',
        cost: 1,
        costMultiplier: 1.1,
        durationSeconds: 60,
        estimateType: 'exact'
      }, {
        step: 'extract',
        provider: 'openai',
        model: 'gpt-5.4-nano',
        cost: 2,
        costMultiplier: 1.2,
        costPer1kPagesCents: 3,
        pageCount: 4,
        rasterizedPages: 5,
        singlePagePdfFallbackPages: 6,
        estimatedOutputChars: 7,
        inputCostPer1MCents: 8,
        outputCostPer1MCents: 9,
        pricingBand: 'standard',
        pricingNote: 'recorded pricing note',
        promptTokens: 10,
        completionTokens: 11,
        ocrMode: 'rendered',
        tokenEstimateSource: 'profile',
        tokenEstimateConfidence: 'healthy',
        tokenProfileSampleCount: 12,
        tokenProfilePromptTokensPerPage: 13,
        tokenProfileCompletionTokensPerPage: 14,
        estimateType: 'heuristic'
      }, {
        step: 'llm',
        provider: 'anthropic',
        model: 'claude-sonnet-4-6',
        cost: 3,
        costMultiplier: 1.3,
        inputCostPer1MCents: 15,
        outputCostPer1MCents: 16,
        estimatedInputTokens: 17,
        estimatedOutputTokens: 18,
        pricingBand: 'long-context',
        pricingNote: 'recorded LLM note'
      }, {
        step: 'tts',
        provider: 'elevenlabs',
        model: 'eleven_v3',
        cost: 4,
        costMultiplier: 1.4,
        costPer1kCharactersCents: 19,
        inputCostPer1MCharactersCents: 20,
        outputCostPer1MCharactersCents: 21,
        setupCostCents: 0,
        estimateType: 'exact'
      }, {
        step: 'image',
        provider: 'openai',
        model: 'gpt-image-1.5',
        cost: 5,
        costMultiplier: 1.5,
        imageCount: 24
      }, {
        step: 'video',
        provider: 'gemini',
        model: 'veo-3.1-generate-preview',
        cost: 6,
        costMultiplier: 1.6,
        durationSeconds: 25
      }, {
        step: 'music',
        provider: 'minimax',
        model: 'music-3.0',
        cost: 7,
        costMultiplier: 1.7,
        durationSeconds: 26
      }]
    }))
  })

  test('raw estimate reporting preserves its recorded aliases, omissions, and key order', () => {
    expect(JSON.stringify(recordedEstimate.steps.map(step => stepEstimateToReport(step)))).toBe(JSON.stringify([{
      step: 'stt',
      provider: 'deepgram',
      model: 'nova-3',
      totalCostCents: 1
    }, {
      step: 'extract',
      provider: 'openai',
      model: 'gpt-5.4-nano',
      costPer1kPagesCents: 3,
      inputCostPer1MCents: 8,
      outputCostPer1MCents: 9,
      pages: 4,
      estOutputChars: 7,
      promptTokens: 10,
      completionTokens: 11,
      tokenEstimateSource: 'profile',
      tokenEstimateConfidence: 'healthy',
      pricingBand: 'standard',
      pricingNote: 'recorded pricing note',
      estimateType: 'heuristic',
      totalCostCents: 2
    }, {
      step: 'llm',
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      inputCostPer1MCents: 15,
      outputCostPer1MCents: 16,
      estInputTokens: 17,
      estOutputTokens: 18,
      pricingBand: 'long-context',
      pricingNote: 'recorded LLM note',
      totalCostCents: 3
    }, {
      step: 'tts',
      provider: 'elevenlabs',
      model: 'eleven_v3',
      characters: 22,
      setupCostCents: 0,
      totalCostCents: 4
    }, {
      step: 'image',
      provider: 'openai',
      model: 'gpt-image-1.5',
      totalCostCents: 5
    }, {
      step: 'video',
      provider: 'gemini',
      model: 'veo-3.1-generate-preview',
      totalCostCents: 6
    }, {
      step: 'music',
      provider: 'minimax',
      model: 'music-3.0',
      totalCostCents: 7
    }]))
  })
})
