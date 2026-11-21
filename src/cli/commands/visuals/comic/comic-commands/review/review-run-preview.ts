import { join, relative, resolve } from 'node:path'
import type { ComicImageRunRecord, ComicPanelSelectionRecord, ReviewSheetCandidate, ReviewSheetRunPage, ReviewSheetRunPreview } from '~/types'
import { readFileBytes } from '~/utils/bun-file-io'
import { isPathAbsenceError } from '~/utils/filesystem'
import { readPngChunks } from '~/utils/lossless-png'
import { pathIsPhysicallyWithinRoot } from '~/utils/runtime-containment'
import { verifyStrictPngIntegrity } from '../../comic-utils/png-integrity'
import { normalizeProjectPath } from '../../comic-utils/project-paths'

const panelRangeLabel = (panelNumbers: number[]): string => {
  const first = panelNumbers[0]
  const last = panelNumbers.at(-1)
  const contiguous = panelNumbers.every((panelNumber, index) => index === 0 || panelNumber === (panelNumbers[index - 1] as number) + 1)
  return contiguous && first !== undefined && last !== undefined ? (first === last ? String(first) : `${first}-${last}`) : panelNumbers.join(', ')
}

type PreviewImage<T> =
  | { status: 'available'; imagePath: string; evidence: T }
  | { status: 'missing' | 'invalid'; imagePath: null }

export const readReviewRunPreview = async (
  record: ComicImageRunRecord, panelNumbers: number[], selections: Map<number, ComicPanelSelectionRecord>,
  sceneDirectory: string, reviewDirectory: string,
): Promise<{ run: ReviewSheetRunPreview; candidates: Map<number, ReviewSheetCandidate> }> => {
  const inspect = async <T>(directory: 'panels' | 'pages', candidatePath: string, verify: (bytes: Uint8Array) => T): Promise<PreviewImage<T>> => {
    const runDirectory = join(sceneDirectory, directory, record.runId)
    const path = resolve(sceneDirectory, candidatePath)
    try {
      if (!pathIsPhysicallyWithinRoot(sceneDirectory, runDirectory) || !pathIsPhysicallyWithinRoot(runDirectory, path)) return { status: 'invalid', imagePath: null }
      const evidence = verify(await readFileBytes(path))
      return { status: 'available', imagePath: normalizeProjectPath(relative(reviewDirectory, path)), evidence }
    } catch (error) {
      return { status: isPathAbsenceError(error) ? 'missing' : 'invalid', imagePath: null }
    }
  }

  const recorded = new Map(record.panels.map(panel => [panel.panelNumber, panel]))
  const candidates = new Map<number, ReviewSheetCandidate>()
  for (const panelNumber of panelNumbers) {
    const panel = recorded.get(panelNumber)
    const image = panel ? await inspect('panels', panel.candidatePath, verifyStrictPngIntegrity) : null
    const recordedSha256 = panel?.sha256 ?? null
    if (image?.status !== 'available') {
      candidates.set(panelNumber, { status: image?.status ?? 'missing', recordedSha256, imagePath: null, sha256: null, width: null, height: null })
      continue
    }
    const evidence = image.evidence
    const changed = !panel || evidence.sha256 !== panel.sha256 || evidence.width !== panel.width || evidence.height !== panel.height
    const status = changed ? 'changed' : evidence.sha256 === selections.get(panelNumber)?.sha256 ? 'selected' : 'alternative'
    candidates.set(panelNumber, { status, recordedSha256, imagePath: changed ? null : image.imagePath, ...evidence })
  }

  const pages: ReviewSheetRunPage[] = []
  for (const page of record.pages ?? []) {
    // Run page records identify a path and panel range. Grids may exceed the single-panel decode limit,
    // so check the composite's PNG framing and chunk checksums before linking it.
    const image = page.kind === 'local-grid'
      ? await inspect('pages', page.candidatePath, readPngChunks)
      : await inspect('pages', page.candidatePath, verifyStrictPngIntegrity)
    pages.push({
      pageNumber: page.pageNumber,
      panelNumbers: page.panelNumbers,
      panelRange: panelRangeLabel(page.panelNumbers),
      kind: page.kind,
      status: image.status,
      imagePath: image.imagePath,
    })
  }
  const panelsWithStatus = (status: ReviewSheetCandidate['status']) => panelNumbers.filter(number => candidates.get(number)?.status === status)
  const run = {
    runId: record.runId, service: record.service, model: record.model, pages,
    missingPanels: panelsWithStatus('missing'), changedPanels: panelsWithStatus('changed'), invalidPanels: panelsWithStatus('invalid'),
  }
  return { run, candidates }
}
