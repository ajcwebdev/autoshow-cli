import { rm } from 'node:fs/promises'
import { runUvCapture, runUvInherit, setupUv } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import * as l from '~/utils/app-logger/app-logger'
import { createHumanTable } from '~/utils/app-logger/human-table/human-table'
import { isCompactSetupMode } from '~/utils/setup-output-mode'
import { InfraError } from '~/utils/error-handler'
import { isKittenTtsEnvironmentReady, kittenTtsUvEnvDir } from './kitten-tts'

const PYTHON_VERSION = '3.12'

const setupKittenTtsEnvironment = async (): Promise<void> => {
  l.write('info', 'Setting up Kitten TTS environment')
  await setupUv()
  await runUvCapture(['python', 'install', PYTHON_VERSION], { allowFailure: true })
  await rm(kittenTtsUvEnvDir, { recursive: true, force: true })

  const venv = await runUvInherit(['venv', '--python', PYTHON_VERSION, kittenTtsUvEnvDir], { allowFailure: true })
  if (venv !== 0) {
    l.error('Failed to create Kitten TTS virtual environment')
    throw InfraError('Failed to create Kitten TTS virtual environment', { stage: 'tts:kitten-setup' })
  }

  l.write('info', 'Installing kittentts and dependencies')
  const wheelUrl = 'https://github.com/KittenML/KittenTTS/releases/download/0.8/kittentts-0.8.0-py3-none-any.whl'
  const deps = [wheelUrl, 'soundfile', 'numpy']
  const installCode = await runUvInherit(
    ['pip', 'install', '-p', `${kittenTtsUvEnvDir}/bin/python`, ...deps],
    { allowFailure: true, env: { UV_SKIP_WHEEL_FILENAME_CHECK: '1' } }
  )
  if (installCode !== 0) {
    l.error('Failed to install kittentts dependencies')
    throw InfraError('Failed to install Kitten TTS dependencies', { stage: 'tts:kitten-setup' })
  }

  l.write('success', 'Kitten TTS environment ready')
}

export const setupKittenTts = async (): Promise<void> => {
  if (await isKittenTtsEnvironmentReady()) return
  await setupKittenTtsEnvironment()

  if (!isCompactSetupMode()) {
    l.write('success', 'Kitten TTS Setup', {
      category: 'command',
      humanTable: createHumanTable([
        { status: 'complete', command: 'bun autoshow tts input/examples/tts/1-tts.md --kitten kitten-tts-mini' },
        { status: 'complete', command: 'bun autoshow write "URL" --kitten-tts kitten-tts-mini' }
      ], ['status', 'command'])
    })
  }
}

export const ensureKittenTtsSetup = async (): Promise<void> => {
  if (await isKittenTtsEnvironmentReady()) {
    l.write('success', 'Kitten TTS setup verified')
    return
  }

  l.write('info', 'Kitten TTS not set up; running setup')
  await setupKittenTtsEnvironment()
}
