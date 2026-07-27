import { processStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/process-stt'
import { processUrlArticle } from '~/cli/commands/process-steps/step-2-extract/step-2-url/process-url'
import { downloadDocumentUrlToTempFile } from '~/cli/commands/process-steps/step-1-download/document/resolve-document-source'
import { detectDocumentFormat } from '~/cli/commands/process-steps/step-0-metadata/formats/metadata-detect-format'
import { runTextWrite } from '~/cli/commands/process-steps/step-3-write/run-text-write'
import { isTextInputPath } from '~/cli/commands/process-steps/step-3-write/text-input-utils'
import { fileExists } from '~/utils/cli-utils'
import { CLIUsageError } from '~/utils/error-handler'
import type { AggregatedPriceEstimate, BatchChildRunContext, BatchItem, BatchItemProcessResult, ProcessCommand, RuntimeOptions, SttBatchCoordinator } from '~/types'
import { canonicalizeProcessCommand, isExtractCommand } from '~/cli/commands/process-steps/process-command-kinds'
import { classifyInputFamily, classifyUrlInput, isDocumentByExtension, isHtmlDocumentPath, isLikelyUrl } from '~/cli/commands/process-steps/step-0-metadata/metadata-targets/metadata-input-classifier'
import { throwUnrecognizedExtractInput, throwUnsupportedProcessInput } from './single-target-errors'
import { processDownloadMedia, processMediaSingle, processMetadataMedia } from './media-runner'
import { prepareArticleDocument, processDownloadDocument, processDownloadPreparedDocument, processMetadataDocument, processMetadataPreparedDocument, processOcrSingle } from './document-runner'
import { runDocumentWrite, runExtractedDocumentWrite } from './document-write'
import { processMetadataXSpace, processXSpace, resolveXSpaceDownloadTarget, runXSpaceWrite } from './x-space-runner'

const hasYtDlpPassthroughArgs = (opts: RuntimeOptions): boolean =>
  (opts.ytDlpPassthroughArgs?.length ?? 0) > 0

const throwUnsupportedDownloadPassthroughInput = (item: string): never => {
  throw CLIUsageError(`yt-dlp passthrough args (--) are only supported for media URL downloads. Got: ${item}`)
}

export const processSingleTarget = async (
  command: ProcessCommand,
  item: string,
  baseDir: string,
  opts: RuntimeOptions,
  preflightEstimate?: AggregatedPriceEstimate,
  runOptions?: {
    sttBatchCoordinator?: SttBatchCoordinator | undefined
    mistralSttPassController?: import('~/cli/commands/process-steps/step-2-extract/step-2-stt/stt-services/stt-mistral/mistral-stt-pass-controller').MistralSttPassController | undefined
    batchChildContext?: BatchChildRunContext | undefined
  },
  batchItem?: BatchItem
): Promise<BatchItemProcessResult | void> => {
  const displayCommand = canonicalizeProcessCommand(command)
  const batchChildContext = runOptions?.batchChildContext
  baseDir = baseDir && baseDir.trim().length > 0 ? baseDir : opts.outputRootDir

  if (command === 'metadata') {
    if (isLikelyUrl(item)) {
      const kind = await classifyUrlInput(item, opts)
      if (kind === 'url_x_space') {
        return await processMetadataXSpace(item, baseDir, opts, batchChildContext)
      }
      if (kind === 'url_direct_document') {
        const downloaded = await downloadDocumentUrlToTempFile(item)
        try {
          return await processMetadataDocument(downloaded.filePath, opts, baseDir, opts.password, { url: item }, batchChildContext)
        } finally {
          await downloaded.cleanup()
        }
      }
      if (kind === 'url_html_article') {
        const prepared = await prepareArticleDocument(item, baseDir, opts, batchChildContext)
        return await processMetadataPreparedDocument(prepared, opts)
      }
      return await processMetadataMedia(item, opts, baseDir, batchItem, batchChildContext)
    }

    const exists = await fileExists(item)
    if (!exists) {
      const { extractSpaceIdsFromText } = await import('~/cli/commands/process-steps/step-2-extract/step-2-url/url-services/x-spaces/input')
      if (extractSpaceIdsFromText(item).includes(item.trim())) {
        return await processMetadataXSpace(item, baseDir, opts, batchChildContext)
      }
      throw CLIUsageError(`Input does not exist: ${item}. Run: bun autoshow help metadata`)
    }

    if (isHtmlDocumentPath(item)) {
      const prepared = await prepareArticleDocument(item, baseDir, opts, batchChildContext)
      return await processMetadataPreparedDocument(prepared, opts)
    }

    const isDocExt = isDocumentByExtension(item)
    const detected = isDocExt ? await detectDocumentFormat(item) : null
    if (isDocExt || detected !== null) {
      return await processMetadataDocument(item, opts, baseDir, opts.password, undefined, batchChildContext)
    } else {
      return await processMetadataMedia(item, opts, baseDir, batchItem, batchChildContext)
    }
  }

  if (command === 'download') {
    if (isLikelyUrl(item)) {
      const kind = await classifyUrlInput(item, opts)
      if (hasYtDlpPassthroughArgs(opts) && kind !== 'url_direct_media' && kind !== 'url_streaming' && kind !== 'url_x_space') {
        throwUnsupportedDownloadPassthroughInput(item)
      }
      if (kind === 'url_x_space') {
        const downloadTarget = await resolveXSpaceDownloadTarget(item)
        return await processDownloadMedia(downloadTarget, baseDir, opts, batchItem, batchChildContext)
      }
      if (kind === 'url_direct_document') {
        const downloaded = await downloadDocumentUrlToTempFile(item)
        try {
          return await processDownloadDocument(downloaded.filePath, baseDir, opts, { url: item }, batchChildContext)
        } finally {
          await downloaded.cleanup()
        }
      }
      if (kind === 'url_html_article') {
        const prepared = await prepareArticleDocument(item, baseDir, opts, batchChildContext)
        return await processDownloadPreparedDocument(prepared)
      }
      return await processDownloadMedia(item, baseDir, opts, batchItem, batchChildContext)
    }

    const exists = await fileExists(item)
    if (!exists) {
      const { extractSpaceIdsFromText } = await import('~/cli/commands/process-steps/step-2-extract/step-2-url/url-services/x-spaces/input')
      if (extractSpaceIdsFromText(item).includes(item.trim())) {
        const downloadTarget = await resolveXSpaceDownloadTarget(item)
        return await processDownloadMedia(downloadTarget, baseDir, opts, batchItem, batchChildContext)
      }
      throw CLIUsageError(`Input does not exist: ${item}. Run: bun autoshow help download`)
    }
    if (hasYtDlpPassthroughArgs(opts)) {
      throwUnsupportedDownloadPassthroughInput(item)
    }

    if (isHtmlDocumentPath(item)) {
      const prepared = await prepareArticleDocument(item, baseDir, opts, batchChildContext)
      return await processDownloadPreparedDocument(prepared)
    }

    const isDocExt = isDocumentByExtension(item)
    const detected = isDocExt ? await detectDocumentFormat(item) : null
    if (isDocExt || detected !== null) {
      return await processDownloadDocument(item, baseDir, opts, undefined, batchChildContext)
    } else {
      return await processDownloadMedia(item, baseDir, opts, batchItem, batchChildContext)
    }
  }

  if (command === 'write' && opts.textInput) {
    if (isLikelyUrl(item)) {
      throw CLIUsageError('write --text-input only accepts local .md or .txt files or directories')
    }

    if (!isTextInputPath(item)) {
      throw CLIUsageError(`write --text-input only accepts .md or .txt files. Got: ${item}`)
    }

    return await runTextWrite(item, baseDir, opts, preflightEstimate, batchChildContext)
  }

  if (isLikelyUrl(item)) {
    const kind = await classifyUrlInput(item, opts)

    if (kind === 'url_x_space') {
      if (isExtractCommand(command)) {
        return await processXSpace(item, baseDir, opts, batchChildContext)
      }
      if (command === 'write') {
        return await runXSpaceWrite(item, baseDir, opts, preflightEstimate, batchChildContext)
      }
      throwUnsupportedProcessInput(command, item, 'x_space')
    }

    if (kind === 'url_direct_document') {
      const downloaded = await downloadDocumentUrlToTempFile(item)
      try {
        if (isExtractCommand(command)) {
          return await processOcrSingle(downloaded.filePath, baseDir, opts, { url: item }, undefined, preflightEstimate, batchChildContext)
        }
        return await runDocumentWrite(downloaded.filePath, baseDir, opts, { url: item }, undefined, preflightEstimate, batchChildContext)
      } finally {
        await downloaded.cleanup()
      }
    }

    if (kind === 'url_html_article') {
      if (isExtractCommand(command)) {
        return {
          outputDir: (await processUrlArticle(item, baseDir, opts, preflightEstimate, batchChildContext)).outputDir
        }
      }
      const extraction = await processUrlArticle(item, baseDir, opts, preflightEstimate, batchChildContext)
      return await runExtractedDocumentWrite({
        target: item,
        opts,
        extraction,
        sourceRef: { url: item },
        ...(preflightEstimate ? { preflightEstimate } : {})
      })
    }

    if (isExtractCommand(command)) {
      return {
        outputDir: await processStt({ url: item }, baseDir, opts, preflightEstimate, {
          ...(runOptions?.sttBatchCoordinator ? { batchCoordinator: runOptions.sttBatchCoordinator } : {}),
          ...(runOptions?.mistralSttPassController ? { mistralPassController: runOptions.mistralSttPassController } : {}),
          ...(batchChildContext ? { batchChildContext } : {})
        })
      }
    }

    const result = await processMediaSingle(item, baseDir, opts, preflightEstimate, batchChildContext)
    return { outputDir: result.outputDir }
  }

  const exists = await fileExists(item)

  if (!exists) {
    const { extractSpaceIdsFromText } = await import('~/cli/commands/process-steps/step-2-extract/step-2-url/url-services/x-spaces/input')
    if (extractSpaceIdsFromText(item).includes(item.trim())) {
      if (isExtractCommand(command)) {
        return await processXSpace(item, baseDir, opts, batchChildContext)
      }
      if (command === 'write') {
        return await runXSpaceWrite(item, baseDir, opts, preflightEstimate, batchChildContext)
      }
    }
    throw CLIUsageError(`Input does not exist: ${item}. Run: bun autoshow help ${displayCommand}`)
  }

  if (isHtmlDocumentPath(item)) {
    if (isExtractCommand(command)) {
      return {
        outputDir: (await processUrlArticle(item, baseDir, opts, preflightEstimate, batchChildContext)).outputDir
      }
    }

    if (command === 'write') {
      const extraction = await processUrlArticle(item, baseDir, opts, preflightEstimate, batchChildContext)
      return await runExtractedDocumentWrite({
        target: item,
        opts,
        extraction,
        sourceRef: { filePath: item },
        ...(preflightEstimate ? { preflightEstimate } : {})
      })
    }
  }

  const family = await classifyInputFamily(item, opts)

  if (isExtractCommand(command) && family === 'document') {
    if (family !== 'document') {
      throwUnsupportedProcessInput(command, item, family)
    }
    return await processOcrSingle(item, baseDir, opts, undefined, undefined, preflightEstimate, batchChildContext)
  }

  if (command === 'write' && family === 'document') {
    return await runDocumentWrite(item, baseDir, opts, undefined, undefined, preflightEstimate, batchChildContext)
  }

  if (isExtractCommand(command)) {
    if (family === 'media') {
      return {
        outputDir: await processStt({ filePath: item }, baseDir, opts, preflightEstimate, {
          ...(runOptions?.sttBatchCoordinator ? { batchCoordinator: runOptions.sttBatchCoordinator } : {}),
          ...(runOptions?.mistralSttPassController ? { mistralPassController: runOptions.mistralSttPassController } : {}),
          ...(batchChildContext ? { batchChildContext } : {})
        })
      }
    }

    throwUnrecognizedExtractInput(item)
  }

  const result = await processMediaSingle(item, baseDir, opts, preflightEstimate, batchChildContext)
  return { outputDir: result.outputDir }
}

export const handleSingleTarget = async (
  resolvedTarget: string,
  command: ProcessCommand,
  opts: RuntimeOptions,
  preflightEstimate?: AggregatedPriceEstimate
): Promise<void> => {
  await processSingleTarget(command, resolvedTarget, '', opts, preflightEstimate)
}
