import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

export const imageRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/service/visuals/image/openai-gpt-image-26.test.ts', [
    command('image-openai-gpt-image-2.6-flare', 'image-openai-gpt-image-2.6-flare', ['src/cli/create-cli.ts', 'image', 'A simple green triangle', '--provider', 'openai=gpt-image-2.6-flare', '--size', '1024x1024', '--quality', 'low', '--background', 'transparent', '--format', 'png', '--price']),
    command('image-openai-gpt-image-2.6-sunburst', 'image-openai-gpt-image-2.6-sunburst', ['src/cli/create-cli.ts', 'image', 'A simple blue circle', '--provider', 'openai=gpt-image-2.6-sunburst', '--size', '1024x1024', '--quality', 'low', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/visuals/image/gemini-nano-banana-2.1.test.ts', [
    command('image-gemini-gemini-nano-banana-2.1', 'image-gemini-gemini-nano-banana-2.1', ['src/cli/create-cli.ts', 'image', 'a tiny purple circle on white background', '--provider', 'gemini=gemini-nano-banana-2.1', '--size', '4K', '--aspect-ratio', '8:1', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/visuals/image/grok-imagine-image-2.0.test.ts', [
    command('image-grok-grok-imagine-image-2.0', 'image-grok-grok-imagine-image-2.0', ['src/cli/create-cli.ts', 'image', 'A simple blue cube on a white background', '--provider', 'grok=grok-imagine-image-2.0', '--size', '1K', '--aspect-ratio', '1:1', '--quality', 'low', '--price']),
  ]),
]
