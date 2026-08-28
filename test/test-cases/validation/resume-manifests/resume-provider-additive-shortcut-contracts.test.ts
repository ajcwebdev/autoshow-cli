import { describe,expect,test } from 'bun:test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { createManifest,createManifestItem,PIPELINE_MANIFEST_FILE,readManifest,writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { buildCurrentTtsProviderState } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-artifacts'
import { createFileTtsSourceIdentity,createSingleTurnTtsDialoguePlan } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/generic-dialogue-plan'
import { bindTtsDialoguePlanArtifact,materializeTtsDialoguePlanArtifact } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/item-dialogue-plan-artifact'
import { normalizeResumeSelectorFlagsForTarget as normalizeResumeSelectorOccurrencesForTarget } from '~/cli/commands/setup-and-utilities/resume/resume-dispatch'
import { getResumeHandler } from '~/cli/commands/setup-and-utilities/resume/resume-registry'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import type { CliFlagOccurrence,ResumeTarget,Step3Metadata } from '~/types'
import { flagOccurrencesFromValues } from '../../../test-utils/flag-occurrences'
import { writeSingleManifestFixture } from '../../../test-utils/manifest-helpers'
import { installMockFetch,jsonResponse,restoreEnv,snapshotEnv } from '../../../test-utils/rest-contract-helpers'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { canonicalFileInput,succeededMetadata,ttsTarget } from './tts-resume-fixtures'

const hasResumableTtsWork = getResumeHandler('tts')!.hasResumableWork
const writeResumeHandler = getResumeHandler('write')!
const hasResumableImageWork = getResumeHandler('image')!.hasResumableWork
const hasResumableVideoWork = getResumeHandler('video')!.hasResumableWork
const hasResumableMusicWork = getResumeHandler('music')!.hasResumableWork

const target = (
  kind: ResumeTarget['kind'],
  dir = '/tmp/autoshow-resume-test',
  extractRoute?: ResumeTarget['extractRoute']
): ResumeTarget => ({
  kind,
  ...(extractRoute ? { extractRoute } : {}),
  scope: 'single',
  dir,
  manifestPath: join(dir, PIPELINE_MANIFEST_FILE)
})

const buildOpts = (
  flags: Record<string, unknown>,
  explicit: Set<string>,
  flagOccurrences: CliFlagOccurrence[]
) =>
  buildOptsFromFlags(flags, {}, explicit, { flagOccurrences: flagOccurrences })

const normalizeResumeSelectorFlagsForTarget = (
  resumeTarget: ResumeTarget,
  flags: Record<string, unknown>,
  explicitFlags: Set<string>,
  _rawArgs: string[]
) => normalizeResumeSelectorOccurrencesForTarget(
  resumeTarget,
  flags,
  explicitFlags,
  flagOccurrencesFromValues(flags, explicitFlags)
)

const originalFetch = globalThis.fetch

describe('resume all-shortcut additive selection', () => {
  test('explicit all shortcuts make write LLM runs resumable without provider calls', async () => {
    await withTempDir('autoshow-write-resume-all-shortcuts-', async (dir) => {
      await writeSingleManifestFixture(dir, 'write', {
        step3: {
          llmService: 'openai',
          llmModel: 'gpt-5.5',
          processingTime: 1,
          inputTokenCount: 1,
          outputTokenCount: 1,
          outputFileName: 'text-gpt-5.5.json',
          outputFormat: 'json',
          structuredMode: 'native',
          structuredPresetNames: ['shortSummary']
        }
      })
      await Bun.write(join(dir, 'prompt.md'), 'Prompt')
      const normalized = normalizeResumeSelectorFlagsForTarget(
        target('write', dir),
        { 'all-providers': true },
        new Set(['all-providers']),
        ['resume', dir, '--all-providers']
      )
      const opts = buildOpts(normalized.flags, normalized.explicitFlags, normalized.flagOccurrences)
      await expect(writeResumeHandler.hasResumableWork(target('write', dir), opts, normalized.explicitFlags)).resolves.toBe(true)
    })
  })

  test('write resume resolves a completed selection before requiring prompt.md', async () => {
    await withTempDir('autoshow-write-resume-complete-no-prompt-', async (dir) => {
      await writeSingleManifestFixture(dir, 'write', {
        step3: {
          llmService: 'openai',
          llmModel: 'gpt-5.5',
          processingTime: 1,
          inputTokenCount: 1,
          outputTokenCount: 1,
          outputFileName: 'text-gpt-5.5.json',
          outputFormat: 'json',
          structuredMode: 'native',
          structuredPresetNames: ['shortSummary']
        } satisfies Step3Metadata
      })

      const normalized = normalizeResumeSelectorFlagsForTarget(
        target('write', dir),
        { provider: ['openai=gpt-5.5'] },
        new Set(['provider']),
        ['resume', dir, '--provider', 'openai=gpt-5.5']
      )
      const opts = buildOpts(normalized.flags, normalized.explicitFlags, normalized.flagOccurrences)

      await expect(writeResumeHandler.resume(target('write', dir), opts, normalized.explicitFlags)).resolves.toEqual({
        full: 1,
        incomplete: 0,
        failed: 0
      })
      expect(await Bun.file(join(dir, 'prompt.md')).exists()).toBe(false)
    })
  })

  test('write resume keeps a completed retired Gemini model readable without rewriting its identity', async () => {
    await withTempDir('autoshow-write-resume-retired-gemini-', async (dir) => {
      await writeSingleManifestFixture(dir, 'write', {
        step3: {
          llmService: 'gemini',
          llmModel: 'gemini-3.1-flash-lite',
          processingTime: 1,
          inputTokenCount: 1,
          outputTokenCount: 1,
          outputFileName: 'text-gemini-3.1-flash-lite.json',
          outputFormat: 'json',
          structuredMode: 'native',
          structuredPresetNames: ['shortSummary']
        } satisfies Step3Metadata
      })

      const normalized = normalizeResumeSelectorFlagsForTarget(
        target('write', dir),
        {},
        new Set(),
        ['resume', dir]
      )
      const opts = buildOpts(normalized.flags, normalized.explicitFlags, normalized.flagOccurrences)

      await expect(writeResumeHandler.resume(target('write', dir), opts, normalized.explicitFlags)).resolves.toEqual({
        full: 1,
        incomplete: 0,
        failed: 0
      })

      const manifest = await readManifest(dir)
      expect(manifest?.items[0]?.metadata['step3']).toMatchObject({
        llmService: 'gemini',
        llmModel: 'gemini-3.1-flash-lite'
      })
      expect(await Bun.file(join(dir, 'prompt.md')).exists()).toBe(false)
    })
  })

  test('write resume records successful partial LLM results and exits incomplete for failed targets', async () => {
    const env = snapshotEnv([
      'TOGETHER_API_KEY',
      'CEREBRAS_API_KEY'
    ])
    try {
      process.env['TOGETHER_API_KEY'] = 'together-key'
      process.env['CEREBRAS_API_KEY'] = 'cerebras-key'

      await withTempDir('autoshow-write-resume-partial-', async (dir) => {
        await writeSingleManifestFixture(dir, 'write', {
          step3: {
            llmService: 'openai',
            llmModel: 'gpt-5.5',
            processingTime: 1,
            inputTokenCount: 1,
            outputTokenCount: 1,
            outputFileName: 'text-gpt-5.5.json',
            outputFormat: 'json',
            structuredMode: 'native',
            structuredPresetNames: ['shortSummary']
          } satisfies Step3Metadata
        })
        await Bun.write(join(dir, 'prompt.md'), 'Prompt')

        installMockFetch((call) => {
          if (call.headers.get('authorization') === 'Bearer cerebras-key') {
            return jsonResponse({
              error: {
                message: 'Model zai-glm-4.7 does not exist or you do not have access to it.'
              }
            }, { status: 404 })
          }

          return jsonResponse({
            model: call.bodyJson?.['model'],
            choices: [{ message: { content: '{"episodeDescription":"Together summary."}' } }],
            usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 }
          })
        })

        const normalized = normalizeResumeSelectorFlagsForTarget(
          target('write', dir),
          { provider: ['together=kimi-k2.6', 'cerebras=zai-glm-4.7'] },
          new Set(['provider']),
          ['resume', dir, '--provider', 'together=kimi-k2.6', '--provider', 'cerebras=zai-glm-4.7']
        )
        const opts = buildOpts(normalized.flags, normalized.explicitFlags, normalized.flagOccurrences)

        try {
          await writeResumeHandler.resume(target('write', dir), opts, normalized.explicitFlags)
          expect.unreachable('write resume should remain incomplete')
        } catch (error) {
          expect(error).toMatchObject({
            kind: 'infrastructure',
            stage: 'resume:generation',
            exitCode: 2,
            message: 'Write resume still has 1 incomplete provider(s): cerebras/zai-glm-4.7'
          })
        }

        const manifest = await readManifest(dir)
        const item = manifest?.items[0]
        const step3 = Array.isArray(item?.metadata['step3'])
          ? item.metadata['step3'] as Step3Metadata[]
          : [item?.metadata['step3'] as Step3Metadata]
        const togetherEntry = step3.find((entry) => `${entry.llmService}/${entry.llmModel}` === 'together/kimi-k2.6')
        expect(step3.map((entry) => `${entry.llmService}/${entry.llmModel}`)).toContain('together/kimi-k2.6')
        expect(step3.map((entry) => `${entry.llmService}/${entry.llmModel}`)).not.toContain('cerebras/zai-glm-4.7')
        expect(togetherEntry).toBeDefined()
        expect(await Bun.file(join(dir, togetherEntry!.outputFileName)).exists()).toBe(true)
        expect(item?.providers).toEqual(expect.arrayContaining([
          expect.objectContaining({ service: 'together', model: 'kimi-k2.6', status: 'succeeded' }),
          expect.objectContaining({ service: 'cerebras', model: 'zai-glm-4.7', status: 'missing' })
        ]))
      })
    } finally {
      globalThis.fetch = originalFetch
      restoreEnv(env)
    }
  })

  test('explicit all shortcuts make full generation runs resumable without provider calls', async () => {
    await withTempDir('autoshow-resume-all-shortcuts-', async (dir) => {
      const cases = [
        {
          kind: 'image' as const,
          metadataKey: 'image',
          requestedProvider: { service: 'gemini', model: 'gemini-3.1-flash-lite-image' },
          metadata: {
            imageService: 'gemini',
            imageModel: 'gemini-3.1-flash-lite-image',
            processingTime: 1,
            imageFileNames: ['generated-image.png'],
            imageCount: 1,
            imageFileSize: 1,
            imageWidth: 1,
            imageHeight: 1,
            requestMode: 'generation'
          },
          hasWork: hasResumableImageWork
        },
        {
          kind: 'video' as const,
          metadataKey: 'video',
          requestedProvider: { service: 'gemini', model: 'veo-3.1-fast-generate-preview' },
          metadata: {
            videoGenService: 'gemini',
            videoGenModel: 'veo-3.1-fast-generate-preview',
            processingTime: 1,
            videoFileName: 'generated-video.mp4',
            videoFileSize: 1,
            videoDuration: 5
          },
          hasWork: hasResumableVideoWork
        },
        {
          kind: 'music' as const,
          metadataKey: 'music',
          requestedProvider: { service: 'elevenlabs', model: 'music_v2' },
          metadata: {
            musicService: 'elevenlabs',
            musicModel: 'music_v2',
            processingTime: 1,
            musicFileName: 'music.mp3',
            musicFileSize: 1,
            musicDurationMs: 1000,
            lyricsSource: 'none'
          },
          hasWork: hasResumableMusicWork
        }
      ]

      const ttsRunDir = join(dir, 'tts')
      await mkdir(ttsRunDir, { recursive: true })
      const ttsText = 'Prompt text for a canonical completed render.'
      const ttsInputPath = join(ttsRunDir, 'source.txt')
      await Bun.write(ttsInputPath, ttsText)
      const ttsSourceIdentity = await createFileTtsSourceIdentity(ttsInputPath, ttsText)
      const ttsDialoguePlan = createSingleTurnTtsDialoguePlan(ttsSourceIdentity, ttsText)
      const completedTts = await succeededMetadata(ttsRunDir, ttsTarget(), 'all-shortcuts', {
        text: ttsText,
        sourceIdentity: ttsSourceIdentity,
        dialoguePlan: ttsDialoguePlan
      })
      await writeManifest(ttsRunDir, createManifest('tts', 'single', [createManifestItem(ttsRunDir, {
        input: canonicalFileInput(ttsSourceIdentity),
        status: 'full',
        metadata: { tts: [completedTts] },
        providers: [bindTtsDialoguePlanArtifact(
          buildCurrentTtsProviderState(completedTts),
          await materializeTtsDialoguePlanArtifact(ttsRunDir, ttsDialoguePlan)
        )]
      })]))
      const ttsNormalized = normalizeResumeSelectorFlagsForTarget(
        target('tts', ttsRunDir),
        { 'all-providers': true },
        new Set(['all-providers']),
        ['resume', ttsRunDir, '--all-providers']
      )
      await expect(hasResumableTtsWork(
        target('tts', ttsRunDir),
        buildOpts(ttsNormalized.flags, ttsNormalized.explicitFlags, ttsNormalized.flagOccurrences),
        ttsNormalized.explicitFlags
      )).resolves.toBe(true)

      for (const entry of cases) {
        const runDir = join(dir, entry.kind)
        await mkdir(runDir, { recursive: true })
        const record = {
          input: 'Prompt text.',
          completionStatus: 'full',
          requestedProviders: [entry.requestedProvider],
          providerStates: [{
            ...entry.requestedProvider,
            artifactDir: '.',
            status: 'succeeded',
            attempts: 1
          }],
          [entry.metadataKey]: [entry.metadata]
        }
        await writeSingleManifestFixture(runDir, entry.kind, record)
        const explicit = new Set(['all-providers'])
        const normalized = normalizeResumeSelectorFlagsForTarget(
          target(entry.kind, runDir),
          { 'all-providers': true },
          explicit,
          ['resume', runDir, '--all-providers']
        )
        const opts = buildOpts(normalized.flags, normalized.explicitFlags, normalized.flagOccurrences)
        await expect(entry.hasWork(target(entry.kind, runDir), opts, normalized.explicitFlags)).resolves.toBe(true)
      }
    })
  })
})
