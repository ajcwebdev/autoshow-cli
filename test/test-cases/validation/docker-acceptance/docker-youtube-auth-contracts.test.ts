import { afterAll, expect, test } from 'bun:test'
import { mkdtemp, mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { DockerEngine } from '../../../../scripts/docker-acceptance/docker-engine'
import { parseDockerOptions } from '../../../../scripts/docker-acceptance/docker-options'
import { withDockerYoutubeCookies, youtubeCookiesOnly, YOUTUBE_COOKIE_MOUNT } from '../../../../scripts/docker-acceptance/docker-youtube-auth'
import { PUBLIC_DOWNLOADS } from '../../../scenarios/local-cli-contracts'

const roots: string[] = []
afterAll(async () => { for (const root of roots) await rm(root, { recursive: true, force: true }) })
const youtubeValue = 'synthetic-youtube-cookie-value'
const otherValue = 'synthetic-unrelated-cookie-value'
const cookies = `# Netscape HTTP Cookie File\n# comment\n#HttpOnly_.youtube.com\tTRUE\t/\tTRUE\t0\tSID\t${youtubeValue}\n.google.com\tTRUE\t/\tTRUE\t0\tSID\t${otherValue}\nnotyoutube.com\tFALSE\t/\tFALSE\t0\tSID\t${otherValue}\n`

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-youtube-contract-'))
  roots.push(root)
  const source = join(root, 'cookies.txt')
  await writeFile(source, cookies, { mode: 0o600 })
  return { root, source }
}

test('YouTube authentication filters other domains and rejects malformed cookie files without disclosing contents', () => {
  const filtered = youtubeCookiesOnly(cookies)
  expect(filtered).toContain(`#HttpOnly_.youtube.com\tTRUE\t/\tTRUE\t0\tSID\t${youtubeValue}`)
  expect(filtered).not.toContain(otherValue)
  expect(() => youtubeCookiesOnly('not a cookie file')).toThrow('Netscape')
  expect(() => youtubeCookiesOnly('# Netscape HTTP Cookie File\ninvalid')).toThrow('Invalid Netscape cookie record')
  expect(() => youtubeCookiesOnly('# Netscape HTTP Cookie File\n')).toThrow('no YouTube cookies')
})

test('cookie snapshots are private, disposable, and never change the original after success or failure', async () => {
  const { root, source } = await fixture()
  for (const fails of [false, true]) {
    let snapshot = ''
    const result = withDockerYoutubeCookies(source, [join(root, 'evidence'), join(root, 'cache')], async auth => {
      snapshot = auth.mount.host
      expect(auth.mount.container).toBe(YOUTUBE_COOKIE_MOUNT)
      expect(auth.mount.readonly).toBe(true)
      expect(auth.groupId).toBe(process.getgid!())
      expect((await stat(dirname(snapshot))).mode & 0o777).toBe(0o700)
      expect((await stat(snapshot)).mode & 0o777).toBe(0o640)
      expect(await readFile(snapshot, 'utf8')).toBe(youtubeCookiesOnly(cookies))
      if (fails) throw new Error('simulated container failure')
      return 'complete'
    })
    if (fails) await expect(result).rejects.toThrow('simulated container failure')
    else expect(await result).toBe('complete')
    expect(await Bun.file(snapshot).exists()).toBe(false)
    expect(await readFile(source, 'utf8')).toBe(cookies)
    expect((await stat(source)).mode & 0o777).toBe(0o600)
  }
})

test('cookie sources in evidence or cache are rejected, including symbolic-link aliases', async () => {
  const { root, source } = await fixture()
  let invoked = false
  const run = async () => { invoked = true }
  await expect(withDockerYoutubeCookies(source, [root], run)).rejects.toThrow('outside acceptance evidence and caches')
  const alias = join(root, 'alias')
  await symlink(root, alias)
  await expect(withDockerYoutubeCookies(source, [alias], run)).rejects.toThrow('outside acceptance evidence and caches')
  expect(invoked).toBe(false)
  expect(() => parseDockerOptions(['--suite', 'core', '--youtube-cookies', source])).toThrow('all or network')
  expect(() => parseDockerOptions(['--suite', 'models', '--youtube-cookies', source])).toThrow('all or network')
})

test('only the registered YouTube container receives cookies; logs and shared mounts contain no cookie contents', async () => {
  const { root, source } = await fixture()
  const calls: string[][] = []
  let snapshot = ''
  const options = parseDockerOptions(['--suite', 'network', '--youtube-cookies', source, '--output', join(root, 'evidence'), '--cache', join(root, 'cache')])
  const engine = new DockerEngine(options, async args => {
    calls.push(args)
    if (args[0] === 'run' && args.includes('--group-add')) {
      const mount = args.find(arg => arg.includes(`dst=${YOUTUBE_COOKIE_MOUNT}`))!
      snapshot = mount.slice('type=bind,src='.length).split(',dst=')[0]!
      expect(await readFile(snapshot, 'utf8')).toBe(youtubeCookiesOnly(cookies))
    }
    return { exitCode: 0, stdout: 'complete', stderr: '', durationMs: 1, timedOut: false }
  })
  engine.identity = { requestedTag: 'unused', digest: `sha256:${'a'.repeat(64)}`, reference: `ghcr.io/ajcwebdev/autoshow-cli@sha256:${'a'.repeat(64)}`, platform: 'linux/arm64', imageId: 'test', revision: 'test', imageSizeBytes: 1, user: 'bun', entrypoint: ['bun', '--no-env-file', '/app/src/cli/create-cli.ts'] }
  await mkdir(options.output)
  await engine.prepareMounts()
  for (const [id, args, network] of [
    ['download-youtube', ['download', PUBLIC_DOWNLOADS.youtube], 'bridge'],
    ['download-twitch', ['download', PUBLIC_DOWNLOADS.twitch], 'bridge'],
    ['identity', ['--version'], 'none']
  ] as const) {
    engine.authorize([...args], network)
    await engine.cli([...args], id, network)
  }
  const runs = calls.filter(args => args[0] === 'run')
  expect(runs).toHaveLength(3)
  expect(runs[0]).toContain('--group-add')
  expect(runs[0]).not.toContain('--user')
  expect(runs[0]).toContain('/app/src/cli/create-cli.ts')
  expect(runs[0]!.join('\n')).toContain(`dst=${YOUTUBE_COOKIE_MOUNT},readonly`)
  for (const run of runs.slice(1)) {
    expect(run).not.toContain('--group-add')
    expect(run.join('\n')).not.toContain(YOUTUBE_COOKIE_MOUNT)
    expect(run).toContain('/fixtures/empty-config.json')
  }
  expect(engine.mounts.some(mount => mount.host === snapshot)).toBe(false)
  expect(await Bun.file(snapshot).exists()).toBe(false)
  for await (const file of new Bun.Glob('**/*').scan({ cwd: options.output, onlyFiles: true })) {
    const text = await readFile(join(options.output, file), 'utf8')
    expect(text).not.toContain(youtubeValue)
    expect(text).not.toContain(otherValue)
  }
  const otherArgs = ['download', 'https://example.com/audio.mp3']
  engine.authorize(otherArgs, 'bridge')
  await expect(engine.cli(otherArgs, 'download-youtube', 'bridge')).rejects.toThrow('registered YouTube download')
  expect(calls.filter(args => args[0] === 'run')).toHaveLength(3)
})
