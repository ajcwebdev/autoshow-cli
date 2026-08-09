import { join, relative, resolve as resolvePath } from 'node:path'
import type { AggregatedPriceEstimate, BatchManifestEntry, ExtractBatchManifest, ExtractRoute, ExtractRouteResumeHandler, OcrTarget, ResumeHandler, ResumeResult, ResumeTarget, ResumeTargetKind, RuntimeOptions, StepEstimate, SttTarget, UrlArticleTarget } from '~/types'
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
import { assertManifestEntriesCanBeRewritten, readBatchManifest, readExtractBatchManifest, type ParsedItemManifest, writeExtractBatchManifest } from '~/cli/commands/process-steps/manifest-utils'
import { aggregateExplicitPriceEstimate } from '~/utils/pricing/aggregate-pricing'
import { CLIUsageError } from '~/utils/error-handler'

const EXPLICIT_STEP2_SELECTION_FILTER = {
  includeOrigins: ['explicit', 'all-shortcut']
} as const

const EMPTY_RESUME_RESULT: ResumeResult = {
  full: 0,
  incomplete: 0,
  failed: 0
}

const addResumeResult = (
  totals: ResumeResult,
  result: ResumeResult
): ResumeResult => ({
  full: totals.full + result.full,
  incomplete: totals.incomplete + result.incomplete,
  failed: totals.failed + result.failed
})

const getSelectedSttTargets = (
  opts: RuntimeOptions
): SttTarget[] | undefined => {
  const targets = collectSttTargets(opts, EXPLICIT_STEP2_SELECTION_FILTER)
  return targets.length > 0 ? targets : undefined
}

const getSelectedOcrTargets = (
  opts: RuntimeOptions
): OcrTarget[] | undefined => {
  const targets = collectExplicitOcrTargets(opts, EXPLICIT_STEP2_SELECTION_FILTER)
  return targets.length > 0 ? targets : undefined
}

const getSelectedUrlTargets = (
  opts: RuntimeOptions
): UrlArticleTarget[] | undefined => collectSelectedUrlTargets(opts)

const resolveExtractChildTargets = (
  opts: RuntimeOptions
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

const buildChildResumeTarget = (
  parentDir: string,
  route: ExtractRoute,
  relativeDir?: string | undefined
): ResumeTarget | undefined => {
  const childDir = resolvePath(parentDir, relativeDir ?? route)
  return {
    kind: 'extract',
    extractRoute: route,
    scope: 'batch',
    dir: childDir,
    manifestPath: join(childDir, 'batch.json')
  }
}

const isCompletionStatus = (
  value: unknown
): value is ExtractBatchManifest['items'][number]['completionStatus'] =>
  value === 'full' || value === 'incomplete' || value === 'failed' || value === 'skipped'

const toRelativeOutputDir = (
  parentDir: string,
  outputDir: unknown
): string | undefined => {
  if (typeof outputDir !== 'string' || outputDir.length === 0) {
    return undefined
  }

  const relativePath = relative(parentDir, outputDir)
  return relativePath.length > 0 ? relativePath : '.'
}

const syncExtractBatchManifest = async (
  parentDir: string,
  parsedManifest: ParsedItemManifest<ExtractBatchManifest>
): Promise<void> => {
  assertManifestEntriesCanBeRewritten(parsedManifest)
  const { manifest } = parsedManifest
  const nextItems = manifest.items.map((item) => ({ ...item }))

  for (const route of ['media', 'document', 'article'] as const) {
    const childRelativeDir = manifest.childBatches[route]
    if (typeof childRelativeDir !== 'string' || childRelativeDir.length === 0) {
      continue
    }

    const childDir = resolvePath(parentDir, childRelativeDir)
    const childManifest = await readBatchManifest(childDir, 'extract')
    const childEntries = childManifest?.manifest.items ?? []

    nextItems.forEach((item, index) => {
      if (item.childBatchEntry?.route !== route) {
        return
      }

      const childEntry = childEntries[item.childBatchEntry.index] as BatchManifestEntry | undefined
      if (!childEntry) {
        return
      }

      const outputDir = toRelativeOutputDir(parentDir, childEntry['outputDir'])
      nextItems[index] = {
        ...item,
        completionStatus: isCompletionStatus(childEntry['completionStatus'])
          ? childEntry['completionStatus']
          : item.completionStatus,
        ...(typeof childEntry['skipReason'] === 'string' ? { skipReason: childEntry['skipReason'] } : {}),
        ...(outputDir ? { outputDir } : {})
      }
    })
  }

  await writeExtractBatchManifest(parentDir, {
    ...manifest,
    items: nextItems
  })
}

const sttResumeHandler: ExtractRouteResumeHandler = {
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

const ocrResumeHandler: ExtractRouteResumeHandler = {
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

const urlArticleResumeHandler: ExtractRouteResumeHandler = {
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

const assertNoXSpaceResumeTarget = (manifest: ExtractBatchManifest): void => {
  if (manifest.childBatches['x-space'] !== undefined || manifest.items.some((item) => item.extractRoute === 'x-space')) {
    throwXSpaceNotResumable()
  }
}

const getExtractRouteResumeHandler = (
  route: ExtractRoute | undefined
): ExtractRouteResumeHandler | undefined => {
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

const extractResumeHandler: ResumeHandler = {
  kind: 'extract',
  hasResumableWork: async (target, opts, explicitFlags) => {
    const routeHandler = getExtractRouteResumeHandler(target.extractRoute)
    if (routeHandler) {
      return await routeHandler.hasResumableWork(target, opts, explicitFlags)
    }

    const manifest = await readExtractBatchManifest(target.dir)
    if (!manifest) {
      return false
    }
    assertNoXSpaceResumeTarget(manifest.manifest)

    const childTargets = resolveExtractChildTargets(opts)
    if (childTargets.shouldCheckStt) {
      const sttTarget = buildChildResumeTarget(target.dir, 'media', manifest.manifest.childBatches.media)
      const sttHandler = getExtractRouteResumeHandler('media')
      if (sttTarget && sttHandler && await sttHandler.hasResumableWork(sttTarget, opts, explicitFlags)) {
        return true
      }
    }

    if (childTargets.shouldCheckOcr) {
      const ocrTarget = buildChildResumeTarget(target.dir, 'document', manifest.manifest.childBatches.document)
      const ocrHandler = getExtractRouteResumeHandler('document')
      if (ocrTarget && ocrHandler && await ocrHandler.hasResumableWork(ocrTarget, opts, explicitFlags)) {
        return true
      }
    }

    if (childTargets.shouldCheckUrl) {
      const urlTarget = buildChildResumeTarget(target.dir, 'article', manifest.manifest.childBatches.article)
      const urlHandler = getExtractRouteResumeHandler('article')
      if (urlTarget && urlHandler && await urlHandler.hasResumableWork(urlTarget, opts, explicitFlags)) {
        return true
      }
    }

    return false
  },
  resume: async (target, opts, explicitFlags, displayOptions) => {
    const routeHandler = getExtractRouteResumeHandler(target.extractRoute)
    if (routeHandler) {
      return await routeHandler.resume(target, opts, explicitFlags, displayOptions)
    }

    const manifest = await readExtractBatchManifest(target.dir)
    if (!manifest) {
      return EMPTY_RESUME_RESULT
    }
    assertManifestEntriesCanBeRewritten(manifest)
    assertNoXSpaceResumeTarget(manifest.manifest)

    const childTargets = resolveExtractChildTargets(opts)
    let totals = EMPTY_RESUME_RESULT
    if (childTargets.shouldCheckStt) {
      const sttTarget = buildChildResumeTarget(target.dir, 'media', manifest.manifest.childBatches.media)
      const sttHandler = getExtractRouteResumeHandler('media')
      if (sttTarget && sttHandler) {
        totals = addResumeResult(totals, await sttHandler.resume(sttTarget, opts, explicitFlags))
      }
    }

    if (childTargets.shouldCheckOcr) {
      const ocrTarget = buildChildResumeTarget(target.dir, 'document', manifest.manifest.childBatches.document)
      const ocrHandler = getExtractRouteResumeHandler('document')
      if (ocrTarget && ocrHandler) {
        totals = addResumeResult(totals, await ocrHandler.resume(ocrTarget, opts, explicitFlags))
      }
    }

    if (childTargets.shouldCheckUrl) {
      const urlTarget = buildChildResumeTarget(target.dir, 'article', manifest.manifest.childBatches.article)
      const urlHandler = getExtractRouteResumeHandler('article')
      if (urlTarget && urlHandler) {
        totals = addResumeResult(totals, await urlHandler.resume(urlTarget, opts, explicitFlags))
      }
    }

    await syncExtractBatchManifest(target.dir, manifest)
    return totals
  },
  price: async (target, opts, explicitFlags) => {
    const routeHandler = getExtractRouteResumeHandler(target.extractRoute)
    if (routeHandler) {
      return await routeHandler.price(target, opts, explicitFlags)
    }

    const manifest = await readExtractBatchManifest(target.dir)
    if (!manifest) {
      return aggregateExplicitPriceEstimate([], opts)
    }
    assertNoXSpaceResumeTarget(manifest.manifest)

    const childTargets = resolveExtractChildTargets(opts)
    const steps: StepEstimate[] = []
    const notes: string[] = []
    const appendEstimate = (estimate: AggregatedPriceEstimate): void => {
      steps.push(...estimate.steps)
      notes.push(...(estimate.notes ?? []))
    }

    if (childTargets.shouldCheckStt) {
      const sttTarget = buildChildResumeTarget(target.dir, 'media', manifest.manifest.childBatches.media)
      const sttHandler = getExtractRouteResumeHandler('media')
      if (sttTarget && sttHandler) {
        appendEstimate(await sttHandler.price(sttTarget, opts, explicitFlags))
      }
    }

    if (childTargets.shouldCheckOcr) {
      const ocrTarget = buildChildResumeTarget(target.dir, 'document', manifest.manifest.childBatches.document)
      const ocrHandler = getExtractRouteResumeHandler('document')
      if (ocrTarget && ocrHandler) {
        appendEstimate(await ocrHandler.price(ocrTarget, opts, explicitFlags))
      }
    }

    if (childTargets.shouldCheckUrl) {
      const urlTarget = buildChildResumeTarget(target.dir, 'article', manifest.manifest.childBatches.article)
      const urlHandler = getExtractRouteResumeHandler('article')
      if (urlTarget && urlHandler) {
        appendEstimate(await urlHandler.price(urlTarget, opts, explicitFlags))
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

const RESUME_HANDLERS: Readonly<Record<ResumeTargetKind, ResumeHandler>> = {
  extract: extractResumeHandler,
  write: writeResumeHandler,
  tts: ttsResumeHandler,
  image: imageResumeHandler,
  video: videoResumeHandler,
  music: musicResumeHandler
}

export const getResumeHandler = (
  kind: ResumeTarget['kind']
): ResumeHandler | undefined => RESUME_HANDLERS[kind]
