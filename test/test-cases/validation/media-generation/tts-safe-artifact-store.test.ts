import { describe, expect, test } from 'bun:test'
import { lstat, mkdir, readFile, readdir, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  ArtifactReservationConflictError,
  ensureSafeArtifactDirectory,
  readContainedArtifactFile,
  releasePreparedInvocationAttemptClaim,
  reserveInvocationAttemptDirectory,
  writeImmutableArtifactFile,
} from '~/cli/commands/process-steps/step-4-tts/script-to-audio/safe-artifact-store'
import { withTempDir } from '../../../test-utils/temp-dirs'

describe('safe script-to-audio artifact store', () => {
  test('creates only contained real directory chains', async () => {
    await withTempDir('autoshow-tts-safe-directory-', async (rootDir) => {
      const created = await ensureSafeArtifactDirectory(rootDir, 'providers/target/renders')
      expect(created.relativePath).toBe('providers/target/renders')
      expect((await lstat(created.path)).isDirectory()).toBe(true)

      for (const unsafe of ['../outside', '/absolute', 'providers//target', 'providers\\target', 'providers/%2e%2e/outside']) {
        await expect(ensureSafeArtifactDirectory(rootDir, unsafe)).rejects.toThrow('safe contained POSIX path')
      }
    })
  })

  test('rejects a symbolic-link directory ancestor before touching its destination', async () => {
    await withTempDir('autoshow-tts-safe-directory-link-', async (rootDir) => {
      const artifactRoot = join(rootDir, 'artifact-root')
      const outside = join(rootDir, 'outside')
      await mkdir(artifactRoot)
      await mkdir(outside)
      await symlink(outside, join(artifactRoot, 'providers'))

      await expect(
        writeImmutableArtifactFile(artifactRoot, 'providers/target/render-plan.json', 'forbidden\n')
      ).rejects.toThrow('cannot traverse a symbolic link')
      expect(await Bun.file(join(outside, 'target', 'render-plan.json')).exists()).toBe(false)
    })
  })

  test('writes immutable files atomically and permits only exact-byte idempotency', async () => {
    await withTempDir('autoshow-tts-safe-file-', async (rootDir) => {
      const first = await writeImmutableArtifactFile(rootDir, 'providers/target/branch-plan.json', 'same bytes\n')
      const second = await writeImmutableArtifactFile(rootDir, 'providers/target/branch-plan.json', 'same bytes\n')

      expect(first.created).toBe(true)
      expect(second.created).toBe(false)
      expect(second.sha256).toBe(first.sha256)
      expect(await readFile(first.path, 'utf8')).toBe('same bytes\n')
      await expect(
        writeImmutableArtifactFile(rootDir, 'providers/target/branch-plan.json', 'different bytes\n')
      ).rejects.toThrow('different bytes')
      expect(await readFile(first.path, 'utf8')).toBe('same bytes\n')
    })
  })

  test('rejects a symbolic-link file without changing the linked bytes', async () => {
    await withTempDir('autoshow-tts-safe-file-link-', async (rootDir) => {
      const outside = join(rootDir, 'outside.json')
      await writeFile(outside, 'outside remains\n')
      await ensureSafeArtifactDirectory(rootDir, 'providers/target')
      await symlink(outside, join(rootDir, 'providers/target/render-plan.json'))

      await expect(
        writeImmutableArtifactFile(rootDir, 'providers/target/render-plan.json', 'replacement\n')
      ).rejects.toThrow('non-symlink file')
      expect(await readFile(outside, 'utf8')).toBe('outside remains\n')
    })
  })

  test('reads only contained regular files without following final or ancestor symbolic links', async () => {
    await withTempDir('autoshow-tts-safe-read-', async (rootDir) => {
      const written = await writeImmutableArtifactFile(
        rootDir,
        'providers/target/render-plan.json',
        'retained bytes\n'
      )
      const retained = await readContainedArtifactFile(rootDir, written.relativePath)
      expect(retained.bytes.toString('utf8')).toBe('retained bytes\n')
      expect(retained.sha256).toBe(written.sha256)

      const outsideDirectory = join(rootDir, 'outside-directory')
      await mkdir(outsideDirectory)
      await writeFile(join(outsideDirectory, 'outside.json'), 'outside directory bytes\n')
      await symlink(outsideDirectory, join(rootDir, 'linked-directory'))
      await expect(
        readContainedArtifactFile(rootDir, 'linked-directory/outside.json')
      ).rejects.toThrow('cannot traverse a symbolic link')

      const outsideFile = join(rootDir, 'outside-file.json')
      await writeFile(outsideFile, 'outside file bytes\n')
      await symlink(outsideFile, join(rootDir, 'providers/target/linked.json'))
      await expect(
        readContainedArtifactFile(rootDir, 'providers/target/linked.json')
      ).rejects.toThrow('non-symlink file')

      await expect(
        readContainedArtifactFile(rootDir, 'missing/never-created.json')
      ).rejects.toThrow()
      expect(await Bun.file(join(rootDir, 'missing')).exists()).toBe(false)
      expect(await readFile(outsideFile, 'utf8')).toBe('outside file bytes\n')
    })
  })

  test('atomically promotes one complete concurrent writer and removes temporary files', async () => {
    await withTempDir('autoshow-tts-safe-file-race-', async (rootDir) => {
      const firstBytes = Buffer.alloc(2 * 1024 * 1024, 0x41)
      const secondBytes = Buffer.alloc(2 * 1024 * 1024, 0x42)
      const relativePath = 'providers/target/provider-result.json'
      const outcomes = await Promise.allSettled([
        writeImmutableArtifactFile(rootDir, relativePath, firstBytes),
        writeImmutableArtifactFile(rootDir, relativePath, secondBytes)
      ])

      expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1)
      expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1)
      const finalBytes = await readFile(join(rootDir, relativePath))
      expect(finalBytes.equals(firstBytes) || finalBytes.equals(secondBytes)).toBe(true)
      expect(finalBytes.byteLength).toBe(firstBytes.byteLength)
      expect((await readdir(join(rootDir, 'providers/target'))).some((name) => name.startsWith('.immutable-'))).toBe(false)
    })
  })

  test('exclusively reserves one logical attempt across different invocation identities', async () => {
    await withTempDir('autoshow-tts-safe-attempt-', async (rootDir) => {
      const shared = {
        attemptsDirectory: 'providers/target/renders/render-id/attempts',
        attempt: 1
      } as const
      const outcomes = await Promise.allSettled([
        reserveInvocationAttemptDirectory(rootDir, { ...shared, invocationId: 'invocation-first' }),
        reserveInvocationAttemptDirectory(rootDir, { ...shared, invocationId: 'invocation-second' })
      ])
      const successes = outcomes.filter((outcome) => outcome.status === 'fulfilled')
      const failures = outcomes.filter((outcome) => outcome.status === 'rejected')

      expect(successes).toHaveLength(1)
      expect(failures).toHaveLength(1)
      const reserved = (successes[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof reserveInvocationAttemptDirectory>>>).value
      expect(reserved.relativePath).toMatch(/attempt-001-invocation-(?:first|second)$/)
      expect((await lstat(reserved.path)).isDirectory()).toBe(true)
      expect((failures[0] as PromiseRejectedResult).reason).toBeInstanceOf(ArtifactReservationConflictError)
      expect((await readdir(join(rootDir, shared.attemptsDirectory))).filter((name) => name.startsWith('attempt-001-'))).toHaveLength(1)

      await expect(releasePreparedInvocationAttemptClaim(rootDir, {
        ...shared,
        invocationId: reserved.invocationId === 'invocation-first'
          ? 'invocation-second'
          : 'invocation-first'
      })).rejects.toThrow('different immutable invocation')
      await releasePreparedInvocationAttemptClaim(rootDir, {
        ...shared,
        invocationId: reserved.invocationId
      })
      const retry = await reserveInvocationAttemptDirectory(rootDir, {
        ...shared,
        invocationId: 'invocation-prepared-only-retry'
      })
      expect(retry.relativePath).toEndWith('attempt-001-invocation-prepared-only-retry')
      expect((await readdir(join(rootDir, shared.attemptsDirectory))).filter((name) => name.startsWith('attempt-001-'))).toHaveLength(2)
      await retry.release()
      await retry.release()
    })
  })
})
