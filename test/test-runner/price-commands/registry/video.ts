import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

export const videoRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/service/step-6-video-gen-e2e/gemini-veo-3.1-fast-generate-preview.test.ts', [
    command('video-gemini-veo-3.1-fast-generate-preview', 'video-gemini-veo-3.1-fast-generate-preview', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--provider', 'gemini=veo-3.1-fast-generate-preview', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-6-video-gen-e2e/gemini-veo-3.1-generate-preview.test.ts', [
    command('video-gemini-veo-3.1-generate-preview', 'video-gemini-veo-3.1-generate-preview', ['src/cli/create-cli.ts', 'video', 'a cinematic mountain sunrise', '--provider', 'gemini=veo-3.1-generate-preview', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-6-video-gen-e2e/grok-imagine-video.test.ts', [
    command('video-grok-grok-imagine-video', 'video-grok-grok-imagine-video', ['src/cli/create-cli.ts', 'video', 'a static shot of a tiny red dot on white background', '--provider', 'grok=grok-imagine-video', '--duration', '1', '--resolution', '480p', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-6-video-gen-e2e/grok-imagine-video-1.5.test.ts', [
    command('video-grok-grok-imagine-video-1.5', 'video-grok-grok-imagine-video-1.5', ['src/cli/create-cli.ts', 'video', 'a static shot of a tiny red dot on white background', '--provider', 'grok=grok-imagine-video-1.5', '--duration', '1', '--resolution', '480p', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-6-video-gen-e2e/ltx-2-3-fast.test.ts', [
    command('video-ltx-ltx-2-3-fast', 'video-ltx-ltx-2-3-fast', ['src/cli/create-cli.ts', 'video', 'a static shot of a tiny red dot on white background', '--provider', 'ltx=ltx-2-3-fast', '--duration', '6', '--resolution', '1080p', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-6-video-gen-e2e/ltx-2-3-pro.test.ts', [
    command('video-ltx-ltx-2-3-pro', 'video-ltx-ltx-2-3-pro', ['src/cli/create-cli.ts', 'video', 'a static shot of a tiny red dot on white background', '--provider', 'ltx=ltx-2-3-pro', '--duration', '6', '--resolution', '1080p', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-6-video-gen-e2e/replicate-alibaba-happyhorse-1.1.test.ts', [
    command('video-replicate-alibaba/happyhorse-1.1', 'video-replicate-alibaba/happyhorse-1.1', ['src/cli/create-cli.ts', 'video', 'a static shot of a tiny red dot on white background', '--provider', 'replicate=alibaba/happyhorse-1.1', '--duration', '3', '--resolution', '720p', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-6-video-gen-e2e/replicate-kling-v3-video.test.ts', [
    command('video-replicate-kwaivgi/kling-v3-video', 'video-replicate-kwaivgi/kling-v3-video', ['src/cli/create-cli.ts', 'video', 'a static shot of a tiny red dot on white background', '--provider', 'replicate=kwaivgi/kling-v3-video', '--duration', '3', '--resolution', '720p', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-6-video-gen-e2e/replicate-kling-v3-omni-video.test.ts', [
    command('video-replicate-kwaivgi/kling-v3-omni-video', 'video-replicate-kwaivgi/kling-v3-omni-video', ['src/cli/create-cli.ts', 'video', 'a static shot of a tiny red dot on white background', '--provider', 'replicate=kwaivgi/kling-v3-omni-video', '--duration', '3', '--resolution', '720p', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-6-video-gen-e2e/replicate-pixverse-v6.test.ts', [
    command('video-replicate-pixverse/pixverse-v6', 'video-replicate-pixverse/pixverse-v6', ['src/cli/create-cli.ts', 'video', 'a static shot of a tiny red dot on white background', '--provider', 'replicate=pixverse/pixverse-v6', '--duration', '5', '--resolution', '360p', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-6-video-gen-e2e/replicate-bytedance-seedance-2.0.test.ts', [
    command('video-replicate-bytedance/seedance-2.0', 'video-replicate-bytedance/seedance-2.0', ['src/cli/create-cli.ts', 'video', 'a static shot of a tiny red dot on white background', '--provider', 'replicate=bytedance/seedance-2.0', '--duration', '5', '--resolution', '480p', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-6-video-gen-e2e/replicate-bytedance-seedance-2.0-fast.test.ts', [
    command('video-replicate-bytedance/seedance-2.0-fast', 'video-replicate-bytedance/seedance-2.0-fast', ['src/cli/create-cli.ts', 'video', 'a static shot of a tiny red dot on white background', '--provider', 'replicate=bytedance/seedance-2.0-fast', '--duration', '5', '--resolution', '480p', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-6-video-gen-e2e/fal-minimax-h3.test.ts', [
    command('video-fal-minimax/h3', 'video-fal-minimax/h3', ['src/cli/create-cli.ts', 'video', 'a static shot of a tiny red dot on white background', '--provider', 'fal=minimax/h3', '--duration', '5', '--resolution', '768p', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-6-video-gen-e2e/fal-pixverse-c1.test.ts', [
    command('video-fal-fal-ai/pixverse/c1', 'video-fal-fal-ai/pixverse/c1', ['src/cli/create-cli.ts', 'video', 'a static shot of a tiny red dot on white background', '--provider', 'fal=fal-ai/pixverse/c1', '--duration', '1', '--resolution', '360p', '--price']),
  ]),
]
