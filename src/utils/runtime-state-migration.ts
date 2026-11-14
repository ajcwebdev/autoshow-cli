import { constants } from 'node:fs'
import { chmod, link, lstat, mkdir, open, readdir, rm, utimes } from 'node:fs/promises'
import { homedir, hostname } from 'node:os'
import { join } from 'node:path'
import { InfraError } from './error-handler'
import { withProcessLock } from './process-lock'
import { assertRuntimeContainedPath } from './runtime-paths'
import { RUNTIME_CACHE_DIR } from './runtime-state'
import { NORMALIZED_REASONING_EFFORTS } from '~/cli/commands/setup-and-utilities/models/reasoning-efforts'
import { isTokenPricedOcrProvider } from '~/types'

const LEGACY_PROFILE_FILES = ['ocr-token-usage-profiles-v2.json', 'ocr-throughput-profiles-v1.json'] as const
export type LegacyRuntimeProfileFile = typeof LEGACY_PROFILE_FILES[number]

export type LegacyRuntimeStateMigrationOptions = {
  legacyRoot?: string
  destinationCacheDir?: string
  validateProfile?: (fileName: LegacyRuntimeProfileFile, value: unknown) => boolean | Promise<boolean>
  isProcessAlive?: (pid: number) => boolean
  currentHostname?: string
}

export type LegacyRuntimeStateMigrationResult = {
  fileName: LegacyRuntimeProfileFile
  status: 'copied' | 'destination-exists' | 'source-missing'
  sha256?: string
}

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const stringsPresent = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  keys.every(key => typeof value[key] === 'string' && (value[key] as string).length > 0)

const finiteNumbersPresent = (value: Record<string, unknown>, keys: readonly string[]): boolean =>
  keys.every(key => typeof value[key] === 'number' && Number.isFinite(value[key]))

const datesPresent = (value: Record<string, unknown>): boolean =>
  ['firstSeenAt', 'lastSeenAt'].every(key => typeof value[key] === 'string' && Number.isFinite(Date.parse(value[key] as string)))

const validTokenProfile = (value: unknown): boolean => record(value)
  && isTokenPricedOcrProvider(value['provider'])
  && stringsPresent(value, ['model', 'ocrMode', 'pageCountBand'])
  && finiteNumbersPresent(value, ['pageCount', 'observedPromptTokens', 'observedCompletionTokens', 'promptTokensPerPage', 'completionTokensPerPage', 'estimatedPromptTokens', 'estimatedCompletionTokens', 'promptTokenEstimateDelta', 'completionTokenEstimateDelta', 'sampleCount'])
  && ['unspecified', ...NORMALIZED_REASONING_EFFORTS].some(effort => effort === value['effectiveReasoningEffort'])
  && datesPresent(value)

const validThroughputProfile = (value: unknown): boolean => record(value)
  && stringsPresent(value, ['provider', 'model', 'scopeClass', 'pageCountBand'])
  && finiteNumbersPresent(value, ['throughputPagesPerMinute', 'activePeak', 'retryPressureCount', 'pauseTimeMs', 'sampleCount'])
  && (value['ocrConcurrencyMode'] === 'auto' || value['ocrConcurrencyMode'] === 'fixed')
  && ['full', 'incomplete', 'failed'].some(status => status === value['completionStatus'])
  && datesPresent(value)

const validateKnownProfile = (fileName: LegacyRuntimeProfileFile, value: unknown): boolean =>
  record(value) && value['version'] === 2 && Array.isArray(value['profiles'])
  && value['profiles'].every(fileName === 'ocr-token-usage-profiles-v2.json' ? validTokenProfile : validThroughputProfile)

const defaultProcessAlive = (pid: number): boolean => {
  try { process.kill(pid, 0); return true } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false
    if ((error as NodeJS.ErrnoException).code === 'EPERM') return true
    throw error
  }
}

const isMissing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT'

const assertLegacyWritersStopped = async (legacyRoot: string, options: LegacyRuntimeStateMigrationOptions): Promise<void> => {
  const lockRoot = join(legacyRoot, 'process-locks')
  let entries: string[]
  try { entries = await readdir(lockRoot) } catch (error) { if (isMissing(error)) return; throw error }
  for (const name of entries) {
    if (name === '.DS_Store') continue
    const lockDir = join(lockRoot, name)
    const info = await lstat(lockDir)
    if (!info.isDirectory() && !info.isSymbolicLink()) continue
    let owner: unknown
    try { owner = JSON.parse(await Bun.file(join(lockDir, 'owner.json')).text()) } catch { owner = undefined }
    const verifiedDeadOwner = !info.isSymbolicLink() && record(owner)
      && owner['hostname'] === (options.currentHostname ?? hostname())
      && Number.isSafeInteger(owner['pid']) && (owner['pid'] as number) > 0
      && !(options.isProcessAlive ?? defaultProcessAlive)(owner['pid'] as number)
    if (!verifiedDeadOwner) {
      throw InfraError('Legacy runtime state is locked by an active or unverifiable process.', {
        stage: 'setup:runtime-state-migration',
        hints: ['Stop older CLI processes and verify their legacy process locks are released, then rerun setup. Existing locks and profile files have been preserved.'],
        metadata: { lockName: name }
      })
    }
  }
}

const destinationExists = async (path: string): Promise<boolean> => {
  try { await lstat(path); return true } catch (error) { if (isMissing(error)) return false; throw error }
}

const migrateProfile = async (
  fileName: LegacyRuntimeProfileFile,
  legacyRoot: string,
  destinationRoot: string,
  validate: NonNullable<LegacyRuntimeStateMigrationOptions['validateProfile']>
): Promise<LegacyRuntimeStateMigrationResult> => {
  const destination = join(destinationRoot, fileName)
  if (await destinationExists(destination)) return { fileName, status: 'destination-exists' }
  const source = join(legacyRoot, fileName)
  let input: Awaited<ReturnType<typeof open>>
  try { input = await open(source, constants.O_RDONLY | constants.O_NOFOLLOW) } catch (error) {
    if (isMissing(error)) return { fileName, status: 'source-missing' }
    throw error
  }
  let bytes: Buffer
  let sourceStats: Awaited<ReturnType<typeof input.stat>>
  try {
    sourceStats = await input.stat()
    if (!sourceStats.isFile() || sourceStats.size > 16 * 1024 * 1024) {
      throw InfraError(`Legacy profile ${fileName} is not a bounded regular file.`, { stage: 'setup:runtime-state-migration' })
    }
    bytes = await input.readFile()
    let value: unknown
    try { value = JSON.parse(bytes.toString('utf8')) } catch {
      throw InfraError(`Legacy profile ${fileName} contains invalid JSON. The original has been preserved.`, { stage: 'setup:runtime-state-migration' })
    }
    if (!await validate(fileName, value)) {
      throw InfraError(`Legacy profile ${fileName} has an unsupported schema. The original has been preserved.`, { stage: 'setup:runtime-state-migration' })
    }
    const after = await input.stat()
    if (sourceStats.size !== after.size || sourceStats.mtimeMs !== after.mtimeMs || sourceStats.ctimeMs !== after.ctimeMs) {
      throw InfraError(`Legacy profile ${fileName} changed during migration. Rerun setup after older CLI processes stop.`, { stage: 'setup:runtime-state-migration' })
    }
  } finally { await input.close() }
  await mkdir(destinationRoot, { recursive: true })
  assertRuntimeContainedPath(destinationRoot)
  const staged = join(destinationRoot, `.${fileName}.${crypto.randomUUID()}.tmp`)
  try {
    const output = await open(staged, 'wx', sourceStats.mode & 0o777)
    try { await output.writeFile(bytes); await output.sync() } finally { await output.close() }
    await chmod(staged, sourceStats.mode & 0o777)
    await utimes(staged, sourceStats.atime, sourceStats.mtime)
    try { await link(staged, destination) } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') return { fileName, status: 'destination-exists' }
      throw error
    }
    return { fileName, status: 'copied', sha256: new Bun.CryptoHasher('sha256').update(bytes).digest('hex') }
  } finally { await rm(staged, { force: true }) }
}

/** Mutating setup calls this explicitly; diagnostics and dry runs never migrate state. */
export const migrateLegacyRuntimeState = async (
  options: LegacyRuntimeStateMigrationOptions = {}
): Promise<LegacyRuntimeStateMigrationResult[]> => {
  const legacyRoot = options.legacyRoot ?? join(homedir(), '.cache', 'autoshow-cli')
  const destinationRoot = assertRuntimeContainedPath(options.destinationCacheDir ?? RUNTIME_CACHE_DIR)
  return await withProcessLock('legacy-runtime-state-migration', async () => {
    await assertLegacyWritersStopped(legacyRoot, options)
    const results: LegacyRuntimeStateMigrationResult[] = []
    for (const fileName of LEGACY_PROFILE_FILES) results.push(await migrateProfile(fileName, legacyRoot, destinationRoot, options.validateProfile ?? validateKnownProfile))
    return results
  })
}
