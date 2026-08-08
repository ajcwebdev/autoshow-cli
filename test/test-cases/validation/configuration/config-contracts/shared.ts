import { afterEach } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const tempDirs: string[] = []

export const writeTempConfig = async (value: unknown): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'autoshow-validation-config-'))
  tempDirs.push(dir)
  const configPath = join(dir, 'autoshow.json')
  await writeFile(configPath, JSON.stringify(value, null, 2))
  return configPath
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})
