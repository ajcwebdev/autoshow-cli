import { processStt } from '~/cli/commands/process-steps/step-2-extract/step-2-stt/process-stt'
import { processUrlArticle } from '~/cli/commands/process-steps/step-2-extract/step-2-url/process-url'
import { runTextWrite } from '~/cli/commands/process-steps/step-3-write/run-text-write'
import { ValidationError } from '~/utils/error-handler'
import type {
  AggregatedPriceEstimate,
  BatchItem,
  BatchItemProcessResult,
  DownloadSingleTargetAction,
  DownloadSingleTargetIntent,
  ExtractSingleTargetAction,
  ExtractSingleTargetIntent,
  MetadataSingleTargetAction,
  MetadataSingleTargetIntent,
  ProcessCommand,
  SingleTargetClassifiedInput,
  SingleTargetCommandOptions,
  SingleTargetExecutionContext,
  SingleTargetRunOptions,
  WriteSingleTargetAction,
  WriteSingleTargetIntent
} from '~/types'
import { processDownloadMedia, processMediaSingle, processMetadataMedia } from './media-runner'
import {
  prepareArticleDocument,
  processDownloadDocument,
  processDownloadPreparedDocument,
  processMetadataDocument,
  processMetadataPreparedDocument,
  processOcrSingle
} from './document-runner'
import { runDocumentWrite, runExtractedDocumentWrite } from './document-write'
import {
  processMetadataXSpace,
  processXSpace,
  resolveXSpaceDownloadTarget,
  runXSpaceWrite
} from './x-space-runner'
import {
  classifySingleTargetInput,
  normalizeSingleTargetIntent,
  resolveSingleTargetRoute
} from './single-target-routing'
import { withTemporaryDirectDocument } from './temporary-direct-document'

const sourceRefForInput = (
  input: SingleTargetClassifiedInput,
  item: string
): { url: string } | { filePath: string } => {
  if (input.kind === 'url') {
    return { url: item }
  }
  if (input.kind === 'local') {
    return { filePath: item }
  }
  throw ValidationError(`Single-target route requires a URL or local source: ${item}`)
}

const processSttRoute = async (
  intent: ExtractSingleTargetIntent,
  context: SingleTargetExecutionContext
): Promise<BatchItemProcessResult> => ({
  outputDir: await processStt(
    sourceRefForInput(context.input, context.item),
    context.baseDir,
    intent.opts,
    context.preflightEstimate,
    {
      ...(context.runOptions?.sttBatchCoordinator
        ? { batchCoordinator: context.runOptions.sttBatchCoordinator }
        : {}),
      ...(context.runOptions?.mistralSttPassController
        ? { mistralPassController: context.runOptions.mistralSttPassController }
        : {}),
      ...(context.runOptions?.batchChildContext
        ? { batchChildContext: context.runOptions.batchChildContext }
        : {})
    }
  )
})

const handleMetadataRoute = async (
  intent: MetadataSingleTargetIntent,
  action: MetadataSingleTargetAction,
  context: SingleTargetExecutionContext
): Promise<BatchItemProcessResult> => {
  const batchChildContext = context.runOptions?.batchChildContext
  switch (action) {
    case 'x-space':
      return await processMetadataXSpace(context.item, context.baseDir, intent.opts, batchChildContext)
    case 'temporary-document':
      return await withTemporaryDirectDocument(
        context.item,
        async (filePath) =>
          await processMetadataDocument(
            filePath,
            intent.opts,
            context.baseDir,
            intent.opts.password,
            { url: context.item },
            batchChildContext
          )
      )
    case 'article':
      return await processMetadataPreparedDocument(
        await prepareArticleDocument(context.item, context.baseDir, intent.opts, batchChildContext),
        intent.opts
      )
    case 'document':
      return await processMetadataDocument(
        context.item,
        intent.opts,
        context.baseDir,
        intent.opts.password,
        undefined,
        batchChildContext
      )
    case 'media':
      return await processMetadataMedia(
        context.item,
        intent.opts,
        context.baseDir,
        context.batchItem,
        batchChildContext
      )
  }
}

const handleDownloadRoute = async (
  intent: DownloadSingleTargetIntent,
  action: DownloadSingleTargetAction,
  context: SingleTargetExecutionContext
): Promise<BatchItemProcessResult> => {
  const batchChildContext = context.runOptions?.batchChildContext
  switch (action) {
    case 'x-space':
      return await processDownloadMedia(
        await resolveXSpaceDownloadTarget(context.item),
        context.baseDir,
        intent.opts,
        context.batchItem,
        batchChildContext
      )
    case 'temporary-document':
      return await withTemporaryDirectDocument(
        context.item,
        async (filePath) =>
          await processDownloadDocument(
            filePath,
            context.baseDir,
            intent.opts,
            { url: context.item },
            batchChildContext
          )
      )
    case 'article':
      return await processDownloadPreparedDocument(
        await prepareArticleDocument(context.item, context.baseDir, intent.opts, batchChildContext)
      )
    case 'document':
      return await processDownloadDocument(
        context.item,
        context.baseDir,
        intent.opts,
        undefined,
        batchChildContext
      )
    case 'media':
      return await processDownloadMedia(
        context.item,
        context.baseDir,
        intent.opts,
        context.batchItem,
        batchChildContext
      )
  }
}

const handleExtractRoute = async (
  intent: ExtractSingleTargetIntent,
  action: ExtractSingleTargetAction,
  context: SingleTargetExecutionContext
): Promise<BatchItemProcessResult> => {
  const batchChildContext = context.runOptions?.batchChildContext
  switch (action) {
    case 'x-space':
      return await processXSpace(context.item, context.baseDir, intent.opts, batchChildContext)
    case 'temporary-document':
      return await withTemporaryDirectDocument(
        context.item,
        async (filePath) =>
          await processOcrSingle(
            filePath,
            context.baseDir,
            intent.opts,
            { url: context.item },
            undefined,
            context.preflightEstimate,
            batchChildContext
          )
      )
    case 'article':
      return {
        outputDir: (
          await processUrlArticle(
            context.item,
            context.baseDir,
            intent.opts,
            context.preflightEstimate,
            batchChildContext
          )
        ).outputDir
      }
    case 'document':
      return await processOcrSingle(
        context.item,
        context.baseDir,
        intent.opts,
        undefined,
        undefined,
        context.preflightEstimate,
        batchChildContext
      )
    case 'media':
      return await processSttRoute(intent, context)
  }
}

const handleWriteRoute = async (
  intent: WriteSingleTargetIntent,
  action: WriteSingleTargetAction,
  context: SingleTargetExecutionContext
): Promise<BatchItemProcessResult | void> => {
  const batchChildContext = context.runOptions?.batchChildContext
  switch (action) {
    case 'text':
      return await runTextWrite(
        context.item,
        context.baseDir,
        intent.opts,
        context.preflightEstimate,
        batchChildContext
      )
    case 'x-space':
      return await runXSpaceWrite(
        context.item,
        context.baseDir,
        intent.opts,
        context.preflightEstimate,
        batchChildContext
      )
    case 'temporary-document':
      return await withTemporaryDirectDocument(
        context.item,
        async (filePath) =>
          await runDocumentWrite(
            filePath,
            context.baseDir,
            intent.opts,
            { url: context.item },
            undefined,
            context.preflightEstimate,
            batchChildContext
          )
      )
    case 'article': {
      const extraction = await processUrlArticle(
        context.item,
        context.baseDir,
        intent.opts,
        context.preflightEstimate,
        batchChildContext
      )
      return await runExtractedDocumentWrite({
        target: context.item,
        opts: intent.opts,
        extraction,
        sourceRef: sourceRefForInput(context.input, context.item),
        ...(context.preflightEstimate ? { preflightEstimate: context.preflightEstimate } : {})
      })
    }
    case 'document':
      return await runDocumentWrite(
        context.item,
        context.baseDir,
        intent.opts,
        undefined,
        undefined,
        context.preflightEstimate,
        batchChildContext
      )
    case 'media': {
      const result = await processMediaSingle(
        context.item,
        context.baseDir,
        intent.opts,
        context.preflightEstimate,
        batchChildContext
      )
      return { outputDir: result.outputDir }
    }
  }
}

export const processSingleTarget = async (
  command: ProcessCommand,
  item: string,
  baseDir: string,
  opts: SingleTargetCommandOptions,
  preflightEstimate?: AggregatedPriceEstimate,
  runOptions?: SingleTargetRunOptions,
  batchItem?: BatchItem
): Promise<BatchItemProcessResult | void> => {
  const effectiveBaseDir = baseDir && baseDir.trim().length > 0 ? baseDir : opts.outputRootDir
  const intent = normalizeSingleTargetIntent(command, opts)
  const input = await classifySingleTargetInput(item, intent)
  const context: SingleTargetExecutionContext = {
    item,
    baseDir: effectiveBaseDir,
    input,
    ...(preflightEstimate ? { preflightEstimate } : {}),
    ...(runOptions ? { runOptions } : {}),
    ...(batchItem ? { batchItem } : {})
  }

  switch (intent.command) {
    case 'metadata': {
      const route = resolveSingleTargetRoute(intent, input, item)
      return await handleMetadataRoute(intent, route.action, context)
    }
    case 'download': {
      const route = resolveSingleTargetRoute(intent, input, item)
      return await handleDownloadRoute(intent, route.action, context)
    }
    case 'extract': {
      const route = resolveSingleTargetRoute(intent, input, item)
      return await handleExtractRoute(intent, route.action, context)
    }
    case 'write': {
      const route = resolveSingleTargetRoute(intent, input, item)
      return await handleWriteRoute(intent, route.action, context)
    }
  }
}

export const handleSingleTarget = async (
  resolvedTarget: string,
  command: ProcessCommand,
  opts: SingleTargetCommandOptions,
  preflightEstimate?: AggregatedPriceEstimate
): Promise<void> => {
  await processSingleTarget(command, resolvedTarget, '', opts, preflightEstimate)
}
