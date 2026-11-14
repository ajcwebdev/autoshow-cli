import { join } from 'node:path'
import type { SetupInstallationComponent, SetupInstallationPlan, SetupInstallationPlanTask, SetupRunOptions, SetupStepId } from '~/types'
import { RUNTIME_DIR } from '~/utils/runtime-paths'
import { pathExists } from '~/utils/filesystem'
import { readDependencyMetadata } from './dependency-metadata'
import { DEFAULT_WHISPERFILE_MODEL } from '../models/stt-models'
import { MANAGED_BUILD_TOOL_SOURCES } from './setup-download/managed-build-tools'
import { NATIVE_DEPENDENCY_RECIPES, type NativeDependencyName } from './setup-download/managed-native-recipes'
import { LINUX_TOOLCHAIN_PACKAGES } from './setup-download/managed-linux-package-plan'
import { WHISPERFILE_ARTIFACTS, WHISPERFILE_REVISION } from '~/cli/commands/stt/local/whisperfile/whisperfile-artifacts'
import { readManagedJsRuntimeSources } from './setup-download/managed-js-runtime'

const componentPrerequisites: Record<SetupInstallationComponent, SetupInstallationComponent[]> = {
  toolchain: [], media: ['toolchain'], documents: ['toolchain'], ocr: ['toolchain'],
  rendering: ['toolchain', 'media'], defuddle: ['toolchain'], alignment: ['toolchain'], whisperfile: ['toolchain']
}

const componentTargets: Record<SetupInstallationComponent, string> = {
  toolchain: 'tools/build-tools', media: 'tools/ffmpeg', documents: 'tools/calibre', ocr: 'tools/tesseract',
  rendering: 'tools/native/imagemagick', defuddle: 'defuddle', alignment: 'tools/stt-alignment', whisperfile: 'bin/whisperfile'
}

const componentSources: Partial<Record<SetupInstallationComponent, readonly string[]>> = {
  media: ['ffmpeg', 'lame', 'yt-dlp'], documents: ['mupdf', 'qpdf', 'calibre', 'libjpeg-turbo'],
  ocr: ['leptonica', 'tesseract', 'tessdataEng']
}

const componentNativeSources: Partial<Record<SetupInstallationComponent, readonly NativeDependencyName[]>> = {
  media: ['libass', 'x264'], documents: ['libjpeg-turbo'], ocr: ['zlib', 'libpng', 'libjpeg-turbo', 'libtiff'],
  rendering: ['imagemagick', 'pango', 'fontconfig', 'dejavu-fonts']
}

const selectedNativeSources = (components: readonly SetupInstallationComponent[]): NativeDependencyName[] => {
  const selected = new Set<NativeDependencyName>()
  const visit = (name: NativeDependencyName): void => {
    if (selected.has(name)) return
    for (const dependency of NATIVE_DEPENDENCY_RECIPES[name].dependencies) visit(dependency as NativeDependencyName)
    selected.add(name)
  }
  for (const component of components) for (const source of componentNativeSources[component] ?? []) visit(source)
  return [...selected]
}

const stepComponents: Record<SetupStepId, SetupInstallationComponent[]> = {
  all: ['toolchain', 'media', 'documents', 'ocr', 'rendering', 'defuddle', 'alignment', 'whisperfile'],
  toolchain: ['toolchain'], 'yt-dlp': ['media'], calibre: ['documents'], ocr: ['ocr'],
  rendering: ['rendering'], defuddle: ['defuddle'], alignment: ['alignment'],
  whisperfile: ['whisperfile'], transcription: ['media', 'whisperfile'], music: ['rendering', 'whisperfile']
}

export const resolveSetupComponents = (step: SetupStepId): SetupInstallationComponent[] => {
  const components = new Set<SetupInstallationComponent>()
  const visit = (component: SetupInstallationComponent): void => {
    if (components.has(component)) return
    for (const prerequisite of componentPrerequisites[component]) visit(prerequisite)
    components.add(component)
  }
  for (const component of stepComponents[step]) visit(component)
  return [...components]
}

/** Only reads metadata and existing targets: no subprocesses, network, or writes. */
export const buildSetupInstallationPlan = async (
  step: SetupStepId,
  options: SetupRunOptions = {}
): Promise<SetupInstallationPlan> => {
  const components = resolveSetupComponents(step)
  const tasks: SetupInstallationPlanTask[] = await Promise.all(components.map(async component => {
    const target = process.platform === 'linux' && ['toolchain', 'media', 'documents', 'ocr', 'rendering'].includes(component)
      ? 'tools/linux' : componentTargets[component]
    return {
      component,
      dependsOn: [...componentPrerequisites[component]],
      target: `runtime/${target}`,
      action: options.forceRedownload ? 'replace' : await pathExists(join(RUNTIME_DIR, target)) ? 'verify-or-repair' : 'install'
    }
  }))
  const metadata = await readDependencyMetadata()
  const selectedSources = new Set(components.flatMap(component => componentSources[component] ?? []))
  const dependencies: SetupInstallationPlan['dependencies'] = Object.entries(metadata)
    .filter(([name]) => selectedSources.has(name)).map(([name, entry]) => ({
    name, version: entry.tag ?? entry.version ?? entry.ref ?? 'unknown',
    ...(entry.url ? { url: entry.url } : {}), ...(entry.sha256 ? { sha256: entry.sha256 } : {})
  }))
  if (process.platform === 'darwin') {
    dependencies.push(...Object.entries(MANAGED_BUILD_TOOL_SOURCES).map(([name, source]) => ({ name, version: source.version, url: source.url, sha256: source.sha256 })))
    dependencies.push(...selectedNativeSources(components).map(name => {
      const source = NATIVE_DEPENDENCY_RECIPES[name]
      return { name, version: source.version, url: source.url, sha256: source.sha256 }
    }))
  } else if (process.platform === 'linux') {
    dependencies.length = 0
    dependencies.push(...LINUX_TOOLCHAIN_PACKAGES.map(name => ({ name, version: 'resolved from signed distribution metadata during installation' })))
    const downloader = metadata['yt-dlp']
    if (selectedSources.has('yt-dlp') && downloader) dependencies.push({
      name: 'yt-dlp', version: downloader.version ?? downloader.tag ?? 'unknown',
      ...(downloader.linuxUrl ? { url: downloader.linuxUrl } : {}), ...(downloader.linuxSha256 ? { sha256: downloader.linuxSha256 } : {})
    })
  }
  dependencies.push(...readManagedJsRuntimeSources())
  if (components.includes('defuddle')) dependencies.push({ name: 'defuddle', version: 'frozen', lockfile: 'config/defuddle/bun.lock' })
  if (components.includes('alignment')) dependencies.push({ name: 'onnxruntime-node', version: 'frozen', lockfile: 'config/stt-alignment/bun.lock' })
  const models = components.includes('whisperfile')
    ? [step === 'music' ? 'small.en' : DEFAULT_WHISPERFILE_MODEL]
    : []
  for (const model of models) {
    const artifact = WHISPERFILE_ARTIFACTS[model]
    if (artifact) dependencies.push({ name: `whisperfile:${model}`, version: WHISPERFILE_REVISION, url: `https://huggingface.co/Mozilla/whisperfile/resolve/${WHISPERFILE_REVISION}/whisper-${model}.llamafile`, sha256: artifact.sha256 })
  }
  return {
    schemaVersion: 1, dryRun: true, step, platform: process.platform, architecture: process.arch,
    runtimeRoot: 'runtime', forceRedownload: options.forceRedownload === true, tasks,
    dependencies: [...new Map(dependencies.map(dependency => [`${dependency.name}:${dependency.url ?? dependency.lockfile ?? ''}`, dependency])).values()], models,
    estimates: { downloadBytes: null, additionalDiskBytes: null, reason: 'Exact archive and expanded sizes are not recorded; preview performs no network requests.' }
  }
}
