import { afterEach, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { STABLE_EXAMPLE_AUDIO_URL, runCommand } from '../../../test-utils/test-helpers'

const tempDirs: string[] = []
const repoFixtureFiles: string[] = []
const repoFixtureDirs: string[] = []
const removedSetupCommand = ['so', 'ck'].join('')

const makeTempRoot = async (prefix: string): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), prefix))
  tempDirs.push(root)
  return root
}

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

afterEach(async () => {
  await Promise.all(repoFixtureFiles.splice(0).map((path) => rm(path, { force: true })))
  await Promise.all(repoFixtureDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

const expectUsageExit = async (args: string[], expectedMessage: string): Promise<void> => {
  const result = await runCommand(['src/cli/create-cli.ts', ...args], {
    env: { NO_COLOR: '1' }
  })

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain(expectedMessage)
}

const ensureEpisodeTwoScriptFixture = async (): Promise<void> => {
  const scriptsRoot = join('input', 'scripts')
  const dir = join(scriptsRoot, '02-script')
  const path = join(dir, '01-co-work-smarter.md')

  // Track the topmost directory we actually create so cleanup leaves no empty
  // parent behind, while never removing a pre-existing scripts tree.
  if (!existsSync(scriptsRoot)) {
    repoFixtureDirs.push(scriptsRoot)
  } else if (!existsSync(dir)) {
    repoFixtureDirs.push(dir)
  }

  await mkdir(dir, { recursive: true })

  if (!existsSync(path)) {
    repoFixtureFiles.push(path)
    await writeFile(path, '# Co-Work Smarter\n')
  }
}

test('unknown command exits 2', async () => {
  await expectUsageExit(['definitely-not-a-command'], 'Unknown command "definitely-not-a-command"')
})

test('removed setup command is not registered', async () => {
  await expectUsageExit([removedSetupCommand], `Unknown command "${removedSetupCommand}"`)
})

test('image command rejects removed imagen-count flag', async () => {
  await expectUsageExit(
    ['image', 'a sunset', '--provider', 'gemini=gemini-3.1-flash-image-preview', '--imagen-count', '2', '--price'],
    'Unexpected flag: imagenCount'
  )
})

test('extract rejects removed STT cache flags', async () => {
  await expectUsageExit(['extract', STABLE_EXAMPLE_AUDIO_URL, '--refresh-cache'], 'Unexpected flag: refreshCache')
  await expectUsageExit(['extract', STABLE_EXAMPLE_AUDIO_URL, '--no-cache'], 'Unexpected flag: noCache')
})

test('global cache-dir flag is removed', async () => {
  await expectUsageExit(['extract', STABLE_EXAMPLE_AUDIO_URL, '--cache-dir=/tmp/autoshow-cache'], 'Unexpected flag: cacheDir')
})

test('benchmark --tts rejects missing TTS run directory', async () => {
  const root = await makeTempRoot('autoshow-tts-benchmark-missing-')

  await expectUsageExit(
    ['benchmark', join(root, 'missing-run'), '--tts'],
    'TTS run directory not found'
  )
})

test('benchmark --tts rejects non-TTS run manifests', async () => {
  const runDir = await makeTempRoot('autoshow-tts-benchmark-kind-')
  await writeJson(join(runDir, 'run.json'), {
    schemaVersion: 2,
    kind: 'extract',
    metadata: {}
  })

  await expectUsageExit(
    ['benchmark', runDir, '--tts'],
    'run.json kind is "extract", expected "tts"'
  )
})

test('benchmark --tts rejects missing source text without override', async () => {
  const runDir = await makeTempRoot('autoshow-tts-benchmark-text-')
  await writeJson(join(runDir, 'run.json'), {
    schemaVersion: 2,
    kind: 'tts',
    metadata: {
      tts: [{
        ttsService: 'kitten',
        ttsModel: 'kitten-tts-nano',
        speaker: 'Jasper',
        processingTime: 100,
        audioFileName: 'speech.wav',
        audioFileSize: 10,
        chunkCount: 1
      }]
    }
  })

  await expectUsageExit(
    ['benchmark', runDir, '--tts'],
    'TTS benchmark source text is missing'
  )
})

test('benchmark --image rejects missing image run directory', async () => {
  const root = await makeTempRoot('autoshow-image-benchmark-missing-')

  await expectUsageExit(
    ['benchmark', join(root, 'missing-run'), '--image'],
    'Image run directory not found'
  )
})

test('benchmark --image rejects non-image run manifests', async () => {
  const runDir = await makeTempRoot('autoshow-image-benchmark-kind-')
  await writeJson(join(runDir, 'run.json'), {
    schemaVersion: 2,
    kind: 'tts',
    metadata: {}
  })

  await expectUsageExit(
    ['benchmark', runDir, '--image'],
    'run.json kind is "tts", expected "image"'
  )
})

test('benchmark --image rejects invalid image run metadata', async () => {
  const runDir = await makeTempRoot('autoshow-image-benchmark-metadata-')
  await writeJson(join(runDir, 'run.json'), {
    schemaVersion: 2,
    kind: 'image',
    metadata: {
      image: []
    }
  })

  await expectUsageExit(
    ['benchmark', runDir, '--image'],
    'Image benchmark source prompt is missing'
  )
})

test('benchmark --text rejects missing write run directory', async () => {
  const root = await makeTempRoot('autoshow-text-benchmark-missing-')

  await expectUsageExit(
    ['benchmark', join(root, 'missing-run'), '--text'],
    'Text run directory not found'
  )
})

test('benchmark --text rejects non-write run manifests', async () => {
  const runDir = await makeTempRoot('autoshow-text-benchmark-kind-')
  await writeJson(join(runDir, 'run.json'), {
    schemaVersion: 2,
    kind: 'tts',
    metadata: {}
  })

  await expectUsageExit(
    ['benchmark', runDir, '--text'],
    'run.json kind is "tts", expected "write"'
  )
})

test('benchmark --text rejects missing step3 metadata', async () => {
  const runDir = await makeTempRoot('autoshow-text-benchmark-step3-')
  await writeJson(join(runDir, 'run.json'), {
    schemaVersion: 2,
    kind: 'write',
    metadata: {}
  })

  await expectUsageExit(
    ['benchmark', runDir, '--text'],
    'Text benchmark run.json must contain metadata.step3.'
  )
})

test('benchmark --video rejects missing video run directory', async () => {
  const root = await makeTempRoot('autoshow-video-benchmark-missing-')

  await expectUsageExit(
    ['benchmark', join(root, 'missing-run'), '--video'],
    'Video run directory not found'
  )
})

test('benchmark --video rejects non-video run manifests', async () => {
  const runDir = await makeTempRoot('autoshow-video-benchmark-kind-')
  await writeJson(join(runDir, 'run.json'), {
    schemaVersion: 2,
    kind: 'image',
    metadata: {}
  })

  await expectUsageExit(
    ['benchmark', runDir, '--video'],
    'run.json kind is "image", expected "video"'
  )
})

test('benchmark --video rejects missing source prompt', async () => {
  const runDir = await makeTempRoot('autoshow-video-benchmark-prompt-')
  await writeJson(join(runDir, 'run.json'), {
    schemaVersion: 2,
    kind: 'video',
    metadata: {
      video: []
    }
  })

  await expectUsageExit(
    ['benchmark', runDir, '--video'],
    'Video benchmark source prompt is missing'
  )
})

test('benchmark --video rejects missing video metadata', async () => {
  const runDir = await makeTempRoot('autoshow-video-benchmark-metadata-')
  await writeJson(join(runDir, 'run.json'), {
    schemaVersion: 2,
    kind: 'video',
    metadata: {
      input: 'A cinematic mountain sunrise.'
    }
  })

  await expectUsageExit(
    ['benchmark', runDir, '--video'],
    'Video benchmark run.json must contain metadata.video[].'
  )
})

test('benchmark rejects mutually exclusive scoring modes', async () => {
  const runDir = await makeTempRoot('autoshow-benchmark-mode-conflict-')

  await expectUsageExit(
    ['benchmark', runDir, '--image', '--video'],
    'Choose only one benchmark mode: --image, --text, --tts, or --video'
  )
})

test('unknown flag exits 2', async () => {
  await expectUsageExit(['write', STABLE_EXAMPLE_AUDIO_URL, '--structured'], 'Unexpected flag: structured')
})

test('video command rejects missing first-class input', async () => {
  await expectUsageExit(['video'], 'Missing required parameter: input')
})

test('hosted-only generation commands reject local-only controls', async () => {
  await expectUsageExit(['image', 'prompt', '--all-local'], 'Unexpected flag: allLocal')
  await expectUsageExit(['video', 'prompt', '--all-local'], 'Unexpected flag: allLocal')
  await expectUsageExit(['music', 'prompt', '--all-local'], 'Unexpected flag: allLocal')
  await expectUsageExit(['image', 'prompt', '--local-concurrency', '1'], 'Unexpected flag: localConcurrency')
  await expectUsageExit(['video', 'prompt', '--local-concurrency', '1'], 'Unexpected flag: localConcurrency')
  await expectUsageExit(['music', 'prompt', '--local-concurrency', '1'], 'Unexpected flag: localConcurrency')
})

test('video positional image rejects ambiguous explicit media input', async () => {
  const root = await makeTempRoot('autoshow-video-ambiguous-media-')
  const imagePath = join(root, 'input.png')
  const otherImagePath = join(root, 'other.png')
  await writeFile(imagePath, new Uint8Array([1, 2, 3]))
  await writeFile(otherImagePath, new Uint8Array([4, 5, 6]))

  await expectUsageExit(
    ['video', imagePath, '--input-image', otherImagePath, '--price'],
    'Positional image input cannot be combined with --input-image.'
  )
})

test('video positional image rejects conflicting explicit text mode', async () => {
  const root = await makeTempRoot('autoshow-video-ambiguous-mode-')
  const imagePath = join(root, 'input.png')
  await writeFile(imagePath, new Uint8Array([1, 2, 3]))

  await expectUsageExit(
    ['video', imagePath, '--mode', 'text', '--price'],
    'Positional image input infers --mode image-to-video; do not combine it with --mode text.'
  )
})

test('legacy step-2 command names are not public commands', async () => {
  for (const command of ['stt', 'ocr'] as const) {
    await expectUsageExit([command, STABLE_EXAMPLE_AUDIO_URL], `Unknown command "${command}`)
  }
})

test('extract rejects LLM-only provider flags as unknown flags', async () => {
  await expectUsageExit(['extract', STABLE_EXAMPLE_AUDIO_URL, '--llama'], 'Unexpected flag: llama')
})

test('extract rejects unsupported URL article option flags', async () => {
  await expectUsageExit(
    ['extract', 'https://example.com/article', '--url-include-selector', 'article', '--price'],
    'Unexpected flag: urlIncludeSelector'
  )
})

test('extract rejects invalid URL article backend names', async () => {
  await expectUsageExit(
    ['extract', 'https://example.com/article', '--url-provider', 'browserless', '--price'],
    'Invalid --url-provider value "browserless". Expected "defuddle", "firecrawl", "glm-reader", "spider", "supadata", or "zyte".'
  )
})

test('write rejects removed all URL article backend flag', async () => {
  await expectUsageExit(
    ['write', STABLE_EXAMPLE_AUDIO_URL, '--all-url', '--price'],
    'Unexpected flag: allUrl'
  )
})

test('public commands reject removed provider selector aliases', async () => {
  await expectUsageExit(
    ['write', STABLE_EXAMPLE_AUDIO_URL, '--openai', 'gpt-5.5', '--price'],
    'Unexpected flag: openai'
  )
  await expectUsageExit(
    ['extract', 'https://example.com/article', '--url-backend', 'firecrawl', '--price'],
    'Unexpected flag: urlBackend'
  )
  await expectUsageExit(
    ['image', 'a sunset', '--openai', 'gpt-image-2', '--price'],
    'Unexpected flag: openai'
  )
  const videoResult = await runCommand(
    ['src/cli/create-cli.ts', 'video', 'a sunset timelapse', '--gemini-video', 'veo-3.1-fast-generate-preview', '--price'],
    { env: { NO_COLOR: '1' } }
  )
  expect(videoResult.exitCode).toBe(0)
  expect(`${videoResult.stdout}\n${videoResult.stderr}`).toContain('veo-3.1-fast-generate-preview')
  await expectUsageExit(
    ['music', 'ambient piano', '--elevenlabs', 'music_v1', '--price'],
    'Unexpected flag: elevenlabs'
  )
})

test('extract accepts current OpenAI OCR models in price mode', async () => {
  for (const model of ['gpt-5.6-sol', 'gpt-5.4-mini'] as const) {
    const result = await runCommand(
      ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', `openai=${model}`, '--price'],
      { env: { NO_COLOR: '1' } }
    )

    expect(result.exitCode).toBe(0)
    expect(`${result.stdout}\n${result.stderr}`).toContain(model)
  }
})

test('extract accepts route-aware GLM OCR model in price mode', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'glm=glm-ocr', '--price'],
    { env: { NO_COLOR: '1' } }
  )

  expect(result.exitCode).toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('glm-ocr')
})

test('extract accepts expanded Anthropic OCR models in price mode', async () => {
  for (const model of ['claude-fable-5', 'claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5', 'claude-opus-5'] as const) {
    const result = await runCommand(
      ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', `anthropic=${model}`, '--price'],
      { env: { NO_COLOR: '1' } }
    )

    expect(result.exitCode).toBe(0)
    expect(`${result.stdout}\n${result.stderr}`).toContain(model)
  }
})

test('extract rejects removed Anthropic Sonnet 4.6 OCR model', async () => {
  const result = await runCommand(
    ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', 'anthropic=claude-sonnet-4-6', '--price'],
    { env: { NO_COLOR: '1' } }
  )

  expect(result.exitCode).toBe(2)
  expect(`${result.stdout}\n${result.stderr}`).toContain('claude-sonnet-4-6')
})

test('extract accepts priority OCR model additions in price mode', async () => {
  const cases = [
    ['mistral', 'mistral-ocr-4-0'],
    ['mistral', 'mistral-ocr-latest'],
    ['gemini', 'gemini-3.5-flash'],
    ['gemini', 'gemini-3.6-flash'],
    ['gemini', 'gemini-3.5-flash-lite'],
    ['grok', 'grok-4.20-0309-non-reasoning'],
    ['grok', 'grok-4.5'],
    ['kimi', 'kimi-k3']
  ] as const

  for (const [provider, model] of cases) {
    const result = await runCommand(
      ['src/cli/create-cli.ts', 'extract', 'input/examples/document/1-document.pdf', '--provider', `${provider}=${model}`, '--price'],
      { env: { NO_COLOR: '1' } }
    )

    expect(result.exitCode).toBe(0)
    expect(`${result.stdout}\n${result.stderr}`).toContain(model)
  }
})

test('extract rejects removed Kimi Code OCR models', async () => {
  const removedKimiCodeOcrModel = ['kimi-k2', '7-code'].join('.')
  for (const model of [removedKimiCodeOcrModel, `${removedKimiCodeOcrModel}-highspeed`] as const) {
    await expectUsageExit(
      ['extract', 'input/examples/document/1-document.pdf', '--provider', `kimi=${model}`, '--price'],
      `Invalid --kimi-ocr model "${model}". Allowed values: kimi-k2.6, kimi-k3`
    )
  }
})

test('extract rejects removed DeepInfra PaddleOCR model', async () => {
  await expectUsageExit(
    ['extract', 'input/examples/document/1-document.pdf', '--provider', 'deepinfra=PaddlePaddle/PaddleOCR-VL-0.9B', '--price'],
    'Invalid --deepinfra-ocr model "PaddlePaddle/PaddleOCR-VL-0.9B". Allowed values: Qwen/Qwen3-VL-235B-A22B-Instruct, Qwen/Qwen3-VL-30B-A3B-Instruct'
  )
})

test('extract rejects old suffixed provider selector flags', async () => {
  await expectUsageExit(
    ['extract', 'input/examples/document/1-document.pdf', '--glm-ocr', 'glm-ocr', '--price'],
    'Unexpected flag: glmOcr'
  )
  await expectUsageExit(
    ['extract', STABLE_EXAMPLE_AUDIO_URL, '--glm-stt', 'some-model', '--price'],
    'Unexpected flag: glmStt'
  )
})

test('tts rejects removed MiniMax clone flags as unknown flags', async () => {
  await expectUsageExit(
    ['tts', 'input/examples/tts/1-tts.md', '--provider', 'minimax=speech-2.8-turbo', '--minimax-tts-ref-audio', 'input/examples/audio/anthony-voice.mp3', '--price'],
    'Unexpected flag: minimaxTtsRefAudio'
  )
})

test('tts rejects missing inputs', async () => {
  const root = await makeTempRoot('autoshow-tts-missing-')
  await expectUsageExit(
    ['tts', join(root, 'missing.md'), '--price'],
    `File not found: ${join(root, 'missing.md')}`
  )
})

test('tts rejects non-text single files', async () => {
  const root = await makeTempRoot('autoshow-tts-non-text-')
  const inputPath = join(root, 'source.json')
  await writeFile(inputPath, '{"text":"hello"}\n')

  await expectUsageExit(
    ['tts', inputPath, '--price'],
    `tts only accepts .md or .txt files. Got: ${inputPath}`
  )
})

test('tts rejects ambiguous generic TTS options with multiple providers', async () => {
  await expectUsageExit(
    ['tts', 'input/examples/tts/1-tts.md', '--provider', 'openai=gpt-4o-mini-tts', '--provider', 'elevenlabs=eleven_v3', '--tts-voice', 'alloy', '--price'],
    '--tts-voice requires provider=value when multiple TTS providers are selected.'
  )
})

test('extract rejects removed Supadata STT modes', async () => {
  await expectUsageExit(
    ['extract', 'https://example.com/audio.mp3', '--provider', 'supadata=native', '--price'],
    'Invalid --supadata-stt model "native". Allowed values: auto'
  )
  await expectUsageExit(
    ['extract', 'https://example.com/audio.mp3', '--provider', 'supadata=generate', '--price'],
    'Invalid --supadata-stt model "generate". Allowed values: auto'
  )
})

test('extract rejects unsupported ScrapeCreators STT modes', async () => {
  await expectUsageExit(
    ['extract', 'https://www.youtube.com/watch?v=MORMZXEaONk', '--provider', 'scrapecreators=auto', '--price'],
    'Invalid --scrapecreators-stt model "auto". Allowed values: youtube-transcript'
  )
})

test('extract transcript-video flags require transcript-video mode', async () => {
  await expectUsageExit(
    ['extract', STABLE_EXAMPLE_AUDIO_URL, '--transcript-result', 'output/run/result.json'],
    '--transcript-result require --transcript-video'
  )
})

test('extract transcript-video manual mode requires audio and one transcript source', async () => {
  await expectUsageExit(
    ['extract', '--transcript-video', '--transcript-result', 'output/run/result.json'],
    'Manual transcript-video mode requires --audio'
  )
  await expectUsageExit(
    ['extract', '--transcript-video', '--audio', STABLE_EXAMPLE_AUDIO_URL],
    'Manual transcript-video mode requires exactly one of --transcript-result or --transcript-text'
  )
})

test('music lyric-video mode rejects missing audio or batch', async () => {
  await expectUsageExit(['music', '--model', 'tiny'], 'Missing --audio (or use --batch)')
})

test('music rejects mixed hosted generation and lyric-video modes', async () => {
  await expectUsageExit(
    ['music', '--audio', STABLE_EXAMPLE_AUDIO_URL, '--provider', 'minimax=music-2.6'],
    'Do not combine hosted music flags'
  )
  await expectUsageExit(
    ['music', '--audio', STABLE_EXAMPLE_AUDIO_URL, '--output-dir', 'output/music-run'],
    'Do not combine hosted music flags'
  )
  await expectUsageExit(
    ['music', 'ambient piano', '--model', 'tiny'],
    'Do not combine lyric-video flags'
  )
})

test('standalone generation rejects removed output directory alias', async () => {
  await expectUsageExit(
    ['image', 'a sunset', '--provider', 'openai=gpt-image-2', '--out', 'output/image-b', '--price'],
    'Unexpected flag: out'
  )
})

test('standalone generation rejects removed pipeline-prefixed option aliases', async () => {
  await expectUsageExit(
    ['image', 'a sunset', '--provider', 'openai=gpt-image-2', '--image-size', '1024x1024', '--price'],
    'Unexpected flag: imageSize'
  )
  await expectUsageExit(
    ['video', 'a sunset timelapse', '--provider', 'gemini=veo-3.1-fast-generate-preview', '--video-mode', 'text', '--price'],
    'Unexpected flag: videoMode'
  )
  await expectUsageExit(
    ['music', 'ambient piano', '--provider', 'elevenlabs=music_v1', '--music-duration', '20', '--price'],
    'Unexpected flag: musicDuration'
  )
})

test('resume rejects provider-named option flags', async () => {
  await expectUsageExit(
    ['resume', 'output/nonexistent', '--elevenlabs-tts-stability', '0.4'],
    'Unexpected flag: elevenlabsTtsStability'
  )
  await expectUsageExit(
    ['resume', 'output/nonexistent', '--minimax-tts-emotion', 'happy'],
    'Unexpected flag: minimaxTtsEmotion'
  )
  await expectUsageExit(
    ['resume', 'output/nonexistent', '--gemini-speaker-1-voice', 'Kore'],
    'Unexpected flag: geminiSpeaker1Voice'
  )
  await expectUsageExit(
    ['resume', 'output/nonexistent', '--replicate-video-seed', '1'],
    'Unexpected flag: replicateVideoSeed'
  )
  await expectUsageExit(
    ['resume', 'output/nonexistent', '--grok-video-storage-filename', 'clip.mp4'],
    'Unexpected flag: grokVideoStorageFilename'
  )
  await expectUsageExit(
    ['resume', 'output/nonexistent', '--gemini-search-grounding'],
    'Unexpected flag: geminiSearchGrounding'
  )
  await expectUsageExit(
    ['resume', 'output/nonexistent', '--stt-happyscribe-organization-id', 'org_123'],
    'Unexpected flag: sttHappyscribeOrganizationId'
  )
  await expectUsageExit(
    ['resume', 'output/nonexistent', '--stt-reverb-verbatimicity', '0.5'],
    'Unexpected flag: sttReverbVerbatimicity'
  )
})

test('music lyric-video mode rejects price mode', async () => {
  await expectUsageExit(
    ['music', '--audio', STABLE_EXAMPLE_AUDIO_URL, '--price'],
    'Do not combine hosted music flags'
  )
})

test('comic generate-images rejects invalid page selection flags', async () => {
  await expectUsageExit(
    ['comic', 'generate-images', 'input/scripts/02-script/01-co-work-smarter.md','--panels', '4-2', '--price'],
    'Invalid panels "4-2"'
  )
  await expectUsageExit(
    ['comic', 'generate-images', 'input/scripts/02-script/01-co-work-smarter.md','--panels-per-image', '0', '--price'],
    'Invalid panels per image "0"'
  )
  await expectUsageExit(
    ['comic', 'generate-images', 'input/scripts/02-script/01-co-work-smarter.md','--panel-limit', 'nope', '--price'],
    '--panel-limit was removed'
  )
})

test('comic generate-images rejects invalid and duplicate image models', async () => {
  await expectUsageExit(
    ['comic', 'generate-images', 'input/scripts/02-script/01-co-work-smarter.md','--image-model', 'not-a-model', '--price'],
    'Invalid image model "not-a-model"'
  )
  await expectUsageExit(
    ['comic', 'generate-images', 'input/scripts/02-script/01-co-work-smarter.md','--image-model', 'gpt-image-2,gpt-image-2', '--price'],
    'Duplicate image model "gpt-image-2" is not allowed'
  )
})

test('comic generate-images rejects removed --panel flag', async () => {
  await expectUsageExit(
    ['comic', 'generate-images', 'input/scripts/02-script/01-co-work-smarter.md','--panel', '1', '--price'],
    '--panel was removed'
  )
})

test('comic generate-images accepts --panels-per-image with sketch target', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'comic',
    'generate-images',
    'input/scripts/02-script/01-co-work-smarter.md',
    '--target',
    'sketches',
    '--panels-per-image',
    '6',
    '--quality',
    'high',
    '--price'
  ], {
    env: { NO_COLOR: '1' }
  })

  expect(result.exitCode).toBe(0)
  const sketchOutput = `${result.stdout}\n${result.stderr}`
  expect(sketchOutput).toContain('Price Estimate: generate-images --target sketches')
  expect(sketchOutput).toContain('Panels per sketch: 6')
})

test('comic commands accept strict episode-scene shorthand for price preflight', async () => {
  await ensureEpisodeTwoScriptFixture()

  const draftResult = await runCommand([
    'src/cli/create-cli.ts',
    'comic',
    'draft-scenes',
    '02-01',
    '--price',
  ], {
    env: { NO_COLOR: '1' }
  })
  const imageResult = await runCommand([
    'src/cli/create-cli.ts',
    'comic',
    'generate-images',
    '02-01',
    '--target',
    'sketches',
    '--panels-per-image',
    '6',
    '--price',
  ], {
    env: { NO_COLOR: '1' }
  })

  expect(draftResult.exitCode).toBe(0)
  expect(`${draftResult.stdout}\n${draftResult.stderr}`).toContain('Price Estimate: draft-scenes')
  expect(imageResult.exitCode).toBe(0)
  expect(`${imageResult.stdout}\n${imageResult.stderr}`).toContain('Price Estimate: generate-images --target sketches')
})

test('comic shorthand resolution errors name the expected directory and prefix', async () => {
  await expectUsageExit(
    ['comic', 'draft-scenes', '99-01', '--price'],
    'Expected exactly one Markdown file in "input/scripts/99-script" beginning with "01-"'
  )
})

test('comic non-strict shorthand remains an ordinary script path', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'comic',
    'draft-scenes',
    '2-1',
    '--price',
  ], {
    env: { NO_COLOR: '1' }
  })

  expect(result.exitCode).toBe(0)
  expect(`${result.stdout}\n${result.stderr}`).toContain('Price Estimate: draft-scenes')
})

test('comic generate-images rejects removed prompts target with migration', async () => {
  await expectUsageExit(
    ['comic', 'generate-images', 'input/scripts/02-script/01-co-work-smarter.md','--target', 'prompts', '--price'],
    'bun autoshow comic draft-scenes <script-path> --only panel-prompts'
  )
})

test('comic generate-images rejects variations with non-final targets', async () => {
  await expectUsageExit(
    ['comic', 'generate-images', 'input/scripts/02-script/01-co-work-smarter.md','--target', 'sketches', '--variation', 'cinematic-depth', '--price'],
    '--variation only applies when --target is images or both'
  )
})

test('comic generate-images rejects invalid grid options', async () => {
  await expectUsageExit(
    ['comic', 'generate-images', 'input/scripts/02-script/01-co-work-smarter.md', '--panels-per-image', '1', '--grid', '0x3', '--price'],
    'Invalid grid "0x3"'
  )
  await expectUsageExit(
    ['comic', 'generate-images', 'input/scripts/02-script/01-co-work-smarter.md', '--panels-per-image', '1', '--grid', '2x3', '--grid', '3x2', '--price'],
    'Grid can only be specified once'
  )
  await expectUsageExit(
    ['comic', 'generate-images', 'input/scripts/02-script/01-co-work-smarter.md', '--target', 'sketches', '--panels-per-image', '1', '--grid', '2x3', '--price'],
    '--grid only applies when --target is images or both'
  )
  await expectUsageExit(
    ['comic', 'generate-images', 'input/scripts/02-script/01-co-work-smarter.md', '--grid', '2x3', '--price'],
    '--grid requires --panels-per-image 1'
  )
  await expectUsageExit(
    ['comic', 'generate-images', 'input/scripts/02-script/01-co-work-smarter.md', '--panels-per-image', '1', '--grid', '2x3', '--size', '1024x1024', '--price'],
    '--grid requires --size 1536x1024'
  )
})

test('comic generate-images rejects invalid page selection flags', async () => {
  await expectUsageExit(
    ['comic', 'generate-images', 'input/scripts/02-script/01-co-work-smarter.md','--panels-per-image', '0', '--price'],
    'Invalid panels per image "0"'
  )
  await expectUsageExit(
    ['comic', 'generate-images', 'input/scripts/02-script/01-co-work-smarter.md','--panel-limit', 'nope', '--price'],
    '--panel-limit was removed'
  )
  await expectUsageExit(
    ['comic', 'generate-images', 'input/scripts/02-script/01-co-work-smarter.md','--panels', '4-2', '--price'],
    'Invalid panels "4-2"'
  )
})

test('comic draft-scenes rejects removed flags', async () => {
  await expectUsageExit(
    ['comic', 'draft-scenes', '--episode', 'ep02', '--price'],
    '--episode was removed'
  )
})

test('comic draft-scenes rejects invalid concurrency values', async () => {
  await expectUsageExit(
    ['comic', 'draft-scenes', '--concurrency', '0', '--price'],
    'Invalid concurrency'
  )
})
