import { runCapture, runInherit, detectPlatform } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import * as l from '~/utils/app-logger/app-logger'
import { getTesseractBinary, resolveTessdataPrefix } from '~/utils/runtime-paths'
import {
  ensureManagedTessdataSupportFiles,
  installManagedTesseractMacos
} from '~/cli/commands/setup-and-utilities/setup/setup-download/macos-managed-tools'
import { isRuntimeToolHealthy } from '~/cli/commands/setup-and-utilities/setup/setup-download/tool-health'
import { isCompactSetupMode } from '~/utils/setup-output-mode'
import { InternalError } from '~/utils/error-handler'

const shouldPrintCompletion = (): boolean => !isCompactSetupMode()

const installTesseract = async (): Promise<void> => {
  if (await isRuntimeToolHealthy('tesseract', ['--version'])) {
    if (detectPlatform() === 'darwin') {
      await ensureManagedTessdataSupportFiles()
    }
    return
  }

  l.write('info', 'Installing Tesseract', { category: 'command' })
  const platform = detectPlatform()

  if (platform === 'darwin') {
    await installManagedTesseractMacos()
    l.write('info', 'Tesseract installed', { category: 'command' })
    return
  }

  if (platform === 'linux') {
    await runInherit('sudo', ['apt', 'install', '-y', 'tesseract-ocr'])
    l.write('info', 'Tesseract installed', { category: 'command' })
    return
  }

  throw InternalError('Unsupported platform for tesseract setup', { stage: 'setup:tesseract' })
}

const ensureEnglishLanguageData = async (): Promise<void> => {
  const result = await runCapture(getTesseractBinary(), ['--list-langs'], {
    allowFailure: true,
    env: { TESSDATA_PREFIX: resolveTessdataPrefix() }
  })
  const langs = result.stdout
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  if (langs.includes('eng')) {
    l.write('info', 'Tesseract language data (eng) found', { category: 'command' })
    return
  }

  l.warn('Could not find eng.traineddata in tessdata path', { category: 'command' })
  l.write('info', `Add eng.traineddata to ${resolveTessdataPrefix()} (the CLI points tesseract at this directory)`, {
      category: 'command',
      metadata: { tool: 'tesseract', tessdataPrefix: resolveTessdataPrefix() }
    })
}

export const setupTesseractOcr = async (): Promise<void> => {
  await installTesseract()
  if (detectPlatform() === 'darwin') {
    await ensureManagedTessdataSupportFiles()
  }
  await ensureEnglishLanguageData()

  if (shouldPrintCompletion()) {
    l.write('info', 'Extraction OCR setup complete', { category: 'command' })
  }
}
