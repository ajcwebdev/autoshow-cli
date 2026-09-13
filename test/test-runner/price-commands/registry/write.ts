import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

const WRITE_PRICE_INPUT = 'input/examples/tts/00-tts-shortest.txt'

export const writeRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/service/text/write/gemini-3.5-flash-lite.test.ts', [
    command('write-gemini-gemini-3.5-flash-lite', 'write-gemini-gemini-3.5-flash-lite', ['src/cli/create-cli.ts', 'write', WRITE_PRICE_INPUT, '--llm', 'gemini=gemini-3.5-flash-lite', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/write/kimi-k2.6.test.ts', [
    command('write-kimi-kimi-k2.6', 'write-kimi-kimi-k2.6', ['src/cli/create-cli.ts', 'write', WRITE_PRICE_INPUT, '--llm', 'kimi=kimi-k2.6', '--prompt', 'shortSummary', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/write/gemini-3.8-flash.test.ts', [
    command('write-gemini-gemini-3.8-flash', 'write-gemini-gemini-3.8-flash', ['src/cli/create-cli.ts', 'write', 'input/examples/tts/00-tts-shortest.txt', '--llm', 'gemini=gemini-3.8-flash', '--prompt', 'shortSummary', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/write/glm-5.3.test.ts', [
    command('write-glm-glm-5.3', 'write-glm-glm-5.3', ['src/cli/create-cli.ts', 'write', 'input/examples/tts/00-tts-shortest.txt', '--llm', 'glm=glm-5.3', '--prompt', 'shortSummary', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/write/glm-5.3-flash.test.ts', [
    command('write-glm-glm-5.3-flash', 'write-glm-glm-5.3-flash', ['src/cli/create-cli.ts', 'write', 'input/examples/tts/00-tts-shortest.txt', '--llm', 'glm=glm-5.3-flash', '--prompt', 'shortSummary', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/write/together-kimi-k3.test.ts', [
    command('write-together-kimi-k3', 'write-together-kimi-k3', ['src/cli/create-cli.ts', 'write', 'input/examples/tts/00-tts-shortest.txt', '--llm', 'together=kimi-k3', '--prompt', 'shortSummary', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/write/together-glm-5.3.test.ts', [
    command('write-together-glm-5.3', 'write-together-glm-5.3', ['src/cli/create-cli.ts', 'write', 'input/examples/tts/00-tts-shortest.txt', '--llm', 'together=glm-5.3', '--prompt', 'shortSummary', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/write/together-glm-5.3-flash.test.ts', [
    command('write-together-glm-5.3-flash', 'write-together-glm-5.3-flash', ['src/cli/create-cli.ts', 'write', 'input/examples/tts/00-tts-shortest.txt', '--llm', 'together=glm-5.3-flash', '--prompt', 'shortSummary', '--price']),
  ]),
]
