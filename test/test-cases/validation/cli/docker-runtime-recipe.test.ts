import { expect, test } from 'bun:test'
import { mkdtemp, mkdir, readFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { loadConfig } from '~/cli/commands/setup-and-utilities/config-command/config-loader'
import { writeConfig } from '~/cli/commands/setup-and-utilities/config-command/config-writer'

const repositoryRoot = resolve(import.meta.dir, '../../../..')
const dockerfile = await readFile(join(repositoryRoot, 'Dockerfile'), 'utf8')
const stages = dockerfile.split(/^(?=FROM )/m).filter(stage => stage.startsWith('FROM '))
const stageNamed = (name: string): string => stages.find(stage => new RegExp(`^FROM .+ AS ${name}\\n`).test(stage)) ?? ''

test('default Docker target retains the source runtime and isolates optional alignment dependencies', () => {
  expect(stages.map(stage => stage.match(/^FROM .+ AS (\S+)/)?.[1])).toEqual(['youtube-js', 'deps', 'runtime', 'alignment', 'production'])
  expect(stages.at(-1)?.trim()).toBe('FROM runtime AS production')
  const runtime = stageNamed('runtime')
  expect(runtime).toContain('ENTRYPOINT ["bun", "--no-env-file", "/app/src/cli/create-cli.ts"]')
  expect(runtime).toContain('CMD ["help"]')
  expect(runtime).not.toMatch(/\b(?:bun .*build|--compile)\b/)
  expect(runtime).not.toContain('config/stt-alignment')
  expect(runtime).toContain('ENV AUTOSHOW_DISABLE_HTTP_KEEPALIVE=1')
})

test('alignment installs frozen dependencies with build permissions then returns to a non-root runtime', () => {
  const alignment = stageNamed('alignment')
  let user = 'bun'
  const installs = []
  for (const line of alignment.split('\n')) {
    if (line.startsWith('USER ')) user = line.slice('USER '.length)
    if (/^RUN .*\bbun\b.*\binstall\b/.test(line)) installs.push({ user, command: line })
  }
  expect(installs).toHaveLength(1)
  expect(installs[0]?.user).toBe('root')
  expect(installs[0]?.command).toMatch(/--cwd config\/stt-alignment\b/)
  expect(installs[0]?.command).toContain('--frozen-lockfile')
  expect(installs[0]?.command).toContain('--ignore-scripts')
  expect(user).toBe('bun')
})

test('the image config link preserves real config creation, update, and reset in an initially empty runtime mount', async () => {
  const target = stageNamed('runtime').match(/ln -s (\S+) config\/autoshow\.json/)?.[1]
  expect(target).toBe('../runtime/autoshow.json')
  const root = await mkdtemp(join(tmpdir(), 'autoshow-docker-config-'))
  try {
    await mkdir(join(root, 'config'))
    await mkdir(join(root, 'runtime'))
    const configPath = join(root, 'config/autoshow.json')
    await symlink(target!, configPath)
    expect(await loadConfig(configPath)).toEqual({})
    await writeConfig(configPath, { pricing: { maxCents: 25 } })
    expect(await loadConfig(configPath)).toEqual({ pricing: { maxCents: 25 } })
    expect(JSON.parse(await readFile(join(root, 'runtime/autoshow.json'), 'utf8'))).toEqual({ pricing: { maxCents: 25 } })
    await writeConfig(configPath, {})
    expect(await loadConfig(configPath)).toEqual({})
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
