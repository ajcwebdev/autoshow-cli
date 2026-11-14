import { detectPlatform } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import * as l from '~/utils/app-logger/app-logger'
import { hasHealthyManagedSourceInstall, installManagedMupdfMacos, installManagedQpdfMacos } from '../macos-managed-tools'
import { isRuntimeToolHealthy } from '../tool-health'
import { isCompactSetupMode } from '~/utils/setup-output-mode'
import { InternalError } from '~/utils/error-handler'
import { refreshQpdfHealthCache, resolveHealthyQpdfToolInfo } from '~/cli/commands/sources/download/document/qpdf-health'
import { resolveRuntimeToolInfo } from '~/utils/runtime-paths'
import { ensureManagedLinuxTool } from '../managed-linux-tools'

const shouldPrintCompletion = (): boolean => !isCompactSetupMode()

const installMutool = async (options: { forceRedownload?: boolean } = {}): Promise<void> => {
  const existing = resolveRuntimeToolInfo('mutool')
  const platform = detectPlatform()
  if (
    !options.forceRedownload && (platform !== 'linux' || existing?.source === 'override') && await isRuntimeToolHealthy('mutool', ['-v'], [0, 1]) &&
    (platform !== 'darwin' || existing?.source !== 'managed' || await hasHealthyManagedSourceInstall('mupdf'))
  ) {
    return
  }

  l.write('info', 'Installing MuPDF tools', { category: 'command' })

  if (platform === 'darwin') {
    await installManagedMupdfMacos(options)
    l.write('info', 'MuPDF tools installed', { category: 'command' })
    return
  }

  if (platform === 'linux') {
    await ensureManagedLinuxTool('mutool', options)
    l.write('info', 'MuPDF tools installed', { category: 'command' })
    return
  }

  throw InternalError('Unsupported platform for mutool setup', { stage: 'setup:mupdf' })
}

const installQpdf = async (options: { forceRedownload?: boolean } = {}): Promise<void> => {
  const existing = await resolveHealthyQpdfToolInfo()
  const platform = detectPlatform()
  if (
    !options.forceRedownload && (platform !== 'linux' || existing.info?.source === 'override') && existing.healthy &&
    (platform !== 'darwin' || existing.info?.source !== 'managed' || await hasHealthyManagedSourceInstall('qpdf'))
  ) {
    return
  }

  l.write('info', 'Installing qpdf', { category: 'command' })

  if (platform === 'darwin') {
    await installManagedQpdfMacos(options)
    await refreshQpdfHealthCache({ repairManaged: false })
    l.write('info', 'qpdf installed', { category: 'command' })
    return
  }

  if (platform === 'linux') {
    await ensureManagedLinuxTool('qpdf', options)
    await refreshQpdfHealthCache({ repairManaged: false })
    l.write('info', 'qpdf installed', { category: 'command' })
    return
  }

  throw InternalError('Unsupported platform for qpdf setup', { stage: 'setup:qpdf' })
}

export const setupDocumentTools = async (options: { printCompletion?: boolean; forceRedownload?: boolean } = {}): Promise<void> => {
  await installMutool(options)
  await installQpdf(options)

  if (options.printCompletion !== false && shouldPrintCompletion()) {
    l.write('info', 'Document tools setup complete', { category: 'command' })
  }
}
