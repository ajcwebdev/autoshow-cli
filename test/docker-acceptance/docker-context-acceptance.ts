import { lstat, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { runDockerProcess } from '../../src/tools/docker-process'
import type { ProcessRunner } from '../../src/tools/docker-process'
import { requireCondition } from '../test-utils/require-condition'

// Every context file is authored here. The checkout contributes only its ignore
// rules; workspace inputs, runtime state, and dependency trees are never read.
export const REQUIRED_CONTEXT_FILES: Readonly<Record<string, string>> = {
  'package.json': '{"name":"authored-context-root","private":true}\n',
  'bun.lock': 'authored root lockfile\n',
  'bunfig.toml': '# authored root configuration\n',
  'tsconfig.json': '{"compilerOptions":{}}\n',
  'src/context-fixture.ts': 'export const authoredContext = true\n',
  'src/nested/deeper/context-fixture.txt': 'authored nested application source\n',
  'config/defuddle/package.json': '{"name":"authored-defuddle-context"}\n',
  'config/defuddle/bun.lock': 'authored Defuddle lockfile\n',
  'config/defuddle/nested/fixture.txt': 'authored nested Defuddle configuration\n',
  'config/stt-alignment/package.json': '{"name":"authored-alignment-context"}\n',
  'config/stt-alignment/bun.lock': 'authored alignment lockfile\n',
  'config/stt-alignment/nested/fixture.ts': 'export const authoredAlignment = true\n',
}

export const EXCLUDED_CONTEXT_FILES: Readonly<Record<string, string>> = Object.fromEntries([
  'unrelated-root.txt', 'docs/unrelated.md', 'test/unrelated.test.ts',
  'input/authored-input.txt', 'output/authored-output.txt', 'runtime/authored-state.txt',
  'config/autoshow.json', 'config/unrelated.txt', 'config/unrelated/nested.txt',
  'node_modules/authored-dependency/index.js', 'src/node_modules/authored-dependency/index.js',
  'src/nested/node_modules/authored-dependency/index.js',
  'config/defuddle/node_modules/authored-dependency/index.js',
  'config/stt-alignment/nested/node_modules/authored-dependency/index.js',
  '.env', '.env.local', '.git/config', 'src/.env', 'src/nested/.env.local',
  'config/defuddle/.env', 'config/stt-alignment/nested/.env.production',
  'root.log', 'src/application.log', 'src/nested/deeper/trace.log',
  'config/defuddle/debug.log', 'config/stt-alignment/nested/worker.log',
].map(path => [path, `authored excluded context fixture: ${path}\n`]))

export async function verifyDockerContextOutput(directory: string): Promise<void> {
  const files: string[] = []
  async function visit(relativeDirectory: string): Promise<void> {
    for (const entry of await readdir(join(directory, relativeDirectory), { withFileTypes: true })) {
      if (entry.name === '.DS_Store') continue
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name
      if (entry.isDirectory()) await visit(relativePath)
      else {
        requireCondition(entry.isFile(), `Unexpected non-regular context artifact: ${relativePath}`)
        files.push(relativePath)
      }
    }
  }
  await visit('')
  for (const [path, expected] of Object.entries(REQUIRED_CONTEXT_FILES)) {
    requireCondition(files.includes(path), `Required build-context input is missing: ${path}`)
    requireCondition(await Bun.file(join(directory, path)).text() === expected, `Build-context input bytes changed: ${path}`)
  }
  const unexpected = files.filter(path => !Object.hasOwn(REQUIRED_CONTEXT_FILES, path))
  requireCondition(unexpected.length === 0, `Excluded files entered the build context: ${unexpected.join(', ')}`)
}

export interface DockerContextGateResult {
  status: 'passed'
  includedFiles: number
  excludedFixtures: number
  ignoreSha256: string
}

export async function runDockerContextAcceptance(
  processRunner: ProcessRunner = runDockerProcess,
  ignorePath = resolve(import.meta.dir, '../../.dockerignore')
): Promise<DockerContextGateResult> {
  const ignore = await Bun.file(ignorePath).bytes()
  const directory = await mkdtemp(join(tmpdir(), 'autoshow-authored-docker-context-'))
  try {
    const context = join(directory, 'context')
    const output = join(directory, 'export')
    await mkdir(context)
    for (const [path, content] of Object.entries({ ...REQUIRED_CONTEXT_FILES, ...EXCLUDED_CONTEXT_FILES })) {
      await Bun.write(join(context, path), content)
    }
    await Bun.write(join(context, '.dockerignore'), ignore)
    await Bun.write(join(context, 'Dockerfile'), 'FROM scratch\nCOPY . /\n')
    // `docker build` uses the daemon's built-in builder. With a scratch base and
    // no frontend directive or RUN, this needs neither an image pull nor network.
    const built = await processRunner([
      'build', '--network', 'none', '--no-cache', '--progress', 'plain',
      '--output', `type=local,dest=${output}`, context,
    ], 120_000, join(directory, 'build'))
    requireCondition(!built.timedOut, 'Authored Docker build-context gate timed out')
    requireCondition(built.exitCode === 0, `Authored Docker build-context gate failed:\n${built.stderr}\n${built.stdout}`)
    requireCondition((await lstat(output)).isDirectory(), 'BuildKit did not export the authored context')
    await verifyDockerContextOutput(output)
    return {
      status: 'passed', includedFiles: Object.keys(REQUIRED_CONTEXT_FILES).length,
      excludedFixtures: Object.keys(EXCLUDED_CONTEXT_FILES).length,
      ignoreSha256: new Bun.CryptoHasher('sha256').update(ignore).digest('hex'),
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

if (import.meta.main) {
  requireCondition(Bun.argv.length === 2, 'Usage: bun --no-env-file test/docker-acceptance/docker-context-acceptance.ts')
  console.log(JSON.stringify(await runDockerContextAcceptance()))
}
