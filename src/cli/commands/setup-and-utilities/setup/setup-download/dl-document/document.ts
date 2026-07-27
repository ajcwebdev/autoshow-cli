import { runInherit, detectPlatform } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import * as l from '~/utils/app-logger/app-logger'
import { installManagedMupdfMacos, installManagedQpdfMacos } from '../macos-managed-tools'
import { isRuntimeToolHealthy } from '../tool-health'
import { isCompactSetupMode } from '~/utils/setup-output-mode'
import { InternalError } from '~/utils/error-handler'
import { refreshQpdfHealthCache, resolveHealthyQpdfToolInfo } from '~/cli/commands/process-steps/step-1-download/document/qpdf-health'

const shouldPrintCompletion = (): boolean => !isCompactSetupMode()

const installMutool = async (): Promise<void> => {
  if (await isRuntimeToolHealthy('mutool', ['-v'], [0, 1])) {
    return
  }

  l.write('info', 'Installing MuPDF tools')
  const platform = detectPlatform()

  if (platform === 'darwin') {
    await installManagedMupdfMacos()
    l.write('success', 'MuPDF tools installed')
    return
  }

  if (platform === 'linux') {
    await runInherit('sudo', ['apt', 'install', '-y', 'mupdf-tools'])
    l.write('success', 'MuPDF tools installed')
    return
  }

  l.error('Unsupported platform for mutool auto-install')
  throw InternalError('Unsupported platform for mutool setup', { stage: 'setup:mupdf' })
}

const installQpdf = async (): Promise<void> => {
  const existing = await resolveHealthyQpdfToolInfo()
  if (existing.healthy) {
    return
  }

  l.write('info', 'Installing qpdf')
  const platform = detectPlatform()

  if (platform === 'darwin') {
    await installManagedQpdfMacos()
    await refreshQpdfHealthCache({ repairManaged: false })
    l.write('success', 'qpdf installed')
    return
  }

  if (platform === 'linux') {
    await runInherit('sudo', ['apt', 'install', '-y', 'qpdf'])
    await refreshQpdfHealthCache({ repairManaged: false })
    l.write('success', 'qpdf installed')
    return
  }

  l.error('Unsupported platform for qpdf auto-install')
  throw InternalError('Unsupported platform for qpdf setup', { stage: 'setup:qpdf' })
}

export const setupDocumentTools = async (options: { printCompletion?: boolean } = {}): Promise<void> => {
  await installMutool()
  await installQpdf()

  if (options.printCompletion !== false && shouldPrintCompletion()) {
    l.write('success', 'Document tools setup complete')
  }
}
