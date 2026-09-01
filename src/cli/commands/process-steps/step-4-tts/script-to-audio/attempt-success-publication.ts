import { readdir } from 'node:fs/promises'
import { unlinkPath as unlink } from '~/utils/bun-file-io'
import type {
  AudioRun,
  CurrentTtsRenderArtifacts,
  SuccessPublicationInput,
} from '~/types'
import { removeContainedDirectory, removeContainedDirectoryIfEmpty } from './safe-artifact-store'
import { contained, hasErrorCode, writeJson, writeJsonReplace, writeJsonReuseCompatibleIdentity } from './attempt-io'
import { stateForProjection } from './attempt-planning'
import { appendTerminalProjection, publish } from './attempt-projection'
import {
  buildAudioRun,
  buildCompactArchive,
  buildCompactTerminalProjection,
} from './attempt-success-builders'
const currentArtifacts = (
  input: SuccessPublicationInput,
  audioRun: AudioRun,
  artifactDir: string
): CurrentTtsRenderArtifacts => ({
  artifactDir,
  operation: input.ctx.purePlan.operation,
  targetKey: input.ctx.purePlan.targetKey,
  transport: input.ctx.purePlan.transport,
  renderIdentity: input.ctx.purePlan.renderIdentity,
  resultIdentity: input.resultFile.value.resultIdentity,
  audioRunId: audioRun.audioRunId,
  strategy: input.ctx.purePlan.planned.strategy,
  projection: input.ctx.currentProjection,
})

const readDirectoryIfPresent = async (path: string): Promise<string[]> => {
  try {
    return await readdir(path)
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) return []
    throw error
  }
}

const unlinkIfPresent = async (path: string): Promise<void> => {
  try {
    await unlink(path)
  } catch (error) {
    if (!hasErrorCode(error, 'ENOENT')) throw error
  }
}

export const publishExpandedCompletion = async (
  input: SuccessPublicationInput
): Promise<CurrentTtsRenderArtifacts> => {
  const { ctx, resultFile, batchResultFiles } = input
  const { options, purePlan, renderRoot, targetDir, targetRelativeDir, archiveRelativeDir, layout } = ctx

  const timelineFile = await writeJson(
    options.outputDir,
    `${input.audioRunRoot}/final-timeline.json`,
    input.timeline
  )
  let audioRun = buildAudioRun({
    schemaVersion: 1,
    targetKey: purePlan.targetKey,
    renderPlanId: purePlan.renderPlanId,
    renderIdentity: purePlan.renderIdentity,
    providerResult: {
      resultIdentity: resultFile.value.resultIdentity,
      path: contained(renderRoot, resultFile.path),
      sha256: resultFile.sha256,
    },
    takeSelections: [],
    continuationCheckpoints: [],
    mixPlan: {
      mixPlanId: input.mixPlan.mixPlanId,
      path: contained(input.audioRunRoot, input.mixPlanFile.path),
      sha256: input.mixPlanFile.sha256,
    },
    transformLedger: {
      transformLedgerId: input.ledger.transformLedgerId,
      path: contained(input.audioRunRoot, input.ledgerFile.path),
      sha256: input.ledgerFile.sha256,
    },
    finalTimeline: {
      timelineId: input.timeline.timelineId,
      path: contained(input.audioRunRoot, timelineFile.path),
      sha256: timelineFile.sha256,
    },
    finalOutputs: [{
      path: contained(input.audioRunRoot, input.finalPath),
      sha256: input.finalAudioSha256,
      format: input.finalAudio.format,
      durationMs: input.finalAudio.durationMs,
    }],
    createdAt: ctx.now(),
  })
  const audioRunFile = await writeJsonReuseCompatibleIdentity(
    options.outputDir,
    `${input.audioRunRoot}/audio-run.json`,
    audioRun,
    'audioRunId',
    ['createdAt']
  )
  audioRun = audioRunFile.value
  const archiveTimelineFile = await writeJsonReplace(
    options.outputDir,
    `${options.outputDir}/${layout.archiveTimelinePath}`,
    input.timeline
  )
  const compactRenderFile = await writeJsonReplace(
    options.outputDir,
    `${options.outputDir}/${layout.archiveRenderPath}`,
    input.compactRender
  )

  ctx.currentProjection = appendTerminalProjection(ctx, 'succeeded', {
    result: resultFile,
    audioRun: audioRunFile,
    batchResultFiles,
    outputRefs: [{ path: contained(targetDir, input.finalPath), sha256: input.finalAudioSha256 }],
    reportedOutputRefs: [{
      path: contained(options.outputDir, input.reportedOutputPath),
      sha256: input.reportedOutputSha256,
    }],
  })
  const archive = buildCompactArchive({
    renderRef: { path: layout.archiveRenderPath, sha256: compactRenderFile.sha256 },
    timelineRef: { path: layout.archiveTimelinePath, sha256: archiveTimelineFile.sha256 },
    finalRef: {
      path: contained(options.outputDir, input.reportedOutputPath),
      sha256: input.reportedOutputSha256,
    },
    slotCount: input.compactSlots.length,
  })
  ctx.currentProjection.archive = archive
  if (!ctx.localCompositionOnly && !options.comicContext) {
    const { activeWork: _activeWork, ...terminalProjection } = ctx.currentProjection
    ctx.currentProjection = terminalProjection
  }
  const usedSlotReuse = [...ctx.recoveredBySlot.values()]
    .some((entry) => entry.value.provenance === 'slot-reuse')
  if (usedSlotReuse && !ctx.localCompositionOnly) {
    ctx.currentProjection = buildCompactTerminalProjection({
      renderIdentity: purePlan.renderIdentity,
      resultIdentity: resultFile.value.resultIdentity,
      audioRunId: audioRun.audioRunId,
      archive,
      at: ctx.now(),
    })
  }
  const artifactDir = usedSlotReuse && !ctx.localCompositionOnly
    ? archiveRelativeDir
    : targetRelativeDir
  ctx.terminalState = stateForProjection(
    options.target,
    purePlan.targetKey,
    purePlan.transport,
    artifactDir,
    ctx.currentProjection
  )
  await publish(ctx, ctx.terminalState)
  return currentArtifacts(input, audioRun, targetRelativeDir)
}

export const publishCompactCompletion = async (
  input: SuccessPublicationInput
): Promise<CurrentTtsRenderArtifacts> => {
  const { ctx, resultFile } = input
  const { options, purePlan, archiveRelativeDir, layout, targetRelativeDir } = ctx

  const timelineFile = await writeJsonReplace(
    options.outputDir,
    `${options.outputDir}/${layout.archiveTimelinePath}`,
    input.timeline
  )
  const compactRenderFile = await writeJsonReplace(
    options.outputDir,
    `${options.outputDir}/${layout.archiveRenderPath}`,
    input.compactRender
  )
  const archive = buildCompactArchive({
    renderRef: { path: layout.archiveRenderPath, sha256: compactRenderFile.sha256 },
    timelineRef: { path: layout.archiveTimelinePath, sha256: timelineFile.sha256 },
    finalRef: {
      path: contained(options.outputDir, input.reportedOutputPath),
      sha256: input.reportedOutputSha256,
    },
    slotCount: input.compactSlots.length,
  })
  const audioRun = buildAudioRun({
    schemaVersion: 1,
    targetKey: purePlan.targetKey,
    renderPlanId: purePlan.renderPlanId,
    renderIdentity: purePlan.renderIdentity,
    providerResult: {
      resultIdentity: resultFile.value.resultIdentity,
      path: layout.archiveRenderPath,
      sha256: compactRenderFile.sha256,
    },
    takeSelections: [],
    continuationCheckpoints: [],
    mixPlan: {
      mixPlanId: input.mixPlan.mixPlanId,
      path: contained(input.audioRunRoot, input.mixPlanFile.path),
      sha256: input.mixPlanFile.sha256,
    },
    transformLedger: {
      transformLedgerId: input.ledger.transformLedgerId,
      path: contained(input.audioRunRoot, input.ledgerFile.path),
      sha256: input.ledgerFile.sha256,
    },
    finalTimeline: {
      timelineId: input.timeline.timelineId,
      path: layout.archiveTimelinePath,
      sha256: timelineFile.sha256,
    },
    finalOutputs: [{
      path: contained(options.outputDir, input.reportedOutputPath),
      sha256: input.reportedOutputSha256,
      format: input.finalAudio.format,
      durationMs: input.finalAudio.durationMs,
    }],
    createdAt: ctx.now(),
  })
  ctx.currentProjection = buildCompactTerminalProjection({
    renderIdentity: purePlan.renderIdentity,
    resultIdentity: resultFile.value.resultIdentity,
    audioRunId: audioRun.audioRunId,
    archive,
    at: ctx.now(),
  })
  ctx.terminalState = stateForProjection(
    options.target,
    purePlan.targetKey,
    purePlan.transport,
    archiveRelativeDir,
    ctx.currentProjection
  )
  await publish(ctx, ctx.terminalState)

  await removeContainedDirectory(options.outputDir, layout.workDir)
  await removeContainedDirectory(options.outputDir, targetRelativeDir)
  await removeContainedDirectoryIfEmpty(options.outputDir, ctx.artifactRoot)
  const referencedSlotHashes = new Set(input.compactSlots.map((slot) => slot.slotHash))
  const slotEntries = await readDirectoryIfPresent(`${options.outputDir}/${layout.slotsDir}`)
  await Promise.all(slotEntries.map(async (name) => {
    const slotHash = name.replace(/\.wav$/, '')
    if (name.endsWith('.wav') && !referencedSlotHashes.has(slotHash)) {
      await unlinkIfPresent(`${options.outputDir}/${layout.slotsDir}/${name}`)
    }
  }))
  return currentArtifacts(input, audioRun, archiveRelativeDir)
}
