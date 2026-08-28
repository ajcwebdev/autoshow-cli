import { mkdir, rename, rm } from 'node:fs/promises'
import { dirname, relative } from 'node:path'
import { InfraError } from '~/utils/error-handler'
import { checksumFile } from '../process-scenes/character-utils'
import { getLocationReferencePath, getLocationsRoot, getLocationSketchManifestPath, getLocationViewPath, LOCATION_VIEWS, resolveRegisteredLocationImagePath, specificationHash } from '../../comic-utils/location-reference'
import type { LocationPromotionFileRecord, LocationPromotionTransactionBoundary, LocationPromotionTransactionRecord, LocationReferenceCatalog, LocationSketchManifest, LocationSketchRegistration, LocationSketchViewRegistration, PromoteLocationRegistrationInput } from '~/types'

export const LOCATION_PROMOTION_TRANSACTION_BOUNDARIES = [
  'prepared',
  'image-backed-up',
  'image-promoted',
  'catalog-backed-up',
  'catalog-promoted',
  'manifest-backed-up',
  'manifest-promoted',
] as const

const fileRecord = async (path: string, transactionId: string): Promise<LocationPromotionFileRecord> => ({
  path,
  backupPath: `${path}.backup-${transactionId}`,
  existed: await Bun.file(path).exists(),
  backupCreated: false,
  promoted: false,
})

const injectTransactionFault = async (
  input: PromoteLocationRegistrationInput,
  boundary: LocationPromotionTransactionBoundary,
  transaction: LocationPromotionTransactionRecord,
): Promise<void> => {
  await input.injectFault?.(boundary, transaction)
}

const backupFile = async (record: LocationPromotionFileRecord): Promise<void> => {
  if (!record.existed) return
  await rename(record.path, record.backupPath)
  record.backupCreated = true
}

const removeCurrentFile = async (path: string): Promise<void> => {
  await rm(path, { force: true })
}

const restoreFile = async (record: LocationPromotionFileRecord): Promise<void> => {
  if (record.backupCreated) {
    await removeCurrentFile(record.path)
    await rename(record.backupPath, record.path)
    record.backupCreated = false
    return
  }
  if (!record.existed) await removeCurrentFile(record.path)
}

const restoreStagedImage = async (transaction: LocationPromotionTransactionRecord): Promise<void> => {
  const stagedExists = await Bun.file(transaction.stagedImagePath).exists()
  const promotedExists = await Bun.file(transaction.image.path).exists()
  if (!stagedExists && promotedExists) {
    await mkdir(dirname(transaction.stagedImagePath), { recursive: true })
    await rename(transaction.image.path, transaction.stagedImagePath)
  }
}

const rollbackLocationRegistrationTransaction = async (transaction: LocationPromotionTransactionRecord): Promise<string[]> => {
  const failures: string[] = []
  const rollback = async (label: string, operation: () => Promise<void>): Promise<void> => {
    try {
      await operation()
    } catch (error) {
      failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  await rollback('manifest', async () => await restoreFile(transaction.manifest))
  await rollback('catalog', async () => await restoreFile(transaction.catalog))
  await rollback('staged image', async () => await restoreStagedImage(transaction))
  await rollback('target image', async () => await restoreFile(transaction.image))
  if (transaction.priorImage) await rollback('prior image', async () => await restoreFile(transaction.priorImage!))
  await rollback('transaction artifacts', async () => {
    await Promise.all([
      transaction.catalog.temporaryPath,
      transaction.manifest.temporaryPath,
      transaction.image.backupPath,
      transaction.catalog.backupPath,
      transaction.manifest.backupPath,
      transaction.priorImage?.backupPath,
    ].filter((path): path is string => !!path).map(async path => await rm(path, { force: true })))
  })
  return failures
}

const cleanCommittedTransaction = async (transaction: LocationPromotionTransactionRecord): Promise<void> => {
  await Promise.all([
    transaction.image.backupPath,
    transaction.catalog.backupPath,
    transaction.manifest.backupPath,
    transaction.priorImage?.backupPath,
  ].filter((path): path is string => !!path).map(async path => await rm(path, { force: true })))
  await rm(transaction.attemptsRoot, { recursive: true, force: true })
}

const removePreparedFiles = async (paths: string[]): Promise<string[]> => {
  const failures: string[] = []
  for (const path of paths) {
    try {
      await rm(path, { force: true })
    } catch (error) {
      failures.push(`${path}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  return failures
}

const prepareLocationPromotionTransaction = async (
  input: PromoteLocationRegistrationInput,
  nextCatalog: LocationReferenceCatalog,
  nextManifest: LocationSketchManifest,
  targetImage: string,
): Promise<LocationPromotionTransactionRecord> => {
  const id = `${input.generationId}-${crypto.randomUUID()}`
  const catalogPath = getLocationReferencePath()
  const manifestPath = getLocationSketchManifestPath()
  const catalogTemporary = `${catalogPath}.tmp-${id}`
  const manifestTemporary = `${manifestPath}.tmp-${id}`
  const priorImagePath = input.priorTarget ? resolveRegisteredLocationImagePath(input.priorTarget.image) : undefined
  await mkdir(dirname(targetImage), { recursive: true })
  try {
    await Bun.write(catalogTemporary, `${JSON.stringify(nextCatalog, null, 2)}\n`)
    await Bun.write(manifestTemporary, `${JSON.stringify(nextManifest, null, 2)}\n`)
  } catch (error) {
    const cleanupFailures = await removePreparedFiles([catalogTemporary, manifestTemporary])
    const cleanupDetail = cleanupFailures.length > 0 ? `; preparation cleanup was incomplete: ${cleanupFailures.join('; ')}` : ''
    throw InfraError(`Location ${input.view} registration transaction preparation failed${cleanupDetail}`, {
      stage: 'comic:location-reference',
      cause: error instanceof Error ? error : undefined,
    })
  }
  return {
    id,
    stagedImagePath: input.stagedImagePath,
    attemptsRoot: input.attemptsRoot,
    ...(priorImagePath && priorImagePath !== targetImage ? { priorImage: await fileRecord(priorImagePath, id) } : {}),
    image: await fileRecord(targetImage, id),
    catalog: { ...await fileRecord(catalogPath, id), temporaryPath: catalogTemporary },
    manifest: { ...await fileRecord(manifestPath, id), temporaryPath: manifestTemporary },
  }
}

export const promoteLocationRegistrationTransaction = async (input: PromoteLocationRegistrationInput): Promise<void> => {
  const targetImage = getLocationViewPath(input.key, input.view, input.entry.referenceDirectory, input.entry.referenceFilename)
  const nextView: LocationSketchViewRegistration = {
    view: input.view,
    generationId: input.generationId,
    image: relative(getLocationsRoot(), targetImage).replace(/\\/g, '/'),
    imageSha256: await checksumFile(input.stagedImagePath),
    model: input.model,
    createdAt: new Date().toISOString(),
    ...(input.priorTarget ? { priorGenerationId: input.priorTarget.generationId } : {}),
  }
  const nextViews = [...(input.prior?.views ?? []).filter(item => item.view !== input.view), nextView]
    .sort((left, right) => LOCATION_VIEWS.indexOf(left.view) - LOCATION_VIEWS.indexOf(right.view))
  const nextRegistration: LocationSketchRegistration = {
    locationKey: input.key,
    specificationSha256: specificationHash(input.entry.specification),
    views: nextViews,
  }
  const nextCatalog: LocationReferenceCatalog = {
    ...input.catalog,
    locations: [...input.catalog.locations.filter(item => item.key !== input.key), input.entry].sort((left, right) => left.key.localeCompare(right.key)),
  }
  const nextManifest: LocationSketchManifest = {
    schemaVersion: 2,
    sketches: [...input.manifest.sketches.filter(item => item.locationKey !== input.key), nextRegistration].sort((left, right) => left.locationKey.localeCompare(right.locationKey)),
  }
  const transaction = await prepareLocationPromotionTransaction(input, nextCatalog, nextManifest, targetImage)

  try {
    await injectTransactionFault(input, 'prepared', transaction)
    if (transaction.priorImage) await backupFile(transaction.priorImage)
    await backupFile(transaction.image)
    await injectTransactionFault(input, 'image-backed-up', transaction)
    await (input.promoteImage ?? rename)(input.stagedImagePath, transaction.image.path)
    transaction.image.promoted = true
    await injectTransactionFault(input, 'image-promoted', transaction)

    await backupFile(transaction.catalog)
    await injectTransactionFault(input, 'catalog-backed-up', transaction)
    await rename(transaction.catalog.temporaryPath, transaction.catalog.path)
    transaction.catalog.promoted = true
    await injectTransactionFault(input, 'catalog-promoted', transaction)

    await backupFile(transaction.manifest)
    await injectTransactionFault(input, 'manifest-backed-up', transaction)
    await rename(transaction.manifest.temporaryPath, transaction.manifest.path)
    transaction.manifest.promoted = true
    await injectTransactionFault(input, 'manifest-promoted', transaction)
  } catch (error) {
    const rollbackFailures = await rollbackLocationRegistrationTransaction(transaction)
    if (rollbackFailures.length > 0) {
      throw InfraError(`Atomic location ${input.view} registration failed and rollback was incomplete: ${rollbackFailures.join('; ')}`, {
        stage: 'comic:location-reference',
        cause: error instanceof Error ? error : undefined,
      })
    }
    throw InfraError(`Atomic location ${input.view} registration failed; the prior registration was restored and attempts remain at ${input.attemptsRoot}`, {
      stage: 'comic:location-reference',
      cause: error instanceof Error ? error : undefined,
    })
  }

  try {
    await cleanCommittedTransaction(transaction)
  } catch (error) {
    throw InfraError(`Location ${input.view} registration committed but transaction cleanup failed`, {
      stage: 'comic:location-reference',
      cause: error instanceof Error ? error : undefined,
    })
  }
}
