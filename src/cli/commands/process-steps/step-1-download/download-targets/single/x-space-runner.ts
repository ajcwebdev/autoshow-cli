import { ensureDirectory } from '~/utils/cli-utils'
import { CLIUsageError, hintsForMissingEnv } from '~/utils/error-handler'
import { reserveBatchChildOutputDir } from '~/cli/commands/process-steps/batch-child-output'
import { resolveRunDirectory } from '~/cli/commands/process-steps/run-dir'
import { sanitizeTitleSlug } from '~/cli/commands/process-steps/step-1-download/audio/metadata-utils'
import { createManifest, createManifestItem, PIPELINE_MANIFEST_FILE, writeManifest } from '~/cli/commands/process-steps/pipeline-manifest'
import * as l from '~/utils/app-logger/app-logger'
import { readEnv } from '~/utils/validate/env-utils'
import { writeMetadataTerminalOutput, writeSavedMetadataArtifacts } from './metadata-output'
import { runExtractedDocumentWrite } from './document-write'
import type { AggregatedPriceEstimate, BatchChildRunContext, BatchItemProcessResult, DocumentMetadata, ExtractionResult, MetadataOutputOptions, ParsedSpaceInput, ProcessDocumentOutput, SharedPipelineOptions, SpacesArtifact, WriteRuntimeOptions, XSpaceExtractionArtifacts } from '~/types'

const X_SPACE_URL_BASE = 'https://x.com/i/spaces/'

const getXBearerToken = (purpose: 'download' | 'extraction' | 'metadata'): string => {
  const bearerToken = readEnv('X_BEARER_TOKEN')
  if (!bearerToken) {
    throw CLIUsageError(
      `X_BEARER_TOKEN environment variable is required for X/Twitter Space ${purpose}.`,
      hintsForMissingEnv('X_BEARER_TOKEN')[0]
    )
  }
  return bearerToken
}

const collectXSpacesArtifact = async (
  target: string,
  purpose: 'download' | 'extraction' | 'metadata'
): Promise<{ artifact: SpacesArtifact, parsedInput: ParsedSpaceInput }> => {
  const bearerToken = getXBearerToken(purpose)

  const [
    { parseSpaceInput },
    { XApiClient },
    { collectSpaces }
  ] = await Promise.all([
    import('~/cli/commands/process-steps/step-2-extract/step-2-url/url-services/x-spaces/input'),
    import('~/cli/commands/process-steps/step-2-extract/step-2-url/url-services/x-spaces/x-spaces-client'),
    import('~/cli/commands/process-steps/step-2-extract/step-2-url/url-services/x-spaces/x-spaces-collect')
  ])

  const parsedInput = parseSpaceInput(target)
  const client = new XApiClient({ bearerToken })
  const artifact = await collectSpaces({
    client,
    input: parsedInput
  })

  return { artifact, parsedInput }
}

const canonicalXSpaceUrl = (spaceId: string): string => `${X_SPACE_URL_BASE}${spaceId}`

const getFirstReferencedSpaceId = (artifact: SpacesArtifact): string | undefined => {
  const directSpace = artifact.spaces[0]?.id
  if (directSpace) {
    return directSpace
  }

  for (const post of artifact.posts) {
    const spaceId = post.space_ids[0]
    if (spaceId) {
      return spaceId
    }
  }

  return undefined
}

const getXSpaceLabel = (artifact: SpacesArtifact, parsedInput: ParsedSpaceInput): string => {
  const firstSpace = artifact.spaces[0]
  return firstSpace?.title?.trim()
    || `x-space-${firstSpace?.id ?? parsedInput.ids[0] ?? parsedInput.postIds[0] ?? 'unknown'}`
}

const compactUser = (user: SpacesArtifact['spaces'][number]['creator']): Record<string, unknown> | undefined => {
  if (!user) {
    return undefined
  }

  return {
    id: user.id,
    ...(user.username ? { username: user.username } : {}),
    ...(user.name ? { name: user.name } : {}),
    ...(user.verified !== undefined ? { verified: user.verified } : {}),
    ...(user.verified_type ? { verifiedType: user.verified_type } : {})
  }
}

const compactUsers = (users: SpacesArtifact['spaces'][number]['hosts']): Record<string, unknown>[] =>
  users
    .map(compactUser)
    .filter((user): user is Record<string, unknown> => user !== undefined)

const buildXSpaceMetadataView = (artifact: SpacesArtifact): Record<string, unknown> => {
  const firstSpace = artifact.spaces[0]
  return {
    source: 'x-space',
    generatedAt: artifact.generated_at,
    spaceCount: artifact.totals.spaces,
    inputSpaceCount: artifact.totals.input_ids,
    inputPostCount: artifact.totals.input_posts,
    postCount: artifact.totals.posts,
    userCount: artifact.totals.users,
    errorCount: artifact.totals.errors,
    spaceUrls: artifact.spaces.map((space) => space.url),
    postUrls: artifact.posts.map((post) => post.url),
    ...(firstSpace ? {
      firstSpace: {
        id: firstSpace.id,
        url: firstSpace.url,
        ...(firstSpace.title ? { title: firstSpace.title } : {}),
        ...(firstSpace.state ? { state: firstSpace.state } : {}),
        ...(firstSpace.scheduled_start ? { scheduledStart: firstSpace.scheduled_start } : {}),
        ...(firstSpace.started_at ? { startedAt: firstSpace.started_at } : {}),
        ...(firstSpace.ended_at ? { endedAt: firstSpace.ended_at } : {}),
        ...(firstSpace.participant_count !== undefined ? { participantCount: firstSpace.participant_count } : {}),
        ...(firstSpace.creator ? { creator: compactUser(firstSpace.creator) } : {}),
        ...(firstSpace.hosts.length > 0 ? { hosts: compactUsers(firstSpace.hosts) } : {}),
        ...(firstSpace.speakers.length > 0 ? { speakers: compactUsers(firstSpace.speakers) } : {})
      }
    } : {}),
    ...(artifact.errors.length > 0 ? { errors: artifact.errors } : {})
  }
}

const textByteLength = (value: string): number =>
  new TextEncoder().encode(value).byteLength

const buildXSpaceDocumentMetadata = (
  label: string,
  extractionMarkdown: string
): DocumentMetadata => ({
  title: label,
  slug: sanitizeTitleSlug(label, 180) || 'x-space',
  pageCount: 1,
  format: 'html',
  fileSize: textByteLength(extractionMarkdown)
})

const buildXSpaceExtractionResult = (
  extractionMarkdown: string
): ExtractionResult => {
  const text = extractionMarkdown.trim()
  return {
    text,
    pages: [{
      pageNumber: 1,
      method: 'text',
      text
    }],
    totalPages: 1,
    ocrPages: 0,
    textPages: 1
  }
}

const collectAndWriteXSpaceExtraction = async (
  target: string,
  baseDir: string,
  opts: Pick<SharedPipelineOptions, 'outputRootDir'>,
  batchChildContext?: BatchChildRunContext
): Promise<XSpaceExtractionArtifacts> => {
  const { renderSpacesJson, renderSpacesMarkdown } = await import('~/cli/commands/process-steps/step-2-extract/step-2-url/url-services/x-spaces/report')
  const { artifact, parsedInput } = await collectXSpacesArtifact(target, 'extraction')
  const label = getXSpaceLabel(artifact, parsedInput)

  const effectiveBaseDir = baseDir?.trim().length > 0 ? baseDir : opts.outputRootDir
  const outputDir = await reserveBatchChildOutputDir(batchChildContext, {
    title: label,
    fallbackLabel: label
  }) ?? resolveRunDirectory(effectiveBaseDir, label, 'x-space')
  await ensureDirectory(outputDir)

  const jsonReport = renderSpacesJson(artifact)
  await Bun.write(`${outputDir}/result.json`, jsonReport)

  const extractionMarkdown = renderSpacesMarkdown(artifact)
  await Bun.write(`${outputDir}/extraction.md`, extractionMarkdown)

  const firstSpaceId = getFirstReferencedSpaceId(artifact) ?? parsedInput.ids[0]
  const sourceUrl = firstSpaceId ? canonicalXSpaceUrl(firstSpaceId) : target

  return {
    artifact,
    extractionMarkdown,
    label,
    outputDir,
    parsedInput,
    sourceUrl
  }
}

export const resolveXSpaceDownloadTarget = async (target: string): Promise<string> => {
  const { parseSpaceInput } = await import('~/cli/commands/process-steps/step-2-extract/step-2-url/url-services/x-spaces/input')
  const parsedInput = parseSpaceInput(target)
  const directSpaceId = parsedInput.ids[0]
  if (directSpaceId) {
    return canonicalXSpaceUrl(directSpaceId)
  }

  if (parsedInput.postIds.length === 0) {
    throw CLIUsageError('Expected an X Space URL, raw Space ID, or X post URL')
  }

  const { artifact } = await collectXSpacesArtifact(target, 'download')
  const resolvedSpaceId = getFirstReferencedSpaceId(artifact)
  if (!resolvedSpaceId) {
    const detail = artifact.errors[0]?.detail
    throw CLIUsageError(
      `No X Space audio target could be resolved from post input.${detail ? ` ${detail}` : ''}`
    )
  }

  return canonicalXSpaceUrl(resolvedSpaceId)
}

export const processMetadataXSpace = async (
  target: string,
  baseDir: string,
  opts: Pick<SharedPipelineOptions, 'outputRootDir'> & MetadataOutputOptions,
  batchChildContext?: BatchChildRunContext
): Promise<BatchItemProcessResult> => {
  const { artifact, parsedInput } = await collectXSpacesArtifact(target, 'metadata')
  const metadata = buildXSpaceMetadataView(artifact)

  writeMetadataTerminalOutput(metadata, opts.markdown)

  const label = getXSpaceLabel(artifact, parsedInput)
  const effectiveBaseDir = baseDir?.trim().length > 0 ? baseDir : opts.outputRootDir
  const outputDir = await reserveBatchChildOutputDir(batchChildContext, {
    title: label,
    fallbackLabel: label
  }) ?? resolveRunDirectory(effectiveBaseDir, label, 'x-space')
  await ensureDirectory(outputDir)

  await writeSavedMetadataArtifacts(outputDir, metadata, opts.markdown, opts.save)
  return { outputDir }
}

export const processXSpace = async (
  target: string,
  baseDir: string,
  opts: Pick<SharedPipelineOptions, 'outputRootDir'>,
  batchChildContext?: BatchChildRunContext
): Promise<BatchItemProcessResult> => {
  const extraction = await collectAndWriteXSpaceExtraction(target, baseDir, opts, batchChildContext)

  await writeManifest(extraction.outputDir, createManifest('extract', 'single', [
    createManifestItem(extraction.outputDir, {
      extractRoute: 'x-space',
      status: extraction.artifact.totals.errors > 0 ? 'incomplete' : 'full',
      metadata: {
        step1: {
          title: extraction.label,
          source: 'x-space',
          spaceCount: extraction.artifact.totals.spaces,
          errorCount: extraction.artifact.totals.errors
        }
      }
    })
  ]))

  l.report.complete(extraction.outputDir, {
    result: 'result.json',
    extraction: 'extraction.md',
    manifest: PIPELINE_MANIFEST_FILE
  })

  return { outputDir: extraction.outputDir }
}

export const runXSpaceWrite = async (
  target: string,
  baseDir: string,
  opts: WriteRuntimeOptions,
  preflightEstimate?: AggregatedPriceEstimate,
  batchChildContext?: BatchChildRunContext
): Promise<BatchItemProcessResult> => {
  const extraction = await collectAndWriteXSpaceExtraction(target, baseDir, opts, batchChildContext)
  const step1Metadata = buildXSpaceDocumentMetadata(extraction.label, extraction.extractionMarkdown)
  const processOutput: ProcessDocumentOutput = {
    result: buildXSpaceExtractionResult(extraction.extractionMarkdown),
    step1Metadata,
    step2Metadata: [],
    outputDir: extraction.outputDir
  }

  return await runExtractedDocumentWrite({
    target,
    opts,
    extraction: processOutput,
    sourceRef: { url: extraction.sourceUrl },
    ...(preflightEstimate ? { preflightEstimate } : {}),
    extraArtifactFiles: {
      result: 'result.json',
      extraction: 'extraction.md'
    }
  })
}
