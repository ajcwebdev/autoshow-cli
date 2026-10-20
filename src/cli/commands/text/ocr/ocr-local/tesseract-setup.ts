import { runCapture, runInherit, detectPlatform } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import * as l from '~/utils/app-logger/app-logger'
import { getTesseractBinary, resolveTessdataPrefix, tessdataDir, toProjectDisplayPath } from '~/utils/runtime-paths'
import { inspectTesseractEnglishData } from '~/utils/tesseract-language-data'
import {
  ensureManagedTessdataSupportFiles,
  installManagedTesseractMacos
} from '~/cli/commands/setup-and-utilities/setup/setup-download/macos-managed-tools'
import { isRuntimeToolHealthy } from '~/cli/commands/setup-and-utilities/setup/setup-download/tool-health'
import { isCompactSetupMode } from '~/utils/setup-output-mode'
import { InfraError, InternalError } from '~/utils/error-handler'

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

export const ensureTesseractEnglishData = async (): Promise<void> => {
  const prefix = resolveTessdataPrefix()
  const source = prefix ? toProjectDisplayPath(prefix) : 'Tesseract packaged default'
  const result = await inspectTesseractEnglishData(async args => await runCapture(getTesseractBinary(), args, {
    allowFailure: true,
    env: { TESSDATA_PREFIX: prefix }
  }))

  if (result.status === 'ready') {
    l.write('info', `Tesseract language data (eng) ready (${source})`, { category: 'command' })
    return
  }
  throw InfraError(`Tesseract English data is unavailable (${source}): ${result.detail}`, {
    stage: 'setup:tesseract-data',
    hints: [`Install packaged Tesseract English data, or add valid eng.traineddata to ${toProjectDisplayPath(tessdataDir)}.`]
  })
}

export const setupTesseractOcr = async (): Promise<void> => {
  await installTesseract()
  if (detectPlatform() === 'darwin') {
    await ensureManagedTessdataSupportFiles()
  }
  await ensureTesseractEnglishData()

  if (shouldPrintCompletion()) {
    l.write('info', 'Extraction OCR setup complete', { category: 'command' })
  }
}
