import { describe, expect, test } from 'bun:test'
import { describeSourceVocabularyViolations as describeViolations, listSourceVocabularyFiles as listFilesUnder, scanSourceVocabulary as scan, scanWholeSourceFiles as scanWholeFile, SOURCE_VOCABULARY_SRC_ROOT as SRC_ROOT, SOURCE_VOCABULARY_TEST_ROOT as TEST_ROOT, toSourceVocabularyRepoPath } from './source-vocabulary-scanner'

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

/**
 * The two top-level failure handlers plus the two standalone `bun run` scripts. Everything
 * else must throw an AppError and let `normalizeExitCode` decide, so a mid-pipeline module
 * cannot terminate a paid run by calling `process.exit` directly.
 */
const PROCESS_EXIT_ALLOWLIST = new Set([
  'src/cli/create-cli.ts',                 // cliErrorHandler: usage exit 2 / kind-derived exit code
  'src/cli/failure-handlers.ts',           // handleFatal for uncaughtException/unhandledRejection
  'src/tools/repo-snapshot.ts',            // standalone `bun run` script, outside the CLI dispatcher
  'src/tools/unique-source-name-check.ts'  // standalone `bun run` script, outside the CLI dispatcher
])

/**
 * Empty by design. The STT provider subsystem used to build its errors as
 * `Object.assign(new Error(msg), { status, headers, stage, retryClass })`, which produced
 * kind-less errors: `isAppError` was false, the provider_http hint branch never fired, and
 * an escape to `handleFatal` printed "payload redacted" instead of the message. Those sites
 * now build an `AppProviderError` (through `httpResponseError` or `ProviderError`) and
 * `Object.assign` only the duck-typed extras onto it.
 */
const ASSIGNED_ERROR_ALLOWLIST = new Set<string>([])

// --- Scanning ----------------------------------------------------------------

const CONSOLE_PATTERN = /(?<![\w.$])console\s*\.\s*(?:log|error|warn|info|debug)\s*\(/
const PROCESS_WRITE_PATTERN = /process\s*\.\s*std(?:out|err)\s*\.\s*write\s*\(/
const PLAIN_THROW_PATTERN = /throw\s+new\s+Error\s*\(/

/**
 * The builtin error constructors a throw site might reach for instead of `Error`. The
 * original contract grepped only `Error`, so a `throw new TypeError(...)` would have
 * slipped through with the same kind-less consequences.
 */
const BUILTIN_ERROR_THROW_PATTERN =
  /throw\s+new\s+(?:TypeError|RangeError|SyntaxError|ReferenceError|EvalError|URIError|AggregateError|DOMException)\s*\(/

/**
 * `Object.assign(new Error(...), {...})` — the duck-typed provider-error shape. Matching
 * across a line break too, because the STT sites spelled it over several lines.
 */
const ASSIGNED_ERROR_PATTERN = /Object\s*\.\s*assign\s*\(\s*(?:\n\s*)?new\s+\w*Error\s*\(/

const PROCESS_EXIT_PATTERN = /(?<![\w.$])process\s*\.\s*exit\s*\(/

const listSourceFiles = async (): Promise<string[]> => await listFilesUnder(SRC_ROOT)

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

  test('no builtin error subclass is thrown in src either', async () => {
    // The AppError family covers every failure the CLI raises; a `TypeError`/`RangeError`
    // thrown directly carries no kind, no exit code, and no hints.
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
