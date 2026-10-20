import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

const WRITE_PRICE_INPUT = 'input/examples/tts/01-tts-short.md'

export const writeRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/service/text/write/openai-gpt-6.1-sol.test.ts', [
    command('write-openai-gpt-6.1-sol', 'write-openai-gpt-6.1-sol', ['src/cli/create-cli.ts', 'write', WRITE_PRICE_INPUT, '--provider', 'openai=gpt-6.1-sol', '--prompt', 'shortSummary', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/write/openai-gpt-6-luna.test.ts', [
    command('write-openai-gpt-6-luna', 'write-openai-gpt-6-luna', ['src/cli/create-cli.ts', 'write', WRITE_PRICE_INPUT, '--provider', 'openai=gpt-6-luna', '--prompt', 'shortSummary', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/write/anthropic-claude-opus-5-5.test.ts', [
    command('write-anthropic-claude-opus-5-5', 'write-anthropic-claude-opus-5-5', ['src/cli/create-cli.ts', 'write', WRITE_PRICE_INPUT, '--provider', 'anthropic=claude-opus-5-5', '--prompt', 'shortSummary', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/write/anthropic-claude-sonnet-5-5.test.ts', [
    command('write-anthropic-claude-sonnet-5-5', 'write-anthropic-claude-sonnet-5-5', ['src/cli/create-cli.ts', 'write', WRITE_PRICE_INPUT, '--provider', 'anthropic=claude-sonnet-5-5', '--prompt', 'shortSummary', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/write/anthropic-claude-haiku-5-5.test.ts', [
    command('write-anthropic-claude-haiku-5-5', 'write-anthropic-claude-haiku-5-5', ['src/cli/create-cli.ts', 'write', WRITE_PRICE_INPUT, '--provider', 'anthropic=claude-haiku-5-5', '--prompt', 'shortSummary', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/write/gemini-4-argon.test.ts', [
    command('write-gemini-gemini-4-argon', 'write-gemini-gemini-4-argon', ['src/cli/create-cli.ts', 'write', WRITE_PRICE_INPUT, '--provider', 'gemini=gemini-4-argon', '--prompt', 'shortSummary', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/write/grok-4.7.test.ts', [
    command('write-grok-grok-4.7', 'write-grok-grok-4.7', ['src/cli/create-cli.ts', 'write', WRITE_PRICE_INPUT, '--provider', 'grok=grok-4.7', '--prompt', 'shortSummary', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/write/gemini-3.8-flash.test.ts', [
    command('write-gemini-gemini-3.8-flash', 'write-gemini-gemini-3.8-flash', ['src/cli/create-cli.ts', 'write', WRITE_PRICE_INPUT, '--provider', 'gemini=gemini-3.8-flash', '--prompt', 'shortSummary', '--price']),
  ]),
]
