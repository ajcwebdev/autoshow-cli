import { mkdir, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { ValidationError } from '~/utils/error-handler'
import { atomicWriteJson } from '~/utils/filesystem'
import { isDeepStrictEqual } from 'node:util'
import { parseRevisionComparison, normalizeRevisionComparison } from './revision-comparison-policy'
import { REVISION_COMPARISON_MODEL, REVISION_COMPARISON_PROVIDER, REVISION_IMAGE_MODEL } from './revision-evaluation-config'
import type { LoadedRevisionEntry, LoadedRevisionPlan, PanelLedger, RevisionPlan, RevisionPlanEntry } from './revision-evaluation-types'

export const sha256File = async (path: string): Promise<string> => new Bun.CryptoHasher('sha256').update(new Uint8Array(await Bun.file(path).arrayBuffer())).digest('hex')

export const panelDirectoryName = (panelNumber: number): string => `panel-${String(panelNumber).padStart(2, '0')}`

export const ledgerPathFor = (evidenceDirectory: string, panelNumber: number): string => join(evidenceDirectory, panelDirectoryName(panelNumber), 'panel-ledger.json')

const incompatibleImageEvidence = (detail: string) => ValidationError(`${detail}. Preserve this experiment and use a new experiment ID and plan fingerprint for new edits with ${REVISION_IMAGE_MODEL}.`, { stage: 'comic:revision-evaluation' })

export const readPublishedRevision = async (directory: string, plan: RevisionPlan): Promise<{ imageModel: string; panels: PanelLedger[] } | undefined> => {
  const file = Bun.file(join(directory, 'revision-evaluation.json'))
  if (!(await file.exists())) return undefined
  const summary = await file.json()
  if (summary?.mode !== 'revision-evaluation' || summary.schemaVersion !== 1 || summary.planFingerprint !== plan.planFingerprint
    || summary.sceneSlug !== plan.sceneSlug || summary.experimentId !== plan.experimentId
    || summary.comparisonProvider !== REVISION_COMPARISON_PROVIDER || summary.comparisonModel !== REVISION_COMPARISON_MODEL
    || ![REVISION_IMAGE_MODEL, 'gpt-image-2.5-flare', 'gpt-image-2'].includes(summary.imageModel)
    || !Array.isArray(summary.panels) || summary.panels.length !== plan.entries.length
    || !summary.panels.every((panel: PanelLedger, index: number) => panel?.panelNumber === plan.entries[index]?.panelNumber)) {
    throw incompatibleImageEvidence('Published revision identity does not match the frozen plan and its providers')
  }
  return { imageModel: summary.imageModel, panels: summary.panels }
}

export const readLedger = async (path: string, plan: RevisionPlan, entry: RevisionPlanEntry, imageModel: string, publishedPanel?: PanelLedger): Promise<PanelLedger | undefined> => {
  const evidenceFiles: string[] = await readdir(dirname(path)).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return []; throw error })
  const comparisonFiles = evidenceFiles.filter(name => /^comparison-pass-\d+(?:-error)?\.json$/.test(name))
  if (!(await Bun.file(path).exists())) {
    if (comparisonFiles.length > 0) throw ValidationError('Unidentified saved comparisons have no panel ledger; existing evidence is preserved.', { stage: 'comic:revision-evaluation' })
    if (publishedPanel || evidenceFiles.includes('candidate.png') || evidenceFiles.includes('original.png')) throw incompatibleImageEvidence('Saved image evidence has no panel ledger')
    return undefined
  }
  try {
    const ledger = JSON.parse(await Bun.file(path).text()) as PanelLedger
    if (ledger.planFingerprint !== plan.planFingerprint || ledger.panelNumber !== entry.panelNumber || ledger.originalSha256 !== entry.original.sha256) throw incompatibleImageEvidence('Panel ledger does not match the frozen plan')
    const slot = ledger.imageSlot
    const archived = imageModel !== REVISION_IMAGE_MODEL
    if (!archived && publishedPanel?.imageSlot && (publishedPanel.imageSlot.provider !== 'openai' || publishedPanel.imageSlot.model !== imageModel)) {
      throw incompatibleImageEvidence('Published image slot has an incompatible or unidentified provider/model')
    }
    const unidentifiedLegacySlot = archived && slot?.provider === undefined && slot?.model === undefined
    if (slot && !unidentifiedLegacySlot && (slot.provider !== 'openai' || slot.model !== imageModel)) throw incompatibleImageEvidence('Incompatible or unidentified saved image provider/model')
    if (!slot && (publishedPanel?.imageSlot || evidenceFiles.includes('candidate.png') || ledger.candidateSha256)) throw incompatibleImageEvidence('Saved image evidence has no image slot')
    if (slot?.status === 'completed' && (!evidenceFiles.includes('candidate.png') || await sha256File(join(dirname(path), 'candidate.png')) !== ledger.candidateSha256)) throw incompatibleImageEvidence('Completed image slot has missing or drifted candidate evidence')
    if (!Array.isArray(ledger.comparisonSlots)) throw ValidationError('Invalid comparison slots')
    if (archived && (!isDeepStrictEqual(ledger, publishedPanel) || slot?.status !== 'completed'
      || ledger.comparisonSlots.length !== 2 || ![1, 2].every(pass => ledger.comparisonSlots.some(item => item.pass === pass && item.status === 'completed'))
      || !['retain-original', 'clear-winner'].includes(ledger.decision ?? '') || ledger.promoted !== (ledger.decision === 'clear-winner')
      || !evidenceFiles.includes('original.png') || await sha256File(join(dirname(path), 'original.png')) !== ledger.originalSha256)) {
      throw incompatibleImageEvidence(`Incomplete or inconsistent revision evidence for retired image model ${imageModel}`)
    }
    for (const filename of comparisonFiles) {
      const evidence = JSON.parse(await Bun.file(join(dirname(path), filename)).text()) as Record<string, unknown>
      if (!ledger.comparisonSlots.some(slot => slot.pass === evidence['pass']) || evidence['provider'] !== REVISION_COMPARISON_PROVIDER || evidence['model'] !== REVISION_COMPARISON_MODEL) throw ValidationError('Incompatible or unidentified saved comparison evidence')
    }
    for (const slot of ledger.comparisonSlots) {
      if (slot.provider !== REVISION_COMPARISON_PROVIDER || slot.model !== REVISION_COMPARISON_MODEL) throw ValidationError('Incompatible or unidentified saved comparison provider/model; preserve existing evidence and use a separate revision experiment for new comparisons')
      if (slot.status !== 'completed') continue
      const evidence = JSON.parse(await Bun.file(join(dirname(path), `comparison-pass-${slot.pass}.json`)).text()) as Record<string, unknown>
      if (evidence['provider'] !== slot.provider || evidence['model'] !== slot.model || evidence['planFingerprint'] !== ledger.planFingerprint || evidence['panelNumber'] !== ledger.panelNumber || evidence['pass'] !== slot.pass) throw ValidationError('Incompatible or unidentified saved comparison evidence')
      const normalized = normalizeRevisionComparison(parseRevisionComparison(JSON.stringify(evidence['raw'])), slot.pass)
      if (slot.normalized?.comparisonContractVersion === 4 && !isDeepStrictEqual(slot.normalized, normalized)) throw ValidationError('Saved comparison judgment does not match its evidence')
    }
    return ledger
  } catch (error) {
    throw ValidationError(`Revision ledger is incompatible or unreadable: ${path}: ${error instanceof Error ? error.message : String(error)}`, { stage: 'comic:revision-evaluation', ...(error instanceof Error ? { cause: error } : {}) })
  }
}

const createInitialLedger = (planFingerprint: string, entry: RevisionPlanEntry): PanelLedger => ({ schemaVersion: 1, planFingerprint, panelNumber: entry.panelNumber, originalSha256: entry.original.sha256, comparisonSlots: [] })

export const loadOrCreateLedger = async (loaded: LoadedRevisionPlan, entry: LoadedRevisionEntry): Promise<{ path: string; directory: string; ledger: PanelLedger }> => {
  const directory = join(loaded.evidenceDirectory, panelDirectoryName(entry.panelNumber))
  const path = ledgerPathFor(loaded.evidenceDirectory, entry.panelNumber)
  await mkdir(directory, { recursive: true })
  const existing = await readLedger(path, loaded.plan, entry, REVISION_IMAGE_MODEL)
  const ledger = existing ?? createInitialLedger(loaded.plan.planFingerprint, entry)
  if (!existing) await atomicWriteJson(path, ledger)
  return { path, directory, ledger }
}
