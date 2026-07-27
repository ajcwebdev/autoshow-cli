import type { Step2Metadata } from '~/types'

export const buildSttMetadata = (overrides: Partial<Step2Metadata> = {}): Step2Metadata => ({
  transcriptionService: 'deepgram',
  transcriptionModel: 'nova-3',
  processingTime: 1234,
  tokenCount: 0,
  ...overrides
})

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export const findPricingNoteKeys = (value: unknown): string[] => {
  const keys: string[] = []
  const visit = (entry: unknown): void => {
    if (Array.isArray(entry)) {
      for (const item of entry) visit(item)
      return
    }
    if (!isRecord(entry)) {
      return
    }
    for (const [key, child] of Object.entries(entry)) {
      if (key === 'note' || key === 'notes') {
        keys.push(key)
      }
      visit(child)
    }
  }

  visit(value)
  return keys
}

export const parseJsonLines = (text: string): unknown[] =>
  text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.startsWith('{') && line.endsWith('}'))
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as unknown]
      } catch {
        return []
      }
    })
