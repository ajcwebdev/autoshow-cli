import { describe,expect,test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import {
createManifest,
createManifestItem,
createPipelineItemFromRecord,
derivePipelineItemRecord,
readManifest,
updateManifest,
writeManifest
} from '~/cli/commands/process-steps/pipeline-manifest'
import type { PipelineManifest,PipelineProviderState } from '~/types'
import { PROCESS_COMMANDS } from '~/types'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { policySkippedTtsProviderStateFrom } from '../../../test-utils/tts-provider-state-fixtures'

const policySkippedState = (targetKey: string, artifactDir = `providers/${targetKey}`): PipelineProviderState =>
  policySkippedTtsProviderStateFrom({
    target: { service: 'openai', model: 'fixture-tts', transport: 'hosted-api', targetKey },
    artifactDir,
    skipId: `skip-${targetKey}`,
    actorId: 'agreement-harness',
    reason: 'agreement fixture skip',
    local: false
  })

describe('manifest validator agreement harness', () => {
  test('manifest write, read, and mutation parity across commands and scopes', async () => {
    await withTempDir('validator-agreement-', async (dir) => {
      const commands = PROCESS_COMMANDS.filter((candidate) => candidate !== 'comic')
      for (const command of commands) {
        for (const scope of ['single', 'batch'] as const) {
          const caseDir = join(dir, `${command}-${scope}`)
          await mkdir(caseDir, { recursive: true })
          const targetKey = canonicalTargetKey('tts-synthesis', 'openai', 'fixture-tts', 'hosted-api')
          const itemCount = scope === 'single' ? 1 : 3

          const manifest = createManifest(command, scope, Array.from({ length: itemCount }, (_, index) => {
            const isTts = command === 'tts'
            const isProviderStep = command === 'extract' || command === 'write' || command === 'music'
            return createManifestItem(caseDir, {
              input: `source-${index}.txt`,
              outputDir: join(caseDir, `item-${index}`),
              status: isTts ? 'skipped' : 'full',
              metadata: { index, title: `Item ${index}` },
              providers: isTts
                ? [policySkippedState(targetKey, `item-${index}/providers/${targetKey}`)]
                : isProviderStep
                  ? [{
                      service: 'gemini',
                      model: 'flash',
                      artifactDir: `item-${index}/providers/gemini`,
                      status: 'succeeded',
                      attempts: 1,
                      options: {},
                      metadata: { cost: 0.1 },
                      result: { text: 'ok' }
                    }]
                  : []
            })
          }))

          const written = await writeManifest(caseDir, manifest)
          const read = await readManifest(caseDir)
          expect(read).toBeDefined()
          expect(read?.command).toBe(command)
          expect(read?.scope).toBe(scope)
          expect(read?.items).toHaveLength(itemCount)
          expect(read?.updatedAt).toBe(written.updatedAt)

          for (const item of read?.items ?? []) {
            const derived = derivePipelineItemRecord(caseDir, item)
            expect(derived).toBeDefined()
            expect(derived['completionStatus']).toBe(item.status)
            const recreated = createPipelineItemFromRecord(caseDir, derived, {
              status: item.status,
              outputDir: item.outputDir
            })
            expect(recreated.status).toBe(item.status)
            expect(recreated.providers.length).toBe(item.providers.length)
          }

          if (command !== 'tts') {
            const updated = await updateManifest(caseDir, (curr) => ({
              ...curr,
              items: curr.items.map((it) => ({
                ...it,
                metadata: { ...it.metadata, audited: true }
              }))
            }))
            expect(updated.items[0]?.metadata['audited']).toBe(true)
          }
        }
      }
    })
  })

  test('validator reject parity on corrupt and invalid manifests', async () => {
    await withTempDir('validator-reject-corpus-', async (dir) => {
      const valid = createManifest('download', 'single', [
        createManifestItem(dir, { input: 'source', outputDir: dir, status: 'full', metadata: {}, providers: [] })
      ])

      const invalidCorpus: Array<{ label: string, mutate: (m: PipelineManifest) => unknown }> = [
        {
          label: 'unknown top-level key',
          mutate: (m) => ({ ...m, extraUnknownKey: 123 })
        },
        {
          label: 'invalid command name',
          mutate: (m) => ({ ...m, command: 'non-existent-cmd' })
        },
        {
          label: 'invalid scope',
          mutate: (m) => ({ ...m, scope: 'invalid-scope' })
        },
        {
          label: 'empty items array',
          mutate: (m) => ({ ...m, items: [] })
        },
        {
          label: 'single scope with multiple items',
          mutate: (m) => ({ ...m, scope: 'single', items: [m.items[0]!, m.items[0]!] })
        },
        {
          label: 'invalid date in createdAt',
          mutate: (m) => ({ ...m, createdAt: 'not-a-date' })
        },
        {
          label: 'invalid item status',
          mutate: (m) => ({ ...m, items: [{ ...m.items[0]!, status: 'not-a-status' }] })
        },
        {
          label: 'escaping output directory',
          mutate: (m) => ({ ...m, items: [{ ...m.items[0]!, outputDir: '../../outside' }] })
        },
        {
          label: 'duplicate provider targetKeys',
          mutate: (m) => ({
            ...m,
            items: [{
              ...m.items[0]!,
              providers: [
                policySkippedState('duplicate-key'),
                policySkippedState('duplicate-key')
              ]
            }]
          })
        },
        {
          label: 'mismatched tts item status with provider statuses',
          mutate: (m) => ({
            ...m,
            command: 'tts',
            items: [{
              ...m.items[0]!,
              status: 'incomplete',
              providers: [policySkippedState('skipped-key')]
            }]
          })
        }
      ]

      for (const entry of invalidCorpus) {
        const corrupted = entry.mutate(structuredClone(valid)) as PipelineManifest
        await expect(writeManifest(dir, corrupted)).rejects.toThrow()
      }
    })
  })
})
