import { randomUUID } from 'node:crypto'
import * as v from 'valibot'
import { mkdir, readdir } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import type { ImageGenerationModel, ImageGenerationQuality, ImageGenerationSize, LlmModel, ReferenceSketchCommandOptions } from '~/types'
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
  getLocationsRoot,
  LOCATION_KEY_PATTERN,
  LOCATION_VIEWS,
  normalizeLocationKey,
  readLocationReferenceCatalog,
  readLocationSketchManifest,
  requireCurrentLocationReference,
  resolveRegisteredLocationImagePath,
  type LocationReferenceCatalog,
  type LocationReferenceEntry,
  type LocationSketchManifest,
  type LocationSketchRegistration,
  type LocationSketchViewRegistration,
  type LocationView,
} from '../../comic-utils/location-reference'
import {
  promoteLocationRegistrationTransaction,
  type LocationPromotionTransactionBoundary,
  type LocationPromotionTransactionRecord,
} from './location-reference-transaction'

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

export type LocationReferenceCommandDependencies = {
  aggregateSpecification?: (input: { key: string; scripts: Array<{ path: string; content: string }>; model: string }) => Promise<{ name: string; specification: string }>
  requestImage?: typeof createImage
  writeImage?: typeof writeGeneratedImage
  promoteImage?: (stagedPath: string, targetPath: string) => Promise<void>
  judgeView?: (input: { imagePath: string; view: LocationView; specification: string; existingViewPaths: string[]; styleReference: string; model: string }) => Promise<LocationViewQaResult>
  generationId?: () => string
  injectPromotionFault?: (boundary: LocationPromotionTransactionBoundary, transaction: Readonly<LocationPromotionTransactionRecord>) => void | Promise<void>
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

export type ResolvedLocationReferenceRequest = {
  key: string
  view: LocationView
  model: ImageGenerationModel
  size: ImageGenerationSize
  quality: ImageGenerationQuality
  revise: boolean
  notes?: string
  qaEnabled: boolean
  maxRepairs: number
  aggregationModel: LlmModel
  qaModel: LlmModel
  concurrency: number
  hostedConcurrencyCoordinator?: ReferenceSketchCommandOptions['hostedConcurrencyCoordinator']
}

type ExistingLocationView = LocationSketchViewRegistration & { imagePath: string }

export type LocationReferenceContext = {
  kind: 'ready'
  catalog: LocationReferenceCatalog
  manifest: LocationSketchManifest
  entry: LocationReferenceEntry
  prior?: LocationSketchRegistration
  priorTarget?: LocationSketchViewRegistration
  stylePath: string
  otherExisting: ExistingLocationView[]
  freshReferences: string[]
}

export type LocationReferencePreparation = { kind: 'noop' } | LocationReferenceContext

type LocationViewQaReport = {
  view: LocationView
  attempt: number
  retryMode: 'fresh' | 'edit'
  result?: LocationViewQaResult
  error?: string
}

export type LocationViewGeneration = {
  generationId: string
  attemptsRoot: string
  stagedImagePath: string
}

export const resolveLocationReferenceRequest = (options: ReferenceSketchCommandOptions): ResolvedLocationReferenceRequest => {
  if (!options.location || !LOCATION_KEY_PATTERN.test(options.location)) throw CLIUsageError('--location must be a lowercase kebab-case key')
  const key = options.location
  const view = options.view ?? 'establishing'
  if (!LOCATION_VIEWS.includes(view)) throw CLIUsageError(`--view must be one of: ${LOCATION_VIEWS.join(', ')}`)
  const model = options.imageModels?.[0] ?? DEFAULT_IMAGE_MODEL
  if ((options.imageModels?.length ?? 1) !== 1 || !model) throw CLIUsageError('reference-sketch accepts exactly one --image-model')
  const size: ImageGenerationSize = options.size ?? '1536x1024'
  const quality: ImageGenerationQuality = options.quality ?? 'high'
  validateImageSizeForModels(size, [model])
  return {
    key,
    view,
    model,
    size,
    quality,
    revise: options.revise ?? false,
    ...(options.notes ? { notes: options.notes } : {}),
    qaEnabled: options.qa ?? true,
    maxRepairs: options.maxRepairs ?? 2,
    aggregationModel: options.llmModel ?? DEFAULT_LLM_MODEL,
    qaModel: options.qaModel ?? DEFAULT_QA_MODEL,
    concurrency: options.concurrency ?? DEFAULT_CLI_CONCURRENCY,
    ...(options.hostedConcurrencyCoordinator ? { hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator } : {}),
  }
}

export const loadLocationReferenceContext = async (
  request: ResolvedLocationReferenceRequest,
  dependencies: LocationReferenceCommandDependencies = {},
): Promise<LocationReferencePreparation> => {
  const { key, view } = request
  const catalog = await readLocationReferenceCatalog()
  const manifest = await readLocationSketchManifest()
  const existing = catalog.locations.find(entry => entry.key === key)
  const prior = manifest.sketches.find(item => item.locationKey === key)
  const priorTarget = prior?.views.find(item => item.view === view)
  if (view !== 'establishing' && !prior?.views.some(item => item.view === 'establishing')) throw ValidationError(`Cannot generate ${view} view for "${key}" before its establishing view`, { stage: 'comic:location-reference' })
  if (request.revise && (!existing || !priorTarget)) throw ValidationError(`Cannot revise unregistered ${view} view for location "${key}"`, { stage: 'comic:location-reference' })
  if (!request.revise && existing && priorTarget) {
    const current = await requireCurrentLocationReference(key)
    if (!current.views.some(item => item.view === view)) throw ValidationError(`Registered ${view} view for "${key}" could not be validated`, { stage: 'comic:location-reference' })
    return { kind: 'noop' }
  }

  let entry: LocationReferenceEntry
  if (existing) entry = existing
  else {
    if (view !== 'establishing') throw ValidationError(`The first view for location "${key}" must be establishing`, { stage: 'comic:location-reference' })
    const scripts = await collectLocationSourceScripts(key)
    if (scripts.length === 0) throw ValidationError(`No script scene location normalizes to "${key}"`, { stage: 'comic:location-reference' })
    const result = await runComicHostedRequest({
      concurrency: request.concurrency,
      hostedConcurrencyCoordinator: request.hostedConcurrencyCoordinator,
    }, findRegistryServiceForModel('llm', request.aggregationModel) ?? 'comic-llm', 'comic-llm', `location-spec:${key}`, 0, async () => await (dependencies.aggregateSpecification ?? aggregateSpecification)({ key, scripts, model: request.aggregationModel }))
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
    ? uniquePaths([request.revise ? priorTarget && resolveRegisteredLocationImagePath(priorTarget.image) : undefined, stylePath])
    : uniquePaths([establishing?.imagePath, ...otherExisting.filter(item => item.view !== 'establishing').map(item => item.imagePath), stylePath])
  validateReferenceImageCount(request.model, freshReferences.length, `Initial location ${view} view`)
  if (request.qaEnabled && request.maxRepairs > 0) validateReferenceImageCount(DEFAULT_IMAGE_MODEL, freshReferences.length + 1, `Location ${view} QA edit`)
  return {
    kind: 'ready',
    catalog,
    manifest,
    entry,
    ...(prior ? { prior } : {}),
    ...(priorTarget ? { priorTarget } : {}),
    stylePath,
    otherExisting,
    freshReferences,
  }
}

const writeLocationQaReports = async (
  attemptsRoot: string,
  key: string,
  generationId: string,
  view: LocationView,
  qaReports: LocationViewQaReport[],
): Promise<void> => {
  await atomicWriteJson(join(attemptsRoot, 'location-qa-report.json'), { schemaVersion: 2, locationKey: key, generationId, view, attempts: qaReports })
  const rows = qaReports.map(report => `| ${report.view} | ${report.attempt} | ${report.retryMode} | ${report.result?.pass ? 'pass' : 'fail'} | ${(report.result?.summary ?? report.error ?? '').replace(/\|/g, '\\|')} |`)
  await Bun.write(join(attemptsRoot, 'location-qa-report.md'), ['# Location Reference QA Report', '', '| View | Attempt | Mode | Result | Summary |', '|:---|---:|:---:|:---:|:---|', ...rows, ''].join('\n'))
}

const locationRetryMode = (attempt: number, lastQa?: LocationViewQaResult): 'fresh' | 'edit' =>
  attempt === 0 || (!!lastQa && (!lastQa.requestedAngleMatch || !lastQa.materiallyDistinctFromExistingViews)) ? 'fresh' : 'edit'

const locationRepairPrompt = (attempt: number, retryMode: 'fresh' | 'edit', lastQa?: LocationViewQaResult): string => {
  if (attempt === 0) return ''
  if (retryMode === 'fresh') return `Generate a fresh composition from the canonical references. Do not edit or imitate the rejected candidate. Failed camera checks: ${lastQa?.failedChecks.join('; ')}. ${lastQa?.editInstructions}`
  return `Edit the first image only. Failed checks: ${lastQa?.failedChecks.join('; ')}. ${lastQa?.editInstructions} Preserve everything already correct.`
}

export const runLocationViewGeneration = async (
  request: ResolvedLocationReferenceRequest,
  context: LocationReferenceContext,
  dependencies: LocationReferenceCommandDependencies = {},
): Promise<LocationViewGeneration> => {
  const { key, view, model, size, quality } = request
  const generationId = dependencies.generationId?.() ?? `${Date.now()}-${randomUUID().slice(0, 8)}`
  const attemptsRoot = join(getLocationsRoot(), '.attempts', key, generationId)
  await mkdir(attemptsRoot, { recursive: true })
  const requestImage = dependencies.requestImage ?? createImage
  const writeImage = dependencies.writeImage ?? writeGeneratedImage
  const judge = dependencies.judgeView ?? judgeView
  const qaReports: LocationViewQaReport[] = []
  let current: string | undefined
  let lastQa: LocationViewQaResult | undefined
  for (let attempt = 0; attempt <= request.maxRepairs; attempt++) {
    const retryMode = locationRetryMode(attempt, lastQa)
    const references = retryMode === 'edit' && current ? uniquePaths([current, ...context.freshReferences]) : context.freshReferences
    const repair = locationRepairPrompt(attempt, retryMode, lastQa)
    const path = join(attemptsRoot, `${view}-attempt-${attempt}.png`)
    const attemptModel = retryMode === 'edit' ? DEFAULT_IMAGE_MODEL : model
    const response = await runComicHostedRequest({
      concurrency: request.concurrency,
      hostedConcurrencyCoordinator: request.hostedConcurrencyCoordinator,
    }, resolveComicImageProvider(attemptModel), 'comic-image', `location:${key}:${view}`, attempt, async () => await requestImage(`${viewPrompt(context.entry, view, request.notes)}\n\n${repair}`, references, attemptModel, size, quality))
    await writeImage(path, response.result.imageBase64, response.result.mimeType)
    current = path
    if (!request.qaEnabled) break
    try {
      lastQa = validateQaResult(await runComicHostedRequest({
        concurrency: request.concurrency,
        hostedConcurrencyCoordinator: request.hostedConcurrencyCoordinator,
      }, 'openai', 'comic-qa', `location-qa:${key}:${view}`, attempt, async () => await judge({ imagePath: path, view, specification: context.entry.specification, existingViewPaths: context.otherExisting.map(item => item.imagePath), styleReference: context.stylePath, model: request.qaModel })))
      await atomicWriteJson(join(attemptsRoot, `${view}-attempt-${attempt}-qa.json`), lastQa)
      qaReports.push({ view, attempt, retryMode, result: lastQa })
      await writeLocationQaReports(attemptsRoot, key, generationId, view, qaReports)
    } catch (error) {
      await atomicWriteJson(join(attemptsRoot, `${view}-attempt-${attempt}-qa-error.json`), { error: error instanceof Error ? error.message : String(error) })
      qaReports.push({ view, attempt, retryMode, error: error instanceof Error ? error.message : String(error) })
      await writeLocationQaReports(attemptsRoot, key, generationId, view, qaReports)
      throw error
    }
    if (lastQa.pass) break
  }
  if (!current || (request.qaEnabled && !lastQa?.pass)) throw ValidationError(`Location ${view} view failed QA after ${request.maxRepairs} repairs; attempts were preserved at ${attemptsRoot}`, { stage: 'comic:location-reference' })
  return { generationId, attemptsRoot, stagedImagePath: current }
}

export const locationReferenceSketchCommand = async (
  options: ReferenceSketchCommandOptions,
  dependencies: LocationReferenceCommandDependencies = {},
): Promise<void> => {
  const validatedRequest = resolveLocationReferenceRequest(options)
  const preparedContext = await loadLocationReferenceContext(validatedRequest, dependencies)
  if (preparedContext.kind === 'noop') return
  const generatedView = await runLocationViewGeneration(validatedRequest, preparedContext, dependencies)
  await promoteLocationRegistrationTransaction({
    key: validatedRequest.key,
    view: validatedRequest.view,
    model: validatedRequest.model,
    entry: preparedContext.entry,
    catalog: preparedContext.catalog,
    manifest: preparedContext.manifest,
    ...(preparedContext.prior ? { prior: preparedContext.prior } : {}),
    ...(preparedContext.priorTarget ? { priorTarget: preparedContext.priorTarget } : {}),
    generationId: generatedView.generationId,
    attemptsRoot: generatedView.attemptsRoot,
    stagedImagePath: generatedView.stagedImagePath,
    ...(dependencies.promoteImage ? { promoteImage: dependencies.promoteImage } : {}),
    ...(dependencies.injectPromotionFault ? { injectFault: dependencies.injectPromotionFault } : {}),
  })
}
