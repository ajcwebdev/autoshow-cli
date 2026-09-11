import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import * as v from 'valibot'
import type { BlockingPlan, ReviewReconcileResult, ScenePromptData, StructuredScriptData } from '~/types'
import { InfraError, ValidationError } from '~/utils/error-handler'
import { getBlockingPlanPath } from '../../comic-utils/blocking-plan-paths'
import { comicLog } from '../../comic-utils/comic-logger'
import { parseJsonFile } from '../../comic-utils/json-prompt-utils'
import { getSceneJsonPath, getStructuredScriptPath } from '../../comic-utils/project-paths'
import { BlockingPlanSchema } from '../../schemas/blocking-plan-schemas'
import { ScenePromptDataSchema, StructuredScriptDataSchema } from '../../schemas/schemas'
import { reconcileAxisBreakDirectives, reconcileCameraDirectives, reconcileCostumeDirectives, reconcileExtrasDirectives } from './review-directive-handlers'
import { getReviewReconcilePath } from './review-paths'

const STAGE = 'comic:reconcile-directives'

const SPLIT_PATTERN = /\b(?:split|splits|splitting|merge|merges|merging|combine|combines|combining)\b/iu

export const reconcileFromDirectives = async (
  options: { sceneSlug: string },
  dependencies: { runId?: (() => string) | undefined; scene?: ScenePromptData | undefined; structuredScript?: StructuredScriptData | undefined; plan?: BlockingPlan | undefined } = {},
): Promise<ReviewReconcileResult> => {
  const sceneJsonPath = getSceneJsonPath(options.sceneSlug)
  if (!dependencies.scene && !existsSync(sceneJsonPath)) {
    throw InfraError(`Scene JSON not found at ${sceneJsonPath}. Run "bun autoshow comic draft-scenes <script-path>" first.`, { stage: STAGE })
  }
  const scene: ScenePromptData = dependencies.scene ?? v.parse(ScenePromptDataSchema, JSON.parse(await Bun.file(sceneJsonPath).text()))
  const structuredScript: StructuredScriptData = dependencies.structuredScript ?? await parseJsonFile(getStructuredScriptPath(options.sceneSlug), StructuredScriptDataSchema)
  const staging = structuredScript.staging
  if (!staging) {
    throw ValidationError('The structured script carries no staging directives; re-run draft-scenes --only structure after adding **CAMERA:**, **BREAK-180:**, **COSTUME:**, or **EXTRAS:** directives to the script.', { stage: STAGE })
  }
  const planPath = getBlockingPlanPath(options.sceneSlug)
  const plan: BlockingPlan | undefined = dependencies.plan ?? (existsSync(planPath) ? v.parse(BlockingPlanSchema, JSON.parse(await Bun.file(planPath).text())) : undefined)

  for (const directive of [...staging.camera, ...staging.axisBreaks, ...staging.costume, ...staging.extras]) {
    if (SPLIT_PATTERN.test(directive.text)) {
      throw ValidationError(`Directive "${directive.text}" asks for a panel split or merge, which --reconcile-from-directives cannot apply; re-run the scene stage to redraft the panels.`, { stage: STAGE })
    }
  }

  const camera = reconcileCameraDirectives(staging, scene, plan)
  const axisBreaks = reconcileAxisBreakDirectives(staging, scene)
  const costume = reconcileCostumeDirectives(staging, plan)
  const extras = reconcileExtrasDirectives(staging, plan)
  const sceneChanged = camera.changed || axisBreaks.changed
  const planChanged = costume.changed || extras.changed
  const changes = [camera, axisBreaks, costume, extras].flatMap(result => result.changes)
  const skipped = [camera, axisBreaks, costume, extras].flatMap(result => result.skipped)

  const runId = dependencies.runId?.() ?? `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
  const logPath = getReviewReconcilePath(options.sceneSlug, runId)
  await mkdir(dirname(logPath), { recursive: true })
  await Bun.write(logPath, `${JSON.stringify({ schemaVersion: 1, runId, sceneSlug: options.sceneSlug, sceneChanged, planChanged, changes, skipped }, null, 2)}\n`)
  if (sceneChanged && !dependencies.scene) await Bun.write(sceneJsonPath, `${JSON.stringify(scene, null, 2)}\n`)
  if (planChanged && plan && !dependencies.plan) await Bun.write(planPath, `${JSON.stringify(plan, null, 2)}\n`)

  comicLog.line('reconcile-from-directives applied', [
    `changes=${changes.length}`,
    `skipped=${skipped.length}`,
    `scene=${sceneChanged ? 'rewritten' : 'unchanged'}`,
    `plan=${planChanged ? 'rewritten' : 'unchanged'}`,
  ])
  if (planChanged) comicLog.line('  Re-run draft-scenes --only panel-prompts to recompile the bundles from the edited plan.')
  return { runId, sceneSlug: options.sceneSlug, sceneChanged, planChanged, changes, skipped, logPath }
}
