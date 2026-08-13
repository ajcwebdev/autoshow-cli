import { expect, test } from 'bun:test'
import {
  parseLinksArgv
} from '~/cli/commands/setup-and-utilities/links/define-links-command'

test('links selector errors distinguish dashed global sections from valid providers', () => {
  expect(() => parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--stt',
    'tts'
  ])).toThrow('Unexpected flag: --stt')
})

test('links selector rejects inline provider values', () => {
  expect(() => parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--openai=models'
  ])).toThrow('links provider selector "--openai" does not accept inline values')
})
