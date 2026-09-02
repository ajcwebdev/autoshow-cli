import { expect, test } from 'bun:test'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { commandAcceptsGlobalFlag, globalFlagsForCommand } from '~/cli/native/global-flag-support'
import { commandCreatesRunDirectory } from '~/cli/native/run-directory-support'
import { runCommand } from '../../../../test-utils/test-helpers'
import {
  GEMINI_IMAGE_RESPONSE_MODES,
  GEMINI_IMAGE_SIZE_VALUES
} from '~/cli/commands/process-steps/step-5-image/image-generation-services/image-gemini/gemini-image-targets'
import {
  OPENAI_FIXED_IMAGE_SIZE_VALUES,
  OPENAI_IMAGE_BACKGROUND_VALUES
} from '~/cli/commands/process-steps/step-5-image/image-generation-services/image-openai/openai-image-targets'
import {
  GEMINI_VIDEO_RESOLUTIONS,
  GROK_VIDEO_ASPECT_RATIOS,
  LUMA_ASPECT_RATIOS,
  LUMA_RESOLUTIONS,
  REPLICATE_VIDEO_RESOLUTIONS
} from '~/cli/commands/process-steps/step-6-video/video-utils/video-normalization'
import { URL_ARTICLE_BACKENDS } from '~/cli/commands/process-steps/step-2-extract/step-2-shared/provider-registry'
import {
  STANDALONE_VIDEO_PROVIDER_TARGETS,
  WRITE_LLM_PROVIDER_TARGETS,
  WRITE_OCR_PROVIDER_TARGETS
} from '~/cli/flags/service-selector-normalization/provider-targets'
import { PDF_CHAPTER_MODES } from '~/cli/options/option-resolution/flag-readers'
import { LOG_FORMAT_CHOICES } from '~/utils/app-logger/app-logger'
import {
  IMAGE_GENERATION_QUALITIES,
  LOG_LEVELS,
  OUTPUT_FORMATS,
  RUNTIME_TOOL_IDS,
  SETUP_STEP_IDS,
  VIDEO_MODES
} from '~/types'
import { SUPPORTED_WHISPER_MODELS } from '~/cli/commands/setup-and-utilities/models/setup-model-options'
import {
  HELP_TREE_TIMEOUT_MS,
  advertisedFlagNames,
  getCommandFlagsSection,
  helpArgv,
  helpEnv,
  helpSurfaces,
  loadHelp,
  visibleFlagNames
} from './shared'

export const registerGlobalFlagAndRegistryCases = (): void => {
  test.concurrent('provider help lists are derived from the supported selector registries', async () => {
    const [extract, write, config, resume, tts] = await Promise.all([
      loadHelp(['extract', '--help']),
      loadHelp(['write', '--help']),
      loadHelp(['config', '--help']),
      loadHelp(['resume', '--help']),
      loadHelp(['tts', '--help'])
    ])

    const urlBackends = URL_ARTICLE_BACKENDS.join('|')
    const llmProviders = Object.keys(WRITE_LLM_PROVIDER_TARGETS).join('|')
    const videoProviders = Object.keys(STANDALONE_VIDEO_PROVIDER_TARGETS).join('|')

    expect(extract.stdout).toContain('whisperfile')
    expect(extract.stdout).toContain(urlBackends)
    expect(write.stdout).toContain(llmProviders)
    expect(write.stdout).toContain('(default: cheapest hosted)')
    expect(write.stdout).not.toContain('--stt')
    expect(config.stdout).toContain(llmProviders)
    expect(config.stdout).toContain('(default: cheapest hosted)')
    expect(config.stdout).toMatch(/--stt[^\n]*whisperfile/)
    expect(resume.stdout).toContain(`URL: ${urlBackends}`)
    expect(resume.stdout).toContain(`video: ${videoProviders}`)
    expect(resume.stdout).toContain('(default: cheapest hosted)')
    expect(tts.stdout).toContain('repeatable (default: cheapest hosted)')
  })

  const derivedHelpLists = [
    { command: 'video', label: '--mode', values: VIDEO_MODES },
    { command: 'video', label: '--aspect-ratio (Luma Labs)', values: LUMA_ASPECT_RATIOS },
    { command: 'video', label: '--aspect-ratio (Grok)', values: GROK_VIDEO_ASPECT_RATIOS },
    { command: 'video', label: '--resolution (Gemini)', values: GEMINI_VIDEO_RESOLUTIONS },
    { command: 'video', label: '--resolution (Replicate)', values: REPLICATE_VIDEO_RESOLUTIONS },
    { command: 'video', label: '--resolution (Luma Labs)', values: LUMA_RESOLUTIONS },
    { command: 'image', label: '--quality', values: IMAGE_GENERATION_QUALITIES },
    { command: 'image', label: '--size (Gemini)', values: GEMINI_IMAGE_SIZE_VALUES },
    { command: 'image', label: '--size (OpenAI)', values: OPENAI_FIXED_IMAGE_SIZE_VALUES },
    { command: 'image', label: '--background', values: OPENAI_IMAGE_BACKGROUND_VALUES },
    { command: 'image', label: '--response-mode', values: GEMINI_IMAGE_RESPONSE_MODES },
    { command: 'setup', label: '--step', values: SETUP_STEP_IDS },
    { command: 'extract', label: '--format', values: OUTPUT_FORMATS },
    { command: 'extract', label: '--pdf-chapter-mode', values: PDF_CHAPTER_MODES },
    { command: 'extract', label: '--provider URL backends', values: URL_ARTICLE_BACKENDS },
    { command: 'metadata', label: '--url-provider', values: URL_ARTICLE_BACKENDS },
    { command: 'download', label: '--url-provider', values: URL_ARTICLE_BACKENDS },
    { command: 'extract', label: '--primary-ocr', values: Object.keys(WRITE_OCR_PROVIDER_TARGETS) },
    { command: 'music', label: '--model', values: SUPPORTED_WHISPER_MODELS }
  ] as const

  test.concurrent('every derived help list documents each value its validator accepts', async () => {
    const helpByCommand = new Map<string, string>()
    for (const command of [...new Set(derivedHelpLists.map((entry) => entry.command))]) {
      const result = await loadHelp([command, '--help'])
      expect(result.exitCode).toBe(0)
      helpByCommand.set(command, result.stdout)
    }

    const missing: string[] = []
    for (const entry of derivedHelpLists) {
      const help = helpByCommand.get(entry.command) as string
      for (const value of entry.values) {
        if (!help.includes(String(value))) {
          missing.push(`${entry.command} ${entry.label}: ${String(value)}`)
        }
      }
    }

    expect(missing).toEqual([])
  })

  test.concurrent('global help lists are derived from the logger and runtime tool registries', async () => {
    const result = await loadHelp(['--help'])

    expect(result.stdout).toContain(LOG_LEVELS.join('|'))
    expect(result.stdout).toContain(LOG_FORMAT_CHOICES.join('|'))
    for (const tool of RUNTIME_TOOL_IDS) {
      expect(result.stdout).toContain(tool)
    }
  })

  test.concurrent('every run-producing command exposes the global deterministic output directory flag', async () => {
    for (const command of helpSurfaces.filter((entry) => commandCreatesRunDirectory(entry.name))) {
      const result = await loadHelp(helpArgv(command.name))

      expect(result.exitCode).toBe(0)
      const globalFlagsSection = result.stdout.slice(result.stdout.indexOf('\nGlobal Flags\n'))
      expect(globalFlagsSection).toContain('--output-dir')
      expect(result.stdout).not.toMatch(/--out(?:\s|$)/)
    }

    const resumeResult = await runCommand(
      ['src/cli/create-cli.ts', 'resume', 'output/does-not-exist', '--output-dir', 'output/nope'],
      { env: helpEnv }
    )
    expect(resumeResult.exitCode).toBe(2)
    expect(`${resumeResult.stdout}\n${resumeResult.stderr}`).toContain('--output-dir is not supported by "resume"')

    const writeResult = await loadHelp(['write', '--help'])
    expect(writeResult.exitCode).toBe(0)
    expect(writeResult.stdout).not.toContain('Output format: text|json')
    expect(writeResult.stdout).not.toContain('Alias for --output-dir')
  }, HELP_TREE_TIMEOUT_MS)

  test.concurrent('command help hides --output-dir when the command cannot create a run directory', async () => {
    for (const command of helpSurfaces.filter((entry) => !commandCreatesRunDirectory(entry.name))) {
      const result = await loadHelp(helpArgv(command.name))
      expect(result.exitCode).toBe(0)
      const globalFlagsSection = result.stdout.slice(result.stdout.indexOf('\nGlobal Flags\n'))
      expect(globalFlagsSection).toContain('--output-root')
      expect(globalFlagsSection).not.toContain('--output-dir')
    }

    for (const command of helpSurfaces.filter((entry) => commandCreatesRunDirectory(entry.name))) {
      const result = await loadHelp(helpArgv(command.name))
      expect(result.exitCode).toBe(0)
      const globalFlagsSection = result.stdout.slice(result.stdout.indexOf('\nGlobal Flags\n'))
      expect(globalFlagsSection).toContain('--output-dir')
      expect(globalFlagsSection).toContain('--output-root')
    }

    const root = await loadHelp(['--help'])
    expect(root.stdout).toContain('--output-dir')
  }, HELP_TREE_TIMEOUT_MS)

  test.concurrent('commandAcceptsGlobalFlag keeps universal flags and restricts characters-root', () => {
    expect(commandAcceptsGlobalFlag('config', 'output-root')).toBe(true)
    expect(commandAcceptsGlobalFlag('config', 'verbose')).toBe(true)
    expect(commandAcceptsGlobalFlag('config', 'bin-dir')).toBe(true)
    expect(commandAcceptsGlobalFlag('config', 'output-dir')).toBe(false)
    expect(commandAcceptsGlobalFlag('write', 'output-dir')).toBe(true)
    expect(commandAcceptsGlobalFlag('links', 'output-dir')).toBe(true)
    expect(commandAcceptsGlobalFlag('voice', 'characters-root')).toBe(true)
    expect(commandAcceptsGlobalFlag('comic', 'characters-root')).toBe(true)
    expect(commandAcceptsGlobalFlag('voice clone', 'characters-root')).toBe(true)
    expect(commandAcceptsGlobalFlag('comic draft-scenes', 'characters-root')).toBe(true)
    expect(commandAcceptsGlobalFlag('extract', 'characters-root')).toBe(false)
    expect(commandAcceptsGlobalFlag('config', 'characters-root')).toBe(false)
    expect(commandAcceptsGlobalFlag('download', 'allow-over-budget')).toBe(true)
    expect(commandAcceptsGlobalFlag('extract', 'allow-over-budget')).toBe(true)
    expect(commandAcceptsGlobalFlag('write', 'allow-over-budget')).toBe(true)
    expect(commandAcceptsGlobalFlag('tts', 'allow-over-budget')).toBe(true)
    expect(commandAcceptsGlobalFlag('image', 'allow-over-budget')).toBe(true)
    expect(commandAcceptsGlobalFlag('video', 'allow-over-budget')).toBe(true)
    expect(commandAcceptsGlobalFlag('music', 'allow-over-budget')).toBe(true)
    expect(commandAcceptsGlobalFlag('comic draft-scenes', 'allow-over-budget')).toBe(true)
    expect(commandAcceptsGlobalFlag('config', 'allow-over-budget')).toBe(false)
    expect(commandAcceptsGlobalFlag('setup', 'allow-over-budget')).toBe(false)
    expect(commandAcceptsGlobalFlag('links', 'allow-over-budget')).toBe(false)
    expect(commandAcceptsGlobalFlag('voice', 'allow-over-budget')).toBe(false)
    expect(commandAcceptsGlobalFlag('voice clone', 'allow-over-budget')).toBe(false)
    expect(commandAcceptsGlobalFlag('comic reference-voice', 'allow-over-budget')).toBe(false)
  })

  test.concurrent('command help hides --allow-over-budget on unbudgeted commands', async () => {
    for (const command of ['download', 'extract', 'write', 'tts', 'image', 'video', 'music', 'comic draft-scenes']) {
      const result = await loadHelp(helpArgv(command))
      expect(result.exitCode).toBe(0)
      const globalFlagsSection = result.stdout.slice(result.stdout.indexOf('\nGlobal Flags\n'))
      expect(globalFlagsSection).toContain('--allow-over-budget')
    }

    for (const command of ['config', 'setup', 'links', 'voice', 'comic reference-voice']) {
      const result = await loadHelp(helpArgv(command))
      expect(result.exitCode).toBe(0)
      const globalFlagsSection = result.stdout.slice(result.stdout.indexOf('\nGlobal Flags\n'))
      expect(globalFlagsSection).not.toContain('--allow-over-budget')
      expect(globalFlagsSection).toContain('--output-root')
    }

    const root = await loadHelp(['--help'])
    expect(root.stdout).toContain('--allow-over-budget')
  }, HELP_TREE_TIMEOUT_MS)

  test.concurrent('command help does not advertise --model-path', async () => {
    for (const command of ['write', 'resume', 'tts', 'config', 'extract', 'voice', 'comic']) {
      const result = await loadHelp(helpArgv(command))
      expect(result.exitCode).toBe(0)
      expect(result.stdout).not.toContain('--model-path')
    }

    const root = await loadHelp(['--help'])
    expect(root.stdout).not.toContain('--model-path')
  }, HELP_TREE_TIMEOUT_MS)

  test.concurrent('command help hides --characters-root outside voice and comic', async () => {
    for (const command of ['voice', 'comic', 'comic draft-scenes']) {
      const result = await loadHelp(helpArgv(command))
      expect(result.exitCode).toBe(0)
      const globalFlagsSection = result.stdout.slice(result.stdout.indexOf('\nGlobal Flags\n'))
      expect(globalFlagsSection).toContain('--characters-root')
    }

    for (const command of ['extract', 'config', 'write']) {
      const result = await loadHelp(helpArgv(command))
      expect(result.exitCode).toBe(0)
      const globalFlagsSection = result.stdout.slice(result.stdout.indexOf('\nGlobal Flags\n'))
      expect(globalFlagsSection).not.toContain('--characters-root')
      expect(globalFlagsSection).toContain('--output-root')
    }

    const root = await loadHelp(['--help'])
    expect(root.stdout).toContain('--characters-root')
    expect(root.stdout).toContain('--output-root')
  }, HELP_TREE_TIMEOUT_MS)

  test.concurrent('cookie flags appear on config help and leave the global surface', async () => {
    const config = await loadHelp(['config', '--help'])
    expect(config.exitCode).toBe(0)
    expect(getCommandFlagsSection(config.stdout)).toContain('--cookies')
    expect(getCommandFlagsSection(config.stdout)).toContain('--cookies-from-browser')
    expect(getCommandFlagsSection(config.stdout)).toContain('Auth')

    for (const command of ['download', 'extract', 'write']) {
      const result = await loadHelp(helpArgv(command))
      expect(result.exitCode).toBe(0)
      expect(result.stdout).not.toContain('--cookies-from-browser')
      expect(result.stdout).not.toMatch(/--cookies(?!-)/)
    }

    const root = await loadHelp(['--help'])
    expect(root.stdout).not.toContain('--cookies-from-browser')
    expect(root.stdout).not.toMatch(/--cookies(?!-)/)
    expect(root.stdout).toContain('--output-root')
  }, HELP_TREE_TIMEOUT_MS)

  test.concurrent('every help page advertises exactly the flags registered for that command', async () => {
    for (const command of helpSurfaces) {
      const result = await loadHelp(helpArgv(command.name))
      expect(result.exitCode).toBe(0)
      expect(advertisedFlagNames(getCommandFlagsSection(result.stdout)).sort()).toEqual(visibleFlagNames(command.flags))

      const globalFlagsSection = result.stdout.slice(result.stdout.indexOf('\nGlobal Flags\n'))
      const expectedGlobals = visibleFlagNames(globalFlagsForCommand(GLOBAL_FLAG_DEFINITIONS, command.name))
      expect(advertisedFlagNames(globalFlagsSection).sort()).toEqual(expectedGlobals)
    }
  }, HELP_TREE_TIMEOUT_MS)
}
