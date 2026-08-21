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

const parseEstimatedCostValue = (line: string): number | null => {
  const exactCents = line.match(/\(([0-9]+(?:\.[0-9]+)?)¢\)/)
  if (exactCents?.[1]) {
    const value = Number.parseFloat(exactCents[1])
    return Number.isFinite(value) ? value : null
  }

  const valueMatch = line.match(/(?:Suite total estimated cost|Total estimated cost):\s*(free|<0\.01¢|\$([0-9]+(?:\.[0-9]+)?)|([0-9]+(?:\.[0-9]+)?)¢)/i)
  if (!valueMatch) {
    return null
  }

  if (valueMatch[1]?.toLowerCase() === 'free') {
    return 0
  }

  if (valueMatch[1] === '<0.01¢') {
    return 0.01
  }

  const usdRaw = valueMatch[2]
  if (usdRaw) {
    const value = Number.parseFloat(usdRaw)
    return Number.isFinite(value) ? value * 100 : null
  }

  const centsRaw = valueMatch[3]
  if (centsRaw) {
    const value = Number.parseFloat(centsRaw)
    return Number.isFinite(value) ? value : null
  }

  return null
}

const parseEstimatedTotalFromClean = (clean: string): number | null => {
  const matches: Array<{ index: number; value: number }> = []

  for (const match of clean.matchAll(/(?:Suite total estimated cost|Total estimated cost):[^\r\n]*/gi)) {
    const value = parseEstimatedCostValue(match[0])
    if (value !== null) {
      matches.push({ index: match.index ?? 0, value })
    }
  }

  for (const match of clean.matchAll(/"totalEstimatedCostCents":\s*([0-9]+(?:\.[0-9]+)?)/g)) {
    const value = Number.parseFloat(match[1] ?? '')
    if (Number.isFinite(value)) {
      matches.push({ index: match.index ?? 0, value })
    }
  }

  for (const match of clean.matchAll(/"totalEstimatedCost":\s*"([0-9]+(?:\.[0-9]+)?)¢"/g)) {
    const value = Number.parseFloat(match[1] ?? '')
    if (Number.isFinite(value)) {
      matches.push({ index: match.index ?? 0, value })
    }
  }

  matches.sort((left, right) => left.index - right.index)
  const last = matches[matches.length - 1]
  if (!last) {
    return null
  }
  return last.value
}

const parseOutputDirFromClean = (clean: string): string | null => {
  const patterns = [
    /(?:^|\n)\s*(?:outputDir|output dir|retryOutputDir|retry output dir):\s*([^\n\r]+)/g,
    /(?:^|\n)\s*(?:manifest):\s*([^\n\r]+\/manifest\.json)/g,
    /Locations[\s\S]*?│\s*(?:outputDir|output dir|retryOutputDir|retry output dir)\s*│\s*([^\n\r│]+?)\s*│/g,
    /Artifacts[\s\S]*?│\s*manifest\s*│\s*([^\n\r│]+\/manifest\.json)\s*│/g,
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

/**
 * `[i/n] name` progress prefix and the tail dumps that follow a failure. Both were
 * hand-inlined at their call sites; keeping them beside `formatTimedOutputPrefix` means the
 * runner's line shapes are defined in one place.
 */
export const formatProgressCounter = (index: number, total: number): string =>
  `[${index + 1}/${total}]`

const COMMAND_TAIL_LINES = 20

export const formatOutputTail = (label: string, output: string, lineCount = COMMAND_TAIL_LINES): string | undefined => {
  const tail = output.split('\n').slice(-lineCount).join('\n')
  return tail.trim().length > 0 ? `  ${label} tail:\n${tail}` : undefined
}
