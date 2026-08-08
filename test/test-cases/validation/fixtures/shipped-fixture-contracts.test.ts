import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { MISTRAL_DEFAULT_REF_AUDIO } from '~/cli/commands/setup-and-utilities/models/tts-models'

// `git check-ignore --no-index` evaluates the ignore rules against the pathname alone: it neither
// requires the file to exist nor consults the index. Both properties are load-bearing here. Without
// `--no-index` git reports nothing for tracked paths, which is exactly how the `input/` fixtures hid
// a broken rule chain — a blanket `input` rule ignored the whole tree while 23 files stayed tracked
// as force-add residue, so every negation under it was dead and nobody could tell from `git status`.
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
    // Derived from the index, not a hand-maintained list, so this cannot drift the way the
    // negation block itself did. It fails if a global glob is appended below that block
    // (`**/*.mp3` and friends re-ignoring the audio and image fixtures), if a per-directory
    // negation is dropped, or if a fixture is force-added without an allowlist entry.
    const tracked = trackedInputFiles()
    expect(tracked.length).toBeGreaterThan(0)

    expect(tracked.filter(isIgnored)).toEqual([])
  })

  test('the Mistral reference-audio fixture is shipped, not local-only', () => {
    // Read from production rather than restated: `MISTRAL_DEFAULT_REF_AUDIO` is the default every
    // `--tts-ref-audio` run falls back to, and it was ignored while the docs called it committed.
    // Retargeting the constant at a path the ignore rules drop fails here instead of on a clone.
    expect(MISTRAL_DEFAULT_REF_AUDIO).toStartWith('input/examples/')
    expect(isIgnored(MISTRAL_DEFAULT_REF_AUDIO)).toBe(false)
    expect(existsSync(MISTRAL_DEFAULT_REF_AUDIO)).toBe(true)
  })

  test('the fixture allowlist stays an allowlist and does not sweep in personal media', () => {
    // Personal recordings, scanned books, and scratch drafts sit in these same directories, so the
    // negations must name files one by one. These paths do not exist in the repo; `--no-index`
    // answers from the rules alone, which is what makes the assertion machine-independent.
    for (const path of [
      'input/examples/audio/personal-recording.mp3',
      'input/examples/document/private-book.acsm',
      'input/examples/tts/scratch-draft.md',
      'input/examples/video/local-clip.mp4',
      'input/personal-episode.mp4'
    ]) {
      expect(isIgnored(path)).toBe(true)
    }
  })
})
