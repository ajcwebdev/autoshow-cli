import { describe, expect, test } from 'bun:test'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { collectGeminiJobResults, GEMINI_JOB_FILE, partitionGeminiJobs, persistGeminiJobs, validateRetained } from '~/cli/commands/audio/tts/tts-services/tts-gemini/gemini-tts-batch-jobs'
import { hashCanonicalTtsValue } from '~/cli/commands/audio/tts/script-to-audio/contract-identity'
import { providerAccountScopeHash } from '~/cli/commands/audio/tts/script-to-audio/advanced-provider-contracts'
import { AppError } from '~/utils/error-handler'
import type { GeminiProviderJobRun } from '~/types/tts-workflow/gemini-provider-job-types'
import { captureLogEvents } from '../../../../../test-utils/console-capture'
import { setupTtsContractLifecycle, installMockFetch } from './shared'
import { LITE, batchAudio } from './gemini-fixtures'

// Collection works on results Gemini already returned, so none of these cases may reach the network.
// Synthetic tones establish decoded artifact integrity only, never spoken correctness or quality.
const { makeTempDir } = setupTtsContractLifecycle()

const makeRun = (model = LITE): GeminiProviderJobRun => {
  const request = { contents: [{ role: 'user', parts: [{ text: 'Sentence 0.' }] }], generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { voice: 'Kore' } } } }
  const slots = [{ key: hashCanonicalTtsValue(0), itemIndex: 0, model, generationSlotId: 'slot-0', request, requestFingerprint: hashCanonicalTtsValue({ model, request }) }]
  return { schemaVersion: 1, kind: 'gemini-tts-provider-jobs', accountScopeHash: providerAccountScopeHash('gemini', 'storage-fixture-key'), createdAt: '2026-09-24T00:00:00Z', items: [{ input: 'input/examples/text.txt', stem: 'fixture' }], slots, jobs: partitionGeminiJobs(slots), delivery: {}, outputs: [] }
}

const prepare = async (prefix: string, model?: string) => {
  const root = await makeTempDir(prefix), run = makeRun(model)
  await persistGeminiJobs(root, run)
  const calls = installMockFetch(() => { throw new Error('collection must not call Gemini') })
  return { root, run, calls, slot: run.slots[0]!, audioPath: join(root, 'gemini-audio', `${run.slots[0]!.key}.wav`) }
}

const persistedSlot = async (root: string) =>
  ((await Bun.file(join(root, GEMINI_JOB_FILE)).json()) as GeminiProviderJobRun).slots[0]!

const expectStorageError = async (promise: Promise<unknown>): Promise<AppError> => {
  const error = await promise.then(() => undefined, (failure: unknown) => failure)
  expect(error).toBeInstanceOf(AppError)
  const appError = error as AppError
  expect(appError.kind).toBe('infrastructure')
  expect(appError.stage).toBe('tts:gemini-batch:storage')
  expect(appError.metadata).toMatchObject({ provider: 'gemini', generationSlotId: 'slot-0' })
  expect(appError.cause).toBeDefined()
  return appError
}

describe('Gemini Batch result storage outcomes', () => {
  test('valid audio is retained with its usage', async () => {
    const { root, run, calls, slot } = await prepare('gemini-storage-valid-')
    await collectGeminiJobResults(root, run, run.jobs[0]!, [{ key: slot.key, response: batchAudio() }])

    expect(slot.error).toBeUndefined()
    expect(slot.audioPath).toBe(`gemini-audio/${slot.key}.wav`)
    expect(slot.usage?.observedAudioTokens).toBe(8)
    expect(await validateRetained(root, slot)).toBe(true)
    expect(calls).toHaveLength(0)
  })

  test('malformed audio marks the slot invalid and logs the decode cause', async () => {
    const { root, run, calls, slot } = await prepare('gemini-storage-malformed-')
    const { events } = await captureLogEvents(async () =>
      await collectGeminiJobResults(root, run, run.jobs[0]!, [{ key: slot.key, response: batchAudio('garbage') }]))

    expect(slot.error).toBe('invalid-or-incomplete-audio')
    expect(slot.audioPath).toBeUndefined()
    expect((await persistedSlot(root)).error).toBe('invalid-or-incomplete-audio')
    const warning = events.find((event) => event.level === 'warn' && event.message.startsWith('Gemini Batch returned invalid audio for slot-0'))
    expect(warning?.message).toContain('Invalid Gemini TTS audio')
    expect(calls).toHaveLength(0)
  })

  test('an unwritable download path is a storage error and leaves the slot resumable', async () => {
    const { root, run, calls, slot, audioPath } = await prepare('gemini-storage-eisdir-')
    await mkdir(`${audioPath}.download`, { recursive: true })

    const error = await expectStorageError(collectGeminiJobResults(root, run, run.jobs[0]!, [{ key: slot.key, response: batchAudio() }]))

    expect(error.message).toBe('Could not retain Gemini batch audio for slot-0.')
    expect(slot.error).toBeUndefined()
    expect(slot.audioPath).toBeUndefined()
    expect((await persistedSlot(root)).error).toBeUndefined()
    expect(calls).toHaveLength(0)
  })

  test('a failed rename into place is a storage error and leaves the slot resumable', async () => {
    const { root, run, slot, audioPath } = await prepare('gemini-storage-rename-')
    await mkdir(audioPath, { recursive: true })
    await writeFile(join(audioPath, 'occupied'), 'not audio')

    await expectStorageError(collectGeminiJobResults(root, run, run.jobs[0]!, [{ key: slot.key, response: batchAudio() }]))

    expect(slot.error).toBeUndefined()
    expect((await persistedSlot(root)).error).toBeUndefined()
  })

  // Root writes through a read-only directory, so the permission case only exists for other users.
  if (process.getuid?.() !== 0) test('a permission failure is a storage error, not invalid audio', async () => {
    const { root, run, slot } = await prepare('gemini-storage-permission-')
    const audioDir = join(root, 'gemini-audio')
    await mkdir(audioDir, { recursive: true })
    await chmod(audioDir, 0o500)
    try {
      const error = await expectStorageError(collectGeminiJobResults(root, run, run.jobs[0]!, [{ key: slot.key, response: batchAudio() }]))
      expect(String((error.cause as NodeJS.ErrnoException).code)).toBe('EACCES')
      expect(slot.error).toBeUndefined()
    } finally {
      await chmod(audioDir, 0o700)
    }
  })

  test('a missing retained file is recollected, while an unreadable one is a storage error', async () => {
    const { root, run, slot, audioPath } = await prepare('gemini-storage-retained-')
    await collectGeminiJobResults(root, run, run.jobs[0]!, [{ key: slot.key, response: batchAudio() }])
    await Bun.file(audioPath).delete()

    expect(await validateRetained(root, slot)).toBe(false)
    await collectGeminiJobResults(root, run, run.jobs[0]!, [{ key: slot.key, response: batchAudio() }])
    expect(await validateRetained(root, slot)).toBe(true)

    await Bun.file(audioPath).delete()
    await mkdir(audioPath)
    const error = await expectStorageError(validateRetained(root, slot))
    expect(error.message).toBe('Could not read retained Gemini batch audio for slot-0.')
  })

  test('a usage pricing failure keeps the paid audio without a cost record', async () => {
    const { root, run, slot } = await prepare('gemini-storage-usage-', 'gemini-retired-flash-tts')
    const { events } = await captureLogEvents(async () =>
      await collectGeminiJobResults(root, run, run.jobs[0]!, [{ key: slot.key, response: batchAudio() }]))

    expect(slot.error).toBeUndefined()
    expect(slot.audioPath).toBe(`gemini-audio/${slot.key}.wav`)
    expect(slot.usage).toBeUndefined()
    expect(await validateRetained(root, slot)).toBe(true)
    expect(events.some((event) => event.level === 'warn' && event.message === 'Could not price Gemini Batch usage for slot-0; its audio is retained without a cost record.')).toBe(true)
  })
})
