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

test('links selector rejects retired per-provider selector flags', () => {
  expect(() => parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--openai',
    'models'
  ])).toThrow('Unexpected flag: --openai')
})

test('links selector rejects a section folded into the provider value', () => {
  expect(() => parseLinksArgv([
    'bun',
    'src/cli/create-cli.ts',
    'links',
    '--provider',
    'openai=models'
  ])).toThrow('Unknown links provider "openai=models"')
})
