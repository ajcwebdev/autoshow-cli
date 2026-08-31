import type { CliCommandDefinition } from '~/types'
import { defineCliCommand } from '~/cli/native/native-types'
import { boolFlag, strFlag, strListFlag } from '~/cli/flags/flag-utils'
import { handleClone } from './voice-command-clone-handlers'
import { handleConsent, handleImport } from './voice-command-consent-import-handlers'
import { handleDesign } from './voice-command-design-handlers'
import { handleApprove, handleAudition, handleDelete, handleLifecycle, handleList } from './voice-command-lifecycle-handlers'
import { CONSENT_ACTIONS, VOICE_ORIGINS, commonRegistrationFlags } from './voice-command-support'

const consentCommand = defineCliCommand({
  name: 'voice consent', description: 'Create or revoke a protected consent policy record',
  parameters: [{ key: '[subject-key]', description: 'Canonical character or role key' }],
  flags: {
    'provenance-ref': commonRegistrationFlags['provenance-ref'], allow: strFlag(`Comma-separated grants: ${CONSENT_ACTIONS.join(',')}`),
    evidence: strFlag('Optional consent evidence file kept only in the protected store'),
    revoke: strFlag('Protected consent-record locator to revoke'),
    reason: strFlag('Required non-sensitive revocation reason when --revoke is set'),
    'actor-namespace': strFlag('Audit actor namespace: local-user|project-role|automation', 'local-user'),
    'actor-id': strFlag('Opaque audit actor ID'), price: commonRegistrationFlags.price
  }
}, handleConsent)

const importCommand = defineCliCommand({
  name: 'voice import', description: 'Register an existing provider voice without creating a remote resource',
  parameters: [{ key: '<subject-key>', description: 'Canonical character or role key' }],
  flags: {
    ...commonRegistrationFlags, 'voice-id': strFlag('Existing provider voice ID'),
    origin: strFlag(`Voice origin: ${VOICE_ORIGINS.join('|')}`, 'provider-stock'),
    'account-scope-hash': strFlag('Required SHA-256 account scope for account-namespaced voices')
  }
}, handleImport)

const designCommand = defineCliCommand({
  name: 'voice design', description: 'Generate bounded protected advanced-provider voice candidates or save one selected candidate',
  parameters: [{ key: '[subject-key]', description: 'Canonical character or role key' }],
  flags: {
    provider: commonRegistrationFlags.provider, model: commonRegistrationFlags.model, profile: commonRegistrationFlags.profile,
    'creation-model': strFlag('Provider model used only to create candidates'), description: strFlag('Provider voice design/remix description'),
    'preview-text': strFlag('100-1000 character preview passage'), candidates: strFlag('Bounded candidate count'), seed: strFlag('Optional non-negative deterministic seed'),
    'source-voice-id': strFlag('ElevenLabs remix source voice ID'), 'eligibility-snapshot-hash': strFlag('Dated ElevenLabs remix eligibility proof SHA-256'),
    save: strFlag('Candidate ID to materialize as a durable provider voice'),
    'subject-key': strFlag('Canonical character or role key when --save is set'),
    'voice-name': strFlag('Desired provider account voice name when --save is set'),
    'provenance-ref': commonRegistrationFlags['provenance-ref'],
    'consent-ref': commonRegistrationFlags['consent-ref'],
    reconcile: boolFlag('Complete an ambiguous Fish provisioning journal without recreating the voice'),
    price: commonRegistrationFlags.price
  }
}, handleDesign)

const cloneCommand = defineCliCommand({
  name: 'voice clone', description: 'Create a protected consent-gated instant provider voice clone',
  parameters: [{ key: '<subject-key>', description: 'Canonical character or role key' }],
  flags: {
    provider: commonRegistrationFlags.provider, model: commonRegistrationFlags.model, profile: commonRegistrationFlags.profile,
    'voice-name': strFlag('Desired provider account voice name'),
    sample: strListFlag('Authorized local clone sample; repeatable for instant cloning'), 'authorization-ref': strFlag('Opaque authorization record for the clone samples'),
    description: strFlag('Optional provider-safe voice description'), 'consent-ref': commonRegistrationFlags['consent-ref'],
    'provenance-ref': commonRegistrationFlags['provenance-ref'],
    reconcile: boolFlag('Complete an ambiguous provider provisioning journal without recreating the voice'),
    price: commonRegistrationFlags.price,
  },
}, handleClone)

const auditionCommand = defineCliCommand({
  name: 'voice audition', description: 'Synthesize and protect the canonical pre-approval audition set',
  parameters: [{ key: '<registration-id>', description: 'Voice registration ID' }],
  flags: {
    'generation-id': strFlag('Ready draft registration generation SHA-256'),
    'representative-line': strFlag('Representative script line for the audition set'),
    takes: strFlag('Takes per audition passage (1-5)', '1'), 'max-cents': strFlag('Maximum authorized provider spend in cents'),
    approve: boolFlag('Approve the auditioned generation in the same run'),
    'actor-id': strFlag('Opaque approving actor ID when --approve is set'),
    price: commonRegistrationFlags.price
  }
}, handleAudition)

const approveCommand = defineCliCommand({
  name: 'voice approve', description: 'Atomically approve an auditioned registration and make its profile current',
  parameters: [{ key: '<registration-id>', description: 'Voice registration ID' }],
  flags: { 'generation-id': strFlag('Auditioned registration generation SHA-256'), 'actor-id': strFlag('Opaque approving actor ID'), price: commonRegistrationFlags.price }
}, handleApprove)

const retireCommand = defineCliCommand({
  name: 'voice retire', description: 'Retire or revoke a registration generation and remove it from the current index',
  parameters: [{ key: '<registration-id>', description: 'Voice registration ID' }],
  flags: {
    'generation-id': strFlag('Registration generation SHA-256'),
    reason: strFlag('Revoke instead of retire and record a non-sensitive reason'),
    price: commonRegistrationFlags.price
  }
}, handleLifecycle)

const deleteCommand = defineCliCommand({
  name: 'voice delete', description: 'Explicitly delete an eligible project-owned managed voice and tombstone its registration',
  parameters: [{ key: '<registration-id>', description: 'Voice registration ID' }],
  flags: {
    'generation-id': strFlag('Ready registration generation SHA-256'),
    'confirm-voice-id': strFlag('Exact provider resource ID confirmation'),
    'expected-name': strFlag('Exact current Hume voice name required for Hume deletion'),
    reconcile: boolFlag('Complete an ambiguous provider provisioning journal without recreating the voice'),
    price: commonRegistrationFlags.price
  }
}, handleDelete)

const listCommand = defineCliCommand({
  name: 'voice list', description: 'List the local catalog, one registration, or a provider catalog',
  parameters: [{ key: '[registration-id]', description: 'Voice registration ID' }],
  flags: {
    'generation-id': strFlag('Registration generation SHA-256'),
    live: boolFlag('Opt-in provider readiness check for one registration'),
    provider: commonRegistrationFlags.provider,
    source: strFlag('Catalog source: account|provider-library|shared-library', 'account'),
    cursor: strFlag('Opaque provider pagination cursor'),
    reconcile: boolFlag('Complete an ambiguous Fish provisioning journal without recreating the voice'),
    price: commonRegistrationFlags.price
  }
}, handleList)

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
      ['bun autoshow voice list', 'Print the local registration catalog and current index'],
      ['bun autoshow voice import hero --provider elevenlabs --model eleven_v3 --voice-id hpp4J3VqNfWAUOO0d1Us --provenance-ref project:casting', 'Register an existing ElevenLabs voice'],
      ['bun autoshow voice list --provider elevenlabs --source account', 'Inspect an ElevenLabs account catalog'],
      ['bun autoshow voice list --provider cartesia --source provider-library --price', 'Validate Cartesia catalog discovery without provider calls'],
      ['bun autoshow voice design hero --provider elevenlabs --model eleven_v3 --creation-model eleven_ttv_v3 --description "Warm, weathered guide" --preview-text "A representative passage of at least one hundred characters..." --price', 'Plan ElevenLabs Voice Design v3 without provider calls'],
      ['bun autoshow voice design hero --provider inworld --model realtime-tts-2 --creation-model realtime-tts-2 --description "Warm, weathered guide with a grounded midrange" --preview-text "A representative passage." --price', 'Plan Inworld Voice Design without provider calls'],
      ['bun autoshow voice clone hero --provider elevenlabs --model eleven_v3 --voice-name "Hero" --sample ./hero.wav --authorization-ref project:casting --consent-ref protected-consent:v1:ID --provenance-ref project:casting --price', 'Plan an ElevenLabs clone without provider calls or writes'],
      ['bun autoshow voice clone hero --provider cartesia --model sonic-3.5-2026-05-04 --voice-name "Hero" --sample ./hero.wav --authorization-ref project:casting --consent-ref protected-consent:v1:ID --provenance-ref project:casting --price', 'Plan a Cartesia instant clone without provider calls'],
      ['bun autoshow voice clone hero --provider mistral --model voxtral-mini-tts-2603 --voice-name "Hero" --sample ./hero.wav --authorization-ref project:casting --consent-ref protected-consent:v1:ID --provenance-ref project:casting --price', 'Plan a crash-safe Mistral saved-reference clone without provider calls'],
      ['bun autoshow voice clone hero --provider fish --model s2.1-pro --voice-name "Hero" --sample ./hero.wav --authorization-ref project:casting --consent-ref protected-consent:v1:ID --provenance-ref project:casting --price', 'Plan a Fish fast voice-model create without provider calls'],
      ['bun autoshow voice design hero --provider fish --model s2.1-pro --creation-model voice-design-1 --description "Warm, weathered guide" --preview-text "A short representative passage." --candidates 1 --price', 'Plan one Fish Voice Design preview without provider calls'],
      ['bun autoshow voice design --save CANDIDATE_ID --provider elevenlabs --subject-key hero --voice-name HeroGuide --provenance-ref project:casting --price', 'Plan saving one selected design candidate without provider calls'],
      ['bun autoshow voice audition vr_123 --generation-id SHA256 --representative-line "We leave at dawn." --price', 'Estimate a canonical audition without provider calls'],
      ['bun autoshow voice approve vr_123 --generation-id SHA256 --actor-id editor', 'Approve an audition locally']
    ],
    notes: [
      'Each subcommand has its own flags: bun autoshow voice <subcommand> --help',
      'Voice import and local registration management support all active TTS providers. Remote capabilities are checked per subcommand from the typed voice capability registry.',
      'OpenAI cloning is deferred, Speechify cloning requires an unsupported challenge-and-consent workflow, and Hume cloning is completed in the Hume platform before voice import. tts, write, resume, and synthesis price never create voices.'
    ]
  }
}, async () => {})
