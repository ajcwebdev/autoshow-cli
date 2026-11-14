import { lstat, mkdir, mkdtemp, realpath, rm, symlink } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { exec } from '~/utils/cli-utils'
import { RUNTIME_DIR, RUNTIME_TOOLS_DIR, toProjectDisplayPath } from '~/utils/runtime-paths'
import { withProcessLock } from '~/utils/process-lock'
import { assertManagedRuntimePath, pathIsPhysicallyWithinRoot } from '~/utils/runtime-containment'
import { ensureRuntimeDirectory } from '~/utils/runtime-state'
import { runEpubBunInspect } from '~/cli/commands/text/ocr/ebook/epub/run-epub-bun-inspect'
import { InfraError } from '~/utils/error-handler'
import { pathExists } from '~/utils/filesystem'
import * as l from '~/utils/app-logger/app-logger'
import { downloadFile } from './download'
import { createManagedToolStagingDirectory, promoteManagedToolDirectory, recoverManagedToolDirectory } from './managed-artifact'
import {
  buildManagedAptOptions, buildManagedAptPlanArgs, LINUX_TOOLCHAIN_PACKAGES,
  managedAptBootstrapConfig, parseInstalledLinuxPackages, parseLinuxDebContents, parseManagedAptUris, readCachedLinuxPackagePlan, resolveInstalledLinuxPackageClosure, resolveManagedAptSha256
} from './managed-linux-package-plan'
import type { LinuxPackageDownload } from './managed-linux-package-plan'
import {
  collectLinuxPayload, copyInstalledLinuxPackagePaths, findLinuxToolTarget, installLinuxToolWrappers,
  LINUX_FONTCONFIG_CONFIGURATION, linuxPackagePathList, normalizeExtractedLinuxSymlinks, planLinuxToolWrappers, validateLinuxPayload
} from './managed-linux-payload'
import type { LinuxPayloadEntry } from './managed-linux-payload'
import { writeInstalledLinuxCatalog, writeLinuxPackageCatalog } from './managed-linux-catalog'

export type ManagedLinuxTool = 'ffmpeg' | 'ffprobe' | 'mutool' | 'qpdf' | 'ebook-convert' | 'tesseract' | 'magick' | 'convert' | 'identify' | 'pango-view' | 'fc-match' | 'fc-cache' | 'python3'
export type LinuxCommandRunner = (command: string, args: string[]) => Promise<{ exitCode: number; stdout: string; stderr: string }>
export type ManagedLinuxOptions = { forceRedownload?: boolean | undefined }
type LinuxToolchainReceipt = {
  schemaVersion: 2
  recipeRevision: 'linux-runtime-v3'
  architecture: string
  distribution: 'debian-packages'
  catalogPrefix?: string
  catalogPrefixes?: string[]
  requestedPackages: string[]
  packages: Array<{ name: string; version: string }> | LinuxPackageDownload[]
  payload: LinuxPayloadEntry[]
}

const RECEIPT = '.autoshow-linux-toolchain.json'
const linuxRoot = join(RUNTIME_TOOLS_DIR, 'linux-root')
const packageGroups: Record<ManagedLinuxTool, readonly string[]> = {
  ffmpeg: ['ffmpeg'], ffprobe: ['ffmpeg'], mutool: ['mupdf-tools'], qpdf: ['qpdf'],
  'ebook-convert': ['calibre', 'python3'], tesseract: ['tesseract-ocr', 'tesseract-ocr-eng'],
  magick: ['imagemagick'], convert: ['imagemagick'], identify: ['imagemagick'],
  'pango-view': ['pango1.0-tools', 'fontconfig', 'fonts-dejavu-core'],
  'fc-match': ['fontconfig', 'fonts-dejavu-core'], 'fc-cache': ['fontconfig', 'fonts-dejavu-core'], python3: ['python3']
}

const defaultRun: LinuxCommandRunner = async (command, args) => {
  const aptState = args.find(arg => arg.startsWith('Dir::State='))?.slice('Dir::State='.length)
  return await exec(command, args, {
    signal: AbortSignal.timeout(20 * 60_000), maxBufferBytes: 32 * 1024 * 1024,
    env: { TMPDIR: join(RUNTIME_DIR, 'tmp'), ...(aptState ? { APT_CONFIG: join(aptState, 'bootstrap.conf') } : {}) }
  })
}

const checkedRun = async (run: LinuxCommandRunner, command: string, args: string[]): Promise<string> => {
  const result = await run(command, args)
  if (result.exitCode !== 0) throw InfraError(`${command} failed during managed Linux setup: ${(result.stderr || result.stdout).trim().slice(-5000)}`, { stage: 'setup:linux' })
  return result.stdout
}

const withLinuxSetupHeartbeat = async <T>(label: string, operation: () => Promise<T>): Promise<T> => {
  const started = Date.now()
  l.write('info', label, { category: 'command' })
  const timer = setInterval(() => l.write('info', `${label} (${Math.round((Date.now() - started) / 1000)}s)`, { category: 'command' }), 10_000)
  try { return await operation() } finally { clearInterval(timer) }
}

const readReceipt = async (root: string): Promise<LinuxToolchainReceipt | undefined> => {
  try {
    const receipt = await Bun.file(join(root, RECEIPT)).json() as LinuxToolchainReceipt
    if (receipt.schemaVersion !== 2 || receipt.recipeRevision !== 'linux-runtime-v3' || receipt.architecture !== process.arch || receipt.distribution !== 'debian-packages' || !Array.isArray(receipt.requestedPackages) || !receipt.requestedPackages.every(value => typeof value === 'string') || !Array.isArray(receipt.payload)) return undefined
    return receipt
  } catch { return undefined }
}

const validateReceipt = async (root: string): Promise<void> => {
  const receipt = await readReceipt(root)
  if (!receipt) throw InfraError('Managed Linux toolchain receipt is missing or incompatible', { stage: 'setup:linux' })
  if (!receipt.catalogPrefix || !isAbsolute(receipt.catalogPrefix) || !await Bun.file(join(root, 'var/lib/dpkg/status')).exists()) throw InfraError('Managed Linux package catalog metadata is missing or incompatible', { stage: 'setup:linux' })
  await validateLinuxPayload(root, receipt.payload)
  const recorded = receipt.payload.map(entry => entry.path).sort()
  const actual = (await collectLinuxPayload(root)).map(entry => entry.path).filter(path => path !== RECEIPT).sort()
  if (JSON.stringify(recorded) !== JSON.stringify(actual)) throw InfraError('Managed Linux payload inventory changed', { stage: 'setup:linux' })
}

const validateLinuxToolCapabilities = async (payloadRoot: string, payload: readonly LinuxPayloadEntry[], requested: readonly string[], run: LinuxCommandRunner = defaultRun): Promise<void> => {
  await ensureRuntimeDirectory(join(RUNTIME_DIR, 'tmp'))
  const workspace = await mkdtemp(join(RUNTIME_DIR, 'tmp/linux-capabilities-'))
  let validated = false
  try {
    await ensureRuntimeDirectory(join(workspace, 'tools'))
    await symlink(payloadRoot, join(workspace, 'tools/linux-root'))
    await installLinuxToolWrappers(workspace, payloadRoot, payload)
    const probes: Array<{ tool: string; args: string[]; codes?: number[]; match?: RegExp }> = []
    if (requested.includes('ffmpeg')) probes.push({ tool: 'ffmpeg', args: ['-hide_banner', '-filters'], match: /\bass\s/ })
    if (requested.includes('mupdf-tools')) probes.push({ tool: 'mutool', args: ['-v'], codes: [0, 1] })
    if (requested.includes('qpdf')) probes.push({ tool: 'qpdf', args: ['--version'] })
    if (requested.includes('calibre')) probes.push({ tool: 'ebook-convert', args: ['--version'] })
    if (requested.includes('tesseract-ocr')) probes.push({ tool: 'tesseract', args: ['--list-langs'], match: /\beng\b/ })
    if (requested.includes('imagemagick')) probes.push({ tool: await findLinuxToolTarget(payloadRoot, 'magick') ? 'magick' : 'convert', args: ['-version'] })
    if (requested.includes('pango1.0-tools')) probes.push({ tool: 'pango-view', args: ['--version'] })
    if (requested.includes('fontconfig')) probes.push({ tool: 'fc-match', args: ['-f', '%{family}', 'DejaVu Sans'], match: /DejaVu Sans/ })
    if (requested.includes('python3')) probes.push({ tool: 'python3', args: ['--version'] })
    for (const probe of probes) {
      const result = await run(join(workspace, 'bin', probe.tool), probe.args)
      if (!(probe.codes ?? [0]).includes(result.exitCode) || (probe.match && !probe.match.test(`${result.stdout}\n${result.stderr}`))) throw InfraError(`Managed Linux ${probe.tool} capability check failed: ${(result.stderr || result.stdout).trim().slice(-3000)}`, { stage: 'setup:linux' })
    }
    if (requested.includes('calibre')) {
      const input = join(workspace, 'conversion-check.fb2')
      const output = join(workspace, 'conversion-check.epub')
      const expected = 'AUTOSHOW MANAGED CONVERSION CHECK'
      await Bun.write(assertManagedRuntimePath(input), `<?xml version="1.0"?><FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0"><description><title-info><genre>prose</genre><author><first-name>AutoShow</first-name><last-name>Fixture</last-name></author><book-title>Managed conversion check</book-title><lang>en</lang></title-info><document-info><author><first-name>AutoShow</first-name><last-name>Fixture</last-name></author><date>2026-01-01</date><id>autoshow-managed-conversion</id><version>1</version></document-info></description><body><section><p>${expected}</p></section></body></FictionBook>`)
      await checkedRun(run, join(workspace, 'bin/ebook-convert'), [input, output])
      if (!(await runEpubBunInspect(output)).text.includes(expected)) throw InfraError('Managed Linux Calibre conversion did not preserve synthetic source text', { stage: 'setup:linux' })
    }
    validated = true
  } finally {
    if (validated) await rm(assertManagedRuntimePath(workspace), { recursive: true, force: true })
    else l.warn(`Managed Linux capability workspace retained: ${toProjectDisplayPath(workspace)}`, { category: 'artifact' })
  }
}

/** Read-only provenance, inventory, resource and wrapper validation for doctor. */
export const validateManagedLinuxToolchain = async (runtimeRoot = RUNTIME_DIR): Promise<void> => {
  const root = join(runtimeRoot, 'tools/linux-root')
  await validateReceipt(root)
  const receipt = await readReceipt(root)
  if (!receipt) throw InfraError('Managed Linux toolchain receipt is missing', { stage: 'setup:linux' })
  if (receipt.catalogPrefix !== root) throw InfraError('Managed Linux package ownership paths need runtime relocation repair', { stage: 'setup:linux' })
  const fontConfiguration = join(runtimeRoot, 'fonts/fonts.conf')
  if (!pathIsPhysicallyWithinRoot(runtimeRoot, fontConfiguration) || await Bun.file(fontConfiguration).text() !== LINUX_FONTCONFIG_CONFIGURATION) throw InfraError('Managed Linux font configuration changed', { stage: 'setup:linux' })
  for (const { tool, script } of await planLinuxToolWrappers(runtimeRoot, root, receipt.payload)) {
    const path = join(runtimeRoot, 'bin', tool)
    if (!pathIsPhysicallyWithinRoot(runtimeRoot, path)) throw InfraError(`Managed Linux wrapper escapes runtime: ${tool}`, { stage: 'setup:linux' })
    const info = await lstat(await realpath(path))
    if (!info.isFile() || (info.mode & 0o111) === 0 || await Bun.file(path).text() !== script) throw InfraError(`Managed Linux wrapper integrity failed: ${tool}`, { stage: 'setup:linux' })
  }
}

export const readManagedLinuxEnglishDataIdentity = async (runtimeRoot = RUNTIME_DIR): Promise<{ path: string; sha256: string }> => {
  const root = join(runtimeRoot, 'tools/linux-root')
  const receipt = await readReceipt(root)
  if (!receipt) throw InfraError('Managed Linux toolchain receipt is missing or incompatible', { stage: 'setup:linux' })
  const entry = receipt.payload.find(value => /^usr\/share\/tesseract-ocr\/[^/]+\/tessdata\/eng\.traineddata$/.test(value.path))
  if (!entry) throw InfraError('Packaged Linux English trained data is absent from its receipt', { stage: 'setup:linux' })
  const path = join(root, entry.path)
  if (!pathIsPhysicallyWithinRoot(runtimeRoot, path)) throw InfraError('Packaged English trained data escapes runtime', { stage: 'setup:linux' })
  if (entry.kind === 'file') return { path, sha256: entry.sha256 }
  const resolved = await realpath(path)
  const physicalRoot = await realpath(root)
  const target = receipt.payload.find(value => value.kind === 'file' && join(physicalRoot, value.path) === resolved)
  if (!target || target.kind !== 'file') throw InfraError('Packaged English symlink has no regular-file receipt', { stage: 'setup:linux' })
  return { path, sha256: target.sha256 }
}

export const validateManagedLinuxTool = async (tool: ManagedLinuxTool, runtimeRoot = RUNTIME_DIR): Promise<void> => {
  await validateManagedLinuxToolchain(runtimeRoot)
  const root = join(runtimeRoot, 'tools/linux-root')
  const target = await findLinuxToolTarget(root, tool)
  if (!target && !(tool === 'magick' && await findLinuxToolTarget(root, 'convert'))) throw InfraError(`Managed Linux toolchain does not provide ${tool}`, { stage: 'setup:linux' })
}

/** Used by the image build after its OS package layer; the resulting payload is relocatable and runtime-only. */
export const stageInstalledLinuxToolchain = async (runtimeRoot: string, options: {
  sourceRoot?: string | undefined
  packages?: readonly string[] | undefined
  catalogPrefix?: string | undefined
  additionalCatalogPrefixes?: readonly string[] | undefined
  run?: LinuxCommandRunner | undefined
} = {}): Promise<void> => {
  if (process.platform !== 'linux' && !options.run) throw InfraError('Linux toolchain packaging requires Linux', { stage: 'setup:linux-package' })
  const sourceRoot = options.sourceRoot ?? '/'
  const run = options.run ?? defaultRun
  const requestedPackages = [...(options.packages ?? LINUX_TOOLCHAIN_PACKAGES)]
  const adminArgs = sourceRoot === '/' ? [] : [`--admindir=${join(sourceRoot, 'var/lib/dpkg')}`]
  const installed = parseInstalledLinuxPackages(await checkedRun(run, '/usr/bin/dpkg-query', [
    ...adminArgs, '-W', '-f=${binary:Package}\t${Version}\t${Depends}\t${Pre-Depends}\n'
  ]))
  const packages = resolveInstalledLinuxPackageClosure(installed, requestedPackages)
  const paths = linuxPackagePathList(await checkedRun(run, '/usr/bin/dpkg-query', [...adminArgs, '-L', ...packages.map(entry => entry.name)]))
  const root = join(runtimeRoot, 'tools/linux-root')
  if (!pathIsPhysicallyWithinRoot(runtimeRoot, root)) throw InfraError('Linux image payload must remain inside its selected runtime root', { stage: 'setup:linux-package' })
  await mkdir(root, { recursive: true })
  if (!pathIsPhysicallyWithinRoot(runtimeRoot, root)) throw InfraError('Linux image payload escaped its runtime root', { stage: 'setup:linux-package' })
  await withLinuxSetupHeartbeat(`Copying ${packages.length} Linux package payloads (${paths.length} owned paths)`, async () => await copyInstalledLinuxPackagePaths(sourceRoot, root, paths))
  const catalogPrefix = options.catalogPrefix ?? root
  await withLinuxSetupHeartbeat('Writing managed Linux package catalog', async () => await writeInstalledLinuxCatalog({ sourceRoot, payloadRoot: root, catalogPrefix, additionalCatalogPrefixes: options.additionalCatalogPrefixes, packages }))
  const payload = await withLinuxSetupHeartbeat('Hashing managed Linux payload', async () => await collectLinuxPayload(root))
  const receipt: LinuxToolchainReceipt = { schemaVersion: 2, recipeRevision: 'linux-runtime-v3', architecture: process.arch, distribution: 'debian-packages', catalogPrefix, ...(options.additionalCatalogPrefixes?.length ? { catalogPrefixes: [...new Set([catalogPrefix, ...options.additionalCatalogPrefixes].map(prefix => prefix.replace(/\/+$/, '') || '/'))] } : {}), requestedPackages, packages: packages.map(({ name, version }) => ({ name, version })), payload }
  const receiptPath = join(root, RECEIPT)
  if (!pathIsPhysicallyWithinRoot(runtimeRoot, receiptPath)) throw InfraError('Linux image receipt escaped its runtime root', { stage: 'setup:linux-package' })
  await Bun.write(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`)
  await withLinuxSetupHeartbeat('Verifying managed Linux payload', async () => await validateReceipt(root))
  if (!options.run) await withLinuxSetupHeartbeat('Checking managed Linux tool capabilities', async () => await validateLinuxToolCapabilities(root, payload, requestedPackages))
  await installLinuxToolWrappers(runtimeRoot, root, payload)
  l.write('info', `Packaged managed Linux toolchain (${payload.length} files and links)`, { category: 'command' })
}

const resolvePackagePlan = async (requestedPackages: string[], state: string, run: LinuxCommandRunner): Promise<LinuxPackageDownload[]> => {
  for (const tool of ['/usr/bin/apt-get', '/usr/bin/apt-cache', '/usr/bin/dpkg-deb']) {
    if (!await pathExists(tool)) throw InfraError(`Managed Linux package provisioning requires the Debian/Ubuntu bootstrap tool ${tool}. Use the supported container image on other Linux distributions.`, { stage: 'setup:linux' })
  }
  for (const directory of ['lists/partial', 'cache/archives/partial', 'plan-cache/archives/partial', 'log']) await ensureRuntimeDirectory(join(state, directory))
  await Bun.write(assertManagedRuntimePath(join(state, 'status')), '')
  await Bun.write(assertManagedRuntimePath(join(state, 'bootstrap.conf')), managedAptBootstrapConfig())
  await checkedRun(run, '/usr/bin/apt-get', [...buildManagedAptOptions(state), 'update'])
  const entries = parseManagedAptUris(await checkedRun(run, '/usr/bin/apt-get', buildManagedAptPlanArgs(state, requestedPackages)))
  const result: LinuxPackageDownload[] = []
  for (const entry of entries) {
    const parts = entry.fileName.split('_')
    const selector = `${parts[0]}=${decodeURIComponent(parts[1] ?? '')}`
    const metadata = /^SHA256:/i.test(entry.hash) ? '' : await checkedRun(run, '/usr/bin/apt-cache', [...buildManagedAptOptions(state), 'show', selector])
    result.push({ url: entry.url, fileName: entry.fileName, size: entry.size, sha256: resolveManagedAptSha256(entry, metadata) })
  }
  return result
}

const ensureManagedLinuxPackages = async (packages: readonly string[], options: ManagedLinuxOptions): Promise<void> => {
  if (process.platform !== 'linux') throw InfraError('Managed Debian package provisioning requires Linux; use native setup on this platform', { stage: 'setup:linux' })
  await ensureRuntimeDirectory(join(RUNTIME_DIR, 'tmp'))
  await withProcessLock('setup-managed-linux-toolchain', async () => {
    assertManagedRuntimePath(linuxRoot)
    await recoverManagedToolDirectory(linuxRoot)
    const previous = await readReceipt(linuxRoot)
    const requested = [...new Set([...(previous?.requestedPackages ?? []), ...packages])].sort()
    if (!options.forceRedownload && previous && previous.catalogPrefix === linuxRoot && requested.every(name => previous.requestedPackages.includes(name))) {
      try {
        await validateReceipt(linuxRoot)
        await installLinuxToolWrappers(RUNTIME_DIR, linuxRoot, previous.payload)
        return
      } catch {
        // Rebuild into staging; never erase a possibly useful current installation.
      }
    }
    const state = assertManagedRuntimePath(join(RUNTIME_DIR, 'cache/linux-apt'))
    const cachedPlan = !options.forceRedownload && previous && requested.every(name => previous.requestedPackages.includes(name)) ? readCachedLinuxPackagePlan(previous.packages) : undefined
    l.write('info', `${cachedPlan ? 'Reusing pinned package plan for' : 'Resolving'} managed Linux toolchain (${requested.length} requested package groups)`, { category: 'command' })
    const plan = cachedPlan ?? await resolvePackagePlan(requested, state, defaultRun)
    await ensureRuntimeDirectory(RUNTIME_TOOLS_DIR)
    const stagingDir = await createManagedToolStagingDirectory(linuxRoot)
    try {
      const catalog: Parameters<typeof writeLinuxPackageCatalog>[0]['packages'][number][] = []
      for (const [index, entry] of plan.entries()) {
        const archive = assertManagedRuntimePath(join(state, 'cache/archives', entry.fileName))
        let reusable = false
        if (!options.forceRedownload && await Bun.file(archive).exists()) {
          const hash = new Bun.CryptoHasher('sha256')
          for await (const chunk of Bun.file(archive).stream()) hash.update(chunk)
          reusable = hash.digest('hex') === entry.sha256
        }
        if (!reusable) await downloadFile({ url: entry.url, sha256: entry.sha256, destination: archive })
        assertManagedRuntimePath(stagingDir)
        await checkedRun(defaultRun, '/usr/bin/dpkg-deb', ['--extract', archive, stagingDir])
        await normalizeExtractedLinuxSymlinks(stagingDir)
        const controlRoot = assertManagedRuntimePath(join(state, 'control', entry.sha256))
        await ensureRuntimeDirectory(controlRoot)
        await checkedRun(defaultRun, '/usr/bin/dpkg-deb', ['--control', archive, controlRoot])
        const controlPath = assertManagedRuntimePath(join(controlRoot, 'control'))
        const md5sums = Bun.file(assertManagedRuntimePath(join(controlRoot, 'md5sums')))
        const conffiles = Bun.file(assertManagedRuntimePath(join(controlRoot, 'conffiles')))
        const identityParts = entry.fileName.split('_')
        catalog.push({
          controlText: await Bun.file(controlPath).text(),
          md5sumsText: await md5sums.exists() ? await md5sums.text() : undefined,
          conffilesText: await conffiles.exists() ? await conffiles.text() : undefined,
          packagePaths: parseLinuxDebContents(await checkedRun(defaultRun, '/usr/bin/dpkg-deb', ['--contents', archive])),
          expected: { name: identityParts[0] ?? '', version: decodeURIComponent(identityParts[1] ?? '') }
        })
        if (index === 0 || (index + 1) % 10 === 0 || index === plan.length - 1) l.write('info', `Managed Linux packages: ${index + 1}/${plan.length}`, { category: 'command' })
      }
      await normalizeExtractedLinuxSymlinks(stagingDir)
      await writeLinuxPackageCatalog({ payloadRoot: stagingDir, catalogPrefix: linuxRoot, packages: catalog })
      const payload = await withLinuxSetupHeartbeat('Hashing managed Linux package installation', async () => await collectLinuxPayload(stagingDir))
      const receipt: LinuxToolchainReceipt = { schemaVersion: 2, recipeRevision: 'linux-runtime-v3', architecture: process.arch, distribution: 'debian-packages', catalogPrefix: linuxRoot, requestedPackages: requested, packages: plan, payload }
      await Bun.write(assertManagedRuntimePath(join(stagingDir, RECEIPT)), `${JSON.stringify(receipt, null, 2)}\n`)
      await withLinuxSetupHeartbeat('Checking managed Linux tool capabilities', async () => await validateLinuxToolCapabilities(stagingDir, payload, requested))
      await promoteManagedToolDirectory({
        stagingDir, destinationDir: linuxRoot, validateStaging: async root => await withLinuxSetupHeartbeat('Verifying managed Linux installation', async () => await validateReceipt(root)),
        activate: async () => { await installLinuxToolWrappers(RUNTIME_DIR, linuxRoot, payload) },
        rollbackActivation: async hadPrevious => { if (hadPrevious) await installLinuxToolWrappers(RUNTIME_DIR) }
      })
      l.write('info', `Managed Linux toolchain ready (${plan.length} verified packages)`, { category: 'command' })
    } catch (error) {
      l.warn(`Managed Linux candidate retained: ${toProjectDisplayPath(stagingDir)}`, { category: 'artifact' })
      throw error
    }
  })
}

export const ensureManagedLinuxTool = async (tool: ManagedLinuxTool, options: ManagedLinuxOptions = {}): Promise<void> => {
  await ensureManagedLinuxPackages(packageGroups[tool], options)
  const expected = tool === 'magick' ? await findLinuxToolTarget(linuxRoot, 'magick') ?? await findLinuxToolTarget(linuxRoot, 'convert') : await findLinuxToolTarget(linuxRoot, tool)
  if (!expected) throw InfraError(`Managed Linux package installation did not provide ${tool}`, { stage: 'setup:linux' })
}

export const ensureManagedLinuxRendering = async (options: ManagedLinuxOptions = {}): Promise<void> =>
  await ensureManagedLinuxPackages(['imagemagick', 'pango1.0-tools', 'fontconfig', 'fonts-dejavu-core'], options)

export const ensureManagedLinuxToolchain = async (options: ManagedLinuxOptions = {}): Promise<void> =>
  await ensureManagedLinuxPackages(LINUX_TOOLCHAIN_PACKAGES, options)
