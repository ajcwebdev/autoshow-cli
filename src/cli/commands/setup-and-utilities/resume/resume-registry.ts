import { join, relative, resolve as resolvePath } from 'node:path'
import type { AggregatedPriceEstimate, BatchManifestEntry, ExtractBatchManifest, ExtractRoute, ExtractRouteResumeHandler, OcrTarget, ResumeHandler, ResumeResult, ResumeTarget, ResumeTargetKind, RuntimeOptions, StepEstimate, SttTarget, UrlArticleTarget } from '~/types'
import { collectExplicitOcrTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-ocr/ocr-targets'
import { collectSttTargets } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-targets'
import { hasResumableOcrTargetWork, priceOcrTarget, resumeOcrTarget } from './extract/ocr-resume'
import { hasResumableSttTargetWork, priceSttTarget, resumeSttTarget } from './extract/stt-resume'
import { getSelectedUrlTargets as collectSelectedUrlTargets, hasResumableUrlArticleWork, priceUrlArticleTarget, resumeUrlArticleTarget } from './extract/url-resume'
import { hasResumableTtsWork, priceTtsTarget, resumeTtsTarget } from './generation/tts-resume'
import { hasResumableImageWork, priceImageTarget, resumeImageTarget } from './generation/image-resume'
import { hasResumableVideoWork, priceVideoTarget, resumeVideoTarget } from './generation/video-resume'
import { hasResumableMusicWork, priceMusicTarget, resumeMusicTarget } from './generation/music-resume'
import { hasResumableWriteWork, priceWriteTarget, resumeWriteTarget } from './write/write-resume'
import { readBatchManifest, readExtractBatchManifest, writeExtractBatchManifest } from '~/cli/commands/process-steps/manifest-utils'
import { aggregateExplicitPriceEstimate } from '~/utils/pricing/aggregate-pricing'

// The `ExtractRoute` value resume overloads to mean "URL article" (ADR-002 findings
// 2-3): the producer reserves `'x-space'` for the `x_space` input family, while resume
// keys `urlArticleResumeHandler` off it and infers it for all-`html_article` batches.
// The name is local; the string is persisted, so renaming this constant is free and
// changing its value is not (see `ExtractRoute`). The route-set validators
// (`isExtractRoute` in `resume-dispatch.ts` and `manifest-utils.ts`) keep the bare
// literal on purpose — they test the persisted route set, not this overload.
export const URL_ARTICLE_ROUTE = 'x-space' as const

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
  manifest: ExtractBatchManifest
): Promise<void> => {
  const nextItems = manifest.items.map((item) => ({ ...item }))

  for (const route of ['media', 'document'] as const) {
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

const getExtractRouteResumeHandler = (
  route: ExtractRoute | undefined
): ExtractRouteResumeHandler | undefined => {
  if (route === 'media') {
    return sttResumeHandler
  }
  if (route === 'document') {
    return ocrResumeHandler
  }
  if (route === URL_ARTICLE_ROUTE) {
    return urlArticleResumeHandler
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
      const urlTarget = buildChildResumeTarget(target.dir, URL_ARTICLE_ROUTE, manifest.manifest.childBatches[URL_ARTICLE_ROUTE])
      const urlHandler = getExtractRouteResumeHandler(URL_ARTICLE_ROUTE)
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
      const urlTarget = buildChildResumeTarget(target.dir, URL_ARTICLE_ROUTE, manifest.manifest.childBatches[URL_ARTICLE_ROUTE])
      const urlHandler = getExtractRouteResumeHandler(URL_ARTICLE_ROUTE)
      if (urlTarget && urlHandler) {
        totals = addResumeResult(totals, await urlHandler.resume(urlTarget, opts, explicitFlags))
      }
    }

    await syncExtractBatchManifest(target.dir, manifest.manifest)
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
      const urlTarget = buildChildResumeTarget(target.dir, URL_ARTICLE_ROUTE, manifest.manifest.childBatches[URL_ARTICLE_ROUTE])
      const urlHandler = getExtractRouteResumeHandler(URL_ARTICLE_ROUTE)
      if (urlTarget && urlHandler) {
        appendEstimate(await urlHandler.price(urlTarget, opts, explicitFlags))
      }
    }

    return aggregateExplicitPriceEstimate(steps, opts, { notes })
  }
}

const ttsResumeHandler: ResumeHandler = {
  kind: 'tts',
  hasResumableWork: async (target, opts, explicitFlags) =>
    await hasResumableTtsWork(target, opts, explicitFlags),
  resume: async (target, opts, explicitFlags, displayOptions) =>
    await resumeTtsTarget(target, opts, explicitFlags, displayOptions),
  price: async (target, opts, explicitFlags) =>
    await priceTtsTarget(target, opts, explicitFlags)
}

const writeResumeHandler: ResumeHandler = {
  kind: 'write',
  hasResumableWork: async (target, opts, explicitFlags) =>
    await hasResumableWriteWork(target, opts, explicitFlags),
  resume: async (target, opts, explicitFlags, displayOptions) =>
    await resumeWriteTarget(target, opts, explicitFlags, displayOptions),
  price: async (target, opts, explicitFlags) =>
    await priceWriteTarget(target, opts, explicitFlags)
}

const imageResumeHandler: ResumeHandler = {
  kind: 'image',
  hasResumableWork: async (target, opts, explicitFlags) =>
    await hasResumableImageWork(target, opts, explicitFlags),
  resume: async (target, opts, explicitFlags, displayOptions) =>
    await resumeImageTarget(target, opts, explicitFlags, displayOptions),
  price: async (target, opts, explicitFlags) =>
    await priceImageTarget(target, opts, explicitFlags)
}

const videoResumeHandler: ResumeHandler = {
  kind: 'video',
  hasResumableWork: async (target, opts, explicitFlags) =>
    await hasResumableVideoWork(target, opts, explicitFlags),
  resume: async (target, opts, explicitFlags, displayOptions) =>
    await resumeVideoTarget(target, opts, explicitFlags, displayOptions),
  price: async (target, opts, explicitFlags) =>
    await priceVideoTarget(target, opts, explicitFlags)
}

const musicResumeHandler: ResumeHandler = {
  kind: 'music',
  hasResumableWork: async (target, opts, explicitFlags) =>
    await hasResumableMusicWork(target, opts, explicitFlags),
  resume: async (target, opts, explicitFlags, displayOptions) =>
    await resumeMusicTarget(target, opts, explicitFlags, displayOptions),
  price: async (target, opts, explicitFlags) =>
    await priceMusicTarget(target, opts, explicitFlags)
}

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
