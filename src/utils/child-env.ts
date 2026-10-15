// The variables os.tmpdir() reads; without them children fall back to the shared
// /tmp instead of the parent's (per-user) temp directory.
export const TEMP_DIRECTORY_ENV_KEYS = ['TMPDIR', 'TMP', 'TEMP'] as const

export const DEFAULT_CHILD_ENV_KEYS = [
  'PATH',
  'HOME',
  ...TEMP_DIRECTORY_ENV_KEYS,
  'FORCE_COLOR',
  'NO_COLOR'
] as const

export type ChildEnvOptions = {
  allow?: readonly string[] | undefined
  set?: Readonly<Record<string, string | undefined>> | undefined
  source?: Readonly<Record<string, string | undefined>> | undefined
}

export const childEnv = (options: ChildEnvOptions = {}): Record<string, string> => {
  const source = options.source ?? process.env
  const result: Record<string, string> = {}
  for (const key of [...DEFAULT_CHILD_ENV_KEYS, ...(options.allow ?? [])]) {
    const value = source[key]
    if (typeof value === 'string') result[key] = value
  }
  for (const [key, value] of Object.entries(options.set ?? {})) {
    if (typeof value === 'string') result[key] = value
    else delete result[key]
  }
  return result
}
