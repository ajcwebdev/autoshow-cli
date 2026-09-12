import { join } from 'node:path'
import { configureOutputRoot } from '~/cli/commands/command-shared/output-root'
import type {
  RunCommandOptions,
  RunCommandResult
} from '~/types'
import { pathExists } from '~/utils/filesystem'
import { isRecord } from '~/utils/value-helpers'
import { normalizeCredentialValue } from '~/utils/validate/credential-value'
import { parseCallerLocation } from './test-caller-location'
import { executeTestCommand, prepareTestCommand } from './test-command-execution'
import { OUTPUT_DIR } from './test-output-directories'

configureOutputRoot(OUTPUT_DIR)

const EXAMPLE_AUDIO_URL = 'https://ajc.pics/autoshow/examples/1-audio.mp3'

export const EXAMPLE_SHORT_AUDIO_URL = 'https://ajc.pics/autoshow/examples/0-audio-short.mp3'

export const LOCAL_EXAMPLE_AUDIO_PATH = join('input/examples/audio', '1-audio.mp3')

export const LOCAL_EXAMPLE_SHORT_AUDIO_PATH = join('input/examples/audio', '0-audio-short.mp3')

export const STABLE_EXAMPLE_AUDIO_URL = EXAMPLE_AUDIO_URL

export const STABLE_EXAMPLE_AUDIO_TITLE = STABLE_EXAMPLE_AUDIO_URL.split('/').pop()?.replace(/\.[^/.]+$/, '') ?? ''

export const STABLE_TTS_MD_PATH = 'input/examples/tts/1-tts.md'

export const STABLE_TTS_MD_TITLE = '1-tts'

const PAGE_IMAGE_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAN0lEQVR4nO3RwQ0AMAjDwJT9d05HMB9+vgGCZF7bXJrT9XhgwR8gEyETIRMhEyETIRMhEyEThXzH8QM9OMM6fAAAAABJRU5ErkJggg=='

export const runCommand = async (args: string[], opts?: RunCommandOptions): Promise<RunCommandResult> => {
  const prepared = await prepareTestCommand(args, opts)
  const caller = parseCallerLocation(new Error().stack ?? '')
  return await executeTestCommand(prepared, caller)
}

export { pathExists as fileExists }

export const ensurePageImageFixture = async (path = 'input/examples/document/1-document.png'): Promise<void> => {
  await Bun.write(path, Buffer.from(PAGE_IMAGE_PNG_BASE64, 'base64'))
}

// Test credentials are exports only; fixture and live callers share this source.
export const readConfiguredEnvVar = async (key: string): Promise<string | undefined> => readConfiguredEnvVarSync(key)

export const readConfiguredEnvVarSync = (key: string): string | undefined => normalizeCredentialValue(process.env[key])

export { isRecord }

export const toRecordArray = (value: unknown): Record<string, unknown>[] => {
  if (Array.isArray(value)) {
    return value.filter(isRecord)
  }
  return isRecord(value) ? [value] : []
}

export { CLI_SOURCE_ENTRY, injectGlobalCliFlags } from './test-command-options'

export { cleanupOutputDir, cleanupTestOutput, findLatestDirectory, OUTPUT_DIR, testWorkerScratchSegment } from './test-output-directories'
