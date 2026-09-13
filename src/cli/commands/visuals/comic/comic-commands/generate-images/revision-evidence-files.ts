import { mkdir, readdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { ValidationError } from '~/utils/error-handler'
import { atomicWriteJson } from '~/utils/filesystem'
import { isDeepStrictEqual } from 'node:util'
import { parseRevisionComparison, normalizeRevisionComparison } from './revision-comparison-policy'
import { REVISION_COMPARISON_MODEL, REVISION_COMPARISON_PROVIDER } from './revision-evaluation-config'
import type { LoadedRevisionEntry, LoadedRevisionPlan, PanelLedger, RevisionPlanEntry } from './revision-evaluation-types'

export const sha256File = async (path: string): Promise<string> => new Bun.CryptoHasher('sha256').update(new Uint8Array(await Bun.file(path).arrayBuffer())).digest('hex')

export const panelDirectoryName = (panelNumber: number): string => `panel-${String(panelNumber).padStart(2, '0')}`

export const ledgerPathFor = (evidenceDirectory: string, panelNumber: number): string => join(evidenceDirectory, panelDirectoryName(panelNumber), 'panel-ledger.json')

export const readLedger = async (path: string): Promise<PanelLedger | undefined> => {
  const evidenceFiles = await readdir(dirname(path)).catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return []; throw error })
  const comparisonFiles = evidenceFiles.filter(name => /^comparison-pass-\d+(?:-error)?\.json$/.test(name))
  if (!(await Bun.file(path).exists())) {
    if (comparisonFiles.length > 0) throw ValidationError('Unidentified saved comparisons have no panel ledger; existing evidence is preserved.', { stage: 'comic:revision-evaluation' })
    return undefined
  }
  try {
    const ledger = JSON.parse(await Bun.file(path).text()) as PanelLedger
    if (!Array.isArray(ledger.comparisonSlots)) throw ValidationError('Invalid comparison slots')
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
  const existing = await readLedger(path)
  const ledger = existing ?? createInitialLedger(loaded.plan.planFingerprint, entry)
  if (ledger.planFingerprint !== loaded.plan.planFingerprint || ledger.panelNumber !== entry.panelNumber || ledger.originalSha256 !== entry.original.sha256) throw ValidationError(`Panel ${entry.panelNumber} ledger does not match the revision plan.`, { stage: 'comic:revision-evaluation' })
  if (!existing) await atomicWriteJson(path, ledger)
  return { path, directory, ledger }
}
