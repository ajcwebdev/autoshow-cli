import { copyFileExact } from '~/utils/bun-file-io'
import { readdir, rename } from 'node:fs/promises'
import { basename, join, relative } from 'node:path'
import type { GenerateImagesCommandOptions, ImageRunStats } from '~/types'
import { ValidationError } from '~/utils/error-handler'
import { atomicWriteJson } from '~/utils/filesystem'
import { toPosixPath } from '~/utils/runtime-paths'
import { recordComicImageRevision } from '../../comic-utils/comic-manifest'
import { getSceneOutputDirectory } from '../../comic-utils/project-paths'
import { REVISION_COMPARISON_MODEL, REVISION_IMAGE_MODEL } from './revision-evaluation-config'
import type { LoadedRevisionPlan, PanelLedger, RevisionEvaluationDependencies } from './revision-evaluation-types'
import { ledgerPathFor, panelDirectoryName, sha256File } from './revision-evidence-files'

const atomicPromote = async (candidatePath: string, canonicalPath: string, expectedCandidateSha256: string): Promise<string> => {
  const temporary = `${canonicalPath}.revision-${crypto.randomUUID()}.tmp`
  await copyFileExact(candidatePath, temporary)
  if (await sha256File(temporary) !== expectedCandidateSha256) throw ValidationError(`Staged revision bytes do not match candidate ${basename(candidatePath)}.`, { stage: 'comic:revision-promotion' })
  await rename(temporary, canonicalPath)
  const actual = await sha256File(canonicalPath)
  if (actual !== expectedCandidateSha256) throw ValidationError(`Promoted canonical bytes do not match candidate ${basename(candidatePath)}.`, { stage: 'comic:revision-promotion' })
  return actual
}

const canonicalPanelArtifactRefs = async (sceneDirectory: string): Promise<Array<{ path: string; sha256: string }>> => {
  const panelsDirectory = join(sceneDirectory, 'panels')
  const entries = (await readdir(panelsDirectory, { withFileTypes: true })).filter(entry => entry.isFile() && /^panel-\d+\.png$/.test(entry.name)).sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }))
  return await Promise.all(entries.map(async entry => ({ path: toPosixPath(relative(sceneDirectory, join(panelsDirectory, entry.name))), sha256: await sha256File(join(panelsDirectory, entry.name)) })))
}

export const publishRevisionResults = async (options: GenerateImagesCommandOptions, dependencies: RevisionEvaluationDependencies, loaded: LoadedRevisionPlan, results: PanelLedger[], stats: ImageRunStats) => {
  const promotedPanels = results.filter(ledger => ledger.decision === 'clear-winner').map(ledger => ledger.panelNumber)
  const retainedOriginalPanels = results.filter(ledger => ledger.decision !== 'clear-winner').map(ledger => ledger.panelNumber)
  const sceneDirectory = getSceneOutputDirectory(options.sceneSlug)
  const completedComparisons = results.reduce((sum, item) => sum + item.comparisonSlots.filter(slot => slot.status === 'completed').length, 0)
  const comparisonAttempts = results.reduce((sum, item) => sum + item.comparisonSlots.length, 0)
  const winnerHashByPath = new Map<string, string>(results.flatMap(ledger => ledger.decision === 'clear-winner' && ledger.candidateSha256
    ? [[`panels/panel-${String(ledger.panelNumber).padStart(2, '0')}.png`, ledger.candidateSha256] as const]
    : []))
  const artifactRefs = (await canonicalPanelArtifactRefs(sceneDirectory)).map(ref => ({ ...ref, sha256: winnerHashByPath.get(ref.path) ?? ref.sha256 }))
  const entryByPanel = new Map(loaded.entries.map(entry => [entry.panelNumber, entry] as const))
  const publishedThisRun = new Set<number>()
  const publishFinal = async (): Promise<Array<{ path: string; sha256: string }>> => {
    for (const ledger of results.filter(item => item.decision === 'clear-winner')) {
      const entry = entryByPanel.get(ledger.panelNumber)
      if (!entry || !ledger.candidateSha256) throw ValidationError(`Panel ${ledger.panelNumber} clear winner is missing publication state.`, { stage: 'comic:revision-promotion' })
      const current = await sha256File(entry.originalPath)
      if (current !== ledger.candidateSha256) {
        if (current !== entry.original.sha256) throw ValidationError(`Panel ${ledger.panelNumber} canonical bytes drifted before revision publication.`, { stage: 'comic:revision-promotion' })
        await atomicPromote(join(loaded.evidenceDirectory, panelDirectoryName(ledger.panelNumber), 'candidate.png'), entry.originalPath, ledger.candidateSha256)
        publishedThisRun.add(ledger.panelNumber)
      }
      ledger.promoted = true
      ledger.canonicalSha256After = ledger.candidateSha256
      await atomicWriteJson(ledgerPathFor(loaded.evidenceDirectory, ledger.panelNumber), ledger)
    }
    return await canonicalPanelArtifactRefs(sceneDirectory)
  }
  const rollbackFinal = async (): Promise<void> => {
    for (const panelNumber of publishedThisRun) {
      const entry = entryByPanel.get(panelNumber)
      const ledger = results.find(item => item.panelNumber === panelNumber)
      if (!entry || !ledger) continue
      await atomicPromote(join(loaded.evidenceDirectory, panelDirectoryName(panelNumber), 'original.png'), entry.originalPath, entry.original.sha256)
      ledger.promoted = false
      ledger.canonicalSha256After = entry.original.sha256
      await atomicWriteJson(ledgerPathFor(loaded.evidenceDirectory, panelNumber), ledger)
    }
  }
  await (dependencies.recordManifest ?? recordComicImageRevision)({
    sceneRunDir: sceneDirectory,
    evaluation: {
      schemaVersion: 1,
      experimentId: loaded.plan.experimentId,
      planFingerprint: loaded.plan.planFingerprint,
      evidenceDirectory: toPosixPath(relative(sceneDirectory, loaded.evidenceDirectory)),
      imageProvider: { service: 'openai', model: REVISION_IMAGE_MODEL, attempts: results.filter(item => item.imageSlot).length, completed: stats.imagesGenerated, ambiguous: results.filter(item => item.imageSlot?.status === 'ambiguous').length },
      comparisonProvider: { service: 'gemini', model: REVISION_COMPARISON_MODEL, attempts: comparisonAttempts, completed: completedComparisons, invalid: comparisonAttempts - completedComparisons },
      promotedPanels,
      retainedOriginalPanels,
      actualCostUsd: stats.totalCost,
    },
    artifactRefs,
    publishFinal,
    rollbackFinal,
  })
  return { promotedPanels, retainedOriginalPanels, completedComparisons }
}
