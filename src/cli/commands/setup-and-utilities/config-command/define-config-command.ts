import { defineCliCommand } from '~/cli/native/native-types'
import { configCommandFlags } from '~/cli/flags/config-flags'
import { resolveConfigPath, loadConfig } from './config-loader'
import { buildConfigPatchFromFlags, deepMergeConfig } from './config-merge'
import { writeConfig } from './config-writer'
import * as l from '~/utils/app-logger/app-logger'
import { normalizeGenericTtsOptionFlags } from '~/cli/flags/service-selector-normalization/generic-tts-option-selectors'
import { normalizeConfigStepSelectorFlags } from '~/cli/flags/service-selector-normalization/step-selectors'

export const configCommand = defineCliCommand({
  name: 'config',
  description: 'View or set default CLI options saved to config/autoshow.json',
  flags: configCommandFlags,
  help: {
    examples: [
      ['bun autoshow config --show', 'Print current config'],
      ['bun autoshow config --llm openai=gpt-5.4-mini --stt whisper=base', 'Set default LLM and STT model'],
      ['bun autoshow config --cookies-from-browser chrome', 'Persist YouTube browser-cookie import'],
      ['bun autoshow config --reset', 'Clear all saved config']
    ]
  }
}, async (ctx) => {
  const flags = ctx.flags
  const configPathOverride = typeof flags['config-path'] === 'string' ? flags['config-path'] : undefined
  const resolvedPath = await resolveConfigPath(configPathOverride)

  if (flags['show'] === true) {
    const config = await loadConfig(resolvedPath)
    l.report.result(
      { configPath: resolvedPath, config },
      { message: 'Config', category: 'command' }
    )
    return
  }

  if (flags['reset'] === true) {
    await writeConfig(resolvedPath, {})
    l.write('success', `Config reset: ${resolvedPath}`, { category: 'command', metadata: { configPath: resolvedPath } })
    return
  }

  const selectorNormalized = normalizeConfigStepSelectorFlags(
    flags as Record<string, unknown>,
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

  if (Object.keys(patch).length === 0) {
    l.write('info', `No changes to write. Config path: ${resolvedPath}`, { category: 'command', metadata: { configPath: resolvedPath } })
    l.write('info', 'Use --show to print current config or --reset to clear it.', { category: 'command' })
    return
  }

  const current = await loadConfig(resolvedPath)
  const updated = deepMergeConfig(current as Record<string, unknown>, patch)
  await writeConfig(resolvedPath, updated)
  l.write('success', `Config saved to ${resolvedPath}`, { category: 'command', metadata: { configPath: resolvedPath } })
})
