import { describe, expect, test } from 'bun:test'
import { mkdir, readFile, symlink, unlink } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { runTtsForTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { buildCurrentTtsProviderState } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-artifacts'
import { sha256Bytes } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import { writeGenerationMetadata } from '~/cli/commands/process-steps/generation-command-utils'
import { readManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import type { TtsTarget } from '~/types'
import { canonicalTargetKey } from '~/utils/canonical-target-key'
import { createSyntheticWavBytes } from '../../../test-utils/media-fixtures'
import { withTempDir } from '../../../test-utils/temp-dirs'
import { createFileTtsSourceIdentity, createInlineTtsSourceIdentity, createSingleTurnTtsDialoguePlan } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/generic-dialogue-plan'
import { bindTtsDialoguePlanArtifact, materializeTtsDialoguePlanArtifact } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/item-dialogue-plan-artifact'

describe('TTS Phase 0 audio-run artifacts', () => {
  test('file source identity converges path spellings and separates path or byte drift', async () => {
    await withTempDir('autoshow-tts-source-identity-', async (dir) => {
      const firstDir = join(dir, 'first')
      const secondDir = join(dir, 'second')
      await mkdir(firstDir)
      await mkdir(secondDir)
      const first = join(firstDir, 'script.txt')
      const second = join(secondDir, 'script.txt')
      const alias = join(dir, 'script-alias.txt')
      await Bun.write(first, 'same bytes')
      await Bun.write(second, 'same bytes')
      await symlink(first, alias)

      const absolute = await createFileTtsSourceIdentity(first, 'same bytes')
      const relativeSpelling = await createFileTtsSourceIdentity(relative(process.cwd(), first), 'same bytes')
      const symlinkSpelling = await createFileTtsSourceIdentity(alias, 'same bytes')
      const sameBasenameElsewhere = await createFileTtsSourceIdentity(second, 'same bytes')
      const byteDrift = await createFileTtsSourceIdentity(first, 'changed bytes')
      expect(relativeSpelling).toEqual(absolute)
      expect(symlinkSpelling).toEqual(absolute)
      expect(sameBasenameElsewhere.identityHash).not.toBe(absolute.identityHash)
      expect(byteDrift.identityHash).not.toBe(absolute.identityHash)
    })
  })

  test('file source identity stores the canonical project locator and hashes exact bytes', async () => {
    const inputPath = join(process.cwd(), 'docs/adr/ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md')
    const bytes = await readFile(inputPath)
    const identity = await createFileTtsSourceIdentity(inputPath, bytes)
    expect(identity.sourceLocator).toEqual({
      kind: 'file',
      canonicalPath: 'docs/adr/ADR-014-add-character-voice-references-and-multi-speaker-script-to-audio.md'
    })
    expect(identity.contentSha256).toBe(sha256Bytes(bytes))

    const nonRoundTrippingBytes = Uint8Array.from([0xef, 0xbb, 0xbf, 0x41, 0xff])
    const exact = await createFileTtsSourceIdentity(inputPath, nonRoundTrippingBytes)
    const decoded = await createFileTtsSourceIdentity(inputPath, new TextDecoder().decode(nonRoundTrippingBytes))
    expect(exact.contentSha256).toBe(sha256Bytes(nonRoundTrippingBytes))
    expect(exact.identityHash).not.toBe(decoded.identityHash)
  })

  test('single synthesis retains checksum-backed plan, result, audio run, and canonical projection', async () => {
    await withTempDir('autoshow-tts-audio-run-', async (dir) => {
      const operation = 'tts-synthesis' as const
      const transport = 'hosted-api'
      const targetKey = canonicalTargetKey(operation, 'openai', 'fixture-model', transport)
      const target: TtsTarget = {
        service: 'openai',
        model: 'fixture-model',
        operation,
        targetKey,
        transport,
        voice: 'alloy',
        run: async (text, outputDir, _opts, _invocation, requestEvidence) => {
          const audioPath = join(outputDir, 'speech.wav')
          const bytes = createSyntheticWavBytes({ durationSeconds: 0.2, amplitude: 0.25, frequencyHz: 440 })
          await requestEvidence?.dispatch({
            chunkIndex: 1,
            endpointKind: 'speech-synthesis',
            serializerVersion: 'openai.tts.phase-0-v1',
            serializedRequest: { body: { input: text, voice: 'alloy', response_format: 'wav' } },
            providerText: text,
            voiceField: 'voice',
            voices: [{ kind: 'provider-id', value: 'alloy' }],
            requestControls: { responseFormat: 'wav' },
            continuation: { kind: 'none' }
          }, { attempt: 1 }, async ({ accepted }) => {
            await accepted({ providerRequestId: 'local-openai-fixture' })
            await Bun.write(audioPath, bytes)
          })
          if (!requestEvidence) await Bun.write(audioPath, bytes)
          await requestEvidence?.recordOutput({ chunkIndex: 1, path: audioPath })
          await requestEvidence?.complete({ chunkIndex: 1 })
          return {
            audioPath,
            metadata: {
              ttsService: 'openai',
              ttsModel: 'fixture-model',
              speaker: 'alloy',
              processingTime: 1,
              audioFileName: 'speech.wav',
              audioFileSize: bytes.byteLength,
              chunkCount: 1
            }
          }
        }
      }

      const sourceText = 'A canonical fixture line.'
      const sourceIdentity = createInlineTtsSourceIdentity(sourceText)
      const dialoguePlan = createSingleTurnTtsDialoguePlan(sourceIdentity, sourceText)
      await Bun.write(join(dir, 'speech.wav'), 'unreferenced stale reported output')
      const run = await runTtsForTargets(sourceText, dir, {}, [target], { sourceIdentity, dialoguePlan })
      const metadata = run.metadata[0]
      expect(metadata?.targetKey).toBe(targetKey)
      expect(metadata?.renderStrategy).toBe('segmented')
      expect(metadata?.ttsAudio?.activeWork).toBeUndefined()
      expect(metadata?.ttsAudio?.selectedSuccess?.resultIdentity).toBe(metadata?.resultIdentity)
      expect(metadata?.ttsAudio?.archive?.slotCount).toBe(1)
      expect(await Bun.file(join(dir, 'speech.wav')).exists()).toBe(true)
      expect(await Bun.file(join(dir, 'speech.wav')).text()).not.toBe('unreferenced stale reported output')
      expect(await Bun.file(join(dir, 'work')).exists()).toBe(false)

      const archive = metadata?.ttsAudio?.archive
      if (!archive) throw new Error('Missing compact TTS archive')
      const renderPath = join(dir, archive.renderRef.path)
      const timelinePath = join(dir, archive.timelineRef.path)
      const finalPath = join(dir, archive.finalRef.path)
      for (const path of [renderPath, timelinePath, finalPath]) {
        expect(await Bun.file(path).exists()).toBe(true)
      }
      expect(archive.renderRef.sha256).toBe(sha256Bytes(await Bun.file(renderPath).text()))
      expect(archive.timelineRef.sha256).toBe(sha256Bytes(await Bun.file(timelinePath).text()))
      const compactRender = await Bun.file(renderPath).json() as { slots: Array<{ slotHash: string, sha256: string }> }
      const slotPath = join(dir, 'slots', `${compactRender.slots[0]?.slotHash}.wav`)
      expect(await Bun.file(slotPath).exists()).toBe(true)

      const dialoguePlanArtifact = await materializeTtsDialoguePlanArtifact(dir, dialoguePlan)
      const providerState = bindTtsDialoguePlanArtifact(
        buildCurrentTtsProviderState(metadata as NonNullable<typeof metadata>),
        dialoguePlanArtifact
      )
      await writeGenerationMetadata(dir, 'tts', run.metadata, {}, {}, {
        input: 'A canonical fixture line.',
        requestedProviders: [{ service: 'openai', model: 'fixture-model', operation, targetKey, transport }],
        completedProviders: [{ service: 'openai', model: 'fixture-model' }],
        providerStates: [providerState]
      })
      const manifest = await readManifest(dir)
      expect(manifest?.items[0]?.status).toBe('full')
      expect(manifest?.items[0]?.providers).toHaveLength(1)
      expect(manifest?.items[0]?.providers[0]?.result).toEqual({ ttsAudio: metadata?.ttsAudio })

      const dependencyPaths = [
        join(dir, dialoguePlanArtifact.path),
        renderPath,
        timelinePath,
        slotPath,
        finalPath,
      ]
      for (const dependencyPath of dependencyPaths) {
        const originalBytes = new Uint8Array(await Bun.file(dependencyPath).arrayBuffer())
        const corruptedBytes = new Uint8Array(originalBytes.byteLength + 1)
        corruptedBytes.set(originalBytes)
        corruptedBytes[corruptedBytes.length - 1] = 0x78
        await Bun.write(dependencyPath, corruptedBytes)
        await expect(readManifest(dir)).rejects.toThrow('Invalid canonical manifest')
        await Bun.write(dependencyPath, originalBytes)
        expect((await readManifest(dir))?.items[0]?.status).toBe('full')
      }

      const retainedAudioBytes = new Uint8Array(await Bun.file(finalPath).arrayBuffer())
      await Bun.write(finalPath, 'tampered audio')
      await expect(readManifest(dir)).rejects.toThrow('Invalid canonical manifest')
      await Bun.write(finalPath, retainedAudioBytes)
      expect((await readManifest(dir))?.items[0]?.status).toBe('full')

      const outsideAudioPath = join(dir, 'outside-audio.wav')
      await Bun.write(outsideAudioPath, retainedAudioBytes)
      await unlink(finalPath)
      await symlink(outsideAudioPath, finalPath)
      await expect(readManifest(dir)).rejects.toThrow('Invalid canonical manifest')
      await unlink(finalPath)
      await Bun.write(finalPath, retainedAudioBytes)
      expect((await readManifest(dir))?.items[0]?.status).toBe('full')

      const tamperedRenderBytes = `${JSON.stringify({ ...compactRender, targetKey: 'tampered-target' })}\n`
      await Bun.write(renderPath, tamperedRenderBytes)
      const rawManifest = await Bun.file(join(dir, 'manifest.json')).json() as {
        items: Array<{
          providers: Array<{
            metadata: { ttsAudio: { archive: { renderRef: { sha256: string } } } }
            result: { ttsAudio: { archive: { renderRef: { sha256: string } } } }
          }>
        }>
      }
      const tamperedSha256 = sha256Bytes(tamperedRenderBytes)
      const rawProvider = rawManifest.items[0]?.providers[0]
      if (!rawProvider) throw new Error('Missing fixture provider state')
      rawProvider.metadata.ttsAudio.archive.renderRef.sha256 = tamperedSha256
      rawProvider.result.ttsAudio.archive.renderRef.sha256 = tamperedSha256
      await Bun.write(join(dir, 'manifest.json'), `${JSON.stringify(rawManifest, null, 2)}\n`)
      await expect(readManifest(dir)).rejects.toThrow('Invalid canonical manifest')
    })
  })
})
