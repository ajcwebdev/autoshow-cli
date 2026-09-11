import type { CliCommandDefinition } from '~/types'
import { defineCliCommand } from '~/cli/native/native-types'
import { VOICE_SUBCOMMAND_DEFINITIONS, voiceActionName } from '../../../../audio/voice/define-voice-command'
import * as l from '~/utils/app-logger/app-logger'

const wrapVoiceChild = (definition: CliCommandDefinition): CliCommandDefinition => {
  const action = voiceActionName(definition.name)
  return defineCliCommand({
    name: `comic reference-voice ${action}`,
    description: definition.description,
    ...(definition.parameters ? { parameters: definition.parameters } : {}),
    ...(definition.flags ? { flags: definition.flags } : {}),
    help: {
      ...definition.help,
      notes: [
        `Deprecated: use voice ${action}. This alias is retained for one compatibility release.`,
        ...(definition.help?.notes ?? []),
      ],
    },
  }, async (ctx) => {
    l.warn(`comic reference-voice ${action} is deprecated; use voice ${action}.`, { category: 'command' })
    await definition.handler({
      ...ctx,
      calledAs: `comic reference-voice ${action}`,
      command: definition,
    })
  })
}

export const referenceVoiceCommandDefinition = defineCliCommand({
  name: 'comic reference-voice',
  description: 'Deprecated alias of voice; use voice for durable character voice registrations',
  defaultSubcommand: 'list',
  subcommands: VOICE_SUBCOMMAND_DEFINITIONS.map(wrapVoiceChild),
  help: {
    hidden: true,
    examples: [
      ['bun autoshow comic reference-voice import hero --provider elevenlabs --model eleven_v3 --voice-id hpp4J3VqNfWAUOO0d1Us --provenance-ref project:casting', 'Register an existing character voice'],
      ['bun autoshow comic reference-voice audition vr_123 --representative-line "We leave at dawn." --price', 'Estimate the canonical audition'],
      ['bun autoshow comic reference-voice approve vr_123 --actor-id editor', 'Approve and promote the audition locally']
    ],
    notes: [
      'Deprecated: use bun autoshow voice <action>. This alias is retained for one compatibility release and will be removed in a later announced breaking CLI release.',
      'Bare comic reference-voice still runs voice list. Flags, consent rules, and results are unchanged.',
    ]
  }
}, () => {})
