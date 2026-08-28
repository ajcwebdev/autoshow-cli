import type { VoiceReferenceManifest } from '~/types'

export type ResolvedVoiceSnapshot = {
  snapshot: VoiceReferenceManifest
  retainedSnapshot: Awaited<ReturnType<typeof import('~/cli/commands/process-steps/step-8-comic/comic-utils/voice-reference-snapshot').loadVoiceReferenceManifest>> | undefined
}
