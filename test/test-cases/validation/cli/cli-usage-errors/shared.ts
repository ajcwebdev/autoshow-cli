import { afterEach, expect } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { COMMAND_DEFINITIONS } from '~/cli/command-definitions'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { NativeNoSuchCommandError, NativeUnknownFlagError } from '~/cli/native/native-errors'
import { parseCommandInvocation, parseNativeCli } from '~/cli/native/native-parser'
import { runCommand } from '../../../../test-utils/test-helpers'
import type { CliCommandContext, CliParseResult } from '~/types'

const tempDirs: string[] = []
const repoFixtureFiles: string[] = []
const repoFixtureDirs: string[] = []

export const parseRoot = (argv: string[]) =>
  parseNativeCli(argv, COMMAND_DEFINITIONS, GLOBAL_FLAG_DEFINITIONS)

export const commandNamed = (name: string) => {
  const command = COMMAND_DEFINITIONS.find((entry) => entry.name === name)
  if (!command) throw new Error(`missing command ${name}`)
  return command
}

export const expectUnknownCommand = (argv: string[], name: string): void => {
  expect(() => parseRoot(argv)).toThrow(NativeNoSuchCommandError)
  expect(() => parseRoot(argv)).toThrow(`Unknown command "${name}"`)
}

export const expectUnknownFlag = (argv: string[], flag: string): void => {
  const command = commandNamed(argv[0]!)
  expect(() => parseCommandInvocation(argv, command, GLOBAL_FLAG_DEFINITIONS)).toThrow(NativeUnknownFlagError)
  expect(() => parseCommandInvocation(argv, command, GLOBAL_FLAG_DEFINITIONS)).toThrow(`Unexpected flag: ${flag}`)
}

export const expectUsageMessage = (error: unknown, expected: string): void => {
  const err = error instanceof Error ? error : new Error(String(error))
  const hints = 'hints' in err && Array.isArray(err.hints) ? err.hints.filter((hint): hint is string => typeof hint === 'string') : []
  expect([err.message, ...hints].join('\n')).toContain(expected)
}

export const expectUsageThrow = (fn: () => unknown, expected: string): void => {
  try {
    fn()
  } catch (error) {
    expectUsageMessage(error, expected)
    return
  }
  throw new Error(`Expected usage error containing ${JSON.stringify(expected)}`)
}

export const asCtx = (parsed: CliParseResult): CliCommandContext => {
  if (!parsed.command) throw new Error('parsed command is missing')
  return {
    argv: parsed.argv,
    ...(parsed.calledAs ? { calledAs: parsed.calledAs } : {}),
    command: parsed.command,
    flags: parsed.flags,
    parameters: parsed.parameters,
    rawParsed: parsed.rawParsed,
    store: {}
  }
}

export const makeTempRoot = async (prefix: string): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(root)
  return root
}

export const writeLegacyTtsManifestFixture = async (
  runDir: string,
  metadata: Record<string, unknown>
): Promise<void> => {
  const at = new Date(0).toISOString()
  await writeFile(join(runDir, 'manifest.json'), `${JSON.stringify({
    command: 'tts',
    scope: 'single',
    createdAt: at,
    updatedAt: at,
    items: [{
      status: 'full',
      metadata,
      providers: [{
        service: 'openai',
        model: 'gpt-4o-mini-tts-2025-12-15',
        local: false,
        artifactDir: '.',
        status: 'succeeded',
        attempts: 1,
        options: {},
        metadata: {
          audioFileName: 'speech.wav',
          audioFileSize: 10,
          processingTime: 100
        }
      }]
    }]
  }, null, 2)}\n`)
}

export const expectUsageExit = async (args: string[], expectedMessage: string): Promise<void> => {
  const result = await runCommand(['src/cli/create-cli.ts', ...args], {
    env: { NO_COLOR: '1' }
  })

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain(expectedMessage)
}

export const ensureEpisodeTwoScriptFixture = async (): Promise<void> => {
  const scriptsRoot = join('input', 'scripts')
  const dir = join(scriptsRoot, '02-script')
  const path = join(dir, '01-co-work-smarter.md')

  if (!existsSync(scriptsRoot)) {
    repoFixtureDirs.push(scriptsRoot)
  } else if (!existsSync(dir)) {
    repoFixtureDirs.push(dir)
  }

  await mkdir(dir, { recursive: true })

  if (!existsSync(path)) {
    repoFixtureFiles.push(path)
    await writeFile(path, '# Co-Work Smarter\n')
  }
}

export const registerUsageErrorCleanup = (): void => {
  afterEach(async () => {
    await Promise.all(repoFixtureFiles.splice(0).map((path) => rm(path, { force: true })))
    await Promise.all(repoFixtureDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })
}
