import type { CliCommandContext, CliParameterValues } from '~/types'
import { defineCliCommand } from '~/cli/native/native-types'
import { CLIUsageError } from '~/utils/error-handler'
import { VOICE_SUBCOMMAND_DEFINITIONS, voiceReferenceAliasFlags } from '../../../step-4-tts/voice-management/define-voice-command'

const ACTIONS = ['consent', 'revoke-consent', 'discover', 'import', 'design', 'materialize', 'save-reference', 'audition', 'approve', 'inspect', 'reconcile', 'retire', 'revoke', 'delete', 'status'] as const
const REGISTRATION_ACTIONS = new Set(['audition', 'approve', 'inspect', 'reconcile', 'retire', 'revoke', 'delete'])

const handleReferenceVoice = async (ctx: CliCommandContext): Promise<void> => {
  const action = ctx.parameters['action']
  if (typeof action !== 'string' || !ACTIONS.includes(action as typeof ACTIONS[number])) {
    throw CLIUsageError(`comic reference-voice action must be one of: ${ACTIONS.join(', ')}.`)
  }
  const definition = VOICE_SUBCOMMAND_DEFINITIONS.find(entry => entry.name === `voice ${action}`)
  if (!definition) throw CLIUsageError(`Voice management action ${action} is unavailable.`)
  const identity = ctx.parameters['identity']
  if (action !== 'status' && action !== 'discover' && (typeof identity !== 'string' || !identity.trim())) {
    throw CLIUsageError(`comic reference-voice ${action} requires a character/role key, consent locator, or registration ID.`)
  }
  const resolvedIdentity = typeof identity === 'string' ? identity : ''
  await definition.handler({
    ...ctx,
    calledAs: `comic reference-voice ${action}`,
    command: definition,
    parameters: (REGISTRATION_ACTIONS.has(action)
      ? { registrationId: resolvedIdentity }
      : action === 'status'
        ? {}
        : action === 'discover'
          ? {}
          : action === 'materialize'
            ? { candidateId: resolvedIdentity }
            : action === 'revoke-consent'
              ? { consentRef: resolvedIdentity }
              : { subjectKey: resolvedIdentity }) as CliParameterValues
  })
}

export const referenceVoiceCommandDefinition = defineCliCommand({
  name: 'comic reference-voice',
  description: 'Create, import, audition, approve, reconcile, and retire durable character voice registrations',
  parameters: [
    { key: '<action>', description: `Voice management action: ${ACTIONS.join('|')}` },
    { key: '[identity]', description: 'Character/role key, candidate ID, protected consent locator, or registration ID, depending on the action' }
  ],
  flags: voiceReferenceAliasFlags,
  help: {
    examples: [
      ['bun autoshow comic reference-voice import hero --provider openai --model gpt-4o-mini-tts-2025-12-15 --voice-id cedar --provenance-ref project:casting', 'Register an existing character voice'],
      ['bun autoshow comic reference-voice audition vr_123 --generation-id SHA256 --representative-line "We leave at dawn." --price', 'Estimate the canonical audition'],
      ['bun autoshow comic reference-voice approve vr_123 --generation-id SHA256 --actor-id editor', 'Approve and promote the audition locally']
    ],
    notes: ['This is the comic-native alias of the shared voice management surface. It never generates scene audio.']
  }
}, handleReferenceVoice)
