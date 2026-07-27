import { existsSync } from 'node:fs'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join, resolve } from 'node:path'
import { getConfiguredBinDir, resolveRuntimeToolInfo } from '~/utils/runtime-paths'
import { ensureDirectory, exec } from '~/utils/cli-utils'
import { InfraError } from '~/utils/error-handler'
import type { FulfillAcsmOptions, FulfilledAcsmDocument, ResolveAcsmFulfillCommandOptions } from '~/types'

export const ACSM_FULFILL_COMMAND = 'calibre-acsm-fulfill'

// Adobe account activation material. The fulfillment wrapper refuses to run
// without all three, so their absence is the difference between "installed" and
// "usable" — a distinction `--version` cannot express.
export const ACSM_ACCOUNT_REQUIRED_FILES = ['activation.xml', 'device.xml', 'devicesalt'] as const
export const ACSM_CONVERSION_CHAIN = ['calibre-acsm-plugin'] as const
export const ACSM_PRICE_NOTE = 'ACSM price estimate omitted page-priced OCR costs: fulfillment is skipped in --price mode because it can contact Adobe or distributor servers. Run extraction after fulfillment produces an EPUB or PDF for page-based OCR estimates.'

const nonEmpty = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

export const isAcsmFormat = (value: string | null | undefined): value is 'acsm' =>
  value === 'acsm'

export const isAcsmPath = (input: string): boolean => {
  const path = (() => {
    if (/^https?:\/\//i.test(input)) {
      try {
        return new URL(input).pathname
      } catch {
        return input
      }
    }
    return input
  })()
  return extname(path).toLowerCase() === '.acsm'
}

export const isAcsmContentType = (contentType: string | null | undefined): boolean => {
  const normalized = contentType?.toLowerCase() ?? ''
  return normalized.includes('application/vnd.adobe.adept+xml')
    || normalized.includes('application/acsm')
    || normalized.includes('application/x-acsm')
}

export const resolveAcsmFulfillCommand = (
  options: ResolveAcsmFulfillCommandOptions = {}
): string => {
  const exists = options.exists ?? existsSync
  const which = options.which ?? ((command: string) => Bun.which(command))
  const overrideDir = nonEmpty(options.overrideBinDir ?? getConfiguredBinDir())

  if (overrideDir) {
    const overridePath = join(overrideDir, ACSM_FULFILL_COMMAND)
    if (exists(overridePath)) {
      return overridePath
    }
  }

  const managed = resolveRuntimeToolInfo(ACSM_FULFILL_COMMAND, {
    ...(options.overrideBinDir ? { overrideBinDir: options.overrideBinDir } : {}),
    exists,
    which,
    platform: process.platform
  })
  if (managed) {
    return managed.path
  }

  const pathBinary = which(ACSM_FULFILL_COMMAND)
  if (pathBinary) {
    return pathBinary
  }

  throw InfraError(
    `ACSM fulfillment requires ${ACSM_FULFILL_COMMAND}. Run bun autoshow setup --step calibre, then authorize ACSM fulfillment with calibre-acsm-authorize.`,
    {
      stage: 'download:document',
      hints: [
        `Run 'bun autoshow setup --step calibre' or 'bun autoshow setup --step acsm' to install ${ACSM_FULFILL_COMMAND}.`,
        'Run calibre-acsm-authorize once, or copy activation.xml, device.xml, and devicesalt into the setup-managed ACSM account directory.',
        `${ACSM_FULFILL_COMMAND} must accept: ${ACSM_FULFILL_COMMAND} <input.acsm> <output-dir>`,
        'The wrapper must write exactly one .epub or .pdf into the output directory and exit 0.'
      ]
    }
  )
}

const fulfilledOutputFormat = (fileName: string): 'epub' | 'pdf' | undefined => {
  const ext = extname(fileName).toLowerCase()
  if (ext === '.epub') return 'epub'
  if (ext === '.pdf') return 'pdf'
  return undefined
}

const ACSM_EXPIRATION_PATTERN = /<\s*(?:[A-Za-z_][\w.-]*:)?expiration\b[^>]*>([\s\S]*?)<\s*\/\s*(?:[A-Za-z_][\w.-]*:)?expiration\s*>/i

const readAcsmExpiration = async (filePath: string): Promise<Date | undefined> => {
  const source = await readFile(filePath, 'utf8')
  const expirationText = source.match(ACSM_EXPIRATION_PATTERN)?.[1]?.trim()
  if (!expirationText) {
    return undefined
  }

  const expirationTime = Date.parse(expirationText)
  return Number.isNaN(expirationTime) ? undefined : new Date(expirationTime)
}

const assertAcsmCanBeFulfilledLocally = async (
  filePath: string,
  now: Date
): Promise<void> => {
  if (!existsSync(filePath)) {
    throw InfraError(
      `ACSM input file was not found: ${filePath}`,
      {
        stage: 'download:document',
        hints: ['Check the ACSM input path, then rerun extraction.']
      }
    )
  }

  const expiration = await readAcsmExpiration(filePath)
  if (!expiration) {
    return
  }

  if (expiration.getTime() <= now.getTime()) {
    throw InfraError(
      `ACSM fulfillment token expired at ${expiration.toISOString()}; current UTC time is ${now.toISOString()}.`,
      {
        stage: 'download:document',
        hints: ['Request or download a fresh ACSM file, then rerun extraction.']
      }
    )
  }
}

const findFulfilledOutput = async (
  outputDir: string
): Promise<{ filePath: string, format: 'epub' | 'pdf' }> => {
  const entries = await readdir(outputDir, { withFileTypes: true })
  const outputs = entries
    .filter((entry) => entry.isFile())
    .map((entry) => ({ name: entry.name, format: fulfilledOutputFormat(entry.name) }))
    .filter((entry): entry is { name: string, format: 'epub' | 'pdf' } => entry.format !== undefined)

  if (outputs.length !== 1) {
    throw InfraError(
      `ACSM fulfillment contract violation: expected exactly one .epub or .pdf output, found ${outputs.length}.`,
      {
        stage: 'download:document',
        hints: [`Check that ${ACSM_FULFILL_COMMAND} writes one fulfilled EPUB or PDF into the output directory.`]
      }
    )
  }

  const output = outputs[0]!
  return {
    filePath: join(outputDir, output.name),
    format: output.format
  }
}

export const fulfillAcsmToDocument = async (
  filePath: string,
  options: FulfillAcsmOptions = {}
): Promise<FulfilledAcsmDocument> => {
  const absoluteFilePath = resolve(filePath)
  await assertAcsmCanBeFulfilledLocally(absoluteFilePath, options.now?.() ?? new Date())

  const fulfillCommand = resolveAcsmFulfillCommand(options)
  const tempDir = await mkdtemp(join(tmpdir(), 'autoshow-acsm-fulfill-'))

  try {
    await ensureDirectory(tempDir)
    const result = await exec(fulfillCommand, [absoluteFilePath, tempDir], {
      maxBufferBytes: 8 * 1024
    })

    if (result.exitCode !== 0) {
      throw InfraError(
        `ACSM fulfillment failed with exit code ${result.exitCode}.`,
        {
          stage: 'download:document',
          hints: [`Inspect ${ACSM_FULFILL_COMMAND} locally for activation, account, or distributor errors.`]
        }
      )
    }

    const fulfilled = await findFulfilledOutput(tempDir)
    return {
      ...fulfilled,
      tempCleanup: async () => {
        await rm(tempDir, { recursive: true, force: true })
      }
    }
  } catch (error) {
    await rm(tempDir, { recursive: true, force: true })
    throw error
  }
}
