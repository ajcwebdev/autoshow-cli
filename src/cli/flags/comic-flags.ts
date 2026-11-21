import { boolFlag, formatProviderList, formatValueList, pickFlags, prefixFlagDescriptions, strFlag, strListFlag, withHelpGroup } from './flag-utils'
import { COMIC_IMAGE_PROVIDER_TARGETS, COMIC_LLM_PROVIDER_TARGETS } from './service-selector-normalization/provider-targets'
import { ttsCommandFlags } from './tts-flags'
import { colorizeHelpDescription } from '~/cli/help-colors'
import { DEFAULT_LLM_MODEL } from '~/cli/commands/visuals/comic/comic-utils/cli-args'
import {
  DEFAULT_TREATMENT_CATALOG_POLICY,
  DEFAULT_TREATMENT_PANEL_COUNT,
  DEFAULT_TREATMENT_SCENE_NUMBER,
  DEFAULT_TREATMENT_VOICE_PACING,
  MAX_TREATMENT_PANEL_COUNT,
  TREATMENT_CATALOG_POLICIES,
  TREATMENT_VOICE_PACINGS
} from '~/cli/commands/visuals/comic/comic-commands/draft-treatment/treatment-defaults'
import {
  DEFAULT_IMAGE_MODEL,
  IMAGE_SIZE_HELP
} from '~/cli/commands/visuals/comic/comic-utils/image-size'
import {
  COMIC_GRID_PANEL_SIZE,
  DEFAULT_FINAL_PANELS_PER_IMAGE,
  DEFAULT_SKETCH_PANELS_PER_IMAGE
} from '~/cli/commands/visuals/comic/comic-commands/generate-images/comic-page-utils'
import { IMAGE_GENERATION_QUALITIES } from '~/types'
import type { CliFlagsDefinition } from '~/types'
import { sharedConcurrencyFlags, stepConcurrencyFlag } from './shared-flags'
import { REFERENCE_LOCATION_ONLY_FLAGS } from './reference-option-contract'
import { COMIC_AUDIO_DELIVERY_POLICIES, COMIC_AUDIO_MODES, COMIC_AUDIO_PACING_PROFILES, COMIC_SOUNDSCAPE_TIMING_POLICIES, DEFAULT_COMIC_AUDIO_DELIVERY_POLICY, DEFAULT_COMIC_AUDIO_MODE, DEFAULT_COMIC_AUDIO_PACING_PROFILE, DEFAULT_COMIC_SOUNDSCAPE_TIMING_POLICY } from './comic-audio-contract'
import { SFX_PROVIDER_FLAG_CHOICES } from '~/cli/commands/audio/tts/soundscape/sfx-provider-targets'
import { DRAFT_SCENES_ONLY_VALUES } from './comic-stage-contract'
import { DEFAULT_IMAGE_QUALITY, DEFAULT_IMAGE_SIZE } from '~/cli/commands/visuals/comic/comic-commands/generate-images/comic-image-run-defaults'

const comicPriceFlag = {
  price: boolFlag(colorizeHelpDescription('Dry run: estimate API cost without making any calls'))
} as const satisfies CliFlagsDefinition

// Comic's task lane is the shared provider lane wearing a generic name; it now uses the shared
// spelling so `--step-concurrency <scope>=N` cannot silently change meaning for comic invocations.
const comicConcurrencyFlag = pickFlags(sharedConcurrencyFlags, ['provider-concurrency', 'concurrency-mode'])

// Comic selects its primary output domain with --provider, exactly like every other command; each
// auxiliary role gets its own --<role>-provider, following the existing --sfx-provider precedent.
const comicImageFlags = {
  provider: {
    description: colorizeHelpDescription(`Exactly one image provider[=model] per run: ${formatProviderList(COMIC_IMAGE_PROVIDER_TARGETS)}; an omitted model selects that provider's cheapest registered model`),
    type: [String] as [StringConstructor],
    default: [`openai=${DEFAULT_IMAGE_MODEL}`]
  },
  size: strFlag(colorizeHelpDescription(`Image size: ${IMAGE_SIZE_HELP}`)),
  quality: strFlag(colorizeHelpDescription(`Image quality: ${IMAGE_GENERATION_QUALITIES.join('|')}; supported values depend on the selected model`))
} as const satisfies CliFlagsDefinition

const generateImagesUnattendedFlags = {
  'stop-on-provider-error': boolFlag(colorizeHelpDescription('Abort the remaining panels on the first provider error instead of continuing; already written attempts are preserved and the run exits non-zero')),
} as const satisfies CliFlagsDefinition

const draftScenesStageFlags = {
  only: strFlag(colorizeHelpDescription(`Run one stage: ${formatValueList(DRAFT_SCENES_ONLY_VALUES)}; prepare builds the structured script and draft prompt locally; default: all stages`)),
  'panel-count': strFlag(colorizeHelpDescription(`Require 1-${MAX_TREATMENT_PANEL_COUNT} panels from the scene stage, one per authored [Panel N] note in order, with one validator retry; default: no fixed count`)),
  provider: strFlag(colorizeHelpDescription(`LLM provider[=model] for scene drafting: ${formatProviderList(COMIC_LLM_PROVIDER_TARGETS)}; an omitted model selects that provider's cheapest registered model; rejected with --only prepare`), `openai=${DEFAULT_LLM_MODEL}`)
} as const satisfies CliFlagsDefinition

export const draftScenesFlags = {
  ...withHelpGroup(draftScenesStageFlags, 'comic-stages'),
  ...withHelpGroup(comicConcurrencyFlag, 'comic-run'),
  ...withHelpGroup(comicPriceFlag, 'pricing')
} as const satisfies CliFlagsDefinition

const draftTreatmentStageFlags = {
  'panel-count': strFlag(colorizeHelpDescription(`Number of panels, an integer from 1-${MAX_TREATMENT_PANEL_COUNT} or an inclusive range such as 20-25`), String(DEFAULT_TREATMENT_PANEL_COUNT)),
  'voice-pacing': strFlag(colorizeHelpDescription(`How narration and dialogue share panels: ${TREATMENT_VOICE_PACINGS.join('|')}; exclusive gives each panel one voice and groups consecutive panels into runs`), DEFAULT_TREATMENT_VOICE_PACING),
  episode: strFlag(colorizeHelpDescription('Two-digit episode number that selects input/scripts/<NN>-script/; defaults to the next unused number')),
  scene: strFlag(colorizeHelpDescription('Two-digit scene prefix for the generated script filename'), DEFAULT_TREATMENT_SCENE_NUMBER),
  slug: strFlag(colorizeHelpDescription('Kebab-case script slug; defaults to the treatment title')),
  speaker: strListFlag(colorizeHelpDescription('Lowercase kebab-case character key whose quoted lines become dialogue instead of narration; repeatable or comma-separated; default: narration only')),
  'style-seed': strFlag(colorizeHelpDescription('PNG filename under the characters root written as every new character\'s generationReference; defaults to <slug>--style-seed.png')),
  'catalog-policy': strFlag(colorizeHelpDescription(`How an existing catalog key is handled: ${TREATMENT_CATALOG_POLICIES.join('|')}`), DEFAULT_TREATMENT_CATALOG_POLICY),
  force: {
    description: colorizeHelpDescription('Overwrite an existing script at the target path'),
    type: Boolean,
    default: false,
    negatable: false
  },
  provider: strFlag(colorizeHelpDescription(`LLM provider[=model] for the treatment drafting call: ${formatProviderList(COMIC_LLM_PROVIDER_TARGETS)}; an omitted model selects that provider's cheapest registered model`), `openai=${DEFAULT_LLM_MODEL}`)
} as const satisfies CliFlagsDefinition

export const draftTreatmentFlags = {
  ...withHelpGroup(draftTreatmentStageFlags, 'comic-treatment'),
  ...withHelpGroup({ 'concurrency-mode': sharedConcurrencyFlags['concurrency-mode'] }, 'comic-run'),
  ...withHelpGroup(comicPriceFlag, 'pricing')
} as const satisfies CliFlagsDefinition

const generateImagesPanelFlags = {
  target: strFlag(colorizeHelpDescription('What to generate: images|sketches|both'), 'images'),
  panels: strFlag(colorizeHelpDescription('Panels to process: all, 1-8, 1,3,7, or 1-4,9; overlong ranges clamp'), 'all'),
  'panels-per-image': strFlag(colorizeHelpDescription(`Positive integer panels per image; overrides both stages (final default: ${DEFAULT_FINAL_PANELS_PER_IMAGE}; sketch default: ${DEFAULT_SKETCH_PANELS_PER_IMAGE})`)),
  grid: strFlag(colorizeHelpDescription(`Compose individual final panels into local page grids as <columns>x<rows>; requires --panels-per-image 1 and --size ${COMIC_GRID_PANEL_SIZE}`))
} as const satisfies CliFlagsDefinition

const generateImagesForceFlag = {
  force: {
    description: colorizeHelpDescription('Regenerate and overwrite image outputs only'),
    type: Boolean,
    short: 'f',
    default: false,
    negatable: false
  }
} as const satisfies CliFlagsDefinition

export const generateImagesFlags = {
  ...withHelpGroup(generateImagesPanelFlags, 'comic-panels'),
  ...withHelpGroup({ provider: comicImageFlags.provider }, 'comic-image'),
  ...withHelpGroup({
    size: strFlag(colorizeHelpDescription(`Image size: ${IMAGE_SIZE_HELP}; default: ${DEFAULT_IMAGE_SIZE}`)),
    quality: strFlag(`${comicImageFlags.quality.description}; default: ${DEFAULT_IMAGE_QUALITY}`),
  }, 'comic-image'),
  ...withHelpGroup(generateImagesUnattendedFlags, 'comic-run'),
  ...withHelpGroup(generateImagesForceFlag, 'comic-run'),
  ...withHelpGroup(comicConcurrencyFlag, 'comic-run'),
  ...withHelpGroup(comicPriceFlag, 'pricing')
} as const satisfies CliFlagsDefinition

const comicAudioSelectionFlags = pickFlags(ttsCommandFlags, [
  'provider',
  'all-providers',
  'provider-concurrency',
  'concurrency-mode',
])

const comicSoundscapeSelectionFlags = {
  'sfx-provider': strFlag(colorizeHelpDescription(`Dedicated sound-effect target as provider=model; accepts ${SFX_PROVIDER_FLAG_CHOICES.join(', ')} and has no hosted default`)),
  'soundscape-timing-policy': strFlag(colorizeHelpDescription(`Inline cue timing: ${formatValueList(COMIC_SOUNDSCAPE_TIMING_POLICIES)}; proportional records its estimate and error bound`), DEFAULT_COMIC_SOUNDSCAPE_TIMING_POLICY),
} as const satisfies CliFlagsDefinition

const comicAudioContractFlags = {
  profile: strFlag(colorizeHelpDescription('Approved casting profile key'), 'default'),
  mode: strFlag(colorizeHelpDescription(`Render strategy: ${formatValueList(COMIC_AUDIO_MODES)}`), DEFAULT_COMIC_AUDIO_MODE),
  'delivery-policy': strFlag(colorizeHelpDescription(`Authored delivery handling: ${formatValueList(COMIC_AUDIO_DELIVERY_POLICIES)}`), DEFAULT_COMIC_AUDIO_DELIVERY_POLICY),
  'pacing-profile': strFlag(colorizeHelpDescription(`Deterministic local dialogue pacing: ${formatValueList(COMIC_AUDIO_PACING_PROFILES)}`), DEFAULT_COMIC_AUDIO_PACING_PROFILE),
  'allow-ambiguous-redispatch': boolFlag(colorizeHelpDescription('Explicitly authorize repurchasing a provider-admitted slot that has no recoverable audio')),
  'max-generation-slots': strFlag(colorizeHelpDescription('Positive integer limit of unresolved immutable slots to generate before checkpointing without a final WAV; default: no slot limit')),
  role: strListFlag(colorizeHelpDescription('Map an uncatalogued or compound speaker label to a logical voice subject, LABEL=role:key or LABEL=voice:key; repeatable')),
  slideshow: boolFlag(colorizeHelpDescription('Automatically render the synchronized still-panel MP4 video upon audio completion')),
} as const satisfies CliFlagsDefinition

export const comicGenerateAudioFlags = {
  ...withHelpGroup(stepConcurrencyFlag(['tts-chunk', 'sfx']), 'comic-run'),
  ...withHelpGroup(comicAudioSelectionFlags, 'provider-selection'),
  ...withHelpGroup(comicSoundscapeSelectionFlags, 'provider-selection'),
  ...withHelpGroup(comicAudioContractFlags, 'comic-audio'),
  ...withHelpGroup(comicPriceFlag, 'pricing'),
} as const satisfies CliFlagsDefinition

const comicPresentationFlags = {
  'audio-target': strFlag(colorizeHelpDescription('Select one complete canonical audio run as provider=model; inferred only when selection is unambiguous')),
  'untimed-panel-ms': strFlag(colorizeHelpDescription('Hold duration in milliseconds for a panel without dialogue or a discrete effect; positive safe integer'), '2000'),
  fps: strFlag(colorizeHelpDescription('Constant output frame rate; integer from 1 through 120'), '30'),
} as const satisfies CliFlagsDefinition

const comicPresentationPriceFlag = {
  price: boolFlag(colorizeHelpDescription('Report the $0 local render cost without provider calls or writes')),
} as const satisfies CliFlagsDefinition

export const comicGenerateSlideshowFlags = {
  ...withHelpGroup(comicPresentationFlags, 'comic-presentation'),
  ...withHelpGroup(comicPresentationPriceFlag, 'pricing'),
} as const satisfies CliFlagsDefinition

const comicReviewInputFlags = {
  run: strFlag(colorizeHelpDescription('Image run ID whose individual panel candidates are shown beside the current selection; reported by comic generate-images')),
  use: boolFlag(colorizeHelpDescription('Adopt the --run candidates as the selected panels; requires --run')),
  panels: strFlag(colorizeHelpDescription('Panels to adopt with --use: all, 1-8, 1,3,7, or 1-4,9; default: all declared scene panels, and a subset run requires an explicit list')),
  'export-doc': boolFlag(colorizeHelpDescription('Also write metadata/review/export-doc.md with one "### Panel NN" heading and image line per panel for a shared document'))
} as const satisfies CliFlagsDefinition

export const comicReviewFlags = {
  ...withHelpGroup(comicReviewInputFlags, 'comic-review')
} as const satisfies CliFlagsDefinition

const referenceSketchSheetFlags = {
  character: strFlag(colorizeHelpDescription('Catalog character key (mutually exclusive with --location)')),
  location: strFlag(colorizeHelpDescription('Canonical location key (mutually exclusive with --character)')),
  view: strFlag(colorizeHelpDescription('Location camera view: establishing|reverse|side'), 'establishing'),
  revise: {
    description: colorizeHelpDescription('Revision mode; requires --notes'),
    type: Boolean,
    short: 'r',
    default: false,
    negatable: false
  },
  notes: strFlag(colorizeHelpDescription('Revision instructions (requires --revise)')),
  'llm-provider': strFlag(colorizeHelpDescription(`LLM provider[=model] used to draft the sheet prompt: ${formatProviderList(COMIC_LLM_PROVIDER_TARGETS)}; an omitted model selects that provider's cheapest registered model`), `openai=${DEFAULT_LLM_MODEL}`)
} as const satisfies CliFlagsDefinition

export const referenceSketchFlags = prefixFlagDescriptions({
  ...withHelpGroup(referenceSketchSheetFlags, 'comic-reference'),
  ...withHelpGroup({
    ...comicImageFlags,
    provider: { ...comicImageFlags.provider, description: colorizeHelpDescription(`Exactly one image provider[=model]: ${formatProviderList(COMIC_IMAGE_PROVIDER_TARGETS)}; an omitted model selects that provider's cheapest registered model`) },
    size: strFlag(colorizeHelpDescription(`Image size: ${IMAGE_SIZE_HELP}; default: 1024x1536 for characters, 1536x1024 for locations`)),
    quality: strFlag(`${comicImageFlags.quality.description}; default: medium for characters, high for locations`),
  }, 'comic-image'),
  ...withHelpGroup(comicConcurrencyFlag, 'comic-run'),
  ...withHelpGroup(comicPriceFlag, 'pricing')
} as const satisfies CliFlagsDefinition, REFERENCE_LOCATION_ONLY_FLAGS, 'Location only: ')
