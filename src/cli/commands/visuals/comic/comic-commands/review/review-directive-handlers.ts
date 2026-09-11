import type { BlockingPlan, ReviewReconcileChange, ReviewReconcileSkip, ScenePromptData, StructuredScriptData } from '~/types'

/** A directive targeting "next" cannot be reconciled without a redraft, because no panel is bound to it yet. */
const resolvePanelNumber = (panel: number | 'next'): number | null => panel === 'next' ? null : panel

const normalize = (value: string): string => value.replace(/\s+/gu, ' ').trim().toLowerCase()

export const reconcileCameraDirectives = (staging: NonNullable<StructuredScriptData['staging']>, scene: ScenePromptData, plan: BlockingPlan | undefined) => {
  const changes: ReviewReconcileChange[] = []
  const skipped: ReviewReconcileSkip[] = []
  let changed = false
  const panelsByNumber = new Map(scene.panels.map(panel => [panel.number, panel]))
  const cameraSetupIds = new Set((plan?.cameraSetups ?? []).map(setup => setup.id))
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
      changed = true
      continue
    }
    const note = `Reviewer camera note: ${directive.text}`
    if (panel.shotPlan.includes(note)) {
      skipped.push({ kind: 'camera', panelNumber, reason: `panel ${panelNumber} shot plan already carries this note` })
      continue
    }
    changes.push({ kind: 'camera', panelNumber, target: `panels[${panelNumber}].shotPlan`, before: panel.shotPlan, after: `${panel.shotPlan} ${note}`, detail: named ? `camera setup "${named}" named but the panel carries no blocking citation` : 'no existing camera setup id was named' })
    panel.shotPlan = `${panel.shotPlan} ${note}`
    changed = true
  }

  return { changed, changes, skipped }
}

export const reconcileAxisBreakDirectives = (staging: NonNullable<StructuredScriptData['staging']>, scene: ScenePromptData) => {
  const changes: ReviewReconcileChange[] = []
  const skipped: ReviewReconcileSkip[] = []
  let changed = false
  const panelsByNumber = new Map(scene.panels.map(panel => [panel.number, panel]))
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
    changed = true
  }

  return { changed, changes, skipped }
}

export const reconcileCostumeDirectives = (staging: NonNullable<StructuredScriptData['staging']>, plan: BlockingPlan | undefined) => {
  const changes: ReviewReconcileChange[] = []
  const skipped: ReviewReconcileSkip[] = []
  let changed = false
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
    changed = true
  }

  return { changed, changes, skipped }
}

export const reconcileExtrasDirectives = (staging: NonNullable<StructuredScriptData['staging']>, plan: BlockingPlan | undefined) => {
  const changes: ReviewReconcileChange[] = []
  const skipped: ReviewReconcileSkip[] = []
  let changed = false
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
    changed = true
  }

  return { changed, changes, skipped }
}
