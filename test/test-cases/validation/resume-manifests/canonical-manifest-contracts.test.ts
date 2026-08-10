import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import {
  createManifest,
  createManifestItem,
  PIPELINE_MANIFEST_FILE,
  readManifest,
  updateManifest,
  writeManifest
} from '~/cli/commands/process-steps/pipeline-manifest'
import { PROCESS_COMMANDS } from '~/types'
import type { PipelineManifest, PipelineProviderState } from '~/types'
import { withTempDir } from '../../../test-utils/temp-dirs'

const provider = (
  rootDir: string,
  status: PipelineProviderState['status']
): PipelineProviderState => ({
  service: 'fixture',
  model: 'fixture-v1',
  artifactDir: join(rootDir, 'providers', 'fixture'),
  status,
  attempts: status === 'missing' ? 0 : 1,
  options: { language: 'en' },
  metadata: status === 'succeeded' ? { processingTime: 1 } : {},
  ...(status === 'failed' ? { error: { message: 'fixture failure', retryable: true } } : {})
})

describe('canonical pipeline manifest', () => {
  test('every command and scope uses one unversioned top-level shape', async () => {
    await withTempDir('autoshow-canonical-manifest-', async (dir) => {
      for (const command of PROCESS_COMMANDS) {
        for (const scope of ['single', 'batch'] as const) {
          const itemCount = scope === 'single' ? 1 : 2
          const manifest = createManifest(command, scope, Array.from({ length: itemCount }, (_, index) =>
            createManifestItem(dir, {
              input: `input-${index}`,
              outputDir: join(dir, `item-${index}`),
              status: 'full',
              metadata: { index },
              providers: []
            })
          ))
          await writeManifest(dir, manifest)
          const stored = await readManifest(dir)
          expect(stored?.command).toBe(command)
          expect(stored?.scope).toBe(scope)
          expect(stored?.items).toHaveLength(itemCount)
          expect(Object.keys(stored ?? {}).sort()).toEqual(['command', 'createdAt', 'items', 'scope', 'updatedAt'])
          expect((stored as unknown as Record<string, unknown>)['schemaVersion']).toBeUndefined()
          expect((stored as unknown as Record<string, unknown>)['kind']).toBeUndefined()
        }
      }
    })
  })

  test('one provider-state vocabulary carries progress, success, failure, missing, and skipped state', async () => {
    await withTempDir('autoshow-provider-state-', async (dir) => {
      const statuses: PipelineProviderState['status'][] = ['running', 'succeeded', 'missing', 'failed', 'skipped']
      await writeManifest(dir, createManifest('extract', 'batch', statuses.map((status, index) =>
        createManifestItem(dir, {
          input: `input-${index}`,
          extractRoute: 'media',
          outputDir: join(dir, `item-${index}`),
          status: status === 'succeeded' || status === 'skipped' ? 'full' : status === 'failed' ? 'failed' : 'incomplete',
          metadata: {},
          providers: [provider(dir, status)]
        })
      )))

      expect((await readManifest(dir))?.items.map((item) => item.providers[0]?.status)).toEqual(statuses)
    })
  })

  test('single-item batches and mixed-route child links are explicit data', async () => {
    await withTempDir('autoshow-child-links-', async (dir) => {
      const item = createManifestItem(dir, {
        input: 'document.pdf',
        inputFamily: 'document',
        extractRoute: 'document',
        child: { route: 'document', index: 0, manifestDir: join(dir, 'document') },
        status: 'incomplete',
        metadata: {},
        providers: []
      })
      await writeManifest(dir, createManifest('extract', 'batch', [item]))

      const stored = await readManifest(dir)
      expect(stored?.scope).toBe('batch')
      expect(stored?.items[0]?.child).toEqual({ route: 'document', index: 0, manifestDir: 'document' })
    })
  })

  test('provider progress updates atomically without parallel completion lists', async () => {
    await withTempDir('autoshow-provider-update-', async (dir) => {
      await writeManifest(dir, createManifest('extract', 'single', [
        createManifestItem(dir, {
          input: 'audio.wav',
          extractRoute: 'media',
          outputDir: dir,
          status: 'incomplete',
          metadata: {},
          providers: [provider(dir, 'missing')]
        })
      ]))
      await updateManifest(dir, (manifest) => ({
        ...manifest,
        items: manifest.items.map((item) => ({
          ...item,
          status: 'full',
          providers: item.providers.map((state) => ({
            ...state,
            status: 'succeeded',
            attempts: 1,
            metadata: { processingTime: 1 }
          }))
        }))
      }))

      const raw = await Bun.file(join(dir, PIPELINE_MANIFEST_FILE)).json() as Record<string, unknown>
      const serialized = JSON.stringify(raw)
      expect(serialized).not.toContain('requestedProviders')
      expect(serialized).not.toContain('missingProviders')
      expect(serialized).not.toContain('completionStatus')
      expect((await readManifest(dir))?.items[0]?.providers[0]?.status).toBe('succeeded')
    })
  })

  test('missing and malformed files have distinct local outcomes', async () => {
    await withTempDir('autoshow-malformed-manifest-', async (dir) => {
      expect(await readManifest(dir)).toBeUndefined()
      await Bun.write(join(dir, PIPELINE_MANIFEST_FILE), '{not json')
      await expect(readManifest(dir)).rejects.toThrow('Malformed canonical manifest')
    })
  })

  test('invalid shape and corrupt rewrites fail before they can replace canonical bytes', async () => {
    await withTempDir('autoshow-invalid-manifest-', async (dir) => {
      const valid = createManifest('download', 'single', [
        createManifestItem(dir, { input: 'source', outputDir: dir, status: 'full', metadata: {}, providers: [] })
      ])
      await writeManifest(dir, valid)
      const before = await Bun.file(join(dir, PIPELINE_MANIFEST_FILE)).text()
      const corrupt = {
        ...valid,
        items: [{ ...valid.items[0], legacyCompletionStatus: 'full' }]
      } as unknown as PipelineManifest
      await expect(writeManifest(dir, corrupt)).rejects.toThrow('Invalid canonical manifest')
      await expect(writeManifest(dir, {
        ...valid,
        items: [valid.items[0]!, valid.items[0]!]
      })).rejects.toThrow('Invalid canonical manifest')
      await expect(writeManifest(dir, createManifest('extract', 'batch', [{
        ...valid.items[0]!,
        extractRoute: 'document',
        child: { route: 'media', index: 0, manifestDir: 'media' }
      }]))).rejects.toThrow('Invalid canonical manifest')
      expect(await Bun.file(join(dir, PIPELINE_MANIFEST_FILE)).text()).toBe(before)
    })
  })

  test('output, child, and provider paths cannot escape their run root', async () => {
    await withTempDir('autoshow-contained-manifest-', async (dir) => {
      expect(() => createManifestItem(dir, {
        outputDir: '../escape',
        status: 'incomplete',
        metadata: {},
        providers: []
      })).toThrow('escapes its run root')
      expect(() => createManifestItem(dir, {
        child: { route: 'media', index: 0, manifestDir: '/tmp/escape' },
        status: 'incomplete',
        metadata: {},
        providers: []
      })).toThrow('escapes its run root')
      expect(() => createManifestItem(dir, {
        status: 'incomplete',
        metadata: {},
        providers: [{ ...provider(dir, 'missing'), artifactDir: '../../escape' }]
      })).toThrow('escapes its run root')
    })
  })
})
