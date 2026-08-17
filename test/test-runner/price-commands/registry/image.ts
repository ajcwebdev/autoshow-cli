import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

export const imageRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/service/step-5-image-gen-e2e/openai-gpt-image-2.test.ts', [
    command('image-openai-gpt-image-2', 'image-openai-gpt-image-2', ['src/cli/create-cli.ts', 'image', 'a sunset', '--provider', 'openai=gpt-image-2', '--size', '1024x1536', '--quality', 'low', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-5-image-gen-e2e/openai-gpt-image-2-pipeline.test.ts', [
    command('image-openai-gpt-image-2', 'image-openai-gpt-image-2', ['src/cli/create-cli.ts', 'image', 'a sunset', '--provider', 'openai=gpt-image-2', '--size', '1024x1536', '--quality', 'low', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-5-image-gen-e2e/gemini-image-gen.test.ts', [
    command('image-gemini-gemini-3.1-flash-lite-image', 'image-gemini-gemini-3.1-flash-lite-image', ['src/cli/create-cli.ts', 'image', 'a tiny purple circle on white background', '--provider', 'gemini=gemini-3.1-flash-lite-image', '--size', '1K', '--aspect-ratio', '1:1', '--price']),
    command('image-gemini-gemini-3.1-flash-image', 'image-gemini-gemini-3.1-flash-image', ['src/cli/create-cli.ts', 'image', 'a tiny purple circle on white background', '--provider', 'gemini=gemini-3.1-flash-image', '--size', '1K', '--aspect-ratio', '1:1', '--price']),
    command('image-gemini-gemini-3-pro-image', 'image-gemini-gemini-3-pro-image', ['src/cli/create-cli.ts', 'image', 'a tiny purple circle on white background', '--provider', 'gemini=gemini-3-pro-image', '--size', '1K', '--aspect-ratio', '1:1', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-5-image-gen-e2e/grok-imagine-image-quality.test.ts', [
    command('image-grok-grok-imagine-image-quality', 'image-grok-grok-imagine-image-quality', ['src/cli/create-cli.ts', 'image', 'A simple blue cube on a white background', '--provider', 'grok=grok-imagine-image-quality', '--size', '1K', '--aspect-ratio', '1:1', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-5-image-gen-e2e/replicate-image.test.ts', [
    command('image-replicate-bytedance/seedream-4.5', 'image-replicate-bytedance/seedream-4.5', ['src/cli/create-cli.ts', 'image', 'A tiny blue square icon centered on a white background', '--provider', 'replicate=bytedance/seedream-4.5', '--size', '2K', '--aspect-ratio', '1:1', '--price']),
    command('image-replicate-bytedance/seedream-5-lite', 'image-replicate-bytedance/seedream-5-lite', ['src/cli/create-cli.ts', 'image', 'A tiny green circle icon centered on a white background', '--provider', 'replicate=bytedance/seedream-5-lite', '--size', '2K', '--aspect-ratio', '1:1', '--format', 'png', '--price']),
    command('image-replicate-bytedance/seedream-5-pro', 'image-replicate-bytedance/seedream-5-pro', ['src/cli/create-cli.ts', 'image', 'A tiny cyan pentagon icon centered on a white background', '--provider', 'replicate=bytedance/seedream-5-pro', '--size', '1K', '--aspect-ratio', '1:1', '--format', 'png', '--price']),
    command('image-replicate-qwen/qwen-image-2-pro', 'image-replicate-qwen/qwen-image-2-pro', ['src/cli/create-cli.ts', 'image', 'A tiny red triangle icon centered on a white background', '--provider', 'replicate=qwen/qwen-image-2-pro', '--aspect-ratio', '1:1', '--price']),
    command('image-replicate-qwen/qwen-image-2', 'image-replicate-qwen/qwen-image-2', ['src/cli/create-cli.ts', 'image', 'A tiny yellow star icon centered on a white background', '--provider', 'replicate=qwen/qwen-image-2', '--aspect-ratio', '1:1', '--price']),
    command('image-replicate-wan-video/wan-2.7-image-pro', 'image-replicate-wan-video/wan-2.7-image-pro', ['src/cli/create-cli.ts', 'image', 'A tiny purple diamond icon centered on a white background', '--provider', 'replicate=wan-video/wan-2.7-image-pro', '--size', '1K', '--price']),
    command('image-replicate-wan-video/wan-2.7-image', 'image-replicate-wan-video/wan-2.7-image', ['src/cli/create-cli.ts', 'image', 'A tiny orange hexagon icon centered on a white background', '--provider', 'replicate=wan-video/wan-2.7-image', '--size', '1K', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-5-image-gen-e2e/fal-image.test.ts', [
    command('image-fal-fal-ai/hidream-o1-image', 'image-fal-fal-ai/hidream-o1-image', ['src/cli/create-cli.ts', 'image', 'A tiny blue square icon centered on a white background', '--provider', 'fal=fal-ai/hidream-o1-image', '--size', '1024x1024', '--price']),
    command('image-fal-alibaba/qwen-image-3', 'image-fal-alibaba/qwen-image-3', ['src/cli/create-cli.ts', 'image', 'The word QWEN centered in a clean typographic poster', '--provider', 'fal=alibaba/qwen-image-3', '--size', '1024x1024', '--price']),
    command('image-fal-reve/2.1', 'image-fal-reve/2.1', ['src/cli/create-cli.ts', 'image', 'A tiny yellow star icon centered on a white background', '--provider', 'fal=reve/2.1', '--aspect-ratio', '1:1', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-5-image-gen-e2e/bfl-flux-2-pro.test.ts', [
    command('image-bfl-flux-2-pro', 'image-bfl-flux-2-pro', ['src/cli/create-cli.ts', 'image', 'A tiny blue square on a white background', '--provider', 'bfl=flux-2-pro', '--size', '64x64', '--format', 'jpeg', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-5-image-gen-e2e/bfl-flux-2-klein.test.ts', [
    command('image-bfl-flux-2-klein-4b', 'image-bfl-flux-2-klein-4b', ['src/cli/create-cli.ts', 'image', 'a tiny blue square on a white background', '--provider', 'bfl=flux-2-klein-4b', '--size', '1024x1024', '--format', 'jpeg', '--price']),
    command('image-bfl-flux-2-klein-9b', 'image-bfl-flux-2-klein-9b', ['src/cli/create-cli.ts', 'image', 'a tiny blue square on a white background', '--provider', 'bfl=flux-2-klein-9b', '--size', '1024x1024', '--format', 'jpeg', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-5-image-gen-e2e/bfl-flux-2-max.test.ts', [
    command('image-bfl-flux-2-max', 'image-bfl-flux-2-max', ['src/cli/create-cli.ts', 'image', 'A tiny blue square on a white background', '--provider', 'bfl=flux-2-max', '--size', '64x64', '--format', 'jpeg', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-5-image-gen-e2e/bfl-flux-2-flex.test.ts', [
    command('image-bfl-flux-2-flex', 'image-bfl-flux-2-flex', ['src/cli/create-cli.ts', 'image', 'A tiny blue square on a white background', '--provider', 'bfl=flux-2-flex', '--size', '64x64', '--format', 'jpeg', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-5-image-gen-e2e/lumalabs-uni-1.test.ts', [
    command('image-lumalabs-uni-1', 'image-lumalabs-uni-1', ['src/cli/create-cli.ts', 'image', 'a sunset', '--provider', 'lumalabs=uni-1', '--aspect-ratio', '16:9', '--format', 'png', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/step-5-image-gen-e2e/lumalabs-uni-1-max.test.ts', [
    command('image-lumalabs-uni-1-max', 'image-lumalabs-uni-1-max', ['src/cli/create-cli.ts', 'image', 'a sunset', '--provider', 'lumalabs=uni-1-max', '--aspect-ratio', '16:9', '--format', 'png', '--price']),
  ]),
]
