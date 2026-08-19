import { expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { HELP_EXAMPLE_ALIGN_COLUMN_CAP } from '~/cli/native/help-renderer'
import { colorizeHelpDescription } from '~/cli/help-colors'
import { configureColor, stripAnsi } from '~/utils/terminal-colors'
import { runCommand } from '../../../../test-utils/test-helpers'
import {
  HELP_TREE_TIMEOUT_MS,
  comicSubcommands,
  getSection,
  helpArgv,
  helpEnv,
  helpSurfaces,
  loadHelp,
  removedSetupCommand
} from './shared'

export const registerRootRenderingCases = (): void => {
  test.concurrent('root help groups setup utilities separately from processing commands', async () => {
    const result = await loadHelp(['--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Extract and write content, manage voices, generate speech, images, video, and music, and build comic workflows')

    const setupSection = getSection(result.stdout, '  Setup & Utilities\n', '  Processing & Generation\n')
    const processingSection = getSection(result.stdout, '  Processing & Generation\n')

    expect(setupSection).toContain('    links')
    expect(setupSection).toContain('    setup')
    expect(setupSection).toContain('    resume')
    expect(setupSection).not.toContain(`    ${removedSetupCommand}`)
    expect(setupSection).not.toContain('    cache')
    expect(processingSection).toContain('    write')
    expect(processingSection.indexOf('    video')).toBeLessThan(processingSection.indexOf('    music'))
    expect(processingSection).not.toContain('    lyrics')
    expect(processingSection).not.toContain('    stt')
    expect(processingSection).not.toContain('    ocr')
    expect(processingSection).not.toContain('    links')
    expect(processingSection).not.toContain('    resume')
  })

  test.concurrent('every registered command and subcommand renders help with its public usage', async () => {
    expect(helpSurfaces.map((command) => command.name)).toEqual(
      expect.arrayContaining(comicSubcommands.map((subcommand) => `comic ${subcommand}`))
    )

    for (const command of helpSurfaces) {
      const result = await loadHelp(helpArgv(command.name))
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain(`$ bun autoshow ${command.name}`)
    }

    const links = await loadHelp(['links', '--help'])
    const video = await loadHelp(['video', '--help'])
    const help = await loadHelp(['help', '--help'])
    expect(links.stdout).toContain('$ bun autoshow links [selection...] [flags]')
    expect(video.stdout).toContain('$ bun autoshow video <input> [flags]')
    expect(help.stdout).toContain('$ bun autoshow help [command] [flags]')
    expect(help.stdout).not.toContain('[command...]')
  }, HELP_TREE_TIMEOUT_MS)

  test.concurrent('links help includes models selector example', async () => {
    const result = await loadHelp(['links', '--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('bun autoshow links models')
    expect(result.stdout).toContain('Fetch model documentation across every provider')
    expect(result.stdout).toContain('--refresh')
    expect(result.stdout).toContain('Write refresh metadata sidecar')
  })


  test.concurrent('off-by-default boolean flags do not render [default: false] in help output', async () => {
    const root = await loadHelp(['--help'])
    expect(root.exitCode).toBe(0)
    expect(root.stdout).not.toContain('[default: false]')

    for (const command of helpSurfaces) {
      const result = await loadHelp(helpArgv(command.name))
      expect(result.exitCode).toBe(0)
      expect(result.stdout).not.toContain('[default: false]')
    }
  })

  test('colorizeHelpDescription paints prose default values with terminal colors when enabled', () => {
    try {
      configureColor('force')
      const colorized = colorizeHelpDescription('Path to config file (default: config/autoshow.json in project root)')
      expect(colorized).toContain('\x1b[')
      expect(stripAnsi(colorized)).toBe('Path to config file (default: config/autoshow.json in project root)')

      configureColor('disable')
      const uncolored = colorizeHelpDescription('Path to config file (default: config/autoshow.json in project root)')
      expect(uncolored).not.toContain('\x1b[')
      expect(uncolored).toBe('Path to config file (default: config/autoshow.json in project root)')
    } finally {
      configureColor('auto')
    }
  })


  test.concurrent('root help uses imperative version wording', async () => {
    const result = await loadHelp(['--help'])

    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Print current version')
    expect(result.stdout).not.toContain('Prints current version')
  })


  test.concurrent('help output has no whitespace-only lines and caps wide example columns', async () => {
    const surfaces: string[][] = [
      ['--help'],
      ...helpSurfaces.map((command) => helpArgv(command.name))
    ]

    for (const args of surfaces) {
      const result = await loadHelp(args)
      expect(result.exitCode).toBe(0)
      expect(result.stdout.split('\n').filter((line) => line.length > 0 && line.trim() === '')).toEqual([])
    }

    const voice = await loadHelp(['voice', '--help'])
    const description = 'Register an existing ElevenLabs voice'
    const descriptionLine = voice.stdout.split('\n').find((line) => line.includes(description))
    expect(descriptionLine).toBeDefined()
    expect(descriptionLine!.indexOf(description)).toBeLessThanOrEqual(HELP_EXAMPLE_ALIGN_COLUMN_CAP)
  }, HELP_TREE_TIMEOUT_MS)


  test.concurrent('retained benchmark fixtures stay in place', async () => {
    const setup = await loadHelp(['setup', '--help'])
    expect(setup.stdout).not.toContain('--repeat')

    expect(existsSync(resolve('docs/benchmarks'))).toBe(true)
    expect(existsSync(resolve('.claude/skills/consensus'))).toBe(true)
    expect(existsSync(resolve('src/utils/voice-quality-scoring.ts'))).toBe(false)
  })

  test('CLI help spawn smoke covers exit codes and the real help tree', async () => {
    const root = await runCommand(['src/cli/create-cli.ts', '--help'], { env: helpEnv })
    expect(root.exitCode).toBe(0)
    expect(root.stdout).toContain('Extract and write content, manage voices, generate speech, images, video, and music, and build comic workflows')

    const extract = await runCommand(['src/cli/create-cli.ts', 'extract', '--help'], { env: helpEnv })
    expect(extract.exitCode).toBe(0)
    expect(extract.stdout).toContain('$ bun autoshow extract')

    const benchmark = await runCommand(['src/cli/create-cli.ts', 'benchmark', '--help'], { env: helpEnv })
    expect(benchmark.exitCode).toBe(2)
    expect(`${benchmark.stdout}\n${benchmark.stderr}`).toContain('Unknown command "benchmark"')
  })
}
