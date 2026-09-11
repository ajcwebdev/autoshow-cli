import { resolve } from 'node:path'
import { HOSTED_PROVIDER_ENV_CHECKS } from '~/cli/commands/setup-and-utilities/setup/hosted-provider-config'
import { childEnv } from '~/utils/child-env'

const TEST_CONFIG_PATH = resolve(import.meta.dir, 'fixtures/empty-autoshow-config.json')

const PROCESSING_COMMANDS = new Set([
  'metadata',
  'download',
  'extract',
  'resume',
  'write',
  'tts',
  'image',
  'music',
  'video',
  'comic'
])

const HELP_FLAGS = new Set(['--help', '-h'])

export const CLI_SOURCE_ENTRY = 'src/cli/create-cli.ts'

const BASE_CHILD_ENV = childEnv({
  allow: [
    ...HOSTED_PROVIDER_ENV_CHECKS.map(provider => provider.envVar),
    'AUTOSHOW_PROJECT_ROOT',
    'AUTOSHOW_TEST_CLI_BUNDLE'
  ]
})

const shouldUseEmptyTestConfig = (args: string[]): boolean => {
  if (args[0] !== CLI_SOURCE_ENTRY) {
    return false
  }

  if (args.some((arg) => arg === '--config-path' || arg.startsWith('--config-path='))) {
    return false
  }

  if (args.some((arg) => HELP_FLAGS.has(arg))) {
    return false
  }

  const command = args[1]
  return typeof command === 'string' && PROCESSING_COMMANDS.has(command)
}

export const withEmptyTestConfig = (args: string[]): string[] =>
  shouldUseEmptyTestConfig(args)
    ? [...args, '--config-path', TEST_CONFIG_PATH]
    : args

export const isProcessingCliCommand = (args: string[]): boolean => {
  if (args[0] !== CLI_SOURCE_ENTRY) {
    return false
  }
  if (args.some((arg) => HELP_FLAGS.has(arg))) {
    return false
  }
  const command = args[1]
  return typeof command === 'string' && PROCESSING_COMMANDS.has(command)
}

export const injectGlobalCliFlags = (
  baseChildArgs: string[],
  outputRoot: string,
  overrideBinDir: string | undefined
): string[] => {
  const injectedGlobalFlags = isProcessingCliCommand(baseChildArgs)
    ? [
      '--output-root', outputRoot,
      ...(overrideBinDir ? ['--bin-dir', overrideBinDir] : [])
    ]
    : []

  if (injectedGlobalFlags.length === 0) {
    return baseChildArgs
  }

  const passthroughIndex = baseChildArgs.indexOf('--')
  return passthroughIndex === -1
    ? [...baseChildArgs, ...injectedGlobalFlags]
    : [
      ...baseChildArgs.slice(0, passthroughIndex),
      ...injectedGlobalFlags,
      ...baseChildArgs.slice(passthroughIndex)
    ]
}

export const buildChildEnv = (optsEnv: Record<string, string | undefined> | undefined): Record<string, string | undefined> => ({
  ...BASE_CHILD_ENV,
  FORCE_COLOR: '0',
  ...(optsEnv ?? {})
})
