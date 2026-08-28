import { expect, test } from 'bun:test'
import { VOICE_PUBLIC_ACTIONS } from '~/cli/commands/process-steps/step-4-tts/voice-management/define-voice-command'
import {
  advertisedFlagNames,
  comicSubcommands,
  getCommandFlagsSection,
  getFlagGroupSection,
  getSection,
  loadHelp
} from './shared'

export const registerComicAndVoiceHelpCases = (): void => {
  test.concurrent('comic help lists every subcommand and points at their own help', async () => {
    const result = await loadHelp(['comic', '--help'])

    expect(result.exitCode).toBe(0)
    const subcommandSection = getSection(result.stdout, '\nSubcommands\n', '\nGlobal Flags\n')
    for (const subcommand of comicSubcommands) {
      expect(subcommandSection).toContain(`  ${subcommand}`)
    }
    expect(subcommandSection).toContain('Run panel prompt bundles to review sketches and/or final panel images')
    expect(result.stdout).toContain('bun autoshow comic <subcommand> --help')
    expect(getCommandFlagsSection(result.stdout)).toBe('')
  })

  test.concurrent('comic generate-images help is scoped to its own page and QA flags', async () => {
    const result = await loadHelp(['comic', 'generate-images', '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('$ bun autoshow comic generate-images <script-path> [flags]')
    expect(result.stdout).toContain('NN-SC shorthand')
    expect(result.stdout).toContain('05-01')
    expect(getFlagGroupSection(result.stdout, 'Panel Selection')).toContain('--panels')
    expect(getFlagGroupSection(result.stdout, 'Panel Selection')).toContain('--panels-per-image')
    expect(getFlagGroupSection(result.stdout, 'Panel Selection')).toContain('--grid')
    expect(getFlagGroupSection(result.stdout, 'Image Options')).toContain('--variation')
    expect(getFlagGroupSection(result.stdout, 'Image QA')).toContain('--qa, --no-qa')
    expect(getFlagGroupSection(result.stdout, 'Image QA')).toContain('--max-repairs')
    expect(result.stdout).toContain('final default: 1; sketch default: 6')
    expect(result.stdout).toContain('bun autoshow comic draft-scenes <script-path> --only panel-prompts')
    expect(result.stdout).not.toContain('[--target prompts|images|sketches|both]')
    const flagsSection = getCommandFlagsSection(result.stdout)
    expect(flagsSection).not.toContain('--only')
    expect(flagsSection).not.toContain('--character')
    expect(flagsSection).not.toContain('--location')
  })

  test.concurrent('comic draft-scenes help is scoped to the drafting stages', async () => {
    const result = await loadHelp(['comic', 'draft-scenes', '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('$ bun autoshow comic draft-scenes <script-path> [flags]')
    expect(getFlagGroupSection(result.stdout, 'Scene Drafting')).toContain('--only')
    expect(result.stdout).toContain('structure|prompt|scene|panel-prompts')
    const flagsSection = getCommandFlagsSection(result.stdout)
    expect(flagsSection).not.toContain('--panels')
    expect(flagsSection).not.toContain('--target')
    expect(flagsSection).not.toContain('--character')
  })

  test.concurrent('comic generate-slideshow help documents its local synchronization contract', async () => {
    const result = await loadHelp(['comic', 'generate-slideshow', '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('$ bun autoshow comic generate-slideshow <script-path> [flags]')
    const presentation = getFlagGroupSection(result.stdout, 'Comic Presentation')
    expect(presentation).toContain('--audio-target')
    expect(presentation).toContain('--untimed-panel-ms')
    expect(presentation).toContain('--fps')
    expect(getFlagGroupSection(result.stdout, 'Pricing')).toContain('--price')
    expect(result.stdout).toContain('panels/panel-NN.png')
    expect(result.stdout).toContain('hard cuts only')
    expect(getCommandFlagsSection(result.stdout)).not.toContain('--provider')
  })

  test.concurrent('comic reference-sketch help documents both reference kinds', async () => {
    const reference = await loadHelp(['comic', 'reference-sketch', '--help'])

    expect(reference.exitCode).toBe(0)
    expect(reference.stdout).toContain('$ bun autoshow comic reference-sketch [flags]')
    expect(getFlagGroupSection(reference.stdout, 'Reference Sheet')).toContain('--character')
    expect(getFlagGroupSection(reference.stdout, 'Reference Sheet')).toContain('--location')
    expect(reference.stdout).toContain('Exactly one of --character or --location is required')
    expect(getCommandFlagsSection(reference.stdout)).not.toContain('--panels')
  })

  test.concurrent('comic help subcommand routing matches the --help flag output', async () => {
    const viaFlag = await loadHelp(['comic', 'generate-images', '--help'])
    const viaHelp = await loadHelp(['comic', 'help', 'generate-images'])

    expect(viaHelp.exitCode).toBe(0)
    expect(viaHelp.stdout).toBe(viaFlag.stdout)
  })

  test.concurrent('comic generate-audio help shows --slideshow and hides the --panel-video alias', async () => {
    const result = await loadHelp(['comic', 'generate-audio', '--help'])

    expect(result.exitCode).toBe(0)
    const flags = getCommandFlagsSection(result.stdout)
    expect(flags).toContain('--slideshow')
    expect(flags).not.toContain('--panel-video')
    expect(flags).not.toContain('--local-concurrency')
  })

  test.concurrent('comic reference-voice help lists public children without a flag wall', async () => {
    const result = await loadHelp(['comic', 'reference-voice', '--help'])

    expect(result.exitCode).toBe(0)
    expect(VOICE_PUBLIC_ACTIONS).toContain('clone')
    expect(VOICE_PUBLIC_ACTIONS).toContain('list')
    expect(VOICE_PUBLIC_ACTIONS).not.toContain('status')
    expect(VOICE_PUBLIC_ACTIONS).not.toContain('inspect')
    expect(VOICE_PUBLIC_ACTIONS).not.toContain('discover')
    expect(VOICE_PUBLIC_ACTIONS).not.toContain('revoke-consent')
    expect(VOICE_PUBLIC_ACTIONS).not.toContain('revoke')
    expect(VOICE_PUBLIC_ACTIONS).not.toContain('materialize')
    expect(VOICE_PUBLIC_ACTIONS).not.toContain('reconcile')
    const children = getSection(result.stdout, '\nSubcommands\n', '\nGlobal Flags\n')
    for (const action of VOICE_PUBLIC_ACTIONS) {
      expect(children).toContain(`  ${action}`)
    }
    expect(children).not.toMatch(/(^|\n) {2}status {2}/)
    expect(children).not.toMatch(/(^|\n) {2}materialize {2}/)
    const flags = getCommandFlagsSection(result.stdout)
    expect(flags).not.toContain('--sample')
    expect(flags).not.toContain('--allow')

    for (const action of VOICE_PUBLIC_ACTIONS) {
      const voiceHelp = await loadHelp(['voice', action, '--help'])
      const comicHelp = await loadHelp(['comic', 'reference-voice', action, '--help'])
      expect(advertisedFlagNames(getCommandFlagsSection(comicHelp.stdout))).toEqual(
        advertisedFlagNames(getCommandFlagsSection(voiceHelp.stdout))
      )
    }
  })

  test.concurrent('voice clone help does not advertise --kind', async () => {
    const result = await loadHelp(['voice', 'clone', '--help'])
    expect(result.exitCode).toBe(0)
    expect(getCommandFlagsSection(result.stdout)).not.toContain('--kind')
  })

  test.concurrent('subcommand parents render a subcommand usage placeholder', async () => {
    const voice = await loadHelp(['voice', '--help'])
    const comic = await loadHelp(['comic', '--help'])

    expect(voice.exitCode).toBe(0)
    expect(comic.exitCode).toBe(0)
    expect(voice.stdout).toContain('$ bun autoshow voice <subcommand> [flags]')
    expect(comic.stdout).toContain('$ bun autoshow comic <subcommand> [flags]')
    expect(voice.stdout).toContain('bun autoshow voice <subcommand> --help')
    expect(comic.stdout).toContain('bun autoshow comic <subcommand> --help')
    const voiceSubcommands = getSection(voice.stdout, '\nSubcommands\n', '\nGlobal Flags\n')
    for (const action of VOICE_PUBLIC_ACTIONS) {
      expect(voiceSubcommands).toContain(`  ${action}`)
    }
    expect(voiceSubcommands).not.toMatch(/(^|\n) {2}status {2}/)
    expect(voiceSubcommands).not.toMatch(/(^|\n) {2}inspect {2}/)
    expect(voiceSubcommands).not.toMatch(/(^|\n) {2}discover {2}/)
    expect(voiceSubcommands).not.toMatch(/(^|\n) {2}revoke-consent {2}/)
    expect(voiceSubcommands).not.toMatch(/(^|\n) {2}revoke {2}/)
    expect(voiceSubcommands).not.toMatch(/(^|\n) {2}materialize {2}/)
    expect(voiceSubcommands).not.toMatch(/(^|\n) {2}reconcile {2}/)

    const tts = await loadHelp(['tts', '--help'])
    const generateImages = await loadHelp(['comic', 'generate-images', '--help'])
    expect(tts.stdout).toContain('$ bun autoshow tts <input> [flags]')
    expect(generateImages.stdout).toContain('$ bun autoshow comic generate-images <script-path> [flags]')
    expect(tts.stdout).not.toContain('<subcommand>')
    expect(generateImages.stdout).not.toContain('<subcommand>')
  })
}
