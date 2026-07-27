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
  // The managed tesseract is a wrapper that exports DYLD_LIBRARY_PATH into a
  // separate install tree, so running it is the only way to know it works.
  if (await isRuntimeToolHealthy('tesseract', ['--version'])) {
    if (detectPlatform() === 'darwin') {
      await ensureManagedTessdataSupportFiles()
    }
    return
  }

  l.write('info', 'Installing Tesseract')
  const platform = detectPlatform()

  if (platform === 'darwin') {
    await installManagedTesseractMacos()
    l.write('success', 'Tesseract installed')
    return
  }

  if (platform === 'linux') {
    await runInherit('sudo', ['apt', 'install', '-y', 'tesseract-ocr'])
    l.write('success', 'Tesseract installed')
    return
  }

  l.error('Unsupported platform for tesseract auto-install')
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
    l.write('success', 'Tesseract language data (eng) found')
    return
  }

  l.warn('Could not find eng.traineddata in tessdata path')
  l.write('info', 'Set TESSDATA_PREFIX if your language files are in a custom directory')
}

export const setupTesseractOcr = async (): Promise<void> => {
  await installTesseract()
  if (detectPlatform() === 'darwin') {
    await ensureManagedTessdataSupportFiles()
  }
  await ensureEnglishLanguageData()

  if (shouldPrintCompletion()) {
    l.write('success', 'Extraction OCR setup complete')
  }
}
