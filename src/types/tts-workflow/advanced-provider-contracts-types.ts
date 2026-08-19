export type AdvancedProviderHttpRequest = <T = unknown>(input: {
  method: 'GET' | 'POST' | 'DELETE'
  path: string
  query?: Readonly<Record<string, string | undefined>> | undefined
  headers?: Readonly<Record<string, string>> | undefined
  body?: unknown | undefined
  signal?: AbortSignal | undefined
}) => Promise<T>
