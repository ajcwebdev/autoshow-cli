import { describe, expect, test } from 'bun:test'
import { mkdir, readFile, readdir, symlink, unlink } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { runTtsForTargets } from '~/cli/commands/process-steps/step-4-tts/run-tts'
import { buildCurrentTtsProviderState } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-artifacts'
import { hashCanonicalRecordWithout, sha256Bytes } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-identity'
import { validateProviderRenderPlanIdentity, validateProviderRenderResult, validateRenderAdmissionJournalSnapshot } from '~/cli/commands/process-steps/step-4-tts/script-to-audio/contract-validation'
import { writeGenerationMetadata } from '~/cli/commands/process-steps/generation-command-utils'
import { readManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import type { ProviderRenderPlan, ProviderRenderResult, RenderAdmissionJournalSnapshot, TtsTarget } from '~/types'
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
    const inputPath = join(process.cwd(), 'docs/adr/ADR-020-add-character-voice-references-and-multi-speaker-script-to-audio.md')
    const bytes = await readFile(inputPath)
    const identity = await createFileTtsSourceIdentity(inputPath, bytes)
    expect(identity.sourceLocator).toEqual({
      kind: 'file',
      canonicalPath: 'docs/adr/ADR-020-add-character-voice-references-and-multi-speaker-script-to-audio.md'
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
      const run = await runTtsForTargets(sourceText, dir, {}, [target], { sourceIdentity, dialoguePlan })
      const metadata = run.metadata[0]
      expect(metadata?.targetKey).toBe(targetKey)
      expect(metadata?.renderStrategy).toBe('segmented')
      expect(metadata?.ttsAudio?.activeWork?.kind).toBe('render')
      expect(metadata?.ttsAudio?.selectedSuccess?.resultIdentity).toBe(metadata?.resultIdentity)
      expect(await Bun.file(join(dir, 'speech.wav')).exists()).toBe(true)

      const artifactDir = join(dir, metadata?.artifactDir as string)
      const render = metadata?.ttsAudio?.renderHistory[0]
      const event = render?.events.at(-1)
      const renderPlanPath = join(artifactDir, render?.renderPlanRef as string)
      const resultPath = join(artifactDir, event?.providerRenderResultRef as string)
      const audioRunPath = join(artifactDir, event?.audioRunRef as string)
      const retainedAudioPath = join(artifactDir, event?.outputRefs?.[0]?.path as string)
      for (const path of [renderPlanPath, resultPath, audioRunPath, retainedAudioPath]) {
        expect(await Bun.file(path).exists()).toBe(true)
      }

      expect(event?.providerRenderResultSha256).toBe(sha256Bytes(await Bun.file(resultPath).text()))
      expect(event?.audioRunSha256).toBe(sha256Bytes(await Bun.file(audioRunPath).text()))
      const renderPlan = await Bun.file(renderPlanPath).json() as ProviderRenderPlan
      const renderResult = await Bun.file(resultPath).json() as ProviderRenderResult
      const terminalJournalPath = join(artifactDir, event?.admissionJournalRef as string)
      const terminalJournal = await Bun.file(terminalJournalPath).json() as RenderAdmissionJournalSnapshot
      const journalDir = dirname(terminalJournalPath)
      const journalFiles = (await readdir(journalDir)).filter((name) => /^admission-journal-\d+\.json$/.test(name)).sort()
      const journalChain = await Promise.all(journalFiles.map(async (name) => await Bun.file(join(journalDir, name)).json() as RenderAdmissionJournalSnapshot))
      for (const [index, journal] of journalChain.entries()) {
        expect(validateRenderAdmissionJournalSnapshot(journal, index > 0 ? journalChain[index - 1] : undefined)).toEqual(journal)
      }
      const priorJournal = journalChain.at(-2) as RenderAdmissionJournalSnapshot
      expect(validateProviderRenderPlanIdentity(renderPlan)).toEqual(renderPlan)
      expect(validateProviderRenderResult(renderResult)).toEqual(renderResult)
      expect(journalChain.at(-1)).toEqual(terminalJournal)
      expect(() => validateProviderRenderPlanIdentity({ ...renderPlan, model: 'tampered-model' })).toThrow('targetKey')

      const duplicateAcceptance = structuredClone(terminalJournal)
      const acceptedTransition = duplicateAcceptance.requests[0]?.transitions.find((transition) => transition.state === 'provider-accepted')
      if (!acceptedTransition) throw new Error('Missing acceptance fixture')
      duplicateAcceptance.requests[0]!.transitions.splice(3, 0, { ...acceptedTransition, sequence: 4 })
      duplicateAcceptance.requests[0]!.transitions[4] = { ...duplicateAcceptance.requests[0]!.transitions[4]!, sequence: 5 }
      duplicateAcceptance.snapshotId = hashCanonicalRecordWithout(
        duplicateAcceptance as unknown as Record<string, unknown>,
        ['snapshotId']
      )
      expect(() => validateRenderAdmissionJournalSnapshot(duplicateAcceptance, priorJournal)).toThrow('acceptance may advance only to completion')

      const mismatchedProof = structuredClone(terminalJournal)
      const completion = mismatchedProof.requests[0]?.transitions.find((transition) => transition.state === 'completed')
      if (!completion || completion.state !== 'completed') throw new Error('Missing completion fixture')
      completion.evidence.invocationId = 'wrong-invocation'
      mismatchedProof.snapshotId = hashCanonicalRecordWithout(
        mismatchedProof as unknown as Record<string, unknown>,
        ['snapshotId']
      )
      expect(() => validateRenderAdmissionJournalSnapshot(mismatchedProof, priorJournal)).toThrow('does not bind the exact journal request')

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

      const readinessResultPath = join(artifactDir, metadata?.ttsAudio?.readinessAttempts[0]?.readinessResultRef as string)
      const readinessResult = await Bun.file(readinessResultPath).json() as { capabilityFixture: { path: string } }
      const audioRun = await Bun.file(audioRunPath).json() as {
        mixPlan: { path: string }
        transformLedger: { path: string }
        finalTimeline: { path: string }
      }
      const generationSlot = event?.batchProgress?.[0]?.generationSlots[0]
      if (!renderPlan.strategyArtifacts || !generationSlot || generationSlot.source !== 'provider-dispatch') {
        throw new Error('Missing retained Phase 0 strategy or generation-slot fixture')
      }
      const dependencyPaths = [
        join(dir, dialoguePlanArtifact.path),
        join(artifactDir, readinessResult.capabilityFixture.path),
        join(artifactDir, render?.renderDir as string, renderPlan.strategyArtifacts.sourceIdentity.path),
        join(artifactDir, render?.renderDir as string, renderPlan.strategyArtifacts.dialoguePlan.path),
        join(artifactDir, render?.renderDir as string, renderPlan.strategyArtifacts.normalizedDialogue.path),
        ...renderPlan.strategyArtifacts.turns.map((entry) => join(artifactDir, render?.renderDir as string, entry.path)),
        ...renderPlan.strategyArtifacts.generationSlots.map((entry) => join(artifactDir, render?.renderDir as string, entry.path)),
        join(journalDir, journalFiles[0] as string),
        join(artifactDir, render?.renderDir as string, generationSlot.batchInvocationPlan.path),
        join(artifactDir, render?.renderDir as string, generationSlot.batchResult?.path as string),
        join(dirname(audioRunPath), audioRun.mixPlan.path),
        join(dirname(audioRunPath), audioRun.transformLedger.path),
        join(dirname(audioRunPath), audioRun.finalTimeline.path),
        join(dir, event?.reportedOutputRefs?.[0]?.path as string)
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

      const retainedAudioBytes = new Uint8Array(await Bun.file(retainedAudioPath).arrayBuffer())
      await Bun.write(retainedAudioPath, 'tampered audio')
      await expect(readManifest(dir)).rejects.toThrow('Invalid canonical manifest')
      await Bun.write(retainedAudioPath, retainedAudioBytes)
      expect((await readManifest(dir))?.items[0]?.status).toBe('full')

      const outsideAudioPath = join(dir, 'outside-audio.wav')
      await Bun.write(outsideAudioPath, retainedAudioBytes)
      await unlink(retainedAudioPath)
      await symlink(outsideAudioPath, retainedAudioPath)
      await expect(readManifest(dir)).rejects.toThrow('Invalid canonical manifest')
      await unlink(retainedAudioPath)
      await Bun.write(retainedAudioPath, retainedAudioBytes)
      expect((await readManifest(dir))?.items[0]?.status).toBe('full')

      const tamperedPlanBytes = `${JSON.stringify({ ...renderPlan, model: 'tampered-model' })}\n`
      await Bun.write(renderPlanPath, tamperedPlanBytes)
      const rawManifest = await Bun.file(join(dir, 'manifest.json')).json() as {
        items: Array<{
          providers: Array<{
            metadata: { ttsAudio: { renderHistory: Array<{ renderPlanSha256: string }> } }
            result: { ttsAudio: { renderHistory: Array<{ renderPlanSha256: string }> } }
          }>
        }>
      }
      const tamperedSha256 = sha256Bytes(tamperedPlanBytes)
      const rawProvider = rawManifest.items[0]?.providers[0]
      if (!rawProvider) throw new Error('Missing fixture provider state')
      rawProvider.metadata.ttsAudio.renderHistory[0]!.renderPlanSha256 = tamperedSha256
      rawProvider.result.ttsAudio.renderHistory[0]!.renderPlanSha256 = tamperedSha256
      await Bun.write(join(dir, 'manifest.json'), `${JSON.stringify(rawManifest, null, 2)}\n`)
      await expect(readManifest(dir)).rejects.toThrow('Invalid canonical manifest')
    })
  })
})
