import type * as v from 'valibot'

export type GrokWord = NonNullable<v.InferOutput<typeof import('~/cli/commands/stt/diarization/stt-grok/run-grok-stt').GrokSttResponseSchema>['words']>[number]
