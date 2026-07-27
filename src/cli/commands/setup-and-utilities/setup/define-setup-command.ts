import { defineCliCommand } from '~/cli/native/native-types'
import { setupFlags } from '~/cli/flags/setup-flags'
import { CLIUsageError, InfraError } from '~/utils/error-handler'
import { runCompleteSetup, runSetupStep } from './run-complete-setup'
import { runDoctor } from './run-doctor'
import { runModelDownloads } from '~/cli/commands/setup-and-utilities/models/run-model-downloads'
import * as l from '~/utils/app-logger/app-logger'
import { runWithLogContext } from '~/utils/app-logger/app-logger'
import type { SetupStepId } from '~/types'

const VALID_SETUP_STEPS: SetupStepId[] = ['uv', 'yt-dlp', 'defuddle', 'whisper-binary', 'whisper-model', 'whisperfile', 'llama-binary', 'llamafile', 'reverb', 'calibre', 'acsm', 'acsm-authorize', 'all', 'transcription', 'write', 'tts', 'image', 'video', 'music']
const FOCUSED_SETUP_CONFLICT_FLAGS = [
  '--models',
  '--doctor',
  '--step',
  '--force-redownload',
  '--repeat'
] as const

const hasLongFlag = (argv: string[], flag: string): boolean =>
  argv.some((token) => token === flag || token.startsWith(`${flag}=`))

const getUsedLongFlags = (argv: string[], flags: readonly string[]): string[] =>
  flags.filter((flag) => hasLongFlag(argv, flag))

const normalizeStringArrayFlag = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? [trimmed] : []
  }
  return []
}

export const setupCommand = defineCliCommand({
  name: 'setup',
  description: 'Install local dependencies and required tools',
  flags: setupFlags,
  help: {
    examples: [
      ['bun autoshow setup', 'Install all dependencies'],
      ['bun autoshow setup --models base --models ggml-org/gemma-3-270m-it-GGUF', 'Download Whisper and llama.cpp models without running inference'],
      ['bun autoshow setup --models whisperfile:small --models llamafile:Qwen3.5-2B-Q8_0', 'Download specific whisperfile/llamafile bundles'],
      ['bun autoshow setup --step whisperfile', 'Download the default whisperfile model (tiny)'],
      ['bun autoshow setup --step llamafile', 'Download the default llamafile bundle (Qwen3.5-0.8B-Q8_0)'],
      ['bun autoshow setup --doctor', 'Check prerequisites without installing'],
      ['bun autoshow setup --step defuddle', 'Install the managed Defuddle CLI'],
      ['bun autoshow setup --step acsm', 'Install ACSM fulfillment support'],
      ['bun autoshow setup --step acsm-authorize', 'Authorize ACSM fulfillment interactively'],
      ['bun autoshow setup --step whisper-binary --force-redownload', 'Reinstall whisper binary']
    ]
  }
}, async (ctx) => {
  const rawArgv = Bun.argv.slice(2)
  const usedModelsFlag = hasLongFlag(rawArgv, '--models')
  const modelTargets = normalizeStringArrayFlag(ctx.flags.models)

  if (usedModelsFlag && modelTargets.length === 0) {
    throw CLIUsageError('--models requires at least one value')
  }
  if (usedModelsFlag) {
    const modeFlag = '--models'
    const conflicts = getUsedLongFlags(
      rawArgv,
      FOCUSED_SETUP_CONFLICT_FLAGS.filter((flag) => flag !== modeFlag)
    )
    if (conflicts.length > 0) {
      throw CLIUsageError(`${modeFlag} cannot be combined with ${conflicts.join(', ')}`)
    }
  }

  if (usedModelsFlag) {
    await runWithLogContext({ step: 'setup' }, async () => {
      await runModelDownloads(modelTargets)
    })
    return
  }

  if (ctx.flags.doctor) {
    await runDoctor()
    return
  }

  const step = ctx.flags.step as string
  if (!VALID_SETUP_STEPS.includes(step as SetupStepId)) {
    throw CLIUsageError(`Invalid --step value: ${step}. Valid values: ${VALID_SETUP_STEPS.join(', ')}`)
  }

  const repeatRaw = parseInt(ctx.flags.repeat as string, 10)
  if (!Number.isFinite(repeatRaw) || repeatRaw < 1) {
    throw CLIUsageError(`Invalid --repeat value: ${ctx.flags.repeat}. Must be an integer >= 1`)
  }

  const healthy = await runWithLogContext({ step: 'setup' }, async () => {
    if (step === 'all' && !ctx.flags['force-redownload'] && repeatRaw === 1) {
      return await runCompleteSetup()
    }
    return await runSetupStep(step as SetupStepId, {
      ...(ctx.flags['force-redownload'] ? { forceRedownload: true } : {}),
      ...(repeatRaw > 1 ? { repeat: repeatRaw } : {})
    })
  })

  // An unconditional success line meant a run that ended with missing tools or
  // models still reported "Setup complete" and exited 0, so `bun autoshow setup` could
  // not be used as a gate in CI or a scripted install.
  if (!healthy) {
    throw InfraError('Setup finished with missing local tools or models. See the Setup Summary above, then run: bun autoshow setup --doctor', {
      stage: 'setup:run',
      hints: ['Run `bun autoshow setup --doctor` for per-check detail']
    })
  }

  l.write('success', 'Setup complete')
})
