import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

export const videoRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/service/visuals/video/gemini-omni-1.1-flash.test.ts', [
    command('video-gemini-gemini-omni-1.1-flash', 'video-gemini-gemini-omni-1.1-flash', ['src/cli/create-cli.ts', 'video', 'a static shot of a tiny red dot on white background', '--provider', 'gemini=gemini-omni-1.1-flash', '--duration', '3', '--resolution', '360p', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/visuals/video/grok-imagine-video-1.5.test.ts', [
    command('video-grok-grok-imagine-video-1.5', 'video-grok-grok-imagine-video-1.5', ['src/cli/create-cli.ts', 'video', 'a static shot of a tiny red dot on white background', '--provider', 'grok=grok-imagine-video-1.5', '--duration', '1', '--resolution', '480p', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/visuals/video/replicate-alibaba-happyhorse-1.1.test.ts', [
    command('video-replicate-alibaba/happyhorse-1.1', 'video-replicate-alibaba/happyhorse-1.1', ['src/cli/create-cli.ts', 'video', 'a static shot of a tiny red dot on white background', '--provider', 'replicate=alibaba/happyhorse-1.1', '--duration', '3', '--resolution', '720p', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/visuals/video/replicate-pixverse-v6.test.ts', [
    command('video-replicate-pixverse/pixverse-v6', 'video-replicate-pixverse/pixverse-v6', ['src/cli/create-cli.ts', 'video', 'a static shot of a tiny red dot on white background', '--provider', 'replicate=pixverse/pixverse-v6', '--duration', '5', '--resolution', '360p', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/visuals/video/fal-minimax-h3.test.ts', [
    command('video-fal-minimax/h3', 'video-fal-minimax/h3', ['src/cli/create-cli.ts', 'video', 'a static shot of a tiny red dot on white background', '--provider', 'fal=minimax/h3', '--duration', '5', '--resolution', '768p', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/visuals/video/ltx-2-5-fast.test.ts', [
    command('video-ltx-ltx-2-5-fast', 'video-ltx-ltx-2-5-fast', ['src/cli/create-cli.ts', 'video', 'a static shot of a tiny red dot on white background', '--provider', 'ltx=ltx-2-5-fast', '--duration', '6', '--resolution', '720p', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/visuals/video/ltx-2-5-pro.test.ts', [
    command('video-ltx-ltx-2-5-pro', 'video-ltx-ltx-2-5-pro', ['src/cli/create-cli.ts', 'video', 'a static shot of a tiny red dot on white background', '--provider', 'ltx=ltx-2-5-pro', '--duration', '6', '--resolution', '720p', '--price']),
  ]),
]
