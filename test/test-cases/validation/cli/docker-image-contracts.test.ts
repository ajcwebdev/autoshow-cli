import { expect, test } from 'bun:test'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { readDependencyUrlAndSha256 } from '~/cli/commands/setup-and-utilities/setup/dependency-metadata'
import { SUPPORTED_BUN_VERSION } from '~/utils/bun-version'

const repositoryRoot = resolve(import.meta.dir, '../../../..')
const dockerfilePath = resolve(repositoryRoot, 'Dockerfile')
const dockerDocsPath = resolve(repositoryRoot, 'docs/docker.md')

test('published image OCR smoke commands pass real CLI option validation', async () => {
  const smoke = await readFile(resolve(repositoryRoot, 'src/tools/docker-release-smoke.sh'), 'utf8')
  const commands = [...smoke.matchAll(/bun --no-env-file \/app\/src\/cli\/create-cli\.ts (extract \/benchmark\/fixture\.pdf [^;]+?) >\/dev\/null 2>&1/g)]
  expect(commands).toHaveLength(1)
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
  const runtime = dockerfile.slice(dockerfile.indexOf('AS runtime'), dockerfile.indexOf('FROM runtime AS alignment'))
  expect(runtime).toContain('ENV AUTOSHOW_DISABLE_HTTP_KEEPALIVE=1')
  expect(dockerfile).toContain('FROM runtime AS alignment')
  expect(dockerfile).toContain('FROM runtime AS production')
  expect(dockerfile).not.toContain('AUTOSHOW_DISABLE_HTTP_KEEPALIVE=0')
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

  const download = dockerfile.split('\n').find(line => /^ADD .*\/usr\/local\/bin\/yt-dlp$/.test(line)) ?? ''
  expect(download).toContain('--checksum=sha256:${YT_DLP_SHA256}')
  expect(download).toContain('--chmod=0755')
  expect(download).toContain('${YT_DLP_URL}')
  expect(dockerfile.indexOf(download)).toBeGreaterThan(dockerfile.indexOf('apt-get upgrade'))
  expect(dockerfile).not.toMatch(/^FROM .* AS fetch$/m)
})

test('Docker supplies a pinned native Deno runtime for yt-dlp in every runtime target', async () => {
  const dockerfile = await readFile(dockerfilePath, 'utf8')
  expect(dockerfile).toContain('ARG DENO_BASE_IMAGE=denoland/deno:bin-2.9.6@sha256:4cf0029b9aeeeed5efcbb71828737f0d7c8c8a20072df960e51a5679ef0d21ba')
  expect(dockerfile).toContain('FROM ${DENO_BASE_IMAGE} AS youtube-js')
  const runtime = dockerfile.slice(dockerfile.indexOf('AS runtime'), dockerfile.indexOf('FROM runtime AS alignment'))
  expect(runtime).toContain('COPY --from=youtube-js /deno /usr/local/bin/deno')
  expect(runtime).toContain('deno --version')
  expect(runtime).toContain('yt-dlp --version')
})

test('Docker documentation supports direct image invocation without a root scripts directory', async () => {
  const dockerDocs = await readFile(dockerDocsPath, 'utf8')

  expect(existsSync(resolve(repositoryRoot, 'scripts'))).toBe(false)
  expect(dockerDocs).toContain('bun autoshow extract input/examples/document/harborlight-field-notes.pdf --provider tesseract --no-chapters')
  expect(dockerDocs).toContain('docker run --rm -i')
})

test('Docker images carry immutable build identity and publish provenance plus SBOM attestations', async () => {
  const dockerfile = await readFile(dockerfilePath, 'utf8')
  const build = await readFile(resolve(repositoryRoot, 'src/tools/docker-release-build.sh'), 'utf8')
  const stages = dockerfile.split(/^(?=FROM )/m)
  const stageName = (stage: string) => stage.match(/^FROM .+ AS (\S+)/)?.[1]
  const identityStages = stages.filter(stage => /^ARG VCS_REF=/m.test(stage))

  expect(identityStages.map(stageName)).toEqual(['runtime'])
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
  const runtime = stages.find(stage => stageName(stage) === 'runtime') ?? ''
  expect(runtime).toContain('ARG DEBIAN_SNAPSHOT=')
  expect(runtime.indexOf('ARG VCS_REF=')).toBeGreaterThan(runtime.lastIndexOf('RUN '))
  expect(dockerfile).toContain('org.opencontainers.image.source="https://github.com/ajcwebdev/autoshow-cli"')
  expect(build).toContain('--provenance=mode=max')
  expect(build).toContain('--sbom=true')
  expect(build).toContain('--build-arg "VCS_REF=${GITHUB_SHA}"')
  expect(build).toContain('--cache-from "type=registry,ref=${image}:buildcache-${ARCH}"')
  expect(build).toContain('--cache-to "type=registry,ref=${image}:buildcache-${ARCH},mode=max"')
  expect(build).not.toContain(':buildcache" ')
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
  const onnxCommands = steps.find(step => step.name === 'Verify optional ONNX backend offline')?.run?.split('\n') ?? []
  expect(onnxCommands.find(line => line.includes('stt-onnx-alignment.test.ts'))).not.toContain('--user')
  expect(onnxCommands.find(line => line.includes('alignment-inventory.txt'))).toContain('--user 0')
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
    'reference-tokenizer-contracts.test.ts',
    'runner-preservation.test.ts',
    'docker-runtime-recipe.test.ts',
    'docker-installed-dependencies.test.ts',
    'docker-release-index.test.ts',
    'docker-release-shell.test.ts'
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

  // Builds retain separate outputs and checks; shared actions receive architecture as data.
  expect(jobs['publish-manifest']?.needs).toEqual([
    'verify', 'package-hygiene', 'build-amd64', 'build-arm64',
    'smoke-amd64', 'smoke-arm64', 'audit-amd64', 'audit-arm64'
  ])
  expect(Object.keys(jobs).some(name => name.startsWith('compiled-experiment'))).toBe(false)
  const buildScript = await readFile(resolve(repositoryRoot, 'src/tools/docker-release-build.sh'), 'utf8')
  const smokeScript = await readFile(resolve(repositoryRoot, 'src/tools/docker-release-smoke.sh'), 'utf8')
  expect(buildScript).toContain('push-by-digest=true')
  expect(buildScript).toContain('--target production')
  expect(smokeScript).toContain('docker-installed-dependencies.ts')
  expect(smokeScript).not.toContain('install --frozen-lockfile')
  expect(smokeScript).not.toContain('cliPrebuildMs')
  for (const command of ['config --show', 'setup --doctor', 'Setup doctor completed', 'coldHelpWallMs', 'fixturePeakRssBytes', 'managed-toolchain-smoke.pdf', 'measurements.json']) expect(smokeScript).toContain(command)
  const audit = Bun.YAML.parse(await readFile(resolve(repositoryRoot, '.github/actions/audit-native-image/action.yml'), 'utf8')) as { runs: { steps: Array<{ name?: string; uses?: string; if?: string; with?: Record<string, string>; run?: string }> } }
  expect(audit.runs.steps.find(step => step.uses === './.github/actions/scan-image')?.with).toEqual({ image: '${{ env.DEPENDENCY_SCAN_IMAGE }}', 'evidence-dir': 'runtime/ci/docker-${{ inputs.arch }}' })
  const triage = audit.runs.steps.find(step => step.name === 'Record dispositions for every high and critical advisory')
  expect(triage?.if).toBe("always() && env.DEPENDENCY_SCAN_IMAGE != ''")
  expect(triage?.run).toContain('src/tools/triage-image-advisories.ts /evidence --scan-name image-advisories.json')

  for (const arch of ['amd64', 'arm64'] as const) {
    const runner = arch === 'amd64' ? 'ubuntu-24.04' : 'ubuntu-24.04-arm'
    const buildJob = jobs[`build-${arch}`]
    expect(buildJob?.needs).toEqual(['changes'])
    expect(buildJob?.if).toBe("github.event_name == 'push' && needs.changes.outputs.image == 'true'")
    expect(buildJob?.permissions).toEqual({ contents: 'read', packages: 'write' })
    expect(buildJob?.outputs).toEqual({ digest: '${{ steps.build.outputs.digest }}', build_duration_ms: '${{ steps.build.outputs.build_duration_ms }}' })
    expect(buildJob?.steps?.find(step => step.uses === './.github/actions/build-native-image')?.with).toEqual({ arch })
    expect((buildJob as { 'runs-on'?: string })['runs-on']).toBe(runner)
    for (const kind of ['smoke', 'audit']) {
      const job = jobs[`${kind}-${arch}`]
      expect(job?.needs).toEqual([`build-${arch}`])
      expect(job?.permissions).toEqual({ contents: 'read', packages: 'read' })
      expect((job as { 'runs-on'?: string })['runs-on']).toBe(runner)
      expect(job?.['continue-on-error']).toBeUndefined()
      const shared = job?.steps?.find(step => step.uses === `./.github/actions/${kind}-native-image`)
      expect(shared?.with?.['arch']).toBe(arch)
      expect(shared?.with?.['digest']).toBe('${{ needs.build-' + arch + '.outputs.digest }}')
      if (kind === 'smoke') expect(shared?.with?.['build-duration-ms']).toBe('${{ needs.build-' + arch + '.outputs.build_duration_ms }}')
      const upload = job?.steps?.find(step => step.uses?.startsWith('actions/upload-artifact@'))
      expect(upload?.if).toBe('always()')
      expect(upload?.with?.['name']).toBe(`docker-${kind}-${arch}`)
      expect(upload?.with?.['path']).toContain(`runtime/ci/docker-${arch}`)
      expect(JSON.stringify(job).replaceAll('secrets.GITHUB_TOKEN', '')).not.toContain('secrets.')
    }
  }
  // Every checkout uses the triggering identity without keeping its credential in the worktree.
  for (const job of Object.values(jobs)) for (const step of job.steps ?? []) {
    if (step.uses?.startsWith('actions/checkout@')) expect(step.with).toMatchObject({ ref: '${{ github.sha }}', 'fetch-depth': 1, 'persist-credentials': false })
  }
  expect(workflowSource).not.toContain('credential_helper')
  expect(workflowSource).not.toContain('git checkout')
})

test('release promotion waits for every immutable-candidate acceptance shard', async () => {
  type Step = { name?: string; run?: string; env?: Record<string, string> }
  type Job = { needs?: string | string[]; if?: string; steps?: Step[] }
  const workflow = Bun.YAML.parse(await readFile(resolve(repositoryRoot, '.github/workflows/docker-publish.yml'), 'utf8')) as { jobs: Record<string, Job>; concurrency: { 'cancel-in-progress': string } }
  const jobs = workflow.jobs
  const candidate = jobs['publish-manifest']!
  const candidateRun = candidate.steps?.map(step => step.run ?? '').join('\n') ?? ''
  expect(candidateRun).toContain('docker-release-index.ts candidate')
  expect(candidateRun).not.toContain(':latest')
  const accept = jobs['acceptance']!.steps?.find(step => step.name === 'Accept immutable candidate through its CLI')!
  expect(jobs['acceptance']?.needs).toBe('publish-manifest')
  expect(accept.env?.['EXPECTED_DIGEST']).toBe('${{ needs.publish-manifest.outputs.digest }}')
  expect(accept.run).toContain('--image "${image}@${EXPECTED_DIGEST}" --pull always')
  expect(accept.run).toContain('--expected-digest "${EXPECTED_DIGEST}" --expected-revision "${GITHUB_SHA}"')
  expect(jobs['acceptance-required']?.needs).toEqual(['changes', 'publish-manifest', 'acceptance'])
  const promotion = jobs['promote-latest']!
  expect(promotion.needs).toEqual(['changes', 'publish-manifest', 'acceptance-required', 'build-amd64', 'build-arm64'])
  expect(promotion.if).not.toContain('always()')
  const promote = promotion.steps?.find(step => step.name === 'Copy accepted index and verify latest digest')!
  expect(promote.env?.['ACCEPTED_DIGEST']).toBe('${{ needs.publish-manifest.outputs.digest }}')
  expect(promote.run).toContain('docker-release-index.ts promote "${image}" "${ACCEPTED_DIGEST}"')
  expect(workflow.concurrency['cancel-in-progress']).toBe("${{ github.event_name == 'pull_request' }}")
  const directory = await mkdtemp(join(tmpdir(), 'docker-promotion-gate-'))
  try {
    const gate = jobs['acceptance-required']!.steps![0]!.run!
    for (const candidateStatus of ['success', 'failure', 'skipped', 'cancelled']) for (const acceptance of ['success', 'failure', 'skipped', 'cancelled']) {
      const result = Bun.spawnSync(['bash', '-c', gate], { env: { PATH: process.env['PATH'], PUBLICATION: candidateStatus, ACCEPTANCE: acceptance, GITHUB_STEP_SUMMARY: join(directory, 'summary') }, stdout: 'pipe', stderr: 'pipe' })
      expect(result.exitCode).toBe(candidateStatus === 'success' && acceptance === 'success' ? 0 : 1)
    }
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('source production remains default and standalone native runtime paths remain available', async () => {
  const dockerfile = await readFile(dockerfilePath, 'utf8')
  expect(dockerfile.match(/^FROM .+ AS (\S+)$/gm)?.map(line => line.split(' ').at(-1))).toEqual(['youtube-js', 'deps', 'alignment-deps', 'runtime', 'alignment', 'production'])
  expect(dockerfile.trimEnd()).toEndWith('FROM runtime AS production')
  expect(dockerfile).toContain('ENTRYPOINT ["bun", "--no-env-file", "/app/src/cli/create-cli.ts"]')
  const runtimePaths = await readFile(resolve(repositoryRoot, 'src/utils/runtime-paths.ts'), 'utf8')
  const projectRoot = await readFile(resolve(repositoryRoot, 'src/utils/project-root.ts'), 'utf8')
  expect(runtimePaths).toContain('Bun.isStandaloneExecutable')
  expect(projectRoot).toContain('Bun.isStandaloneExecutable')
  expect(projectRoot).toContain('dirname(process.execPath)')
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
  const installer = steps.find(step => step.name === 'Install required scanners')?.run ?? ''
  expect(installer).toContain('install-scan-tools.sh')
  const installerSource = await readFile(resolve(actionDir, 'install-scan-tools.sh'), 'utf8')
  expect(installerSource).toContain('--retry 3')
  expect(installerSource).toContain('--retry-max-time 120')
  expect(installerSource).not.toContain('--retry-all-errors')
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
