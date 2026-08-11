import { afterEach, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createProtectedVoiceAssetStore,
  resolveProtectedVoiceAsset
} from '~/cli/commands/process-steps/step-4-tts/voice-assets/protected-voice-asset-store'

const roots: string[] = []

const makeRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-protected-voice-assets-'))
  roots.push(root)
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('Phase 0 protected voice asset store', () => {
  test('price planning hashes in memory without materializing a store or exposing the source path', async () => {
    const root = await makeRoot()
    const sourcePath = join(root, 'sensitive-performer-name.wav')
    const storeRoot = join(root, 'protected-store')
    const bytes = Buffer.from('reference-audio-bytes')
    await writeFile(sourcePath, bytes)
    const store = createProtectedVoiceAssetStore({ storeId: 'mistral_refs', root: storeRoot })

    const plan = await store.plan({
      speakerKey: 'role:narrator',
      sourcePath,
      authorizationRef: 'authorization_123'
    })

    expect(plan).toEqual({
      materialization: 'non-materialized',
      protectedAsset: {
        storeId: 'mistral_refs',
        assetId: `sha256_${createHash('sha256').update(bytes).digest('hex')}`,
        sha256: createHash('sha256').update(bytes).digest('hex')
      },
      authorizationRef: 'authorization_123',
      byteLength: bytes.byteLength,
      speakerKey: 'role:narrator'
    })
    expect(JSON.stringify(plan)).not.toContain(sourcePath)
    expect(await Bun.file(storeRoot).exists()).toBe(false)
  })

  test('ingests atomically with owner-only permissions and resolves verified bytes', async () => {
    const root = await makeRoot()
    const sourcePath = join(root, 'reference.wav')
    const storeRoot = join(root, 'protected-store')
    const bytes = Buffer.from('voice-reference')
    await writeFile(sourcePath, bytes)
    const store = createProtectedVoiceAssetStore({ storeId: 'mistral_refs', root: storeRoot })

    const materialized = await store.ingest({ sourcePath, authorizationRef: 'authorization_123' })
    const resolvedPath = await store.resolve(materialized.protectedAsset)

    expect(materialized.materialization).toBe('materialized')
    expect(await readFile(resolvedPath)).toEqual(bytes)
    expect((await lstat(storeRoot)).mode & 0o777).toBe(0o700)
    expect((await lstat(join(storeRoot, 'assets'))).mode & 0o777).toBe(0o700)
    expect((await lstat(resolvedPath)).mode & 0o777).toBe(0o600)
    expect(materialized.protectedAsset.assetId).toMatch(/^[a-z0-9][a-z0-9_-]{0,127}$/)
  })

  test('deduplicates concurrent ingestion of identical bytes without leftover work files', async () => {
    const root = await makeRoot()
    const firstSource = join(root, 'first.wav')
    const secondSource = join(root, 'second.wav')
    const storeRoot = join(root, 'protected-store')
    await Promise.all([
      writeFile(firstSource, 'same-reference-bytes'),
      writeFile(secondSource, 'same-reference-bytes')
    ])
    const store = createProtectedVoiceAssetStore({ storeId: 'mistral_refs', root: storeRoot })

    const results = await Promise.all(Array.from({ length: 8 }, (_, index) => store.ingest({
      sourcePath: index % 2 === 0 ? firstSource : secondSource,
      authorizationRef: 'authorization_123'
    })))

    expect(new Set(results.map(result => result.protectedAsset.assetId)).size).toBe(1)
    expect(await readdir(join(storeRoot, 'assets'))).toEqual([results[0]!.protectedAsset.assetId])
  })

  test('rejects unsafe IDs, store symlinks, source symlinks, and asset symlink escapes', async () => {
    const root = await makeRoot()
    const sourcePath = join(root, 'reference.wav')
    const sourceLink = join(root, 'reference-link.wav')
    const actualStore = join(root, 'actual-store')
    const linkedStore = join(root, 'linked-store')
    await writeFile(sourcePath, 'voice-reference')
    await symlink(sourcePath, sourceLink)
    await mkdir(actualStore, { mode: 0o700 })
    await symlink(actualStore, linkedStore)

    const unsafeStore = createProtectedVoiceAssetStore({ storeId: '../mistral', root: join(root, 'unsafe') })
    await expect(unsafeStore.plan({ sourcePath, authorizationRef: 'authorization_123' })).rejects.toThrow('opaque lowercase identifier')

    const sourceSafeStore = createProtectedVoiceAssetStore({ storeId: 'mistral_refs', root: join(root, 'source-safe') })
    await expect(sourceSafeStore.plan({ sourcePath: sourceLink, authorizationRef: 'authorization_123' })).rejects.toThrow('regular non-symlink file')

    const linked = createProtectedVoiceAssetStore({ storeId: 'mistral_refs', root: linkedStore })
    await expect(linked.ingest({ sourcePath, authorizationRef: 'authorization_123' })).rejects.toThrow('cannot be a symbolic link')

    const store = createProtectedVoiceAssetStore({ storeId: 'mistral_refs', root: join(root, 'protected-store') })
    const materialized = await store.ingest({ sourcePath, authorizationRef: 'authorization_123' })
    const assetPath = await store.resolve(materialized.protectedAsset)
    const outsidePath = join(root, 'outside.wav')
    await writeFile(outsidePath, 'voice-reference')
    await unlink(assetPath)
    await symlink(outsidePath, assetPath)
    await expect(store.resolve(materialized.protectedAsset)).rejects.toThrow('missing or is not a regular file')
  })

  test('resolver is non-creating and rejects permission, checksum, and store mismatches', async () => {
    const root = await makeRoot()
    const missingStoreRoot = join(root, 'missing-store')
    const sha256 = createHash('sha256').update('missing').digest('hex')
    await expect(resolveProtectedVoiceAsset({ storeId: 'mistral_refs', root: missingStoreRoot }, {
      storeId: 'mistral_refs',
      assetId: `sha256_${sha256}`,
      sha256
    })).rejects.toThrow('root is missing')
    expect(await Bun.file(missingStoreRoot).exists()).toBe(false)

    const sourcePath = join(root, 'reference.wav')
    const storeRoot = join(root, 'protected-store')
    await writeFile(sourcePath, 'voice-reference')
    const store = createProtectedVoiceAssetStore({ storeId: 'mistral_refs', root: storeRoot })
    const materialized = await store.ingest({ sourcePath, authorizationRef: 'authorization_123' })
    const assetPath = await store.resolve(materialized.protectedAsset)

    await expect(resolveProtectedVoiceAsset({ storeId: 'another_store', root: storeRoot }, materialized.protectedAsset)).rejects.toThrow('different registered store')

    await chmod(assetPath, 0o644)
    await expect(store.resolve(materialized.protectedAsset)).rejects.toThrow('permissions are not owner-only')
    await chmod(assetPath, 0o600)
    await writeFile(assetPath, 'tampered')
    await expect(store.resolve(materialized.protectedAsset)).rejects.toThrow('checksum does not match')
  })
})
