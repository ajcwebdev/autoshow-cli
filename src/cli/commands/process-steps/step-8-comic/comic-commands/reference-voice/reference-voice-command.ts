import type { CliCommandDefinition } from '~/types'
import { defineCliCommand } from '~/cli/native/native-types'
import { VOICE_SUBCOMMAND_DEFINITIONS, voiceActionName } from '../../../step-4-tts/voice-management/define-voice-command'

const wrapVoiceChild = (definition: CliCommandDefinition): CliCommandDefinition => {
  const action = voiceActionName(definition.name)
  return defineCliCommand({
    name: `comic reference-voice ${action}`,
    description: definition.description,
    ...(definition.parameters ? { parameters: definition.parameters } : {}),
    ...(definition.flags ? { flags: definition.flags } : {}),
    ...(definition.help ? { help: definition.help } : {}),
  }, async (ctx) => {
    await definition.handler({
      ...ctx,
      calledAs: `comic reference-voice ${action}`,
      command: definition,
    })
  })
}

export const referenceVoiceCommandDefinition = defineCliCommand({
  name: 'comic reference-voice',
  description: 'Create, import, audition, approve, and retire durable character voice registrations',
  defaultSubcommand: 'list',
  subcommands: VOICE_SUBCOMMAND_DEFINITIONS.map(wrapVoiceChild),
  help: {
    examples: [
      ['bun autoshow comic reference-voice import hero --provider elevenlabs --model eleven_v3 --voice-id hpp4J3VqNfWAUOO0d1Us --provenance-ref project:casting', 'Register an existing character voice'],
      ['bun autoshow comic reference-voice audition vr_123 --representative-line "We leave at dawn." --price', 'Estimate the canonical audition'],
      ['bun autoshow comic reference-voice approve vr_123 --actor-id editor', 'Approve and promote the audition locally']
    ],
    notes: [
      'This is the comic-native alias of the shared voice management surface. It never generates scene audio.',
      'Each action has its own flags: bun autoshow comic reference-voice <action> --help'
    ]
  }
}, () => {})
