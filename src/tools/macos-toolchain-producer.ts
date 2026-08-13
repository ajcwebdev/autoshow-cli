import { cp, mkdir, rm } from 'node:fs/promises'
import { cpus } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { readDependencyUrlAndSha256 } from '~/cli/commands/setup-and-utilities/setup/dependency-metadata'
import { runCapture, runInherit } from '~/cli/commands/setup-and-utilities/setup/run-complete-setup'
import {
  createManagedToolStagingDirectory,
  managedArtifactBinaryRelativePath,
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
import type { ManagedArtifactToolId, ManagedPrebuiltProducer, ManagedUnsignedVerificationBundle } from '~/types'
import { PROJECT_ROOT } from '~/utils/runtime-paths'

const WORKFLOW_NAME = 'macOS Toolchain Unsigned Verification'
const FIXTURE_PDF_PATH = join(PROJECT_ROOT, 'test/fixtures/setup/managed-toolchain-smoke.pdf')
const TOOLS: ManagedArtifactToolId[] = ['mupdf', 'qpdf']

type ProducerArchitecture = 'arm64' | 'x64'
type SourceDirectoryName = 'mupdf' | 'qpdf' | 'libjpeg-turbo'
type BuildResult = {
  tool: ManagedArtifactToolId
  binaryPath: string
  buildRoot: string
  sourceDirectories: Partial<Record<SourceDirectoryName, string>>
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
  const { sourceDir } = await downloadPinnedSource('mupdf', buildRoot)
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
  return { tool: 'mupdf', binaryPath, buildRoot, sourceDirectories: { mupdf: sourceDir } }
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
    sourceDirectories: { qpdf: qpdfSource.sourceDir, 'libjpeg-turbo': libjpegSource.sourceDir }
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
  architecture: ProducerArchitecture
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
    workflowName: WORKFLOW_NAME,
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

const parseCommandOptions = (args: string[]): { command: 'produce' | 'verify' | 'verify-source-fallback', options: ProducerCommandOptions } => {
  const command = args[0]
  if (command !== 'produce' && command !== 'verify' && command !== 'verify-source-fallback') throw new Error('usage: macos-toolchain-producer <produce|verify|verify-source-fallback> --architecture <arm64|x64> --work-dir <path> [--output-dir|--artifacts-dir <path>] [--tool <mupdf|qpdf|all>]')
  const architecture = optionValue(args, '--architecture')
  if (architecture !== 'arm64' && architecture !== 'x64') throw new Error('producer requires --architecture arm64 or x64')
  const workDir = optionValue(args, '--work-dir')
  if (!workDir) throw new Error('producer requires --work-dir')
  const outputDir = optionValue(args, command === 'verify' ? '--artifacts-dir' : '--output-dir')
  return {
    command,
    options: {
      architecture,
      workDir: resolve(workDir),
      ...(outputDir ? { outputDir: resolve(outputDir) } : {}),
      tools: parseTools(optionValue(args, '--tool'))
    }
  }
}

if (import.meta.main) {
  try {
    const { command, options } = parseCommandOptions(process.argv.slice(2))
    if (command === 'produce') await produce(options)
    else if (command === 'verify') await verify(options)
    else await verifySourceFallback(options)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
