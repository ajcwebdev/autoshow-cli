import type {
  ExtractionOptions,
  HostedOcrAdapterDescriptor,
  HostedOcrAdapterRequest,
  HostedOcrFallbackOptions,
  HostedExtractOcrEngine,
  HostedOcrService
} from '~/types'
import { hasAnthropicOcr, hasDeepinfraOcr, hasGeminiOcr, hasGlmOcr, hasGrokOcr, hasKimiOcr, hasMistralOcr, hasOpenAIOcr } from './ocr-engine-selection'
import { ANTHROPIC_OCR_LIMIT_SOURCE, ensureAnthropicOcrSetup } from './ocr-services/anthropic-ocr/anthropic-ocr'
import { runAnthropicOcr } from './ocr-services/anthropic-ocr/run-anthropic-ocr'
import { DEEPINFRA_OCR_LIMIT_SOURCE, ensureDeepinfraOcrSetup } from './ocr-services/deepinfra-ocr/deepinfra-ocr'
import { runDeepinfraOcr } from './ocr-services/deepinfra-ocr/run-deepinfra-ocr'
import { GEMINI_OCR_LIMIT_SOURCE, ensureGeminiOcrSetup } from './ocr-services/gemini-ocr/gemini-ocr'
import { runGeminiOcr } from './ocr-services/gemini-ocr/run-gemini-ocr'
import { ensureGlmOcrSetup } from './ocr-services/glm-ocr/glm'
import { runGlmOcr } from './ocr-services/glm-ocr/run-glm-ocr'
import { GROK_OCR_LIMIT_SOURCE, ensureGrokOcrSetup } from './ocr-services/grok-ocr/grok-ocr'
import { runGrokOcr } from './ocr-services/grok-ocr/run-grok-ocr'
import { KIMI_OCR_LIMIT_SOURCE, ensureKimiOcrSetup } from './ocr-services/kimi-ocr/kimi'
import { runKimiOcr } from './ocr-services/kimi-ocr/run-kimi-ocr'
import { ensureMistralOcrSetup } from './ocr-services/mistral-ocr/mistral-ocr'
import { runMistralOcr } from './ocr-services/mistral-ocr/run-mistral-ocr'
import { ensureOpenAIOcrSetup } from './ocr-services/openai-ocr/openai-ocr'
import { runOpenAIOcr } from './ocr-services/openai-ocr/run-openai-ocr'
import { createRenderedPngPageChunk } from './ocr-utils/pdf-chunk-fallback'

const renderedPngPages = (opts: ExtractionOptions): HostedOcrFallbackOptions => ({
  forcePageMode: true,
  createChunk: createRenderedPngPageChunk(opts.dpi, opts.ocrPreparationCache),
  chunkFormat: 'png',
  chunkExtension: 'png'
})

const pageRenderingProviderOptions = (request: HostedOcrAdapterRequest) => ({
  dpi: request.opts.dpi,
  password: request.opts.password,
  outputDir: request.opts.outputDir,
  ocrConcurrency: request.opts.ocrConcurrency,
  ocrConcurrencyMode: request.opts.ocrConcurrencyMode,
  hostedOcrScheduler: request.opts.hostedOcrScheduler,
  ocrPreparationCache: request.opts.ocrPreparationCache,
  onRetryable: request.onRetryable,
  documentPageNumber: request.pageNumber,
  reasoningEffort: request.opts.reasoningEffort
})

const tokenUsage = (run: { promptTokens?: number | undefined, completionTokens?: number | undefined }) => ({
  ...(typeof run.promptTokens === 'number' ? { promptTokens: run.promptTokens } : {}),
  ...(typeof run.completionTokens === 'number' ? { completionTokens: run.completionTokens } : {})
})

export const HOSTED_OCR_ADAPTERS: readonly HostedOcrAdapterDescriptor[] = [
  {
    service: 'mistral',
    engine: 'mistral-ocr',
    label: 'Mistral OCR',
    limitSource: 'https://docs.mistral.ai/api/endpoint/ocr',
    directImageFormats: ['png', 'jpg', 'tif'],
    directImageSupportError: 'The Mistral OCR provider sends PDF and PNG/JPG/TIF images to Mistral directly. AutoShow normalizes WEBP/GIF/BMP images locally with Bun.Image.',
    selectModel: (opts) => hasMistralOcr(opts) ? opts.mistralOcrModel as string : undefined,
    ensureSetup: ensureMistralOcrSetup,
    request: async ({ inputPath, inputMetadata, ocrModel, onRetryable }) => {
      const run = await runMistralOcr(inputPath, inputMetadata, ocrModel, { onRetryable })
      return {
        pages: run.pages,
        extractionMethod: run.extractionMethod,
        ocrService: 'mistral',
        ocrModel
      }
    }
  },
  {
    service: 'glm',
    engine: 'glm-ocr',
    label: 'GLM OCR',
    limitSource: 'https://docs.z.ai/api-reference/tools/layout-parsing.md',
    directImageFormats: ['png', 'jpg'],
    directImageSupportError: 'The GLM OCR provider sends PNG/JPG images to GLM directly; PDF pages are rendered to PNG. AutoShow normalizes WEBP/GIF/BMP images locally with Bun.Image. Install ImageMagick so AutoShow can normalize TIF images automatically.',
    selectModel: (opts) => hasGlmOcr(opts) ? opts.glmOcrModel as string : undefined,
    ensureSetup: ensureGlmOcrSetup,
    request: async ({ inputPath, inputMetadata, ocrModel, opts, onRetryable }) => {
      const run = await runGlmOcr(inputPath, inputMetadata, ocrModel, {
        onRetryable,
        reasoningEffort: opts.reasoningEffort
      })
      return {
        pages: run.pages,
        extractionMethod: run.extractionMethod,
        ocrService: 'glm',
        ocrModel,
        canonicalText: run.markdown,
        ...(typeof run.totalPages === 'number' ? { totalPages: run.totalPages } : {}),
        ...tokenUsage(run)
      }
    }
  },
  {
    service: 'kimi',
    engine: 'kimi-ocr',
    label: 'Kimi OCR',
    limitSource: KIMI_OCR_LIMIT_SOURCE,
    directImageFormats: ['png', 'jpg', 'webp', 'gif'],
    directImageSupportError: 'The Kimi OCR provider sends PNG/JPG/WEBP/GIF images to Kimi directly; PDF pages are rendered to PNG. AutoShow normalizes BMP images locally with Bun.Image. Install ImageMagick so AutoShow can normalize TIF images automatically.',
    selectModel: (opts) => hasKimiOcr(opts) ? opts.kimiOcrModel as string : undefined,
    ensureSetup: ensureKimiOcrSetup,
    request: async (request) => {
      const run = await runKimiOcr(request.inputPath, request.inputMetadata, request.ocrModel, pageRenderingProviderOptions(request))
      return {
        pages: run.pages,
        extractionMethod: run.extractionMethod,
        ocrService: 'kimi',
        ocrModel: request.ocrModel,
        totalPages: run.totalPages,
        ...tokenUsage(run)
      }
    },
    fallbackOptions: renderedPngPages
  },
  {
    service: 'openai',
    engine: 'openai-ocr',
    label: 'OpenAI OCR',
    limitSource: 'https://developers.openai.com/api/docs/guides/images-vision.md',
    directImageFormats: ['png', 'jpg', 'webp', 'gif'],
    directImageSupportError: 'The OpenAI OCR provider supports PDF and PNG/JPG/WEBP/GIF images directly. AutoShow normalizes BMP images locally with Bun.Image. Install ImageMagick so AutoShow can normalize TIF images automatically.',
    selectModel: (opts) => hasOpenAIOcr(opts) ? opts.openaiOcrModel as string : undefined,
    ensureSetup: ensureOpenAIOcrSetup,
    request: async ({ inputPath, inputMetadata, ocrModel, opts, onRetryable }) => {
      const run = await runOpenAIOcr(inputPath, inputMetadata, ocrModel, {
        onRetryable,
        reasoningEffort: opts.reasoningEffort
      })
      return {
        pages: run.pages,
        extractionMethod: run.extractionMethod,
        ocrService: 'openai',
        ocrModel,
        totalPages: run.totalPages,
        ...tokenUsage(run)
      }
    }
  },
  {
    service: 'grok',
    engine: 'grok-ocr',
    label: 'Grok OCR',
    limitSource: GROK_OCR_LIMIT_SOURCE,
    directImageFormats: ['png', 'jpg'],
    directImageSupportError: 'The Grok OCR provider sends PNG/JPG images to Grok directly; PDF pages are rendered to PNG. AutoShow normalizes WEBP/GIF/BMP images locally with Bun.Image. Install ImageMagick so AutoShow can normalize TIF images automatically.',
    selectModel: (opts) => hasGrokOcr(opts) ? opts.grokOcrModel as string : undefined,
    ensureSetup: ensureGrokOcrSetup,
    request: async (request) => {
      const run = await runGrokOcr(request.inputPath, request.inputMetadata, request.ocrModel, pageRenderingProviderOptions(request))
      return {
        pages: run.pages,
        extractionMethod: run.extractionMethod,
        ocrService: 'grok',
        ocrModel: request.ocrModel,
        totalPages: run.totalPages,
        ...tokenUsage(run)
      }
    },
    fallbackOptions: renderedPngPages
  },
  {
    service: 'anthropic',
    engine: 'anthropic-ocr',
    label: 'Anthropic OCR',
    limitSource: ANTHROPIC_OCR_LIMIT_SOURCE,
    directImageFormats: ['png', 'jpg', 'webp', 'gif'],
    directImageSupportError: 'The Anthropic OCR provider supports PDF and PNG/JPG/WEBP/GIF images directly. AutoShow normalizes BMP images locally with Bun.Image. Install ImageMagick so AutoShow can normalize TIF images automatically.',
    selectModel: (opts) => hasAnthropicOcr(opts) ? opts.anthropicOcrModel as string : undefined,
    ensureSetup: ensureAnthropicOcrSetup,
    request: async ({ inputPath, inputMetadata, ocrModel, opts, onRetryable }) => {
      const run = await runAnthropicOcr(inputPath, inputMetadata, ocrModel, {
        onRetryable,
        reasoningEffort: opts.reasoningEffort
      })
      return {
        pages: run.pages,
        extractionMethod: run.extractionMethod,
        ocrService: 'anthropic',
        ocrModel,
        totalPages: run.totalPages,
        ...tokenUsage(run)
      }
    }
  },
  {
    service: 'gemini',
    engine: 'gemini-ocr',
    label: 'Gemini OCR',
    limitSource: GEMINI_OCR_LIMIT_SOURCE,
    directImageFormats: ['png', 'jpg', 'webp', 'bmp'],
    directImageSupportError: 'The Gemini OCR provider supports PDF and PNG/JPG/WEBP/BMP images directly. AutoShow normalizes GIF images locally with Bun.Image. Install ImageMagick so AutoShow can normalize TIF images automatically.',
    selectModel: (opts) => hasGeminiOcr(opts) ? opts.geminiOcrModel as string : undefined,
    ensureSetup: ensureGeminiOcrSetup,
    request: async ({ inputPath, inputMetadata, ocrModel, opts, onRetryable, pageNumber }) => {
      const run = await runGeminiOcr(inputPath, inputMetadata, ocrModel, {
        ocrPreparationCache: opts.ocrPreparationCache,
        onRetryable,
        reasoningEffort: opts.reasoningEffort,
        ...(typeof pageNumber === 'number' ? { documentPageNumber: pageNumber } : {})
      })
      return {
        pages: run.pages,
        extractionMethod: run.extractionMethod,
        ocrService: 'gemini',
        ocrModel,
        totalPages: run.totalPages,
        ...tokenUsage(run),
        ...(run.providerUsage && run.providerUsage.length > 0 ? { providerUsage: run.providerUsage } : {})
      }
    },
    fallbackOptions: (opts) => ({
      createChunk: createRenderedPngPageChunk(opts.dpi, opts.ocrPreparationCache),
      chunkFormat: 'png',
      chunkExtension: 'png'
    })
  },
  {
    service: 'deepinfra',
    engine: 'deepinfra-ocr',
    label: 'DeepInfra OCR',
    limitSource: DEEPINFRA_OCR_LIMIT_SOURCE,
    directImageFormats: ['png', 'jpg', 'webp'],
    directImageSupportError: 'The DeepInfra OCR provider sends PNG/JPG/WEBP images to DeepInfra directly; PDF pages are rendered to PNG. AutoShow normalizes GIF/BMP images locally with Bun.Image. Install ImageMagick so AutoShow can normalize TIF images automatically.',
    selectModel: (opts) => hasDeepinfraOcr(opts) ? opts.deepinfraOcrModel as string : undefined,
    ensureSetup: ensureDeepinfraOcrSetup,
    request: async (request) => {
      const run = await runDeepinfraOcr(request.inputPath, request.inputMetadata, request.ocrModel, pageRenderingProviderOptions(request))
      return {
        pages: run.pages,
        extractionMethod: run.extractionMethod,
        ocrService: 'deepinfra',
        ocrModel: request.ocrModel,
        totalPages: run.totalPages,
        ...tokenUsage(run)
      }
    },
    fallbackOptions: renderedPngPages
  }
]

const ADAPTERS_BY_SERVICE = new Map<HostedOcrService, HostedOcrAdapterDescriptor>(
  HOSTED_OCR_ADAPTERS.map((adapter) => [adapter.service, adapter])
)

const ADAPTERS_BY_ENGINE = new Map<HostedExtractOcrEngine, HostedOcrAdapterDescriptor>(
  HOSTED_OCR_ADAPTERS.map((adapter) => [adapter.engine, adapter])
)

export const hostedOcrAdapterForService = (service: HostedOcrService): HostedOcrAdapterDescriptor =>
  ADAPTERS_BY_SERVICE.get(service) as HostedOcrAdapterDescriptor

export const hostedOcrAdapterForEngine = (engine: HostedExtractOcrEngine): HostedOcrAdapterDescriptor =>
  ADAPTERS_BY_ENGINE.get(engine) as HostedOcrAdapterDescriptor
