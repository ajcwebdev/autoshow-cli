import { expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = resolve(import.meta.dir, '../../../..')
const releaseWorkflow = () => readFile(resolve(root, '.github/workflows/docker-publish.yml'), 'utf8')

const section = (source: string, name: string): string => {
  const start = source.indexOf(`\n  ${name}:\n`)
  if (start < 0) throw new Error(`Missing workflow job ${name}`)
  const tail = source.slice(start + 1)
  const next = tail.slice(1).search(/\n  [a-z][a-z-]*:\n/)
  return next < 0 ? tail : tail.slice(0, next + 1)
}

test('native acceptance starts with a cold toolchain and proves dry-run preserves the installed application graph', async () => {
  const job = section(await releaseWorkflow(), 'managed-macos')
  expect(job).toContain('runs-on: macos-15')
  expect(job).toContain('test "$(uname -m)" = arm64')
  expect(job).toContain('bootstrap_bun="$(command -v bun)"')
  expect(job).toContain('test ! -e runtime/tools/native')
  expect(job).toContain('bun --no-env-file src/tools/project-runtime-dependencies.ts')
  expect(job.match(/test\/setup-acceptance\/managed-runtime-snapshot.ts runtime/g)).toHaveLength(2)
  expect(job).toContain('cmp "${RUNNER_TEMP}/managed-runtime-before-plan.json" "${RUNNER_TEMP}/managed-runtime-after-plan.json"')
  expect(job).toContain('setup --dry-run --json')
  expect(job).toContain('setup --doctor --strict --json')
  expect(job).toContain('warm-setup.json')
  expect(job).toContain('test -x /usr/bin/sandbox-exec')
  expect(job).toContain('"${bootstrap_bun}" --no-env-file test/setup-acceptance/managed-offline-setup.ts')
  expect(job.match(/env -i PATH=\/usr\/bin:\/bin:\/usr\/sbin:\/sbin/g)).toHaveLength(5)
  expect(job.match(/BUN_RUNTIME_TRANSPILER_CACHE_PATH=0 CI=true/g)).toHaveLength(5)
  expect(job).not.toContain('secrets.')
  expect(job).not.toContain('CREDENTIAL_MODE=live')
})

test('native acceptance selects every local e2e file and only the known free service contracts', async () => {
  const job = section(await releaseWorkflow(), 'managed-macos')
  const selected = job.split('\n').map(line => line.trim().replace(/\s+\\$/, '')).filter(line => line.startsWith('test/test-cases/e2e/'))
  expect(selected).toEqual([
    'test/test-cases/e2e/local',
    'test/test-cases/e2e/service/audio/music/provider-flag-validation.test.ts',
    'test/test-cases/e2e/service/audio/tts/removed-mistral.test.ts',
    'test/test-cases/e2e/service/audio/tts/inworld-realtime-tts-2.test.ts',
    'test/test-cases/e2e/service/visuals/image/image-usage-errors.test.ts',
    'test/test-cases/e2e/service/visuals/video/video-usage-errors.test.ts'
  ])
  for (const path of selected.slice(1)) {
    const source = await readFile(resolve(root, path), 'utf8')
    expect(source).not.toMatch(/\b(?:budgetedTest|defineBudgetedLiveServiceTest|defineTTSServiceTest|defineImageServiceTest|defineVideoServiceTest|defineMusicServiceTest)\(/)
  }
  expect(job).not.toContain('--all-providers')
  expect(job).toContain('--no-cleanup --parallel=4 --max-concurrency=2')
})

test('Linux verification provisions managed tools before price mode without installing host packages', async () => {
  const verify = section(await releaseWorkflow(), 'verify')
  expect(verify).toContain('setup --step rendering')
  expect(verify).toContain('setup --step calibre')
  expect(verify).not.toContain('sudo apt')
  expect(verify.indexOf('wait "${native_pid}"')).toBeLessThan(verify.indexOf('t --price --no-cleanup'))
  expect(verify).toContain('wait "${check_pid}"')
  const graphs = await readFile(resolve(root, '.github/workflows/dependency-graphs.yml'), 'utf8')
  const javascript = section(graphs, 'javascript')
  expect(javascript).not.toContain('sudo apt')
  expect(javascript).toContain('setup --step rendering')
  expect(javascript).toContain('audit --cwd runtime/defuddle')
  const alignment = section(graphs, 'alignment')
  expect(alignment).toContain('setup --step alignment')
  expect(alignment).toContain('pm --cwd runtime/tools/stt-alignment ls --all')
})
