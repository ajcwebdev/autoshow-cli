import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import * as recoveryFacade from '~/cli/commands/process-steps/step-4-tts/script-to-audio/attempt-recovery'
import {
  resolveRetainedPath,
  validateRecoveryProjections,
  reconcileSlotCosts,
  buildPureCurrentTtsRenderPlan,
} from '~/cli/commands/process-steps/step-4-tts/script-to-audio/current-render-attempt'
import type {
  CompatibleSignature,
  CompletedSignature,
  PipelineProviderState,
  PriceSignature,
  Step4Metadata,
  TtsTarget
} from '~/types'

const createMockTarget = (service = 'openai', model = 'gpt-4o-mini-tts-2025-12-15'): TtsTarget => ({
  service: service as TtsTarget['service'],
  model,
  run: async () => ({
    audioPath: '/tmp/audio.wav',
    metadata: {} as Step4Metadata,
  }),
})

describe('TTS recovery helper modules', () => {
  it('preserves the attempt-recovery facade exports and orchestration signatures', () => {
    const runtimeExports = Object.keys(recoveryFacade).sort()
    expect(runtimeExports).toEqual([
      'assembleCompletedRenderRecovery',
      'collectRetainedJournalEvidence',
      'discoverBatchCandidates',
      'loadRecoveryBatches',
      'planCurrentTtsResumePrice',
      'prepareCompactRenderRecovery',
      'prepareCurrentTtsCompatibleSlotRecovery',
      'prepareCurrentTtsCompletedRecovery',
      'prepareSelectedSuccess',
      'readJournalSnapshotFromLedger',
      'readLatestJournalSnapshot',
      'reconcileSlotCosts',
      'resolveCurrentTtsPriorAdmittedAttemptCount',
      'resolveRetainedPath',
      'validateRecoveryProjections',
    ])
    const completed: CompletedSignature = recoveryFacade.prepareCurrentTtsCompletedRecovery
    const compatible: CompatibleSignature = recoveryFacade.prepareCurrentTtsCompatibleSlotRecovery
    const price: PriceSignature = recoveryFacade.planCurrentTtsResumePrice
    expect([completed.length, compatible.length, price.length]).toEqual([1, 1, 1])
  })

  it('keeps facade orchestration thin and recovery publication explicitly ordered', () => {
    const facadePath = resolve(
      process.cwd(),
      'src/cli/commands/process-steps/step-4-tts/script-to-audio/attempt-recovery.ts'
    )
    const facadeSource = readFileSync(facadePath, 'utf8')
    const sourceFile = ts.createSourceFile(
      facadePath,
      facadeSource,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    )
    const entryPoints = new Map<string, string>()
    for (const statement of sourceFile.statements) {
      if (!ts.isVariableStatement(statement)) continue
      if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) continue
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue
        entryPoints.set(declaration.name.text, declaration.initializer.getText(sourceFile))
      }
    }
    expect([...entryPoints.keys()].sort()).toEqual([
      'planCurrentTtsResumePrice',
      'prepareCurrentTtsCompatibleSlotRecovery',
      'prepareCurrentTtsCompletedRecovery',
    ])
    for (const body of entryPoints.values()) {
      expect(body).not.toMatch(/readdir|readContained|readVerified|writeJson|buildRecovery|buildSpeech|for\s*\(/)
      expect(body.match(/Impl\(options\)/g)).toHaveLength(1)
    }

    const finalizationSource = readFileSync(resolve(
      process.cwd(),
      'src/cli/commands/process-steps/step-4-tts/script-to-audio/recovery-finalization.ts'
    ), 'utf8')
    const publisherSource = finalizationSource.slice(
      finalizationSource.indexOf('export const publishCompletedRenderRecovery')
    )
    const orderedMarkers = [
      'materializeRecoveredBatch',
      'ensureAggregateProviderResult',
      'assembleRecoveryAudio',
      'copyCreateOnly',
      'mix-plan.json',
      'transform-ledger.json',
      'final-timeline.json',
      'audio-run.json',
      'publishReportedOutput',
      'onProviderState',
    ]
    let previous = -1
    for (const marker of orderedMarkers) {
      const index = publisherSource.indexOf(marker, previous + 1)
      expect(index).toBeGreaterThan(previous)
      previous = index
    }
  })

  it('resolveRetainedPath rejects paths that escape the base directory', () => {
    expect(() => resolveRetainedPath('/tmp/base', '../outside/file.json', 'Test artifact')).toThrow(
      'Test artifact escapes its retained evidence directory.'
    )
    expect(() => resolveRetainedPath('/tmp/base', '../../etc/passwd', 'Test artifact')).toThrow(
      'Test artifact escapes its retained evidence directory.'
    )
    expect(resolveRetainedPath('/tmp/base', 'sub/file.json', 'Test artifact')).toBe('/tmp/base/sub/file.json')
  })

  it('validateRecoveryProjections validates target key and exact projections', () => {
    const options = {
      target: createMockTarget('openai', 'gpt-4o-mini-tts-2025-12-15'),
      sourceText: 'Hello world',
      ttsOptions: {},
      rootDir: '/tmp/test',
      state: {
        service: 'openai' as const,
        model: 'wrong-model',
        targetKey: 'openai/wrong-model',
        artifactDir: 'providers/openai',
        attempts: 1,
      } as PipelineProviderState,
    }
    const pure = buildPureCurrentTtsRenderPlan(options)
    expect(() => validateRecoveryProjections(options, pure)).toThrow(
      'Stored TTS provider state does not bind the exact planned target identity.'
    )

    const emptyDirOptions = {
      ...options,
      state: {
        ...options.state,
        targetKey: pure.targetKey,
        artifactDir: '   ',
      },
    }
    expect(() => validateRecoveryProjections(emptyDirOptions, pure)).toThrow(
      'Stored TTS provider state does not bind the exact planned target identity.'
    )
  })

  it('reconcileSlotCosts correctly computes zero costs when no dispatches occurred', () => {
    const options = {
      target: createMockTarget('openai', 'gpt-4o-mini-tts-2025-12-15'),
      sourceText: 'Hello world',
      ttsOptions: {},
    }
    const pure = buildPureCurrentTtsRenderPlan(options)
    const result = reconcileSlotCosts(pure, new Map(), [], { ttsOptions: {} })
    expect(result.completedSlotIds.size).toBe(0)
    expect(result.retainedCumulativePlannedCost).toEqual({ amounts: [] })
    expect(result.reconciliationBlockers).toEqual([])
  })
})
