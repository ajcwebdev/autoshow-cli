export type InworldTtsRequestInput = Readonly<{
  text: string
  voiceId: string
  markups?: readonly string[] | undefined
  model: 'realtime-tts-2'
  steeringPrompt?: string | undefined
}>
