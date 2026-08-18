import { readFile } from 'node:fs/promises'
import type {
  ParsedCommandMetric,
  ParsedJunitCase,
  TestStatus
} from '~/types'
import { decodeXml, normalizeRepoPath, parseXmlAttributes, getFiniteNumber, readString } from './utils'

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const readNonEmptyString = (record: Record<string, unknown>, key: string): string | null => {
  const value = readString(record, key)
  return value !== null && value.length > 0 ? value : null
}

export const readMetrics = async (path: string): Promise<ParsedCommandMetric[]> => {
  try {
    const text = await readFile(path, 'utf8')
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean)
    const out: ParsedCommandMetric[] = []

    for (const line of lines) {
      let parsedRaw: unknown
      try {
        parsedRaw = JSON.parse(line)
      } catch {
        continue
      }

      if (!isRecord(parsedRaw)) {
        continue
      }

      const source = readString(parsedRaw, 'source') ?? 'unknown'
      const command = readString(parsedRaw, 'command') ?? ''
      const args = Array.isArray(parsedRaw['args'])
        ? parsedRaw['args'].filter((value): value is string => typeof value === 'string')
        : []
      const exitCode = typeof parsedRaw['exitCode'] === 'number' ? parsedRaw['exitCode'] : Number.NaN
      const durationMs = typeof parsedRaw['durationMs'] === 'number' ? parsedRaw['durationMs'] : Number.NaN

      if (!Number.isFinite(exitCode) || !Number.isFinite(durationMs)) {
        continue
      }

      const callerFile = normalizeRepoPath(readString(parsedRaw, 'callerFile'))
      const callerLine = getFiniteNumber(parsedRaw['callerLine'])
      const callerColumn = getFiniteNumber(parsedRaw['callerColumn'])
      const outputDir = readNonEmptyString(parsedRaw, 'outputDir')
      const outputRoot = readNonEmptyString(parsedRaw, 'outputRoot')
      const at = readString(parsedRaw, 'at')
      const testName = readString(parsedRaw, 'testName')
      const estimatedCostCents = getFiniteNumber(parsedRaw['estimatedCostCents'])
      const actualCostCents = getFiniteNumber(parsedRaw['actualCostCents'])
      const estimatedProcessingTimeMs = getFiniteNumber(parsedRaw['estimatedProcessingTimeMs'])
      const actualProcessingTimeMs = getFiniteNumber(parsedRaw['actualProcessingTimeMs'])

      out.push({
        source,
        command,
        args,
        exitCode,
        durationMs,
        outputDir,
        outputRoot,
        callerFile,
        callerLine,
        callerColumn,
        at,
        testName,
        estimatedCostCents,
        actualCostCents,
        estimatedProcessingTimeMs,
        actualProcessingTimeMs,
      })
    }

    return out
  } catch {
    return []
  }
}

const FAILURE_TAG_PATTERN = /<failure\b([^>]*)>([\s\S]*?)<\/failure>|<failure\b([^>]*)\/>/
const ERROR_TAG_PATTERN = /<error\b([^>]*)>([\s\S]*?)<\/error>|<error\b([^>]*)\/>/
const SKIPPED_TAG_PATTERN = /<skipped\b([^>]*)\/?>(?:[\s\S]*?<\/skipped>)?/

/**
 * Failure/error/skipped cascade for one `<testcase>` body. Both tag patterns alternate between a
 * paired form (attrs in group 1, body text in group 2) and a self-closing form (attrs in group 3),
 * so attrs and body text are each resolved by walking failure-then-error across both groups. That
 * cross-tag walk is preserved verbatim from the pre-refactor parser: a body carrying a
 * self-closing `<failure />` next to a paired `<error>text</error>` reports the failure tag's
 * (empty) attrs with the error tag's body text.
 */
export const resolveTestcaseStatus = (body: string): { status: TestStatus, failureMessage: string | null } => {
  const failureTag = body.match(FAILURE_TAG_PATTERN)
  const errorTag = body.match(ERROR_TAG_PATTERN)

  if (failureTag || errorTag) {
    const failureAttrs = parseXmlAttributes(
      failureTag?.[1] ?? failureTag?.[3] ?? errorTag?.[1] ?? errorTag?.[3] ?? ''
    )
    const msgFromAttr = failureAttrs['message']?.trim()
    if (msgFromAttr && msgFromAttr.length > 0) {
      return { status: 'failed', failureMessage: msgFromAttr }
    }

    const bodyText = decodeXml((failureTag?.[2] ?? errorTag?.[2] ?? '').trim())
    return { status: 'failed', failureMessage: bodyText.length > 0 ? bodyText : 'Test failed' }
  }

  if (SKIPPED_TAG_PATTERN.test(body)) {
    return { status: 'skipped', failureMessage: null }
  }

  return { status: 'passed', failureMessage: null }
}

export const parseTestcase = (attrsRaw: string, body: string, suiteFile: string): ParsedJunitCase => {
  const attrs = parseXmlAttributes(attrsRaw)

  const name = attrs['name'] || 'unnamed'
  const file = normalizeRepoPath(attrs['file']) ?? suiteFile
  const lineRaw = attrs['line']
  const line = lineRaw ? Number.parseInt(lineRaw, 10) : Number.NaN
  const lineNumber = Number.isFinite(line) ? line : null
  const seconds = Number.parseFloat(attrs['time'] || '0')
  const durationMs = Number.isFinite(seconds) ? Math.round(seconds * 1000) : 0

  const { status, failureMessage } = resolveTestcaseStatus(body)

  return {
    id: `${file || 'unknown-file'}::${name}`,
    file: file || 'unknown-file',
    name,
    line: lineNumber,
    durationMs,
    status,
    failureMessage,
  }
}

export const parseJunit = async (junitPath: string): Promise<ParsedJunitCase[]> => {
  let xml = ''
  try {
    xml = await readFile(junitPath, 'utf8')
  } catch {
    return []
  }

  const tests: ParsedJunitCase[] = []
  const suiteRe = /<testsuite\b([^>]*)>([\s\S]*?)<\/testsuite>/g

  for (const suiteMatch of xml.matchAll(suiteRe)) {
    const suiteAttrs = parseXmlAttributes(suiteMatch[1] ?? '')
    const suiteBody = suiteMatch[2] ?? ''
    const suiteFile = normalizeRepoPath(suiteAttrs['file']) ?? ''

    const testcaseRe = /<testcase\b([^>]*)\/>|<testcase\b([^>]*)>([\s\S]*?)<\/testcase>/g
    for (const tcMatch of suiteBody.matchAll(testcaseRe)) {
      tests.push(parseTestcase(tcMatch[1] ?? tcMatch[2] ?? '', tcMatch[3] ?? '', suiteFile))
    }
  }

  return tests
}
