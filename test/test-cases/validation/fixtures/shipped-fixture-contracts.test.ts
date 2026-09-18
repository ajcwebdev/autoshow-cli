import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { MISTRAL_DEFAULT_REF_AUDIO } from '~/cli/commands/setup-and-utilities/models/tts-models'

const GIT_TIMEOUT_MS = 60_000

// Spawned asynchronously with a deadline: a synchronous spawn blocks this worker, and one
// per path deadlocked under the parallel suite's subprocess churn instead of failing.
const runGit = async (args: string[], stdin?: string): Promise<{ exitCode: number, stdout: string }> => {
  const child = Bun.spawn(['git', ...args], {
    stdin: stdin === undefined ? 'ignore' : new TextEncoder().encode(stdin),
    stdout: 'pipe',
    stderr: 'pipe',
    signal: AbortSignal.timeout(GIT_TIMEOUT_MS)
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text()
  ])
  if (exitCode > 1) {
    throw new Error(`git ${args.join(' ')} failed (${exitCode}): ${stderr.trim()}`)
  }
  return { exitCode, stdout }
}

const toLines = (stdout: string): string[] => stdout.split('\n').map(line => line.trim()).filter(Boolean)

// One `--stdin` invocation for every path, so the check costs two spawns instead of one per file.
const ignoredPaths = async (paths: readonly string[]): Promise<string[]> => {
  if (paths.length === 0) return []
  const { stdout } = await runGit(['check-ignore', '--no-index', '--stdin'], `${paths.join('\n')}\n`)
  return toLines(stdout)
}

const trackedInputFiles = async (): Promise<string[]> => toLines((await runGit(['ls-files', '--', 'input/'])).stdout)

describe('shipped fixture contracts', () => {
  test('every tracked file under input/ survives the ignore rules', async () => {
    const tracked = await trackedInputFiles()
    expect(tracked.length).toBeGreaterThan(0)

    expect(await ignoredPaths(tracked)).toEqual([])
  })

  test('the Mistral reference-audio fixture is shipped, not local-only', async () => {
    expect(MISTRAL_DEFAULT_REF_AUDIO).toStartWith('input/examples/')
    expect(await ignoredPaths([MISTRAL_DEFAULT_REF_AUDIO])).toEqual([])
    expect(existsSync(MISTRAL_DEFAULT_REF_AUDIO)).toBe(true)
  })

  test('the fixture allowlist stays an allowlist and does not sweep in personal media', async () => {
    const personalMedia = [
      'input/examples/audio/personal-recording.mp3',
      'input/examples/document/private-book.pdf',
      'input/examples/tts/scratch-draft.md',
      'input/examples/video/local-clip.mp4',
      'input/personal-episode.mp4'
    ]

    expect((await ignoredPaths(personalMedia)).sort()).toEqual([...personalMedia].sort())
  })
})
