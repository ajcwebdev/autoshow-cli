import { randomUUID } from 'node:crypto'
import * as v from 'valibot'
import { mkdir, readdir, rename, rm } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import type { ImageGenerationQuality, ImageGenerationSize, ReferenceSketchCommandOptions } from '~/types'
import { createImage } from '../../comic-image-services/comic-image-targets'
import { writeGeneratedImage } from '../../comic-image-services/image-writer'
import { checksumFile } from '../process-scenes/character-utils'
import { DEFAULT_IMAGE_MODEL, validateImageSizeForModels } from '../../comic-utils/image-size'
import { DEFAULT_LLM_MODEL, DEFAULT_QA_MODEL } from '../../comic-utils/cli-args'
import { validateReferenceImageCount } from '../../comic-utils/reference-capabilities'
import { runComicStructuredLlm } from '../../comic-utils/structured-script-utils/run-structured-llm'
import { getOpenAIClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/write-openai/openai-utils'
import { createOpenAIResponse, extractOpenAIResponseText } from '~/utils/openai/openai-client'
import { CLIUsageError, InfraError, ValidationError } from '~/utils/error-handler'
import { resolveComicImageProvider, runComicHostedRequest } from '../../comic-utils/hosted-concurrency'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import {
  atomicWriteJson,
  getLocationReferencePath,
  getLocationsRoot,
  getLocationSketchManifestPath,
  getLocationViewPath,
  LOCATION_KEY_PATTERN,
  LOCATION_VIEWS,
  normalizeLocationKey,
  readLocationReferenceCatalog,
  readLocationSketchManifest,
  requireCurrentLocationReference,
  resolveRegisteredLocationImagePath,
  specificationHash,
  type LocationReferenceEntry,
  type LocationSketchViewRegistration,
  type LocationView,
} from '../../comic-utils/location-reference'

export type LocationViewQaResult = {
  pass: boolean
  stableFeaturesMatch: boolean
  crossViewGeometryMatch: boolean
  requestedAngleMatch: boolean
  materiallyDistinctFromExistingViews: boolean
  houseStyleMatch: boolean
  noPeople: boolean
  noCopiedStyleContent: boolean
  failedChecks: string[]
  editInstructions: string
  summary: string
}

type Dependencies = {
  aggregateSpecification?: (input: { key: string; scripts: Array<{ path: string; content: string }>; model: string }) => Promise<{ name: string; specification: string }>
  requestImage?: typeof createImage
  writeImage?: typeof writeGeneratedImage
  promoteImage?: (stagedPath: string, targetPath: string) => Promise<void>
  judgeView?: (input: { imagePath: string; view: LocationView; specification: string; existingViewPaths: string[]; styleReference: string; model: string }) => Promise<LocationViewQaResult>
  generationId?: () => string
}

const CAMERA_CONTRACTS: Record<LocationView, string> = {
  establishing: 'Use a standing eye-level wide three-quarter establishing camera that clearly explains the location layout, depth, major fixed anchors, and traversable space. Keep the camera at adult standing height; never use aerial, isometric, overhead, bird\'s-eye, or plan views.',
  reverse: 'Use a materially opposite reverse camera looking back across the same space toward the establishing camera position. Reveal the reverse faces of fixed anchors and do not repeat or mirror the establishing composition.',
  side: 'Use a materially perpendicular side camera across the same space. Reveal a lateral relationship that neither the establishing nor reverse view shows; do not repeat, mirror, or slightly pan an existing composition.',
}

const extractSceneLocation = (content: string): string | undefined => content.match(/^\*\*\s*((?:INT\.?|EXT\.?|INT\.?\/EXT\.?).*?)\s*\*\*\s*$/im)?.[1]

const collectMarkdown = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true })
  return (await Promise.all(entries.map(async entry => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return await collectMarkdown(path)
    return entry.isFile() && entry.name.endsWith('.md') ? [path] : []
  }))).flat().sort()
}

export const collectLocationSourceScripts = async (key: string): Promise<Array<{ path: string; content: string }>> => {
  const inputRoot = dirname(getLocationsRoot())
  const paths = await collectMarkdown(join(inputRoot, 'scripts'))
  const scripts = await Promise.all(paths.map(async path => ({ path, content: await Bun.file(path).text() })))
  return scripts.filter(script => normalizeLocationKey(extractSceneLocation(script.content) ?? '') === key)
}

const aggregateSpecification = async (input: { key: string; scripts: Array<{ path: string; content: string }>; model: string }): Promise<{ name: string; specification: string }> => {
  const prompt = [`Synthesize one canonical location specification for ${input.key} from every matching script below.`, 'Include only stable architecture, spatial geometry, palette, installed equipment, and fixed features. Exclude cast, actions, dialogue, temporary props, damage, weather, time-specific lighting, and episode-specific state. Be exhaustive but concise.', ...input.scripts.map(script => `SOURCE ${script.path}\n${script.content}`)].join('\n\n')
  const jsonSchema = { type: 'object', additionalProperties: false, properties: { name: { type: 'string' }, specification: { type: 'string' } }, required: ['name', 'specification'] } as const
  const { text } = await runComicStructuredLlm(prompt, { schemaName: 'canonical_location_spec_v1', valibotSchema: v.strictObject({ name: v.string(), specification: v.string() }), jsonSchema }, input.model)
  const value = JSON.parse(text) as { name?: string; specification?: string }
  if (!value.name?.trim() || !value.specification?.trim()) throw ValidationError('Location specification aggregation returned incomplete data', { stage: 'comic:location-reference' })
  return { name: value.name.trim(), specification: value.specification.trim() }
}

const dataUrl = async (path: string): Promise<string> => {
  const mime = path.endsWith('.png') ? 'image/png' : path.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
  return `data:${mime};base64,${Buffer.from(await Bun.file(path).arrayBuffer()).toString('base64')}`
}

const judgeView = async (input: { imagePath: string; view: LocationView; specification: string; existingViewPaths: string[]; styleReference: string; model: string }): Promise<LocationViewQaResult> => {
  const schema = { type: 'object', additionalProperties: false, properties: {
    pass: { type: 'boolean' }, stableFeaturesMatch: { type: 'boolean' }, crossViewGeometryMatch: { type: 'boolean' }, requestedAngleMatch: { type: 'boolean' }, materiallyDistinctFromExistingViews: { type: 'boolean' }, houseStyleMatch: { type: 'boolean' }, noPeople: { type: 'boolean' }, noCopiedStyleContent: { type: 'boolean' }, failedChecks: { type: 'array', items: { type: 'string' } }, editInstructions: { type: 'string' }, summary: { type: 'string' },
  }, required: ['pass', 'stableFeaturesMatch', 'crossViewGeometryMatch', 'requestedAngleMatch', 'materiallyDistinctFromExistingViews', 'houseStyleMatch', 'noPeople', 'noCopiedStyleContent', 'failedChecks', 'editInstructions', 'summary'] } as const
  const paths = [input.imagePath, ...input.existingViewPaths, input.styleReference]
  const response = await createOpenAIResponse(getOpenAIClientConfig(), { model: input.model, input: [{ role: 'user', content: [
    { type: 'input_text', text: `Strictly judge this requested ${input.view} canonical location view. Camera contract: ${CAMERA_CONTRACTS[input.view]} It must match the stable features and visual language established by the supplied references, contain no people, copy no character/text/content from the style reference, preserve cross-view geometry, comply with the requested angle, and be materially distinct from every existing location view. For an establishing view with no existing location views, materiallyDistinctFromExistingViews must be true. Specification:\n${input.specification}` },
    ...(await Promise.all(paths.map(async path => ({ type: 'input_image' as const, image_url: await dataUrl(path), detail: 'high' as const })))),
  ] }], text: { verbosity: 'low', format: { type: 'json_schema', name: 'location_view_qa_v2', schema, strict: true } } })
  const text = extractOpenAIResponseText(response)
  if (!text) throw InfraError('Location QA judge returned no structured result', { stage: 'comic:location-reference' })
  return JSON.parse(text) as LocationViewQaResult
}

const viewPrompt = (entry: LocationReferenceEntry, view: LocationView, revisionNotes?: string): string => [
  `Create one empty ${view} view of the canonical location "${entry.name}".`,
  CAMERA_CONTRACTS[view],
  `Stable specification:\n${entry.specification}`,
  view === 'establishing' ? 'Use the configured style reference strictly for its visual language. Do not copy its character, pose, setting, panels, labels, text, or narrative content.' : 'Use the existing canonical location views as geometry authorities. Show the same fixed space from the requested camera; do not redesign it.',
  'No people, humanoids, silhouettes, temporary props, action, damage, dialogue, captions, labels, or invented text.',
  revisionNotes ? `Revision notes: ${revisionNotes}` : undefined,
].filter(Boolean).join('\n\n')

const validateQaResult = (value: LocationViewQaResult): LocationViewQaResult => {
  const checks = ['stableFeaturesMatch', 'crossViewGeometryMatch', 'requestedAngleMatch', 'materiallyDistinctFromExistingViews', 'houseStyleMatch', 'noPeople', 'noCopiedStyleContent'] as const
  if (!value || typeof value.pass !== 'boolean' || checks.some(key => typeof value[key] !== 'boolean') || !Array.isArray(value.failedChecks) || !value.failedChecks.every(item => typeof item === 'string') || typeof value.editInstructions !== 'string' || typeof value.summary !== 'string') throw ValidationError('Location QA judge returned invalid structured output', { stage: 'comic:location-reference' })
  const strictPass = checks.every(key => value[key])
  if (value.pass !== strictPass || (!strictPass && !value.editInstructions.trim())) throw ValidationError('Location QA result has inconsistent pass fields or missing actionable editInstructions', { stage: 'comic:location-reference' })
  return value
}

const uniquePaths = (paths: Array<string | undefined>): string[] => Array.from(new Set(paths.filter((path): path is string => !!path)))

export const locationReferenceSketchCommand = async (options: ReferenceSketchCommandOptions, dependencies: Dependencies = {}): Promise<void> => {
  if (!options.location || !LOCATION_KEY_PATTERN.test(options.location)) throw CLIUsageError('--location must be a lowercase kebab-case key')
  const key = options.location
  const view = options.view ?? 'establishing'
  if (!LOCATION_VIEWS.includes(view)) throw CLIUsageError(`--view must be one of: ${LOCATION_VIEWS.join(', ')}`)
  const model = options.imageModels?.[0] ?? DEFAULT_IMAGE_MODEL
  if ((options.imageModels?.length ?? 1) !== 1 || !model) throw CLIUsageError('reference-sketch accepts exactly one --image-model')
  const size: ImageGenerationSize = options.size ?? '1536x1024'
  const quality: ImageGenerationQuality = options.quality ?? 'high'
  validateImageSizeForModels(size, [model])

  const catalog = await readLocationReferenceCatalog()
  const manifest = await readLocationSketchManifest()
  const existing = catalog.locations.find(entry => entry.key === key)
  const prior = manifest.sketches.find(item => item.locationKey === key)
  const priorTarget = prior?.views.find(item => item.view === view)
  if (view !== 'establishing' && !prior?.views.some(item => item.view === 'establishing')) throw ValidationError(`Cannot generate ${view} view for "${key}" before its establishing view`, { stage: 'comic:location-reference' })
  if (options.revise && (!existing || !priorTarget)) throw ValidationError(`Cannot revise unregistered ${view} view for location "${key}"`, { stage: 'comic:location-reference' })
  if (!options.revise && existing && priorTarget) {
    const current = await requireCurrentLocationReference(key)
    if (!current.views.some(item => item.view === view)) throw ValidationError(`Registered ${view} view for "${key}" could not be validated`, { stage: 'comic:location-reference' })
    return
  }

  let entry: LocationReferenceEntry
  if (existing) entry = existing
  else {
    if (view !== 'establishing') throw ValidationError(`The first view for location "${key}" must be establishing`, { stage: 'comic:location-reference' })
    const scripts = await collectLocationSourceScripts(key)
    if (scripts.length === 0) throw ValidationError(`No script scene location normalizes to "${key}"`, { stage: 'comic:location-reference' })
    const aggregationModel = options.llmModel ?? DEFAULT_LLM_MODEL
    const result = await runComicHostedRequest({
      concurrency: options.concurrency ?? DEFAULT_CLI_CONCURRENCY,
      hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator
    }, findRegistryServiceForModel('llm', aggregationModel) ?? 'comic-llm', 'comic-llm', `location-spec:${key}`, 0, async () => await (dependencies.aggregateSpecification ?? aggregateSpecification)({ key, scripts, model: aggregationModel }))
    entry = { key, name: result.name, specification: result.specification, sourceScripts: scripts.map(script => relative(dirname(getLocationsRoot()), script.path).replace(/\\/g, '/')) }
  }

  const stylePath = catalog.styleImage.startsWith('input/') ? resolve(dirname(dirname(getLocationsRoot())), catalog.styleImage) : resolve(getLocationsRoot(), catalog.styleImage)
  if (!(await Bun.file(stylePath).exists())) throw InfraError(`Location style image is missing: ${stylePath}`, { stage: 'comic:location-reference' })
  const existingViews = (prior?.views ?? []).map(item => ({ ...item, imagePath: resolveRegisteredLocationImagePath(item.image) }))
  for (const item of existingViews) {
    if (!(await Bun.file(item.imagePath).exists()) || await checksumFile(item.imagePath) !== item.imageSha256) throw ValidationError(`Registered location ${item.view} image for "${key}" is missing or modified`, { stage: 'comic:location-reference' })
  }
  const establishing = existingViews.find(item => item.view === 'establishing')
  const otherExisting = existingViews.filter(item => item.view !== view)
  const freshReferences = view === 'establishing'
    ? uniquePaths([options.revise ? priorTarget && resolveRegisteredLocationImagePath(priorTarget.image) : undefined, stylePath])
    : uniquePaths([establishing?.imagePath, ...otherExisting.filter(item => item.view !== 'establishing').map(item => item.imagePath), stylePath])
  validateReferenceImageCount(model, freshReferences.length, `Initial location ${view} view`)
  if ((options.qa ?? true) && (options.maxRepairs ?? 2) > 0) validateReferenceImageCount(DEFAULT_IMAGE_MODEL, freshReferences.length + 1, `Location ${view} QA edit`)

  const generationId = dependencies.generationId?.() ?? `${Date.now()}-${randomUUID().slice(0, 8)}`
  const attemptsRoot = join(getLocationsRoot(), '.attempts', key, generationId)
  await mkdir(attemptsRoot, { recursive: true })
  const requestImage = dependencies.requestImage ?? createImage
  const writeImage = dependencies.writeImage ?? writeGeneratedImage
  const judge = dependencies.judgeView ?? judgeView
  const qaEnabled = options.qa ?? true
  const maxRepairs = options.maxRepairs ?? 2
  const qaReports: Array<{ view: LocationView; attempt: number; retryMode: 'fresh' | 'edit'; result?: LocationViewQaResult; error?: string }> = []
  const writeQaReports = async (): Promise<void> => {
    await atomicWriteJson(join(attemptsRoot, 'location-qa-report.json'), { schemaVersion: 2, locationKey: key, generationId, view, attempts: qaReports })
    const rows = qaReports.map(report => `| ${report.view} | ${report.attempt} | ${report.retryMode} | ${report.result?.pass ? 'pass' : 'fail'} | ${(report.result?.summary ?? report.error ?? '').replace(/\|/g, '\\|')} |`)
    await Bun.write(join(attemptsRoot, 'location-qa-report.md'), ['# Location Reference QA Report', '', '| View | Attempt | Mode | Result | Summary |', '|:---|---:|:---:|:---:|:---|', ...rows, ''].join('\n'))
  }

  let current: string | undefined
  let lastQa: LocationViewQaResult | undefined
  for (let attempt = 0; attempt <= maxRepairs; attempt++) {
    const cameraFailure = !!lastQa && (!lastQa.requestedAngleMatch || !lastQa.materiallyDistinctFromExistingViews)
    const retryMode: 'fresh' | 'edit' = attempt === 0 || cameraFailure ? 'fresh' : 'edit'
    const references = retryMode === 'edit' && current ? uniquePaths([current, ...freshReferences]) : freshReferences
    const repair = attempt > 0 ? retryMode === 'fresh'
      ? `Generate a fresh composition from the canonical references. Do not edit or imitate the rejected candidate. Failed camera checks: ${lastQa?.failedChecks.join('; ')}. ${lastQa?.editInstructions}`
      : `Edit the first image only. Failed checks: ${lastQa?.failedChecks.join('; ')}. ${lastQa?.editInstructions} Preserve everything already correct.` : ''
    const path = join(attemptsRoot, `${view}-attempt-${attempt}.png`)
    const attemptModel = retryMode === 'edit' ? DEFAULT_IMAGE_MODEL : model
    const response = await runComicHostedRequest({
      concurrency: options.concurrency ?? DEFAULT_CLI_CONCURRENCY,
      hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator
    }, resolveComicImageProvider(attemptModel), 'comic-image', `location:${key}:${view}`, attempt, async () => await requestImage(`${viewPrompt(entry, view, options.notes)}\n\n${repair}`, references, attemptModel, size, quality))
    await writeImage(path, response.result.imageBase64, response.result.mimeType)
    current = path
    if (!qaEnabled) break
    try {
      lastQa = validateQaResult(await runComicHostedRequest({
        concurrency: options.concurrency ?? DEFAULT_CLI_CONCURRENCY,
        hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator
      }, 'openai', 'comic-qa', `location-qa:${key}:${view}`, attempt, async () => await judge({ imagePath: path, view, specification: entry.specification, existingViewPaths: otherExisting.map(item => item.imagePath), styleReference: stylePath, model: options.qaModel ?? DEFAULT_QA_MODEL })))
      await atomicWriteJson(join(attemptsRoot, `${view}-attempt-${attempt}-qa.json`), lastQa)
      qaReports.push({ view, attempt, retryMode, result: lastQa })
      await writeQaReports()
    } catch (error) {
      await atomicWriteJson(join(attemptsRoot, `${view}-attempt-${attempt}-qa-error.json`), { error: error instanceof Error ? error.message : String(error) })
      qaReports.push({ view, attempt, retryMode, error: error instanceof Error ? error.message : String(error) })
      await writeQaReports()
      throw error
    }
    if (lastQa.pass) break
  }
  if (!current || (qaEnabled && !lastQa?.pass)) throw ValidationError(`Location ${view} view failed QA after ${maxRepairs} repairs; attempts were preserved at ${attemptsRoot}`, { stage: 'comic:location-reference' })

  const targetImage = getLocationViewPath(key, view, entry.referenceDirectory, entry.referenceFilename)
  const imageSha256 = await checksumFile(current)
  const nextView: LocationSketchViewRegistration = { view, generationId, image: relative(getLocationsRoot(), targetImage).replace(/\\/g, '/'), imageSha256, model, createdAt: new Date().toISOString(), ...(priorTarget ? { priorGenerationId: priorTarget.generationId } : {}) }
  const nextViews = [...(prior?.views ?? []).filter(item => item.view !== view), nextView].sort((a, b) => LOCATION_VIEWS.indexOf(a.view) - LOCATION_VIEWS.indexOf(b.view))
  const nextRegistration = { locationKey: key, specificationSha256: specificationHash(entry.specification), views: nextViews }
  const nextCatalog = { ...catalog, locations: [...catalog.locations.filter(item => item.key !== key), entry].sort((a, b) => a.key.localeCompare(b.key)) }
  const nextManifest = { schemaVersion: 2 as const, sketches: [...manifest.sketches.filter(item => item.locationKey !== key), nextRegistration].sort((a, b) => a.locationKey.localeCompare(b.locationKey)) }
  await mkdir(dirname(targetImage), { recursive: true })
  const catalogPath = getLocationReferencePath()
  const manifestPath = getLocationSketchManifestPath()
  const transaction = `${generationId}-${randomUUID()}`
  const catalogTemporary = `${catalogPath}.tmp-${transaction}`
  const manifestTemporary = `${manifestPath}.tmp-${transaction}`
  const priorImage = priorTarget ? resolveRegisteredLocationImagePath(priorTarget.image) : undefined
  const priorBackup = priorImage ? `${priorImage}.backup-${transaction}` : undefined
  const targetBackup = targetImage !== priorImage && await Bun.file(targetImage).exists() ? `${targetImage}.backup-${transaction}` : undefined
  const catalogBackup = `${catalogPath}.backup-${transaction}`
  const manifestBackup = `${manifestPath}.backup-${transaction}`
  await Bun.write(catalogTemporary, `${JSON.stringify(nextCatalog, null, 2)}\n`)
  await Bun.write(manifestTemporary, `${JSON.stringify(nextManifest, null, 2)}\n`)
  const hadCatalog = await Bun.file(catalogPath).exists()
  const hadManifest = await Bun.file(manifestPath).exists()
  const targetExisted = await Bun.file(targetImage).exists()
  let priorImageMoved = false
  let targetImageMoved = false
  let catalogMoved = false
  let manifestMoved = false
  try {
    if (priorImage && await Bun.file(priorImage).exists()) { await rename(priorImage, priorBackup!); priorImageMoved = true }
    if (targetBackup) { await rename(targetImage, targetBackup); targetImageMoved = true }
    if (hadCatalog) { await rename(catalogPath, catalogBackup); catalogMoved = true }
    if (hadManifest) { await rename(manifestPath, manifestBackup); manifestMoved = true }
    await (dependencies.promoteImage ?? rename)(current, targetImage)
    await rename(catalogTemporary, catalogPath)
    await rename(manifestTemporary, manifestPath)
    await Promise.all([priorBackup, targetBackup, catalogBackup, manifestBackup].filter((path): path is string => !!path).map(path => rm(path, { force: true })))
    await rm(attemptsRoot, { recursive: true, force: true })
  } catch (error) {
    await Promise.all([catalogTemporary, manifestTemporary].map(path => rm(path, { force: true }).catch(() => undefined)))
    if (!targetExisted || priorImageMoved || targetImageMoved) await rm(targetImage, { force: true }).catch(() => undefined)
    if (catalogMoved) await rm(catalogPath, { force: true }).catch(() => undefined)
    if (manifestMoved) await rm(manifestPath, { force: true }).catch(() => undefined)
    if (priorImage && priorBackup && priorImageMoved) await rename(priorBackup, priorImage).catch(() => undefined)
    if (targetBackup && targetImageMoved) await rename(targetBackup, targetImage).catch(() => undefined)
    if (catalogMoved) await rename(catalogBackup, catalogPath).catch(() => undefined)
    if (manifestMoved) await rename(manifestBackup, manifestPath).catch(() => undefined)
    throw InfraError(`Atomic location ${view} registration failed; the prior registration was restored and attempts remain at ${attemptsRoot}`, { stage: 'comic:location-reference', cause: error instanceof Error ? error : undefined })
  }
}
