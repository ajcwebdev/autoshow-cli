import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { COMMAND_DEFINITIONS } from '~/cli/command-definitions'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { renderCommandHelp, renderRootHelp } from '~/cli/native/help-renderer'
import { createNativeRootDefinition } from '~/cli/native/root-definition'
import { parseNativeCli } from '~/cli/native/native-parser'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { resolveTtsDeliveryOptions } from '~/cli/options/option-resolution/tts-delivery-options'
import { collectTtsTargets } from '~/cli/commands/audio/tts/tts-targets'
import { getAvailablePromptNames, getAvailablePromptNamesForHelp } from '~/prompts/prompt-loader'
import { stripAnsi } from '~/utils/terminal-colors'

const root = createNativeRootDefinition()
const command = (name: string) => COMMAND_DEFINITIONS.find(entry => entry.name === name)!
const plain = (value: string) => stripAnsi(value).replace(/\|\n\s+/g, '|').replace(/\s+/g, ' ')

describe('shared and TTS help audit', () => {
  test('all help pages explain omitted boolean defaults without injecting runtime settings', () => {
    for (const help of [renderRootHelp(root, COMMAND_DEFINITIONS), ...COMMAND_DEFINITIONS.map(entry => renderCommandHelp(root, entry))]) {
      expect(plain(help)).toContain('Boolean switches are off unless stated otherwise')
      expect(plain(help)).toContain('Defaults shown are built-in fallbacks')
    }
    const parsed = parseNativeCli(['tts', 'sample.txt'], COMMAND_DEFINITIONS, GLOBAL_FLAG_DEFINITIONS)
    expect(parsed.flags['gemini-tts-mode']).toBeUndefined()
    expect(parsed.flags['tts-sample-rate']).toBeUndefined()
    expect(parsed.flags['tts-loudness']).toBeUndefined()
  })

  test('prompt topic lists the actual runtime names and default selection', async () => {
    expect(getAvailablePromptNamesForHelp()).toEqual((await getAvailablePromptNames()).toSorted((a, b) => a.localeCompare(b)))
    const help = plain(renderCommandHelp(root, command('write'), { topic: 'prompts' }))
    for (const name of await getAvailablePromptNames()) expect(help).toContain(name)
    expect(help).toContain('saved configuration or the default prompt')
  })

  test('setup rejects TTS invocation-only flags before installation and advertises persisted model selection', async () => {
    const help = renderCommandHelp(root, command('setup'))
    expect(help).toContain('Save TTS models with --tts provider=model')
    for (const flag of ['model', 'gemini-tts-mode', 'gemini-tts-batch-wait-seconds']) {
      expect(command('setup').flags![flag]).toBeUndefined()
      const child = Bun.spawn(['bun', '--no-env-file', 'src/cli/create-cli.ts', 'setup', `--${flag}`, flag === 'model' ? 'tts-rt-v2' : flag === 'gemini-tts-mode' ? 'batch' : '0'], {
        stdout: 'pipe', stderr: 'pipe', env: { PATH: process.env['PATH'], NO_COLOR: '1' },
      })
      const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
      expect(exitCode).toBe(2)
      expect(stdout + stderr).toContain(`--${flag}`)
      expect(stdout + stderr).toContain(`Unexpected flag: --${flag}`)
    }
  })

  test('TTS provider topics expose real voice defaults and qualify chunk ceilings', () => {
    for (const [provider, voice] of Object.entries({ soniox: 'Adrian', gemini: 'Kore', grok: 'eve', openai: 'alloy', elevenlabs: 'hpp4J3VqNfWAUOO0d1Us', inworld: 'voice_inworld_standard_en' })) {
      const help = plain(renderCommandHelp(root, command('tts'), { topic: `provider:${provider}` }))
      expect(help).toContain(`--tts-voice default: ${voice}`)
      expect(help).toContain('Effective defaults and explicit limits can be lower')
    }
    const help = plain(renderCommandHelp(root, command('tts')))
    expect(help).toContain('auto|on|off (elevenlabs)')
    expect(help).toContain('Default: soniox en; grok auto')
    expect(help).toContain('integer 0-86400')
  })

  test('smart-only compatibility flag stays accepted and invalid boundaries still fail locally', () => {
    const parsed = parseNativeCli(['tts', 'sample.txt', '--tts-chunk-boundary', 'smart'], COMMAND_DEFINITIONS, GLOBAL_FLAG_DEFINITIONS)
    expect(resolveTtsDeliveryOptions(parsed.flags).ttsChunking.boundary).toBe('smart')
    expect(renderCommandHelp(root, command('tts'))).not.toContain('--tts-chunk-boundary')
    expect(() => resolveTtsDeliveryOptions({ 'tts-chunk-boundary': 'word' })).toThrow('Invalid --tts-chunk-boundary')
  })

  test('hidden controls still reject unsupported Eleven v3 settings before provider dispatch', () => {
    for (const [flag, value] of Object.entries({ 'tts-similarity': '0.5', 'tts-style': '0.5', 'tts-speaker-boost': 'true' })) {
      expect(renderCommandHelp(root, command('tts'))).not.toContain(`--${flag}`)
      expect(() => collectTtsTargets(buildOptsFromFlags({ 'elevenlabs-tts': 'eleven_v3', [flag]: value }))).toThrow('Eleven v3 does not expose')
    }
  })

  test('mastering default, override, and reset agree with documented profile behavior', () => {
    const native = resolveTtsDeliveryOptions({}).ttsDelivery!
    expect(native.sampleRate).toBeUndefined()
    expect(native.loudness.mode).toBe('none')
    const audiobook = resolveTtsDeliveryOptions({ 'tts-audio-profile': 'audiobook' }).ttsDelivery!
    expect(audiobook.sampleRate).toBe(44100)
    expect(audiobook.channels).toBe(1)
    expect(audiobook.leadInMs).toBe(500)
    expect(audiobook.leadOutMs).toBe(1000)
    expect(audiobook.loudness).toEqual({ mode: 'ebu-r128', integratedLufs: -19, truePeakDb: -3 })
    expect(resolveTtsDeliveryOptions({ 'tts-audio-profile': 'audiobook', 'tts-lead-in': '0' }).ttsDelivery!.leadInMs).toBe(0)
    expect(resolveTtsDeliveryOptions({ 'tts-audio-profile': 'audiobook' }).ttsDelivery!.leadInMs).toBe(500)
    expect(() => resolveTtsDeliveryOptions({ 'tts-chunk-size': '100001' })).toThrow('Invalid --tts-chunk-size')
  })

  test('TTS command applies saved providers, explicit override, model override, and reset in price mode', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'autoshow-tts-help-defaults-'))
    try {
      const configPath = join(directory, 'config.json')
      const inputPath = join(directory, 'input.txt')
      await Bun.write(inputPath, 'Read this short line clearly.')
      const price = async (flags: string[] = []) => {
        const child = Bun.spawn(['bun', '--no-env-file', 'src/cli/create-cli.ts', 'tts', inputPath, '--config-path', configPath, '--price', '--json', ...flags], {
          stdout: 'pipe', stderr: 'pipe', env: { PATH: process.env['PATH'], NO_COLOR: '1' },
        })
        const [stdout, stderr, exitCode] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
        expect({ exitCode, stderr: exitCode === 0 ? '' : stderr }).toEqual({ exitCode: 0, stderr: '' })
        const result = JSON.parse(stdout.trim())
        expect(result.data.dryRun).toBe(true)
        return result.data.estimate.steps as Array<{ provider: string, model: string }>
      }
      await Bun.write(configPath, JSON.stringify({ defaults: { tts: { geminiTts: ['gemini-3.8-flash-tts'] } } }))
      expect((await price()).map(step => step.provider)).toEqual(['gemini'])
      expect((await price(['--provider', 'soniox=tts-rt-v2'])).map(step => step.provider)).toEqual(['soniox'])
      expect((await price(['--model', 'gemini-3.8-flash-lite-tts'])).map(step => step.model)).toEqual(['gemini-3.8-flash-lite-tts'])
      await Bun.write(configPath, '{}')
      expect((await price(['--provider', 'soniox=tts-rt-v2'])).map(step => step.provider)).toEqual(['soniox'])
      expect((await price()).length).toBe(1)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})
