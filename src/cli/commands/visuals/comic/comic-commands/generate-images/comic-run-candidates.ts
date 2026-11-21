import { relative } from 'node:path'
import type { ComicImageRunRecord, ComicPanelImageEvidence, ImageGenerationModel } from '~/types'
import { InfraError, ValidationError } from '~/utils/error-handler'
import { comicLog } from '../../comic-utils/comic-logger'
import { resolveImageService } from '../../comic-utils/image-service'
import { publishFirstPanelSelection, recordImageRunCandidates } from '../../comic-utils/panel-selection'
import { getSceneOutputDirectory } from '../../comic-utils/project-paths'

const resolveRunService = (model: ImageGenerationModel): string => {
  const service = resolveImageService(model)
  if (!service) throw InfraError(`Comic image model ${model} is missing its central provider identity.`, { stage: 'comic:generate-images' })
  return service
}

/** Workspace-relative path with forward slashes, so recorded candidates stay portable across checkouts. */
const toSceneWorkspacePath = (sceneSlug: string, path: string): string => {
  const workspacePath = relative(getSceneOutputDirectory(sceneSlug), path).split('\\').join('/')
  if (!workspacePath || workspacePath.startsWith('../') || workspacePath === '..') {
    throw ValidationError(`Comic image candidate is outside the scene workspace: ${path}`, { stage: 'comic:generate-images' })
  }
  return workspacePath
}

/**
 * Record an individual final panel on its run and offer it to the empty canonical slot.
 * Called after generation and after reuse of an existing run candidate, so an interrupted first publication completes without another image request.
 */
export const recordAndPublishPanelCandidate = async (input: {
  sceneSlug: string
  runId: string
  model: ImageGenerationModel
  panelNumber: number
  outputPath: string
  generatedEvidence?: ComicPanelImageEvidence | undefined
}): Promise<void> => {
  const service = resolveRunService(input.model)
  const candidatePath = toSceneWorkspacePath(input.sceneSlug, input.outputPath)
  // Only a fresh provider result can establish new evidence before publication.
  // A retry must verify the existing file against what the run already recorded.
  if (input.generatedEvidence) {
    await recordImageRunCandidates(input.sceneSlug, {
      runId: input.runId,
      service,
      model: input.model,
      panels: [{ panelNumber: input.panelNumber, candidatePath, ...input.generatedEvidence }],
      createdAt: new Date().toISOString(),
    })
  }
  const publication = await publishFirstPanelSelection({
    sceneSlug: input.sceneSlug,
    runId: input.runId,
    service,
    model: input.model,
    panelNumber: input.panelNumber,
    candidatePath,
  })
  comicLog.line(publication.message, [`panel=${input.panelNumber}`, `outcome=${publication.outcome}`, `run=${input.runId}`])
}

/** Provider-generated pages and local grids are preview-only run outputs; they never fill panel slots. */
export const recordRunPageCandidate = async (input: {
  sceneSlug: string
  runId: string
  model: ImageGenerationModel
  pageNumber: number
  panelNumbers: number[]
  outputPath: string
  kind: NonNullable<ComicImageRunRecord['pages']>[number]['kind']
}): Promise<void> => {
  await recordImageRunCandidates(input.sceneSlug, {
    runId: input.runId,
    service: resolveRunService(input.model),
    model: input.model,
    panels: [],
    pages: [{ pageNumber: input.pageNumber, panelNumbers: input.panelNumbers, candidatePath: toSceneWorkspacePath(input.sceneSlug, input.outputPath), kind: input.kind }],
    createdAt: new Date().toISOString(),
  })
}
