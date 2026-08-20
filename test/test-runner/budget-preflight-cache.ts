import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { BudgetPreflightCacheFile, PriceCommandSpec } from '~/types'
import { MODEL_CONFIG_PATHS } from '~/cli/commands/setup-and-utilities/models/model-loader/paths'
import { EMPTY_PRICE_CONFIG_PATH } from './price-command-config'
import { sha256Bytes } from '~/utils/value-helpers'

const CACHE_VERSION = 1
const CACHE_PATH = resolve(process.cwd(), 'project/test-output/.test-cache/budget-preflight.json')

const PRICING_SOURCE_FILES = [
  'src/cli/commands/process-steps/step-5-image/image-utils/image-pricing.ts',
  'src/cli/commands/process-steps/step-6-video/video-utils/video-pricing.ts',
  'src/cli/commands/process-steps/step-7-music/music-utils/music-pricing.ts',
  'src/cli/commands/process-steps/step-4-tts/tts-utils/tts-pricing.ts',
  'src/cli/commands/process-steps/step-3-write/write-utils/llm-pricing.ts',
  'src/cli/commands/setup-and-utilities/models/model-loader/retired-model-rates.ts',
  'src/utils/pricing/scrapecreators-pricing.ts',
  'src/utils/pricing/token-pricing.ts',
  'src/utils/pricing/ocr-token-pricing.ts',
  'src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/happyscribe/happyscribe-pricing.ts',
  'src/cli/commands/pricing-orchestration/supadata-pricing.ts',
  EMPTY_PRICE_CONFIG_PATH
] as const

const listJsonFiles = async (path: string): Promise<string[]> => {
  try {
    const info = await stat(path)
    if (info.isFile()) {
      return [path]
    }
    if (!info.isDirectory()) {
      return [path]
    }
  } catch {
    return [path]
  }

  const entries = await readdir(path, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => resolve(path, entry.name))
    .sort()
}

const listTsFiles = async (directory: string): Promise<string[]> => {
  let entries
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch {
    return []
  }

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
    .map((entry) => resolve(directory, entry.name))
    .sort()
}

const localArgvFiles = (commands: readonly PriceCommandSpec[]): string[] => {
  const files = new Set<string>()
  for (const command of commands) {
    for (const arg of command.args) {
      if (arg.startsWith('-') || arg.startsWith('https://') || arg.startsWith('http://') || arg === 'src/cli/create-cli.ts') {
        continue
      }
      files.add(resolve(process.cwd(), arg))
    }
  }
  return [...files].sort()
}

const hashFileContents = async (paths: readonly string[]): Promise<string> => {
  const contents = await Promise.all(paths.map(async (path) => {
    try {
      return await readFile(path)
    } catch {
      return 'missing'
    }
  }))
  const hasher = createHash('sha256Bytes')
  for (const [index, path] of paths.entries()) {
    hasher.update(path)
    hasher.update('\0')
    hasher.update(contents[index] ?? 'missing')
    hasher.update('\0')
  }
  return hasher.digest('hex')
}

export const argvKeyFor = (args: readonly string[]): string =>
  sha256Bytes(JSON.stringify(args))

export const hashBudgetPreflightInputs = async (
  commands: readonly PriceCommandSpec[]
): Promise<string> => {
  const configFiles = (await Promise.all(Object.values(MODEL_CONFIG_PATHS).map(listJsonFiles))).flat()
  const registryFiles = await listTsFiles(resolve(import.meta.dir, 'price-commands/registry'))
  const hashedPaths = [
    ...new Set([
      ...configFiles,
      ...PRICING_SOURCE_FILES.map((path) => resolve(process.cwd(), path)),
      ...registryFiles,
      ...localArgvFiles(commands)
    ])
  ].sort()

  return hashFileContents(hashedPaths)
}

export const readBudgetPreflightCache = async (
  fingerprint: string
): Promise<Map<string, number>> => {
  try {
    const parsed = JSON.parse(await readFile(CACHE_PATH, 'utf8')) as BudgetPreflightCacheFile
    if (parsed.version !== CACHE_VERSION || parsed.fingerprint !== fingerprint || !Array.isArray(parsed.entries)) {
      return new Map()
    }
    return new Map(
      parsed.entries.flatMap((entry) =>
        typeof entry.argvKey === 'string' && typeof entry.costCents === 'number' && Number.isFinite(entry.costCents)
          ? [[entry.argvKey, entry.costCents] as const]
          : []
      )
    )
  } catch {
    return new Map()
  }
}

export const writeBudgetPreflightCache = async (
  fingerprint: string,
  entries: ReadonlyMap<string, number>
): Promise<void> => {
  await mkdir(resolve(process.cwd(), 'project/test-output/.test-cache'), { recursive: true })
  const payload: BudgetPreflightCacheFile = {
    version: CACHE_VERSION,
    fingerprint,
    entries: [...entries.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([argvKey, costCents]) => ({ argvKey, costCents }))
  }
  await writeFile(CACHE_PATH, `${JSON.stringify(payload, null, 2)}\n`)
}
