import type * as v from 'valibot'

export type MinimaxCreateResponse =
  v.InferOutput<typeof import('~/utils/minimax-client/minimax-client').MinimaxCreateResponseSchema>

export type MinimaxQueryResponse =
  v.InferOutput<typeof import('~/utils/minimax-client/minimax-client').MinimaxQueryResponseSchema>

export type MinimaxBaseResponse = {
  base_resp?: v.InferOutput<typeof import('~/utils/minimax-client/minimax-client').MinimaxBaseRespSchema> | undefined
}

export type MinimaxFetchJsonOptions<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>> = {
  init?: RequestInit | undefined
  schema: TSchema
  responseContext: string
  baseRespContext: string
  stage: string
  httpErrorMessage: string
  decorateError?: ((response: Response) => Error | Promise<Error>) | undefined
  execute?: ((request: (signal?: AbortSignal) => Promise<Response>) => Promise<Response>) | undefined
}
