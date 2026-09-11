import type { BlockingBracketNote, BlockingDrafterPromptInputs, BlockingPlan, StructuredScriptData } from '~/types'
import { BLOCKING_ELEVATIONS, BLOCKING_FRAMINGS, BLOCKING_LENSES, BLOCKING_MOVE_TYPES, BLOCKING_POSTURES } from '../schemas/blocking-plan-schemas'
import { cameraHeadingDeg, nearestRegisteredView, round2 } from './blocking-geometry'

export const BLOCKING_DRAFTER_PINNED_SENTENCE = 'A character the script stops mentioning has not left the room: keep every character on stage on the same mark until the script removes them.'

export const SCENE_PLAN_PINNED_SENTENCE = 'The plan\'s stage marks are world truth: characterKeys must contain every on-stage character that the chosen camera sees and nobody who is not on stage, so choose a tighter camera setup rather than omitting people.'

export const BLOCKING_FRAME_CONVENTION = 'Coordinate frame per location: meters. The origin is the canonical establishing camera\'s ground point. +x is screen-right in the canonical establishing image and +y is depth away from the establishing camera. facingDeg is 0 when facing +y (away from the establishing camera), 90 when facing +x (screen-right), 180 when facing -y (toward the establishing camera), and 270 when facing -x. heightM is meters above the deck.'

const FIXED_ANCHOR_SENTENCE_PATTERN = /((?:Fixed (?:features only|visual anchors|anchors|features)|Permanent (?:fixtures|anchors|features))\s*:[^.]*\.)/iu

const BRACKET_NOTE_PATTERN = /^\s*(BLOCKING|CAMERA|AXIS BREAK)\s*:\s*([\s\S]+?)\s*$/iu

export const extractFixedAnchorSentence = (specification: string): string | null => {
  const match = specification.normalize('NFC').replace(/\s+/gu, ' ').match(FIXED_ANCHOR_SENTENCE_PATTERN)
  return match?.[1]?.trim() ?? null
}

export const extractBracketPanelNotes = (structuredScript: Pick<StructuredScriptData, 'sourceSegments'>): BlockingBracketNote[] => {
  const notes: BlockingBracketNote[] = []
  for (const segment of structuredScript.sourceSegments) {
    if (segment.type !== 'panel-note') continue
    const match = segment.text.match(BRACKET_NOTE_PATTERN)
    if (!match?.[1] || !match[2]) continue
    notes.push({ sourceSegmentId: segment.id, kind: match[1].toUpperCase() as BlockingBracketNote['kind'], text: match[2].trim() })
  }
  return notes
}

const formatSegmentLine = (segment: BlockingDrafterPromptInputs['segments'][number]): string => {
  const speaker = segment.speakerLabel ? ` ${segment.speakerLabel}:` : ''
  return `- ${segment.id} (${segment.type}, location ${segment.location.key})${speaker} ${segment.text.replace(/\s+/gu, ' ').trim()}`
}

const formatCharacter = (character: BlockingDrafterPromptInputs['characters'][number]): string => {
  const lines = [`- ${character.key} (${character.name}): ${character.description.replace(/\s+/gu, ' ').trim()}`]
  if (character.aliases && character.aliases.length > 0) lines.push(`  - Aliases: ${character.aliases.join(', ')}`)
  if (character.variantOf) lines.push(`  - Variant of ${character.variantOf}; use this key only when the script puts the base character into this variant state.`)
  for (const cue of character.distinguishFrom ?? []) lines.push(`  - Distinguish from ${cue.characterKey}: ${cue.cue}`)
  if (character.wardrobe) {
    lines.push(`  - Wardrobe tokens: ${character.wardrobe.colorTokens.join('; ')}`)
    if (character.wardrobe.never && character.wardrobe.never.length > 0) lines.push(`  - Never wear: ${character.wardrobe.never.join('; ')}`)
    for (const deviation of character.wardrobe.deviationStates ?? []) lines.push(`  - Wardrobe deviation "${deviation.state}"${deviation.variantKey ? ` (variant key ${deviation.variantKey})` : ''}: ${deviation.description}`)
  }
  return lines.join('\n')
}

const formatLocation = (location: BlockingDrafterPromptInputs['locations'][number]): string => {
  const lines = [`### ${location.key} (${location.name})`]
  if (location.fixedAnchorSentence) lines.push(`Fixed anchors (every anchor key you emit must be a verbatim substring of this specification): ${location.fixedAnchorSentence}`)
  if (location.geometry) {
    lines.push('Reviewed geometry (copy these anchors verbatim, including positions):')
    lines.push('```json')
    lines.push(JSON.stringify({ anchors: location.geometry.anchors, cameraCells: location.geometry.cameraCells ?? [] }, null, 2))
    lines.push('```')
  }
  lines.push(`Specification: ${location.specification.replace(/\s+/gu, ' ').trim()}`)
  return lines.join('\n')
}

const formatBracketNote = (note: BlockingBracketNote): string => `- ${note.sourceSegmentId} [${note.kind}]: ${note.text}`

export const buildBlockingDrafterPrompt = (inputs: BlockingDrafterPromptInputs): string => {
  const sections: string[] = []
  sections.push(`# Draft the scene blocking plan for ${inputs.sceneSlug}${inputs.sceneTitle ? ` ("${inputs.sceneTitle}")` : ''}`)
  sections.push([
    'Return only JSON that matches the supplied blocking plan schema. You are the director of photography and stage manager for one comic scene: decide where every character stands or sits in world space, when that changes, where the reusable cameras are, and where the action axis runs.',
    BLOCKING_FRAME_CONVENTION,
    'The canonical establishing image for each location is supplied as a vision input in the order the locations are listed below. Read the fixed geometry from it and from the specification; never invent anchors that the specification does not name.',
  ].join('\n\n'))
  sections.push([
    '## Rules',
    `- ${BLOCKING_DRAFTER_PINNED_SENTENCE}`,
    '- Every anchor key must be a verbatim case-insensitive substring of that location\'s specification text. List anchors the script removes for this scene under suppressedAnchors with a citation, and temporary dressing the script introduces under dressing.',
    '- Stage states are ordered by script position. Each state starts at the first source segment where its arrangement holds (startsAt cites that segment id) and lists every on-stage character with position, facingDeg, posture, seatAnchorKey (an anchor key or null), and wardrobe ("canonical" unless the script changes it, then a short state text with wardrobeCitation).',
    '- Name every on-stage character at every stage state, including characters who are silent. A new state is needed only when somebody enters, exits, sits, stands, crosses, or turns; list those moves on the new state, each citing a segment that names the moved character.',
    '- Crowds and groups go under extras with an ensembleKey from the catalog, a region rectangle, a count, variety descriptors, exclusions, and props.',
    '- actionAxis names the two principals of the state; leave establishedSide null unless the script fixes a side.',
    '- Camera setups are reusable: a small set with a position, heightM, target point, lens, framing, elevation, and optional overShoulderOf. A camera must not sit inside an anchor footprint. Prefer cameras whose field of view contains exactly the characters a panel needs.',
    `- Postures: ${BLOCKING_POSTURES.join(', ')}. Lenses: ${BLOCKING_LENSES.join(', ')}. Framings: ${BLOCKING_FRAMINGS.join(', ')}. Elevations: ${BLOCKING_ELEVATIONS.join(', ')}. Move types: ${BLOCKING_MOVE_TYPES.join(', ')}.`,
    '- Quoted bracket notes below are authored staging and take precedence over your own inference.',
  ].join('\n'))
  sections.push(['## Locations', ...inputs.locations.map(formatLocation)].join('\n\n'))
  sections.push(['## Character canon', ...inputs.characters.map(formatCharacter)].join('\n'))
  if (inputs.panelNotes && inputs.panelNotes.length > 0) {
    sections.push(['## Authored staging notes (verbatim)', ...inputs.panelNotes.map(formatBracketNote)].join('\n'))
  }
  sections.push(['## Structured script source segments (in order)', ...inputs.segments.map(formatSegmentLine)].join('\n'))
  if (inputs.bindPanels && inputs.bindPanels.length > 0) {
    sections.push([
      '## Bind mode: reviewed panels',
      'A reviewed scene JSON already exists and must not change. For every panel below, choose the camera setup (and optionally the stage state) that matches its shot plan, list croppedOnStage entries for on-stage characters the camera sees but the reviewed characterKeys omit (with a reason), and set axisBreak only when the panel deliberately crosses the action axis, citing one of the panel\'s own source segment ids. Return these under panelBindings, one entry per panel number.',
      ...inputs.bindPanels.map(panel => `- Panel ${panel.number} (location ${panel.locationKey}; characterKeys ${panel.characterKeys.join(', ') || 'none'}; segments ${panel.sourceSegmentIds.join(', ')}): ${panel.shotPlan.replace(/\s+/gu, ' ').trim()}`),
    ].join('\n'))
  }
  if (inputs.validationErrors && inputs.validationErrors.length > 0) {
    sections.push(['## Validation errors from the previous attempt (fix every one)', ...inputs.validationErrors.map(error => `- ${error}`)].join('\n'))
  }
  return `${sections.join('\n\n')}\n`
}

const formatMark = (mark: BlockingPlan['stageStates'][number]['characters'][number]): string =>
  `${mark.characterKey} at (${round2(mark.position.x)}, ${round2(mark.position.y)}) facing ${round2(mark.facingDeg)}° ${mark.posture}${mark.seatAnchorKey ? ` on ${mark.seatAnchorKey}` : ''}${mark.wardrobe !== 'canonical' ? ` wearing ${mark.wardrobe}` : ''}`

export const SCENE_PLAN_SECTION_HEADING = '## Scene blocking plan (authoritative stage marks and cameras)'

export const buildScenePlanSection = (plan: BlockingPlan): string => {
  const lines: string[] = [SCENE_PLAN_SECTION_HEADING]
  lines.push(SCENE_PLAN_PINNED_SENTENCE)
  lines.push('Every panel must cite a `blocking` object with `cameraSetupId` chosen from the camera setups below, `croppedOnStage` entries (with reasons) for on-stage characters the camera sees but the panel deliberately crops out, an optional `stageStateId` when the derived state must be overridden, and `axisBreak` (citing one of the panel\'s own source segment ids) only when the panel deliberately crosses the action axis. A panel\'s stage state is derived from its first source segment unless `stageStateId` overrides it.')
  for (const location of plan.locations) {
    lines.push(`### Location ${location.locationKey}`)
    lines.push(`Anchors: ${location.anchors.map(anchor => `${anchor.key} at (${round2(anchor.position.x)}, ${round2(anchor.position.y)})${anchor.wall ? ` on the ${anchor.wall} wall` : ''}`).join('; ') || 'none'}`)
    if (location.suppressedAnchors.length > 0) lines.push(`Suppressed for this scene: ${location.suppressedAnchors.map(item => `${item.key} (${item.reason})`).join('; ')}`)
    if (location.dressing.length > 0) lines.push(`Temporary dressing: ${location.dressing.map(item => `${item.key} at (${round2(item.position.x)}, ${round2(item.position.y)}): ${item.description}`).join('; ')}`)
  }
  for (const state of plan.stageStates) {
    lines.push(`### Stage state ${state.id} (location ${state.locationKey}, starts at ${state.startsAt.sourceSegmentId})`)
    lines.push(`On stage: ${state.characters.map(formatMark).join('; ') || 'nobody'}`)
    if (state.extras.length > 0) lines.push(`Extras: ${state.extras.map(extras => `${extras.count} ${extras.ensembleKey} in a ${round2(extras.region.width)} by ${round2(extras.region.depth)} m region centered at (${round2(extras.region.x)}, ${round2(extras.region.y)})${extras.exclude.length > 0 ? `, excluding ${extras.exclude.join(', ')}` : ''}`).join('; ')}`)
    if (state.actionAxis) lines.push(`Action axis: ${state.actionAxis.from} to ${state.actionAxis.to}${state.actionAxis.establishedSide ? ` (established camera side: ${state.actionAxis.establishedSide})` : ''}`)
    if (state.dressing) lines.push(`Dressing: ${state.dressing}`)
    if (state.moves.length > 0) lines.push(`Moves into this state: ${state.moves.map(move => `${move.characterKey} ${move.type} (${move.citation.sourceSegmentId})`).join('; ')}`)
  }
  lines.push('### Camera setups')
  for (const camera of plan.cameraSetups) {
    const heading = round2(cameraHeadingDeg(camera))
    lines.push(`- ${camera.id} (location ${camera.locationKey}): ${camera.framing} ${camera.lens} lens, ${camera.elevation} elevation, at (${round2(camera.position.x)}, ${round2(camera.position.y)}) height ${round2(camera.heightM)} m looking toward (${round2(camera.target.x)}, ${round2(camera.target.y)}), heading ${heading}° (nearest registered view: ${nearestRegisteredView(heading)})${camera.overShoulderOf ? `, over the shoulder of ${camera.overShoulderOf}` : ''}`)
  }
  return lines.join('\n')
}
