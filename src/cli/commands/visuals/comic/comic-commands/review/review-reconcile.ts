import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import * as v from 'valibot'
import type { BlockingPlan, ReviewReconcileChange, ReviewReconcileResult, ReviewReconcileSkip, ScenePromptData, StructuredScriptData } from '~/types'
import { BlockingPlanSchema } from '../../schemas/blocking-plan-schemas'
import { ScenePromptDataSchema, StructuredScriptDataSchema } from '../../schemas/schemas'
import { comicLog } from '../../comic-utils/comic-logger'
import { parseJsonFile } from '../../comic-utils/json-prompt-utils'
import { getBlockingPlanPath } from '../../comic-utils/blocking-plan-paths'
import { getSceneJsonPath, getStructuredScriptPath } from '../../comic-utils/project-paths'
import { getReviewReconcilePath } from './review-paths'
import { InfraError, ValidationError } from '~/utils/error-handler'

const STAGE = 'comic:reconcile-directives'

const SPLIT_PATTERN = /\b(?:split|splits|splitting|merge|merges|merging|combine|combines|combining)\b/iu

/** A directive targeting "next" cannot be reconciled without a redraft, because no panel is bound to it yet. */
const resolvePanelNumber = (panel: number | 'next'): number | null => panel === 'next' ? null : panel

const normalize = (value: string): string => value.replace(/\s+/gu, ' ').trim().toLowerCase()

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

  const changes: ReviewReconcileChange[] = []
  const skipped: ReviewReconcileSkip[] = []
  const panelsByNumber = new Map(scene.panels.map(panel => [panel.number, panel]))
  const cameraSetupIds = new Set((plan?.cameraSetups ?? []).map(setup => setup.id))
  let sceneChanged = false
  let planChanged = false

  for (const directive of [...staging.camera, ...staging.axisBreaks, ...staging.costume, ...staging.extras]) {
    if (SPLIT_PATTERN.test(directive.text)) {
      throw ValidationError(`Directive "${directive.text}" asks for a panel split or merge, which --reconcile-from-directives cannot apply; re-run the scene stage to redraft the panels.`, { stage: STAGE })
    }
  }

  for (const directive of staging.camera) {
    const panelNumber = resolvePanelNumber(directive.panel)
    const panel = panelNumber === null ? undefined : panelsByNumber.get(panelNumber)
    if (!panel) {
      skipped.push({ kind: 'camera', panelNumber, reason: panelNumber === null ? 'the directive targets "next" instead of a bound panel number' : `metadata/scene.json has no panel ${panelNumber}` })
      continue
    }
    const named = [...cameraSetupIds].find(id => normalize(directive.text).includes(normalize(id)))
    if (named && panel.blocking) {
      if (panel.blocking.cameraSetupId === named) {
        skipped.push({ kind: 'camera', panelNumber, reason: `panel ${panelNumber} already uses camera setup "${named}"` })
        continue
      }
      changes.push({ kind: 'camera', panelNumber, target: `panels[${panelNumber}].blocking.cameraSetupId`, before: panel.blocking.cameraSetupId, after: named, detail: directive.text })
      panel.blocking = { ...panel.blocking, cameraSetupId: named }
      sceneChanged = true
      continue
    }
    const note = `Reviewer camera note: ${directive.text}`
    if (panel.shotPlan.includes(note)) {
      skipped.push({ kind: 'camera', panelNumber, reason: `panel ${panelNumber} shot plan already carries this note` })
      continue
    }
    changes.push({ kind: 'camera', panelNumber, target: `panels[${panelNumber}].shotPlan`, before: panel.shotPlan, after: `${panel.shotPlan} ${note}`, detail: named ? `camera setup "${named}" named but the panel carries no blocking citation` : 'no existing camera setup id was named' })
    panel.shotPlan = `${panel.shotPlan} ${note}`
    sceneChanged = true
  }

  for (const directive of staging.axisBreaks) {
    const panelNumber = resolvePanelNumber(directive.panel)
    const panel = panelNumber === null ? undefined : panelsByNumber.get(panelNumber)
    if (!panel) {
      skipped.push({ kind: 'axis-break', panelNumber, reason: panelNumber === null ? 'the directive targets "next" instead of a bound panel number' : `metadata/scene.json has no panel ${panelNumber}` })
      continue
    }
    if (!panel.blocking) {
      skipped.push({ kind: 'axis-break', panelNumber, reason: `panel ${panelNumber} carries no blocking citation, so there is no axisBreak field to set` })
      continue
    }
    const sourceSegmentId = directive.afterSegmentId ?? panel.sourceSegmentIds[0]
    if (!sourceSegmentId) {
      skipped.push({ kind: 'axis-break', panelNumber, reason: `panel ${panelNumber} has no source segment to cite for the axis break` })
      continue
    }
    const before = panel.blocking.axisBreak ? `${panel.blocking.axisBreak.sourceSegmentId}: ${panel.blocking.axisBreak.reason}` : 'null'
    const after = `${sourceSegmentId}: ${directive.text}`
    if (before === after) {
      skipped.push({ kind: 'axis-break', panelNumber, reason: `panel ${panelNumber} already declares this axis break` })
      continue
    }
    changes.push({ kind: 'axis-break', panelNumber, target: `panels[${panelNumber}].blocking.axisBreak`, before, after, detail: directive.text })
    panel.blocking = { ...panel.blocking, axisBreak: { sourceSegmentId, reason: directive.text } }
    sceneChanged = true
  }

  for (const directive of staging.costume) {
    if (!plan) {
      skipped.push({ kind: 'costume', panelNumber: null, reason: 'the scene has no metadata/blocking-plan.json, so there is no wardrobe field to update' })
      continue
    }
    const key = normalize(directive.character)
    const state = plan.stageStates.find(candidate => candidate.characters.some(mark => normalize(mark.characterKey) === key))
    const mark = state?.characters.find(candidate => normalize(candidate.characterKey) === key)
    if (!state || !mark) {
      skipped.push({ kind: 'costume', panelNumber: null, reason: `no stage state carries a mark for character "${directive.character}"` })
      continue
    }
    const after = mark.wardrobe === 'canonical' ? directive.text : `${mark.wardrobe}; ${directive.text}`
    if (mark.wardrobe.includes(directive.text)) {
      skipped.push({ kind: 'costume', panelNumber: null, reason: `stage state "${state.id}" already records this wardrobe deviation for "${mark.characterKey}"` })
      continue
    }
    changes.push({ kind: 'costume', panelNumber: null, target: `stageStates["${state.id}"].characters["${mark.characterKey}"].wardrobe`, before: mark.wardrobe, after, detail: directive.text })
    mark.wardrobe = after
    planChanged = true
  }

  for (const directive of staging.extras) {
    if (!plan) {
      skipped.push({ kind: 'extras', panelNumber: null, reason: 'the scene has no metadata/blocking-plan.json, so there is no extras region to update' })
      continue
    }
    const key = normalize(directive.group)
    const state = plan.stageStates.find(candidate => candidate.extras.some(region => normalize(region.ensembleKey) === key))
    const region = state?.extras.find(candidate => normalize(candidate.ensembleKey) === key)
    if (!state || !region) {
      skipped.push({ kind: 'extras', panelNumber: null, reason: `no stage state carries an extras region named "${directive.group}"` })
      continue
    }
    const before = `count=${region.count} exclude=[${region.exclude.join(', ')}] props=[${region.props.join(', ')}]`
    const exclude = [...new Set([...region.exclude, ...directive.exclude])]
    const props = region.props.includes(directive.text) || !directive.text.trim() ? region.props : [...region.props, directive.text]
    const count = directive.count ?? region.count
    const after = `count=${count} exclude=[${exclude.join(', ')}] props=[${props.join(', ')}]`
    if (before === after) {
      skipped.push({ kind: 'extras', panelNumber: null, reason: `extras region "${region.ensembleKey}" already matches this directive` })
      continue
    }
    changes.push({ kind: 'extras', panelNumber: null, target: `stageStates["${state.id}"].extras["${region.ensembleKey}"]`, before, after, detail: directive.text })
    region.count = count
    region.exclude = exclude
    region.props = props
    planChanged = true
  }

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
