import { afterAll } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Runs before any test module loads, so tmpdir()-backed CLI caches, cache locks and
// test temp dirs land in a private root instead of the user's real temp directory.
// childEnv() forwards TMPDIR, so CLI children spawned by tests share this root.
const testTempRoot = mkdtempSync(join(tmpdir(), 'autoshow-test-tmp-'))
process.env['TMPDIR'] = testTempRoot

// bun test does not emit process 'exit' to preloads; a preload-level afterAll runs
// once after the last test, including after failures.
afterAll(() => {
  rmSync(testTempRoot, { recursive: true, force: true })
})
