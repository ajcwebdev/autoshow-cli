import { realpath } from 'node:fs/promises'
import { join } from 'node:path'
import type { DoctorToolProvenance, RuntimeToolId } from '~/types'
import { assertRuntimeContainedPath, calibreToolDir, ffmpegToolDir, getRuntimeToolManagedPath, lameToolDir, leptonicaToolDir, mupdfToolDir, qpdfToolDir, RUNTIME_DIR, RUNTIME_TOOLS_DIR, tesseractToolDir, ytDlpManagedBinaryPath } from '~/utils/runtime-paths'
import { SOURCE_ROOT } from '~/utils/project-root'
import { validateProjectRuntimeDependencies } from '~/tools/project-runtime-dependencies'
import { defuddleRuntimeDir, validateManagedDefuddleRuntime } from '~/cli/commands/text/url/url-local/defuddle/defuddle-cli'
import { MANAGED_BUILD_TOOL_SOURCES, managedBuildToolPrefix, readManagedBuildToolReadiness } from './setup-download/managed-build-tools'
import { validateManagedMacosTool } from './setup-download/macos-managed-tools'
import { nativeDependencyOrder, nativeDependencyPrefix, validateManagedNativeDependency } from './setup-download/managed-native-dependencies'
import { validateManagedRenderingConfiguration } from './setup-download/managed-native-rendering'
import { managedAlignmentRuntimeDir, readManagedJsRuntimeSources, validateManagedJsRuntime, validateManagedAlignmentRuntime } from './setup-download/managed-js-runtime'
import { readManagedToolTransactionIssue } from './setup-download/managed-artifact'
import { validateManagedLinuxToolchain } from './setup-download/managed-linux-tools'
import { NATIVE_DEPENDENCY_RECIPES } from './setup-download/managed-native-recipes'
import type { NativeDependencyName } from './setup-download/managed-native-recipes'
import { runReadOnlyDoctorProcess } from './doctor-read-only-process'

const renderingDependencies: Partial<Record<RuntimeToolId, NativeDependencyName>> = {
  magick: 'imagemagick', convert: 'imagemagick', 'pango-view': 'pango', 'fc-match': 'fontconfig', 'fc-cache': 'fontconfig'
}

const sourceApplications = new Set<RuntimeToolId>(['ffmpeg', 'ffprobe', 'yt-dlp', 'mutool', 'qpdf', 'ebook-convert', 'tesseract'])

/** One report hashes each shared dependency once. Every callback is read-only. */
export const createDoctorToolProvenance = (options: { platform?: NodeJS.Platform, sourceRoot?: string } = {}) => {
  const platform = options.platform ?? process.platform
  const pending = new Map<string, Promise<DoctorToolProvenance>>()
  const once = (key: string, inspect: () => Promise<DoctorToolProvenance>): Promise<DoctorToolProvenance> => {
    const existing = pending.get(key)
    if (existing) return existing
    const result = inspect().catch(error => ({ healthy: false as const, reason: error instanceof Error ? error.message : String(error) }))
    pending.set(key, result)
    return result
  }
  const transactions = async (roots: readonly string[]): Promise<DoctorToolProvenance | undefined> => {
    for (const root of roots) {
      const result = await once(`transaction:${root}`, async () => {
        const issue = await readManagedToolTransactionIssue(root)
        return issue ? { healthy: false, reason: `${root}: ${issue}` } : { healthy: true, detail: 'No unfinished managed installation transaction.' }
      })
      if (!result.healthy) return result
    }
    return undefined
  }
  const native = (name: NativeDependencyName): Promise<DoctorToolProvenance> => once(`native:${name}`, async () => {
    const issue = await transactions(nativeDependencyOrder([name]).map(nativeDependencyPrefix))
    if (issue) return issue
    const result = await validateManagedNativeDependency(name)
    return result.healthy
      ? { healthy: true, version: NATIVE_DEPENDENCY_RECIPES[name].version, detail: `managed source ${result.version} ${result.platform}/${result.architecture}; complete native payload verified` }
      : result
  })
  const linux = (): Promise<DoctorToolProvenance> => once('linux-toolchain', async () => {
    const issue = await transactions([join(RUNTIME_TOOLS_DIR, 'linux-root')])
    if (issue) return issue
    await validateManagedLinuxToolchain()
    return { healthy: true, detail: 'managed Linux package receipts, complete payload, wrappers, fonts, and configurations verified' }
  })
  const rendering = (): Promise<DoctorToolProvenance> => once('rendering-configuration', async () => {
    if (platform === 'linux') return await linux()
    const issue = await transactions([join(RUNTIME_DIR, 'fonts/dejavu')])
    if (issue) return issue
    const fonts = await native('dejavu-fonts')
    if (!fonts.healthy) return fonts
    const result = await validateManagedRenderingConfiguration()
    return result.healthy ? { healthy: true, detail: 'managed font bytes, font configuration, executable shims, and confined resources verified' } : result
  })
  const validateRuntimeTool = async (tool: RuntimeToolId, path: string): Promise<DoctorToolProvenance> => {
    try {
      assertRuntimeContainedPath(path)
      const canonical = getRuntimeToolManagedPath(tool)
      if (await realpath(path) !== await realpath(canonical)) return { healthy: false, reason: 'Selected tool is not the entrypoint covered by the managed installation receipt.' }
    } catch (error) { return { healthy: false, reason: error instanceof Error ? error.message : String(error) } }
    return await once(`tool:${tool}`, async () => {
      if (tool === 'bun' || tool === 'deno') {
        const issue = await transactions([join(RUNTIME_TOOLS_DIR, tool)])
        if (issue) return issue
        const result = await validateManagedJsRuntime(tool)
        const source = readManagedJsRuntimeSources().find(entry => entry.name === tool)
        return result.ok ? { healthy: true, detail: result.detail, ...(source ? { version: source.version } : {}) } : { healthy: false, reason: result.detail }
      }
      if (platform === 'linux') return await linux()
      if (['cmake', 'pkgconf', 'pkg-config', 'ninja', 'meson'].includes(tool)) {
        const names = Object.keys(MANAGED_BUILD_TOOL_SOURCES) as Array<keyof typeof MANAGED_BUILD_TOOL_SOURCES>
        const issue = await transactions(names.map(managedBuildToolPrefix))
        if (issue) return issue
        for (const name of names) {
          const readiness = await once(`bootstrap:${name}`, async () => {
            const result = await readManagedBuildToolReadiness(name)
            return result.healthy ? { healthy: true, version: result.version, detail: `${name}: pinned source recipe and complete installed payload verified` } : { healthy: false, reason: `${name}: ${result.reason ?? 'managed bootstrap receipt is invalid'}` }
          })
          if (!readiness.healthy) return readiness
        }
        const name = tool === 'pkg-config' ? 'pkgconf' : tool as keyof typeof MANAGED_BUILD_TOOL_SOURCES
        return { healthy: true, version: MANAGED_BUILD_TOOL_SOURCES[name].version, detail: 'managed build toolchain source receipts and complete resources verified' }
      }
      const dependency = renderingDependencies[tool]
      if (dependency) {
        const result = await native(dependency)
        if (!result.healthy) return result
        const config = await rendering()
        return config.healthy ? result : config
      }
      if (sourceApplications.has(tool)) {
        const roots = tool === 'ffmpeg' || tool === 'ffprobe' ? [ffmpegToolDir, lameToolDir]
          : tool === 'tesseract' ? [tesseractToolDir, leptonicaToolDir]
            : tool === 'ebook-convert' ? [calibreToolDir]
              : tool === 'mutool' ? [mupdfToolDir]
                : tool === 'qpdf' ? [qpdfToolDir] : [ytDlpManagedBinaryPath]
        const issue = await transactions(roots)
        if (issue) return issue
        const nativeDependencies: readonly NativeDependencyName[] = tool === 'ffmpeg' || tool === 'ffprobe' ? ['libass', 'x264'] : tool === 'tesseract' ? ['zlib', 'libpng', 'libjpeg-turbo', 'libtiff'] : []
        for (const dependencyName of nativeDependencies) {
          const result = await native(dependencyName)
          if (!result.healthy) return result
        }
        if (tool === 'ffmpeg' || tool === 'ffprobe' || tool === 'tesseract') {
          const dependencyName = tool === 'tesseract' ? 'leptonica' : 'lame'
          const dependency = await once(`macos:${dependencyName}`, async () => {
            const result = await validateManagedMacosTool(dependencyName, { execute: runReadOnlyDoctorProcess })
            return result.healthy ? { healthy: true, detail: `${dependencyName}: complete source payload verified`, version: result.version } : result
          })
          if (!dependency.healthy) return dependency
        }
        const result = await validateManagedMacosTool(tool as Parameters<typeof validateManagedMacosTool>[0], { execute: runReadOnlyDoctorProcess })
        return result.healthy ? { healthy: true, detail: `managed ${result.distribution} ${result.version} ${result.platform}/${result.architecture}; complete payload and entrypoint verified`, version: result.version } : result
      }
      return { healthy: false, reason: `No managed provenance validator is registered for ${tool}.` }
    })
  }
  const alignment = (): Promise<DoctorToolProvenance> => once('alignment', async () => {
    const issue = await transactions([managedAlignmentRuntimeDir()])
    if (issue) return issue
    const result = await validateManagedAlignmentRuntime()
    return result.ok ? { healthy: true, detail: result.detail } : { healthy: false, reason: result.detail }
  })
  const defuddle = (): Promise<DoctorToolProvenance> => once('defuddle', async () => {
    const issue = await transactions([defuddleRuntimeDir])
    if (issue) return issue
    const result = await validateManagedDefuddleRuntime()
    return result.ok ? { healthy: true, detail: result.detail } : { healthy: false, reason: result.detail }
  })
  const project = (): Promise<DoctorToolProvenance> => once('project-dependencies', async () => {
    if (Bun.isStandaloneExecutable) return { healthy: true, detail: 'Source dependency graph is bundled into the standalone executable.' }
    await validateProjectRuntimeDependencies({ projectRoot: options.sourceRoot ?? SOURCE_ROOT })
    return { healthy: true, detail: 'Source dependency alias, frozen manifests, complete runtime graph, and installation receipts verified.' }
  })
  return { validateRuntimeTool, validateRenderingConfiguration: rendering, validateAlignmentRuntime: alignment, validateDefuddleRuntime: defuddle, validateProjectDependencies: project }
}
