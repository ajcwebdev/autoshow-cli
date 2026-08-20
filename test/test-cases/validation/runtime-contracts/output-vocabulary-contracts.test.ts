import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { Glob } from 'bun'
import { PROJECT_ROOT } from '~/utils/runtime-paths'

/**
 * Standing enforcement for the logging and error-handling vocabulary.
 *
 * ADR-006's original sweep was verified once and then drifted: 65 plain `throw new Error`
 * calls came back, and 42 raw `console.*` sites accumulated with nothing to catch them.
 * These greps turn both conventions into contracts that fail the suite instead of waiting
 * for the next audit, following the same executable-contract pattern the README examples
 * use (ADR-016).
 *
 * Every exception below is deliberate and explained. Adding a file here should be a
 * conscious decision recorded in review, not a way to route around the convention.
 */

const SRC_ROOT = join(PROJECT_ROOT, 'src')
const TEST_ROOT = join(PROJECT_ROOT, 'test')

/**
 * The one module allowed to own console interception and logger-sink swapping. ADR-019's
 * quiet-on-pass harness only works if a suite does not silently replace the interceptor,
 * and five hand-rolled capture helpers had grown up doing exactly that.
 */
const TEST_CAPTURE_OWNERS = [
  'test/test-utils/test-console-harness.ts',  // the preloaded harness itself
  'test/test-utils/console-capture.ts'        // the shared capture/sink helpers
]

// --- Allowlists --------------------------------------------------------------

/**
 * The primitives the logger itself is built on. These are the only places allowed to touch
 * the console directly, because everything else routes through them.
 */
const LOGGER_SINK_FILES = [
  'src/utils/app-logger/sinks/human-sink.ts',   // level-routed emission, non-TTY stderr fallback
  'src/utils/app-logger/sinks/json-sink.ts',    // NDJSON to stdout/stderr
  'src/utils/app-logger/core.ts',               // last-resort report when a sink itself throws
  'src/utils/app-logger/result-emitter.ts'      // the sanctioned structured-result channel
]

/**
 * Sanctioned stdout *payloads*: the bytes are the document the user asked for, and sink
 * decoration (timestamp, level symbol, indentation) would corrupt them.
 */
const PAYLOAD_STDOUT_FILES = [
  'src/cli/native/dispatcher.ts',                                                   // --help and --version output
  'src/cli/commands/process-steps/step-1-download/download-targets/single/metadata-output.ts', // `metadata --markdown` frontmatter
  'src/tools/analyze-typescript-complexity.ts',                                     // standalone `bun run` report
  'src/tools/audit-ocr-token-shapes.ts'                                             // standalone `bun run` report
]

const CONSOLE_ALLOWLIST = new Set([...LOGGER_SINK_FILES, ...PAYLOAD_STDOUT_FILES])

/** No exceptions: every throw in `src/` belongs to the AppError family (ADR-006). */
const PLAIN_THROW_ALLOWLIST = new Set<string>([])

// --- Scanning ----------------------------------------------------------------

const CONSOLE_PATTERN = /(?<![\w.$])console\s*\.\s*(?:log|error|warn|info|debug)\s*\(/
const PROCESS_WRITE_PATTERN = /process\s*\.\s*std(?:out|err)\s*\.\s*write\s*\(/
const PLAIN_THROW_PATTERN = /throw\s+new\s+Error\s*\(/

const listFilesUnder = async (root: string): Promise<string[]> => {
  const files: string[] = []
  for await (const file of new Glob('**/*.ts').scan({ cwd: root, absolute: true })) {
    files.push(file)
  }
  return files.sort()
}

const listSourceFiles = async (): Promise<string[]> => await listFilesUnder(SRC_ROOT)

// Line comments and block comments explain these conventions in prose all over the
// codebase; only executable code should be matched.
const stripComments = (source: string): string =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/(^|\s)\/\/.*$/, '$1'))
    .join('\n')

type Violation = { file: string, line: number, text: string }

const scan = async (
  pattern: RegExp,
  allowlist: ReadonlySet<string>,
  root: string = SRC_ROOT
): Promise<Violation[]> => {
  const violations: Violation[] = []
  for (const absolute of await listFilesUnder(root)) {
    const repoPath = relative(PROJECT_ROOT, absolute)
    if (allowlist.has(repoPath)) continue

    const lines = stripComments(await readFile(absolute, 'utf8')).split('\n')
    lines.forEach((text, index) => {
      if (pattern.test(text)) {
        violations.push({ file: repoPath, line: index + 1, text: text.trim() })
      }
    })
  }
  return violations
}

const describeViolations = (violations: readonly Violation[]): string[] =>
  violations.map(({ file, line, text }) => `${file}:${line}  ${text}`)

// --- Contracts ---------------------------------------------------------------

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

  test('console interception stays in the shared harness and capture helper', async () => {
    // Reassigning `console.*` anywhere else replaces ADR-019's buffering interceptor for
    // the duration, which is how output that a failing test needed got swallowed.
    const violations = await scan(
      /(?<![\w.$])console\s*\.\s*(?:log|error|warn|info|debug)\s*=(?!=)/,
      new Set(TEST_CAPTURE_OWNERS),
      TEST_ROOT
    )
    expect(describeViolations(violations)).toEqual([])
  })

  test('logger sink swapping goes through the shared capture helper', async () => {
    // Hand-rolled `l.config.sinks.length = 0` swaps forget to restore adjacent state (the
    // suppressed-category list), which leaked muted categories across suites.
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
    ].map((file) => relative(PROJECT_ROOT, file)))
    const stale = [...CONSOLE_ALLOWLIST, ...PLAIN_THROW_ALLOWLIST, ...TEST_CAPTURE_OWNERS]
      .filter((file) => !present.has(file))
    expect(stale).toEqual([])
  })
})
