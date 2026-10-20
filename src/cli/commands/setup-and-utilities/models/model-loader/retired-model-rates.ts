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
    // Removed 2026-10-18; frozen prices keep purchased benchmark evidence readable.
    "glm:glm-5.3-flash": {
      "pricingSourceUrl": "https://docs.z.ai/guides/overview/pricing",
      "pricingCheckedAt": "2026-09-11",
      "pricingCurrency": "USD",
      "pricingTier": "Z.AI standard API, uncached",
      "pricingNotes": "$0.15/M input and $0.50/M completion tokens, including reasoning once. Cached input $0.03/M; estimates conservatively ignore discounts. Page-token and latency heuristics are uncalibrated; not a spending bound.",
      "costPerMInputTokensCents": 15,
      "costPerMOutputTokensCents": 50
    },
    "kimi:kimi-k2.6": {
      "pricingSourceUrl": "https://platform.kimi.ai/docs/pricing/chat",
      "pricingCheckedAt": "2026-05-31",
      "pricingCurrency": "USD",
      "pricingTier": "Moonshot AI public API token pricing",
      "pricingNotes": "Moonshot AI public pricing lists Kimi K2.6 at $0.95/1M input tokens and $4/1M output tokens. OCR estimates use cache-miss input pricing conservatively; cache discounts, batch discounts, enterprise pricing, taxes, and provider credits are ignored.",
      "costPerMInputTokensCents": 95,
      "costPerMCachedInputTokensCents": 16,
      "costPerMOutputTokensCents": 400
    },
    "kimi:kimi-k3": {
      "pricingSourceUrl": "https://platform.kimi.ai/docs/pricing/chat",
      "pricingCheckedAt": "2026-07-24",
      "pricingCurrency": "USD",
      "pricingTier": "Moonshot AI public API token pricing",
      "pricingNotes": "Moonshot AI public pricing lists Kimi K3 at $3/1M cache-miss input tokens, $0.30/1M cache-hit input tokens, and $15/1M output tokens with flat pay-as-you-go rates and no context tiers. OCR estimates use cache-miss input pricing conservatively. Kimi K3 requires thinking; AutoShow defaults omitted --reasoning-effort to low rather than the provider max. The reused Kimi K2.6 page heuristics are provisional until a separately approved paid calibration is available. Cache discounts, batch discounts, enterprise pricing, taxes, and provider credits are ignored.",
      "costPerMInputTokensCents": 300,
      "costPerMCachedInputTokensCents": 30,
      "costPerMOutputTokensCents": 1500
    },
    // Removed from active selection by project decision on 2026-10-18; preserve finished-run pricing.
    'openai:gpt-5.6-sol': {
      pricingSourceUrl: 'https://developers.openai.com/api/docs/models/gpt-5.6-sol',
      pricingCheckedAt: '2026-10-15',
      pricingCurrency: 'USD',
      pricingTier: 'OpenAI API standard token pricing',
      pricingNotes: 'Checked October 15, 2026: GPT-5.6 Sol promotional standard rates are $4/1M input, $0.40/1M cached input and $20/1M output tokens, available at least through November 21, 2026; no later rate is assumed. Above 272K input tokens, the full request uses $8/1M input, $0.80/1M cached input and $30/1M output. Cache writes cost 1.25x uncached input. OCR estimates and observed-usage calculations use uncached standard rates; cache writes, batch/flex discounts, fast mode, regional uplifts, enterprise pricing, taxes and credits are excluded. The gpt-5.6 alias is not registered separately.',
      costPerMInputTokensCents: 400,
      costPerMCachedInputTokensCents: 40,
      costPerMOutputTokensCents: 2000,
      tokenPricingBands: [
        {
          label: 'standard-short-context',
          maxInputTokens: 272000,
          inputCostPer1MCents: 400,
          cachedInputCostPer1MCents: 40,
          outputCostPer1MCents: 2000
        },
        {
          label: 'standard-long-context',
          minInputTokens: 272001,
          inputCostPer1MCents: 800,
          cachedInputCostPer1MCents: 80,
          outputCostPer1MCents: 3000
        }
      ]
    },
    'openai:gpt-5.6-luna': {
      pricingSourceUrl: 'https://developers.openai.com/api/docs/models/gpt-5.6-luna',
      pricingCheckedAt: '2026-08-12',
      pricingCurrency: 'USD',
      pricingTier: 'OpenAI API standard token pricing',
      pricingNotes: 'OpenAI lists GPT-5.6 Luna Standard pricing at $0.20/1M input tokens, $0.02/1M cached input tokens, $0.25/1M cache write tokens, and $1.20/1M output tokens. OCR estimates multiply observed or heuristic token usage by uncached standard input/output rates. Batch, flex, priority, regional uplifts, cached-input discounts, cache-write charges, enterprise pricing, taxes, and provider credits are ignored.',
      costPerMInputTokensCents: 20,
      costPerMCachedInputTokensCents: 2,
      costPerMOutputTokensCents: 120,
      tokenPricingBands: [
        {
          label: 'standard-short-context',
          maxInputTokens: 272000,
          inputCostPer1MCents: 20,
          cachedInputCostPer1MCents: 2,
          outputCostPer1MCents: 120
        },
        {
          label: 'standard-long-context',
          minInputTokens: 272001,
          inputCostPer1MCents: 40,
          cachedInputCostPer1MCents: 4,
          outputCostPer1MCents: 180
        }
      ]
    },
    'gemini:gemini-3.7-flash': {
      pricingSourceUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
      pricingCheckedAt: '2026-08-18',
      pricingCurrency: 'USD',
      pricingTier: 'Gemini API paid Standard',
      pricingNotes: 'Gemini 3.7 Flash Standard pricing is $1.50/1M input tokens and $7.50/1M output tokens effective 2027-01-01, with introductory pricing of $0.75/1M input tokens and $3.75/1M output tokens through 2026-12-31 and no published context tiers. AutoShow conservatively records the standard rates, so estimates overstate cost during the introductory window. OCR estimates multiply observed token usage by these published rates. The page heuristics are reused from Gemini 3.6 Flash and are provisional until a separately approved paid calibration is available; free tier, batch/flex/priority prices, context caching, taxes, and provider credits are ignored.',
      costPerMInputTokensCents: 150,
      costPerMOutputTokensCents: 750
    },
    'anthropic:claude-sonnet-5': {
      pricingSourceUrl: 'https://platform.claude.com/docs/en/about-claude/pricing?hsLang=en',
      pricingCheckedAt: '2026-09-23',
      pricingCurrency: 'USD',
      pricingTier: 'Claude API standard token pricing',
      pricingNotes: 'Anthropic confirms $2/1M input and $10/1M output are now standard Sonnet 5 rates; the previously announced September 1 increase was canceled. Cache reads $0.20/M and cache writes $2.50/M (5m) or $4/M (1h) are not requested or automatically discounted. Published rates are separate from empirical token and latency estimates. Batch, regional premiums, taxes and credits are excluded.',
      costPerMInputTokensCents: 200,
      costPerMOutputTokensCents: 1000
    },
    'anthropic:claude-opus-5': {
      pricingSourceUrl: 'https://platform.claude.com/docs/en/about-claude/pricing?hsLang=en',
      pricingCheckedAt: '2026-07-24',
      pricingCurrency: 'USD',
      pricingTier: 'Claude API standard token pricing',
      pricingNotes: 'Anthropic lists Claude Opus 5 at $5/1M input tokens and $25/1M output tokens. OCR estimates multiply observed token usage by these published rates. Claude Opus 5 runs with thinking on by default, so the inherited page heuristics are provisional until a separately approved paid calibration is available. Prompt caching, batch discounts, fast mode, enterprise pricing, taxes, and provider credits are ignored.',
      costPerMInputTokensCents: 500,
      costPerMOutputTokensCents: 2500
    },
    'grok:grok-4.6': {
      pricingSourceUrl: 'https://docs.x.ai/developers/pricing',
      pricingCheckedAt: '2026-08-18',
      pricingCurrency: 'USD',
      pricingTier: 'xAI public Chat API token pricing',
      pricingNotes: 'xAI lists Grok 4.6 standard pricing at $2.00/1M input tokens, $0.50/1M cached input tokens, and $6.00/1M output tokens for requests with up to 200K input tokens. Requests above 200K input tokens cost $4.00/1M input tokens, $1.00/1M cached input tokens, and $12.00/1M output tokens. OCR estimates use uncached rates and switch bands from estimated or observed input tokens. Batch discounts, cached-input discounts, enterprise pricing, taxes, and provider credits are ignored.',
      costPerMInputTokensCents: 200,
      costPerMCachedInputTokensCents: 50,
      costPerMOutputTokensCents: 600,
      tokenPricingBands: [
        {
          label: 'standard-up-to-200k',
          maxInputTokens: 200000,
          inputCostPer1MCents: 200,
          cachedInputCostPer1MCents: 50,
          outputCostPer1MCents: 600
        },
        {
          label: 'standard-over-200k',
          minInputTokens: 200001,
          inputCostPer1MCents: 400,
          cachedInputCostPer1MCents: 100,
          outputCostPer1MCents: 1200
        }
      ]
    },
    'firecrawl:firecrawl': { costPer1kPagesCents: 83 },
    'supadata:supadata': { costPer1kPagesCents: 1000 },
    // Historical heuristic only: the REST Reader rate was never verified.
    'glm-reader:glm-reader': { costPer1kPagesCents: 1000 },
    'anthropic:claude-opus-4-7': { costPerMInputTokensCents: 0, costPerMOutputTokensCents: 0 },
    'gemini:gemini-3.1-flash-lite': { costPerMInputTokensCents: 25, costPerMOutputTokensCents: 150 },
    'gemini:gemini-3.1-flash-lite-preview': { costPerMInputTokensCents: 25, costPerMOutputTokensCents: 150 },
    'replicate:datalab-to/ocr': { costPer1kPagesCents: 200 },
    'replicate:datalab-to/marker': { costPer1kPagesCents: 400 },
    'replicate:lucataco/deepseek-ocr': { costPer1kPagesCents: 330 },
    'fal:fal-ai/got-ocr/v2': { costPer1kPagesCents: 5000 },
    'fal:fal-ai/florence-2-large/ocr': { costPer1kPagesCents: 755 }
  },
  llm: {
    // Removed 2026-10-18; frozen prices keep purchased benchmark evidence readable.
    "glm:glm-5.3": {
      "pricingSourceUrl": "https://docs.z.ai/guides/overview/pricing",
      "pricingCheckedAt": "2026-09-08",
      "pricingCurrency": "USD",
      "pricingTier": "Z.AI standard API token pricing",
      "pricingNotes": "Standard direct Z.ai rates per million tokens: $1.4 input, $0.26 cached input, $4.4 output. Estimates and observed-token costs use uncached standard rates; cached usage is retained as metadata, not an automatic discount. Cache storage is currently limited-time free; future storage charges, batch discounts, enterprise pricing, taxes and credits are excluded. The inherited latency heuristic is uncalibrated.",
      "inputCostPer1MCents": 140,
      "outputCostPer1MCents": 440,
      "cachedInputCostPer1MCents": 26
    },
    "glm:glm-5.3-flash": {
      "pricingSourceUrl": "https://docs.z.ai/guides/overview/pricing",
      "pricingCheckedAt": "2026-09-08",
      "pricingCurrency": "USD",
      "pricingTier": "Z.AI standard API token pricing",
      "pricingNotes": "Standard direct Z.ai rates per million tokens: $0.15 input, $0.03 cached input, $0.5 output. Estimates and observed-token costs use uncached standard rates; cached usage is retained as metadata, not an automatic discount. Cache storage is currently limited-time free; future storage charges, batch discounts, enterprise pricing, taxes and credits are excluded. The inherited latency heuristic is uncalibrated. Separate temporary promotion: $0.075 input, $0.015 cached input and $0.25 output per million tokens until 2026-09-09T16:00:00Z (September 9 at 24:00 UTC+8). Conservative standard rates apply before and after expiry; no automatic date transition or promotional discount is applied.",
      "inputCostPer1MCents": 15,
      "outputCostPer1MCents": 50,
      "cachedInputCostPer1MCents": 3
    },
    "kimi:kimi-k3": {
      "pricingSourceUrl": "https://platform.kimi.ai/docs/pricing/chat",
      "pricingCheckedAt": "2026-07-24",
      "pricingCurrency": "USD",
      "pricingTier": "Moonshot AI public API token pricing",
      "pricingNotes": "Moonshot AI public pricing lists Kimi K3 at $3/1M cache-miss input tokens, $0.30/1M cache-hit input tokens, and $15/1M output tokens with flat pay-as-you-go rates and no context tiers. AutoShow uses uncached input pricing for estimates. Kimi K3 requires thinking; AutoShow defaults omitted --reasoning-effort to low rather than the provider max, so reused Kimi K2.6 output-token and latency heuristics remain provisional until calibrated. Cache discounts, batch discounts, enterprise pricing, taxes, and provider credits are ignored.",
      "inputCostPer1MCents": 300,
      "cachedInputCostPer1MCents": 30,
      "outputCostPer1MCents": 1500
    },
    "together:kimi-k3": {
      "pricingSourceUrl": "https://docs.together.ai/docs/serverless/models",
      "pricingCheckedAt": "2026-09-08",
      "pricingCurrency": "USD",
      "pricingTier": "Together AI serverless token pricing",
      "pricingNotes": "Together AI lists moonshotai/Kimi-K3 at $3.00/1M input, $0.30/1M cached input and $15.00/1M output tokens. Estimates and observed-token costs use uncached input rates; cached usage is metadata only. Reasoning is included in completion usage, not charged twice. Direct-provider promotions do not apply. Batch discounts, enterprise pricing, taxes and credits are excluded. The inherited latency heuristic is uncalibrated.",
      "inputCostPer1MCents": 300,
      "cachedInputCostPer1MCents": 30,
      "outputCostPer1MCents": 1500
    },
    "together:glm-5.3": {
      "pricingSourceUrl": "https://docs.together.ai/docs/serverless/models",
      "pricingCheckedAt": "2026-09-08",
      "pricingCurrency": "USD",
      "pricingTier": "Together AI serverless token pricing",
      "pricingNotes": "Together AI lists zai-org/GLM-5.3 at $1.40/1M input, $0.26/1M cached input and $4.40/1M output tokens. Estimates and observed-token costs use uncached input rates; cached usage is metadata only. Reasoning is included in completion usage, not charged twice. Direct-provider promotions do not apply. Batch discounts, enterprise pricing, taxes and credits are excluded. The inherited latency heuristic is uncalibrated.",
      "inputCostPer1MCents": 140,
      "cachedInputCostPer1MCents": 26,
      "outputCostPer1MCents": 440
    },
    "together:glm-5.3-flash": {
      "pricingSourceUrl": "https://docs.together.ai/docs/serverless/models",
      "pricingCheckedAt": "2026-09-08",
      "pricingCurrency": "USD",
      "pricingTier": "Together AI serverless token pricing",
      "pricingNotes": "Together AI lists zai-org/GLM-5.3-Flash at $0.15/1M input, $0.03/1M cached input and $0.50/1M output tokens. Estimates and observed-token costs use uncached input rates; cached usage is metadata only. Reasoning is included in completion usage, not charged twice. Direct-provider promotions do not apply. Batch discounts, enterprise pricing, taxes and credits are excluded. The inherited latency heuristic is uncalibrated.",
      "inputCostPer1MCents": 15,
      "cachedInputCostPer1MCents": 3,
      "outputCostPer1MCents": 50
    },
    // Removed from active selection by project decision on 2026-10-18; preserve finished-run pricing.
    'openai:gpt-5.6-sol': {
      pricingSourceUrl: 'https://developers.openai.com/api/docs/models/gpt-5.6-sol',
      pricingCheckedAt: '2026-10-15',
      pricingCurrency: 'USD',
      pricingTier: 'OpenAI API standard token pricing',
      pricingNotes: 'Checked October 15, 2026: GPT-5.6 Sol promotional standard rates are $4/1M input, $0.40/1M cached input and $20/1M output tokens, available at least through November 21, 2026; no later rate is assumed. Above 272K input tokens, the full request uses $8/1M input, $0.80/1M cached input and $30/1M output. Cache writes cost 1.25x uncached input. Estimates use uncached standard rates; cache writes, batch/flex discounts, fast mode, regional uplifts, enterprise pricing, taxes and credits are excluded. The gpt-5.6 alias is not registered separately.',
      inputCostPer1MCents: 400,
      cachedInputCostPer1MCents: 40,
      outputCostPer1MCents: 2000,
      tokenPricingBands: [
        {
          label: 'standard-short-context',
          maxInputTokens: 272000,
          inputCostPer1MCents: 400,
          cachedInputCostPer1MCents: 40,
          outputCostPer1MCents: 2000
        },
        {
          label: 'standard-long-context',
          minInputTokens: 272001,
          inputCostPer1MCents: 800,
          cachedInputCostPer1MCents: 80,
          outputCostPer1MCents: 3000
        }
      ]
    },
    'openai:gpt-5.6-luna': {
      pricingSourceUrl: 'https://developers.openai.com/api/docs/models/gpt-5.6-luna',
      pricingCheckedAt: '2026-08-12',
      pricingCurrency: 'USD',
      pricingTier: 'OpenAI API standard token pricing',
      pricingNotes: 'OpenAI lists GPT-5.6 Luna Standard pricing at $0.20/1M input tokens, $0.02/1M cached input tokens, $0.25/1M cache write tokens, and $1.20/1M output tokens. AutoShow uses uncached standard input/output rates for estimates. Batch, flex, priority, regional uplifts, cached-input discounts, cache-write charges, enterprise pricing, taxes, and provider credits are ignored.',
      inputCostPer1MCents: 20,
      cachedInputCostPer1MCents: 2,
      outputCostPer1MCents: 120,
      tokenPricingBands: [
        {
          label: 'standard-short-context',
          maxInputTokens: 272000,
          inputCostPer1MCents: 20,
          cachedInputCostPer1MCents: 2,
          outputCostPer1MCents: 120
        },
        {
          label: 'standard-long-context',
          minInputTokens: 272001,
          inputCostPer1MCents: 40,
          cachedInputCostPer1MCents: 4,
          outputCostPer1MCents: 180
        }
      ]
    },
    'gemini:gemini-3.7-flash': {
      pricingSourceUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
      pricingCheckedAt: '2026-08-18',
      pricingCurrency: 'USD',
      pricingTier: 'Gemini API paid Standard',
      pricingNotes: 'Google lists Gemini 3.7 Flash Standard pricing at $1.50/1M input tokens and $7.50/1M output tokens effective 2027-01-01, with introductory pricing of $0.75/1M input tokens and $3.75/1M output tokens through 2026-12-31 and no published context tiers. AutoShow conservatively records the standard rates, so estimates overstate cost during the introductory window. Free tier, batch/flex/priority prices, context caching, taxes, and provider credits are ignored.',
      inputCostPer1MCents: 150,
      outputCostPer1MCents: 750
    },
    'anthropic:claude-sonnet-5': {
      pricingSourceUrl: 'https://platform.claude.com/docs/en/about-claude/pricing?hsLang=en',
      pricingCheckedAt: '2026-09-23',
      pricingCurrency: 'USD',
      pricingTier: 'Claude API standard token pricing',
      pricingNotes: 'Anthropic confirms $2/1M input and $10/1M output are now standard Sonnet 5 rates; the previously announced September 1 increase was canceled. Cache reads $0.20/M and cache writes $2.50/M (5m) or $4/M (1h) are not requested or automatically discounted. Published rates are separate from empirical token and latency estimates. Batch, regional premiums, taxes and credits are excluded.',
      inputCostPer1MCents: 200,
      outputCostPer1MCents: 1000
    },
    'anthropic:claude-opus-5': {
      pricingSourceUrl: 'https://platform.claude.com/docs/en/about-claude/pricing?hsLang=en',
      pricingCheckedAt: '2026-07-24',
      pricingCurrency: 'USD',
      pricingTier: 'Claude API standard token pricing',
      pricingNotes: 'Anthropic lists Claude Opus 5 standard token pricing at $5/1M input tokens and $25/1M output tokens. Claude Opus 5 runs with thinking on by default at the default high effort level, so inherited output-token and latency heuristics are provisional. Prompt caching, batch discounts, fast mode, enterprise pricing, taxes, and provider credits are ignored.',
      inputCostPer1MCents: 500,
      outputCostPer1MCents: 2500
    },
    'grok:grok-4.6': {
      pricingSourceUrl: 'https://docs.x.ai/developers/pricing',
      pricingCheckedAt: '2026-08-18',
      pricingCurrency: 'USD',
      pricingTier: 'xAI public Chat API token pricing',
      pricingNotes: 'xAI lists Grok 4.6 standard pricing at $2.00/1M input tokens, $0.50/1M cached input tokens, and $6.00/1M output tokens for requests with up to 200K input tokens. Requests above 200K input tokens cost $4.00/1M input tokens, $1.00/1M cached input tokens, and $12.00/1M output tokens. AutoShow uses uncached standard rates for estimates and switches bands from estimated or observed input tokens. Batch discounts, cached-input discounts, regional differences, enterprise pricing, taxes, and provider credits are ignored.',
      inputCostPer1MCents: 200,
      cachedInputCostPer1MCents: 50,
      outputCostPer1MCents: 600,
      tokenPricingBands: [
        {
          label: 'standard-up-to-200k',
          maxInputTokens: 200000,
          inputCostPer1MCents: 200,
          cachedInputCostPer1MCents: 50,
          outputCostPer1MCents: 600
        },
        {
          label: 'standard-over-200k',
          minInputTokens: 200001,
          inputCostPer1MCents: 400,
          cachedInputCostPer1MCents: 100,
          outputCostPer1MCents: 1200
        }
      ]
    },
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
    'anthropic:claude-fable-5': { inputCostPer1MCents: 1000, outputCostPer1MCents: 5000 },
    'kimi:kimi-k2.6': { inputCostPer1MCents: 95, outputCostPer1MCents: 400 }
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
    'replicate:jaaari/kokoro-82m': { costPerRequestCents: 0.022 },
    'fal:fal-ai/bytedance/seed-speech/tts/v2': { costPer1kCharsCents: 3 },
    'fal:fal-ai/maya': { costPer1kCharsCents: 0.5 },
    'fal:async/tts-pro/v1.0': { costPer1kCharsCents: 1 },
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
    'replicate:bytedance/seedream-4.5': { costPerImageCents: 4 },
    'replicate:qwen/qwen-image-2-pro': { costPerImageCents: 7.5 },
    'replicate:qwen/qwen-image-2': { costPerImageCents: 3.5 },
    'replicate:wan-video/wan-2.7-image-pro': { costPerImageCents: 3 },
    'replicate:wan-video/wan-2.7-image': { costPerImageCents: 3 },
    'fal:microsoft/mai-image-2.5': { costPerImageCents: 0.21 },
    'fal:microsoft/mai-image-2.5-pro': { costPerImageCents: 150 },
    'replicate:ideogram-ai/ideogram-v4-turbo': { costPerImageCents: 3 },
    'replicate:ideogram-ai/ideogram-v4-balanced': { costPerImageCents: 6 },
    'replicate:ideogram-ai/ideogram-v4-quality': { costPerImageCents: 10 },
    'replicate:prunaai/ernie-image': { costPerImageCents: 5.28 },
    'replicate:prunaai/ernie-image-turbo': { costPerImageCents: 1.15 },
    'recraft:recraftv4_1': { costPerImageCents: 4 },
    'recraft:recraftv4_1_utility': { costPerImageCents: 4 },
    'recraft:recraftv4_1_pro': { costPerImageCents: 25 },
    'recraft:recraftv4_1_utility_pro': { costPerImageCents: 25 },
    'fal:reve/2.1': { costPerImageCents: 25 },
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
    'replicate:alibaba/happyhorse-1.0': {
      costPerSecondByResolutionCents: { '720p': 14, '1080p': 28 }
    },
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
    'replicate:runwayml/aleph-2': { baseCostPerSecondCents: 33.6 },
    'replicate:wan-video/wan-2.7-t2v': { baseCostPerSecondCents: 10, costPerSecondByResolutionCents: { '720p': 10, '1080p': 10 } },
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
    },
    'ltx:ltx-2-3-fast': { baseCostPerSecondCents: 6 },
    'ltx:ltx-2-3-pro': { baseCostPerSecondCents: 8 },
    'replicate:kwaivgi/kling-v3-video': {
      costPerSecondByResolutionCents: { '720p': 16.8, '1080p': 22.4, '4k': 42 },
      audioCostPerSecondByResolutionCents: { '720p': 25.2, '1080p': 33.6, '4k': 42 }
    },
    'replicate:kwaivgi/kling-v3-omni-video': {
      costPerSecondByResolutionCents: { '720p': 16.8, '1080p': 22.4, '4k': 42 },
      audioCostPerSecondByResolutionCents: { '720p': 22.4, '1080p': 28, '4k': 42 }
    },
    'replicate:bytedance/seedance-2.0': {
      costPerSecondByResolutionCents: { '480p': 8, '720p': 18, '1080p': 45 },
      videoInputCostPerSecondByResolutionCents: { '480p': 10, '720p': 22, '1080p': 55 }
    },
    'replicate:bytedance/seedance-2.0-fast': {
      costPerSecondByResolutionCents: { '480p': 7, '720p': 15 },
      videoInputCostPerSecondByResolutionCents: { '480p': 8, '720p': 17 }
    },
    'fal:fal-ai/pixverse/c1': { baseCostPerSecondCents: 0.5 }
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
    'openai:gpt-5.6-sol': 'gpt-6.1-sol',
    'openai:gpt-5.6-luna': 'gpt-6-luna',
    'gemini:gemini-3.7-flash': 'gemini-3.8-flash',
    'anthropic:claude-sonnet-5': 'claude-sonnet-5-5',
    'anthropic:claude-opus-5': 'claude-opus-5-5',
    'grok:grok-4.6': 'grok-4.7',
    'gemini:gemini-3.1-flash-lite': 'gemini-3.5-flash-lite'
  },
  llm: {
    'openai:gpt-5.6-sol': 'gpt-6.1-sol',
    'openai:gpt-5.6-luna': 'gpt-6-luna',
    'gemini:gemini-3.7-flash': 'gemini-3.8-flash',
    'anthropic:claude-sonnet-5': 'claude-sonnet-5-5',
    'anthropic:claude-opus-5': 'claude-opus-5-5',
    'grok:grok-4.6': 'grok-4.7',
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
    'replicate:qwen/qwen-image-2': 'alibaba/qwen-image-3',
    'replicate:qwen/qwen-image-2-pro': 'alibaba/qwen-image-3-pro',
    'replicate:wan-video/wan-2.7-image': 'bytedance/seedream-5-lite',
    'replicate:wan-video/wan-2.7-image-pro': 'bytedance/seedream-5-lite',
    'replicate:bytedance/seedream-4.5': 'bytedance/seedream-5-lite',
    'fal:reve/2.1': 'alibaba/qwen-image-3',
    'fal:microsoft/mai-image-2.5': 'alibaba/qwen-image-3',
    'fal:microsoft/mai-image-2.5-pro': 'alibaba/qwen-image-3',
    'replicate:ideogram-ai/ideogram-v4-turbo': 'bytedance/seedream-5-lite',
    'replicate:ideogram-ai/ideogram-v4-balanced': 'bytedance/seedream-5-lite',
    'replicate:ideogram-ai/ideogram-v4-quality': 'bytedance/seedream-5-lite',
    'replicate:prunaai/ernie-image': 'alibaba/qwen-image-3',
    'replicate:prunaai/ernie-image-turbo': 'alibaba/qwen-image-3',
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
    'glm:cogvideox-3': 'ltx-2-5-fast',
    'glm:viduq1-text': 'ltx-2-5-fast',
    'glm:vidu2-image': 'ltx-2-5-fast',
    'glm:vidu2-start-end': 'ltx-2-5-fast',
    'glm:vidu2-reference': 'ltx-2-5-fast',
    'runway:gen4.5': 'ray-3.2',
    'replicate:runwayml/aleph-2': 'grok-imagine-video-1.5',
    'replicate:wan-video/wan-2.7-t2v': 'alibaba/wan-3',
    'replicate:kwaivgi/kling-v3-video': 'pixverse/pixverse-v6',
    'replicate:kwaivgi/kling-v3-omni-video': 'bytedance/seedance-2.5',
    'replicate:bytedance/seedance-2.0': 'bytedance/seedance-2.5',
    'replicate:bytedance/seedance-2.0-fast': 'bytedance/seedance-2.5',
    'grok:grok-imagine-video': 'grok-imagine-video-1.5',
    'ltx:ltx-2-3-fast': 'ltx-2-5-fast',
    'ltx:ltx-2-3-pro': 'ltx-2-5-pro',
    'fal:fal-ai/pixverse/c1': 'minimax/h3',
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
