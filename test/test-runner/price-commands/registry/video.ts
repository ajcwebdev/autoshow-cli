import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

export const videoRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/service/visuals/video/gemini-omni-1.1-flash.test.ts', [
    command('video-gemini-gemini-omni-1.1-flash', 'video-gemini-gemini-omni-1.1-flash', ['src/cli/create-cli.ts', 'video', 'a static shot of a tiny red dot on white background', '--provider', 'gemini=gemini-omni-1.1-flash', '--duration', '3', '--resolution', '360p', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/visuals/video/grok-imagine-video-1.5.test.ts', [
    command('video-grok-grok-imagine-video-1.5', 'video-grok-grok-imagine-video-1.5', ['src/cli/create-cli.ts', 'video', 'a static shot of a tiny red dot on white background', '--provider', 'grok=grok-imagine-video-1.5', '--duration', '1', '--resolution', '480p', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/visuals/video/grok-imagine-video-1.5-lite.test.ts', [
    command('video-grok-grok-imagine-video-1.5-lite', 'video-grok-grok-imagine-video-1.5-lite', ['src/cli/create-cli.ts', 'video', 'a static shot of a tiny red dot on white background', '--provider', 'grok=grok-imagine-video-1.5-lite', '--duration', '1', '--resolution', '480p', '--price']),
  ]),
]
