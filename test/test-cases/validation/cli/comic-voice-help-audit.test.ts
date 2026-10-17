import { describe, expect, test } from 'bun:test'
import { VOICE_SUBCOMMAND_DEFINITIONS } from '~/cli/commands/audio/voice/define-voice-command'
import { coerceAndValidateGenerateImages } from '~/cli/commands/visuals/comic/comic-utils/cli-args'
import { generateImagesCommandDefinition } from '~/cli/commands/visuals/comic/comic-utils/subcommand-help'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseCommandInvocation } from '~/cli/native/native-parser'
import { asCtx, parseRoot } from './cli-usage-errors/shared'
import { getCommandFlagsSection, helpText, loadHelp } from './cli-help-contracts/shared'

const imageOptions = (args: string[]) => coerceAndValidateGenerateImages(parseCommandInvocation(
  ['comic generate-images', 'script.md', ...args], generateImagesCommandDefinition, GLOBAL_FLAG_DEFINITIONS
))

describe('voice and comic audited help contracts', () => {
  test('voice provider choices describe each action capability and creation models have no implicit default', async () => {
    const capabilities = [
      ['list', 'gemini|elevenlabs|grok|inworld'],
      ['design', 'gemini|elevenlabs|inworld'],
      ['clone', 'gemini|elevenlabs|grok|inworld'],
      ['import', 'gemini|elevenlabs|soniox|grok|openai|inworld'],
    ] as const
    for (const [action, providers] of capabilities) {
      const command = VOICE_SUBCOMMAND_DEFINITIONS.find(entry => entry.name === `voice ${action}`)!
      expect(command.flags?.['provider']?.description).toContain(providers)
      const { stdout } = await loadHelp(['voice', action, '--help'])
      expect(helpText(stdout)).toContain(providers)
      if (action !== 'list') {
        expect(command.flags?.['model']?.default).toBeUndefined()
        expect(command.flags?.['model']?.description).toContain('no default')
      }
    }
    const { stdout } = await loadHelp(['voice', 'import', '--help'])
    for (const model of ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts', 'eleven_v3', 'tts-rt-v2', 'grok-tts', 'gpt-4o-mini-tts-2025-12-15', 'realtime-tts-2']) {
      expect(helpText(stdout)).toContain(model)
    }
  })

  test('voice design help states provider-dependent limits, defaults, preview requirements, and creation model values', async () => {
    const text = helpText((await loadHelp(['voice', 'design', '--help'])).stdout)
    expect(text).toContain('1-3 (ElevenLabs/Inworld), 1-20 (Gemini); default: 3 for ElevenLabs, 1 otherwise')
    expect(text).toContain('optional separate synthesis preview (Gemini)')
    expect(text).toContain('non-negative integer seed; ElevenLabs only')
    for (const creationModel of ['eleven_ttv_v3', 'eleven_multilingual_ttv_v2', 'realtime-tts-2']) expect(text).toContain(creationModel)
    expect(text).toContain('model comes from the candidate')
  })

  test('voice design exposes the positional subject and retains the hidden save alias with conflict checks', async () => {
    const help = (await loadHelp(['voice', 'design', '--help'])).stdout
    expect(getCommandFlagsSection(help)).not.toContain('--subject-key')
    expect(helpText(help)).toContain('voice design hero --save CANDIDATE_ID')
    const alias = parseRoot(['voice', 'design', '--save', 'candidate-id', '--subject-key', 'hero', '--provider', 'elevenlabs'])
    expect(alias.flags['subject-key']).toBe('hero')
    expect(alias.rawParsed.unknown).toEqual({})
    const conflict = parseRoot(['voice', 'design', 'hero', '--save', 'candidate-id', '--subject-key', 'villain', '--provider', 'elevenlabs'])
    await expect(conflict.command!.handler(asCtx(conflict))).rejects.toThrow('Positional subject key conflicts with --subject-key')
  })

  test('revision comparison count is inferred while promotion still requires explicit authorization', () => {
    expect(imageOptions(['--revision-plan', 'plan.json', '--promote', 'clear-winners'])).toMatchObject({
      comparisonPasses: 2, promote: 'clear-winners', maxRepairs: 0, panelsPerImage: 1,
    })
    expect(imageOptions(['--revision-plan', 'plan.json', '--comparison-passes', '2', '--promote', 'clear-winners']).comparisonPasses).toBe(2)
    expect(() => imageOptions(['--revision-plan', 'plan.json'])).toThrow('--revision-plan requires --promote clear-winners')
    expect(() => imageOptions(['--revision-plan', 'plan.json', '--comparison-passes', '1', '--promote', 'clear-winners'])).toThrow('--revision-plan requires --comparison-passes 2')
    expect(() => imageOptions(['--comparison-passes', '2'])).toThrow('require --revision-plan')
  })

  test('comic image help includes effective defaults and omits the fixed comparison override', async () => {
    const result = (await loadHelp(['comic', 'generate-images', '--help'])).stdout
    const text = helpText(result)
    expect(getCommandFlagsSection(result)).not.toContain('--comparison-passes')
    expect(text).toContain('default: 1536x1024')
    expect(text).toContain('default: high')
    expect(text).toContain('default: canonical')
    expect(text).toContain('default: 2 for generation, 0 for --qa-only or --revision-plan')
    expect(text).toContain('requires explicit --promote clear-winners authorization')
    expect(imageOptions([]).maxRepairs).toBe(2)
    expect(imageOptions(['--qa-only']).maxRepairs).toBe(0)
  })

  test('reference help specifies one provider and separate character and location defaults', async () => {
    const text = helpText((await loadHelp(['comic', 'reference-sketch', '--help'])).stdout)
    expect(text).toContain('Exactly one image provider[=model]')
    expect(text).toContain('default: 1024x1536 for characters, 1536x1024 for locations')
    expect(text).toContain('default: medium for characters, high for locations')
  })
})
