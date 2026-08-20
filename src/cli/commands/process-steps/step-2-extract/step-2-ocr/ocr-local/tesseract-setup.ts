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

  l.write('info', 'Installing Tesseract', { category: 'command' })
  const platform = detectPlatform()

  if (platform === 'darwin') {
    await installManagedTesseractMacos()
    l.write('success', 'Tesseract installed', { category: 'command' })
    return
  }

  if (platform === 'linux') {
    await runInherit('sudo', ['apt', 'install', '-y', 'tesseract-ocr'])
    l.write('success', 'Tesseract installed', { category: 'command' })
    return
  }

  l.error('Unsupported platform for tesseract auto-install', { category: 'command' })
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
    l.write('success', 'Tesseract language data (eng) found', { category: 'command' })
    return
  }

  l.warn('Could not find eng.traineddata in tessdata path', { category: 'command' })
  // The CLI sets TESSDATA_PREFIX itself when spawning tesseract and never reads
  // it back, so pointing users at the env var would be a dead end.
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
    l.write('success', 'Extraction OCR setup complete', { category: 'command' })
  }
}
