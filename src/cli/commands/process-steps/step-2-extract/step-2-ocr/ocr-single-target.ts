import type { OcrSingleRunContext, ProcessDocumentOutput } from '~/types'
import { l, runWithLogContext } from '~/utils/app-logger/app-logger'
import { logExtractManifestConsoleSummary } from '~/cli/commands/process-steps/write-manifest-log/write-manifest-log'
import { isEpubInspectMode, writeExtractionArtifact, writeTextArtifactFiles } from './ocr-artifacts'
import { buildDocumentMetadataPayload, buildSuccessfulResolvedProviderStates, resolveRecordedOcrStep2, toResolvedRequestedProviders } from './ocr-document-metadata'
import { writeOcrRunManifest } from './ocr-manifest'
import { buildExtractionOptionsForTarget } from './ocr-targets'
import { persistHostedOcrTokenUsageProfiles } from './ocr-utils/hosted-ocr-token-profiles'
import { persistHostedOcrThroughputProfiles } from './ocr-utils/hosted-ocr-throughput-profiles'
import { runOcr } from './run-ocr'

export const runOcrSingleTarget = async (ctx: OcrSingleRunContext): Promise<ProcessDocumentOutput> => {
  const { outputDir, explicitTargets, opts, effectiveOpts, hostedOcrScheduler, step1Metadata, web, documentSource, extractFilePath, preparedMarkdown, preflightEstimate } = ctx

  const singleTargetOpts = explicitTargets.length === 1
    ? buildExtractionOptionsForTarget(effectiveOpts, explicitTargets[0] as typeof explicitTargets[number])
    : effectiveOpts
  const extracted = await runWithLogContext({ step: 'step-2-ocr' }, async () =>
    await runOcr(extractFilePath, step1Metadata, singleTargetOpts)
  )
  const resolvedStep2 = resolveRecordedOcrStep2(
    step1Metadata.format,
    effectiveOpts,
    documentSource,
    explicitTargets.length === 1 ? explicitTargets : undefined,
    preparedMarkdown
  )
  const resolvedRequestedProviders = toResolvedRequestedProviders(resolvedStep2)

  const rootMetadata = buildDocumentMetadataPayload(step1Metadata, extracted.step2Metadata, {
    web,
    source: documentSource,
    resolvedStep2,
    completionStatus: 'full',
    ...(resolvedRequestedProviders
      ? {
          requestedProviders: resolvedRequestedProviders,
          providerStates: buildSuccessfulResolvedProviderStates(resolvedRequestedProviders),
          missingProviders: [],
          blockedProviders: []
        }
      : {}),
    preflightEstimate,
    ocrConcurrency: opts.ocrConcurrency,
    ocrConcurrencyMode: opts.ocrConcurrencyMode,
    ocrProviderConcurrency: opts.ocrProviderConcurrency,
    ocrLocalConcurrency: opts.ocrLocalConcurrency,
    hostedOcrScheduler: hostedOcrScheduler.snapshot()
  })
  await writeOcrRunManifest(outputDir, rootMetadata)
  await persistHostedOcrThroughputProfiles(hostedOcrScheduler.snapshot(), {
    completionStatus: 'full'
  }).catch((error) => {
    l.write('debug', `Failed to update hosted OCR throughput profiles: ${error instanceof Error ? error.message : String(error)}`)
  })
  await persistHostedOcrTokenUsageProfiles(extracted.step2Metadata, {
    completionStatus: 'full'
  }).catch((error) => {
    l.write('debug', `Failed to update hosted OCR token profiles: ${error instanceof Error ? error.message : String(error)}`)
  })
  logExtractManifestConsoleSummary(outputDir, rootMetadata)
  await writeExtractionArtifact(
    outputDir,
    extracted.result,
    opts.outputFormat ?? 'text',
    isEpubInspectMode(extracted.step2Metadata),
    'result.json'
  )
  if (Array.isArray(extracted.artifactFiles)) {
    await writeTextArtifactFiles(outputDir, extracted.artifactFiles)
  }

  return {
    result: extracted.result,
    step1Metadata,
    step2Metadata: extracted.step2Metadata,
    completionStatus: 'full',
    ...(resolvedRequestedProviders
      ? {
          requestedProviders: resolvedRequestedProviders,
          providerStates: buildSuccessfulResolvedProviderStates(resolvedRequestedProviders),
          missingProviders: [],
          blockedProviders: []
        }
      : {}),
    ...(web ? { web } : {}),
    outputDir
  }
}
