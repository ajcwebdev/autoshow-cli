import { expect, test } from 'bun:test'
import { writeCommand } from '~/cli/commands/process-steps/step-3-write/define-write-command'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseCommandInvocation } from '~/cli/native/native-parser'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { readPromptFlags } from '~/cli/options/option-resolution/prompt-options'

const parseWrite = (args: string[]) =>
  parseCommandInvocation(['write', ...args], writeCommand, GLOBAL_FLAG_DEFINITIONS)

test('omitted --prompt resolves to an empty prompt list', () => {
  const parsed = parseWrite(['input.txt'])

  expect(parsed.flags['prompt']).toBeUndefined()
  expect(readPromptFlags(parsed.flags)).toEqual([])
  expect(buildOptsFromFlags(false, parsed.flags).prompts).toEqual([])
})

test('repeated --prompt values accumulate in order', () => {
  const parsed = parseWrite(['input.txt', '--prompt', 'shortSummary', 'longSummary', '--prompt=chapterTitles'])

  expect(parsed.flags['prompt']).toEqual(['shortSummary', 'longSummary', 'chapterTitles'])
  expect(readPromptFlags(parsed.flags)).toEqual(['shortSummary', 'longSummary', 'chapterTitles'])
  expect(buildOptsFromFlags(false, parsed.flags).prompts).toEqual(['shortSummary', 'longSummary', 'chapterTitles'])
})
