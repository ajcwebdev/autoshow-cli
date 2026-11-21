import { existsSync } from 'node:fs'
import type { RunOptions, RunResult } from '~/types'
import { runCapture } from './run-complete-setup'

export const canSandboxDoctorProcesses = (platform = process.platform): boolean =>
  platform === 'darwin' && existsSync('/usr/bin/sandbox-exec')

export const runReadOnlyDoctorProcess = async (command: string, args: string[] = [], options: RunOptions = {}): Promise<RunResult> => {
  if (!canSandboxDoctorProcesses()) return { exitCode: 1, stdout: '', stderr: 'A read-only executable sandbox is unavailable; inspect managed receipts and run mutating setup for executable capability checks.' }
  return await runCapture('/usr/bin/sandbox-exec', [
    '-p', '(version 1) (allow default) (deny file-write*) (deny network*)', command, ...args
  ], { ...options, allowFailure: true })
}
