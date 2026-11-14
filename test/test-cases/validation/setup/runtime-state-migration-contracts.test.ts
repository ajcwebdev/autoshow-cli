import { expect, test } from 'bun:test'
import { chmod, lstat, mkdir, readFile, readdir, rm, stat, symlink, utimes, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createRuntimeTempDirectory } from '~/utils/runtime-state'
import { migrateLegacyRuntimeState } from '~/utils/runtime-state-migration'

const tokenName = 'ocr-token-usage-profiles-v2.json'
const throughputName = 'ocr-throughput-profiles-v1.json'
const timestamp = '2026-07-01T10:00:00.000Z'
const tokenStore = {
  version: 2,
  profiles: [{
    provider: 'openai', model: 'synthetic-model', ocrMode: 'image', pageCountBand: '1', effectiveReasoningEffort: 'unspecified',
    pageCount: 1, observedPromptTokens: 123, observedCompletionTokens: 12, promptTokensPerPage: 123,
    completionTokensPerPage: 12, estimatedPromptTokens: 100, estimatedCompletionTokens: 10,
    promptTokenEstimateDelta: 23, completionTokenEstimateDelta: 2, sampleCount: 1,
    firstSeenAt: timestamp, lastSeenAt: timestamp, sourceConfidence: 'healthy'
  }]
}
const throughputStore = {
  version: 2,
  profiles: [{
    provider: 'openai', model: 'synthetic-model', scopeClass: 'image', pageCountBand: '1', ocrConcurrencyMode: 'auto',
    throughputPagesPerMinute: 10, activePeak: 1, retryPressureCount: 0, pauseTimeMs: 0, completionStatus: 'full',
    sampleCount: 1, firstSeenAt: timestamp, lastSeenAt: timestamp, cleanSampleCount: 1
  }]
}

const withMigrationFixture = async (fn: (source: string, destination: string) => Promise<void>): Promise<void> => {
  const root = await createRuntimeTempDirectory('state-migration-fixture-')
  const source = join(root, 'legacy')
  const destination = join(root, 'managed/cache')
  await mkdir(source, { recursive: true })
  try { await fn(source, destination) } finally { await rm(root, { recursive: true, force: true }) }
}

test('setup migration copies validated profile bytes and metadata while preserving originals and profile relationships', async () => {
  await withMigrationFixture(async (source, destination) => {
    const bytes = `${JSON.stringify(tokenStore, null, 2)}\n`
    const sourcePath = join(source, tokenName)
    await writeFile(sourcePath, bytes)
    await chmod(sourcePath, 0o640)
    const mtime = new Date('2026-06-03T04:05:06.000Z')
    await utimes(sourcePath, mtime, mtime)
    await writeFile(join(source, throughputName), JSON.stringify(throughputStore))
    const before = await stat(sourcePath)
    const results = await migrateLegacyRuntimeState({ legacyRoot: source, destinationCacheDir: destination })
    expect(results.map(result => result.status)).toEqual(['copied', 'copied'])
    expect(results[0]?.sha256).toBe(new Bun.CryptoHasher('sha256').update(bytes).digest('hex'))
    expect(await readFile(join(destination, tokenName), 'utf8')).toBe(bytes)
    expect(await readFile(sourcePath, 'utf8')).toBe(bytes)
    const copied = await stat(join(destination, tokenName))
    expect(copied.mode & 0o777).toBe(before.mode & 0o777)
    expect(copied.mtimeMs).toBe(before.mtimeMs)
    expect((await Bun.file(join(destination, tokenName)).json()).profiles).toEqual(tokenStore.profiles)
    expect((await readdir(destination)).sort()).toEqual([tokenName, throughputName].sort())
  })
})

test('migration never overwrites an existing destination and remains safe under concurrent repeated setup', async () => {
  await withMigrationFixture(async (source, destination) => {
    await writeFile(join(source, tokenName), JSON.stringify(tokenStore))
    const options = { legacyRoot: source, destinationCacheDir: destination }
    const results = await Promise.all([migrateLegacyRuntimeState(options), migrateLegacyRuntimeState(options)])
    expect(results.flatMap(result => result).filter(result => result.status === 'copied')).toHaveLength(1)
    const retained = '{"existing":"owned-by-current-runtime"}\n'
    await writeFile(join(destination, tokenName), retained)
    const repeat = await migrateLegacyRuntimeState(options)
    expect(repeat[0]?.status).toBe('destination-exists')
    expect(await readFile(join(destination, tokenName), 'utf8')).toBe(retained)
    expect(await readFile(join(source, tokenName), 'utf8')).toBe(JSON.stringify(tokenStore))
  })
})

test('missing profiles cause no destination creation and malformed or incompatible profiles remain untouched', async () => {
  await withMigrationFixture(async (source, destination) => {
    expect((await migrateLegacyRuntimeState({ legacyRoot: source, destinationCacheDir: destination })).map(result => result.status)).toEqual(['source-missing', 'source-missing'])
    await expect(lstat(destination)).rejects.toMatchObject({ code: 'ENOENT' })
    for (const invalid of ['{', JSON.stringify({ version: 1, profiles: [] }), JSON.stringify({ version: 2, profiles: [{ provider: 'openai' }] })]) {
      await writeFile(join(source, tokenName), invalid)
      await expect(migrateLegacyRuntimeState({ legacyRoot: source, destinationCacheDir: destination })).rejects.toThrow('original has been preserved')
      expect(await readFile(join(source, tokenName), 'utf8')).toBe(invalid)
      await expect(lstat(destination)).rejects.toMatchObject({ code: 'ENOENT' })
    }
  })
})

test('live and unverifiable legacy leases block setup migration without removing ownership or copying profiles', async () => {
  await withMigrationFixture(async (source, destination) => {
    await writeFile(join(source, tokenName), JSON.stringify(tokenStore))
    const lockRoot = join(source, 'process-locks', 'profile-writer')
    await mkdir(lockRoot, { recursive: true })
    const ownerPath = join(lockRoot, 'owner.json')
    const owner = { ownerId: 'existing-lease', hostname: 'fixture-host', pid: 123, lockName: 'profile-writer' }
    const bytes = JSON.stringify(owner)
    await writeFile(ownerPath, bytes)
    const options = { legacyRoot: source, destinationCacheDir: destination, currentHostname: 'fixture-host', isProcessAlive: () => true }
    await expect(migrateLegacyRuntimeState(options)).rejects.toThrow('active or unverifiable process')
    expect(await readFile(ownerPath, 'utf8')).toBe(bytes)
    await expect(lstat(destination)).rejects.toMatchObject({ code: 'ENOENT' })
    await writeFile(ownerPath, '{"hostname":"different-host","pid":123}')
    await expect(migrateLegacyRuntimeState({ ...options, isProcessAlive: () => false })).rejects.toThrow('active or unverifiable process')
    await writeFile(ownerPath, bytes)
    expect((await migrateLegacyRuntimeState({ ...options, isProcessAlive: () => false }))[0]?.status).toBe('copied')
    expect(await readFile(ownerPath, 'utf8')).toBe(bytes)
  })
})

test('migration rejects symlinked source profiles and escaping destinations', async () => {
  await withMigrationFixture(async (source, destination) => {
    const target = join(source, 'original.json')
    await writeFile(target, JSON.stringify(tokenStore))
    await symlink(target, join(source, tokenName))
    await expect(migrateLegacyRuntimeState({ legacyRoot: source, destinationCacheDir: destination })).rejects.toMatchObject({ code: 'ELOOP' })
    await expect(migrateLegacyRuntimeState({ legacyRoot: source, destinationCacheDir: '/external/cache' })).rejects.toThrow('inside the project runtime directory')
    expect(await readFile(target, 'utf8')).toBe(JSON.stringify(tokenStore))
  })
})
