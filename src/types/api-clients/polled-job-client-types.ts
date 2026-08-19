import type * as v from 'valibot'

export type PolledJobSchema<T> = v.BaseSchema<unknown, T, v.BaseIssue<unknown>>

export type PolledJobHttpStep<T> = {
  url: string
  init: RequestInit
  schema: PolledJobSchema<T>
  context: string
  stage: string
  errorMessage: string
  readResponse?: ((response: Response) => Promise<unknown>) | undefined
  formatErrorBody?: ((payload: unknown) => string) | undefined
  errorFactory?: ((response: Response, payload: unknown) => Error) | undefined
}

export type PolledJobCustomStep<T> = {
  run: (signal?: AbortSignal | undefined) => Promise<T>
}

export type PolledJobStep<T> = PolledJobHttpStep<T> | PolledJobCustomStep<T>

export type PolledJobFailure = { failed: true, reason: string } | { failed: false }
