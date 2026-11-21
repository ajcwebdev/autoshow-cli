import { expect, test } from 'bun:test'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildSetupInstallationPlan, resolveSetupComponents } from '~/cli/commands/setup-and-utilities/setup/setup-plan'
import { PROJECT_ROOT } from '~/utils/project-root'

test('selected setup plans include prerequisite closure in dependency order', async () => {
  expect(resolveSetupComponents('toolchain')).toEqual(['toolchain'])
  expect(resolveSetupComponents('ocr')).toEqual(['toolchain', 'ocr'])
  expect(resolveSetupComponents('rendering')).toEqual(['toolchain', 'media', 'rendering'])
  expect(resolveSetupComponents('alignment')).toEqual(['toolchain', 'alignment'])
  expect(resolveSetupComponents('transcription')).toEqual(['toolchain', 'media', 'whisperfile'])
  const plan = await buildSetupInstallationPlan('music', { forceRedownload: true })
  expect(plan.models).toEqual(['small.en'])
  expect(plan.tasks.map(task => task.component)).toEqual(['toolchain', 'media', 'rendering', 'whisperfile'])
  expect(plan.tasks.every(task => task.action === 'replace' && task.target.startsWith('runtime/'))).toBe(true)
  expect((await buildSetupInstallationPlan('all')).models).toEqual(['tiny'])
  expect(plan.estimates.downloadBytes).toBeNull()
})

test('OCR preview lists its build and codec source closure without unrelated model or media downloads', async () => {
  const plan = await buildSetupInstallationPlan('ocr')
  const names = plan.dependencies.map(dependency => dependency.name)
  expect(names).toEqual(expect.arrayContaining(['bun', 'deno']))
  if (process.platform === 'darwin') {
    expect(names).toEqual(expect.arrayContaining(['cmake', 'pkgconf', 'ninja', 'python', 'meson', 'leptonica', 'tesseract', 'tessdataEng', 'libpng', 'libjpeg-turbo', 'libtiff', 'zlib']))
    expect(names).not.toContain('ffmpeg')
    expect(names).not.toContain('calibre')
    expect(names).not.toContain('pango')
    expect(plan.dependencies.every(dependency => typeof dependency.url === 'string' && /^[a-f0-9]{64}$/.test(dependency.sha256 ?? ''))).toBe(true)
  }
  expect(names.some(name => name.startsWith('whisperfile:'))).toBe(false)
  expect(plan.models).toEqual([])
})

test('CLI setup preview emits a complete plan without creating runtime state or running installed tools', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'autoshow-setup-preview-'))
  const projectRoot = join(directory, 'empty-project')
  try {
    const proc = Bun.spawn([
      process.execPath, '--no-env-file', join(PROJECT_ROOT, 'src/cli/create-cli.ts'),
      'setup', '--dry-run', '--step', 'rendering', '--force-redownload', '--json', '--no-color'
    ], {
      cwd: directory,
      env: { PATH: '/usr/bin:/bin', AUTOSHOW_PROJECT_ROOT: projectRoot, BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0', NO_COLOR: '1' },
      stdin: 'ignore', stdout: 'pipe', stderr: 'pipe'
    })
    const [stdout, stderr, status] = await Promise.all([
      new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited
    ])
    expect(status, stderr).toBe(0)
    expect(stderr).not.toContain('no config destination')
    const result = JSON.parse(stdout)
    expect(result).toMatchObject({ type: 'result', status: 'success', data: { mode: 'plan', dryRun: true, step: 'rendering', runtimeRoot: 'runtime', forceRedownload: true } })
    expect(result.data.tasks.map((task: { component: string }) => task.component)).toEqual(['toolchain', 'media', 'rendering'])
    await expect(stat(projectRoot)).rejects.toMatchObject({ code: 'ENOENT' })
  } finally { await rm(directory, { recursive: true, force: true }) }
})
