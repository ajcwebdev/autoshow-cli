import { expect, test } from 'bun:test'
import { chmod, lstat, mkdir, readdir, readlink, rm, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import {
  isManagedBuildToolCurrent,
  managedBuildEnvironment,
  managedBuildToolPath,
  managedNinjaConfigureArguments,
  MANAGED_BUILD_TOOL_SOURCES,
  runManagedBuildToolCommand,
  withManagedBuildToolRefresh,
  writeManagedBuildToolReceipt
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-build-tools'
import { setupContractSuiteLifecycle } from '../../../test-utils/rest-contract-helpers'
import { collectManagedSourcePayload } from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact-payload'
import { createManagedToolStagingDirectory } from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact'

const tempDirs = setupContractSuiteLifecycle({ envKeys: [], tempPrefix: 'autoshow-build-tool-integrity-' })

test('managed build-tool integrity rejects modified binaries, resources, permissions, links and incompatible recipe identity', async () => {
  const prefix = await tempDirs.make()
  const source = MANAGED_BUILD_TOOL_SOURCES.ninja
  await mkdir(join(prefix, 'bin'), { recursive: true })
  await mkdir(join(prefix, 'share'), { recursive: true })
  const binary = join(prefix, source.binary)
  const resource = join(prefix, 'share/configuration')
  const linkedResource = join(prefix, 'bin/configuration')
  const bytes = 'synthetic executable bytes\n'
  await Bun.write(binary, bytes)
  await chmod(binary, 0o755)
  await Bun.write(resource, 'synthetic resource\n')
  await symlink('../share/configuration', linkedResource)
  const manifest = {
    schemaVersion: 1,
    recipe: 'managed-ninja-no-package-registry-v3',
    name: 'ninja',
    version: source.version,
    url: source.url,
    sha256: source.sha256,
    platform: process.platform,
    architecture: process.arch,
    binary: source.binary,
    binarySha256: new Bun.CryptoHasher('sha256').update(bytes).digest('hex'),
    payload: await collectManagedSourcePayload(prefix)
  }
  const manifestPath = join(prefix, '.autoshow-build-tool.json')
  await Bun.write(manifestPath, JSON.stringify(manifest))
  expect(await isManagedBuildToolCurrent('ninja', prefix)).toBe(true)
  await Bun.write(manifestPath, JSON.stringify({ ...manifest, recipe: 'managed-bootstrap-source-cmake-v2' }))
  expect(await isManagedBuildToolCurrent('ninja', prefix)).toBe(false)
  await Bun.write(manifestPath, JSON.stringify(manifest))
  await Bun.write(binary, 'modified executable bytes\n')
  expect(await isManagedBuildToolCurrent('ninja', prefix)).toBe(false)
  await Bun.write(binary, bytes)
  await Bun.write(resource, 'modified resource\n')
  expect(await isManagedBuildToolCurrent('ninja', prefix)).toBe(false)
  await Bun.write(resource, 'synthetic resource\n')
  await chmod(binary, 0o700)
  expect(await isManagedBuildToolCurrent('ninja', prefix)).toBe(false)
  await chmod(binary, 0o755)
  await rm(linkedResource)
  await symlink('../../outside-runtime', linkedResource)
  expect(await isManagedBuildToolCurrent('ninja', prefix)).toBe(false)
  await rm(linkedResource)
  await symlink('../share/configuration', linkedResource)
  await Bun.write(manifestPath, JSON.stringify({ ...manifest, architecture: 'unsupported-architecture' }))
  expect(await isManagedBuildToolCurrent('ninja', prefix)).toBe(false)
  await Bun.write(manifestPath, JSON.stringify({ ...manifest, recipe: 'unsupported-recipe' }))
  expect(await isManagedBuildToolCurrent('ninja', prefix)).toBe(false)
})

test('Ninja configure disables user and system package registries and package registration export', async () => {
  const root = await tempDirs.make()
  const source = join(root, 'source'), build = join(root, 'build'), install = join(root, 'install')
  const args = managedNinjaConfigureArguments(source, build, install)
  expect(args).toEqual([
    '-S', source, '-B', build,
    '-DCMAKE_BUILD_TYPE=Release', '-DBUILD_TESTING=OFF',
    '-DCMAKE_FIND_USE_PACKAGE_REGISTRY=OFF',
    '-DCMAKE_FIND_USE_SYSTEM_PACKAGE_REGISTRY=OFF',
    '-DCMAKE_EXPORT_PACKAGE_REGISTRY=OFF',
    `-DCMAKE_INSTALL_PREFIX=${install}`
  ])
})

test('current CMake pin accepts source artifacts and invalidates earlier binary receipts before dispatch', async () => {
  const source = MANAGED_BUILD_TOOL_SOURCES.cmake
  expect(source.url).toBe('https://github.com/Kitware/CMake/releases/download/v3.31.12/cmake-3.31.12.tar.gz')
  expect(source.sha256).toBe('5f3fd5a54dfa65602bdbed64f981a72673cc19f2d304cc2955cf0dfa0cfd8272')
  expect(source.binary).toBe('bin/cmake')
  const prefix = await tempDirs.make()
  const marker = join(prefix, 'launched')
  await mkdir(join(prefix, 'CMake.app/Contents/bin'), { recursive: true })
  const oldBinary = join(prefix, 'CMake.app/Contents/bin/cmake')
  const script = `#!/bin/sh\ntouch '${marker}'\nexit 137\n`
  await Bun.write(oldBinary, script)
  await chmod(oldBinary, 0o755)
  await Bun.write(join(prefix, '.autoshow-build-tool.json'), JSON.stringify({
    schemaVersion: 1, recipe: 'managed-bootstrap-v1', name: 'cmake', version: '3.31.12',
    url: 'https://github.com/Kitware/CMake/releases/download/v3.31.12/cmake-3.31.12-macos-universal.tar.gz',
    sha256: '799af7fd545db9bf1b9cfe72f8095880e727a2d4e0df0e3dffc3bc7b95c2d3b0',
    platform: process.platform, architecture: process.arch, binary: 'CMake.app/Contents/bin/cmake',
    binarySha256: new Bun.CryptoHasher('sha256').update(script).digest('hex')
  }))
  expect(await isManagedBuildToolCurrent('cmake', prefix)).toBe(false)
  expect(await Bun.file(marker).exists()).toBe(false)
})

test('a rejected build-tool exit is surfaced after one dispatch without automatic retries', async () => {
  const prefix = await tempDirs.make()
  const counter = join(prefix, 'dispatches')
  const command = join(prefix, 'rejected-tool')
  await Bun.write(command, `#!/bin/sh\nprintf 'dispatch\\n' >> '${counter}'\nexit 137\n`)
  await chmod(command, 0o755)
  await expect(runManagedBuildToolCommand('rejected-tool-fixture', command, [], prefix)).rejects.toThrow('exit 137')
  expect((await Bun.file(counter).text()).trim().split('\n')).toHaveLength(1)
})

test('build subprocess discovery uses managed tools and OS compiler locations', () => {
  const environment = managedBuildEnvironment()
  const path = environment['PATH']!.split(':')
  expect(path[0]).toBe(join(managedBuildToolPath('cmake'), '..'))
  expect(path.slice(1)).toEqual(['/usr/bin', '/bin', '/usr/sbin', '/sbin'])
  expect(environment['CC']).toBe(process.platform === 'darwin' ? '/usr/bin/clang' : '/usr/bin/cc')
  expect(environment['PKG_CONFIG_LIBDIR']).toBe('')
  expect(environment['PYTHONNOUSERSITE']).toBe('1')
  for (const key of ['TMPDIR', 'TMP', 'TEMP', 'XDG_CACHE_HOME', 'PYTHONPYCACHEPREFIX']) {
    expect(environment[key]).toContain('/runtime/')
  }
})

for (const scenario of ['cache', 'logs', 'cwd', 'receipt'] as const) {
  test(`bootstrap physical containment rejects an escaping nested ${scenario} path before transport or dispatch`, async () => {
    const project = await tempDirs.make()
    const runtime = join(project, 'runtime')
    await mkdir(runtime, { recursive: true })
    const moduleUrl = new URL('../../../../src/cli/commands/setup-and-utilities/setup/setup-download/managed-build-tools.ts', import.meta.url).href
    const script = `
      import {mkdir,readdir,symlink} from 'node:fs/promises';
      import {join} from 'node:path';
      import {ensureManagedBuildTools,readManagedBuildToolReadiness,runManagedBuildToolCommand,writeManagedBuildToolReceipt} from ${JSON.stringify(moduleUrl)};
      const project=process.env['AUTOSHOW_PROJECT_ROOT'];
      const runtime=join(project,'runtime');
      const external=join(project,'external');
      const marker=join(external,'dispatched');
      const scenario=${JSON.stringify(scenario)};
      await mkdir(external,{recursive:true});
      await mkdir(join(runtime,'tmp'),{recursive:true});
      let fetches=0;
      globalThis.fetch=async()=>{fetches++;throw new Error('Unexpected bootstrap transport');};
      let failure='';
      if(scenario==='cache'){
        await mkdir(join(runtime,'cache'),{recursive:true});
        await symlink(external,join(runtime,'cache/native-bootstrap'));
        try{await ensureManagedBuildTools();}catch(error){failure=error.message;}
      }else if(scenario==='receipt'){
        await mkdir(join(runtime,'tools/build-tools'),{recursive:true});
        await symlink(external,join(runtime,'tools/build-tools/ninja'));
        const readiness=await readManagedBuildToolReadiness('ninja');
        if(readiness.healthy)throw new Error('Escaping receipt accepted');
        try{await writeManagedBuildToolReceipt('ninja',join(runtime,'tools/build-tools/ninja'));}catch(error){failure=error.message;}
      }else{
        await mkdir(join(runtime,'bin'),{recursive:true});
        const fake=join(runtime,'bin/synthetic-tool');
        await Bun.write(fake,'#!/bin/sh\\nprintf dispatched > '+JSON.stringify(marker)+'\\n');
        await import('node:fs/promises').then(fs=>fs.chmod(fake,0o755));
        let cwd=join(runtime,'workspace');
        if(scenario==='cwd'){
          await symlink(external,cwd);
          cwd=join(cwd,'uncreated');
        }else{
          await mkdir(cwd,{recursive:true});
          await mkdir(join(runtime,'build'),{recursive:true});
          await symlink(external,join(runtime,'build/bootstrap'));
        }
        try{await runManagedBuildToolCommand('synthetic-tool',fake,[],cwd);}catch(error){failure=error.message;}
      }
      console.log(JSON.stringify({failure,fetches,dispatched:await Bun.file(marker).exists(),outside:(await readdir(external)).filter(name=>name!=='.DS_Store')}));
    `
    const proc = Bun.spawn([process.execPath, '--no-env-file', '-e', script], {
      env: {
        PATH: '/usr/bin:/bin',
        HOME: process.env['HOME'],
        AUTOSHOW_PROJECT_ROOT: project,
        TMPDIR: join(runtime, 'tmp')
      },
      stdout: 'pipe', stderr: 'pipe'
    })
    const timeout = setTimeout(() => proc.kill('SIGTERM'), 10_000)
    try {
      const [stdout, stderr, exitCode] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
      expect(exitCode, stderr).toBe(0)
      const result = JSON.parse(stdout)
      expect(result.failure).toContain('inside the project runtime directory')
      expect(result.fetches).toBe(0)
      expect(result.dispatched).toBe(false)
      expect(result.outside).toEqual([])
    } finally { clearTimeout(timeout) }
  })
}

test('concurrent and repeated forced helper refreshes perform one successful forced action per process', async () => {
  const requests: boolean[] = []
  const action = async (force: boolean) => { requests.push(force); await new Promise(resolve => setTimeout(resolve, 5)) }
  await Promise.all([1, 2, 3].map(async () => await withManagedBuildToolRefresh('cmake', true, action)))
  await withManagedBuildToolRefresh('cmake', true, action)
  expect(requests).toEqual([true, false, false, false])
})

test('a failed forced helper action does not mark its refresh complete or trigger an implicit retry', async () => {
  const requests: boolean[] = []
  await expect(withManagedBuildToolRefresh('ninja', true, async force => { requests.push(force); throw new Error('synthetic refresh failure') })).rejects.toThrow('synthetic refresh failure')
  expect(requests).toEqual([true])
  await withManagedBuildToolRefresh('ninja', true, async force => { requests.push(force) })
  await withManagedBuildToolRefresh('ninja', true, async force => { requests.push(force) })
  expect(requests).toEqual([true, true, false])
})

const writeSyntheticCmakeInstallation = async (prefix: string, identity: 'prior' | 'candidate'): Promise<void> => {
  await mkdir(join(prefix, 'bin'), { recursive: true })
  await mkdir(join(prefix, 'share'), { recursive: true })
  await Bun.write(join(prefix, 'bin/cmake'), `#!/bin/sh\nprintf '${identity}\\n' >> '../dispatches'\nprintf 'cmake version 3.31.12\\n'\n`)
  await chmod(join(prefix, 'bin/cmake'), 0o755)
  await Bun.write(join(prefix, 'share/resource'), `${identity} resource\n`)
  await chmod(join(prefix, 'share/resource'), 0o640)
  await symlink('../share/resource', join(prefix, 'bin/resource'))
  await writeManagedBuildToolReceipt('cmake', prefix)
}

for (const checkpoint of ['candidate-renamed', 'committed'] as const) {
  test(`bootstrap caller recovers after actual SIGKILL at ${checkpoint} before a warm fixture dispatch`, async () => {
    const project = await tempDirs.make()
    const runtime = join(project, 'runtime')
    const prefix = join(runtime, 'tools/build-tools/cmake')
    await mkdir(join(runtime, 'tmp'), { recursive: true })
    await writeSyntheticCmakeInstallation(prefix, 'prior')
    const priorReceipt = await Bun.file(join(prefix, '.autoshow-build-tool.json')).text()
    const staging = await createManagedToolStagingDirectory(prefix)
    await writeSyntheticCmakeInstallation(staging, 'candidate')
    const candidateReceipt = await Bun.file(join(staging, '.autoshow-build-tool.json')).text()
    const moduleUrl = new URL('../../../../src/cli/commands/setup-and-utilities/setup/setup-download/managed-build-tools.ts', import.meta.url).href
    const marker = join(runtime, 'tmp/checkpoint')
    const environment = { PATH: '/usr/bin:/bin', HOME: process.env['HOME'], AUTOSHOW_PROJECT_ROOT: project, TMPDIR: join(runtime, 'tmp'), TMP: join(runtime, 'tmp'), TEMP: join(runtime, 'tmp'), BUN_RUNTIME_TRANSPILER_CACHE_PATH: join(runtime, 'cache/bun-transpiler') }
    const run = async (script: string) => {
      const child = Bun.spawn([process.execPath, '--no-env-file', '-e', script], { env: environment, stdout: 'pipe', stderr: 'pipe' })
      const timeout = setTimeout(() => child.kill('SIGTERM'), 10_000)
      try {
        const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        return { exitCode, stdout, stderr }
      } finally { clearTimeout(timeout) }
    }
    const killed = await run(`import {promoteManagedBuildToolInstallation} from ${JSON.stringify(moduleUrl)};
      await promoteManagedBuildToolInstallation('cmake',${JSON.stringify(staging)},{checkpoint:async phase=>{if(phase===${JSON.stringify(checkpoint)}){await Bun.write(${JSON.stringify(marker)},phase);process.kill(process.pid,'SIGKILL')}}});`)
    expect(killed.exitCode, killed.stderr).not.toBe(0)
    expect(await Bun.file(marker).text()).toBe(checkpoint)
    const journal = join(runtime, 'tools/build-tools/.cmake.transaction.json')
    const journalBeforeRead = await Bun.file(journal).text()
    const dispatches = join(runtime, 'tools/build-tools/dispatches')
    const beforeRead = await Bun.file(dispatches).text()
    const queried = await run(`import {readManagedBuildToolReadiness} from ${JSON.stringify(moduleUrl)}; console.log(JSON.stringify(await readManagedBuildToolReadiness('cmake')));`)
    expect(queried.exitCode, queried.stderr).toBe(0)
    const readiness = JSON.parse(queried.stdout)
    expect(readiness.healthy).toBe(false)
    expect(readiness.reason).toContain('unfinished')
    expect(await Bun.file(journal).text()).toBe(journalBeforeRead)
    expect(await Bun.file(dispatches).text()).toBe(beforeRead)
    const settled = await run(`import {ensureManagedBuildTool,readManagedBuildToolReadiness} from ${JSON.stringify(moduleUrl)};
      let fetches=0;globalThis.fetch=async()=>{fetches++;throw Error('unexpected bootstrap fetch')};await ensureManagedBuildTool('cmake');console.log(JSON.stringify({fetches,readiness:await readManagedBuildToolReadiness('cmake')}));`)
    expect(settled.exitCode, settled.stderr).toBe(0)
    expect(JSON.parse(settled.stdout)).toMatchObject({ fetches: 0, readiness: { healthy: true } })
    expect(await Bun.file(journal).exists()).toBe(false)
    const expectedReceipt = checkpoint === 'committed' ? candidateReceipt : priorReceipt
    expect(await Bun.file(join(prefix, '.autoshow-build-tool.json')).text()).toBe(expectedReceipt)
    expect((await Bun.file(dispatches).text()).slice(beforeRead.length)).toBe(checkpoint === 'committed' ? 'candidate\n' : 'prior\n')
    expect((await lstat(join(prefix, 'share/resource'))).mode & 0o777).toBe(0o640)
    expect(await readlink(join(prefix, 'bin/resource'))).toBe('../share/resource')
    const entries = (await readdir(join(runtime, 'tools/build-tools'))).filter(name => name !== '.DS_Store')
    expect(entries.some(name => name.startsWith('cmake.backup-'))).toBe(false)
    if (checkpoint === 'candidate-renamed') {
      const evidence = entries.find(name => name.startsWith('.cmake.interrupted-'))
      expect(evidence).toBeDefined()
      expect(await Bun.file(join(runtime, 'tools/build-tools', evidence!, '.autoshow-build-tool.json')).text()).toBe(candidateReceipt)
      const archive = entries.find(name => name.startsWith('.cmake.transaction-') && name.endsWith('.interrupted.json'))
      expect(archive).toBeDefined()
      expect((await Bun.file(join(runtime, 'tools/build-tools', archive!)).json()).phase).toBe('recovered')
    }
  })
}
