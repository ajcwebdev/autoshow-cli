import { afterEach } from 'bun:test'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createTempDirTracker } from '../../../../test-utils/temp-dirs'

export const setupTempConfigWriter = (): ((value: unknown) => Promise<string>) => {
  const tempDirs = createTempDirTracker('autoshow-validation-config-')
  // Register cleanup in each importing suite, not only in the first module that loads this helper.
  afterEach(async () => {
    await tempDirs.cleanup()
  })

  return async (value: unknown): Promise<string> => {
    const dir = await tempDirs.make()
    const configPath = join(dir, 'autoshow.json')
    await writeFile(configPath, JSON.stringify(value, null, 2))
    return configPath
  }
}
