import { afterEach, expect, test } from 'bun:test'
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'
import { readDependencyUrlAndSha256 } from '~/cli/commands/setup-and-utilities/setup/dependency-metadata'

const wrapperPath = resolve(import.meta.dir, '../../../../scripts/autoshow-docker.sh')
const dockerfilePath = resolve(import.meta.dir, '../../../../Dockerfile')
const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

test('Docker yt-dlp pin matches resolved native setup metadata in both directions', async () => {
  const dockerfile = await readFile(dockerfilePath, 'utf8')
  const dockerArgs = Object.fromEntries(
    [...dockerfile.matchAll(/^ARG (YT_DLP_[A-Z0-9_]+)=(\S+)$/gm)]
      .map(([, name, value]) => [name, value])
  )
  const { url, sha256 } = await readDependencyUrlAndSha256('yt-dlp', 'linux')
  const expectedArgs = {
    YT_DLP_URL: url,
    YT_DLP_SHA256: sha256
  }

  expect({
    missing: Object.keys(expectedArgs).filter(name => !(name in dockerArgs)),
    extra: Object.keys(dockerArgs).filter(name => !(name in expectedArgs))
  }).toEqual({ missing: [], extra: [] })
  expect(dockerArgs).toEqual(expectedArgs)

  const downloadIndex = dockerfile.indexOf('curl -fsSL "${YT_DLP_URL}" -o /usr/local/bin/yt-dlp')
  const checksumIndex = dockerfile.indexOf('"${YT_DLP_SHA256}" /usr/local/bin/yt-dlp | sha256sum -c -')
  const chmodIndex = dockerfile.indexOf('chmod 0755 /usr/local/bin/yt-dlp')

  expect(downloadIndex).toBeGreaterThan(-1)
  expect(checksumIndex).toBeGreaterThan(downloadIndex)
  expect(chmodIndex).toBeGreaterThan(checksumIndex)
})

test('Docker wrapper preserves relative and host-absolute workspace paths', async () => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow docker wrapper '))
  temporaryDirectories.push(root)

  const canonicalRoot = await realpath(root)
  const workspace = join(canonicalRoot, 'workspace with spaces')
  const fakeBin = join(root, 'bin')
  const dockerArgsPath = join(root, 'docker-args')
  const fakeDockerPath = join(fakeBin, 'docker')
  const relativeInput = 'content/book with spaces.epub'
  const absoluteInput = join(workspace, relativeInput)
  const absoluteOutput = join(workspace, 'output with spaces')

  await mkdir(join(workspace, 'content'), { recursive: true })
  await mkdir(fakeBin, { recursive: true })
  await writeFile(absoluteInput, 'fixture')
  await writeFile(fakeDockerPath, "#!/bin/sh\nprintf '%s\\0' \"$@\" > \"$AUTOSHOW_DOCKER_ARGS_FILE\"\n")
  await chmod(fakeDockerPath, 0o755)

  const process = Bun.spawn({
    cmd: [
      wrapperPath,
      'extract',
      relativeInput,
      absoluteInput,
      '--output-root',
      absoluteOutput
    ],
    cwd: workspace,
    env: {
      ...Bun.env,
      PATH: `${fakeBin}${delimiter}${Bun.env['PATH'] ?? ''}`,
      AUTOSHOW_DOCKER_ARGS_FILE: dockerArgsPath,
      AUTOSHOW_ENV: join(root, 'missing.env'),
      AUTOSHOW_IMAGE: 'autoshow-wrapper-test'
    },
    stdout: 'pipe',
    stderr: 'pipe'
  })

  expect(await process.exited).toBe(0)

  const args = (await readFile(dockerArgsPath))
    .toString()
    .split('\0')
    .filter(Boolean)

  expect(args).toEqual([
    'run',
    '--rm',
    '-i',
    '--mount',
    `type=bind,src=${workspace},dst=${workspace}`,
    '-w',
    workspace,
    'autoshow-wrapper-test',
    'extract',
    relativeInput,
    absoluteInput,
    '--output-root',
    absoluteOutput
  ])
})
