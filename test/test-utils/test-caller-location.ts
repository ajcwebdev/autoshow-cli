import { isAbsolute, relative, resolve } from 'node:path'
import type {
  CallerLocation
} from '~/types'

const TEST_CALLER_HELPER_FILES = new Set([
  'test/test-utils/test-helpers.ts',
  'test/test-utils/test-caller-location.ts',
  'test/test-utils/test-command-execution.ts',
  'test/test-utils/test-command-options.ts',
  'test/test-utils/test-command-artifacts.ts',
  'test/test-utils/test-output-directories.ts'
])

const parseTestCallerFrame = (line: string): { file: string; line: number; column: number } | undefined => {
  const matchWithParen = line.match(/\((.*):(\d+):(\d+)\)$/)
  const matchNoParen = line.match(/at (.*):(\d+):(\d+)$/)
  const match = matchWithParen ?? matchNoParen
  if (!match) {
    return undefined
  }

  const rawPath = match[1]
  const lineNo = Number.parseInt(match[2] || '', 10)
  const colNo = Number.parseInt(match[3] || '', 10)

  if (!rawPath || Number.isNaN(lineNo) || Number.isNaN(colNo)) {
    return undefined
  }

  const normalizedPath = rawPath.replace(/^file:\/\//, '')
  if (!normalizedPath.includes('/test/')) {
    return undefined
  }
  const absolutePath = isAbsolute(normalizedPath) ? normalizedPath : resolve(process.cwd(), normalizedPath)
  const relativePath = (relative(process.cwd(), absolutePath) || '.').replace(/\\/g, '/')
  return { file: relativePath, line: lineNo, column: colNo }
}

const selectTestCallerLocation = (candidates: Array<{ file: string; line: number; column: number }>): CallerLocation => {
  const testCase = candidates.find(candidate => candidate.file.includes('test/test-cases/'))
  if (testCase) return testCase
  return candidates.find(candidate => !TEST_CALLER_HELPER_FILES.has(candidate.file)) ?? { file: null, line: null, column: null }
}

export const parseCallerLocation = (stack: string): CallerLocation => {
  const candidates = stack.split('\n').flatMap(line => {
    const parsed = parseTestCallerFrame(line.trim())
    return parsed ? [parsed] : []
  })
  return selectTestCallerLocation(candidates)
}
