import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { Glob } from 'bun'
import { PROJECT_ROOT } from '~/utils/runtime-paths'

/**
 * Standing enforcement for the retry vocabulary, in the same executable-contract shape as
 * the output/error vocabulary contracts next door.
 *
 * The audit that produced this found a whole parallel retry layer that had grown up beside
 * the central one: nine hand-rolled attempt loops, four bespoke polls, a second copy of the
 * delay math, a second copy of the abort-aware sleep, and four satellite policy constants
 * whose numbers had drifted from each other for the same class of operation. Every one of
 * those started as a single reasonable local decision. These greps make the next one fail
 * the suite instead of waiting for another audit.
 *
 * Every entry in an allowlist below is deliberate and explained in place. Adding one should
 * be a conscious decision recorded in review, not a way around the convention.
 */

const SRC_ROOT = join(PROJECT_ROOT, 'src')
const TEST_ROOT = join(PROJECT_ROOT, 'test')

/** The retry engine itself: the one place that owns delay math and abort-aware sleeping. */
const RETRY_ENGINE = 'src/utils/retries.ts'

/**
 * Deliberate pacing, not backoff. Neither reacts to a failure: they hold before a request
 * the provider has told us not to make yet, and both report the hold.
 */
const PACING_SLEEP_ALLOWLIST = new Set([
  RETRY_ENGINE,
  // Waits out a provider-signalled cooldown window before admitting the next request.
  'src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/stt-mistral/mistral-stt-pass-controller.ts',
  // Hume requires a fixed gap between audition requests; this is the documented gap.
  'src/cli/commands/process-steps/step-4-tts/voice-management/canonical-voice-audition.ts'
])

/**
 * The modules allowed to declare retry policy numbers. `retries.ts` holds the class table
 * and the named satellite policies; `ocr-retry.ts` derives its two policies from that table
 * and declares the one genuinely different shape (a schema retry that re-requests
 * immediately, because no provider backoff applies to a malformed 200 response).
 */
const POLICY_MODULE_ALLOWLIST = new Set([
  RETRY_ENGINE,
  'src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/ocr-retry.ts'
])

/** The one place allowed to implement abort-aware sleeping and jittered delay math. */
const RETRY_PRIMITIVE_ALLOWLIST = new Set([RETRY_ENGINE])

// --- Scanning ----------------------------------------------------------------

/**
 * `await Bun.sleep(...)` and the `new Promise(resolve => setTimeout(resolve, ...))` idiom.
 * Timer-based waiters that resolve on an *event* (the concurrency lanes, the chunk and page
 * schedulers, the download stall watchdog) do not match: they wake on work becoming
 * available, not on a fixed delay after a failure.
 */
const BACKOFF_SLEEP_PATTERN = /(?:\bawait\s+Bun\s*\.\s*sleep\s*\()|(?:setTimeout\s*\(\s*resolve\b)/

/**
 * Delay numbers belong to a policy and nothing else, so a literal one anywhere outside the
 * policy modules is a new tuning knob by definition.
 */
const POLICY_DELAY_LITERAL_PATTERN = /\b(?:baseDelayMs|maxDelayMs)\s*:\s*\d/

/**
 * An inline attempt count inside a `policy: { … }` override. `maxAttempts` on its own is
 * not enough to match on: it is also a field of the structured retry log, where reporting
 * the ceiling is the point.
 */
const POLICY_ATTEMPTS_LITERAL_PATTERN = /policy\s*:\s*\{[^}]*\bmaxAttempts\s*:\s*\d/

/** A second implementation of the two primitives that were duplicated before. */
const RETRY_PRIMITIVE_PATTERN = /\b(?:const|function)\s+(?:sleepWithAbortSignal|computeDelay|compute\w*RetryDelay)\b/

const listFilesUnder = async (root: string): Promise<string[]> => {
  const files: string[] = []
  for await (const file of new Glob('**/*.ts').scan({ cwd: root, absolute: true })) {
    files.push(file)
  }
  return files.sort()
}

// The conventions are explained in prose throughout the codebase; only code should match.
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

/** Whole-file variant, so an override broken across lines cannot evade a per-line grep. */
const scanWholeFile = async (
  pattern: RegExp,
  allowlist: ReadonlySet<string>,
  root: string = SRC_ROOT
): Promise<Violation[]> => {
  const violations: Violation[] = []
  for (const absolute of await listFilesUnder(root)) {
    const repoPath = relative(PROJECT_ROOT, absolute)
    if (allowlist.has(repoPath)) continue

    const source = stripComments(await readFile(absolute, 'utf8'))
    for (const match of source.matchAll(new RegExp(pattern.source, `${pattern.flags.replace('g', '')}gs`))) {
      const line = source.slice(0, match.index).split('\n').length
      violations.push({ file: repoPath, line, text: match[0].replace(/\s+/g, ' ') })
    }
  }
  return violations
}

const describeViolations = (violations: readonly Violation[]): string[] =>
  violations.map(({ file, line, text }) => `${file}:${line}  ${text}`)

// --- Contracts ---------------------------------------------------------------

describe('src retry vocabulary contracts', () => {
  test('backoff sleeping happens in the retry engine, not in a hand-rolled loop', async () => {
    // `exec()` carried its own attempt loop, its own jittered delay math and its own
    // private copy of the abort-aware sleep, while the central subprocess policy sat
    // unused. Both copies are gone; this keeps the next one from appearing.
    const violations = await scan(BACKOFF_SLEEP_PATTERN, PACING_SLEEP_ALLOWLIST)
    expect(describeViolations(violations)).toEqual([])
  })

  test('retry policy numbers are declared only in the policy modules', async () => {
    // Four satellite constants used to own numbers for the same class of operation, and
    // they drifted: 8 attempts against 4 for hosted TTS, 2/3/4 for the same STT
    // submission shape, and 60s/30s/10s ceilings for the same rate-limited create.
    expect(describeViolations(await scan(POLICY_DELAY_LITERAL_PATTERN, POLICY_MODULE_ALLOWLIST))).toEqual([])
    expect(describeViolations(await scanWholeFile(POLICY_ATTEMPTS_LITERAL_PATTERN, POLICY_MODULE_ALLOWLIST))).toEqual([])
  })

  test('the delay math and the abort-aware sleep exist once', async () => {
    const violations = await scan(RETRY_PRIMITIVE_PATTERN, RETRY_PRIMITIVE_ALLOWLIST)
    expect(describeViolations(violations)).toEqual([])
  })

  test('the retry class table has no dead classes', async () => {
    const source = await readFile(join(PROJECT_ROOT, 'src/types/runtime-core/retry-types.ts'), 'utf8')
    const declared = [...source.matchAll(/^\s*\|\s*'([a-z_]+)'/gm)].map((match) => match[1])
    expect(declared.length).toBeGreaterThan(0)

    const files = await listFilesUnder(SRC_ROOT)
    const sources = await Promise.all(files.map(async (file) => ({
      path: relative(PROJECT_ROOT, file),
      text: await readFile(file, 'utf8')
    })))

    // Three classes sat in the table with zero callers, one of them shadowed by a
    // divergent private twin. A class nobody uses is a policy nobody is applying.
    const unused = declared.filter((retryClass) => !sources.some(({ path, text }) =>
      path !== 'src/types/runtime-core/retry-types.ts'
      && path !== RETRY_ENGINE
      && text.includes(`'${retryClass}'`)
    ))
    expect(unused).toEqual([])
  })
})

describe('test retry vocabulary contracts', () => {
  test('the transient predicates derive their status and network vocabulary from production', async () => {
    // The registry re-encoded production's knowledge by hand and drifted from it: three
    // socket-failure spellings production retries were missing, and the retryable-status
    // set was written out three separate times.
    const registryPath = 'test/test-utils/provider-failure-classifiers.ts'
    const source = await readFile(join(PROJECT_ROOT, registryPath), 'utf8')

    expect(source).toContain("from '~/utils/retries'")
    expect(source).toContain('RETRYABLE_STATUS_CODES')
    expect(source).toContain('NETWORK_FAILURE_SPELLINGS')

    // No hand-typed copy of the retryable status set.
    const literalStatusSets = stripComments(source).match(/\b408\s*\|\s*425\s*\|\s*429\b/g) ?? []
    expect(literalStatusSets).toEqual([])
  })

  test('the allowlists only name files that still exist', async () => {
    const present = new Set([
      ...(await listFilesUnder(SRC_ROOT)),
      ...(await listFilesUnder(TEST_ROOT))
    ].map((file) => relative(PROJECT_ROOT, file)))

    const stale = [
      ...PACING_SLEEP_ALLOWLIST,
      ...POLICY_MODULE_ALLOWLIST,
      ...RETRY_PRIMITIVE_ALLOWLIST
    ].filter((file) => !present.has(file))
    expect(stale).toEqual([])
  })
})
