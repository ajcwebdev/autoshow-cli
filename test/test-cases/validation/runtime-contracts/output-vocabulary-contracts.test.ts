import { describe, expect, test } from 'bun:test'
import { describeSourceVocabularyViolations as describeViolations, listSourceVocabularyFiles as listFilesUnder, scanSourceVocabulary as scan, scanWholeSourceFiles as scanWholeFile, SOURCE_VOCABULARY_SRC_ROOT as SRC_ROOT, SOURCE_VOCABULARY_TEST_ROOT as TEST_ROOT, toSourceVocabularyRepoPath } from './source-vocabulary-scanner'

const TEST_CAPTURE_OWNERS = [
  'test/test-utils/test-console-harness.ts',
  'test/test-utils/console-capture.ts'
]

const LOGGER_SINK_FILES = [
  'src/utils/app-logger/sinks/human-sink.ts',
  'src/utils/app-logger/sinks/json-sink.ts',
  'src/utils/app-logger/core.ts',
  'src/utils/app-logger/result-emitter.ts'
]

const PAYLOAD_STDOUT_FILES = [
  'src/cli/native/dispatcher.ts',
  'src/cli/commands/process-steps/step-1-download/download-targets/single/metadata-output.ts',
  'src/tools/analyze-typescript-complexity.ts',
  'src/tools/audit-ocr-token-shapes.ts'
]

const CONSOLE_ALLOWLIST = new Set([...LOGGER_SINK_FILES, ...PAYLOAD_STDOUT_FILES])

const PLAIN_THROW_ALLOWLIST = new Set<string>([])

const PROCESS_EXIT_ALLOWLIST = new Set([
  'src/cli/create-cli.ts',
  'src/cli/failure-handlers.ts',
  'src/tools/repo-snapshot.ts',
  'src/tools/unique-source-name-check.ts'
])

const ASSIGNED_ERROR_ALLOWLIST = new Set<string>([])

const CONSOLE_PATTERN = /(?<![\w.$])console\s*\.\s*(?:log|error|warn|info|debug)\s*\(/
const PROCESS_WRITE_PATTERN = /process\s*\.\s*std(?:out|err)\s*\.\s*write\s*\(/
const PLAIN_THROW_PATTERN = /throw\s+new\s+Error\s*\(/

const BUILTIN_ERROR_THROW_PATTERN =
  /throw\s+new\s+(?:TypeError|RangeError|SyntaxError|ReferenceError|EvalError|URIError|AggregateError|DOMException)\s*\(/

const ASSIGNED_ERROR_PATTERN = /Object\s*\.\s*assign\s*\(\s*(?:\n\s*)?new\s+\w*Error\s*\(/

const PROCESS_EXIT_PATTERN = /(?<![\w.$])process\s*\.\s*exit\s*\(/

const listSourceFiles = async (): Promise<string[]> => await listFilesUnder(SRC_ROOT)

describe('src output and error vocabulary contracts', () => {
  test('no raw console.* outside the logger sinks and declared stdout payloads', async () => {
    const violations = await scan(CONSOLE_PATTERN, CONSOLE_ALLOWLIST)
    expect(describeViolations(violations)).toEqual([])
  })

  test('no raw process.stdout/stderr writes outside the emitter and declared payloads', async () => {
    const violations = await scan(PROCESS_WRITE_PATTERN, CONSOLE_ALLOWLIST)
    expect(describeViolations(violations)).toEqual([])
  })

  test('every throw in src uses the AppError family, never a plain Error', async () => {
    const violations = await scan(PLAIN_THROW_PATTERN, PLAIN_THROW_ALLOWLIST)
    expect(describeViolations(violations)).toEqual([])
  })

  test('no builtin error subclass is thrown in src either', async () => {
    const violations = await scan(BUILTIN_ERROR_THROW_PATTERN, PLAIN_THROW_ALLOWLIST)
    expect(describeViolations(violations)).toEqual([])
  })

  test('no duck-typed Object.assign(new Error(...)) provider errors in src', async () => {
    const violations = await scanWholeFile(ASSIGNED_ERROR_PATTERN, ASSIGNED_ERROR_ALLOWLIST)
    expect(describeViolations(violations)).toEqual([])
  })

  test('process.exit stays in the two failure handlers and the standalone scripts', async () => {
    const violations = await scan(PROCESS_EXIT_PATTERN, PROCESS_EXIT_ALLOWLIST)
    expect(describeViolations(violations)).toEqual([])
  })

  test('console interception stays in the shared harness and capture helper', async () => {
    const violations = await scan(
      /(?<![\w.$])console\s*\.\s*(?:log|error|warn|info|debug)\s*=(?!=)/,
      new Set(TEST_CAPTURE_OWNERS),
      TEST_ROOT
    )
    expect(describeViolations(violations)).toEqual([])
  })

  test('logger sink swapping goes through the shared capture helper', async () => {
    const violations = await scan(
      /\bconfig\s*\.\s*sinks\b/,
      new Set(TEST_CAPTURE_OWNERS),
      TEST_ROOT
    )
    expect(describeViolations(violations)).toEqual([])
  })

  test('the allowlists only name files that still exist', async () => {
    const present = new Set([
      ...(await listSourceFiles()),
      ...(await listFilesUnder(TEST_ROOT))
    ].map(toSourceVocabularyRepoPath))
    const stale = [
      ...CONSOLE_ALLOWLIST,
      ...PLAIN_THROW_ALLOWLIST,
      ...ASSIGNED_ERROR_ALLOWLIST,
      ...PROCESS_EXIT_ALLOWLIST,
      ...TEST_CAPTURE_OWNERS
    ].filter((file) => !present.has(file))
    expect(stale).toEqual([])
  })
})
