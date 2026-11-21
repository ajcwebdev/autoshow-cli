import { helpText } from './shared'
import { expect, test } from 'bun:test'
import { VOICE_PUBLIC_ACTIONS } from '~/cli/commands/audio/voice/define-voice-command'
import {
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
    expect(comicSubcommands.sort()).toEqual(['draft-scenes', 'draft-treatment', 'generate-audio', 'generate-images', 'generate-slideshow', 'reference-sketch', 'review'])
    expect(subcommandSection).toContain('Generate review sketches and/or final panel images from panel prompt bundles with one image model per run')
    expect(subcommandSection).toContain('Prepare the structured script and draft prompt locally, draft the scene JSON, then build panel prompt bundles')
    for (const retired of ['review-notes', 'review-sheet', 'blocking', 'staging directives']) expect(subcommandSection).not.toContain(retired)
    expect(result.stdout).toContain('bun autoshow comic <subcommand> --help')
    expect(getCommandFlagsSection(result.stdout)).toBe('')
  })

  test.concurrent('comic generate-images help is scoped to its own page with one model per run and automatic first selection', async () => {
    const result = await loadHelp(['comic', 'generate-images', '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('$ bun autoshow comic generate-images <script-path> [flags]')
    expect(result.stdout).toContain('NN-SC shorthand')
    expect(result.stdout).toContain('05-01')
    expect(getFlagGroupSection(result.stdout, 'Panel Selection')).toContain('--panels')
    expect(getFlagGroupSection(result.stdout, 'Panel Selection')).toContain('--panels-per-image')
    expect(getFlagGroupSection(result.stdout, 'Panel Selection')).toContain('--grid')
    expect(getFlagGroupSection(result.stdout, 'Image Options')).toContain('--provider')
    expect(getFlagGroupSection(result.stdout, 'Image Options')).not.toContain('--variation')
    expect(result.stdout).not.toContain('Image QA')
    expect(helpText(result.stdout)).toContain('Exactly one image provider[=model] per run')
    expect(helpText(result.stdout)).toContain('Each run uses exactly one --provider provider[=model]; run a separate invocation for another model')
    expect(helpText(result.stdout)).toContain('The first valid individual panel fills an empty slot at panels/panel-NN.png')
    expect(helpText(result.stdout)).toContain('comic review --run <id> --use')
    expect(helpText(result.stdout)).toContain('final default: 1; sketch default: 6')
    expect(helpText(result.stdout)).toContain('bun autoshow comic draft-scenes <script-path> --only panel-prompts')
    expect(result.stdout).not.toContain('[--target prompts|images|sketches|both]')
    const flagsSection = getCommandFlagsSection(result.stdout)
    expect(flagsSection).not.toContain('--only')
    expect(flagsSection).not.toContain('--character')
    expect(flagsSection).not.toContain('--location')
    for (const retired of ['--qa', '--max-repairs', '--continuity', '--labels', '--trusted-anchor-panel', '--bloopers', '--revision-plan', '--comparison-passes', '--promote', '--variation', '--credit-preflight', '--blocking']) {
      expect(flagsSection).not.toContain(retired)
    }
    expect(result.stdout).not.toMatch(/\n {2}comic-qa\b/)
  })

  test.concurrent('comic draft-scenes help is scoped to the drafting stages', async () => {
    const result = await loadHelp(['comic', 'draft-scenes', '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('$ bun autoshow comic draft-scenes <script-path> [flags]')
    expect(getFlagGroupSection(result.stdout, 'Scene Drafting')).toContain('--only')
    expect(helpText(result.stdout)).toContain('Run one stage: prepare|scene|panel-prompts')
    expect(helpText(result.stdout)).toContain('Stages run in order: prepare, scene, panel-prompts')
    expect(helpText(result.stdout)).toContain('The former --only structure and --only prompt selectors are replaced by --only prepare')
    expect(getFlagGroupSection(result.stdout, 'Scene Drafting')).toContain('--panel-count')
    const flagsSection = getCommandFlagsSection(result.stdout)
    for (const retired of ['--blocking', '--no-blocking', '--blocking-plan', '--rebind', '--reconcile-from-directives']) expect(flagsSection).not.toContain(retired)
    expect(flagsSection).not.toContain('--panels')
    expect(flagsSection).not.toContain('--target')
    expect(flagsSection).not.toContain('--character')
  })

  test.concurrent('comic draft-treatment help is scoped to treatment drafting', async () => {
    const result = await loadHelp(['comic', 'draft-treatment', '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('$ bun autoshow comic draft-treatment <treatment-path> [flags]')
    const treatment = getFlagGroupSection(result.stdout, 'Treatment Drafting')
    expect(treatment).toContain('--panel-count')
    expect(treatment).toContain('--voice-pacing')
    expect(treatment).toContain('--episode')
    expect(treatment).toContain('--scene')
    expect(treatment).toContain('--slug')
    expect(treatment).toContain('--speaker')
    expect(treatment).toContain('--style-seed')
    expect(treatment).toContain('--catalog-policy')
    expect(treatment).toContain('--force')
    expect(treatment).toContain('--provider')
    expect(getFlagGroupSection(result.stdout, 'Pricing')).toContain('--price')
    expect(result.stdout).toContain('NARRATION')
    expect(result.stdout).toContain('input/scripts/<episode>-script/<scene>-<slug>.md')
    const flagsSection = getCommandFlagsSection(result.stdout)
    expect(flagsSection).not.toContain('--panels')
    expect(flagsSection).not.toContain('--target')
    expect(flagsSection).not.toContain('--only')
    expect(flagsSection).not.toContain('--image-model')
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

  test.concurrent('comic review help shows candidate preview with --run and explicit adoption with --use', async () => {
    const review = await loadHelp(['comic', 'review', '--help'])
    expect(review.exitCode).toBe(0)
    expect(review.stdout).toContain('$ bun autoshow comic review <script-path> [flags]')
    const group = getFlagGroupSection(review.stdout, 'Comic Review')
    for (const flag of ['--run', '--use', '--panels', '--export-doc']) expect(group).toContain(flag)
    expect(group).not.toContain('--notes')
    expect(helpText(review.stdout)).toContain('Previewing and exporting never change a selection')
    expect(helpText(review.stdout)).toContain('comic review 02-01 --run <image-run-id> --use --panels 3')
    expect(helpText(review.stdout)).not.toContain('staging directives')
    expect(getCommandFlagsSection(review.stdout)).not.toContain('--price')
    const viaHelp = await loadHelp(['comic', 'help', 'review'])
    expect(viaHelp.stdout).toBe(review.stdout)
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
