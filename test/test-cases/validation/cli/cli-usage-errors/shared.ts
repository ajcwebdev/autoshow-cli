import { afterEach } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { CliCommandContext, CliParseResult } from '~/types'

const tempDirs: string[] = []
const repoFixtureFiles: string[] = []
const repoFixtureDirs: string[] = []

// The CLI assertion helpers live in test-utils so every directory shares one
// implementation; `parseRoot` stays as this suite's local spelling of `parseRootCli`.
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
