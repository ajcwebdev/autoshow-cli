import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { COMMAND_DEFINITIONS } from '~/cli/command-definitions'
import {
  coerceAndValidateDraftScenes,
  coerceAndValidateGenerateImages,
  coerceAndValidateReferenceSketch,
  coerceAndValidateReview
} from '~/cli/commands/visuals/comic/comic-utils/cli-args'
import * as priceEstimate from '~/cli/commands/visuals/comic/comic-utils/price-estimate'
import { dispatchNativeCli } from '~/cli/native/dispatcher'
import { NativeNoSuchCommandError, NativeUnknownFlagError } from '~/cli/native/native-errors'
import { parseNativeCli } from '~/cli/native/native-parser'
import { createNativeRootDefinition } from '~/cli/native/root-definition'
import type { CliCommandContext, CliCommandDefinition } from '~/types'

// Every case goes through the normal CLI dispatcher. Each comic subcommand handler is replaced by an
// instrumented stand-in that runs the real argument validation and then records a dispatch, so a
// rejection with zero recorded dispatches proves the input never reached pricing, artifacts, or a provider.
const COERCE_BY_SUBCOMMAND: Readonly<Record<string, (ctx: CliCommandContext) => unknown>> = {
  'comic draft-scenes': coerceAndValidateDraftScenes,
  'comic generate-images': coerceAndValidateGenerateImages,
  'comic reference-sketch': coerceAndValidateReferenceSketch,
  'comic review': coerceAndValidateReview,
}

const dispatched: Array<{ command: string, options: unknown }> = []
afterEach(() => { dispatched.length = 0 })

const comic = COMMAND_DEFINITIONS.find(command => command.name === 'comic')!
const instrumentedComic: CliCommandDefinition = {
  ...comic,
  subcommands: comic.subcommands!.map(sub => ({
    ...sub,
    handler: (ctx: CliCommandContext) => {
      const coerce = COERCE_BY_SUBCOMMAND[sub.name]
      dispatched.push({ command: sub.name, options: coerce ? coerce(ctx) : undefined })
    }
  }))
}
const root = createNativeRootDefinition()
const dispatch = (argv: string[]) => dispatchNativeCli(argv, root, [instrumentedComic])

const rejectsBeforeDispatch = async (argv: string[], message: string | (new (...args: never[]) => Error)) => {
  await expect(dispatch(argv)).rejects.toThrow(message as never)
  expect(dispatched).toEqual([])
}

// `--price` keeps accepted control invocations out of the project writer lease; rejection happens first either way.
const RETIRED_FLAGS: ReadonlyArray<readonly [subcommand: string, prefix: readonly string[], retired: readonly string[]]> = [
  ['draft-scenes', ['script.md', '--price'], ['--blocking']],
  ['draft-scenes', ['script.md', '--price'], ['--no-blocking']],
  ['draft-scenes', ['script.md', '--price'], ['--blocking-plan', 'plan.json']],
  ['draft-scenes', ['script.md', '--price'], ['--rebind']],
  ['draft-scenes', ['script.md', '--price'], ['--reconcile-from-directives']],
  ['review', ['script.md'], ['--notes', 'notes.md']],
  ['generate-images', ['script.md', '--price'], ['--blocking-hard-keys']],
  ['generate-images', ['script.md', '--price'], ['--blocking-layout-guide']],
  ['generate-images', ['script.md', '--price'], ['--qa']],
  ['generate-images', ['script.md', '--price'], ['--no-qa']],
  ['generate-images', ['script.md', '--price'], ['--qa-provider', 'openai=gpt-6.1-sol']],
  ['generate-images', ['script.md', '--price'], ['--max-repairs', '0']],
  ['generate-images', ['script.md', '--price'], ['--qa-only']],
  ['generate-images', ['script.md', '--price'], ['--continuity-qa']],
  ['generate-images', ['script.md', '--price'], ['--continuity-only']],
  ['generate-images', ['script.md', '--price'], ['--labels', 'labels.json']],
  ['generate-images', ['script.md', '--price'], ['--trusted-anchor-panel', '1']],
  ['generate-images', ['script.md', '--price'], ['--bloopers']],
  ['generate-images', ['script.md', '--price'], ['--revision-plan', 'plan.json']],
  ['generate-images', ['script.md', '--price'], ['--comparison-passes', '2']],
  ['generate-images', ['script.md', '--price'], ['--promote', 'clear-winners']],
  ['generate-images', ['script.md', '--price'], ['--variation', 'canonical']],
  ['generate-images', ['script.md', '--price'], ['--variation', 'cinematic-depth']],
  ['generate-images', ['script.md', '--price'], ['--credit-preflight']],
  ['reference-sketch', ['--location', 'cargo-bay', '--price'], ['--qa']],
  ['reference-sketch', ['--location', 'cargo-bay', '--price'], ['--no-qa']],
  ['reference-sketch', ['--location', 'cargo-bay', '--price'], ['--qa-provider', 'openai=gpt-6.1-sol']],
  ['reference-sketch', ['--location', 'cargo-bay', '--price'], ['--max-repairs', '0']],
  ['reference-sketch', ['--character', 'hero', '--price'], ['--max-repairs', '0']],
]

describe('retired comic surfaces are rejected through the normal CLI before dispatch', () => {
  test('control: accepted invocations reach the instrumented handler exactly once', async () => {
    await dispatch(['comic', 'generate-images', 'script.md', '--price'])
    await dispatch(['comic', 'draft-scenes', 'script.md', '--only', 'prepare', '--price'])
    expect(dispatched.map(entry => entry.command)).toEqual(['comic generate-images', 'comic draft-scenes'])
  })

  for (const [subcommand, prefix, retired] of RETIRED_FLAGS) {
    test(`comic ${subcommand} rejects ${retired.join(' ')} as an unknown flag with zero dispatches`, async () => {
      await rejectsBeforeDispatch(['comic', subcommand, ...prefix, ...retired], NativeUnknownFlagError)
      await rejectsBeforeDispatch(['comic', subcommand, ...prefix, ...retired], `Unexpected flag: ${retired[0]}`)
    })
  }

  test('the retired review-notes and review-sheet aliases are unknown commands with zero dispatches', async () => {
    for (const alias of ['review-notes', 'review-sheet']) {
      await rejectsBeforeDispatch(['comic', alias, 'script.md'], NativeNoSuchCommandError)
      await rejectsBeforeDispatch(['comic', alias, 'script.md'], `Unknown command "comic ${alias}"`)
    }
  })
})

describe('draft-scenes stage selection', () => {
  test('retired structure and prompt selectors name --only prepare and never dispatch', async () => {
    for (const only of ['structure', 'prompt']) {
      await rejectsBeforeDispatch(['comic', 'draft-scenes', 'script.md', '--only', only, '--price'], `--only ${only} was merged into the local prepare stage; use --only prepare`)
    }
    await rejectsBeforeDispatch(['comic', 'draft-scenes', 'script.md', '--only', 'blocking', '--price'], 'Invalid only "blocking". Expected one of: prepare, scene, panel-prompts')
  })

  test('--only prepare rejects an explicit --provider while full runs and scene drafting accept it', async () => {
    await rejectsBeforeDispatch(['comic', 'draft-scenes', 'script.md', '--only', 'prepare', '--provider', 'openai=gpt-6.1-sol', '--price'], '--provider cannot be combined with --only prepare')
    await dispatch(['comic', 'draft-scenes', 'script.md', '--provider', 'openai=gpt-6.1-sol', '--price'])
    await dispatch(['comic', 'draft-scenes', 'script.md', '--only', 'scene', '--provider', 'openai=gpt-6.1-sol', '--price'])
    expect(dispatched.map(entry => (entry.options as { llmModel?: string, only?: string }))).toEqual([
      expect.objectContaining({ llmModel: 'gpt-6.1-sol' }),
      expect.objectContaining({ llmModel: 'gpt-6.1-sol', only: 'scene' }),
    ])
  })
})

describe('generate-images single-model selection', () => {
  test('omitted, bare-provider, and explicit-model selectors each dispatch one model', async () => {
    await dispatch(['comic', 'generate-images', 'script.md', '--price'])
    await dispatch(['comic', 'generate-images', 'script.md', '--provider', 'openai', '--price'])
    await dispatch(['comic', 'generate-images', 'script.md', '--provider', 'gemini=gemini-nano-banana-2.1', '--price'])
    expect(dispatched.map(entry => (entry.options as { imageModel?: string }).imageModel)).toEqual([undefined, 'gpt-image-2.6-flare', 'gemini-nano-banana-2.1'])
  })

  test('repeated selectors are rejected before deduplication, last-value selection, or dispatch', async () => {
    for (const selectors of [
      ['--provider', 'openai=gpt-image-2.6-flare', '--provider', 'openai=gpt-image-2.6-flare'],
      ['--provider', 'openai=gpt-image-2.6-flare', '--provider', 'openai=gpt-image-2.6-sunburst'],
      ['--provider', 'openai=gpt-image-2.6-flare', '--provider', 'gemini=gemini-nano-banana-2.1'],
      ['--provider=openai', '--provider', 'openai'],
    ]) await rejectsBeforeDispatch(['comic', 'generate-images', 'script.md', ...selectors, '--price'], 'comic generate-images accepts exactly one --provider')
    await rejectsBeforeDispatch(['comic', 'generate-images', 'script.md', '--provider', 'openai=gpt-image-2.6-flare,gemini=gemini-nano-banana-2.1', '--price'], 'accepts exactly one --provider provider[=model]')
  })

  test('the real handler rejects repeated selectors before the price estimator runs', async () => {
    const estimator = spyOn(priceEstimate, 'estimateGenerateImagesPrice').mockImplementation(async () => { throw new Error('estimator must not run') })
    try {
      await expect(dispatchNativeCli(['comic', 'generate-images', 'script.md', '--provider', 'openai', '--provider', 'gemini', '--price'], root, COMMAND_DEFINITIONS))
        .rejects.toThrow('comic generate-images accepts exactly one --provider')
      expect(estimator).not.toHaveBeenCalled()
      // Control: one selector passes validation and reaches the (stubbed) estimator with that single model.
      await expect(dispatchNativeCli(['comic', 'generate-images', 'script.md', '--provider', 'gemini', '--price'], root, COMMAND_DEFINITIONS))
        .rejects.toThrow('estimator must not run')
      expect(estimator).toHaveBeenCalledTimes(1)
      expect(estimator.mock.calls[0]![0]).toMatchObject({ imageModel: expect.stringMatching(/^gemini-/) })
    } finally { estimator.mockRestore() }
  })
})

describe('review candidate selection', () => {
  test('--use requires --run and --panels requires --use', async () => {
    await rejectsBeforeDispatch(['comic', 'review', 'script.md', '--use'], '--use requires --run <image-run-id>')
    await rejectsBeforeDispatch(['comic', 'review', 'script.md', '--use', '--panels', '3'], '--use requires --run <image-run-id>')
    await rejectsBeforeDispatch(['comic', 'review', 'script.md', '--panels', '3'], '--panels requires --run <image-run-id> --use')
    await rejectsBeforeDispatch(['comic', 'review', 'script.md', '--run', 'run-b', '--panels', '3'], '--panels requires --run <image-run-id> --use')
  })

  test('review --run X --use --panels 3 parses to an explicit single-panel adoption', () => {
    const parsed = parse(['comic', 'review', 'script.md', '--run', 'run-b', '--use', '--panels', '3'])
    expect(parsed).toMatchObject({ scriptPath: 'script.md', run: 'run-b', use: true, panels: [3] })
    expect(parse(['comic', 'review', 'script.md', '--run', 'run-b'])).toMatchObject({ run: 'run-b' })
    expect(parse(['comic', 'review', 'script.md', '--run', 'run-b']).use).toBeUndefined()
    expect(parse(['comic', 'review', 'script.md', '--run', 'run-b', '--use'])).not.toHaveProperty('panels')
  })
})

function parse(argv: string[]) {
  const parsed = parseNativeCli(argv, [instrumentedComic], root.globalFlags)
  return coerceAndValidateReview({ flags: parsed.flags, parameters: parsed.parameters, rawParsed: parsed.rawParsed })
}
