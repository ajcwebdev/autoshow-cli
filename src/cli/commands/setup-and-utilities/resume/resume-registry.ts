import { join } from 'node:path'
import type { AggregatedPriceEstimate, ExtractRoute, ExtractRouteResumeHandler, OcrExtractionOptions, OcrTarget, PipelineManifest, PipelineManifestChildLink, ResumeHandler, ResumeResult, ResumeTarget, SttExtractionOptions, StepEstimate, SttTarget, UrlArticleTarget, UrlExtractionOptions } from '~/types'
import { collectExplicitOcrTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-targets'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import { hasResumableOcrTargetWork, priceOcrTarget, resumeOcrTarget } from './extract/ocr-resume'
import { hasResumableSttTargetWork, priceSttTarget, resumeSttTarget } from './extract/stt-resume'
import { getSelectedUrlTargets as collectSelectedUrlTargets, hasResumableUrlArticleWork, priceUrlArticleTarget, resumeUrlArticleTarget } from './extract/url-resume'
import { ttsResumeConfig } from './generation/tts-resume'
import { imageResumeConfig } from './generation/image-resume'
import { videoResumeConfig } from './generation/video-resume'
import { musicResumeConfig } from './generation/music-resume'
import { buildGenerationResumeHandler } from './generation-resume'
import { writeResumeConfig } from './write/write-resume'
import { PIPELINE_MANIFEST_FILE, readManifest, resolveManifestRelativePath, toManifestRelativePath, writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import { aggregateExplicitPriceEstimate } from '~/cli/commands/pricing-orchestration/aggregate-pricing'
import { CLIUsageError } from '~/utils/error-handler'

const EXPLICIT_STEP2_SELECTION_FILTER = {
  includeOrigins: ['explicit', 'all-shortcut']
} as const

const EMPTY_RESUME_RESULT: ResumeResult = {
  full: 0,
  incomplete: 0,
  failed: 0
}

type ExtractResumeOptions = SttExtractionOptions & OcrExtractionOptions & UrlExtractionOptions

const addResumeResult = (
  totals: ResumeResult,
  result: ResumeResult
): ResumeResult => ({
  full: totals.full + result.full,
  incomplete: totals.incomplete + result.incomplete,
  failed: totals.failed + result.failed
})

const getSelectedSttTargets = (
  opts: SttExtractionOptions
): SttTarget[] | undefined => {
  const targets = collectSttTargets(opts, EXPLICIT_STEP2_SELECTION_FILTER)
  return targets.length > 0 ? targets : undefined
}

const getSelectedOcrTargets = (
  opts: OcrExtractionOptions
): OcrTarget[] | undefined => {
  const targets = collectExplicitOcrTargets(opts, EXPLICIT_STEP2_SELECTION_FILTER)
  return targets.length > 0 ? targets : undefined
}

const getSelectedUrlTargets = (
  opts: UrlExtractionOptions
): UrlArticleTarget[] | undefined => collectSelectedUrlTargets(opts)

const resolveExtractChildTargets = (
  opts: ExtractResumeOptions
): {
  sttTargets?: SttTarget[] | undefined
  ocrTargets?: OcrTarget[] | undefined
  urlBackends?: UrlArticleTarget[] | undefined
  shouldCheckStt: boolean
  shouldCheckOcr: boolean
  shouldCheckUrl: boolean
} => {
  const sttTargets = getSelectedSttTargets(opts)
  const ocrTargets = getSelectedOcrTargets(opts)
  const urlBackends = getSelectedUrlTargets(opts)
  const hasAnyExplicitTargets = sttTargets !== undefined || ocrTargets !== undefined || urlBackends !== undefined
  const shouldCheckStt = sttTargets !== undefined || !hasAnyExplicitTargets
  const shouldCheckOcr = ocrTargets !== undefined || !hasAnyExplicitTargets
  const shouldCheckUrl = urlBackends !== undefined || !hasAnyExplicitTargets

  return {
    ...(sttTargets ? { sttTargets } : {}),
    ...(ocrTargets ? { ocrTargets } : {}),
    ...(urlBackends ? { urlBackends } : {}),
    shouldCheckStt,
    shouldCheckOcr,
    shouldCheckUrl
  }
}

const invalidExtractParentManifest = (
  parentDir: string,
  detail: string
): Error =>
  CLIUsageError(`Invalid canonical extract parent manifest at ${join(parentDir, PIPELINE_MANIFEST_FILE)}: ${detail}`)

const buildChildResumeTarget = (
  parentDir: string,
  child: PipelineManifestChildLink
): ResumeTarget => {
  const childDir = resolveManifestRelativePath(parentDir, child.manifestDir)
  if (toManifestRelativePath(parentDir, childDir) === '.') {
    throw invalidExtractParentManifest(parentDir, 'a child manifest cannot point to the parent directory')
  }
  return {
    kind: 'extract',
    extractRoute: child.route,
    scope: 'batch',
    dir: childDir,
    manifestPath: join(childDir, PIPELINE_MANIFEST_FILE)
  }
}

const readExtractManifest = async (
  target: ResumeTarget
): Promise<PipelineManifest | undefined> => {
  const manifest = await readManifest(target.dir)
  if (!manifest) {
    return undefined
  }
  if (manifest.command !== 'extract' || manifest.scope !== target.scope) {
    throw CLIUsageError(`Invalid extract manifest at ${target.manifestPath}.`)
  }
  return manifest
}

const isExtractParentManifest = (
  manifest: PipelineManifest
): boolean => manifest.items.some((item) => item.child !== undefined)

const assertLinkedChildItem = (
  parentDir: string,
  child: PipelineManifestChildLink,
  manifest: PipelineManifest
): void => {
  const childItem = manifest.items[child.index]
  if (!childItem) {
    throw invalidExtractParentManifest(parentDir, `child ${child.manifestDir} has no item ${child.index}`)
  }
  if (childItem.extractRoute !== child.route) {
    throw invalidExtractParentManifest(parentDir, `child ${child.manifestDir} item ${child.index} has route ${childItem.extractRoute ?? 'missing'}, expected ${child.route}`)
  }
}

const readExtractChildManifest = async (
  parentDir: string,
  child: PipelineManifestChildLink
): Promise<{ target: ResumeTarget, manifest: PipelineManifest }> => {
  const target = buildChildResumeTarget(parentDir, child)
  const manifest = await readManifest(target.dir)
  if (!manifest) {
    throw invalidExtractParentManifest(parentDir, `missing child manifest ${child.manifestDir}/${PIPELINE_MANIFEST_FILE}`)
  }
  if (manifest.command !== 'extract' || manifest.scope !== 'batch') {
    throw invalidExtractParentManifest(parentDir, `child ${child.manifestDir} is not an extract batch`)
  }
  assertLinkedChildItem(parentDir, child, manifest)
  return { target, manifest }
}

const resolveExtractChildResumeTargets = async (
  parentDir: string,
  manifest: PipelineManifest
): Promise<Partial<Record<ExtractRoute, ResumeTarget>>> => {
  if (manifest.command !== 'extract' || manifest.scope !== 'batch') {
    throw invalidExtractParentManifest(parentDir, 'parent must be an extract batch')
  }
  const targets: Partial<Record<ExtractRoute, ResumeTarget>> = {}
  const manifestDirs: Partial<Record<ExtractRoute, string>> = {}
  const routesByManifestDir = new Map<string, ExtractRoute>()
  const childManifests = new Map<string, PipelineManifest>()
  const linkedIndexesByManifestDir = new Map<string, Set<number>>()

  for (const item of manifest.items) {
    const child = item.child
    if (!child) {
      if (item.status !== 'skipped' && item.extractRoute !== undefined) {
        throw invalidExtractParentManifest(parentDir, `non-skipped ${item.extractRoute} item is missing its child link`)
      }
      continue
    }
    if (item.extractRoute !== child.route) {
      throw invalidExtractParentManifest(parentDir, `item route ${item.extractRoute ?? 'missing'} does not match child route ${child.route}`)
    }
    const target = buildChildResumeTarget(parentDir, child)
    if (manifestDirs[child.route] !== undefined && manifestDirs[child.route] !== target.dir) {
      throw invalidExtractParentManifest(parentDir, `route ${child.route} points to multiple child manifests`)
    }
    const existingRoute = routesByManifestDir.get(target.dir)
    if (existingRoute !== undefined && existingRoute !== child.route) {
      throw invalidExtractParentManifest(parentDir, `child ${child.manifestDir} is linked as both ${existingRoute} and ${child.route}`)
    }
    const linkedIndexes = linkedIndexesByManifestDir.get(target.dir) ?? new Set<number>()
    if (linkedIndexes.has(child.index)) {
      throw invalidExtractParentManifest(parentDir, `child ${child.manifestDir} item ${child.index} is linked more than once`)
    }
    linkedIndexes.add(child.index)
    linkedIndexesByManifestDir.set(target.dir, linkedIndexes)
    let childManifest = childManifests.get(target.dir)
    if (!childManifest) {
      childManifest = (await readExtractChildManifest(parentDir, child)).manifest
      childManifests.set(target.dir, childManifest)
    } else {
      assertLinkedChildItem(parentDir, child, childManifest)
    }
    manifestDirs[child.route] = target.dir
    routesByManifestDir.set(target.dir, child.route)
    targets[child.route] = target
  }

  return targets
}

const syncExtractParentManifest = async (
  parentDir: string,
  manifest: PipelineManifest
): Promise<void> => {
  const childManifests = new Map<string, PipelineManifest>()
  const nextItems: PipelineManifest['items'] = []
  for (const item of manifest.items) {
    const child = item.child
    if (!child) {
      nextItems.push({ ...item })
      continue
    }

    const childTarget = buildChildResumeTarget(parentDir, child)
    let childManifest = childManifests.get(childTarget.dir)
    if (!childManifest) {
      childManifest = (await readExtractChildManifest(parentDir, child)).manifest
      childManifests.set(childTarget.dir, childManifest)
    } else {
      assertLinkedChildItem(parentDir, child, childManifest)
    }
    const childItem = childManifest.items[child.index]
    if (!childItem) {
      throw invalidExtractParentManifest(parentDir, `child ${child.manifestDir} has no item ${child.index}`)
    }
    const nextItem = {
      ...item,
      status: childItem.status
    }
    if (childItem.outputDir === undefined) {
      delete nextItem.outputDir
    } else {
      const childDir = resolveManifestRelativePath(parentDir, child.manifestDir)
      nextItem.outputDir = toManifestRelativePath(parentDir, resolveManifestRelativePath(childDir, childItem.outputDir))
    }
    nextItems.push(nextItem)
  }

  await writeManifest(parentDir, {
    ...manifest,
    items: nextItems
  })
}

const sttResumeHandler: ExtractRouteResumeHandler<SttExtractionOptions> = {
  hasResumableWork: async (target, opts, _explicitFlags) =>
    await hasResumableSttTargetWork(
      target,
      getSelectedSttTargets(opts),
      {
        youtubeCaptions: opts.youtubeCaptions,
        currentTargets: collectSttTargets(opts)
      }
    ),
  resume: async (target, opts, _explicitFlags, displayOptions) =>
    await resumeSttTarget(
      target,
      opts,
      getSelectedSttTargets(opts),
      displayOptions
    ),
  price: async (target, opts, _explicitFlags) =>
    await priceSttTarget(
      target,
      opts,
      getSelectedSttTargets(opts)
    )
}

const ocrResumeHandler: ExtractRouteResumeHandler<OcrExtractionOptions> = {
  hasResumableWork: async (target, opts, _explicitFlags) =>
    await hasResumableOcrTargetWork(
      target,
      getSelectedOcrTargets(opts)
    ),
  resume: async (target, opts, _explicitFlags, displayOptions) =>
    await resumeOcrTarget(
      target,
      opts,
      getSelectedOcrTargets(opts),
      displayOptions
    ),
  price: async (target, opts, _explicitFlags) =>
    await priceOcrTarget(
      target,
      opts,
      getSelectedOcrTargets(opts)
    )
}

const urlArticleResumeHandler: ExtractRouteResumeHandler<UrlExtractionOptions> = {
  hasResumableWork: async (target, opts, _explicitFlags) =>
    await hasResumableUrlArticleWork(
      target,
      getSelectedUrlTargets(opts)
    ),
  resume: async (target, opts, _explicitFlags, displayOptions) =>
    await resumeUrlArticleTarget(
      target,
      opts,
      getSelectedUrlTargets(opts),
      displayOptions
    ),
  price: async (target, opts, _explicitFlags) =>
    await priceUrlArticleTarget(
      target,
      opts,
      getSelectedUrlTargets(opts)
    )
}

const throwXSpaceNotResumable = (): never => {
  throw CLIUsageError('X-Space runs are not resumable. Re-run the pipeline instead.')
}

const assertNoXSpaceResumeTarget = (manifest: PipelineManifest): void => {
  if (manifest.items.some((item) => item.extractRoute === 'x-space' || item.child?.route === 'x-space')) {
    throwXSpaceNotResumable()
  }
}

const getExtractRouteResumeHandler = (
  route: ExtractRoute | undefined
) => {
  if (route === 'media') {
    return sttResumeHandler
  }
  if (route === 'document') {
    return ocrResumeHandler
  }
  if (route === 'article') {
    return urlArticleResumeHandler
  }
  if (route === 'x-space') {
    throwXSpaceNotResumable()
  }
  return undefined
}

const RESUMABLE_EXTRACT_ROUTES = ['media', 'document', 'article'] as const

const shouldCheckExtractRoute = (
  selection: ReturnType<typeof resolveExtractChildTargets>,
  route: typeof RESUMABLE_EXTRACT_ROUTES[number]
): boolean => route === 'media'
  ? selection.shouldCheckStt
  : route === 'document'
    ? selection.shouldCheckOcr
    : selection.shouldCheckUrl

const extractResumeHandler: ResumeHandler<ExtractResumeOptions> = {
  kind: 'extract',
  hasResumableWork: async (target, opts, explicitFlags) => {
    const manifest = await readExtractManifest(target)
    if (!manifest) {
      return false
    }
    if (!isExtractParentManifest(manifest)) {
      const routeHandler = getExtractRouteResumeHandler(target.extractRoute)
      return routeHandler
        ? await routeHandler.hasResumableWork(target, opts, explicitFlags)
        : false
    }
    assertNoXSpaceResumeTarget(manifest)

    const selection = resolveExtractChildTargets(opts)
    const childTargets = await resolveExtractChildResumeTargets(target.dir, manifest)
    for (const route of RESUMABLE_EXTRACT_ROUTES) {
      const childTarget = childTargets[route]
      const routeHandler = getExtractRouteResumeHandler(route)
      if (
        shouldCheckExtractRoute(selection, route)
        && childTarget
        && routeHandler
        && await routeHandler.hasResumableWork(childTarget, opts, explicitFlags)
      ) {
        return true
      }
    }
    return false
  },
  resume: async (target, opts, explicitFlags, displayOptions) => {
    const manifest = await readExtractManifest(target)
    if (!manifest) {
      return EMPTY_RESUME_RESULT
    }
    if (!isExtractParentManifest(manifest)) {
      const routeHandler = getExtractRouteResumeHandler(target.extractRoute)
      return routeHandler
        ? await routeHandler.resume(target, opts, explicitFlags, displayOptions)
        : EMPTY_RESUME_RESULT
    }
    assertNoXSpaceResumeTarget(manifest)

    const selection = resolveExtractChildTargets(opts)
    const childTargets = await resolveExtractChildResumeTargets(target.dir, manifest)
    let totals = EMPTY_RESUME_RESULT
    for (const route of RESUMABLE_EXTRACT_ROUTES) {
      const childTarget = childTargets[route]
      const routeHandler = getExtractRouteResumeHandler(route)
      if (shouldCheckExtractRoute(selection, route) && childTarget && routeHandler) {
        totals = addResumeResult(totals, await routeHandler.resume(childTarget, opts, explicitFlags))
      }
    }

    await syncExtractParentManifest(target.dir, manifest)
    return totals
  },
  price: async (target, opts, explicitFlags) => {
    const manifest = await readExtractManifest(target)
    if (!manifest) {
      return aggregateExplicitPriceEstimate([], opts)
    }
    if (!isExtractParentManifest(manifest)) {
      const routeHandler = getExtractRouteResumeHandler(target.extractRoute)
      return routeHandler
        ? await routeHandler.price(target, opts, explicitFlags)
        : aggregateExplicitPriceEstimate([], opts)
    }
    assertNoXSpaceResumeTarget(manifest)

    const selection = resolveExtractChildTargets(opts)
    const childTargets = await resolveExtractChildResumeTargets(target.dir, manifest)
    const steps: StepEstimate[] = []
    const notes: string[] = []
    const appendEstimate = (estimate: AggregatedPriceEstimate): void => {
      steps.push(...estimate.steps)
      notes.push(...(estimate.notes ?? []))
    }

    for (const route of RESUMABLE_EXTRACT_ROUTES) {
      const childTarget = childTargets[route]
      const routeHandler = getExtractRouteResumeHandler(route)
      if (shouldCheckExtractRoute(selection, route) && childTarget && routeHandler) {
        appendEstimate(await routeHandler.price(childTarget, opts, explicitFlags))
      }
    }

    return aggregateExplicitPriceEstimate(steps, opts, { notes })
  }
}

const ttsResumeHandler = buildGenerationResumeHandler('tts', ttsResumeConfig)

const writeResumeHandler = buildGenerationResumeHandler('write', writeResumeConfig)

const imageResumeHandler = buildGenerationResumeHandler('image', imageResumeConfig)

const videoResumeHandler = buildGenerationResumeHandler('video', videoResumeConfig)

const musicResumeHandler = buildGenerationResumeHandler('music', musicResumeConfig)

const RESUME_HANDLERS = {
  extract: extractResumeHandler,
  write: writeResumeHandler,
  tts: ttsResumeHandler,
  image: imageResumeHandler,
  video: videoResumeHandler,
  music: musicResumeHandler
} as const

export const getResumeHandler = (
  kind: ResumeTarget['kind']
) => RESUME_HANDLERS[kind]
