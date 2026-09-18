import type { VoicePromiseContext } from '~/types'

export const ensureVoicePromise = async <T>(
  context: VoicePromiseContext<T> | undefined,
  create: () => Promise<T>
): Promise<T> => {
  if (context?.voicePromise) {
    return await context.voicePromise
  }

  let voicePromise: Promise<T>
  voicePromise = create().catch((error: unknown) => {
    if (context?.voicePromise === voicePromise) {
      context.voicePromise = undefined
    }
    throw error
  })

  if (context) {
    context.voicePromise = voicePromise
  }

  return await voicePromise
}
