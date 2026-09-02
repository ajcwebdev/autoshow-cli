import { expect, test } from 'bun:test'
import { readFile,readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { readDependencyUrlAndSha256 } from '~/cli/commands/setup-and-utilities/setup/dependency-metadata'

const repositoryRoot = resolve(import.meta.dir, '../../../..')
const dockerfilePath = resolve(repositoryRoot, 'Dockerfile')
const dockerDocsPath = resolve(repositoryRoot, 'docs/docker.md')
const scriptsPath = resolve(repositoryRoot, 'scripts')

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

  const downloadIndex = dockerfile.indexOf("const response = await fetch(url)")
  const checksumIndex = dockerfile.indexOf('"${YT_DLP_SHA256}" /usr/local/bin/yt-dlp | sha256sum -c -')
  const chmodIndex = dockerfile.indexOf('chmod 0755 /usr/local/bin/yt-dlp')

  expect(downloadIndex).toBeGreaterThan(-1)
  expect(checksumIndex).toBeGreaterThan(downloadIndex)
  expect(chmodIndex).toBeGreaterThan(checksumIndex)

  const fetchStage = dockerfile.slice(dockerfile.indexOf('AS fetch'), dockerfile.indexOf('AS runtime'))
  const runtimeStage = dockerfile.slice(dockerfile.indexOf('AS runtime'))
  expect(fetchStage).toContain('for await (const chunk of response.body) writer.write(chunk)')
  expect(dockerfile).toContain('FROM --platform=$BUILDPLATFORM ${BUN_BASE_IMAGE} AS fetch')
  expect(fetchStage).not.toContain('curl')
  expect(runtimeStage).not.toContain('curl')
  expect(runtimeStage).toContain('COPY --from=fetch /usr/local/bin/yt-dlp /usr/local/bin/yt-dlp')
})

test('Docker documentation exposes only reviewed repository scripts and direct image invocation', async () => {
  const dockerDocs = await readFile(dockerDocsPath, 'utf8')

  expect(existsSync(scriptsPath) ? (await readdir(scriptsPath)).sort() : []).toEqual([
    'bun-env-compat.ts',
    'bun-profile.ts',
    'docker-bun-baseline.ts',
    'profile-workloads'
  ])
  expect(dockerDocs).toContain('bun autoshow extract content/book/book.epub')
  expect(dockerDocs).toContain('docker run --rm -i')
})

test('Docker images carry immutable build identity and publish provenance plus SBOM attestations', async () => {
  const dockerfile = await readFile(dockerfilePath, 'utf8')
  const workflow = await readFile(resolve(repositoryRoot, '.github/workflows/docker-publish.yml'), 'utf8')

  expect(dockerfile).toContain('ARG AUTOSHOW_VERSION=')
  expect(dockerfile).toContain('ARG BUILD_DATE=')
  expect(dockerfile).toContain('ARG VCS_REF=')
  expect(dockerfile).toContain('org.opencontainers.image.revision="${VCS_REF}"')
  expect(dockerfile).toContain('org.opencontainers.image.source="https://github.com/ajcwebdev/autoshow-cli"')
  expect(workflow.match(/--provenance=mode=max/g)).toHaveLength(2)
  expect(workflow.match(/--sbom=true/g)).toHaveLength(2)
  expect(workflow.match(/--build-arg "VCS_REF=\$\{GITHUB_SHA\}"/g)).toHaveLength(2)
})

test('Docker publication is blocked by exact-version no-cost verification and package hygiene', async () => {
  const workflowSource = await readFile(resolve(repositoryRoot, '.github/workflows/docker-publish.yml'), 'utf8')
  const workflow = Bun.YAML.parse(workflowSource) as {
    on?: { pull_request?: unknown, push?: unknown }
    jobs?: Record<string, {
      if?: string
      needs?: string[]
      permissions?: Record<string, string>
      steps?: Array<{ name?: string, run?: string, with?: Record<string, unknown> }>
    }>
  }
  const jobs = workflow.jobs ?? {}
  const verify = jobs['verify']
  const hygiene = jobs['package-hygiene']
  const verifyRuns = verify?.steps?.map(step => step.run ?? '').join('\n') ?? ''
  const hygieneRuns = hygiene?.steps?.map(step => step.run ?? '').join('\n') ?? ''

  expect(workflow.on).toHaveProperty('pull_request')
  expect(workflow.on).toHaveProperty('push')
  expect(verify?.steps?.find(step => step.name === 'Install supported Bun')?.with?.['bun-version']).toBe('1.4.0')
  expect(verifyRuns).toContain('bun --no-env-file install --frozen-lockfile')
  expect(verifyRuns).toContain('bun --no-env-file run check')
  expect(verifyRuns).toContain('bun --no-env-file t --price')
  expect(verifyRuns).toContain('cli-help-contracts.test.ts')
  expect(verifyRuns).toContain('cli-usage-errors/')
  expect(verifyRuns).toContain('option-resolution-contracts/')
  expect(verifyRuns).toContain('apt-get install --no-install-recommends --yes imagemagick')
  for (const contract of [
    'args-selection.test.ts',
    'budget-preflight.test.ts',
    'bounded-text-stream-contracts.test.ts',
    'comic-image-composition-contracts.test.ts',
    'fetch-error-contracts.test.ts',
    'multipart-serialization-contracts.test.ts',
    'profiling-recipes-contracts.test.ts',
    'reference-tokenizer-contracts.test.ts'
  ]) {
    expect(verifyRuns).toContain(contract)
  }
  expect(verifyRuns).not.toContain('bun run t')
  expect(verifyRuns).not.toContain('bun test/test-runner.ts')
  expect(JSON.stringify(verify)).not.toMatch(/API_KEY|secrets\./)

  expect(hygieneRuns).toContain('bun audit')
  expect(hygieneRuns).toContain('bun dedupe --check')
  expect(hygieneRuns).toContain('bun audit fix --dry-run')
  expect(hygieneRuns).toContain('bun prune --dry-run')
  expect(hygieneRuns).toContain('bun pm licenses --prod --json')
  expect(hygieneRuns.match(/env -i PATH=/g)).toHaveLength(6)
  expect(hygieneRuns).toContain('HOME="${RUNNER_TEMP}/bun-package-home" CI=true')
  expect(hygiene?.steps?.some(step => step.name === 'Upload production license report')).toBe(true)
  expect(hygiene?.steps?.some(step => step.name === 'Upload dependency cleanup review')).toBe(true)

  for (const jobName of ['build-amd64', 'build-arm64']) {
    expect(jobs[jobName]?.needs).toEqual(['verify', 'package-hygiene'])
    expect(jobs[jobName]?.if).toBe("github.event_name == 'push'")
    expect(jobs[jobName]?.permissions).toMatchObject({ contents: 'read', packages: 'write' })
    const buildRuns = jobs[jobName]?.steps?.map(step => step.run ?? '').join('\n') ?? ''
    expect(buildRuns).toContain('install --frozen-lockfile --production')
    expect(buildRuns).toContain('config --show')
    expect(buildRuns).toContain('setup --doctor')
    expect(buildRuns).toContain('write /benchmark/input.md --price --no-color')
    expect(buildRuns).toContain('compiled-paths.log')
    expect(buildRuns).toContain('Setup doctor completed')
    expect(buildRuns).toContain('Estimate:')
    expect(buildRuns).toContain('Expected [0-9]+ files in ')
    expect(buildRuns).toContain('coldHelpWallMs')
    expect(buildRuns).toContain('cliPrebuildMs')
    expect(buildRuns).toContain('fixturePeakRssBytes')
    expect(buildRuns).toContain('--target compiled-experiment')
    expect(buildRuns).toContain('compiled-entrypoint-experiment.json')
    expect(buildRuns).toContain('helpPeakRssBytes')
    expect(buildRuns).toContain('--arg decision reject')
    expect(buildRuns).toContain('managed-toolchain-smoke.pdf')
    expect(jobs[jobName]?.steps?.some(step => step.name?.startsWith('Upload ') && step.name.endsWith(' verification evidence'))).toBe(true)
  }
})

test('compiled Docker entrypoint remains an isolated measured experiment', async () => {
  const dockerfile = await readFile(dockerfilePath, 'utf8')
  expect(dockerfile).toContain('FROM runtime-base AS compiled-experiment')
  expect(dockerfile).toContain('FROM runtime AS production')
  expect(dockerfile).toContain('--compile')
  expect(dockerfile).toContain('--bytecode')
  expect(dockerfile).toContain('--format=esm')
  expect(dockerfile).toContain('--no-compile-autoload-dotenv')
  expect(dockerfile).toContain('--compile-exec-argv=--no-orphans')
  expect(dockerfile).toContain('--asset=src/prompts/entries/summary-and-overview')
  expect(dockerfile).toContain('--asset=src/tools/o200k-base-ranks.tiktoken.gz')
  expect(dockerfile).toContain('--asset=src/cli/commands/setup-and-utilities/models/stt-config')
  expect(dockerfile).toContain("--asset-naming='[dir]/[name].[ext]'")
  expect(dockerfile).toContain('--metafile-md=/app/compiled-entrypoint-metafile.md')
  expect(dockerfile).not.toContain('COPY --chown=bun:bun src/tools/o200k-base-ranks.tiktoken.gz')
  expect(dockerfile.trimEnd()).toEndWith('FROM runtime AS production')

  const runtimePaths = await readFile(resolve(repositoryRoot, 'src/utils/runtime-paths.ts'), 'utf8')
  expect(runtimePaths).toContain('Bun.isStandaloneExecutable')
  expect(runtimePaths).toContain('dirname(process.execPath)')
  expect(runtimePaths).toContain('IMMUTABLE_ASSET_ROOT')
})
