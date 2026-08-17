import { err } from '../../comic-utils/comic-logger'
import { generateStructuredScript } from '~/cli/commands/process-steps/step-8-comic/comic-utils/structured-script-utils/generator'
import { InfraError } from '~/utils/error-handler'
import type { StructuredScriptRunStats, StructureScriptsCommandOptions } from '~/types'


export const structureScriptsCommand = async (
  options: StructureScriptsCommandOptions
): Promise<StructuredScriptRunStats> => {
  try {
    return await generateStructuredScript(
      options.scriptPath,
      options.sceneSlug,
      {
        ...(options.llmModel ? { llmModel: options.llmModel } : {}),
        ...(options.concurrencyMode ? { concurrencyMode: options.concurrencyMode } : {}),
        ...(options.hostedConcurrencyCoordinator ? { hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator } : {}),
      }
    )
  } catch (error) {
    err('Structured script generation failed:', error instanceof Error ? error.message : String(error))
    throw InfraError('Failed at structured script generation step', {
      stage: 'comic:structure-scripts',
      ...(error instanceof Error ? { cause: error } : {}),
    })
  }
}
