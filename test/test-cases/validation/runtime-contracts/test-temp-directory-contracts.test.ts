import { expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { PROJECT_ROOT } from '~/utils/project-root'
import { withLocalTestDir, withTempDir } from '../../../test-utils/temp-dirs'

for (const [label, withDir] of [['local', withLocalTestDir], ['system', withTempDir]] as const) {
  test(`${label} temporary fixtures are removed after successful callbacks`, async () => {
    let fixtureDir = ''
    const result = await withDir('cleanup-success-', async (dir) => {
      fixtureDir = dir
      if (label === 'local') expect(dirname(dir)).toBe(join(PROJECT_ROOT, 'runtime'))
      await Bun.write(join(dir, 'nested', 'fixture.txt'), 'temporary fixture')
      return 42
    })
    expect(result).toBe(42)
    expect(existsSync(fixtureDir)).toBe(false)
  })

  test(`${label} temporary fixtures are removed when callbacks throw`, async () => {
    let fixtureDir = ''
    const failure = new Error('fixture callback failed')
    await expect(withDir('cleanup-failure-', async (dir) => {
      fixtureDir = dir
      await Bun.write(join(dir, 'nested', 'fixture.txt'), 'temporary fixture')
      throw failure
    })).rejects.toBe(failure)
    expect(existsSync(fixtureDir)).toBe(false)
  })
}

test('overlapping local fixtures with the same prefix clean up independently', async () => {
  let outerDir = ''
  let innerDir = ''
  await withLocalTestDir('cleanup-overlap', async (outer) => {
    outerDir = outer
    const fixture = join(outer, 'fixture.txt')
    await Bun.write(fixture, 'still in use')
    await withLocalTestDir('cleanup-overlap', async (inner) => {
      innerDir = inner
      expect(inner).not.toBe(outer)
      expect(existsSync(outer)).toBe(true)
      await Bun.write(join(inner, 'fixture.txt'), 'independent fixture')
    })
    expect(existsSync(innerDir)).toBe(false)
    expect(await Bun.file(fixture).text()).toBe('still in use')
  })
  expect(existsSync(outerDir)).toBe(false)
  expect(existsSync(join(PROJECT_ROOT, 'runtime'))).toBe(true)
})
