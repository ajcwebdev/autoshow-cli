import type { LumalabsImageModel, LumalabsImageRef, LumalabsOutputFormat, Step5Metadata } from '~/types'
import { UsageError, ValidationError } from '~/utils/error-handler'
import { runImageGeneration } from '~/cli/commands/command-shared/media-generation/image-generation-scaffold'
import { estimateImageCosts, logImageEstimate } from '~/cli/commands/visuals/image/image-utils/image-pricing'
import { downloadGeneratedImage, extractImageErrorMessage, LumalabsGenerationSchema, readJsonOrText, runPolledJob, withImageProviderHeaders } from '~/utils/polled-job-client/polled-job'
import { MEDIA_GENERATION_TIMEOUT_MS } from '~/utils/timeouts'
import { imageReferenceToInlineDataPart, isHttpUrl } from '../../image-utils/image-inputs'
import { getLumalabsBaseUrl } from './lumalabs-image-gen'
import { normalizeImageOutputFormat } from '../../image-utils/image-target-validation'
const POLL_INTERVAL_MS = 5_000
const POLL_TIMEOUT_MS = MEDIA_GENERATION_TIMEOUT_MS

export const LUMALABS_ASPECT_RATIOS = ['16:9', '4:3', '3:2', '1:1', '2:3', '3:4', '9:16', '2:1', '1:2'] as const
export const LUMALABS_OUTPUT_FORMATS = ['png', 'jpeg'] as const

export const normalizeLumalabsAspectRatio = (aspectRatio: string | undefined): string | undefined => {
  if (aspectRatio === undefined || aspectRatio.length === 0) {
    return undefined
  }

  if ((LUMALABS_ASPECT_RATIOS as readonly string[]).includes(aspectRatio)) {
    return aspectRatio
  }

  throw UsageError(`Invalid --aspect-ratio value "${aspectRatio}" for Luma Labs. Supported values: ${LUMALABS_ASPECT_RATIOS.join(', ')}.`)
}

export const normalizeLumalabsImageOutputFormat = (format: string | undefined): LumalabsOutputFormat =>
  normalizeImageOutputFormat(format, {
    allowed: LUMALABS_OUTPUT_FORMATS,
    fallback: 'png',
    providerLabel: 'Luma Labs',
    expected: 'png or jpeg'
  })

export const getLumalabsImageExtension = (format: string | undefined): string => {
  const outputFormat = normalizeLumalabsImageOutputFormat(format)
  return outputFormat === 'jpeg' ? 'jpg' : outputFormat
}

const toImageRef = async (input: string): Promise<LumalabsImageRef> => {
  if (isHttpUrl(input)) {
    return { url: input }
  }
  const inline = (await imageReferenceToInlineDataPart(input)).inlineData
  if (!inline?.data || !inline.mimeType) {
    throw ValidationError(`Unable to read image reference "${input}" for Luma Labs`, { stage: 'image:lumalabs' })
  }
  return { data: inline.data, media_type: inline.mimeType }
}

const extractErrorMessage = (payload: unknown): string | undefined =>
  extractImageErrorMessage(payload, ['failure_reason'])

export const runLumalabsImageGen = async (
  prompt: string,
  outputDir: string,
  options: { model: LumalabsImageModel, aspectRatio?: string | undefined, outputFormat?: string | undefined, inputs?: string[] | undefined }
): Promise<{ imagePaths: string[], metadata: Step5Metadata }> => {
  const aspectRatio = normalizeLumalabsAspectRatio(options.aspectRatio)
  const outputFormat = normalizeLumalabsImageOutputFormat(options.outputFormat)
  const inputs = options.inputs ?? []
  const mode = inputs.length > 0 ? 'edit' : 'generation'

  return await runImageGeneration({
    service: 'lumalabs',
    model: options.model,
    outputDir,
    startDetail: mode,
    prepare: async () => {
      const imageRefs = await Promise.all(inputs.map(toImageRef))
      return {
        estimate: estimateImageCosts({ lumalabsImageModels: [options.model] })[0],
        body: {
          prompt,
          model: options.model,
          output_format: outputFormat,
          ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
          ...(mode === 'edit'
            ? {
              type: 'image_edit',
              source: imageRefs[0],
              ...(imageRefs.length > 1 ? { image_ref: imageRefs.slice(1) } : {})
            }
            : {
              type: 'image',
              ...(imageRefs.length > 0 ? { image_ref: imageRefs } : {})
            })
        } satisfies Record<string, unknown>
      }
    },
    estimate: (prepared) => {
      if (prepared.estimate) {
        logImageEstimate(prepared.estimate)
      }
    },
    execute: async (context, prepared) => {
      const authorization = `Bearer ${context.apiKey}`
      const { result: pollData } = await runPolledJob({
        operationName: 'lumalabs-image-gen',
        intervalMs: POLL_INTERVAL_MS,
        deadlineMs: POLL_TIMEOUT_MS,
        create: {
          url: `${getLumalabsBaseUrl()}/generations`,
          init: withImageProviderHeaders({
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(prepared.body)
          }, { authorization }),
          schema: LumalabsGenerationSchema,
          context: 'Luma Labs image generation create response',
          stage: 'image:lumalabs',
          errorMessage: 'Luma Labs image request failed',
          readResponse: readJsonOrText,
          formatErrorBody: (payload) => extractErrorMessage(payload) ?? 'Unknown error'
        },
        poll: (created) => ({
          url: `${getLumalabsBaseUrl()}/generations/${encodeURIComponent(created.id)}`,
          init: withImageProviderHeaders({ method: 'GET' }, { authorization }),
          schema: LumalabsGenerationSchema,
          context: 'Luma Labs image generation poll response',
          stage: 'image:lumalabs',
          errorMessage: 'Luma Labs image status query failed',
          readResponse: readJsonOrText,
          formatErrorBody: (payload) => extractErrorMessage(payload) ?? 'Unknown error'
        }),
        onPoll: (data) => context.logStatus(data.state),
        isDone: (data) => data.state.toLowerCase() === 'completed',
        isFailed: (data) => {
          if (data.state.toLowerCase() === 'failed') {
            return { failed: true, reason: data.failure_reason ?? data.failure_code ?? 'Unknown error' }
          }
          return { failed: false }
        }
      })

      const resultUrl = pollData.output?.[0]?.url
      if (!resultUrl) {
        throw ValidationError('Luma Labs image generation completed without an output URL', { stage: 'image:lumalabs' })
      }

      const outputPath = context.artifactPath(outputFormat)
      await downloadGeneratedImage({
        url: resultUrl,
        outputPath,
        outputFormat,
        providerLabel: 'Luma Labs',
        stage: 'image:lumalabs',
        operationName: 'lumalabs-image-result-download'
      })

      return {
        artifactPaths: [outputPath],
        metadata: {
          imageWidth: undefined,
          imageHeight: undefined,
          imageFormat: outputFormat,
          requestMode: mode,
          ...(prepared.estimate !== undefined ? {
            providerCostCents: prepared.estimate.totalCost,
            providerCostSource: 'registry_fallback' as const
          } : {})
        }
      }
    }
  })
}
