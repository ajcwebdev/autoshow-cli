import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { parseCallerLocation } from '../../../../test-utils/test-caller-location'

const frame = (file: string, location = '12:8') => `    at caller (${resolve(file)}:${location})`

describe('test command caller attribution', () => {
  test('prefers the test case over a helper or runner frame', () => {
    expect(parseCallerLocation(['Error', frame('test/test-utils/test-helpers.ts'), frame('test/test-runner/runner.ts'), frame('test/test-cases/validation/example.test.ts', '42:7')].join('\n'))).toEqual({ file: 'test/test-cases/validation/example.test.ts', line: 42, column: 7 })
  })
  for (const helper of ['test-helpers', 'test-caller-location', 'test-command-execution', 'test-command-options', 'test-command-artifacts', 'test-output-directories']) {
    test(`excludes ${helper} from fallback attribution`, () => {
      expect(parseCallerLocation([frame(`test/test-utils/${helper}.ts`), frame('test/test-runner/local-driver.ts')].join('\n'))).toEqual({ file: 'test/test-runner/local-driver.ts', line: 12, column: 8 })
      expect(parseCallerLocation(frame(`test/test-utils/${helper}.ts`))).toEqual({ file: null, line: null, column: null })
    })
  }
  test('accepts file URL and unparenthesized frames while skipping malformed frames', () => {
    expect(parseCallerLocation(['Error', 'at malformed:line:column', frame('src/cli/create-cli.ts'), `at file://${resolve('test/test-cases/validation/example.test.ts')}:9:2`].join('\n'))).toEqual({ file: 'test/test-cases/validation/example.test.ts', line: 9, column: 2 })
  })
  test('returns an empty location when no eligible caller is present', () => {
    expect(parseCallerLocation('')).toEqual({ file: null, line: null, column: null })
    expect(parseCallerLocation('Error\n at unknown (native)')).toEqual({ file: null, line: null, column: null })
  })
})
