import type * as v from 'valibot'
import type { OptionalSttHttpError } from '~/types'

export type GrokWord = NonNullable<v.InferOutput<typeof import('~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/stt-grok/run-grok-stt').GrokSttResponseSchema>['words']>[number]

export type GrokSttHttpError = OptionalSttHttpError<string>
