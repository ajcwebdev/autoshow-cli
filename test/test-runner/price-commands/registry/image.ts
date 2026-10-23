import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

export const imageRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/service/visuals/image/openai-gpt-image-25.test.ts', [
    command('image-openai-gpt-image-2.5-flare', 'image-openai-gpt-image-2.5-flare', ['src/cli/create-cli.ts', 'image', 'A simple green triangle', '--provider', 'openai=gpt-image-2.5-flare', '--size', '1024x1024', '--quality', 'low', '--background', 'transparent', '--format', 'png', '--price']),
    command('image-openai-gpt-image-2.5-sunburst', 'image-openai-gpt-image-2.5-sunburst', ['src/cli/create-cli.ts', 'image', 'A simple blue circle', '--provider', 'openai=gpt-image-2.5-sunburst', '--size', '1024x1024', '--quality', 'low', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/visuals/image/openai-gpt-image-2.test.ts', [
    command('image-openai-gpt-image-2', 'image-openai-gpt-image-2', ['src/cli/create-cli.ts', 'image', 'a sunset', '--provider', 'openai=gpt-image-2', '--size', '1024x1536', '--quality', 'low', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/visuals/image/gemini-image-gen.test.ts', [
    command('image-gemini-gemini-3.1-flash-lite-image', 'image-gemini-gemini-3.1-flash-lite-image', ['src/cli/create-cli.ts', 'image', 'a tiny purple circle on white background', '--provider', 'gemini=gemini-3.1-flash-lite-image', '--size', '1K', '--aspect-ratio', '1:1', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/visuals/image/fal-image.test.ts', [
    command('image-fal-fal-ai/hidream-o1-image', 'image-fal-fal-ai/hidream-o1-image', ['src/cli/create-cli.ts', 'image', 'A tiny blue square icon centered on a white background', '--provider', 'fal=fal-ai/hidream-o1-image', '--size', '1024x1024', '--price']),
    command('image-fal-alibaba/qwen-image-3', 'image-fal-alibaba/qwen-image-3', ['src/cli/create-cli.ts', 'image', 'The word QWEN centered in a clean typographic poster', '--provider', 'fal=alibaba/qwen-image-3', '--size', '1024x1024', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/visuals/image/grok-imagine-image-2.0.test.ts', [
    command('image-grok-grok-imagine-image-2.0', 'image-grok-grok-imagine-image-2.0', ['src/cli/create-cli.ts', 'image', 'A simple blue cube on a white background', '--provider', 'grok=grok-imagine-image-2.0', '--size', '1K', '--aspect-ratio', '1:1', '--quality', 'low', '--price']),
  ]),
]
