import { validateData } from '~/utils/validate/validation'
import { RetiredModelRatesSchema } from './model-loader-schemas'
import type { ModelCategory, RetiredModelRate, RetiredModelRates, RetiredModelReplacements } from '~/types'

export const modelRateKey = (service: string, model: string): string => `${service}:${model}`

export const RETIRED_MODEL_RATES: RetiredModelRates = {
  stt: {
    'happyscribe:auto': { costPerHourCents: 60 },
    'supadata:auto': { costPerHourCents: 0 },
    'whisper:tiny': { costPerHourCents: 0 },
    'whisper:base': { costPerHourCents: 0 },
    'whisper:small': { costPerHourCents: 0 },
    'whisper:medium': { costPerHourCents: 0 },
    'whisper:large-v3-turbo': { costPerHourCents: 0 },
    'assemblyai:universal-2': { costPerHourCents: 17 },
    'gladia:solaria-1': { costPerHourCents: 61 },
    'groq:whisper-large-v3': { costPerHourCents: 11.1 },
    'groq:whisper-large-v3-turbo': { costPerHourCents: 4 },
    'speechmatics:enhanced': { costPerHourCents: 40 },
    'rev:machine': {
      costPerHourCents: 20,
      billing: { roundingIncrementSeconds: 1, minimumSeconds: 15 }
    },
    'rev:low_cost': {
      costPerHourCents: 10,
      billing: { roundingIncrementSeconds: 1, minimumSeconds: 15 }
    },
    'gemini-stt:gemini-3.6-flash': { costPerHourCents: 17.28 },
    'gemini-stt:gemini-3.8-flash': { costPerHourCents: 17.28 },
    'grok:speech-to-text': { costPerHourCents: 10 },
    // Removed 2026-10-17 by decision (ADR-010 Excluded integrations); kept to reprice the finished benchmark runs.
    'cloudflare:@cf/deepgram/nova-3': { costPerHourCents: 31.2 }
  },
  extract: {
    'firecrawl:firecrawl': { costPer1kPagesCents: 83 },
    'supadata:supadata': { costPer1kPagesCents: 1000 },
    // Historical heuristic only: the REST Reader rate was never verified.
    'glm-reader:glm-reader': { costPer1kPagesCents: 1000 },
    'anthropic:claude-opus-4-7': { costPerMInputTokensCents: 0, costPerMOutputTokensCents: 0 },
    'gemini:gemini-3.1-flash-lite': { costPerMInputTokensCents: 25, costPerMOutputTokensCents: 150 },
    'gemini:gemini-3.1-flash-lite-preview': { costPerMInputTokensCents: 25, costPerMOutputTokensCents: 150 }
  },
  llm: {
    'gemini:gemini-3.1-flash-lite': { inputCostPer1MCents: 25, outputCostPer1MCents: 150 },
    'gemini:gemini-3.1-flash-lite-preview': { inputCostPer1MCents: 25, outputCostPer1MCents: 150 },
    'gemini:gemini-3.5-flash-lite': { inputCostPer1MCents: 30, outputCostPer1MCents: 250 },
    'gemini:gemini-3.6-flash': { inputCostPer1MCents: 150, outputCostPer1MCents: 750 },
    'gemini:gemini-3.5-flash': { inputCostPer1MCents: 150, outputCostPer1MCents: 900 },
    'grok:grok-4.5': {
      inputCostPer1MCents: 200,
      cachedInputCostPer1MCents: 30,
      outputCostPer1MCents: 600,
      tokenPricingBands: [
        {
          label: 'standard-up-to-200k',
          maxInputTokens: 200000,
          inputCostPer1MCents: 200,
          cachedInputCostPer1MCents: 30,
          outputCostPer1MCents: 600
        },
        {
          label: 'standard-over-200k',
          minInputTokens: 200001,
          inputCostPer1MCents: 400,
          cachedInputCostPer1MCents: 60,
          outputCostPer1MCents: 1200
        }
      ]
    },
    'anthropic:claude-fable-5': { inputCostPer1MCents: 1000, outputCostPer1MCents: 5000 }
  },
  tts: {
    'deepinfra:ResembleAI/chatterbox-turbo': { costPer1kCharsCents: 0.1 },
    'deepinfra:XiaomiMiMo/MiMo-V2.5-tts': { costPer1kCharsCents: 0.0 },
    'deepinfra:XiaomiMiMo/MiMo-V2.5-tts-voicedesign': { costPer1kCharsCents: 0.0 },
    'deepinfra:Qwen/Qwen3-TTS': { costPer1kCharsCents: 2.0 },
    'deepinfra:Qwen/Qwen3-TTS-VoiceDesign': { costPer1kCharsCents: 2.0 },
    'deepinfra:ResembleAI/chatterbox-multilingual': { costPer1kCharsCents: 0.1 },
    'fish:s2.1-pro': { costPer1kCharsCents: 1.5 },
    'fish:fish-speech-1.5': { costPer1kCharsCents: 5 },
    'fish:s1': { costPer1kCharsCents: 5 },
    'fish:s2-pro': { costPer1kCharsCents: 10 },
    'fish:voice-design-1': { costPer1kCharsCents: 20 },
    'minimax:speech-2.8-hd': { costPer1kCharsCents: 10 },
    'minimax:speech-2.8-turbo': { costPer1kCharsCents: 6 },
    'gemini:gemini-3.1-flash-tts-preview': { inputCostPer1MCharsCents: 100, outputCostPer1MCharsCents: 2000 },
    'deepgram:aura-2-thalia-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-andromeda-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-apollo-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-luna-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-orion-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-helena-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-arcas-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-aries-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-amalthea-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-asteria-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-athena-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-atlas-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-aurora-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-callista-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-cora-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-cordelia-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-delia-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-draco-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-electra-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-harmonia-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-hera-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-hermes-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-hyperion-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-iris-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-janus-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-juno-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-jupiter-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-mars-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-minerva-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-neptune-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-odysseus-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-ophelia-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-orpheus-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-pandora-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-phoebe-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-pluto-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-saturn-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-selene-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-theia-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-vesta-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-zeus-en': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-sirio-es': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-nestor-es': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-carina-es': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-celeste-es': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-alvaro-es': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-diana-es': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-aquila-es': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-selena-es': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-estrella-es': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-javier-es': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-agustina-es': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-antonia-es': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-gloria-es': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-luciano-es': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-olivia-es': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-silvia-es': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-valerio-es': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-beatrix-nl': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-daphne-nl': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-cornelia-nl': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-sander-nl': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-hestia-nl': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-lars-nl': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-roman-nl': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-rhea-nl': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-leda-nl': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-agathe-fr': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-hector-fr': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-elara-de': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-aurelia-de': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-lara-de': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-julius-de': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-fabian-de': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-kara-de': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-viktoria-de': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-melia-it': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-elio-it': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-flavio-it': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-maia-it': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-cinzia-it': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-cesare-it': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-livia-it': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-perseo-it': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-dionisio-it': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-demetra-it': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-uzume-ja': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-ebisu-ja': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-fujin-ja': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-izanami-ja': { costPer1kCharsCents: 3 },
    'deepgram:aura-2-ama-ja': { costPer1kCharsCents: 3 },
    'elevenlabs:eleven_flash_v2_5': { costPer1kCharsCents: 5 },
    'elevenlabs:eleven_multilingual_v2': { costPer1kCharsCents: 10 },
    'openai:gpt-4o-mini-tts': { inputCostPer1MCharsCents: 60, outputCostPer1MCharsCents: 1200 },
    'openai:tts-1': { inputCostPer1MCharsCents: 0, outputCostPer1MCharsCents: 1500 },
    'openai:tts-1-hd': { inputCostPer1MCharsCents: 0, outputCostPer1MCharsCents: 3000 },
    'inworld:realtime-tts-2-flash': { costPer1kCharsCents: 1.5 }
  },
  image: {
    'gemini:gemini-3.1-flash-image-preview': { costPerImageCents: 6.7 },
    'gemini:gemini-3.1-flash-image': { costPerImageCents: 6.7 },
    'gemini:gemini-3-pro-image': { costPerImageCents: 13.4 },
    'grok:grok-imagine-image': { costPerImageCents: 2 },
    'grok:grok-imagine-image-quality': { costPerImageCents: 5 },
    'bfl:flux-2-klein-4b': { costPerImageCents: 1.4 },
    'bfl:flux-2-klein-9b': { costPerImageCents: 1.5 },
    'bfl:flux-2-pro': { costPerImageCents: 3 },
    'bfl:flux-2-max': { costPerImageCents: 7 },
    'bfl:flux-2-flex': { costPerImageCents: 6 },
    'recraft:recraftv4_1': { costPerImageCents: 4 },
    'recraft:recraftv4_1_utility': { costPerImageCents: 4 },
    'recraft:recraftv4_1_pro': { costPerImageCents: 25 },
    'recraft:recraftv4_1_utility_pro': { costPerImageCents: 25 },
    'reve:latest': { costPerImageCents: 0.13333333333333333 },
    'reve:reve-create@20250915': { costPerImageCents: 0.13333333333333333 }
  },
  music: {
    'elevenlabs:music_v1': { costPerMinuteCents: 15 },
    'gemini:lyria-3-clip-preview': { costPerTrackCents: 4 },
    'gemini:lyria-3-pro-preview': { costPerTrackCents: 8 },
    'minimax:music-2.6': { costPerTrackCents: 15, lyricsCostPerTrackCents: 1 }
  },
  video: {
    'minimax:MiniMax-Hailuo-2.3': { blockSizeSec: 6, blockCost720pCents: 28, blockCost1080pCents: 49 },
    'minimax:MiniMax-Hailuo-2.3-Fast': { fixedCostByResolutionDurationCents: { '720p': { '6': 19, '10': 32 }, '1080p': { '6': 33 } } },
    'minimax:T2V-01': { blockSizeSec: 6, blockCost720pCents: 19 },
    'minimax:T2V-01-Director': { blockSizeSec: 6, blockCost720pCents: 19 },
    'minimax:I2V-01': { blockSizeSec: 6, blockCost720pCents: 19 },
    'minimax:I2V-01-Director': { blockSizeSec: 6, blockCost720pCents: 19 },
    'minimax:I2V-01-live': { blockSizeSec: 6, blockCost720pCents: 19 },
    'minimax:S2V-01': { blockSizeSec: 6, blockCost720pCents: 19 },
    'glm:cogvideox-3': { baseJobFeeCents: 20 },
    'glm:viduq1-text': { baseJobFeeCents: 40 },
    'glm:vidu2-image': { baseJobFeeCents: 20 },
    'glm:vidu2-start-end': { baseJobFeeCents: 20 },
    'glm:vidu2-reference': { baseJobFeeCents: 40 },
    'runway:gen4.5': { baseCostPerSecondCents: 12 },
    'gemini:veo-3.1-generate-preview': {
      baseCostPerSecondCents: 40,
      resolutionMultiplier1080p: 1,
      costPerSecondByResolutionCents: { '720p': 40, '1080p': 40, '4k': 60 }
    },
    'gemini:veo-3.1-fast-generate-preview': {
      baseCostPerSecondCents: 10,
      resolutionMultiplier1080p: 1.2,
      costPerSecondByResolutionCents: { '720p': 10, '1080p': 12, '4k': 30 }
    },
    'gemini:veo-3.1-lite-generate-preview': {
      baseCostPerSecondCents: 5,
      resolutionMultiplier1080p: 1.6,
      costPerSecondByResolutionCents: { '720p': 5, '1080p': 8 }
    },
    'grok:grok-imagine-video': {
      baseCostPerSecondCents: 5,
      resolutionMultiplier720p: 1.4,
      inputImageCostCents: 0.2,
      inputVideoCostPerSecondCents: 1
    }
  }
}

export const RETIRED_MODEL_REPLACEMENTS: RetiredModelReplacements = {
  stt: {
    'assemblyai:universal-2': 'universal-3-5-pro',
    'gladia:solaria-1': 'solaria-3',
    'speechmatics:enhanced': 'melia-1',
    'gemini-stt:gemini-3.6-flash': 'gemini-3.5-transcribe',
    'gemini-stt:gemini-3.8-flash': 'gemini-3.5-transcribe',
    'grok:speech-to-text': 'grok-voice-transcribe-2.0'
  },
  extract: {
    'gemini:gemini-3.1-flash-lite': 'gemini-3.8-flash'
  },
  llm: {
    'gemini:gemini-3.1-flash-lite': 'gemini-3.8-flash'
  },
  tts: {
    'elevenlabs:eleven_flash_v2_5': 'eleven_v3',
    'elevenlabs:eleven_multilingual_v2': 'eleven_v3',
    'openai:tts-1': 'gpt-4o-mini-tts-2025-12-15',
    'openai:tts-1-hd': 'gpt-4o-mini-tts-2025-12-15',
    'inworld:realtime-tts-2-flash': 'realtime-tts-2'
  },
  image: {
    'grok:grok-imagine-image': 'grok-imagine-image-2.0',
    'grok:grok-imagine-image-quality': 'grok-imagine-image-2.0',
    'gemini:gemini-3.1-flash-image': 'gemini-3.1-flash-lite-image',
    'gemini:gemini-3-pro-image': 'gemini-3.1-flash-lite-image',
    'bfl:flux-2-klein-4b': 'gpt-image-2.5-flare',
    'bfl:flux-2-klein-9b': 'gpt-image-2.5-flare',
    'bfl:flux-2-pro': 'gpt-image-2.5-flare',
    'bfl:flux-2-max': 'gpt-image-2.5-flare',
    'bfl:flux-2-flex': 'gpt-image-2.5-flare',
    'recraft:recraftv4_1': 'gpt-image-2.5-flare',
    'recraft:recraftv4_1_pro': 'gpt-image-2.5-flare',
    'recraft:recraftv4_1_utility': 'gpt-image-2.5-flare',
    'recraft:recraftv4_1_utility_pro': 'gpt-image-2.5-flare'
  },
  music: {
    'elevenlabs:music_v1': 'music_v2',
    'gemini:lyria-3-clip-preview': 'lyria-3.5',
    'gemini:lyria-3-pro-preview': 'lyria-3.5'
  },
  video: {
    'minimax:MiniMax-Hailuo-2.3': 'MiniMax-H3',
    'minimax:MiniMax-Hailuo-2.3-Fast': 'MiniMax-H3',
    'minimax:T2V-01': 'MiniMax-H3',
    'minimax:T2V-01-Director': 'MiniMax-H3',
    'minimax:I2V-01': 'MiniMax-H3',
    'minimax:I2V-01-Director': 'MiniMax-H3',
    'minimax:I2V-01-live': 'MiniMax-H3',
    'minimax:S2V-01': 'MiniMax-H3',
    'grok:grok-imagine-video': 'grok-imagine-video-1.5',
    'gemini:veo-3.1-generate-preview': 'gemini-omni-1.1-flash',
    'gemini:veo-3.1-fast-generate-preview': 'gemini-omni-1.1-flash',
    'gemini:veo-3.1-lite-generate-preview': 'gemini-omni-1.1-flash'
  }
}

let retiredRatesValidated = false

const assertValidatedRetiredRates = (): void => {
  if (retiredRatesValidated) return
  validateData(RetiredModelRatesSchema, RETIRED_MODEL_RATES, 'retired model rates')
  retiredRatesValidated = true
}

export const getRetiredModelRate = <Category extends ModelCategory>(
  category: Category,
  service: string,
  model: string
): RetiredModelRate<Category> | undefined => {
  assertValidatedRetiredRates()
  return RETIRED_MODEL_RATES[category][modelRateKey(service, model)] as RetiredModelRate<Category> | undefined
}

export const hasRetiredModelRate = (
  category: ModelCategory,
  service: string,
  model: string
): boolean => getRetiredModelRate(category, service, model) !== undefined

export const getRetiredModelReplacement = (
  category: ModelCategory,
  service: string,
  model: string
): string | undefined => RETIRED_MODEL_REPLACEMENTS[category][modelRateKey(service, model)]
