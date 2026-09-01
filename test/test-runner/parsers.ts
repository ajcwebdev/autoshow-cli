import { readFile } from 'node:fs/promises'
import type {
  ParsedCommandMetric,
  ParsedJunitCase,
  TestStatus
} from '~/types'
import { decodeXml, normalizeRepoPath, parseXmlAttributes, getFiniteNumber, readString } from './utils'
import { isObjectLike } from '~/utils/value-helpers'
import { parseJsonlBytes } from '~/utils/jsonl-reader'
import { hasErrorCode } from '~/utils/error-handler'

const readNonEmptyString = (record: Record<string, unknown>, key: string): string | null => {
  const value = readString(record, key)
  return value !== null && value.length > 0 ? value : null
}

export const readMetrics = async (path: string): Promise<ParsedCommandMetric[]> => {
  try {
    const bytes = await readFile(path)
    const records = parseJsonlBytes(bytes, { allowTornFinalRecord: true, label: 'Test metrics log' })
    const out: ParsedCommandMetric[] = []

    for (const parsedRaw of records) {
      if (!isObjectLike(parsedRaw)) {
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
  } catch (error) {
    if (hasErrorCode(error, 'ENOENT')) return []
    throw error
  }
}

const FAILURE_TAG_PATTERN = /<failure\b([^>]*)>([\s\S]*?)<\/failure>|<failure\b([^>]*)\/>/
const ERROR_TAG_PATTERN = /<error\b([^>]*)>([\s\S]*?)<\/error>|<error\b([^>]*)\/>/
const SKIPPED_TAG_PATTERN = /<skipped\b([^>]*)\/?>(?:[\s\S]*?<\/skipped>)?/

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
