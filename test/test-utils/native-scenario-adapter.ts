import { expect } from 'bun:test'
import { requireCondition } from './require-condition'
import { resolve } from 'node:path'
import { exec } from '~/utils/cli-utils'
import { getFfprobeBinary } from '~/utils/runtime-paths'
import type { LocalExecutionAdapter } from '../scenarios/local-cli-contracts'
import { runCommand } from './test-helpers'

export function createNativeScenarioAdapter(fixtures: Record<string, string> = {}, options?: Parameters<typeof runCommand>[1]): LocalExecutionAdapter {
  return {
    fixture(name) {
      const path = fixtures[name]
      requireCondition(path, `Unknown native scenario fixture ${name}`)
      return path
    },
    hostPath(path, relativeTo = process.cwd()) { return resolve(relativeTo, path) },
    async execute(args) { return runCommand(['src/cli/create-cli.ts', ...args], options) },
    async probe(path) {
      const result = await exec(getFfprobeBinary(), ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width,height', '-of', 'json', path])
      expect(result.exitCode, result.stderr).toBe(0)
      const data = JSON.parse(result.stdout) as { streams?: Array<{ codec_name: string; width: number; height: number }> }
      requireCondition(data.streams?.[0], 'Missing rendered video stream')
      return data.streams[0]
    }
  }
}
