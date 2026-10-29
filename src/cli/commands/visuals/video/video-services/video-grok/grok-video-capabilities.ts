import type { GrokVideoModel, VideoMode } from '~/types'
import { UsageError } from '~/utils/error-handler'

export const grokVideoModes = (model: GrokVideoModel): readonly VideoMode[] =>
  model === 'grok-imagine-video-1.5-lite'
    ? ['text', 'image-to-video']
    : ['text', 'image-to-video', 'reference-to-video']

/** Also guard direct adapter callers before credential lookup or paid dispatch. */
export const validateGrokVideoRequest = (model: GrokVideoModel, mode: string, references?: string[]): void => {
  if (!grokVideoModes(model).some(allowed => allowed === mode)) {
    throw UsageError(`--mode ${mode} is not supported by grok/${model}.`)
  }
  if (model === 'grok-imagine-video-1.5-lite' && references?.length) {
    throw UsageError(`--reference-image is not supported by grok/${model}.`)
  }
}
