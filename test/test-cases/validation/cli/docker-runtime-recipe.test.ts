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
  expect(stages.map(stage => stage.match(/^FROM .+ AS (\S+)/)?.[1])).toEqual(['youtube-js', 'deps', 'alignment-deps', 'runtime', 'alignment', 'production'])
  expect(stages.at(-1)?.trim()).toBe('FROM runtime AS production')
  const runtime = stageNamed('runtime')
  expect(runtime).toContain('ENTRYPOINT ["bun", "--no-env-file", "/app/src/cli/create-cli.ts"]')
  expect(runtime).toContain('CMD ["help"]')
  expect(runtime).not.toMatch(/\b(?:bun .*build|--compile)\b/)
  expect(runtime).not.toContain('config/stt-alignment')
  expect(runtime).toContain('ENV AUTOSHOW_DISABLE_HTTP_KEEPALIVE=1')
})

test('alignment copies a frozen, normalized target-native graph without installing into runtime HOME', () => {
  const alignment = stageNamed('alignment')
  const builder = stageNamed('alignment-deps')
  expect(alignment).toContain('COPY --from=alignment-deps')
  expect(alignment).not.toMatch(/^(?:USER|RUN) /m)
  expect(builder).toContain('WORKDIR /app/config/stt-alignment')
  expect(builder).toContain('bun --no-env-file install --frozen-lockfile --ignore-scripts')
  expect(builder).toContain('chmod -R a+rX,go-w .')
  expect(builder).toContain('ARG TARGETARCH')
  expect(builder).toContain('amd64) arch=x64')
  expect(builder).toContain('arm64) arch=arm64')
  expect(builder).toContain('Unsupported target architecture')
  expect(builder).toContain('onnxruntime_binding.node')
  expect(stageNamed('runtime')).toContain('USER bun')
  expect(stageNamed('deps')).toContain('--production --omit=peer')
  expect(stageNamed('runtime')).not.toContain('runtime/tools/tessdata')
  expect(stageNamed('runtime')).not.toContain('/usr/local/bin/tesseract')
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
