import { detectPlatform } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import * as l from '~/utils/app-logger/app-logger'
import { hasRuntimeTool, resolveRuntimeToolInfo } from '~/utils/runtime-paths'
import { setupDocumentTools } from './document'
import { installManagedCalibreMacos } from '../macos-managed-tools'
import { isRuntimeToolHealthy } from '../tool-health'
import { isCompactSetupMode } from '~/utils/setup-output-mode'
import { InfraError, InternalError } from '~/utils/error-handler'
import { ensureManagedLinuxTool } from '../managed-linux-tools'

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
  if (tool !== 'ebook-convert') throw InfraError(`Unsupported managed Calibre tool: ${tool}`, { stage: 'setup:calibre' })
  const resolved = resolveRuntimeToolInfo('ebook-convert')
  if (!resolved) throw InfraError('Managed ebook-convert is unavailable; run bun autoshow setup --step calibre', { stage: 'setup:calibre' })
  return resolved.path
}

const installCalibreTools = async (options: { forceRedownload?: boolean } = {}): Promise<void> => {
  if (!options.forceRedownload && resolveRuntimeToolInfo('ebook-convert')?.source === 'override' && await hasHealthyCalibreCliTools()) {
    return
  }

  l.write('info', 'Installing Calibre ebook-convert', { category: 'command' })
  const platform = detectPlatform()

  if (platform === 'darwin') {
    await installManagedCalibreMacos(options)
    if (hasCalibreCliTools() && await hasHealthyCalibreCliTools()) {
      l.write('info', 'Calibre ebook-convert installed', { category: 'command' })
      return
    }
    throw InfraError('Calibre install completed but managed ebook-convert was not found', { stage: 'setup:calibre' })
  }

  if (platform === 'linux') {
    await ensureManagedLinuxTool('ebook-convert', options)
    if (hasCalibreCliTools() && await hasHealthyCalibreCliTools()) {
      l.write('info', 'Calibre ebook-convert installed', { category: 'command' })
      return
    }
    throw InfraError('Calibre install completed but managed ebook-convert was not found', { stage: 'setup:calibre' })
  }

  throw InternalError('Unsupported platform for calibre setup', { stage: 'setup:calibre' })
}

const setupCalibreTools = async (options: { forceRedownload?: boolean } = {}): Promise<void> => {
  await installCalibreTools(options)

  if (shouldPrintCompletion()) {
    l.write('info', 'Calibre ebook-convert setup complete', { category: 'command' })
  }
}

export const setupCalibreDocumentTools = async (options: { forceRedownload?: boolean } = {}): Promise<void> => {
  await setupDocumentTools({ ...options, printCompletion: false })
  await setupCalibreTools(options)

  if (shouldPrintCompletion()) {
    l.write('info', 'Document tools setup complete', { category: 'command' })
  }
}
