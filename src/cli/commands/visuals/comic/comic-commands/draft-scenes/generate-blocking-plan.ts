import { existsSync } from 'node:fs'
import type { GenerateBlockingPlanOptions, GenerateBlockingPlanResult } from '~/types'
import { ValidationError } from '~/utils/error-handler'
import { sha256Bytes } from '~/utils/value-helpers'
import { getBlockingBindingsPath, getBlockingPlanPath } from '../../comic-utils/blocking-plan-paths'
import { comicLog, err } from '../../comic-utils/comic-logger'
import { parseJsonFile } from '../../comic-utils/json-prompt-utils'
import { getSceneJsonPath } from '../../comic-utils/project-paths'
import { ScenePromptDataSchema } from '../../schemas/schemas'
import { acquireGeneratedBlockingPlan, acquireImportedBlockingPlan } from './blocking-draft-acquisition'
import { loadBlockingPlanInputs } from './blocking-draft-inputs'
import { publishBlockingPlan, writeInvalidPlan } from './blocking-draft-publication'

const STAGE = 'comic:blocking-plan'
export { hydrateBlockingPlan } from './blocking-draft-candidates'
export { BLOCKING_PLAN_IMAGE_INPUT_UNITS, BLOCKING_PLAN_MAX_CALLS, BLOCKING_PLAN_OUTPUT_UNITS_PER_CALL } from './blocking-draft-defaults'
export { buildBlockingDrafterPromptFromInputs, collectSceneLocationKeys, estimateBlockingPlanCalls, loadBlockingPlanInputs } from './blocking-draft-inputs'
export { requestBlockingPlanFromProvider, resolveBlockingPlanProvider } from './blocking-draft-provider'

export const generateBlockingPlan = async (sceneSlug: string, options: GenerateBlockingPlanOptions): Promise<GenerateBlockingPlanResult> => {
  const stats: GenerateBlockingPlanResult['stats'] = { filesProcessed: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCachedTokens: 0, totalCost: 0, totalDurationMs: 0 }
  const mode: 'llm' | 'import' = options.importPath ? 'import' : 'llm'
  try {
    const sceneJsonPath = getSceneJsonPath(sceneSlug)
    const sceneExists = existsSync(sceneJsonPath)
    const bind = options.bind ?? sceneExists
    if (bind && !sceneExists) throw ValidationError(`Bind mode requires a reviewed scene JSON at ${sceneJsonPath}`, { stage: STAGE })
    const inputs = await loadBlockingPlanInputs(sceneSlug, { locationPlans: options.locationPlans, requireEstablishingImages: options.requireEstablishingImages ?? mode === 'llm' })
    const scene = bind ? await parseJsonFile(sceneJsonPath, ScenePromptDataSchema) : undefined
    const sceneSha256 = bind ? sha256Bytes(new Uint8Array(await Bun.file(sceneJsonPath).arrayBuffer())) : undefined
    const planPath = getBlockingPlanPath(sceneSlug)
    const bindingsPath = getBlockingBindingsPath(sceneSlug)

    const { plan, bindings, attempts, lastErrors, lastOutput } = mode === 'import'
      ? await acquireImportedBlockingPlan(options, inputs, scene, sceneSha256)
      : await acquireGeneratedBlockingPlan(sceneSlug, options, inputs, scene, sceneSha256, stats)

    if (!plan) {
      const invalidPath = await writeInvalidPlan(sceneSlug, lastOutput, lastErrors)
      comicLog.line(`Saved invalid blocking plan candidate: ${invalidPath}`)
      throw ValidationError(`Blocking plan for ${sceneSlug} failed validation after ${attempts} attempt${attempts === 1 ? '' : 's'}:\n- ${lastErrors.join('\n- ')}`, { stage: STAGE })
    }

    return await publishBlockingPlan({ plan, bindings, planPath, bindingsPath, stats, mode, bind, options, attempts })
  } catch (error) {
    err(`Failed to generate blocking plan for ${sceneSlug}:`, error instanceof Error ? error.message : String(error))
    throw error
  }
}
