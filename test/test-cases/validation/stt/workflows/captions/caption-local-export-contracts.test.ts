import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { runCaptionExport } from '~/cli/commands/stt/workflows/captions/run-caption-export'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/command-shared/run-dir'
import { partial } from './caption-evidence-fixtures'
import { installFetch, setupCaptionContractLifecycle } from './caption-contract-lifecycle'

const { withTempDir } = setupCaptionContractLifecycle()

describe('caption local export contracts', () => {
  test('offline word export needs no audio or provider and refuses to overwrite', async () => {
    installFetch(() => { throw new Error('Export must be offline') })
    await withTempDir(async dir => {
      const source = join(dir, 'result.json'), output = join(dir, 'captions')
      await Bun.write(source, JSON.stringify(partial))
      configurePinnedRunDir(output)
      try {
        await runCaptionExport(source, { 'caption-mode': 'word' })
        expect(await Bun.file(join(output, 'captions.srt')).text()).toContain('00:00:00,125 --> 00:00:00,500')
        expect(await Bun.file(join(output, 'captions.vtt')).text()).toContain('[B] Goodbye.')
        expect((await Bun.file(join(output, 'captions.json')).json()).inferredWords).toBe(1)
        await expect(runCaptionExport(source, {})).rejects.toThrow()
      } finally { resetPinnedRunDir() }
    })
  })

  test('actual caption CLI exports without credentials, audio, or model setup', async () => {
    await withTempDir(async dir => {
      const source = join(dir, 'result.json'), output = join(dir, 'export')
      await Bun.write(source, JSON.stringify(partial))
      const child = Bun.spawn([process.execPath, '--no-env-file', 'src/cli/create-cli.ts', 'extract', source, '--captions', '--json', '--caption-mode', 'word', '--no-caption-speakers', '--output-dir', output], {
        stdout: 'pipe', stderr: 'pipe', env: { PATH: process.env['PATH'] ?? '', HOME: process.env['HOME'] ?? '' }
      })
      const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      expect({ code, stderr, stdout }).toMatchObject({ code: 0 })
      expect(JSON.parse(stdout)).toMatchObject({ type: 'result', status: 'success', data: { outputDir: output } })
      const vtt = await Bun.file(join(output, 'captions.vtt')).text()
      expect(vtt).toContain('Goodbye.')
      expect(vtt).not.toContain('[B]')
    })
  })

  test('actual media CLI transcribes audio/video once and exports captions alongside saved evidence', async () => {
    await withTempDir(async dir => {
      const preload = join(dir, 'mock-provider.ts')
      const calls = join(dir, 'calls.txt')
      const config = join(dir, 'config.json')
      await Bun.write(config, '{}')
      await Bun.write(preload, `
        import { appendFileSync } from 'node:fs'
        globalThis.fetch = async (input, init) => {
          const url = String(input)
          if (!url.includes('api.deepinfra.com/v1/audio/transcriptions')) throw new Error('Network blocked by caption contract test: ' + url)
          appendFileSync(${JSON.stringify(calls)}, 'transcribe\\n')
          if (init.body instanceof FormData) {
            const file = init.body.get('file')
            if (!(file instanceof File)) throw new Error('Missing uploaded file')
          }
          return Response.json({ text: 'Hello world.', segments: [{ start: 0.125, end: 0.875, text: 'Hello world.' }], words: [{ word: 'Hello', start: 0.125, end: 0.5 }, { word: 'world.', start: 0.625, end: 0.875 }] })
        }
      `)
      for (const scenario of ['wav', 'mp4', 'multi']) {
        const extension = scenario === 'multi' ? 'wav' : scenario
        const source = join(dir, scenario + '.' + extension), output = join(dir, scenario)
        const generate = Bun.spawn(['runtime/bin/ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono', ...(extension === 'mp4' ? ['-f', 'lavfi', '-i', 'color=c=black:s=32x32', '-c:v', 'mpeg4', '-c:a', 'aac'] : []), '-t', '1', source], { stdout: 'pipe', stderr: 'pipe' })
        const generatedError = await new Response(generate.stderr).text()
        expect({ code: await generate.exited, generatedError }).toMatchObject({ code: 0 })
        const child = Bun.spawn([process.execPath, '--no-env-file', '--preload', preload, 'src/cli/create-cli.ts', 'extract', source, '--provider', 'deepinfra=openai/whisper-large-v3', ...(scenario === 'multi' ? ['--provider', 'deepinfra=openai/whisper-large-v3-turbo'] : []), '--captions', ...(scenario === 'mp4' ? ['--embed-captions', '--caption-container', 'both', '--stt-audio-profile', 'lossless'] : []), '--json', '--caption-mode', 'word', '--no-caption-speakers', '--config-path', config, '--output-dir', output], {
          stdout: 'pipe', stderr: 'pipe', env: { PATH: process.env['PATH'] ?? '', HOME: dir, DEEPINFRA_API_KEY: 'fixture-no-network' }
        })
        const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
        expect({ code, stderr, stdout }).toMatchObject({ code: 0 })
        expect(JSON.parse(stdout)).toMatchObject({ type: 'result', status: 'success', data: { outputDir: output } })
        const files = JSON.parse(stdout).data.files as Record<string, string>
        if (scenario === 'mp4') {
          expect(Object.values(files).filter(path => /captioned\.(mp4|mkv)$/.test(path))).toHaveLength(2)
          expect(await Bun.file(join(output, 'source-timeline.json')).json()).toMatchObject({ profile: 'lossless', decodedSamplesMatch: true, sampleFormat: 'float32', sampleRate: 16000 })
          expect(Object.values(files).some(path => path.endsWith('.wav'))).toBe(true)
          const embedding = await Bun.file(join(output, 'caption-embedding.json')).json()
          expect(embedding.verification.mp4.subtitleCuesMatch).toBe(true)
          expect(embedding.verification.mkv.streams).toHaveLength(2)
        }
        const subtitles = Object.values(files).filter(path => path.endsWith('captions.vtt'))
        expect(subtitles).toHaveLength(scenario === 'multi' ? 2 : 1)
        for (const subtitle of subtitles) {
          expect(await Bun.file(subtitle).text()).toContain('00:00:00.125 --> 00:00:00.500')
          expect(await Bun.file(subtitle.replace('captions.vtt', 'captions.srt')).exists()).toBe(true)
          expect((await Bun.file(subtitle.replace('captions.vtt', 'result.json')).json()).evidence.words).toHaveLength(2)
        }
        if (scenario === 'wav') {
          for (const extra of [['--price'], ['--caption-line-width', '0']]) {
            const validation = Bun.spawn([process.execPath, '--no-env-file', '--preload', preload, 'src/cli/create-cli.ts', 'extract', source, '--provider', 'deepinfra', '--captions', '--json', '--config-path', config, ...extra], {
              stdout: 'pipe', stderr: 'pipe', env: { PATH: process.env['PATH'] ?? '', HOME: dir, DEEPINFRA_API_KEY: 'fixture-no-network' }
            })
            const [validationOut, validationErr, validationCode] = await Promise.all([new Response(validation.stdout).text(), new Response(validation.stderr).text(), validation.exited])
            if (extra[0] === '--price') expect({ validationCode, validationOut, validationErr }).toMatchObject({ validationCode: 0 })
            else expect(validationCode).not.toBe(0)
            expect((await Bun.file(calls).text()).trim().split('\n')).toHaveLength(1)
          }
        }
      }
      expect((await Bun.file(calls).text()).trim().split('\n')).toHaveLength(4)
    })
  }, 30_000)
})
