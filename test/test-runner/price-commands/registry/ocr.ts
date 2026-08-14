import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

export const ocrRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/mistral-ocr-2512.test.ts', [
    command('extract-mistral-mistral-ocr-2512', 'extract-mistral-mistral-ocr-2512', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'mistral=mistral-ocr-2512', '--price']),
    command('extract-mistral-mistral-ocr-4-0', 'extract-mistral-mistral-ocr-4-0', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'mistral=mistral-ocr-4-0', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/glm-ocr.test.ts', [
    command('extract-glm-glm-ocr', 'extract-glm-glm-ocr', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'glm=glm-ocr', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/kimi-k2.6.test.ts', [
    command('extract-kimi-kimi-k2.6', 'extract-kimi-kimi-k2.6', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'kimi=kimi-k2.6', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/openai-gpt-5.4-nano.test.ts', [
    command('extract-openai-gpt-5.4-nano', 'extract-openai-gpt-5.4-nano', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'openai=gpt-5.4-nano', '--price']),
    command('extract-openai-gpt-5.4-mini', 'extract-openai-gpt-5.4-mini', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'openai=gpt-5.4-mini', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/gemini-3.5-flash-lite.test.ts', [
    command('extract-gemini-gemini-3.5-flash-lite', 'extract-gemini-gemini-3.5-flash-lite', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'gemini=gemini-3.5-flash-lite', '--price']),
    command('extract-gemini-gemini-3.5-flash', 'extract-gemini-gemini-3.5-flash', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'gemini=gemini-3.5-flash', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/deepinfra-qwen3-vl-30b-a3b-instruct.test.ts', [
    command('extract-deepinfra-google-gemma-3-27b-it', 'extract-deepinfra-google-gemma-3-27b-it', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'deepinfra=google/gemma-3-27b-it', '--price']),
    command('extract-deepinfra-meta-llama-llama-4-scout-17b-16e-instruct', 'extract-deepinfra-meta-llama-llama-4-scout-17b-16e-instruct', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'deepinfra=meta-llama/Llama-4-Scout-17B-16E-Instruct', '--price']),
    command('extract-deepinfra-mistralai-mistral-small-3-2-24b-instruct-2506', 'extract-deepinfra-mistralai-mistral-small-3-2-24b-instruct-2506', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'deepinfra=mistralai/Mistral-Small-3.2-24B-Instruct-2506', '--price']),
    command('extract-deepinfra-qwen3-vl-235b-a22b-instruct', 'extract-deepinfra-qwen3-vl-235b-a22b-instruct', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'deepinfra=Qwen/Qwen3-VL-235B-A22B-Instruct', '--price']),
    command('extract-deepinfra-qwen3-vl-30b-a3b-instruct', 'extract-deepinfra-Qwen/Qwen3-VL-30B-A3B-Instruct', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'deepinfra=Qwen/Qwen3-VL-30B-A3B-Instruct', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/ocr-replicate.test.ts', [
    command('extract-replicate-datalab-to-ocr', 'extract-replicate-datalab-to-ocr', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'replicate=datalab-to/ocr', '--price']),
    command('extract-replicate-datalab-to-marker', 'extract-replicate-datalab-to-marker', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'replicate=datalab-to/marker', '--price']),
    command('extract-replicate-lucataco-deepseek-ocr', 'extract-replicate-lucataco-deepseek-ocr', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'replicate=lucataco/deepseek-ocr', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/ocr-fal.test.ts', [
    command('extract-fal-fal-ai-got-ocr-v2', 'extract-fal-fal-ai-got-ocr-v2', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'fal=fal-ai/got-ocr/v2', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/openai-gpt-5.5.test.ts', [
    command('extract-openai-gpt-5.5', 'extract-openai-gpt-5.5', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/benchmarks/ocr/1-document.png', '--provider', 'openai=gpt-5.5', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/grok-4.3.test.ts', [
    command('extract-grok-grok-4.3', 'extract-grok-grok-4.3', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/benchmarks/ocr/1-document.png', '--provider', 'grok=grok-4.3', '--price']),
    command('extract-grok-grok-4.20-0309-non-reasoning', 'extract-grok-grok-4.20-0309-non-reasoning', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'grok=grok-4.20-0309-non-reasoning', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/anthropic-claude-opus-4-8.test.ts', [
    command('extract-anthropic-claude-opus-4-8', 'extract-anthropic-claude-opus-4-8', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/benchmarks/ocr/1-document.png', '--provider', 'anthropic=claude-opus-4-8', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/anthropic-claude-sonnet-5.test.ts', [
    command('extract-anthropic-claude-sonnet-5', 'extract-anthropic-claude-sonnet-5', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'anthropic=claude-sonnet-5', '--price']),
    command('extract-anthropic-claude-haiku-4-5', 'extract-anthropic-claude-haiku-4-5', ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'anthropic=claude-haiku-4-5', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/gemini-3.1-pro-preview.test.ts', [
    command('extract-gemini-gemini-3.1-pro-preview', 'extract-gemini-gemini-3.1-pro-preview', ['src/cli/create-cli.ts', 'extract', 'https://ajc.pics/autoshow/benchmarks/ocr/1-document.png', '--provider', 'gemini=gemini-3.1-pro-preview', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/ocr-supadata.test.ts', [
    command('extract-supadata-url', 'extract-supadata-url', ['src/cli/create-cli.ts', 'extract', 'https://ajcwebdev.com', '--url-provider', 'supadata', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/ocr-firecrawl.test.ts', [
    command('extract-firecrawl-url', 'extract-firecrawl-url', ['src/cli/create-cli.ts', 'extract', 'https://ajcwebdev.com', '--url-provider', 'firecrawl', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-2-ocr-e2e/ocr-services/ocr-glm-reader.test.ts', [
    command('extract-glm-reader-url', 'extract-glm-reader-url', ['src/cli/create-cli.ts', 'extract', 'https://ajcwebdev.com', '--url-provider', 'glm-reader', '--price']),
  ]),
]
