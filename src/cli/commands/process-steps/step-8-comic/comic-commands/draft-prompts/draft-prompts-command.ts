import { generateJsonPrompt } from '../../comic-utils/json-prompt-utils'
import { err } from '../../comic-utils/comic-logger'
import { InfraError } from '~/utils/error-handler'
import type { DraftPromptsCommandOptions } from '~/types'

export const draftPromptsCommand = async (options: DraftPromptsCommandOptions): Promise<void> => {
  try {
    await generateJsonPrompt(options.sceneSlug)
  } catch (error) {
    err('Draft prompt bundle generation failed:', error instanceof Error ? error.message : String(error))
    throw InfraError('Failed at draft prompt generation step', { stage: 'comic:draft-prompts', cause: error instanceof Error ? error : undefined })
  }
}
