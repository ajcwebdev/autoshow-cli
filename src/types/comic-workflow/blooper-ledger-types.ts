export const BLOOPER_CATEGORIES = ['side-flip', 'seat-swap', 'furniture-spin', 'intruder', 'vanishing-crowd', 'wardrobe-swap', 'other'] as const

export type BlooperCategory = typeof BLOOPER_CATEGORIES[number]

export type BlooperRecord = {
  schemaVersion: 1
  runId: string
  episode: string
  sceneSlug: string
  panelNumber: number
  attemptNumber: number
  file: string
  sha256: string
  lastHopModel: string
  cleanLineage: boolean
  lineage: 'clean' | 'mixed' | 'unknown'
  qaVerdict: 'hard-failure' | 'passed' | 'not-judged'
  hardFailureKeys: string[]
  category: BlooperCategory
  capturedAt: string
}

export type BlooperCaptureInput = {
  sceneSlug: string
  episode: string
  runId: string
  panelNumber: number
  promotedPath: string
  attemptsDirectory: string
  imageModel: string
  bloopersRoot?: string | undefined
  now?: (() => Date) | undefined
}

export type BlooperCaptureResult = {
  copied: BlooperRecord[]
  ledgerPath: string
  readmePath: string
}
