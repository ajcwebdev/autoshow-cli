import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const withTempImageFixture = <T>(
  prefix: string,
  run: (imagePath: string, tempDir: string) => T
): T => {
  const tempDir = mkdtempSync(join(tmpdir(), prefix))
  const imagePath = join(tempDir, 'reference.png')
  writeFileSync(imagePath, new Uint8Array([1, 2, 3]))

  try {
    return run(imagePath, tempDir)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

export const withTempImageFixtures = <T>(
  prefix: string,
  run: (paths: { firstRef: string, secondRef: string }, tempDir: string) => T
): T => {
  const tempDir = mkdtempSync(join(tmpdir(), prefix))
  const firstRef = join(tempDir, 'first.png')
  const secondRef = join(tempDir, 'second.webp')
  writeFileSync(firstRef, new Uint8Array([1, 2, 3]))
  writeFileSync(secondRef, new Uint8Array([4, 5, 6]))

  try {
    return run({ firstRef, secondRef }, tempDir)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}
