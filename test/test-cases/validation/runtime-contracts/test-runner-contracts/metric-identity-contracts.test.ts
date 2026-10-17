import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import type { ParsedCommandMetric, ParsedJunitCase, TestRunArtifacts } from '~/types'
import { matchMetricsToTests } from '../../../../test-runner/reports/matching'
import { currentRegisteredTestName } from '../../../../test-utils/test-identity'

const FILE = 'test/test-cases/validation/stt/workflows/transcript-video/transcript-video-contracts.test.ts'

const junitCase = (name: string, line: number, durationMs = 1000): ParsedJunitCase => ({
  id: `${FILE}::${name}`, file: FILE, name, line, durationMs, status: 'passed', failureMessage: null
})

const metric = (overrides: Partial<ParsedCommandMetric>): ParsedCommandMetric => ({
  source: 'helper', command: 'bun src/cli/create-cli.ts extract', args: [], exitCode: 0, durationMs: 900,
  outputDir: null, callerFile: FILE, callerLine: null, callerColumn: null, at: null, testName: null,
  estimatedCostCents: null, actualCostCents: null, estimatedProcessingTimeMs: null, actualProcessingTimeMs: null,
  ...overrides
})

const artifacts = { rootDir: '/nonexistent', runDir: join('/nonexistent', 'run'), metadataDirPath: join('/nonexistent', 'run', 'metadata') } as TestRunArtifacts

// A helper that registers tests on a caller's behalf, like the shared service-test definers.
const registerThroughHelper = (name: string, body: () => void): void => {
  test(name, body)
}

describe('registered test identity', () => {
  const outsideAnyTest = currentRegisteredTestName()

  test('a running test sees the name it was registered with', () => {
    expect(currentRegisteredTestName()).toBe('a running test sees the name it was registered with')
    expect(outsideAnyTest).toBeNull()
  })

  registerThroughHelper('a test registered through a helper keeps its own name', () => {
    expect(currentRegisteredTestName()).toBe('a test registered through a helper keeps its own name')
  })

  test('the name survives awaits inside the test', async () => {
    await Bun.sleep(1)
    expect(currentRegisteredTestName()).toBe('the name survives awaits inside the test')
  })
})

describe('command metric matching', () => {
  test('an explicit registered name matches its test even when the command line differs from the declaration', async () => {
    const declared = junitCase('extract transcript-video renders from a media extract output directory', 74)
    const { matched, unmatched } = await matchMetricsToTests([metric({ callerLine: 75, testName: declared.name })], [declared], artifacts)

    expect(unmatched).toEqual([])
    expect(matched.get(declared.id)?.matchedBy).toBe('name-file')
  })

  test('without an identity the same command stays visibly unmatched instead of being guessed', async () => {
    const declared = junitCase('extract transcript-video renders from a media extract output directory', 74)
    const command = metric({ callerLine: 75 })
    const { matched, unmatched } = await matchMetricsToTests([command], [declared], artifacts)

    expect(matched.size).toBe(0)
    expect(unmatched).toEqual([command])
  })

  test('several commands run by one test all attach to that test', async () => {
    const declared = junitCase('extract transcript-video renders from explicit audio and transcript text files', 105)
    const commands = [metric({ callerLine: 106, testName: declared.name }), metric({ callerLine: 112, testName: declared.name })]
    const { matched, unmatched } = await matchMetricsToTests(commands, [declared], artifacts)

    expect(unmatched).toEqual([])
    expect(matched.get(declared.id)?.metrics).toEqual(commands)
  })

  test('a name shared by two tests in one file never attaches to an arbitrary one of them', async () => {
    const first = junitCase('renders the fixture', 20)
    const second = { ...junitCase('renders the fixture', 40), id: `${FILE}::renders the fixture#2` }
    const command = metric({ callerLine: 41, testName: 'renders the fixture' })
    const { matched, unmatched } = await matchMetricsToTests([command], [first, second], artifacts)

    expect(matched.size).toBe(0)
    expect(unmatched).toEqual([command])
  })

  test('a command whose caller file and name are both unknown stays unmatched', async () => {
    const command = metric({ callerFile: null, testName: null })
    const { unmatched } = await matchMetricsToTests([command], [junitCase('any test', 10)], artifacts)

    expect(unmatched).toEqual([command])
  })
})
