import { expect, test } from 'bun:test'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { readDependencyUrlAndSha256 } from '~/cli/commands/setup-and-utilities/setup/dependency-metadata'
import { SUPPORTED_BUN_VERSION } from '~/utils/bun-version'

const repositoryRoot = resolve(import.meta.dir, '../../../..')
const dockerfilePath = resolve(repositoryRoot, 'Dockerfile')
const dockerDocsPath = resolve(repositoryRoot, 'docs/docker.md')

test('published image OCR smoke commands pass real CLI option validation', async () => {
  const workflow = await readFile(resolve(repositoryRoot, '.github/workflows/docker-publish.yml'), 'utf8')
  const commands = [...workflow.matchAll(/bun --no-env-file \/app\/src\/cli\/create-cli\.ts (extract \/benchmark\/fixture\.pdf [^;]+?) >\/dev\/null 2>&1/g)]
  expect(commands).toHaveLength(2)
  for (const [, command] of commands) {
    const args = command!.replace('/benchmark/fixture.pdf', 'test/fixtures/setup/managed-toolchain-smoke.pdf')
      .replace('/benchmark/output', '/tmp/autoshow-docker-smoke-price').split(' ')
    const result = Bun.spawnSync(['bun', '--no-env-file', 'src/cli/create-cli.ts', ...args, '--price'], {
      cwd: repositoryRoot,
      env: { PATH: process.env['PATH'], HOME: process.env['HOME'], NO_COLOR: '1' },
      stdout: 'pipe',
      stderr: 'pipe'
    })
    const output = result.stdout.toString() + result.stderr.toString()
    expect(result.exitCode, output).toBe(0)
    expect(output).toContain('Estimate:')
  }
})

test('all Docker runtime targets opt out of Bun TCP keepalive for silent provider requests', async () => {
  const dockerfile = await readFile(dockerfilePath, 'utf8')
  const runtimeBase = dockerfile.slice(dockerfile.indexOf('AS runtime-base'), dockerfile.indexOf('FROM runtime-base AS runtime'))
  expect(runtimeBase).toContain('ENV AUTOSHOW_DISABLE_HTTP_KEEPALIVE=1')
  expect(dockerfile).toContain('FROM runtime-base AS compiled-experiment')
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

test('Docker supplies a pinned native Deno runtime for yt-dlp in every runtime target', async () => {
  const dockerfile = await readFile(dockerfilePath, 'utf8')
  expect(dockerfile).toContain('ARG DENO_BASE_IMAGE=denoland/deno:bin-2.9.6@sha256:4cf0029b9aeeeed5efcbb71828737f0d7c8c8a20072df960e51a5679ef0d21ba')
  expect(dockerfile).toContain('FROM ${DENO_BASE_IMAGE} AS youtube-js')
  const runtimeBase = dockerfile.slice(dockerfile.indexOf('AS runtime-base'), dockerfile.indexOf('FROM runtime-base AS runtime'))
  expect(runtimeBase).toContain('COPY --from=youtube-js /deno /usr/local/bin/deno')
  expect(runtimeBase).toContain('RUN deno --version && yt-dlp --version')
  expect(dockerfile).toContain('FROM runtime-base AS compiled-experiment')
})

test('Docker documentation supports direct image invocation without a root scripts directory', async () => {
  const dockerDocs = await readFile(dockerDocsPath, 'utf8')

  expect(existsSync(resolve(repositoryRoot, 'scripts'))).toBe(false)
  expect(dockerDocs).toContain('bun autoshow extract input/examples/document/1-epub.epub')
  expect(dockerDocs).toContain('docker run --rm -i')
})

test('Docker images carry immutable build identity and publish provenance plus SBOM attestations', async () => {
  const dockerfile = await readFile(dockerfilePath, 'utf8')
  const workflow = await readFile(resolve(repositoryRoot, '.github/workflows/docker-publish.yml'), 'utf8')
  const stages = dockerfile.split(/^(?=FROM )/m)
  const stageName = (stage: string) => stage.match(/^FROM .+ AS (\S+)/)?.[1]
  const identityStages = stages.filter(stage => /^ARG VCS_REF=/m.test(stage))

  expect(identityStages.map(stageName)).toEqual(['runtime', 'compiled-experiment'])
  for (const stage of identityStages) {
    const lastRun = stage.lastIndexOf('RUN ')
    expect(lastRun).toBeGreaterThan(-1)
    for (const declaration of ['ARG AUTOSHOW_VERSION=', 'ARG BUILD_DATE=', 'ARG VCS_REF=']) {
      expect(stage.indexOf(declaration)).toBeGreaterThan(lastRun)
    }
    expect(stage).toContain('LABEL org.opencontainers.image.version="${AUTOSHOW_VERSION}"')
    expect(stage).toContain('LABEL org.opencontainers.image.created="${BUILD_DATE}"')
    expect(stage).toContain('LABEL org.opencontainers.image.revision="${VCS_REF}"')
  }
  const runtimeBase = stages.find(stage => stageName(stage) === 'runtime-base') ?? ''
  expect(runtimeBase).toContain('ARG DEBIAN_SNAPSHOT=')
  expect(runtimeBase).not.toMatch(/ARG (AUTOSHOW_VERSION|BUILD_DATE|VCS_REF)/)
  expect(runtimeBase).not.toMatch(/\$\{(AUTOSHOW_VERSION|BUILD_DATE|VCS_REF)\}/)
  expect(dockerfile).toContain('org.opencontainers.image.source="https://github.com/ajcwebdev/autoshow-cli"')
  expect(workflow.match(/--provenance=mode=max/g)).toHaveLength(2)
  expect(workflow.match(/--sbom=true/g)).toHaveLength(2)
  // The two publishing builds and the two compiled-experiment builds share the identity args so the compiled build reuses the per-arch registry cache.
  expect(workflow.match(/--build-arg "VCS_REF=\$\{GITHUB_SHA\}"/g)).toHaveLength(4)
  // Two publishing builds and two compiled-experiment builds import the per-architecture registry cache.
  expect(workflow.match(/--cache-from "type=registry,ref=\$\{image\}:buildcache-(amd64|arm64)"/g)).toHaveLength(4)
  expect(workflow).not.toContain(':buildcache" ')
})

test('dependency-graph image audits reuse the published per-architecture layer cache and rebuild weekly from scratch', async () => {
  const workflowSource = await readFile(resolve(repositoryRoot, '.github/workflows/dependency-graphs.yml'), 'utf8')
  const workflow = Bun.YAML.parse(workflowSource) as {
    on?: { schedule?: Array<{ cron: string }>, workflow_dispatch?: { inputs?: Record<string, { type?: string, default?: unknown }> } }
    jobs?: Record<string, { steps?: Array<{ name?: string, uses?: string, with?: Record<string, unknown>, env?: Record<string, string>, run?: string }> }>
  }
  const steps = workflow.jobs?.['images']?.steps ?? []
  const builder = steps.find(step => step.uses === 'docker/setup-buildx-action@8d2750c68a42422c14e847fe6c8ac0403b4cbd6f')
  const build = steps.find(step => step.name === 'Build this commit from the published layer cache or from scratch')

  expect(workflow.on?.schedule).toHaveLength(1)
  expect(workflow.on?.workflow_dispatch?.inputs?.['fresh_build']).toMatchObject({ type: 'boolean', default: false })
  expect(builder?.with).toMatchObject({
    version: 'v0.37.0',
    'driver-opts': 'image=moby/buildkit:v0.33.0@sha256:6c2fa84a6b61ccd72899dde4239f8d5717f05f9a8ca6f3cad185fb1a95a94de3'
  })
  expect(build?.env?.['FRESH_BUILD']).toBe("${{ github.event_name == 'schedule' || (github.event_name == 'workflow_dispatch' && inputs.fresh_build == true) }}")
  expect(build?.run).toContain('--cache-from "type=registry,ref=${image}:buildcache-${ARCH}"')
  expect(build?.run).toContain('set -- --pull --no-cache')
  expect(build?.run).toContain('--load')
  expect(build?.run).not.toContain('type=gha')
  expect(workflowSource).not.toContain('docker build --pull --no-cache')
})

test('Docker publication is blocked by exact-version no-cost verification and package hygiene', async () => {
  const workflowSource = await readFile(resolve(repositoryRoot, '.github/workflows/docker-publish.yml'), 'utf8')
  const workflow = Bun.YAML.parse(workflowSource) as {
    on?: { pull_request?: unknown, push?: unknown }
    jobs?: Record<string, {
      if?: string
      needs?: string[]
      'continue-on-error'?: boolean
      permissions?: Record<string, string>
      outputs?: Record<string, string>
      steps?: Array<{ name?: string, run?: string, uses?: string, if?: string, env?: Record<string, string>, with?: Record<string, unknown> }>
    }>
  }
  const jobs = workflow.jobs ?? {}
  const verify = jobs['verify']
  const hygiene = jobs['package-hygiene']
  const verifyRuns = verify?.steps?.map(step => step.run ?? '').join('\n') ?? ''
  const hygieneRuns = hygiene?.steps?.map(step => step.run ?? '').join('\n') ?? ''

  expect(workflow.on).toHaveProperty('pull_request')
  expect(workflow.on).toHaveProperty('push')
  expect(verify?.steps?.find(step => step.name === 'Install supported Bun')?.with?.['bun-version']).toBe(SUPPORTED_BUN_VERSION)
  expect(verifyRuns).toContain('bun --no-env-file install --frozen-lockfile')
  expect(verifyRuns).toContain('bun --no-env-file run check')
  expect(verifyRuns).toContain('bun --no-env-file t --price')
  expect(verifyRuns).toContain('cli-help-contracts.test.ts')
  expect(verifyRuns).toContain('cli-usage-errors/')
  expect(verifyRuns).toContain('option-resolution-contracts/')
  expect(verifyRuns).toContain('apt-get install --no-install-recommends --yes imagemagick')
  expect(verifyRuns).toContain('imagemagick ffmpeg mupdf-tools qpdf')
  expect(verifyRuns).toContain('bun --no-env-file t --price --no-cleanup')
  expect(verifyRuns).toContain('src/tools/ci-run-timings.ts price')
  expect(verifyRuns).toContain('wait "${apt_pid}"')
  expect(verifyRuns).toContain('wait "${check_pid}"')
  expect(verifyRuns).toContain('wait "${cli_pid}"')
  expect(verifyRuns).toContain('wait "${docker_pid}"')
  expect(verifyRuns).toContain('ci-run-timings-contracts.test.ts')
  expect(verifyRuns.indexOf('wait "${apt_pid}"')).toBeLessThan(verifyRuns.indexOf('bun --no-env-file t --price'))
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
  expect(hygieneRuns).toContain('bun --no-env-file run check:types:tsc')
  expect(hygieneRuns.match(/env -i PATH=/g)).toHaveLength(6)
  expect(hygieneRuns).toContain('HOME="${RUNNER_TEMP}/bun-package-home" CI=true')
  expect(hygiene?.steps?.some(step => step.name === 'Upload production license report')).toBe(true)
  expect(hygiene?.steps?.some(step => step.name === 'Upload dependency cleanup review')).toBe(true)

  // Verification, hygiene, builds, smoke, and audit gate publication. The compiled-entrypoint experiment still
  // runs for evidence but is advisory and does not block tagging.
  expect(jobs['publish-manifest']?.needs).toEqual([
    'verify',
    'package-hygiene',
    'build-amd64',
    'build-arm64',
    'smoke-amd64',
    'smoke-arm64',
    'audit-amd64',
    'audit-arm64'
  ])
  expect(jobs['publish-manifest']?.needs).not.toContain('compiled-experiment-amd64')
  expect(jobs['publish-manifest']?.needs).not.toContain('compiled-experiment-arm64')

  for (const arch of ['amd64', 'arm64'] as const) {
    const upperArch = arch.toUpperCase()
    const buildJob = jobs[`build-${arch}`]
    // Builds wait only for change detection: they start immediately on pushes that change image inputs, and
    // docs-only pushes keep the previous latest. Verification and hygiene gate publish-manifest instead.
    expect(buildJob?.needs).toEqual(['changes'])
    expect(buildJob?.if).toBe("github.event_name == 'push' && needs.changes.outputs.image == 'true'")
    expect(buildJob?.permissions).toMatchObject({ contents: 'read', packages: 'write' })
    expect(buildJob?.outputs).toEqual({
      digest: '${{ steps.build.outputs.digest }}',
      build_duration_ms: '${{ steps.build.outputs.build_duration_ms }}'
    })
    const buildRuns = buildJob?.steps?.map(step => step.run ?? '').join('\n') ?? ''
    expect(buildRuns).toContain('push-by-digest=true')
    expect(buildRuns).not.toContain('--target compiled-experiment')

    const fetchRun = buildJob?.steps?.find(step => step.name === 'Fetch repository at the pushed commit')?.run ?? ''
    const privateHelper = fetchRun.indexOf('umask 077')
    const helperMode = fetchRun.indexOf('chmod 700 "$credential_helper"')
    const restoredUmask = fetchRun.indexOf('umask 022')
    const checkout = fetchRun.indexOf('git checkout --detach FETCH_HEAD')
    expect(privateHelper).toBeGreaterThan(-1)
    expect(helperMode).toBeGreaterThan(privateHelper)
    expect(restoredUmask).toBeGreaterThan(helperMode)
    expect(checkout).toBeGreaterThan(restoredUmask)

    for (const [prefix, artifact] of [
      ['smoke', 'docker-smoke'],
      ['compiled-experiment', 'docker-compiled-experiment'],
      ['audit', 'docker-audit']
    ] as const) {
      const evidenceJob = jobs[`${prefix}-${arch}`]
      expect(evidenceJob?.needs).toEqual([`build-${arch}`])
      expect(evidenceJob?.if).toBeUndefined()
      expect(evidenceJob?.permissions).toEqual({ contents: 'read', packages: 'read' })
      const upload = evidenceJob?.steps?.find(step => step.uses?.startsWith('actions/upload-artifact@'))
      expect(upload?.if).toBe('always()')
      expect(upload?.with?.['name']).toBe(`${artifact}-${arch}`)
      expect(JSON.stringify(evidenceJob).replaceAll('secrets.GITHUB_TOKEN', '')).not.toContain('secrets.')
    }

    const smokeJob = jobs[`smoke-${arch}`]
    const smokeStep = smokeJob?.steps?.find(step => step.name === `Smoke and measure ${upperArch} image`)
    const smokeRun = smokeStep?.run ?? ''
    expect(smokeStep?.env?.['BUILD_DURATION_MS']).toBe(`\${{ needs.build-${arch}.outputs.build_duration_ms }}`)
    expect(smokeRun).toContain('install --frozen-lockfile --production')
    expect(smokeRun).toContain('config --show')
    expect(smokeRun).toContain('setup --doctor')
    expect(smokeRun).toContain('Setup doctor completed')
    expect(smokeRun).toContain('coldHelpWallMs')
    expect(smokeRun).toContain('cliPrebuildMs')
    expect(smokeRun).toContain('fixturePeakRssBytes')
    expect(smokeRun).toContain('managed-toolchain-smoke.pdf')
    expect(smokeRun).toContain('measurements.json')
    expect(smokeRun).toContain('dst=/app/test/docker-acceptance/native-image-acceptance.ts,readonly')
    expect(smokeRun).toContain('--entrypoint bun')
    expect(smokeRun).not.toContain('--user')
    expect(smokeRun).not.toContain('--target compiled-experiment')

    expect(jobs[`compiled-experiment-${arch}`]?.['continue-on-error']).toBe(true)
    const compiledRun = jobs[`compiled-experiment-${arch}`]?.steps?.find(step => step.name === `Build and measure ${upperArch} compiled experiment`)?.run ?? ''
    expect(compiledRun).toContain('--target compiled-experiment')
    expect(compiledRun).toContain(`--cache-from "type=registry,ref=\${image}:buildcache-${arch}"`)
    expect(compiledRun).toContain('--build-arg "VCS_REF=${GITHUB_SHA}"')
    expect(compiledRun).toContain('write /benchmark/input.md --price --no-color')
    expect(compiledRun).toContain('compiled-paths.log')
    expect(compiledRun).toContain('Setup doctor completed')
    expect(compiledRun).toContain('Estimate:')
    expect(compiledRun).toContain('Expected [0-9]+ files in ')
    expect(compiledRun).toContain('coldHelpWallMs')
    expect(compiledRun).toContain('helpPeakRssBytes')
    expect(compiledRun).toContain('compiled-entrypoint-experiment.json')
    expect(compiledRun).toContain('--arg decision reject')
    expect(compiledRun).not.toContain('--user')
    expect(compiledRun).not.toContain('--provenance')

    const auditJob = jobs[`audit-${arch}`]
    expect(auditJob?.steps?.find(step => step.uses?.startsWith('actions/checkout@'))?.with?.['sparse-checkout']).toBe('.github')
    expect(auditJob?.steps?.find(step => step.uses === './.github/actions/scan-image')?.with).toEqual({
      image: '${{ env.DEPENDENCY_SCAN_IMAGE }}',
      'evidence-dir': `runtime/ci/docker-${arch}`
    })
    expect(auditJob?.steps?.some(step => step.uses?.startsWith('anchore/'))).toBe(false)
    const triageStep = auditJob?.steps?.find(step => step.name === 'Record dispositions for every high and critical advisory')
    expect(triageStep?.if).toBe("always() && env.DEPENDENCY_SCAN_IMAGE != ''")
    expect(triageStep?.run).toContain('src/tools/triage-image-advisories.ts /evidence --scan-name image-advisories.json')
    expect(triageStep?.run).toContain(`docs/reports/release-evidence/${arch}/advisory-triage.json`)
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

test('image legs scan once through the shared scan-image composite and derive the fixable gate with jq', async () => {
  type Step = { id?: string, name?: string, if?: string, uses?: string, run?: string, env?: Record<string, string>, with?: Record<string, unknown> }
  const actionDir = resolve(repositoryRoot, '.github/actions/scan-image')
  const action = Bun.YAML.parse(await readFile(resolve(actionDir, 'action.yml'), 'utf8')) as {
    inputs?: Record<string, { required?: boolean, default?: unknown }>
    runs?: { using?: string, steps?: Step[] }
  }
  expect(action.runs?.using).toBe('composite')
  for (const input of ['image', 'sbom', 'evidence-dir', 'cache-key-salt', 'grype-version', 'syft-version', 'severity-cutoff', 'fail-on-fixable']) {
    expect(action.inputs).toHaveProperty(input)
  }
  const steps = action.runs?.steps ?? []
  expect(steps.some(step => step.uses?.startsWith('anchore/sbom-action@'))).toBe(false)
  expect(steps.some(step => step.uses?.startsWith('anchore/scan-action@'))).toBe(false)
  const installer = steps.find(step => step.name === 'Install Syft and Grype')?.run ?? ''
  expect(installer).toContain('install-scan-tools.sh')
  expect(await readFile(resolve(actionDir, 'install-scan-tools.sh'), 'utf8')).toContain('--retry-all-errors')
  expect(steps.find(step => step.name === 'Inventory the image')?.run).toContain('syft "${IMAGE}" -o "spdx-json=${SBOM}"')
  const scanSteps = steps.filter(step => step.name === 'Audit the image')
  expect(scanSteps).toHaveLength(1)
  expect(scanSteps[0]?.run).toContain('grype "sbom:${SBOM}" -o json --file "${OUTPUT}"')
  expect(scanSteps[0]?.env?.['GRYPE_DB_CACHE_DIR']).toBeDefined()
  expect(scanSteps[0]?.env?.['GRYPE_DB_AUTO_UPDATE']).toContain("steps.grype-db.outputs.cache-hit == 'true'")
  const restore = steps.find(step => step.uses === 'actions/cache/restore@0057852bfaa89a56745cba8c7296529d2fc39830')
  expect(restore?.with?.['key']).toMatch(/^grype-db-v6-\$\{\{ inputs\.grype-version \}\}-\$\{\{ steps\.paths\.outputs\.today \}\}/)
  expect(restore?.with?.['restore-keys']).toContain('grype-db-v6-${{ inputs.grype-version }}-')
  expect(steps.find(step => step.uses === 'actions/cache/save@0057852bfaa89a56745cba8c7296529d2fc39830')?.if).toContain("cache-hit != 'true'")
  const gate = steps.find(step => step.id === 'gate')?.run ?? ''
  for (const fragment of ['fixable.jq', 'gate-count.jq', 'image-advisories-fixable.json', 'exit 1']) expect(gate).toContain(fragment)

  const jq = Bun.which('jq')
  expect(jq).not.toBeNull()
  const runJq = (args: string[], input: string) => {
    const child = Bun.spawnSync([jq!, ...args], { cwd: actionDir, stdin: Buffer.from(input), stdout: 'pipe', stderr: 'pipe' })
    expect(child.stderr.toString()).toBe('')
    expect(child.exitCode).toBe(0)
    return child.stdout.toString()
  }
  const match = (id: string, severity: string, fix?: { state: string, versions: string[] }) =>
    ({ vulnerability: { id, severity, ...(fix ? { fix } : {}) }, artifact: { name: id.toLowerCase(), version: '1' } })
  const fixture = {
    matches: [
      match('FIXED-HIGH', 'High', { state: 'fixed', versions: ['2'] }),
      match('FIXED-LOW', 'Low', { state: 'fixed', versions: ['3'] }),
      match('NOT-FIXED', 'Critical', { state: 'not-fixed', versions: [] }),
      match('WONT-FIX', 'High', { state: 'wont-fix', versions: [] }),
      match('UNKNOWN', 'Medium', { state: 'unknown', versions: [] }),
      match('NO-FIX-KEY', 'High')
    ],
    source: { type: 'image' },
    distro: { name: 'debian' },
    descriptor: { name: 'grype', db: { built: '2026-09-14T01:00:00Z' } }
  }
  const fixableText = runJq(['-f', 'fixable.jq'], JSON.stringify(fixture))
  const fixable = JSON.parse(fixableText) as {
    matches: Array<{ vulnerability: { id: string } }>
    ignoredMatches: Array<{ appliedIgnoreRules: Array<Record<string, string>> }>
  }
  expect(fixable.matches.map(item => item.vulnerability.id)).toEqual(['FIXED-HIGH', 'FIXED-LOW'])
  expect(fixable.ignoredMatches.map(item => item.appliedIgnoreRules[0]?.['fix-state'])).toEqual(['not-fixed', 'wont-fix', 'unknown', 'unknown'])
  expect(Object.keys(fixable)).toEqual(expect.arrayContaining(['source', 'distro', 'descriptor']))
  expect(runJq(['--arg', 'cutoff', 'high', '-f', 'gate-count.jq'], fixableText).trim()).toBe('1')
  expect(runJq(['--arg', 'cutoff', 'low', '-f', 'gate-count.jq'], fixableText).trim()).toBe('2')

  const expectedEvidenceDirs = {
    'docker-publish.yml': ['runtime/ci/docker-amd64', 'runtime/ci/docker-arm64'],
    'dependency-graphs.yml': ['runtime/dependency-evidence'],
    'warm-grype-db.yml': ['runtime/ci/grype-db-warmup']
  }
  for (const [workflowName, evidenceDirs] of Object.entries(expectedEvidenceDirs)) {
    const source = await readFile(resolve(repositoryRoot, '.github/workflows', workflowName), 'utf8')
    expect(source).not.toContain('anchore/scan-action@')
    expect(source).not.toContain('anchore/sbom-action@')
    const workflow = Bun.YAML.parse(source) as { jobs?: Record<string, { steps?: Step[] }> }
    const allSteps = Object.values(workflow.jobs ?? {}).flatMap(job => job.steps ?? [])
    const scanImageSteps = allSteps.filter(step => step.uses === './.github/actions/scan-image')
    for (const step of scanImageSteps) expect(evidenceDirs).toContain(String(step.with?.['evidence-dir']))
    expect(new Set(scanImageSteps.map(step => step.with?.['evidence-dir']))).toEqual(new Set(evidenceDirs))
    if (workflowName === 'docker-publish.yml') {
      const triage = allSteps.filter(step => step.name === 'Record dispositions for every high and critical advisory')
      expect(triage).toHaveLength(2)
      for (const step of triage) expect(step.if?.startsWith('always()')).toBe(true)
    }
    if (workflowName === 'warm-grype-db.yml') {
      const warmup = Bun.YAML.parse(source) as {
        on?: { schedule?: Array<{ cron: string }>, workflow_dispatch?: unknown }
        jobs?: Record<string, { steps?: Step[] }>
      }
      expect(warmup.on?.schedule).toEqual([{ cron: '20 0 * * *' }])
      expect(warmup.on).toHaveProperty('workflow_dispatch')
      expect(scanImageSteps).toHaveLength(1)
      expect(scanImageSteps[0]?.with).toEqual({
        sbom: '.github/actions/scan-image/warmup.spdx.json',
        'evidence-dir': 'runtime/ci/grype-db-warmup',
        'fail-on-fixable': 'false'
      })
      expect(scanImageSteps[0]?.with).not.toHaveProperty('cache-key-salt')
      expect(existsSync(resolve(actionDir, 'warmup.spdx.json'))).toBe(true)
    }
  }
})
