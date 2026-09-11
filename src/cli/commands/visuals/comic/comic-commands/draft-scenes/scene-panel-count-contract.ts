import type { ScenePanelCountContract, ScenePromptData, StructuredScriptData } from '~/types'
import { ValidationError } from '~/utils/error-handler'
import { STAGE } from './scene-draft-defaults'

export const PANEL_COUNT_SECTION_HEADING = '## Panel count contract'

export const collectPanelNoteSegmentIds = (structuredScript: Pick<StructuredScriptData, 'sourceSegments'>): string[] =>
  structuredScript.sourceSegments.filter(segment => segment.type === 'panel-note').map(segment => segment.id)

export const buildPanelCountContract = (structuredScript: Pick<StructuredScriptData, 'sourceSegments'>, panelCount: number, structuredScriptPath = 'metadata/structured-script.json'): ScenePanelCountContract => {
  const panelNoteSegmentIds = collectPanelNoteSegmentIds(structuredScript)
  if (panelNoteSegmentIds.length > 0 && panelNoteSegmentIds.length !== panelCount) {
    throw ValidationError(`--panel-count ${panelCount} does not match the ${panelNoteSegmentIds.length} authored [Panel N] note${panelNoteSegmentIds.length === 1 ? '' : 's'} in ${structuredScriptPath}; edit the script or the count before drafting the scene.`, { stage: STAGE })
  }
  return { panelCount, panelNoteSegmentIds }
}

export const appendPanelCountSection = (prompt: string, contract: ScenePanelCountContract): string => {
  const lines = [
    PANEL_COUNT_SECTION_HEADING,
    '',
    `Return exactly ${contract.panelCount} panels numbered 1 through ${contract.panelCount}. Never merge two authored panels into one or split one authored panel into several; this contract overrides every other panel-splitting rule above except the one-location-per-panel rule, which the authored panels already satisfy.`,
  ]
  if (contract.panelNoteSegmentIds.length > 0) {
    lines.push('', `The script authors one \`[Panel N: ...]\` note per panel. Panel k must cite the k-th authored panel-note segment in \`sourceSegmentIds\`, together with every source segment that follows it up to the next panel note: ${contract.panelNoteSegmentIds.map((segmentId, index) => `panel ${index + 1} cites ${segmentId}`).join('; ')}.`)
  }
  return `${prompt.trimEnd()}\n\n${lines.join('\n')}`
}

export const validatePanelCount = (scene: Pick<ScenePromptData, 'panels'>, contract: ScenePanelCountContract): string[] => {
  const issues: string[] = []
  if (scene.panels.length !== contract.panelCount) {
    issues.push(`Scene JSON has ${scene.panels.length} panel${scene.panels.length === 1 ? '' : 's'}; the panel count contract requires exactly ${contract.panelCount}`)
  }
  contract.panelNoteSegmentIds.forEach((segmentId, index) => {
    const panel = scene.panels[index]
    if (!panel) return
    if (!panel.sourceSegmentIds.includes(segmentId)) {
      issues.push(`Panel ${panel.number} does not cite authored panel-note segment ${segmentId}`)
    }
  })
  return issues
}
