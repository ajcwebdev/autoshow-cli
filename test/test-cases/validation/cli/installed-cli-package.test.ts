import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, readdir, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { SUPPORTED_BUN_VERSION } from '~/utils/bun-version'
import { writeStoredZip } from '../text/ocr/epub-contracts/shared'

const checkout = resolve(import.meta.dir, '../../../..')

test('a packed CLI runs from a read-only installation with an independent, reusable workspace', async () => {
  const root = await mkdtemp(join(tmpdir(), 'autoshow-package-'))
  const home = join(root, 'home')
  const consumer = join(root, 'consumer')
  const workspace = join(root, 'workspace with spaces')
  const payload = join(root, 'payload')
  const archive = join(root, 'autoshow.tgz')
  const bun = process.execPath
  const bin = join(consumer, 'node_modules/.bin/autoshow')
  const env = {
    HOME: home, PATH: [dirname(bin), dirname(bun), '/usr/bin', '/bin'].join(':'),
    BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0',
    BUN_INSTALL_CACHE_DIR: join(root, 'bun-cache'),
  }
  function run(cmd: string[], cwd = workspace, overrides: Record<string, string> = {}, expected = 0) {
    const result = Bun.spawnSync(cmd, {
      cwd, env: { ...env, ...overrides }, stdout: 'pipe', stderr: 'pipe', timeout: 30_000,
    })
    const output = result.stdout.toString() + result.stderr.toString()
    expect(result.exitCode, output.slice(-4000)).toBe(expected)
    return output
  }

  let installDir: string | undefined
  try {
    for (const dir of [home, consumer, workspace]) await mkdir(dir)
    await Bun.write(join(root, 'package.json'), JSON.stringify({ name: 'unrelated-parent', private: true }))
    const build = [bun, '--no-env-file', 'src/tools/build-cli-package.ts', payload]
    run(build, checkout)
    const payloadManifest = await Bun.file(join(payload, 'package.json')).text()
    run(build, checkout, {}, 1)
    expect(await Bun.file(join(payload, 'package.json')).text()).toBe(payloadManifest)
    run([bun, 'pm', 'pack', '--ignore-scripts', '--filename', archive], payload)
    await Bun.write(join(consumer, 'package.json'), '{}')
    run([bun, 'add', '--offline', archive], consumer)
    installDir = dirname(await realpath(bin))
    expect(installDir).toBe(join(await realpath(consumer), 'node_modules', 'autoshow-bun-cli'))
    expect(await Bun.file(join(installDir, 'src/cli/create-cli.ts')).exists()).toBe(false)
    const manifest = await Bun.file(join(installDir, 'package.json')).json()
    expect((await Bun.file(join(checkout, 'package.json')).json()).private).toBe(true)
    expect(manifest.private).toBe(true)
    expect(manifest.engines.bun).toBe(SUPPORTED_BUN_VERSION)
    expect(manifest.scripts?.postinstall).toBeUndefined()
    run(['chmod', '-R', 'a-w', installDir])

    expect(run([bin, '--version']).trim()).toBe('v' + manifest.version)
    const extractHelp = run([bin, 'extract', '--help'])
    expect(extractHelp).toContain('$ autoshow extract')
    expect(extractHelp).not.toContain('$ bun autoshow')
    const comicHelp = run([bin, 'comic', 'draft-scenes', '--help'])
    expect(comicHelp).toContain('consumed by autoshow comic generate-images')
    expect(comicHelp).not.toContain('bun autoshow')
    const missingInput = 'missing bun autoshow example.md'
    const writeError = run([bin, 'write', missingInput, '--json'], workspace, {}, 2)
    expect(writeError).toContain(`Input does not exist: ${missingInput}. Run: autoshow help write`)
    expect(run([bin, 'write', '--help-topic', 'provider:openai'])).toMatch(/Registered models: gpt-/)
    expect(run([bin, 'write', '--help-topic', 'prompts'])).toContain('shortSummary')
    expect(run([bin, 'setup', '--dry-run'])).toContain('Setup plan')
    const doctorOutput = run([bin, 'setup', '--doctor', '--json'])
    expect(doctorOutput).toContain('bundled')
    expect(doctorOutput).not.toContain('bun autoshow')
    const doctor = JSON.parse(doctorOutput.split('\n')[0]!).data.report
    const toolchain = 'autoshow setup --step toolchain'
    expect(doctor.nextSteps).toContain(toolchain)
    expect(run([...toolchain.split(' '), '--dry-run'])).toContain('Setup plan')
    expect(await readdir(workspace)).toEqual([])

    const worker = join(installDir, 'stt-onnx-worker.js')
    expect(run([bun, '--no-env-file', worker], workspace, {}, 1)).toContain('Expected model directory')
    const xml = '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Local package example.</w:t></w:r></w:p></w:body></w:document>'
    await writeStoredZip(join(workspace, 'sample.docx'), { 'word/document.xml': xml })
    run([bin, 'extract', 'sample.docx', '--docx-markdown', '--output-dir', 'result'])
    expect(await Bun.file(join(workspace, 'result/extraction.md')).text()).toBe('Local package example.\n')
    expect(await Bun.file(join(workspace, 'result/manifest.json')).text()).toContain('extraction.md')

    run([bin, 'setup', '--cookies-from-browser', 'chrome'])
    const config = Bun.file(join(workspace, 'runtime/autoshow.json'))
    const before = await config.text()
    expect(before).toContain('chrome')
    expect(run([bin, 'setup', '--show', '--json'], consumer, { AUTOSHOW_PROJECT_ROOT: workspace })).toContain('chrome')
    expect(await config.text()).toBe(before)
    expect(await Bun.file(join(installDir, 'runtime/autoshow.json')).exists()).toBe(false)
    const missingCookies = join(workspace, 'missing-cookies.txt')
    await Bun.write(config, JSON.stringify({ ...JSON.parse(before), auth: { cookies: missingCookies } }))
    const guide = join(installDir, 'docs/commands/00-setup-and-utilities/cookies.md')
    expect(run([bin, 'setup', '--doctor', '--json'])).toContain(guide)
    expect(await Bun.file(guide).text()).toContain('YouTube Cookies')
  } finally {
    if (installDir) run(['chmod', '-R', 'u+w', installDir], root)
    await rm(root, { recursive: true, force: true })
  }
}, 90_000)
