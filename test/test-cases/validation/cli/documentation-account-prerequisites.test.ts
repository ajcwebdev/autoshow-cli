import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { writeGenerationMetadata } from '~/cli/commands/command-shared/generation-command-utils'
import type { Step6VideoMetadata } from '~/types'
import { PROJECT_ROOT } from '~/utils/project-root'
import { withTempDir } from '../../../test-utils/temp-dirs'

const model = 'gemini-omni-1.1-flash'

type ReaderVideo = Pick<Step6VideoMetadata, 'videoGenService' | 'videoGenModel'> & { providerRequestId?: unknown }
type ReaderItem = {
  status: string
  metadata: { video: [ReaderVideo, ...ReaderVideo[]] }
  providers: [{ service: string, model: string, status: string }]
}
type ReaderManifest = { command: string, scope: string, items: [ReaderItem, ...ReaderItem[]] }

// Execute only the bounded, local JSON reader embedded in the guide. Never run
// provider commands, account lookups, or arbitrary command blocks from Markdown.
const documentedReader = async (): Promise<string> => {
  const markdown = await Bun.file(join(PROJECT_ROOT, 'docs/commands/05-visuals/video/overview.md')).text()
  const match = markdown.match(/GEMINI_INTERACTION_ID="\$\(bun --no-env-file -e '\n([\s\S]*?)\n' output\/gemini-omni-base\/manifest\.json\)"/)
  if (!match?.[1]) throw new Error('Missing documented Gemini interaction reader')
  return match[1]
}

const runReader = async (manifestPath: string) => {
  const child = Bun.spawn([process.execPath, '--no-env-file', '-e', await documentedReader(), manifestPath], {
    cwd: PROJECT_ROOT,
    env: { PATH: process.env['PATH'] ?? '' },
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe'
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text()
  ])
  return { exitCode, stdout: stdout.trim(), stderr }
}

const withCompletedBase = async (run: (manifestPath: string, manifest: ReaderManifest) => Promise<void>) =>
  await withTempDir('documentation-gemini-base-', async dir => {
    const metadata: Step6VideoMetadata = {
      videoGenService: 'gemini',
      videoGenModel: model,
      processingTime: 1,
      videoFileName: 'generated-video.mp4',
      videoFileSize: 1,
      videoDuration: 3,
      requestMode: 'text',
      videoResolution: '720p',
      videoAspectRatio: '16:9',
      providerRequestId: 'local-test-interaction'
    }
    // Test record only: the reader proves manifest selection, not MP4 decoding,
    // live account ownership, retained remote state, or visual quality.
    await writeGenerationMetadata(dir, 'video', [metadata], {}, {}, {
      input: 'local test base prompt',
      requestedProviders: [{ service: 'gemini', model }],
      completedProviders: [{ service: 'gemini', model }]
    })
    const manifestPath = join(dir, 'manifest.json')
    await run(manifestPath, await Bun.file(manifestPath).json() as ReaderManifest)
  })

describe('documented Gemini base interaction prerequisite', () => {
  test('reads the exact interaction ID from the current canonical generation writer', async () => {
    await withCompletedBase(async manifestPath => {
      const result = await runReader(manifestPath)
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toBe('local-test-interaction')
    })
  })

  test('refuses incomplete or failed base/provider state without emitting an ID', async () => {
    await withCompletedBase(async (manifestPath, manifest) => {
      for (const status of ['incomplete', 'failed']) {
        manifest.items[0].status = status
        await Bun.write(manifestPath, JSON.stringify(manifest))
        const result = await runReader(manifestPath)
        expect(result.exitCode).not.toBe(0)
        expect(result.stdout).toBe('')
      }
      manifest.items[0].status = 'full'
      manifest.items[0].providers[0].status = 'failed'
      await Bun.write(manifestPath, JSON.stringify(manifest))
      expect((await runReader(manifestPath)).exitCode).not.toBe(0)
    })
  })

  test('refuses absent, empty, or non-string IDs', async () => {
    await withCompletedBase(async (manifestPath, manifest) => {
      for (const id of [undefined, '', '   ', 42]) {
        manifest.items[0].metadata.video[0].providerRequestId = id
        await Bun.write(manifestPath, JSON.stringify(manifest))
        const result = await runReader(manifestPath)
        expect(result.exitCode).not.toBe(0)
        expect(result.stdout).toBe('')
      }
    })
  })

  test('refuses another provider/model or ambiguous target and item arrays', async () => {
    await withCompletedBase(async (manifestPath, original) => {
      const mutations = [
        (manifest: ReaderManifest) => { manifest.items[0].metadata.video[0].videoGenService = 'grok' },
        (manifest: ReaderManifest) => { manifest.items[0].metadata.video[0].videoGenModel = 'different-model' },
        (manifest: ReaderManifest) => { manifest.items[0].metadata.video.push({ ...manifest.items[0].metadata.video[0] }) },
        (manifest: ReaderManifest) => { manifest.items.push(structuredClone(manifest.items[0])) },
        (manifest: ReaderManifest) => { manifest.command = 'image' },
        (manifest: ReaderManifest) => { manifest.scope = 'batch' }
      ]
      for (const mutate of mutations) {
        const manifest = structuredClone(original)
        mutate(manifest)
        await Bun.write(manifestPath, JSON.stringify(manifest))
        const result = await runReader(manifestPath)
        expect(result.exitCode).not.toBe(0)
        expect(result.stdout).toBe('')
      }
    })
  })

  test('refuses missing and invalid JSON rather than supplying an illustrative ID', async () => {
    await withTempDir('documentation-gemini-missing-', async dir => {
      const manifestPath = join(dir, 'manifest.json')
      expect((await runReader(manifestPath)).exitCode).not.toBe(0)
      for (const text of ['not-json', '{}', '{"items": []}']) {
        await Bun.write(manifestPath, text)
        const result = await runReader(manifestPath)
        expect(result.exitCode).not.toBe(0)
        expect(result.stdout).toBe('')
      }
    })
  })
})
