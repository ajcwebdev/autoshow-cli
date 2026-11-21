import { constants } from 'node:fs'
import { copyFile, mkdir, rename, rm } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import type { ComicBaseImageRequestInput, ComicBaseImageRequestResult, ComicPanelImageEvidence } from '~/types'
import { ValidationError } from '~/utils/error-handler'
import { toProjectRelativePath } from '~/utils/project-root'
import { recordBaseImageAccounting } from '../../comic-image-services/image-costs'
import { resolveComicImageProvider, runComicHostedRequest } from '../../comic-utils/hosted-concurrency'
import { verifyStrictPngIntegrity } from '../../comic-utils/png-integrity'

const SUPERSEDED_DIRECTORY = 'superseded'

/** Keep the prior output in place until the verified replacement is atomically published. */
const preservePriorOutput = async (outputPath: string, attemptId: string): Promise<string> => {
  const directory = join(dirname(outputPath), SUPERSEDED_DIRECTORY)
  await mkdir(directory, { recursive: true })
  const preservedPath = join(directory, `${basename(outputPath, extname(outputPath))}-${attemptId}${extname(outputPath)}`)
  await copyFile(outputPath, preservedPath, constants.COPYFILE_EXCL)
  return preservedPath
}

/** Best effort: returns false instead of masking the original write failure. */
const retainRawResponse = async (rejectedPath: string, imageBase64: string): Promise<boolean> => {
  try {
    await Bun.write(rejectedPath, Buffer.from(imageBase64, 'base64'))
    return true
  } catch {
    return false
  }
}

/** Decoded integrity only; callers decide what a checksum that differs from a record means. */
export const verifyReusableComicImage = async (path: string, label: string): Promise<ComicPanelImageEvidence> => {
  try {
    return verifyStrictPngIntegrity(await Bun.file(path).bytes())
  } catch (error) {
    throw ValidationError(`Cannot reuse ${label} at ${toProjectRelativePath(path)}. Restore a valid PNG before retrying. ${error instanceof Error ? error.message : String(error)}`, { stage: 'comic:generate-images', cause: error })
  }
}

/**
 * One ordinary image request for a final panel or provider-generated page.
 * Verify the staged PNG before replacing any completed output. Reused individual panel candidates
 * are checked against their recorded evidence during publication.
 */
export const generateComicBaseImage = async (input: ComicBaseImageRequestInput): Promise<ComicBaseImageRequestResult> => {
  const { outputPath, options, model } = input
  const outputExists = await Bun.file(outputPath).exists()
  if (outputExists && !options.force) {
    if (input.kind === 'page') await verifyReusableComicImage(outputPath, `page ${input.itemNumber}`)
    return { status: 'skipped', outputPath, durationMs: 0 }
  }

  await mkdir(dirname(outputPath), { recursive: true })
  const requestStart = Date.now()
  const imageResponse = await runComicHostedRequest(
    options,
    resolveComicImageProvider(model),
    'comic-image',
    `${input.sceneSlug}:${input.kind}-${input.itemNumber}:${model}`,
    input.nextHostedIndex(),
    async () => await input.requestImage({
      normalizedPrompt: input.prompt,
      referenceImages: input.referenceImages,
      model,
      size: options.size,
      quality: options.quality,
    })
  )
  const durationMs = Date.now() - requestStart
  const { costLabel, purchase } = recordBaseImageAccounting(input.stats, { model, quality: options.quality, size: options.size, durationMs, usage: imageResponse.usage })
  const checkpoint = options.checkpointPurchase?.(purchase)

  const attemptId = crypto.randomUUID()
  const pendingPath = join(dirname(outputPath), `.${basename(outputPath)}.${attemptId}.pending.png`)
  // The suffix keeps rejected bytes out of candidate discovery and completed-image manifest refs.
  const rejectedPath = join(dirname(outputPath), `${basename(outputPath)}.${attemptId}.rejected`)
  try {
    await input.writeImage(pendingPath, imageResponse.result.imageBase64, imageResponse.result.mimeType)
  } catch (error) {
    await rm(pendingPath, { force: true })
    // The image is already billed: keep the provider's decoded bytes so a failed write never discards a paid result.
    const retained = await retainRawResponse(rejectedPath, imageResponse.result.imageBase64)
    const reason = error instanceof Error ? error.message : String(error)
    throw ValidationError(
      retained
        ? `Writing generated ${input.kind} ${input.itemNumber} failed. Paid response bytes saved at ${toProjectRelativePath(rejectedPath)}. ${reason}`
        : `Writing generated ${input.kind} ${input.itemNumber} failed, and its paid response bytes could not be saved. ${reason}`,
      { stage: 'comic:generate-images', cause: error },
    )
  } finally {
    await checkpoint
  }

  const pendingBytes = await Bun.file(pendingPath).bytes()
  let generatedEvidence: ComicPanelImageEvidence
  try {
    generatedEvidence = verifyStrictPngIntegrity(pendingBytes)
  } catch (error) {
    await rename(pendingPath, rejectedPath)
    throw ValidationError(`Generated ${input.kind} ${input.itemNumber} failed PNG verification. Rejected bytes saved at ${toProjectRelativePath(rejectedPath)}. ${error instanceof Error ? error.message : String(error)}`, { stage: 'comic:generate-images', cause: error })
  }
  const preservedPriorPath = await Bun.file(outputPath).exists() ? await preservePriorOutput(outputPath, attemptId) : undefined
  await rename(pendingPath, outputPath)
  return { status: 'generated', outputPath, mode: imageResponse.mode, durationMs, costLabel, generatedEvidence, ...(preservedPriorPath ? { preservedPriorPath } : {}) }
}
