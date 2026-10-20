import { expect, test } from 'bun:test'
import { lstat, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { EXCLUDED_CONTEXT_FILES, REQUIRED_CONTEXT_FILES, runDockerContextAcceptance, verifyDockerContextOutput } from '../../../docker-acceptance/docker-context-acceptance'
import { withTempDir } from '../../../test-utils/temp-dirs'

async function exportRequired(directory: string): Promise<void> {
  for (const [path, content] of Object.entries(REQUIRED_CONTEXT_FILES)) await Bun.write(join(directory, path), content)
}

test('authored build-context gate uses scratch COPY, exact current ignore bytes, offline local export, and removes its temporary context', async () => {
  let context = ''
  const ignore = await Bun.file('.dockerignore').bytes()
  const checked = await runDockerContextAcceptance(async (argv, timeout) => {
    expect(argv.slice(0, 7)).toEqual(['build', '--network', 'none', '--no-cache', '--progress', 'plain', '--output'])
    expect(timeout).toBe(120_000)
    context = argv.at(-1)!
    expect(context).not.toStartWith(process.cwd())
    expect(await Bun.file(join(context, 'Dockerfile')).text()).toBe('FROM scratch\nCOPY . /\n')
    expect(await Bun.file(join(context, '.dockerignore')).bytes()).toEqual(ignore)
    for (const [path, authored] of Object.entries({ ...REQUIRED_CONTEXT_FILES, ...EXCLUDED_CONTEXT_FILES })) expect(await Bun.file(join(context, path)).text()).toBe(authored)
    const output = argv[7]!.replace('type=local,dest=', '')
    await exportRequired(output)
    return { exitCode: 0, timedOut: false, stdout: '', stderr: '', durationMs: 1 }
  })
  expect(checked).toEqual({ status: 'passed', includedFiles: 12, excludedFixtures: 26, ignoreSha256: new Bun.CryptoHasher('sha256').update(ignore).digest('hex') })
  await expect(lstat(context)).rejects.toThrow()
})

test('authored context verifier requires all root manifests and nested source/config input bytes', async () => {
  await withTempDir('autoshow-context-verifier-', async directory => {
    await exportRequired(directory)
    await verifyDockerContextOutput(directory)
    await rm(join(directory, 'bunfig.toml'))
    await expect(verifyDockerContextOutput(directory)).rejects.toThrow('Required build-context input is missing: bunfig.toml')
    await Bun.write(join(directory, 'bunfig.toml'), REQUIRED_CONTEXT_FILES['bunfig.toml']!)
    await Bun.write(join(directory, 'config/stt-alignment/nested/fixture.ts'), 'wrong bytes\n')
    await expect(verifyDockerContextOutput(directory)).rejects.toThrow('Build-context input bytes changed: config/stt-alignment/nested/fixture.ts')
  })
})

test('authored context verifier rejects leaked unrelated configuration, dependencies, environment files, and logs', async () => {
  await withTempDir('autoshow-context-leaks-', async directory => {
    await exportRequired(directory)
    for (const path of ['config/autoshow.json', 'src/node_modules/fixture/index.js', 'config/defuddle/.env', 'src/application.log']) {
      await Bun.write(join(directory, path), 'unexpected authored export\n')
      await expect(verifyDockerContextOutput(directory)).rejects.toThrow(`Excluded files entered the build context: ${path}`)
      await rm(join(directory, path))
    }
  })
})

test('failed and timed-out context builds fail closed and remove only their authored temporary files', async () => {
  for (const timedOut of [false, true]) {
    let context = ''
    await expect(runDockerContextAcceptance(async argv => {
      context = argv.at(-1)!
      return { exitCode: 1, timedOut, stdout: '', stderr: 'authored build failure', durationMs: 1 }
    })).rejects.toThrow(timedOut ? 'gate timed out' : 'authored build failure')
    await expect(lstat(context)).rejects.toThrow()
  }
})
