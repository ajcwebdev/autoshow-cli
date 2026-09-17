import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

export const ocrRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/service/text/ocr/mistral-ocr-4-0.test.ts', [
    command('extract-mistral-mistral-ocr-4-0', 'extract-mistral-mistral-ocr-4-0', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'mistral=mistral-ocr-4-0', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/ocr/glm-5.3-flash.test.ts', [
    command('extract-glm-glm-5.3-flash', 'extract-glm-glm-5.3-flash', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'glm=glm-5.3-flash', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/ocr/kimi-k2.6.test.ts', [
    command('extract-kimi-kimi-k2.6', 'extract-kimi-kimi-k2.6', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'kimi=kimi-k2.6', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/ocr/gemini-3.5-flash-lite.test.ts', [
    command('extract-gemini-gemini-3.5-flash-lite', 'extract-gemini-gemini-3.5-flash-lite', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'gemini=gemini-3.5-flash-lite', '--price']),
    command('extract-gemini-gemini-3.5-flash', 'extract-gemini-gemini-3.5-flash', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'gemini=gemini-3.5-flash', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/ocr/deepinfra-gemma-4-31b-it.test.ts', [
    command('extract-deepinfra-google-gemma-4-31b-it', 'extract-deepinfra-google/gemma-4-31B-it', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'deepinfra=google/gemma-4-31B-it', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/ocr/deepinfra-qwen3.8-27b.test.ts', [
    command('extract-deepinfra-qwen-qwen3.8-27b', 'extract-deepinfra-Qwen/Qwen3.8-27B', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'deepinfra=Qwen/Qwen3.8-27B', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/ocr/deepinfra-deepseek-v4.1-flash.test.ts', [
    command('extract-deepinfra-deepseek-ai-deepseek-v4.1-flash', 'extract-deepinfra-deepseek-ai/DeepSeek-V4.1-Flash', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'deepinfra=deepseek-ai/DeepSeek-V4.1-Flash', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/ocr/grok-4.6.test.ts', [
    command('extract-grok-grok-4.6', 'extract-grok-grok-4.6', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/benchmarks/ocr/1-document.png', '--provider', 'grok=grok-4.6', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/ocr/gemini-3.7-flash.test.ts', [
    command('extract-gemini-gemini-3.7-flash', 'extract-gemini-gemini-3.7-flash', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'gemini=gemini-3.7-flash', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/ocr/gemini-3.8-flash.test.ts', [
    command('extract-gemini-gemini-3.8-flash', 'extract-gemini-gemini-3.8-flash', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'gemini=gemini-3.8-flash', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/ocr/anthropic-claude-fable-5-1.test.ts', [
    command('extract-anthropic-claude-fable-5-1', 'extract-anthropic-claude-fable-5-1', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'anthropic=claude-fable-5-1', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/ocr/openai-gpt-6-astra.test.ts', [
    command('extract-openai-gpt-6-astra', 'extract-openai-gpt-6-astra', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'openai=gpt-6-astra', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/ocr/mistral-ocr-4-1.test.ts', [
    command('extract-mistral-mistral-ocr-4-1', 'extract-mistral-mistral-ocr-4-1', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'mistral=mistral-ocr-4-1', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/ocr/anthropic-claude-sonnet-5.test.ts', [
    command('extract-anthropic-claude-sonnet-5', 'extract-anthropic-claude-sonnet-5', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'anthropic=claude-sonnet-5', '--price']),
  ]),
]
