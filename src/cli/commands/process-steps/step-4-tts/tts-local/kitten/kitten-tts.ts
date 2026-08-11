import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { RunOptions, RunResult } from '~/types'
import { RUNTIME_BIN_DIR } from '~/utils/runtime-paths'

const PYTHON_VERSION = '3.12'

export type KittenTtsEnvironmentReadinessProbes = {
  pathExists: (path: string) => Promise<boolean>
  runCapture: (command: string, args?: string[], options?: RunOptions) => Promise<RunResult>
}

export const kittenTtsUvEnvDir = join(RUNTIME_BIN_DIR, 'kitten-tts')

const pathExists = async (path: string): Promise<boolean> =>
  await stat(path).then(() => true).catch(() => false)

const runCapture = async (command: string, args: string[] = [], _options: RunOptions = {}): Promise<RunResult> => {
  try {
    const proc = Bun.spawn([command, ...args], { stdout: 'pipe', stderr: 'pipe' })
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited
    ])
    return { stdout, stderr, exitCode }
  } catch (error) {
    return {
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
      exitCode: 1
    }
  }
}

export const isKittenTtsEnvironmentReady = async (
  probes?: KittenTtsEnvironmentReadinessProbes | undefined
): Promise<boolean> => {
  const activeProbes = probes ?? { pathExists, runCapture }
  if (!await activeProbes.pathExists(kittenTtsUvEnvDir)) return false
  const python = `${kittenTtsUvEnvDir}/bin/python`
  if (!await activeProbes.pathExists(python)) return false

  const required = [
    `${kittenTtsUvEnvDir}/lib/python${PYTHON_VERSION}/site-packages/kittentts`,
    `${kittenTtsUvEnvDir}/lib/python${PYTHON_VERSION}/site-packages/soundfile.py`
  ]
  for (const path of required) {
    if (!await activeProbes.pathExists(path)) return false
  }

  const check = await activeProbes.runCapture(
    python,
    ['-c', 'from kittentts import KittenTTS; import soundfile'],
    { allowFailure: true }
  )
  return check.exitCode === 0
}
