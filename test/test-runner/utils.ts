import { dirname, isAbsolute, normalize, relative, resolve } from 'node:path'
import { stripAnsi } from '~/utils/terminal-colors'

export const COMMAND_OUTPUT_PARSE_TAIL_CHARS = 64 * 1024

export const normalizeRepoPath = (path: string | null | undefined): string | null => {
  if (!path || path.trim().length === 0) {
    return null
  }

  const trimmed = path.trim().replace(/^file:\/\//, '')
  const abs = isAbsolute(trimmed) ? trimmed : resolve(process.cwd(), trimmed)
  return normalize(relative(process.cwd(), abs)).replace(/\\/g, '/')
}

export const getFiniteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

export const readString = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key]
  return typeof value === 'string' ? value : null
}

const prepareCommandOutputForParse = (text: string): string => {
  if (text.length <= COMMAND_OUTPUT_PARSE_TAIL_CHARS) {
    return stripAnsi(text)
  }

  const sliced = text.slice(-COMMAND_OUTPUT_PARSE_TAIL_CHARS)
  const newlineIndex = sliced.indexOf('\n')
  const tail = newlineIndex === -1 ? sliced : sliced.slice(newlineIndex + 1)
  return stripAnsi(tail)
}

const parseEstimatedTotalFromClean = (clean: string): number | null => {
  for (const line of clean.trim().split('\n').reverse()) {
    let parsed: unknown
    try {
      parsed = JSON.parse(line) as unknown
    } catch {
      continue
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) continue
    const record = parsed as Record<string, unknown>
    if (record['schemaVersion'] !== 1 || record['type'] !== 'result') continue
    if (record['status'] !== 'success') return null
    const data = record['data']
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null
    const estimate = (data as Record<string, unknown>)['estimate']
    if (!estimate || typeof estimate !== 'object' || Array.isArray(estimate)) return null
    const value = (estimate as Record<string, unknown>)['totalEstimatedCostCents']
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
  }
  return null
}

const parseOutputDirFromClean = (clean: string): string | null => {
  const patterns = [
    /(?:^|\n)\s*(?:outputDir|output dir|retryOutputDir|retry output dir):\s*([^\n\r]+)/g,
    /(?:^|\n)\s*(?:manifest):\s*([^\n\r]+\/manifest\.json)/g,
    /"artifact"\s*:\s*"outputDir"[\s\S]*?"path"\s*:\s*"([^"\n\r]+)"/g,
    /"manifest"\s*:\s*"([^"\n\r]+\/manifest\.json)"/g,
  ]

  for (const pattern of patterns) {
    const matches = Array.from(clean.matchAll(pattern))
    const last = matches[matches.length - 1]
    if (!last) {
      continue
    }
    const value = last[1]?.trim()
    if (value && value.length > 0) {
      if (value.endsWith('/manifest.json')) {
        return dirname(value)
      }
      return value
    }
  }

  return null
}

export const parseCommandEstimatedTotal = (text: string): number | null =>
  parseEstimatedTotalFromClean(prepareCommandOutputForParse(text))

export const parseOutputDirFromText = (text: string): string | null =>
  parseOutputDirFromClean(prepareCommandOutputForParse(text))

export const parseCommandOutputText = (text: string): {
  outputDir: string | null
  estimatedCostCents: number | null
} => {
  const clean = prepareCommandOutputForParse(text)
  return {
    outputDir: parseOutputDirFromClean(clean),
    estimatedCostCents: parseEstimatedTotalFromClean(clean),
  }
}

export const decodeXml = (text: string): string => {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

export const parseXmlAttributes = (input: string): Record<string, string> => {
  const attrs: Record<string, string> = {}
  const re = /(\w+)="([^"]*)"/g
  for (const match of input.matchAll(re)) {
    const key = match[1]
    const value = match[2]
    if (key && value !== undefined) {
      attrs[key] = decodeXml(value)
    }
  }
  return attrs
}

export const formatTimestampForDir = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`
}

const TIMED_OUTPUT_PREFIX_PATTERN = /^(?:\x1b\[[0-9;]*m|\s)*\[\d{2}:\d{2}:\d{2}(\.\d{3})?\]/

export const lineHasTimedOutputPrefix = (line: string): boolean => TIMED_OUTPUT_PREFIX_PATTERN.test(line)

export const formatTimedOutputPrefix = (atMs: number = Date.now()): string => {
  const date = new Date(atMs)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0')
  return `[${hours}:${minutes}:${seconds}.${milliseconds}]`
}

export const formatProgressCounter = (index: number, total: number): string =>
  `[${index + 1}/${total}]`

const COMMAND_TAIL_LINES = 20

export const formatOutputTail = (label: string, output: string, lineCount = COMMAND_TAIL_LINES): string | undefined => {
  const tail = output.split('\n').slice(-lineCount).join('\n')
  return tail.trim().length > 0 ? `  ${label} tail:\n${tail}` : undefined
}
