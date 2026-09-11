import type { TreatmentPanelRange, TreatmentSource, TreatmentVoicePacing } from '~/types'
import { maxVoiceSwitchesFor } from './treatment-schemas'
import { SCENE_DRAFT_RETRY_HEADER } from '../draft-scenes/scene-draft-defaults'

const EXAMPLE_JSON = `{
  "schemaVersion": 1,
  "title": "Story title from the treatment",
  "sceneTitle": "Name of this scene",
  "styleInstructions": "One paragraph describing the shared visual style of every generated image.",
  "characters": [
    {
      "key": "hero",
      "name": "HERO",
      "aliases": ["Jane Hero", "the hero"],
      "description": "Physical appearance for an illustrator, ending with age and role.",
      "wardrobe": { "colorTokens": ["red jacket", "black boots"], "never": ["helmet"] }
    }
  ],
  "locations": [
    {
      "key": "campfire-clearing",
      "name": "Campfire Clearing",
      "slugline": "EXT. CAMPFIRE CLEARING - NIGHT",
      "aliases": ["the firepit"],
      "specification": "Stable architecture, geometry, fixed features, and palette for an illustrator."
    }
  ],
  "panels": [
    {
      "number": 1,
      "locationKey": "campfire-clearing",
      "panelNote": "What the panel shows, naming every visible character by catalog name.",
      "narration": "Present-tense narrator prose that carries the story.",
      "dialogue": [{ "characterKey": "hero", "line": "A quoted line from the treatment." }],
      "sourceExcerpt": "The treatment sentence or sentences this panel adapts."
    }
  ]
}`

export const buildTreatmentDraftPrompt = (input: {
  source: TreatmentSource
  panelRange: TreatmentPanelRange
  voicePacing: TreatmentVoicePacing
  speakers: readonly string[]
  existingCharacterKeys: readonly string[]
  existingLocationKeys: readonly string[]
}): string => {
  const { minimum, maximum } = input.panelRange
  const countPhrase = minimum === maximum ? `exactly ${minimum}` : `between ${minimum} and ${maximum}`
  const pacingRules = input.voicePacing === 'exclusive'
    ? [
      '- Every panel carries exactly one voice: either `narration` or one speaker\'s `dialogue`, never both. A panel with dialogue sets `narration` to null.',
      `- Group consecutive panels into voice runs so the audience hears one voice for a stretch instead of a flip every panel. A long quoted passage is split across several consecutive dialogue panels, each with its own fresh visual, with no narration panel in between. Keep the total number of voice changes across the script to at most ${maxVoiceSwitchesFor(maximum)}.`,
      '- Narration bridges into and out of a speech run: a narration panel that hands off to a speaker ends by leading into the speech (for example by naming who is about to speak and how), and the narration after a speech run picks up the frame story rather than restating what was said. Narration never summarizes or paraphrases a dialogue line.',
      '- Write narration and dialogue in natural prose casing ("Papa Bear", not "PAPA BEAR"); uppercase catalog names belong only in `panelNote`.',
    ]
    : [
      '- A panel may carry narration, one speaker\'s dialogue, or both; when both appear, the narration must add something the dialogue does not say.',
      '- Write narration and dialogue in natural prose casing ("Papa Bear", not "PAPA BEAR"); uppercase catalog names belong only in `panelNote`.',
    ]
  const speakerRule = input.speakers.length > 0
    ? `- Only these character keys may carry dialogue: ${input.speakers.join(', ')}. When the treatment quotes one of them, put that quote in the panel's \`dialogue\` array verbatim; light trimming to fit the panel is allowed, paraphrasing is not. A long speech may be split across consecutive panels. Quotes from anyone else are folded into narration as reported speech.`
    : '- No character may carry dialogue: every quoted line is folded into narration as reported speech, so every `dialogue` array is empty.'
  const existingCharacters = input.existingCharacterKeys.length > 0
    ? `- Character keys that already exist in the catalog: ${input.existingCharacterKeys.join(', ')}. If the treatment features one of them, reuse that key in panel dialogue and do not redefine it in \`characters\`.`
    : '- The character catalog has no entry for this treatment yet; define every named character who appears in a panel note or speaks.'
  const existingLocations = input.existingLocationKeys.length > 0
    ? `- Location keys that already exist in the catalog: ${input.existingLocationKeys.join(', ')}. Reuse one only when the treatment shows that exact place; otherwise define a new location.`
    : '- The location catalog has no entry for this treatment yet; define every place a panel shows.'

  return [
    '# Adapt a Prose Treatment into a Fixed-Length Comic Script Draft',
    '',
    `Return only schemaVersion 1 treatment draft JSON. Read the treatment below and adapt it into ${countPhrase} comic panels in story order, plus the character and location catalog entries those panels need.`,
    '',
    '## Output contract',
    '',
    '```json',
    EXAMPLE_JSON,
    '```',
    '',
    '## Rules',
    '',
    `- \`panels\` must contain ${countPhrase} entries numbered from 1 in story order. Cover the whole treatment: the opening, every named story beat, and the ending. Every panel shows a new visual moment; break long passages into several panels so no panel carries more than about three sentences of narration or dialogue.`,
    '- `narration` is present-tense, third-person narrator prose that carries the frame story and scene transitions. A listener who hears only the narration and dialogue must be able to follow the plot. Never begin narration with "INT.", "EXT.", "[", or "*". Use null when the panel is carried by dialogue.',
    speakerRule,
    ...pacingRules,
    '- `panelNote` describes only what the panel shows: setting, action, composition, mood, and every visible character named exactly by their catalog `name`. It is one paragraph with no dialogue and no square brackets.',
    '- `locationKey` is the kebab-case key of the place the panel shows. Consecutive panels in the same place share the key; a flashback, a cutaway, or a return switches it.',
    '- `sourceExcerpt` quotes the treatment sentence or sentences the panel adapts.',
    '- `characters` defines every named character who appears in a panel note or speaks. `key` is lowercase kebab-case. `name` is the uppercase screenplay name, for example "PAPA BEAR". `aliases` lists every other way the treatment refers to that person, such as the full name, a nickname, or a title with the name. Aliases must identify exactly one character: a shared surname, a group word, or a role word that fits two people must not be an alias. `description` is physical appearance for an illustrator: age, build, hair, face, skin, expression, clothing, and props, ending with the age and role in the story. `wardrobe.colorTokens` lists two to four short color-plus-garment tokens. `wardrobe.never` lists things that must never appear on that character.',
    '- `locations` defines every place a panel shows. `slugline` is a screenplay slugline in exactly the form "EXT. PLACE - NIGHT" or "INT. PLACE - DAY": the prefix, the place in uppercase with no dash inside it, one " - " separator, then one time word such as DAY, NIGHT, DUSK, DAWN, MORNING, or EVENING. `specification` describes stable architecture, geometry, fixed features, and palette for an illustrator, with no cast, actions, dialogue, or weather.',
    '- `styleInstructions` is one paragraph describing the visual style every generated image shares: medium, line quality, color palette, textures, lighting mood, and what to avoid. Write it like a house-style note in a comic art bible.',
    '- `title` is the story title and `sceneTitle` names this scene. Keys never contain spaces or uppercase letters.',
    existingCharacters,
    existingLocations,
    '',
    '## Treatment',
    '',
    '```text',
    input.source.text.trim(),
    '```',
  ].join('\n')
}

export const appendTreatmentValidationIssues = (basePrompt: string, issues: readonly string[]): string =>
  `${basePrompt}\n\n${SCENE_DRAFT_RETRY_HEADER}\nThe previous treatment draft failed validation. Fix every issue below and return the complete corrected JSON.\n- ${issues.join('\n- ')}`
