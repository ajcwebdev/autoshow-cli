import type { CliCommandDefinition } from '~/types'
import { DEFAULT_PROVIDER_VOICE_CATALOG_SOURCE, PROVIDER_VOICE_CATALOG_SOURCES } from '~/types/tts-workflow/provider-port-types'
import { defineCliCommand } from '~/cli/native/native-types'
import { boolFlag, formatValueList, strFlag, strListFlag } from '~/cli/flags/flag-utils'
import { handleClone } from './voice-command-clone-handlers'
import { handleConsent, handleImport } from './voice-command-consent-import-handlers'
import { handleDesign } from './voice-command-design-handlers'
import { handleApprove, handleAudition, handleDelete, handleLifecycle, handleList } from './voice-command-lifecycle-handlers'
import { CLONE_PROVIDERS, CONSENT_ACTIONS, DESIGN_PROVIDERS, VOICE_CATALOG_PROVIDERS, VOICE_ORIGINS, VOICE_SYNTHESIS_MODELS, commonRegistrationFlags } from './voice-command-support'

const generationIdFlag = (state: string) => strFlag(`${state} registration generation SHA-256; defaults to the current or unique latest generation, required when ambiguous`)
const modelFlag = (providers: readonly (keyof typeof VOICE_SYNTHESIS_MODELS)[]) => strFlag(`Synthesis model; required for creation, no default. Values: ${providers.map(provider => `${provider}: ${VOICE_SYNTHESIS_MODELS[provider].join('|')}`).join('; ')}`)

const consentCommand = defineCliCommand({
  name: 'voice consent', description: 'Create or revoke a protected consent policy record',
  parameters: [{ key: '[subject-key]', description: 'Canonical character or role key' }],
  flags: {
    'provenance-ref': commonRegistrationFlags['provenance-ref'], allow: strFlag(`Required comma-separated grants: ${CONSENT_ACTIONS.join(',')}; omitted grants remain denied`),
    evidence: strFlag('Optional consent evidence file kept only in the protected store'),
    revoke: strFlag('Protected consent-record locator to revoke'),
    reason: strFlag('Required non-sensitive revocation reason when --revoke is set'),
    'actor-namespace': strFlag('Audit actor namespace: local-user|project-role|automation', 'local-user'),
    'actor-id': strFlag('Required opaque audit actor ID'), price: commonRegistrationFlags.price
  },
  help: { notes: ['Creation requires <subject-key>, --provenance-ref, --allow, and --actor-id. Revocation uses --revoke, --reason, and --actor-id instead of a subject key or --allow.'] }
}, handleConsent)

const importCommand = defineCliCommand({
  name: 'voice import', description: 'Register an existing provider voice without creating a remote resource',
  parameters: [{ key: '<subject-key>', description: 'Canonical character or role key' }],
  flags: {
    ...commonRegistrationFlags, 'voice-id': strFlag('Existing provider voice ID'),
    origin: strFlag(`Voice origin: ${VOICE_ORIGINS.join('|')}`, 'provider-stock'),
    'account-scope-hash': strFlag('Required SHA-256 account scope for account-namespaced voices')
  },
  help: { notes: ['Requires --provider, --model, --voice-id, --provenance-ref, and an existing character voice brief. Account-scoped imports also require --account-scope-hash except when Gemini verifies the account scope.'] }
}, handleImport)

const designCommand = defineCliCommand({
  name: 'voice design', description: 'Generate bounded protected advanced-provider voice candidates or save one selected candidate',
  parameters: [{ key: '[subject-key]', description: 'Canonical character or role key' }],
  flags: {
    provider: strFlag(`Required design provider: ${DESIGN_PROVIDERS.join('|')}; no default`), model: modelFlag(DESIGN_PROVIDERS), profile: commonRegistrationFlags.profile,
    'creation-model': strFlag('Candidate creation model: eleven_ttv_v3|eleven_multilingual_ttv_v2 (ElevenLabs), realtime-tts-2 (Inworld), or the selected Gemini synthesis model (Gemini default; required for other providers)'), description: strFlag('Required voice description: 20-1000 characters (ElevenLabs), 30-250 (Inworld), nonempty (Gemini)'),
    'preview-text': strFlag('Preview passage: 100-1000 characters (ElevenLabs), nonempty (Inworld), optional separate synthesis preview (Gemini)'), candidates: strFlag('Positive candidate count: 1-3 (ElevenLabs/Inworld), 1-20 (Gemini); default: 3 for ElevenLabs, 1 otherwise'), seed: strFlag('Optional non-negative integer seed; ElevenLabs only, omitted by default'),
    'source-voice-id': strFlag('ElevenLabs remix source voice ID'), 'eligibility-snapshot-hash': strFlag('Lowercase SHA-256 required with --source-voice-id for an ElevenLabs remix'),
    save: strFlag('Candidate ID to materialize as a durable provider voice'),
    'subject-key': { ...strFlag('Compatibility alias for positional [subject-key] when --save is set'), help: { hidden: true } },
    'voice-name': strFlag('Desired provider voice name; required during Gemini creation and must match at --save'),
    'provenance-ref': commonRegistrationFlags['provenance-ref'],
    'consent-ref': commonRegistrationFlags['consent-ref'],
    reconcile: boolFlag('Finish an ambiguous save without creating the voice again'),
    price: commonRegistrationFlags.price
  },
  help: { notes: ['Creating candidates requires <subject-key>, --provider, --model, --description, and an existing character voice brief. --save selects a stored candidate and instead requires <subject-key>, --provider, --voice-name, and --provenance-ref; its model comes from the candidate.', '--save cannot be combined with --description, --preview-text, --candidates, --seed, --source-voice-id, or --creation-model. --reconcile requires --save.'] }
}, handleDesign)

const cloneCommand = defineCliCommand({
  name: 'voice clone', description: 'Create a protected consent-gated instant provider voice clone',
  parameters: [{ key: '<subject-key>', description: 'Canonical character or role key' }],
  flags: {
    provider: strFlag(`Required clone provider: ${CLONE_PROVIDERS.join('|')}; no default`), model: modelFlag(CLONE_PROVIDERS), profile: commonRegistrationFlags.profile,
    'consent-audio': strFlag('Separate recorded consent statement required by Gemini replication'),
    'voice-name': strFlag('Desired provider account voice name'),
    sample: strListFlag('Required authorized audio sample: mp3|wav|m4a|mp4|ogg|flac|aac|webm; exactly one for Gemini/Grok, repeatable for ElevenLabs/Inworld'), 'authorization-ref': strFlag('Required opaque authorization record for the clone samples'),
    description: strFlag('Optional provider-safe voice description'), 'consent-ref': commonRegistrationFlags['consent-ref'],
    'provenance-ref': commonRegistrationFlags['provenance-ref'],
    reconcile: boolFlag('Complete an ambiguous provider provisioning journal without recreating the voice'),
    price: commonRegistrationFlags.price,
  },
  help: { notes: ['Requires --provider, --model, --voice-name, --sample, --authorization-ref, --consent-ref, and --provenance-ref. Gemini also requires a separate --consent-audio recording. Consent must explicitly grant upload and new-synthesis.'] },
}, handleClone)

const auditionCommand = defineCliCommand({
  name: 'voice audition', description: 'Synthesize and protect the canonical pre-approval audition set',
  parameters: [{ key: '<registration-id>', description: 'Voice registration ID' }],
  flags: {
    'generation-id': generationIdFlag('Ready draft'),
    'representative-line': strFlag('Required representative script line for the audition set'),
    takes: strFlag('Takes per audition passage (integer 1-5)', '1'), 'max-cents': strFlag('Maximum authorized provider spend in cents, a non-negative number; no additional cap when omitted'),
    approve: boolFlag('Approve the auditioned generation in the same run'),
    'actor-id': strFlag('Opaque approving actor ID when --approve is set'),
    price: commonRegistrationFlags.price
  }
}, handleAudition)

const approveCommand = defineCliCommand({
  name: 'voice approve', description: 'Atomically approve an auditioned registration and make its profile current',
  parameters: [{ key: '<registration-id>', description: 'Voice registration ID' }],
  flags: { 'generation-id': generationIdFlag('Auditioned'), 'actor-id': strFlag('Required opaque approving actor ID'), price: commonRegistrationFlags.price }
}, handleApprove)

const retireCommand = defineCliCommand({
  name: 'voice retire', description: 'Retire or revoke a registration generation and remove it from the current index',
  parameters: [{ key: '<registration-id>', description: 'Voice registration ID' }],
  flags: {
    'generation-id': generationIdFlag('Target'),
    reason: strFlag('Revoke instead of retire and record a non-sensitive reason; omission retires locally'),
    price: commonRegistrationFlags.price
  }
}, handleLifecycle)

const deleteCommand = defineCliCommand({
  name: 'voice delete', description: 'Explicitly delete an eligible project-owned managed voice and tombstone its registration',
  parameters: [{ key: '<registration-id>', description: 'Voice registration ID' }],
  flags: {
    'generation-id': generationIdFlag('Ready'),
    'confirm-voice-id': strFlag('Required exact provider resource ID confirmation'),
    reconcile: boolFlag('Complete an ambiguous provider provisioning journal without recreating the voice'),
    price: commonRegistrationFlags.price
  }
}, handleDelete)

const listCommand = defineCliCommand({
  name: 'voice list', description: 'List the local catalog, one registration, or a provider catalog',
  parameters: [{ key: '[registration-id]', description: 'Voice registration ID' }],
  flags: {
    'generation-id': generationIdFlag('Target'),
    live: boolFlag('Opt-in provider readiness check for one registration'),
    provider: strFlag(`Remote catalog provider: ${VOICE_CATALOG_PROVIDERS.join('|')}; omission lists local registrations`),
    source: strFlag(`Catalog source with --provider: ${formatValueList(PROVIDER_VOICE_CATALOG_SOURCES)}; shared-library is ElevenLabs only`, DEFAULT_PROVIDER_VOICE_CATALOG_SOURCE),
    cursor: strFlag('Opaque provider pagination cursor; requires --provider'),
    reconcile: boolFlag('Complete an ambiguous provider provisioning journal without recreating the voice'),
    price: commonRegistrationFlags.price
  },
  help: { notes: ['With no arguments, lists the local catalog. A registration ID selects local inspection; --live and --reconcile require that ID. --provider selects remote discovery and cannot be combined with a registration ID; --source and --cursor require --provider.'] }
}, handleList)

const voiceExamples = [
      ['bun autoshow voice list', 'Print the local registration catalog and current index'],
      ['bun autoshow voice consent hero --provenance-ref project:casting --allow upload,new-synthesis --actor-id editor --price', 'Validate an explicit consent grant without writing it'],
      ['bun autoshow voice consent --revoke protected-consent:v1:ID --reason "Authorization withdrawn" --actor-id editor --price', 'Validate a consent revocation without writing it'],
      ['bun autoshow voice import hero --provider elevenlabs --model eleven_v3 --voice-id hpp4J3VqNfWAUOO0d1Us --provenance-ref project:casting', 'Register an existing ElevenLabs voice'],
      ['bun autoshow voice list --provider elevenlabs --source account', 'Inspect an ElevenLabs account catalog'],

      ['bun autoshow voice design hero --provider elevenlabs --model eleven_v3 --creation-model eleven_ttv_v3 --description "Warm, weathered guide" --preview-text "The trail opens into a quiet valley at sunrise. Keep your voice warm and steady as you guide the group toward the old wooden bridge ahead." --price', 'Plan ElevenLabs Voice Design v3 without provider calls'],
      ['bun autoshow voice design hero --provider inworld --model realtime-tts-2 --creation-model realtime-tts-2 --description "Warm, weathered guide with a grounded midrange" --preview-text "A representative passage." --price', 'Plan Inworld Voice Design without provider calls'],
      ['bun autoshow voice clone hero --provider elevenlabs --model eleven_v3 --voice-name "Hero" --sample ./hero.wav --authorization-ref project:casting --consent-ref protected-consent:v1:ID --provenance-ref project:casting --price', 'Plan an ElevenLabs clone without provider calls or writes'],

      ['bun autoshow voice design hero --save CANDIDATE_ID --provider elevenlabs --voice-name HeroGuide --provenance-ref project:casting --price', 'Plan saving one selected design candidate without provider calls'],
      ['bun autoshow voice audition vr_123 --generation-id SHA256 --representative-line "We leave at dawn." --price', 'Estimate a canonical audition without provider calls'],
      ['bun autoshow voice approve vr_123 --generation-id SHA256 --actor-id editor', 'Approve an audition locally'],
      ['bun autoshow voice retire vr_123 --generation-id SHA256 --price', 'Plan a local retirement without changing the registration'],
      ['bun autoshow voice delete vr_123 --generation-id SHA256 --confirm-voice-id PROVIDER_VOICE_ID --price', 'Validate deletion eligibility without deleting the provider resource'],
] as const

for (const command of [listCommand, consentCommand, importCommand, designCommand, cloneCommand, auditionCommand, approveCommand, retireCommand, deleteCommand]) {
  command.help = { ...command.help, examples: voiceExamples.filter(([example]) => example.startsWith(`bun autoshow ${command.name} `) || example === `bun autoshow ${command.name}`) }
}

export const VOICE_SUBCOMMAND_DEFINITIONS = [listCommand, consentCommand, importCommand, designCommand, cloneCommand, auditionCommand, approveCommand, retireCommand, deleteCommand] as const satisfies readonly CliCommandDefinition[]

export const voiceActionName = (commandName: string): string =>
  commandName.startsWith('voice ') ? commandName.slice('voice '.length) : commandName

export const VOICE_PUBLIC_ACTIONS = VOICE_SUBCOMMAND_DEFINITIONS.map((entry) => voiceActionName(entry.name))

export const voiceCommand = defineCliCommand({
  name: 'voice', description: 'Manage durable provider voice registrations separately from speech synthesis',
  defaultSubcommand: 'list',
  subcommands: VOICE_SUBCOMMAND_DEFINITIONS,
  help: {
    examples: [
      ['bun autoshow voice list', 'Inspect the local registration catalog'],
      ['bun autoshow voice import --help', 'Register an existing provider voice'],
      ['bun autoshow voice audition --help', 'Audition a registration before approving it'],
    ],
    notes: [
      'Each subcommand has its own flags: bun autoshow voice <subcommand> --help',
      'Voice import and local registration management support all active TTS providers. Remote capabilities are checked per subcommand from the typed voice capability registry.',
      'OpenAI cloning is deferred. tts, write, resume, and synthesis price never create voices.'
    ]
  }
}, async () => {})
