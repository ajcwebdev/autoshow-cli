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

// The managed ebook-convert is a shim into calibre.app; if the bundle was
// removed or only partially copied the shim still exists but cannot run.
const hasHealthyCalibreCliTools = async (): Promise<boolean> => {
  for (const tool of CALIBRE_REQUIRED_TOOLS) {
    if (!await isRuntimeToolHealthy(tool, ['--version'])) return false
  }
  return true
}

/**
 * Resolve the full path to a Calibre CLI tool, checking PATH first,
 * then falling back to the macOS app bundle location.
 */
export const calibreBin = (tool: string): string => {
  if (tool === 'ebook-convert') return resolveRuntimeToolInfo('ebook-convert')?.path ?? tool
  return commandExists(tool) ? tool : tool
}

const installCalibreTools = async (): Promise<void> => {
  if (await hasHealthyCalibreCliTools()) {
    return
  }

  l.write('info', 'Installing Calibre ebook-convert')
  const platform = detectPlatform()

  if (platform === 'darwin') {
    await installManagedCalibreMacos()
    if (hasCalibreCliTools()) {
      l.write('success', 'Calibre ebook-convert installed')
      return
    }
    throw InfraError('Calibre install completed but managed ebook-convert was not found', { stage: 'setup:calibre' })
  }

  if (platform === 'linux') {
    await runInherit('sudo', ['apt', 'install', '-y', 'calibre'])
    if (hasCalibreCliTools()) {
      l.write('success', 'Calibre ebook-convert installed')
      return
    }
    throw InfraError('Calibre install completed but ebook-convert was not found on PATH', { stage: 'setup:calibre' })
  }

  l.error('Unsupported platform for calibre auto-install')
  throw InternalError('Unsupported platform for calibre setup', { stage: 'setup:calibre' })
}

const setupCalibreTools = async (): Promise<void> => {
  await installCalibreTools()

  if (shouldPrintCompletion()) {
    l.write('success', 'Calibre ebook-convert setup complete')
  }
}

export const setupCalibreDocumentTools = async (): Promise<void> => {
  // Deliberately serial. Splitting this chain into an I/O-bound half and a
  // CPU-bound half was measured and lost: calibre alone went 74s to 170s for
  // identical work, and the cold install went 307.4s to 326.4s, because the
  // split moved the ~200 MB DMG into t=0 where every other
  // setup task is already downloading. Concurrent setup tasks are not
  // independent — they share one network link — so the contention is bounded
  // at the transfer instead, in setup-download/download-admission.ts.
  await setupDocumentTools({ printCompletion: false })
  await setupCalibreTools()

  if (shouldPrintCompletion()) {
    l.write('success', 'Document tools setup complete')
  }
}
