import type { CharacterCatalogService, LocationReferenceCatalog, StructuredScriptData, TreatmentScriptRenderInput } from '~/types'
import { ValidationError } from '~/utils/error-handler'
import { validateStructuredScriptSourceSpans } from '../../comic-utils/comic-audio-contracts'
import { parseScriptMarkdownToStructuredData } from '../../comic-utils/structured-script-utils/structured-script-parser'
import { validateStructuredScriptCharacters } from '../../schemas/schemas'
import { NARRATION_SPEAKER_LABEL, TREATMENT_METADATA_LABEL, TREATMENT_STAGE } from './treatment-defaults'
import { FORBIDDEN_SPOKEN_START_PATTERN } from './treatment-schemas'

const WRAPPING_QUOTES_PATTERN = /^["'“”‘’«»]+|["'“”‘’«»]+$/g
const LEADING_PARENTHETICAL_PATTERN = /^\([^)]*\)\s*/
const EMPHASIS_EDGE_PATTERN = /^[*_]+|[*_]+$/g

export const collapseWhitespace = (text: string): string => text.replace(/\s+/g, ' ').trim()

export const sanitizePanelNote = (text: string): string => collapseWhitespace(text.replace(/[[\]]/g, ''))

export const sanitizeSpokenText = (text: string, label: string): string => {
  const unquoted = collapseWhitespace(text).replace(WRAPPING_QUOTES_PATTERN, '').trim()
  const value = unquoted.replace(LEADING_PARENTHETICAL_PATTERN, '').replace(EMPHASIS_EDGE_PATTERN, '').trim()
  if (!value) throw ValidationError(`${label} is empty after sanitization`, { stage: TREATMENT_STAGE })
  if (FORBIDDEN_SPOKEN_START_PATTERN.test(value)) {
    throw ValidationError(`${label} must not begin with a slugline, bracket, or emphasis marker: "${value.slice(0, 40)}"`, { stage: TREATMENT_STAGE })
  }
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export const renderTreatmentScript = (input: TreatmentScriptRenderInput): string => {
  const { draft, episode } = input
  const lines: string[] = [
    `# Episode ${episode}: ${collapseWhitespace(draft.title)}`,
    '',
    `**${TREATMENT_METADATA_LABEL}: ${input.sourceDisplayPath}**`,
    '',
    '---',
    '',
    `## Scene 1: ${collapseWhitespace(draft.sceneTitle)}`,
    '',
  ]
  let activeLocation: string | undefined
  for (const panel of draft.panels) {
    const slugline = input.locationSluglines.get(panel.locationKey)
    if (!slugline) throw ValidationError(`Panel ${panel.number} names unknown location "${panel.locationKey}"`, { stage: TREATMENT_STAGE })
    if (panel.locationKey !== activeLocation) {
      lines.push(`**${slugline}**`, '')
      activeLocation = panel.locationKey
    }
    lines.push(`[Panel ${panel.number}: ${sanitizePanelNote(panel.panelNote)}]`, '')
    const narration = panel.narration?.trim()
    if (narration) {
      lines.push(`**${NARRATION_SPEAKER_LABEL}**`, sanitizeSpokenText(narration, `Panel ${panel.number} narration`), '')
    }
    for (const line of panel.dialogue) {
      const name = input.characterNames.get(line.characterKey)
      if (!name) throw ValidationError(`Panel ${panel.number} dialogue names unknown character "${line.characterKey}"`, { stage: TREATMENT_STAGE })
      lines.push(`**${name}**`, sanitizeSpokenText(line.line, `Panel ${panel.number} ${name} line`), '')
    }
  }
  return `${lines.join('\n').trimEnd()}\n`
}

export const selfCheckRenderedScript = (input: {
  rendered: string
  scriptPath: string
  characterCatalog: CharacterCatalogService
  locationCatalog: LocationReferenceCatalog
  panelCount: number
}): StructuredScriptData => {
  const structured = parseScriptMarkdownToStructuredData(input.rendered, input.scriptPath, {
    characterCatalog: input.characterCatalog,
    locationCatalog: input.locationCatalog,
  })
  validateStructuredScriptSourceSpans(structured, input.rendered)
  validateStructuredScriptCharacters(structured, input.characterCatalog)
  const panelNotes = structured.beats.filter(beat => beat.type === 'panel-note')
  if (panelNotes.length !== input.panelCount) {
    throw ValidationError(`Rendered script parsed into ${panelNotes.length} panel notes; expected ${input.panelCount}`, { stage: TREATMENT_STAGE })
  }
  for (const beat of structured.beats) {
    if (beat.type === 'dialogue' && !beat.speakerKey) {
      throw ValidationError(`Rendered dialogue beat ${beat.index} (${beat.speakerLabel ?? 'no label'}) did not resolve to exactly one catalog character`, { stage: TREATMENT_STAGE })
    }
    if (beat.type === 'narration' && beat.speakerLabel !== NARRATION_SPEAKER_LABEL) {
      throw ValidationError(`Rendered narration beat ${beat.index} carries label "${beat.speakerLabel ?? 'none'}" instead of ${NARRATION_SPEAKER_LABEL}`, { stage: TREATMENT_STAGE })
    }
  }
  return structured
}
