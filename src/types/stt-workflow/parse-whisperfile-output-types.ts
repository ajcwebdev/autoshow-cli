import type * as v from 'valibot'
import type { WhisperfileJsonOutputSchema } from '~/types'

export type WhisperfileJsonOutput = v.InferOutput<typeof WhisperfileJsonOutputSchema>
