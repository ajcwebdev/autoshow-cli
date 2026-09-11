import { findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { getOpenAIClientConfig } from '~/cli/commands/text/write/write-services/write-openai/openai-utils'
import type { BlockingPlanRequest, BlockingPlanResponse } from '~/types'
import { InfraError, UsageError } from '~/utils/error-handler'
import { geminiGenerateContent, geminiUserContent } from '~/utils/gemini/gemini-rest'
import { createOpenAIResponse, extractOpenAIResponseText } from '~/utils/openai/openai-client'
import { resolveCredential } from '~/utils/validate/env-utils'

const STAGE = 'comic:blocking-plan'
const dataUrl = async (path: string): Promise<string> => {
  const lower = path.toLowerCase()
  const type = lower.endsWith('.png') ? 'image/png' : lower.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
  return `data:${type};base64,${Buffer.from(await Bun.file(path).arrayBuffer()).toString('base64')}`
}

const imageMimeType = (path: string): string => path.toLowerCase().endsWith('.png') ? 'image/png' : path.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg'

const imageBase64 = async (path: string): Promise<string> => Buffer.from(await Bun.file(path).arrayBuffer()).toString('base64')

export const resolveBlockingPlanProvider = (model: string): 'openai' | 'gemini' => {
  const service = findRegistryServiceForModel('llm', model)
  if (service !== 'openai' && service !== 'gemini') throw UsageError(`Invalid blocking plan model "${model}". The blocking drafter requires an OpenAI or Gemini vision-capable LLM.`)
  return service
}

export const requestBlockingPlanFromProvider = async (request: BlockingPlanRequest): Promise<BlockingPlanResponse> => {
  const service = resolveBlockingPlanProvider(request.model)
  if (service === 'openai') {
    const response = await createOpenAIResponse(getOpenAIClientConfig(), {
      model: request.model,
      input: [{
        role: 'user', content: [
          { type: 'input_text', text: request.prompt },
          ...(await Promise.all(request.imagePaths.map(async path => ({ type: 'input_image', image_url: await dataUrl(path), detail: 'high' })))),
        ]
      }],
      text: { verbosity: 'low', format: { type: 'json_schema', name: request.schemaName, schema: request.jsonSchema, strict: true } },
    })
    const usage = response.usage && typeof response.usage === 'object' ? response.usage as Record<string, unknown> : {}
    const text = extractOpenAIResponseText(response)
    if (!text) throw InfraError('Blocking plan drafter returned no structured text.', { stage: STAGE })
    return {
      text,
      inputTokens: typeof usage['input_tokens'] === 'number' ? usage['input_tokens'] : 0,
      outputTokens: typeof usage['output_tokens'] === 'number' ? usage['output_tokens'] : 0,
      returnedModel: response.model,
    }
  }
  const response = await geminiGenerateContent(resolveCredential('gemini', 'require', { stage: STAGE, description: 'Comic blocking plan drafting' }), {
    model: request.model,
    contents: geminiUserContent([
      { text: request.prompt },
      ...(await Promise.all(request.imagePaths.map(async path => ({ inlineData: { mimeType: imageMimeType(path), data: await imageBase64(path) } })))),
    ]),
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: request.jsonSchema },
  })
  if (!response.text) throw InfraError('Blocking plan drafter returned no structured text.', { stage: STAGE })
  return {
    text: response.text,
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: (response.usageMetadata?.candidatesTokenCount ?? 0) + (response.usageMetadata?.thoughtsTokenCount ?? 0),
  }
}
