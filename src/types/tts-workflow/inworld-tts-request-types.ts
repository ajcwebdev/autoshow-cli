import type { InworldTtsModel } from '~/types'

export type InworldTtsRequestInput = Readonly<{
  text: string
  voiceId: string
  markups?: readonly string[] | undefined
  model: InworldTtsModel
  steeringPrompt?: string | undefined
}>
