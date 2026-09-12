import { SETUP_FOCUSED_MODE_FLAGS, SETUP_NETWORK_DEPENDENT_FLAGS, SETUP_MODE_NOTES } from '~/cli/flags/setup-mode-contract'
import { runNetworkCheck } from './network-check'
import { defineCliCommand } from '~/cli/native/native-types'
import { setupFlags } from '~/cli/flags/setup-flags'
import { UsageError, InfraError } from '~/utils/error-handler'
import { runCompleteSetup, runSetupStep } from './run-complete-setup'
import { runDoctor } from './run-doctor'
import { runModelDownloads } from '~/cli/commands/setup-and-utilities/models/run-model-downloads'
import * as l from '~/utils/app-logger/app-logger'
import { runWithLogContext } from '~/utils/app-logger/app-logger'
import type { SetupStepId } from '~/types'
import { resolveConfigPath, loadConfig } from '../config-command/config-loader'
import { buildConfigPatchFromFlags, deepMergeConfig } from '../config-command/config-merge'
import { writeConfig } from '../config-command/config-writer'
import { normalizeGenericTtsOptionFlags } from '~/cli/flags/service-selector-normalization/generic-tts-option-selectors'
import { normalizeConfigStepSelectorFlags } from '~/cli/flags/service-selector-normalization/step-selectors'

const VALID_SETUP_STEPS: SetupStepId[] = ['yt-dlp', 'defuddle', 'whisperfile', 'calibre', 'all', 'transcription', 'music']
const FOCUSED_SETUP_CONFLICT_FLAGS = SETUP_FOCUSED_MODE_FLAGS

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
  description: 'Install local dependencies, required tools, and default configuration',
  flags: setupFlags,
  help: {
    beforeFlags: SETUP_MODE_NOTES,
    examples: [
      ['bun autoshow setup', 'Install all dependencies'],
      ['bun autoshow setup --show', 'Print current config'],
      ['bun autoshow setup --llm openai=gpt-5.4-mini --stt whisperfile=small', 'Set default LLM and STT model'],
      ['bun autoshow setup --models tiny.en --models whisperfile:small', 'Download whisperfile models without running inference'],
      ['bun autoshow setup --step whisperfile', 'Download the default whisperfile model (tiny)'],
      ['bun autoshow setup --network-check serve --port 8787', 'Serve a local diagnostic fixture'],
      ['bun autoshow setup --doctor', 'Check prerequisites without installing'],
      ['bun autoshow setup --cookies-from-browser chrome', 'Persist YouTube browser-cookie import'],
      ['bun autoshow setup --step defuddle', 'Install the managed Defuddle CLI'],
      ['bun autoshow setup --step whisperfile --force-redownload', 'Reinstall the default whisperfile bundle'],
      ['bun autoshow setup --reset', 'Clear all saved config']
    ]
  }
}, async (ctx) => {
  if (ctx.flags['network-check'] !== undefined) {
    for (const flag of [...FOCUSED_SETUP_CONFLICT_FLAGS, 'price']) if (ctx.rawParsed.explicitFlags.has(flag)) throw UsageError(`--network-check cannot be combined with --${flag}`)
    await runNetworkCheck(ctx.flags)
    return
  }
  for (const flag of SETUP_NETWORK_DEPENDENT_FLAGS) if (ctx.rawParsed.explicitFlags.has(flag)) throw UsageError(`--${flag} requires --network-check`)

  if (ctx.flags['show'] === true && ctx.flags['reset'] === true) {
    throw UsageError('--show cannot be combined with --reset')
  }

  const configPathOverride = typeof ctx.flags['config-path'] === 'string' ? ctx.flags['config-path'] : undefined

  if (ctx.flags['show'] === true) {
    for (const flag of ['models', 'doctor', 'strict', 'step', 'force-redownload']) {
      if (ctx.rawParsed.explicitFlags.has(flag)) throw UsageError(`--show cannot be combined with --${flag}`)
    }
    const resolvedPath = await resolveConfigPath(configPathOverride)
    const config = await loadConfig(resolvedPath)
    l.report.result({ configPath: resolvedPath, config }, 'Config')
    return
  }

  if (ctx.flags['reset'] === true) {
    for (const flag of ['models', 'doctor', 'strict', 'step', 'force-redownload']) {
      if (ctx.rawParsed.explicitFlags.has(flag)) throw UsageError(`--reset cannot be combined with --${flag}`)
    }
    const resolvedPath = await resolveConfigPath(configPathOverride)
    await writeConfig(resolvedPath, {})
    l.report.result({ configPath: resolvedPath, config: {}, changed: true }, 'Config reset')
    return
  }

  const selectorNormalized = normalizeConfigStepSelectorFlags(
    ctx.flags as Record<string, unknown>,
    ctx.rawParsed.explicitFlags,
    ctx.rawParsed.flagOccurrences
  )
  const ttsNormalized = normalizeGenericTtsOptionFlags(
    selectorNormalized.flags,
    selectorNormalized.explicitFlags,
    selectorNormalized.flagOccurrences
  )
  const patch = buildConfigPatchFromFlags(
    ttsNormalized.flags,
    ttsNormalized.explicitFlags,
    ttsNormalized.flagOccurrences
  )

  if (Object.keys(patch).length > 0) {
    for (const flag of ['models', 'doctor', 'strict', 'step', 'force-redownload']) {
      if (ctx.rawParsed.explicitFlags.has(flag)) {
        throw UsageError(`Configuring defaults cannot be combined with setup installation or diagnostics (--${flag})`)
      }
    }
    const resolvedPath = await resolveConfigPath(configPathOverride)
    const current = await loadConfig(resolvedPath)
    const updated = deepMergeConfig(current as Record<string, unknown>, patch)
    await writeConfig(resolvedPath, updated)
    l.report.result({ configPath: resolvedPath, config: updated, changed: true }, 'Config saved')
    return
  }

  if (ctx.calledAs === 'config') {
    const resolvedPath = await resolveConfigPath(configPathOverride)
    l.write('info', `No changes to write. Config path: ${resolvedPath}`, { category: 'command', metadata: { configPath: resolvedPath } })
    l.write('info', 'Use --show to print current config or --reset to clear it.', { category: 'command' })
    l.report.result({ configPath: resolvedPath, changed: false }, 'No config changes')
    return
  }
  const usedModelsFlag = ctx.rawParsed.explicitFlags.has('models')
  const modelTargets = normalizeStringArrayFlag(ctx.flags.models)

  if (usedModelsFlag && modelTargets.length === 0) {
    throw UsageError('--models requires at least one value')
  }
  if (usedModelsFlag) {
    const modeFlag = 'models'
    const conflicts = FOCUSED_SETUP_CONFLICT_FLAGS
      .filter((flag) => flag !== modeFlag && ctx.rawParsed.explicitFlags.has(flag))
      .map((flag) => `--${flag}`)
    if (conflicts.length > 0) {
      throw UsageError(`--${modeFlag} cannot be combined with ${conflicts.join(', ')}`)
    }
  }

  if (usedModelsFlag) {
    await runWithLogContext({ step: 'setup' }, async () => {
      await runModelDownloads(modelTargets)
    })
    l.report.result({ mode: 'models', models: modelTargets }, 'Setup models complete')
    return
  }

  if (ctx.flags['strict'] === true && !ctx.flags.doctor) {
    throw UsageError('--strict requires --doctor')
  }

  if (ctx.flags.doctor) {
    const report = await runDoctor({ strict: ctx.flags['strict'] === true })
    l.report.result({ mode: 'doctor', report }, report.hasWarnings ? 'Setup doctor completed with warnings' : 'Setup doctor complete')
    return
  }

  const step = ctx.flags.step as string
  if (!VALID_SETUP_STEPS.includes(step as SetupStepId)) {
    throw UsageError(`Invalid --step value: ${step}. Valid values: ${VALID_SETUP_STEPS.join(', ')}`)
  }

  const healthy = await runWithLogContext({ step: 'setup' }, async () => {
    if (step === 'all' && !ctx.flags['force-redownload']) {
      return await runCompleteSetup()
    }
    return await runSetupStep(step as SetupStepId, {
      ...(ctx.flags['force-redownload'] ? { forceRedownload: true } : {})
    })
  })

  if (!healthy) {
    throw InfraError('Setup finished with missing local tools or models. See the Setup Summary above, then run: bun autoshow setup --doctor', {
      stage: 'setup:run',
      hints: ['Run `bun autoshow setup --doctor` for per-check detail']
    })
  }

  l.report.result({ mode: 'setup', step, healthy }, 'Setup complete')
})
