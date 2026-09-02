import { existsSync } from 'node:fs'
import { basename } from 'node:path'
import type { BlockingLocationPlansRecord, BlockingRebindResult, StructuredScriptData } from '~/types'
import { ValidationError } from '~/utils/error-handler'
import { sha256Bytes } from '~/utils/value-helpers'
import { BlockingPlanSchema } from '../../schemas/blocking-plan-schemas'
import { parseJsonFile } from '../../comic-utils/json-prompt-utils'
import { comicLog, err } from '../../comic-utils/comic-logger'
import { getPreviousStructuredScriptPath, getStructuredScriptPath } from '../../comic-utils/project-paths'
import { getBlockingPlanPath } from '../../comic-utils/blocking-plan-paths'
import { rebindPlanCitations, validateBlockingPlan } from '../../comic-utils/blocking-plan-validation'
import { serializeBlockingPlan } from '../../comic-utils/blocking-plan-compile'
import { loadBlockingPlanInputs } from './generate-blocking-plan'

const STAGE = 'comic:blocking-plan'

export type RebindBlockingPlanResult = BlockingRebindResult & { planPath: string; structuredScriptSha256: string }

export const formatUnresolvedCitation = (item: BlockingRebindResult['unresolved'][number]): string =>
  `${item.path}: segment "${item.sourceSegmentId}" (${item.reason})`

// The structure stage snapshots the script it replaces. Read it defensively: a snapshot written by an
// older CLI, or hand-edited into an unreadable shape, must degrade to "no previous script" rather than
// fail a rebind that can still resolve every citation by content hash.
export const readPreviousStructuredScriptSegments = async (sceneSlug: string): Promise<Pick<StructuredScriptData, 'sourceSegments'> | undefined> => {
  const path = getPreviousStructuredScriptPath(sceneSlug)
  if (!existsSync(path)) return undefined
  try {
    const value: unknown = JSON.parse(await Bun.file(path).text())
    if (!value || typeof value !== 'object') return undefined
    const segments = (value as { sourceSegments?: unknown }).sourceSegments
    if (!Array.isArray(segments)) return undefined
    if (!segments.every(segment => segment && typeof segment === 'object' && typeof (segment as { id?: unknown }).id === 'string' && typeof (segment as { text?: unknown }).text === 'string')) return undefined
    return { sourceSegments: segments as StructuredScriptData['sourceSegments'] }
  } catch {
    return undefined
  }
}

export const rebindBlockingPlan = async (sceneSlug: string, options: { locationPlans?: BlockingLocationPlansRecord | undefined } = {}): Promise<RebindBlockingPlanResult> => {
  try {
    const planPath = getBlockingPlanPath(sceneSlug)
    if (!existsSync(planPath)) throw ValidationError(`Blocking plan not found at ${planPath}. Run "bun autoshow comic draft-scenes <script-path> --only blocking" first.`, { stage: STAGE })
    const structuredScriptPath = getStructuredScriptPath(sceneSlug)
    if (!existsSync(structuredScriptPath)) throw ValidationError(`Structured script not found at ${structuredScriptPath}. Run "bun autoshow comic draft-scenes <script-path> --only structure" first.`, { stage: STAGE })
    const plan = await parseJsonFile(planPath, BlockingPlanSchema)
    const inputs = await loadBlockingPlanInputs(sceneSlug, { locationPlans: options.locationPlans, requireEstablishingImages: false })
    const structuredScriptSha256 = sha256Bytes(new Uint8Array(await Bun.file(structuredScriptPath).arrayBuffer()))
    const previousStructuredScript = await readPreviousStructuredScriptSegments(sceneSlug)
    const result = rebindPlanCitations(plan, inputs.structuredScript, {
      structuredScriptSha256,
      catalog: inputs.catalog,
      ...(previousStructuredScript ? { previousStructuredScript } : {}),
    })
    await Bun.write(planPath, serializeBlockingPlan(result.plan))
    comicLog.line('blocking-plan rebound', [`file=${basename(planPath)}`, `remapped=${result.remapped.length}`, `unresolved=${result.unresolved.length}`])
    if (result.unresolved.length > 0) {
      const snapshotHint = previousStructuredScript
        ? ''
        : ` No ${basename(getPreviousStructuredScriptPath(sceneSlug))} snapshot was available, so a citation whose segment was split or merged could not be recognized; the structure stage writes that snapshot whenever it replaces an existing structured script.`
      throw ValidationError(`Blocking plan rebind for ${sceneSlug} left ${result.unresolved.length} unresolved citation${result.unresolved.length === 1 ? '' : 's'}; fix the citations by hand or re-draft the plan:\n- ${result.unresolved.map(formatUnresolvedCitation).join('\n- ')}${snapshotHint}`, { stage: STAGE })
    }
    const issues = validateBlockingPlan(result.plan, { structuredScript: inputs.structuredScript, locationSpecifications: inputs.locationSpecifications, catalog: inputs.catalog, locationPlans: inputs.locationPlans })
    if (issues.length > 0) {
      throw ValidationError(`Blocking plan for ${sceneSlug} was rebound but no longer validates against the current structured script:\n- ${issues.map(issue => issue.message).join('\n- ')}`, { stage: STAGE })
    }
    return { ...result, planPath, structuredScriptSha256 }
  } catch (error) {
    err(`Failed to rebind blocking plan for ${sceneSlug}:`, error instanceof Error ? error.message : String(error))
    throw error
  }
}
