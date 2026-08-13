import { cp, mkdir, rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { cpus } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { readDependencyUrlAndSha256 } from '~/cli/commands/setup-and-utilities/setup/dependency-metadata'
import { runCapture, runInherit } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import {
  createManagedToolStagingDirectory,
  managedArtifactBinaryRelativePath,
  readExpectedManagedArtifactSources,
  sha256File,
  validateManagedSourceArtifact,
  verifyManagedPrebuiltArchitecture,
  writeManagedSourceArtifactManifest
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact'
import { buildMupdfMakeArguments } from '~/cli/commands/setup-and-utilities/setup/setup-download/mupdf-source-build'
import {
  assertPortableQpdfDynamicLibraryClosure,
  buildLibjpegTurboCmakeArguments,
  buildQpdfCmakeArguments,
  buildQpdfSourceEnvironment,
  resolveQpdfSourceBuildLayout
} from '~/cli/commands/setup-and-utilities/setup/setup-download/qpdf-source-build'
import {
  createManagedToolchainDistributionNotice,
  managedToolchainDistributionLicense
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-toolchain-distribution-policy'
import {
  assertManagedUnsignedBinaryHasNoLeaks,
  assertManagedUnsignedCodeSignature,
  assertManagedUnsignedDeploymentTarget,
  assertManagedUnsignedPortableLinkage,
  exerciseManagedUnsignedSourceFallback,
  installManagedUnsignedVerificationArtifact,
  MANAGED_UNSIGNED_DEPLOYMENT_TARGET,
  packageManagedUnsignedVerificationArtifact,
  runManagedToolFixtureChecks,
  writeManagedUnsignedSha256Sums
} from '~/cli/commands/setup-and-utilities/setup/setup-download/unsigned-prebuilt-artifact'
import {
  assertManagedProtectedReleaseInputs,
  assertManagedSignedCodeSignature,
  managedSignedArchiveName,
  managedSignedNotarizationLogName,
  managedSignedProvenanceBundleName,
  managedSignedReleaseManifestName,
  managedSignedSbomAttestationBundleName,
  managedSignedSbomName,
  managedToolchainReleaseTag,
  MANAGED_SIGNED_REVISION,
  packageManagedSignedCandidate,
  signManagedToolBinary,
  submitManagedToolForNotarization
} from '~/cli/commands/setup-and-utilities/setup/setup-download/signed-prebuilt-artifact'
import {
  installManagedPrebuiltCandidate
} from '~/cli/commands/setup-and-utilities/setup/setup-download/prebuilt-artifact'
import {
  parseManagedPrebuiltReleaseManifest,
  sha256Bytes
} from '~/cli/commands/setup-and-utilities/setup/setup-download/managed-artifact'
import type { ManagedArtifactPayloadFile, ManagedArtifactToolId, ManagedPrebuiltCandidate, ManagedPrebuiltProducer, ManagedUnsignedVerificationBundle } from '~/types'
import { PROJECT_ROOT } from '~/utils/runtime-paths'

const WORKFLOW_NAME = 'macOS Toolchain Unsigned Verification'
const SIGNED_WORKFLOW_NAME = 'macOS Toolchain Protected Release Rehearsal'
const FIXTURE_PDF_PATH = join(PROJECT_ROOT, 'test/fixtures/setup/managed-toolchain-smoke.pdf')
const TOOLS: ManagedArtifactToolId[] = ['mupdf', 'qpdf']

type ProducerArchitecture = 'arm64' | 'x64'
type SourceDirectoryName = 'mupdf' | 'qpdf' | 'libjpeg-turbo'
type BuildResult = {
  tool: ManagedArtifactToolId
  binaryPath: string
  buildRoot: string
  sourceDirectories: Partial<Record<SourceDirectoryName, string>>
  sourceArchives: Partial<Record<SourceDirectoryName, string>>
}

type ProducerCommandOptions = {
  architecture: ProducerArchitecture
  workDir: string
  outputDir?: string
  tools: ManagedArtifactToolId[]
}

const normalizeOutput = (value: string): string => value.trim().replace(/\s+/g, ' ')

const runChecked = async (
  command: string,
  args: string[],
  options: { cwd?: string, env?: Record<string, string | undefined> } = {}
): Promise<void> => {
  const exitCode = await runInherit(command, args, options)
  if (exitCode !== 0) throw new Error(`${command} ${args.join(' ')} failed with exit code ${exitCode}`)
}

const captureChecked = async (command: string, args: string[] = []): Promise<string> => {
  const result = await runCapture(command, args, { allowFailure: true })
  if (result.exitCode !== 0) throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr.trim() || result.stdout.trim()}`)
  return normalizeOutput(result.stdout || result.stderr)
}

const assertSafeWorkDirectory = (path: string): void => {
  const resolved = resolve(path)
  if (resolved === '/' || resolved === PROJECT_ROOT || dirname(resolved) === resolved) throw new Error(`refusing unsafe producer work directory ${resolved}`)
}

const expectedProcessArchitecture = (architecture: ProducerArchitecture): NodeJS.Architecture =>
  architecture === 'x64' ? 'x64' : 'arm64'

const assertNativeArchitecture = (architecture: ProducerArchitecture): void => {
  const expected = expectedProcessArchitecture(architecture)
  if (process.platform !== 'darwin' || process.arch !== expected) throw new Error(`producer target ${architecture} requires a native darwin/${expected} runner, received ${process.platform}/${process.arch}`)
}

const downloadPinnedSource = async (
  name: SourceDirectoryName,
  buildRoot: string
): Promise<{ archivePath: string, sourceDir: string }> => {
  const { url, sha256 } = await readDependencyUrlAndSha256(name)
  const downloadsDir = join(buildRoot, 'downloads')
  const sourceDir = join(buildRoot, 'sources', name)
  const archivePath = join(downloadsDir, basename(new URL(url).pathname))
  await mkdir(downloadsDir, { recursive: true })
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(180_000) })
  if (!response.ok) throw new Error(`could not download ${name} source: HTTP ${response.status}`)
  await Bun.write(archivePath, new Uint8Array(await response.arrayBuffer()))
  const actualSha256 = await sha256File(archivePath)
  if (actualSha256 !== sha256) throw new Error(`${name} source SHA-256 is ${actualSha256}, expected ${sha256}`)
  await mkdir(sourceDir, { recursive: true })
  await runChecked('tar', ['-xzf', archivePath, '-C', sourceDir, '--strip-components=1'])
  return { archivePath, sourceDir }
}

const buildMupdf = async (
  buildRoot: string,
  runUpstreamTests: boolean
): Promise<BuildResult> => {
  const { archivePath, sourceDir } = await downloadPinnedSource('mupdf', buildRoot)
  const jobs = Math.max(1, Math.min(cpus().length, 8))
  const environment = { MACOSX_DEPLOYMENT_TARGET: MANAGED_UNSIGNED_DEPLOYMENT_TARGET }
  await runChecked('make', buildMupdfMakeArguments(jobs), { cwd: sourceDir, env: environment })
  const binaryPath = join(sourceDir, 'build/release/mutool')
  if (runUpstreamTests) {
    await runChecked('make', [
      '-C', 'thirdparty/extract',
      'build=opt',
      'mutool=../../build/release/mutool',
      'gs=',
      'test-buffer',
      'test-misc',
      'test-src'
    ], { cwd: sourceDir, env: environment })
  }
  return { tool: 'mupdf', binaryPath, buildRoot, sourceDirectories: { mupdf: sourceDir }, sourceArchives: { mupdf: archivePath } }
}

const buildQpdf = async (
  buildRoot: string,
  runUpstreamTests: boolean
): Promise<BuildResult> => {
  const layout = resolveQpdfSourceBuildLayout(buildRoot)
  const [qpdfSource, libjpegSource] = await Promise.all([
    downloadPinnedSource('qpdf', buildRoot),
    downloadPinnedSource('libjpeg-turbo', buildRoot)
  ])
  if (qpdfSource.sourceDir !== layout.qpdfSourceDir || libjpegSource.sourceDir !== layout.libjpegTurboSourceDir) throw new Error('producer source layout drifted from the shared qpdf recipe')
  const jobs = Math.max(1, Math.min(cpus().length, 8))
  await runChecked('cmake', buildLibjpegTurboCmakeArguments(layout, MANAGED_UNSIGNED_DEPLOYMENT_TARGET))
  await runChecked('cmake', ['--build', layout.libjpegTurboCmakeBuildDir, '--target', 'jpeg-static', '--parallel', String(jobs)])
  await runChecked('cmake', ['--install', layout.libjpegTurboCmakeBuildDir])
  const qpdfEnvironment = buildQpdfSourceEnvironment(layout)
  await runChecked('cmake', buildQpdfCmakeArguments(layout, join(buildRoot, 'install/qpdf'), MANAGED_UNSIGNED_DEPLOYMENT_TARGET), { env: qpdfEnvironment })
  await runChecked('cmake', ['--build', layout.qpdfCmakeBuildDir, '--parallel', String(jobs)], { env: qpdfEnvironment })
  await assertPortableQpdfDynamicLibraryClosure(layout.builtQpdfPath)
  if (runUpstreamTests) await runChecked('ctest', ['--test-dir', layout.qpdfCmakeBuildDir, '--output-on-failure'], { env: qpdfEnvironment })
  return {
    tool: 'qpdf',
    binaryPath: layout.builtQpdfPath,
    buildRoot,
    sourceDirectories: { qpdf: qpdfSource.sourceDir, 'libjpeg-turbo': libjpegSource.sourceDir },
    sourceArchives: { qpdf: qpdfSource.archivePath, 'libjpeg-turbo': libjpegSource.archivePath }
  }
}

export const buildManagedUnsignedTool = async (options: {
  tool: ManagedArtifactToolId
  architecture: ProducerArchitecture
  workDir: string
  runUpstreamTests: boolean
}): Promise<BuildResult> => {
  assertNativeArchitecture(options.architecture)
  assertSafeWorkDirectory(options.workDir)
  const buildRoot = join(options.workDir, `${options.tool}-build`)
  await rm(buildRoot, { recursive: true, force: true })
  await mkdir(buildRoot, { recursive: true })
  const build = options.tool === 'mupdf'
    ? await buildMupdf(buildRoot, options.runUpstreamTests)
    : await buildQpdf(buildRoot, options.runUpstreamTests)
  await verifyManagedPrebuiltArchitecture(build.binaryPath, options.architecture)
  await assertManagedUnsignedDeploymentTarget(build.binaryPath)
  await assertManagedUnsignedPortableLinkage(build.binaryPath)
  await assertManagedUnsignedCodeSignature(build.binaryPath)
  await assertManagedUnsignedBinaryHasNoLeaks(build.binaryPath, [buildRoot, options.workDir, process.env['GITHUB_WORKSPACE'] ?? ''])
  await runManagedToolFixtureChecks(build.tool, build.binaryPath, FIXTURE_PDF_PATH, join(buildRoot, 'fixture-checks'))
  return build
}

const readProducerIdentity = async (
  architecture: ProducerArchitecture,
  workflowName = WORKFLOW_NAME
): Promise<ManagedPrebuiltProducer> => {
  const runnerLabel = architecture === 'arm64' ? 'macos-15' : 'macos-15-intel'
  const commit = process.env['GITHUB_SHA'] ?? await captureChecked('git', ['rev-parse', 'HEAD'])
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error(`invalid producer commit ${commit}`)
  const runId = process.env['GITHUB_RUN_ID']
  const repository = process.env['GITHUB_REPOSITORY'] ?? 'ajcwebdev/autoshow-cli'
  const serverUrl = process.env['GITHUB_SERVER_URL'] ?? 'https://github.com'
  const workflowRunUrl = runId ? `${serverUrl}/${repository}/actions/runs/${runId}` : `local://macos-toolchain-producer/${commit}`
  const runnerImage = [process.env['ImageOS'], process.env['ImageVersion']].filter(Boolean).join(' ') || await captureChecked('sw_vers', ['-productVersion'])
  return {
    repository: 'ajcwebdev/autoshow-cli',
    commit,
    workflowName,
    workflowRunUrl,
    runnerLabel,
    runnerImage,
    compilerVersion: await captureChecked('clang', ['--version']),
    sdkVersion: await captureChecked('xcrun', ['--show-sdk-version']),
    buildToolVersions: [
      await captureChecked('cmake', ['--version']),
      await captureChecked('make', ['--version']),
      `bun ${Bun.version}`
    ]
  }
}

const produce = async (options: ProducerCommandOptions): Promise<void> => {
  if (!options.outputDir) throw new Error('produce requires --output-dir')
  assertSafeWorkDirectory(options.outputDir)
  await mkdir(options.outputDir, { recursive: true })
  const producer = await readProducerIdentity(options.architecture)
  const bundles: ManagedUnsignedVerificationBundle[] = []
  for (const tool of options.tools) {
    const build = await buildManagedUnsignedTool({
      tool,
      architecture: options.architecture,
      workDir: options.workDir,
      runUpstreamTests: true
    })
    bundles.push(await packageManagedUnsignedVerificationArtifact({
      tool,
      architecture: options.architecture,
      binaryPath: build.binaryPath,
      sourceDirectories: build.sourceDirectories,
      outputDir: options.outputDir,
      producer
    }))
  }
  await writeManagedUnsignedSha256Sums(bundles, join(options.outputDir, 'SHA256SUMS'))
}

type SignedProducerOptions = ProducerCommandOptions & {
  signingIdentity: string
  teamId: string
  notaryKeyPath: string
  notaryKeyId: string
  notaryIssuerId: string
}

const copyReleaseSourceAssets = async (build: BuildResult, outputDir: string): Promise<void> => {
  const approvedNames = managedToolchainDistributionLicense(build.tool).correspondingSourceAssets
  const sourceArchives = Object.values(build.sourceArchives).filter((path): path is string => Boolean(path))
  if (sourceArchives.length !== approvedNames.length) throw new Error(`source archive count does not match the approved ${build.tool} release inventory`)
  for (const sourceArchive of sourceArchives) {
    const name = basename(sourceArchive)
    if (!approvedNames.includes(name)) throw new Error(`source archive ${name} is not in the approved ${build.tool} release inventory`)
    const destination = join(outputDir, name)
    if (await Bun.file(destination).exists()) {
      if (await sha256File(destination) !== await sha256File(sourceArchive)) throw new Error(`source archive ${name} differs across tool builds`)
    } else {
      await cp(sourceArchive, destination)
    }
  }
}

const produceSigned = async (options: SignedProducerOptions): Promise<void> => {
  if (!options.outputDir) throw new Error('produce-signed requires --output-dir')
  assertSafeWorkDirectory(options.outputDir)
  await mkdir(options.outputDir, { recursive: true })
  const producer = await readProducerIdentity(options.architecture, SIGNED_WORKFLOW_NAME)
  for (const tool of options.tools) {
    const build = await buildManagedUnsignedTool({
      tool,
      architecture: options.architecture,
      workDir: options.workDir,
      runUpstreamTests: true
    })
    await signManagedToolBinary({ tool, binaryPath: build.binaryPath, signingIdentity: options.signingIdentity })
    await assertManagedSignedCodeSignature(build.binaryPath, {
      signingIdentity: options.signingIdentity,
      teamId: options.teamId
    })
    await packageManagedSignedCandidate({
      tool,
      architecture: options.architecture,
      binaryPath: build.binaryPath,
      sourceDirectories: build.sourceDirectories,
      outputDir: options.outputDir,
      producer,
      signingIdentity: options.signingIdentity,
      teamId: options.teamId,
      notarize: async archivePath => await submitManagedToolForNotarization({
        archivePath,
        keyPath: options.notaryKeyPath,
        keyId: options.notaryKeyId,
        issuerId: options.notaryIssuerId
      })
    })
    await copyReleaseSourceAssets(build, options.outputDir)
  }
}

const verifyGatekeeper = async (binaryPath: string): Promise<void> => {
  const result = await runCapture('spctl', ['--assess', '--type', 'execute', '--verbose=4', binaryPath], { allowFailure: true })
  if (result.exitCode !== 0) throw new Error(`Gatekeeper rejected ${binaryPath}: ${result.stderr.trim() || result.stdout.trim()}`)
}

const verifySigned = async (options: ProducerCommandOptions & { signingIdentity: string, teamId: string }): Promise<void> => {
  if (!options.outputDir) throw new Error('verify-signed requires --artifacts-dir')
  for (const tool of options.tools) {
    const archiveName = managedSignedArchiveName(tool, options.architecture)
    const archivePath = join(options.outputDir, archiveName)
    const releaseManifestJson = await Bun.file(join(options.outputDir, managedSignedReleaseManifestName(tool, options.architecture))).text()
    const releaseManifest = parseManagedPrebuiltReleaseManifest(JSON.parse(releaseManifestJson) as unknown)
    const candidate: ManagedPrebuiltCandidate = {
      tool,
      version: releaseManifest.version,
      revision: releaseManifest.revision,
      platform: 'darwin',
      architecture: options.architecture,
      minimumMacosVersion: releaseManifest.minimumMacosVersion,
      url: `https://github.com/ajcwebdev/autoshow-cli/releases/download/${managedToolchainReleaseTag(tool)}/${archiveName}`,
      archiveName,
      archiveSha256: releaseManifest.archive.sha256,
      releaseManifestJson,
      releaseManifestSha256: sha256Bytes(releaseManifestJson),
      expectedSigningIdentity: options.signingIdentity,
      expectedTeamId: options.teamId
    }
    const quarantine = `0081;${Math.floor(Date.now() / 1000).toString(16)};AutoShow;${randomUUID()}`
    await runChecked('xattr', ['-w', 'com.apple.quarantine', quarantine, archivePath])
    const quarantineBefore = await captureChecked('xattr', ['-p', 'com.apple.quarantine', archivePath])
    if (quarantineBefore !== quarantine) throw new Error(`could not apply quarantine to ${archiveName}`)
    const destinationDir = join(options.workDir, 'signed-installed', tool)
    await installManagedPrebuiltCandidate({
      tool,
      candidate,
      destinationDir,
      host: { platform: 'darwin', architecture: options.architecture, macosVersion: MANAGED_UNSIGNED_DEPLOYMENT_TARGET },
      dependencies: {
        downloadArchive: async (_candidate, destination) => { await cp(archivePath, destination) }
      }
    })
    const installedBinary = join(destinationDir, managedArtifactBinaryRelativePath(tool))
    await assertManagedSignedCodeSignature(installedBinary, { signingIdentity: options.signingIdentity, teamId: options.teamId })
    await verifyGatekeeper(installedBinary)
    await runManagedToolFixtureChecks(tool, installedBinary, FIXTURE_PDF_PATH, join(options.workDir, 'signed-fixture-checks', tool))
    if (await captureChecked('xattr', ['-p', 'com.apple.quarantine', archivePath]) !== quarantine) throw new Error(`production extraction mutated quarantine on ${archiveName}`)
  }
}

const writeChecksums = async (artifactsDir: string, outputPath: string): Promise<void> => {
  const entries = await Array.fromAsync(new Bun.Glob('*').scan({ cwd: artifactsDir, onlyFiles: true }))
  const outputName = basename(outputPath)
  const files: ManagedArtifactPayloadFile[] = []
  for (const name of entries.sort()) {
    if (name === outputName) continue
    files.push({ path: name, sha256: await sha256File(join(artifactsDir, name)) })
  }
  await Bun.write(outputPath, `${files.map(file => `${file.sha256}  ${file.path}`).join('\n')}\n`)
}

export const managedSignedReleaseAssetNames = (tool: ManagedArtifactToolId): string[] => {
  const architectureAssets = (['arm64', 'x64'] as const).flatMap(architecture => [
    managedSignedArchiveName(tool, architecture),
    managedSignedReleaseManifestName(tool, architecture),
    managedSignedSbomName(tool, architecture),
    managedSignedNotarizationLogName(tool, architecture),
    managedSignedProvenanceBundleName(tool, architecture),
    managedSignedSbomAttestationBundleName(tool, architecture)
  ])
  return [
    ...architectureAssets,
    ...managedToolchainDistributionLicense(tool).correspondingSourceAssets,
    'DISTRIBUTION-NOTICE.txt',
    'SHA256SUMS'
  ].sort()
}

export const assembleManagedSignedDraftAssets = async (artifactsDir: string, outputDir: string): Promise<void> => {
  await rm(outputDir, { recursive: true, force: true })
  await mkdir(join(outputDir, 'assets'), { recursive: true })
  await mkdir(join(outputDir, 'release-notes'), { recursive: true })
  for (const tool of TOOLS) {
    const toolDir = join(outputDir, 'assets', tool)
    await mkdir(toolDir, { recursive: true })
    for (const architecture of ['arm64', 'x64'] as const) {
      const architectureDir = join(artifactsDir, architecture)
      const releaseManifestName = managedSignedReleaseManifestName(tool, architecture)
      const releaseManifestJson = await Bun.file(join(architectureDir, releaseManifestName)).text()
      const release = parseManagedPrebuiltReleaseManifest(JSON.parse(releaseManifestJson) as unknown)
      if (release.archive.name !== managedSignedArchiveName(tool, architecture) || release.archive.sha256 !== await sha256File(join(architectureDir, release.archive.name))) throw new Error(`${tool}/${architecture} release manifest archive binding failed`)
      if (release.sbom.name !== managedSignedSbomName(tool, architecture) || release.sbom.sha256 !== await sha256File(join(architectureDir, release.sbom.name))) throw new Error(`${tool}/${architecture} release manifest SBOM binding failed`)
      if (release.provenance.subjectDigest !== release.archive.sha256 || release.notarization.status !== 'Accepted') throw new Error(`${tool}/${architecture} trust metadata is incomplete`)
      if (JSON.stringify(release.licenseReviewReferences) !== JSON.stringify(managedToolchainDistributionLicense(tool).reviewReferences)) throw new Error(`${tool}/${architecture} release review references drifted`)
      const notarizationLog = JSON.parse(await Bun.file(join(architectureDir, managedSignedNotarizationLogName(tool, architecture))).text()) as Record<string, unknown>
      if (notarizationLog['submissionId'] !== release.notarization.submissionId || notarizationLog['status'] !== 'Accepted') throw new Error(`${tool}/${architecture} notarization log does not match the release manifest`)
      for (const name of [
        release.archive.name,
        releaseManifestName,
        release.sbom.name,
        managedSignedNotarizationLogName(tool, architecture),
        managedSignedProvenanceBundleName(tool, architecture),
        managedSignedSbomAttestationBundleName(tool, architecture)
      ]) await cp(join(architectureDir, name), join(toolDir, name))
    }
    const expectedSources = await readExpectedManagedArtifactSources(tool)
    for (const sourceName of managedToolchainDistributionLicense(tool).correspondingSourceAssets) {
      const arm64Source = join(artifactsDir, 'arm64', sourceName)
      const x64Source = join(artifactsDir, 'x64', sourceName)
      const expectedSource = expectedSources.find(source => basename(new URL(source.url).pathname) === sourceName)
      if (!expectedSource) throw new Error(`${sourceName} is not an exact pinned ${tool} source asset`)
      const arm64Sha256 = await sha256File(arm64Source)
      if (arm64Sha256 !== expectedSource.sha256 || await sha256File(x64Source) !== expectedSource.sha256) throw new Error(`${sourceName} differs from the pinned source or between protected architecture jobs`)
      await cp(arm64Source, join(toolDir, sourceName))
    }
    await Bun.write(join(toolDir, 'DISTRIBUTION-NOTICE.txt'), createManagedToolchainDistributionNotice(tool))
    await writeChecksums(toolDir, join(toolDir, 'SHA256SUMS'))
    const actualNames = await Array.fromAsync(new Bun.Glob('*').scan({ cwd: toolDir, onlyFiles: true }))
    if (JSON.stringify(actualNames.sort()) !== JSON.stringify(managedSignedReleaseAssetNames(tool))) throw new Error(`${tool} draft asset inventory is incomplete or contains extras`)
    await Bun.write(join(outputDir, 'release-notes', `${tool}.md`), [
      `AutoShow ${tool} ${tool === 'mupdf' ? '1.27.2' : '12.3.2'} macOS toolchain candidate ${MANAGED_SIGNED_REVISION}.`,
      '',
      'Phase 6 protected rehearsal draft. Do not publish until Phase 7 independently verifies this exact asset set.',
      '',
      `Producer commit: ${parseManagedPrebuiltReleaseManifest(JSON.parse(await Bun.file(join(toolDir, managedSignedReleaseManifestName(tool, 'arm64'))).text()) as unknown).producerCommit}`,
      ''
    ].join('\n'))
  }
}

const verify = async (options: ProducerCommandOptions): Promise<void> => {
  if (!options.outputDir) throw new Error('verify requires --artifacts-dir')
  for (const tool of options.tools) {
    const destinationDir = join(options.workDir, 'unsigned-installed', tool)
    await installManagedUnsignedVerificationArtifact({
      tool,
      architecture: options.architecture,
      artifactsDir: options.outputDir,
      destinationDir,
      fixturePdfPath: FIXTURE_PDF_PATH,
      forbiddenPaths: [options.workDir, process.env['GITHUB_WORKSPACE'] ?? '']
    })
  }
}

const stageAndValidateSourceBuild = async (build: BuildResult): Promise<void> => {
  const sourceInstallRoot = join(build.buildRoot, 'source-fallback-install')
  await mkdir(sourceInstallRoot, { recursive: true })
  const stagingDir = await createManagedToolStagingDirectory(join(sourceInstallRoot, build.tool))
  const binaryRelativePath = managedArtifactBinaryRelativePath(build.tool)
  await mkdir(dirname(join(stagingDir, binaryRelativePath)), { recursive: true })
  await cp(build.binaryPath, join(stagingDir, binaryRelativePath))
  await writeManagedSourceArtifactManifest({ tool: build.tool, toolDir: stagingDir, deploymentTarget: MANAGED_UNSIGNED_DEPLOYMENT_TARGET })
  const validation = await validateManagedSourceArtifact(build.tool, {
    toolDir: stagingDir,
    platform: 'darwin',
    architecture: process.arch,
    macosVersion: MANAGED_UNSIGNED_DEPLOYMENT_TARGET
  })
  if (!validation.healthy) throw new Error(`independent source fallback provenance failed: ${validation.reason}`)
  await runManagedToolFixtureChecks(build.tool, join(stagingDir, binaryRelativePath), FIXTURE_PDF_PATH, join(build.buildRoot, 'source-fallback-checks'))
  await rm(stagingDir, { recursive: true, force: true })
}

const verifySourceFallback = async (options: ProducerCommandOptions): Promise<void> => {
  for (const tool of options.tools) {
    const warnings: string[] = []
    await exerciseManagedUnsignedSourceFallback({
      tool,
      architecture: options.architecture,
      installSource: async () => {
        const build = await buildManagedUnsignedTool({
          tool,
          architecture: options.architecture,
          workDir: join(options.workDir, 'source-fallback'),
          runUpstreamTests: false
        })
        await stageAndValidateSourceBuild(build)
      },
      warn: message => { warnings.push(message) }
    })
    if (warnings.length !== 1 || !warnings[0]?.includes('no pinned prebuilt candidate')) throw new Error(`source fallback warning contract failed for ${tool}`)
  }
}

const optionValue = (args: string[], name: string): string | undefined => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

const parseTools = (value: string | undefined): ManagedArtifactToolId[] => {
  if (!value || value === 'all') return [...TOOLS]
  if (value === 'mupdf' || value === 'qpdf') return [value]
  throw new Error(`invalid --tool ${value}`)
}

const parseProducerCommandOptions = (
  args: string[],
  command: 'produce' | 'verify' | 'verify-source-fallback' | 'produce-signed' | 'verify-signed'
): ProducerCommandOptions => {
  const architecture = optionValue(args, '--architecture')
  if (architecture !== 'arm64' && architecture !== 'x64') throw new Error('producer requires --architecture arm64 or x64')
  const workDir = optionValue(args, '--work-dir')
  if (!workDir) throw new Error('producer requires --work-dir')
  const outputDir = optionValue(args, command === 'verify' || command === 'verify-signed' ? '--artifacts-dir' : '--output-dir')
  return {
    architecture,
    workDir: resolve(workDir),
    ...(outputDir ? { outputDir: resolve(outputDir) } : {}),
    tools: parseTools(optionValue(args, '--tool'))
  }
}

const requiredOption = (args: string[], name: string): string => {
  const value = optionValue(args, name)
  if (!value) throw new Error(`missing required ${name}`)
  return value
}

if (import.meta.main) {
  try {
    const args = process.argv.slice(2)
    const command = args[0]
    if (command === 'produce') await produce(parseProducerCommandOptions(args, command))
    else if (command === 'verify') await verify(parseProducerCommandOptions(args, command))
    else if (command === 'verify-source-fallback') await verifySourceFallback(parseProducerCommandOptions(args, command))
    else if (command === 'produce-signed') {
      await produceSigned({
        ...parseProducerCommandOptions(args, command),
        signingIdentity: requiredOption(args, '--signing-identity'),
        teamId: requiredOption(args, '--team-id'),
        notaryKeyPath: resolve(requiredOption(args, '--notary-key')),
        notaryKeyId: requiredOption(args, '--notary-key-id'),
        notaryIssuerId: requiredOption(args, '--notary-issuer-id')
      })
    } else if (command === 'verify-signed') {
      const options = parseProducerCommandOptions(args, command)
      assertNativeArchitecture(options.architecture)
      await verifySigned({
        ...options,
        signingIdentity: requiredOption(args, '--signing-identity'),
        teamId: requiredOption(args, '--team-id')
      })
    } else if (command === 'verify-release-inputs') {
      await assertManagedProtectedReleaseInputs({
        ref: requiredOption(args, '--ref'),
        defaultBranch: requiredOption(args, '--default-branch'),
        checkedOutCommit: requiredOption(args, '--checked-out-commit'),
        dispatchCommit: requiredOption(args, '--dispatch-commit'),
        requestedCommit: requiredOption(args, '--requested-commit'),
        revision: requiredOption(args, '--revision'),
        mupdfVersion: requiredOption(args, '--mupdf-version'),
        qpdfVersion: requiredOption(args, '--qpdf-version')
      })
    } else if (command === 'write-checksums') {
      await writeChecksums(resolve(requiredOption(args, '--artifacts-dir')), resolve(requiredOption(args, '--output')))
    } else if (command === 'assemble-drafts') {
      await assembleManagedSignedDraftAssets(resolve(requiredOption(args, '--artifacts-dir')), resolve(requiredOption(args, '--output-dir')))
    } else {
      throw new Error('usage: macos-toolchain-producer <produce|verify|verify-source-fallback|verify-release-inputs|produce-signed|verify-signed|write-checksums|assemble-drafts> [options]')
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
