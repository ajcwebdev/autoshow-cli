import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { MISTRAL_DEFAULT_REF_AUDIO } from '~/cli/commands/setup-and-utilities/models/tts-models'

const runGit = (args: string[]): { exitCode: number, stdout: string } => {
  const result = Bun.spawnSync(['git', ...args])
  const exitCode = result.exitCode ?? -1
  if (exitCode > 1) {
    throw new Error(`git ${args.join(' ')} failed (${exitCode}): ${result.stderr.toString().trim()}`)
  }
  return { exitCode, stdout: result.stdout.toString() }
}

const isIgnored = (path: string): boolean => runGit(['check-ignore', '--quiet', '--no-index', path]).exitCode === 0

const trackedInputFiles = (): string[] =>
  runGit(['ls-files', '--', 'input/']).stdout.split('\n').map(line => line.trim()).filter(Boolean)

describe('shipped fixture contracts', () => {
  test('every tracked file under input/ survives the ignore rules', () => {
    const tracked = trackedInputFiles()
    expect(tracked.length).toBeGreaterThan(0)

    expect(tracked.filter(isIgnored)).toEqual([])
  })

  test('the Mistral reference-audio fixture is shipped, not local-only', () => {
    expect(MISTRAL_DEFAULT_REF_AUDIO).toStartWith('input/examples/')
    expect(isIgnored(MISTRAL_DEFAULT_REF_AUDIO)).toBe(false)
    expect(existsSync(MISTRAL_DEFAULT_REF_AUDIO)).toBe(true)
  })

  test('the fixture allowlist stays an allowlist and does not sweep in personal media', () => {
    for (const path of [
      'input/examples/audio/personal-recording.mp3',
      'input/examples/document/private-book.pdf',
      'input/examples/tts/scratch-draft.md',
      'input/examples/video/local-clip.mp4',
      'input/personal-episode.mp4'
    ]) {
      expect(isIgnored(path)).toBe(true)
    }
  })
})
