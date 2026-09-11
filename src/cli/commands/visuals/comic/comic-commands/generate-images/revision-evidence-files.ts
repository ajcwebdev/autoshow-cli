import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { ValidationError } from '~/utils/error-handler'
import { atomicWriteJson } from '~/utils/filesystem'
import type { LoadedRevisionEntry, LoadedRevisionPlan, PanelLedger, RevisionPlanEntry } from './revision-evaluation-types'

export const sha256File = async (path: string): Promise<string> => new Bun.CryptoHasher('sha256').update(new Uint8Array(await Bun.file(path).arrayBuffer())).digest('hex')

export const panelDirectoryName = (panelNumber: number): string => `panel-${String(panelNumber).padStart(2, '0')}`

export const ledgerPathFor = (evidenceDirectory: string, panelNumber: number): string => join(evidenceDirectory, panelDirectoryName(panelNumber), 'panel-ledger.json')

export const readLedger = async (path: string): Promise<PanelLedger | undefined> => {
  if (!(await Bun.file(path).exists())) return undefined
  try { return JSON.parse(await Bun.file(path).text()) as PanelLedger } catch (error) {
    throw ValidationError(`Revision ledger is unreadable: ${path}`, { stage: 'comic:revision-evaluation', ...(error instanceof Error ? { cause: error } : {}) })
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
