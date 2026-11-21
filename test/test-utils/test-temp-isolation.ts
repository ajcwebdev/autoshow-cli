import { afterAll } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { PROJECT_ROOT } from '~/utils/project-root'

// Keep each worker's temporary files and mutable state inside runtime. Nested
// test processes get another private directory below their parent's root.
const runtimeTempRoot = join(PROJECT_ROOT, 'runtime', 'tmp')
const inheritedTempRoot = resolve(tmpdir())
const inheritedRelative = relative(runtimeTempRoot, inheritedTempRoot)
const temporaryBase = inheritedRelative === '' || (!inheritedRelative.startsWith('..') && !isAbsolute(inheritedRelative))
  ? inheritedTempRoot
  : runtimeTempRoot
mkdirSync(temporaryBase, { recursive: true })
const testTempRoot = mkdtempSync(join(temporaryBase, 'autoshow-test-tmp-'))
process.env['TMPDIR'] = testTempRoot
process.env['TMP'] = testTempRoot
process.env['TEMP'] = testTempRoot
process.env['AUTOSHOW_TEST_STATE_ROOT'] = testTempRoot

// bun test does not emit process 'exit' to preloads; a preload-level afterAll runs
// once after the last test, including after failures.
afterAll(() => {
  rmSync(testTempRoot, { recursive: true, force: true })
})
