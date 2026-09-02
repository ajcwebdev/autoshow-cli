import { commandExists, runInherit, detectPlatform } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import * as l from '~/utils/app-logger/app-logger'
import { hasRuntimeTool, resolveRuntimeToolInfo } from '~/utils/runtime-paths'
import { setupDocumentTools } from './document'
import { installManagedCalibreMacos } from '../macos-managed-tools'
import { isRuntimeToolHealthy } from '../tool-health'
import { isCompactSetupMode } from '~/utils/setup-output-mode'
import { InfraError, InternalError } from '~/utils/error-handler'

export const CALIBRE_REQUIRED_TOOLS = ['ebook-convert'] as const

const shouldPrintCompletion = (): boolean => !isCompactSetupMode()

const hasCalibreCliTools = (): boolean => {
  return CALIBRE_REQUIRED_TOOLS.every((tool) => hasRuntimeTool(tool))
}

const hasHealthyCalibreCliTools = async (): Promise<boolean> => {
  for (const tool of CALIBRE_REQUIRED_TOOLS) {
    if (!await isRuntimeToolHealthy(tool, ['--version'])) return false
  }
  return true
}

export const calibreBin = (tool: string): string => {
  if (tool === 'ebook-convert') return resolveRuntimeToolInfo('ebook-convert')?.path ?? tool
  return commandExists(tool) ? tool : tool
}

const installCalibreTools = async (): Promise<void> => {
  if (await hasHealthyCalibreCliTools()) {
    return
  }

  l.write('info', 'Installing Calibre ebook-convert', { category: 'command' })
  const platform = detectPlatform()

  if (platform === 'darwin') {
    await installManagedCalibreMacos()
    if (hasCalibreCliTools()) {
      l.write('info', 'Calibre ebook-convert installed', { category: 'command' })
      return
    }
    throw InfraError('Calibre install completed but managed ebook-convert was not found', { stage: 'setup:calibre' })
  }

  if (platform === 'linux') {
    await runInherit('sudo', ['apt', 'install', '-y', 'calibre'])
    if (hasCalibreCliTools()) {
      l.write('info', 'Calibre ebook-convert installed', { category: 'command' })
      return
    }
    throw InfraError('Calibre install completed but ebook-convert was not found on PATH', { stage: 'setup:calibre' })
  }

  throw InternalError('Unsupported platform for calibre setup', { stage: 'setup:calibre' })
}

const setupCalibreTools = async (): Promise<void> => {
  await installCalibreTools()

  if (shouldPrintCompletion()) {
    l.write('info', 'Calibre ebook-convert setup complete', { category: 'command' })
  }
}

export const setupCalibreDocumentTools = async (): Promise<void> => {
  await setupDocumentTools({ printCompletion: false })
  await setupCalibreTools()

  if (shouldPrintCompletion()) {
    l.write('info', 'Document tools setup complete', { category: 'command' })
  }
}
