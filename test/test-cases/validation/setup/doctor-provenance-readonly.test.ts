import { expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DoctorProbes } from '~/types'
import { collectDoctorReport } from '~/cli/commands/setup-and-utilities/setup/run-doctor'
import { readManagedBuildToolReadiness, writeManagedBuildToolReceipt } from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-build-tools'
import { canSandboxDoctorProcesses, runReadOnlyDoctorProcess } from '~/cli/commands/setup-and-utilities/setup/doctor-read-only-process'
import { SUPPORTED_BUN_VERSION } from '~/utils/bun-version'
import { activateManagedRenderingTools, ensureManagedRenderingConfiguration, validateManagedRenderingConfiguration } from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-native-rendering'
import { PROJECT_ROOT } from '~/utils/project-root'

test('doctor reports real missing receipts and corrupt bootstrap resources without launching the executable', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'autoshow-doctor-provenance-'))
  const prefix = join(directory, 'cmake')
  const resource = join(prefix, 'share/cmake/fixture-module.cmake')
  let executions = 0
  try {
    await mkdir(join(prefix, 'bin'), { recursive: true })
    await mkdir(join(prefix, 'share/cmake'), { recursive: true })
    await Bun.write(join(prefix, 'bin/cmake'), '#!/bin/sh\nprintf "3.31.12\\n"\n')
    await chmod(join(prefix, 'bin/cmake'), 0o755)
    await Bun.write(resource, 'original bootstrap resource\n')
    await writeManagedBuildToolReceipt('cmake', prefix)
    const probes: Partial<DoctorProbes> = {
      platform: 'darwin', bunVersion: SUPPORTED_BUN_VERSION, env: {}, executeReadOnlyTools: true,
      pathExists: async path => path.endsWith('/cmake'), which: () => undefined,
      listDirectory: async () => [], directoryHasFiles: async () => false,
      resolveConfigPath: async () => join(directory, 'absent-config.json'), loadConfig: async () => ({}),
      inspectYtDlpAuthState: async () => ({ configuredMode: 'none', usableMode: 'none', cookieArgs: [] }),
      readDefuddleCliReadiness: async () => ({ label: 'defuddle', status: 'MISSING', detail: 'synthetic uninstalled package', severity: 'warn' }),
      validateAlignmentRuntime: async () => ({ healthy: false, reason: 'synthetic uninstalled alignment package' }),
      validateRuntimeTool: async tool => {
        expect(tool).toBe('cmake')
        const result = await readManagedBuildToolReadiness('cmake', prefix)
        return result.healthy
          ? { healthy: true, detail: 'source bootstrap receipt verified', version: result.version }
          : { healthy: false, reason: result.reason ?? 'invalid bootstrap receipt' }
      },
      run: async () => { executions += 1; return { exitCode: 0, stdout: '3.31.12\n', stderr: '' } }
    }
    const check = async () => (await collectDoctorReport(probes)).sections.flatMap(section => section.checks).find(entry => entry.label === 'Managed CMake')!
    expect((await check()).status).toBe('OK')
    expect(executions).toBe(1)
    executions = 0
    await Bun.write(resource, 'changed bootstrap resource\n')
    const corrupt = await check()
    expect(corrupt.status).toBe('WARN')
    expect(corrupt.detail).toMatch(/payload|resource|hash|changed/i)
    expect(executions).toBe(0)
    expect(await Bun.file(resource).text()).toBe('changed bootstrap resource\n')
    await Bun.write(resource, 'original bootstrap resource\n')
    await rm(join(prefix, '.autoshow-build-tool.json'))
    const missing = await check()
    expect(missing.status).toBe('WARN')
    expect(missing.detail).toMatch(/receipt|ENOENT|missing/i)
    expect(executions).toBe(0)
    expect(await readdir(directory)).toEqual(['cmake'])
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('doctor executable probes enforce zero filesystem writes and never fall back to an unrestricted process', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'autoshow-doctor-sandbox-'))
  const forbidden = join(directory, 'must-not-exist')
  try {
    const result = await runReadOnlyDoctorProcess('/bin/sh', ['-c', 'printf forbidden > "$1"', 'doctor', forbidden])
    expect(result.exitCode).not.toBe(0)
    await expect(stat(forbidden)).rejects.toMatchObject({ code: 'ENOENT' })
    if (canSandboxDoctorProcesses()) {
      expect(result.stderr).toMatch(/not permitted|denied/i)
      const readable = await runReadOnlyDoctorProcess('/bin/echo', ['readonly-probe'])
      expect(readable.exitCode).toBe(0)
      expect(readable.stdout.trim()).toBe('readonly-probe')
    } else {
      expect(result.stderr).toContain('read-only executable sandbox is unavailable')
    }
    expect(await readdir(directory)).toEqual([])
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('doctor reports corrupt real font resources and leaves both resources and caches untouched', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'autoshow-doctor-fonts-'))
  const root = join(directory, 'runtime')
  let matchingCalls = 0
  try {
    const sourceFonts = join(root, 'tools/native/dejavu-fonts/share/fonts/truetype/dejavu')
    await mkdir(sourceFonts, { recursive: true })
    await Bun.write(join(sourceFonts, 'DejaVuSans.ttf'), 'synthetic font resource bytes')
    await Bun.write(join(sourceFonts, 'DejaVuSans-Bold.ttf'), 'synthetic bold font resource bytes')
    for (const [dependency, executable] of [['imagemagick', 'magick'], ['pango', 'pango-view'], ['fontconfig', 'fc-match'], ['fontconfig', 'fc-cache']]) {
      const binary = join(root, 'tools/native', dependency!, 'bin', executable!)
      await mkdir(join(binary, '..'), { recursive: true })
      await Bun.write(binary, '#!/bin/sh\nexit 0\n')
      await chmod(binary, 0o755)
    }
    await ensureManagedRenderingConfiguration({ runtimeRoot: root })
    await activateManagedRenderingTools({ runtimeRoot: root })
    const probes: Partial<DoctorProbes> = {
      platform: 'darwin', bunVersion: SUPPORTED_BUN_VERSION, env: {}, executeReadOnlyTools: true,
      pathExists: async path => path.endsWith('/fc-match'), which: () => undefined,
      listDirectory: async () => [], directoryHasFiles: async () => false,
      resolveConfigPath: async () => join(directory, 'absent-config.json'), loadConfig: async () => ({}),
      inspectYtDlpAuthState: async () => ({ configuredMode: 'none', usableMode: 'none', cookieArgs: [] }),
      readDefuddleCliReadiness: async () => ({ label: 'defuddle', status: 'MISSING', detail: 'synthetic uninstalled package', severity: 'warn' }),
      validateAlignmentRuntime: async () => ({ healthy: false, reason: 'synthetic uninstalled alignment package' }),
      validateRuntimeTool: async () => ({ healthy: true, detail: 'synthetic native package receipt verified' }),
      validateRenderingConfiguration: async () => {
        const result = await validateManagedRenderingConfiguration({ runtimeRoot: root })
        return result.healthy ? { healthy: true, detail: 'font resources and configuration verified' } : result
      },
      run: async () => { matchingCalls += 1; return { exitCode: 0, stdout: 'DejaVu Sans', stderr: '' } }
    }
    const fontCheck = async () => (await collectDoctorReport(probes)).sections.flatMap(section => section.checks).find(entry => entry.label === 'Managed rendering fonts')!
    const uncached = await fontCheck()
    expect(uncached.status).toBe('WARN')
    expect(uncached.detail).toContain('cache is absent')
    const copiedFont = join(root, 'fonts/dejavu/DejaVuSans.ttf')
    await Bun.write(copiedFont, 'corrupt copied font bytes')
    const corrupt = await fontCheck()
    expect(corrupt.status).toBe('WARN')
    expect(corrupt.detail).toContain('Managed font differs')
    expect(matchingCalls).toBe(0)
    expect(await Bun.file(copiedFont).text()).toBe('corrupt copied font bytes')
    expect(await readdir(join(root, 'cache/fontconfig'))).toEqual([])
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('default CLI doctor reports an empty runtime without creating tools, caches, locks, or temporary files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'autoshow-doctor-empty-'))
  const projectRoot = join(directory, 'uncreated-project')
  try {
    const child = Bun.spawn([process.execPath, '--no-env-file', join(PROJECT_ROOT, 'src/cli/create-cli.ts'), 'setup', '--doctor', '--json', '--no-color'], {
      cwd: directory,
      env: { PATH: '/usr/bin:/bin', AUTOSHOW_PROJECT_ROOT: projectRoot, BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0', NO_COLOR: '1' },
      stdin: 'ignore', stdout: 'pipe', stderr: 'pipe'
    })
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited])
    expect(code, stderr).toBe(0)
    const result = JSON.parse(stdout)
    expect(result).toMatchObject({ type: 'result', status: 'success', data: { mode: 'doctor', report: { hasWarnings: true } } })
    expect(stderr).not.toContain('no config destination')
    await expect(stat(projectRoot)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(await readdir(directory)).toEqual([])
  } finally { await rm(directory, { recursive: true, force: true }) }
})
