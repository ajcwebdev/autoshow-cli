import type { ResolveRuntimeToolOptions } from '~/types'
export type ResolvedYtDlpBinary = {
  path: string
  source: 'override' | 'managed' | 'path'
}

export type ResolveYtDlpBinaryOptions = ResolveRuntimeToolOptions & {
  managedPath?: string
}
