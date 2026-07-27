import type * as v from 'valibot'
import type { WhisperJsonOutputSchema } from '~/types'

export type WhisperJsonOutput = v.InferOutput<typeof WhisperJsonOutputSchema>
