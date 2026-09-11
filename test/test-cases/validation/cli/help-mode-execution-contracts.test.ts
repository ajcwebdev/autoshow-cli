import { expect, test } from 'bun:test'
import { mkdtemp, stat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PROJECT_ROOT } from '~/utils/runtime-paths'
import { musicCommand } from '~/cli/commands/audio/music/define-music-command'
import { setupCommand } from '~/cli/commands/setup-and-utilities/setup/define-setup-command'
import { referenceSketchCommandDefinition } from '~/cli/commands/visuals/comic/comic-utils/subcommand-help'
import { SETUP_FOCUSED_MODE_FLAGS, SETUP_NETWORK_DEPENDENT_FLAGS } from '~/cli/flags/setup-mode-contract'
import { asCtx, parseRoot } from './cli-usage-errors/shared'

test('music price mode reports pinned single/batch directories without creating them or running tools', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'autoshow-help-music-'))
  try {
    const audio = join(directory, 'sample.wav')
    await Bun.write(audio, 'fixture: not decodable audio, so a real renderer must not run')
    for (const mode of [['--audio', audio], ['--batch', directory]]) {
      const outputDir = join(directory, mode[0] === '--audio' ? 'single-output' : 'batch-output')
      const proc = Bun.spawn([process.execPath, '--no-env-file', join(PROJECT_ROOT, 'src/cli/create-cli.ts'), 'music', ...mode, '--price', '--output-dir', outputDir, '--config-path', join(directory, 'absent-config.json'), '--no-color'], {
        cwd: PROJECT_ROOT,
        env: { PATH: process.env['PATH'] ?? '', HOME: directory, NO_COLOR: '1' },
        stdout: 'pipe', stderr: 'pipe',
      })
      const [stdout, stderr, status] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited])
      expect(status, stderr).toBe(0)
      expect(stdout + stderr).toContain(outputDir)
      expect(stdout + stderr).toContain('0.00')
      await expect(stat(outputDir)).rejects.toMatchObject({ code: 'ENOENT' })
    }
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('setup mode exclusions reject at the handler boundary before installation or diagnostics', async () => {
  const values: Record<string, string> = { models: 'tiny', step: 'music', 'probe-url': 'https://example.com', 'probe-client': 'fetch', 'delay-seconds': '1', port: '12345' }
  for (const name of SETUP_FOCUSED_MODE_FLAGS) {
    const parsed = parseRoot(['setup', '--network-check', 'serve', `--${name}`, ...(values[name] ? [values[name]!] : [])])
    await expect(setupCommand.handler(asCtx(parsed))).rejects.toThrow('cannot be combined')
  }
  for (const name of SETUP_NETWORK_DEPENDENT_FLAGS) {
    const parsed = parseRoot(['setup', `--${name}`, values[name]!])
    await expect(setupCommand.handler(asCtx(parsed))).rejects.toThrow('--network-check')
  }
  await expect(setupCommand.handler(asCtx(parseRoot(['setup', '--strict'])))).rejects.toThrow('--doctor')
})

test('music mode conflicts reject before any local or hosted work', async () => {
  for (const args of [
    ['--audio', 'missing.wav', '--batch', 'missing'],
    ['--captions', 'missing.vtt', '--batch', 'missing'],
    ['--audio', 'missing.wav', '--instrumental'],
    ['prompt', '--captions', 'missing.vtt'],
  ]) await expect(musicCommand.handler(asCtx(parseRoot(['music', ...args])))).rejects.toThrow('Do not')
})

test('reference handler rejects QA-only for either reference kind before catalog/provider access', async () => {
  for (const kind of ['character', 'location']) {
    // parseNativeCli records unknown flags; dispatcher rejects them and the handler's
    // explicit applicability guard also protects direct handler calls.
    const parsed = parseRoot(['comic', 'reference-sketch', `--${kind}`, 'nonexistent-reference', '--qa-only'])
    await expect(referenceSketchCommandDefinition.handler(asCtx(parsed))).rejects.toThrow('--qa-only')
  }
})
