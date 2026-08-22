import { describe, expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { PROJECT_ROOT } from '~/utils/runtime-paths'
import { describeSourceVocabularyViolations as describeViolations, listSourceVocabularyFiles as listFilesUnder, scanSourceVocabulary as scan, scanWholeSourceFiles as scanWholeFile, SOURCE_VOCABULARY_SRC_ROOT as SRC_ROOT, SOURCE_VOCABULARY_TEST_ROOT as TEST_ROOT, stripSourceComments as stripComments } from './source-vocabulary-scanner'

const RETRY_ENGINE = 'src/utils/retries.ts'

const PACING_SLEEP_ALLOWLIST = new Set([
  RETRY_ENGINE,
  'src/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/stt-mistral/mistral-stt-pass-controller.ts',
  'src/cli/commands/process-steps/step-4-tts/voice-management/canonical-voice-audition.ts'
])

const POLICY_MODULE_ALLOWLIST = new Set([
  RETRY_ENGINE,
  'src/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-utils/ocr-retry.ts'
])

const RETRY_PRIMITIVE_ALLOWLIST = new Set([RETRY_ENGINE])

const BACKOFF_SLEEP_PATTERN = /(?:\bawait\s+Bun\s*\.\s*sleep\s*\()|(?:setTimeout\s*\(\s*resolve\b)/

const POLICY_DELAY_LITERAL_PATTERN = /\b(?:baseDelayMs|maxDelayMs)\s*:\s*\d/

const POLICY_ATTEMPTS_LITERAL_PATTERN = /policy\s*:\s*\{[^}]*\bmaxAttempts\s*:\s*\d/

const RETRY_PRIMITIVE_PATTERN = /\b(?:const|function)\s+(?:sleepWithAbortSignal|computeDelay|compute\w*RetryDelay)\b/

describe('src retry vocabulary contracts', () => {
  test('backoff sleeping happens in the retry engine, not in a hand-rolled loop', async () => {
    const violations = await scan(BACKOFF_SLEEP_PATTERN, PACING_SLEEP_ALLOWLIST)
    expect(describeViolations(violations)).toEqual([])
  })

  test('retry policy numbers are declared only in the policy modules', async () => {
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
    const registryPath = 'test/test-utils/provider-failure-classifiers.ts'
    const source = await readFile(join(PROJECT_ROOT, registryPath), 'utf8')

    expect(source).toContain("from '~/utils/retries'")
    expect(source).toContain('RETRYABLE_STATUS_CODES')
    expect(source).toContain('NETWORK_FAILURE_SPELLINGS')

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
