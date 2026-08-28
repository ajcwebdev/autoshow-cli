import { afterEach } from 'bun:test'
import { rm } from 'node:fs/promises'
import type { CliCommandContext, CliParseResult } from '~/types'
import { makeTempDir } from '../../../../test-utils/temp-dirs'

const tempDirs: string[] = []

export {
  commandNamed,
  expectUnknownCommand,
  expectUnknownFlag,
  expectUsageMessage,
  expectUsageExit,
  expectUsageThrow,
  parseRootCli as parseRoot
} from '../../../../test-utils/cli-assertions'

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
  const root = await makeTempDir(prefix)
  tempDirs.push(root)
  return root
}

export const registerUsageErrorCleanup = (): void => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  })
}
