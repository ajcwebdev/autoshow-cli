import * as v from 'valibot'
import { mkdir, readdir } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import type { ImageGenerationQuality, ImageGenerationSize, LocationReferenceCommandDependencies, LocationReferenceContext, LocationReferenceEntry, LocationReferencePreparation, LocationSketchViewRegistration, LocationView, LocationViewGeneration, ReferenceSketchCommandOptions, ResolvedLocationReferenceRequest } from '~/types'
import * as appLog from '~/utils/app-logger/app-logger'
import { createImage } from '../../comic-image-services/comic-image-targets'
import { writeGeneratedImage } from '../../comic-image-services/image-writer'
import { checksumFile } from '../process-scenes/character-utils'
import { DEFAULT_IMAGE_MODEL, validateImageSizeForModels } from '../../comic-utils/image-size'
import { DEFAULT_LLM_MODEL } from '../../comic-utils/cli-args'
import { validateReferenceImageCount } from '../../comic-utils/reference-capabilities'
import { verifyStrictPngIntegrity } from '../../comic-utils/png-integrity'
import { runComicStructuredLlm } from '../../comic-utils/structured-script-utils/run-structured-llm'
import { UsageError, InfraError, ValidationError } from '~/utils/error-handler'
import { resolveComicImageProvider, runComicHostedRequest } from '../../comic-utils/hosted-concurrency'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { describeMixedLocationLineage, getLocationsRoot, LOCATION_KEY_PATTERN, LOCATION_VIEWS, normalizeLocationKey, readLocationReferenceCatalog, readLocationSketchManifest, requireCurrentLocationReference, resolveLocationViewLineage, resolveRegisteredLocationImagePath } from '../../comic-utils/location-reference'
import { promoteLocationRegistrationTransaction } from './location-reference-transaction'

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

export const viewPrompt = (entry: LocationReferenceEntry, view: LocationView, revisionNotes?: string): string => [
  `Create one empty ${view} view of the canonical location "${entry.name}".`,
  CAMERA_CONTRACTS[view],
  `Stable specification:\n${entry.specification}`,
  view === 'establishing' ? 'Use the configured style reference strictly for its visual language. Do not copy its character, pose, setting, panels, labels, text, or narrative content.' : 'Use the existing canonical location views as geometry authorities. Show the same fixed space from the requested camera; do not redesign it.',
  'No people, humanoids, silhouettes, temporary props, action, damage, dialogue, captions, labels, or invented text.',
  revisionNotes ? `Revision notes: ${revisionNotes}` : undefined,
].filter(Boolean).join('\n\n')

const uniquePaths = (paths: Array<string | undefined>): string[] => Array.from(new Set(paths.filter((path): path is string => !!path)))

const resolveLocationReferenceRequest = (options: ReferenceSketchCommandOptions): ResolvedLocationReferenceRequest => {
  if (!options.location || !LOCATION_KEY_PATTERN.test(options.location)) throw UsageError('--location must be a lowercase kebab-case key')
  const key = options.location
  const view = options.view ?? 'establishing'
  if (!LOCATION_VIEWS.includes(view)) throw UsageError(`--view must be one of: ${LOCATION_VIEWS.join(', ')}`)
  const model = options.imageModels?.[0] ?? DEFAULT_IMAGE_MODEL
  if ((options.imageModels?.length ?? 1) !== 1 || !model) throw UsageError('reference-sketch accepts exactly one --provider')
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
    aggregationModel: options.llmModel ?? DEFAULT_LLM_MODEL,
    concurrency: options.concurrency ?? DEFAULT_CLI_CONCURRENCY,
    ...(options.hostedConcurrencyCoordinator ? { hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator } : {}),
  }
}

const loadLocationReferenceContext = async (
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
  validateReferenceImageCount(request.model, freshReferences.length, `Location ${view} view`)
  const lineageInputs: LocationSketchViewRegistration[] = view === 'establishing'
    ? (request.revise && priorTarget ? [priorTarget] : [])
    : [...(establishing ? [establishing] : []), ...otherExisting.filter(item => item.view !== 'establishing')]
  const lineage = resolveLocationViewLineage(request.model, lineageInputs)
  const lineageWarning = describeMixedLocationLineage(key, view, establishing)
  if (lineageWarning) appLog.write('warn', lineageWarning, { category: 'command', metadata: { location: key, view, lineage } })
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
    lineage,
  }
}

/*
 * The staged view is always a PNG: `writeGeneratedImage` re-encodes provider JPEG/WebP output to PNG before writing,
 * and the view is registered under a `.png` filename that panel prompts and review read as PNG. So the staged bytes
 * get the same strict PNG verification as panel selection (framing, CRCs, IEND, full inflate); a lenient decoder
 * would accept a PNG missing only its IEND chunk, and non-PNG bytes under a `.png` name are rejected before publication (the staged file is kept).
 */
const validateStagedLocationImage = async (path: string, view: LocationView): Promise<void> => {
  try {
    verifyStrictPngIntegrity(new Uint8Array(await Bun.file(path).arrayBuffer()))
  } catch (error) {
    throw ValidationError(`Generated location ${view} image could not be decoded; the staged output was preserved at ${path}`, { stage: 'comic:location-reference', cause: error instanceof Error ? error : undefined })
  }
}

const runLocationViewGeneration = async (
  request: ResolvedLocationReferenceRequest,
  context: LocationReferenceContext,
  dependencies: LocationReferenceCommandDependencies = {},
): Promise<LocationViewGeneration> => {
  const { key, view, model, size, quality } = request
  const generationId = dependencies.generationId?.() ?? `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
  const attemptsRoot = join(getLocationsRoot(), '.attempts', key, generationId)
  await mkdir(attemptsRoot, { recursive: true })
  const requestImage = dependencies.requestImage ?? createImage
  const writeImage = dependencies.writeImage ?? writeGeneratedImage
  const stagedImagePath = join(attemptsRoot, `${view}.png`)
  const response = await runComicHostedRequest({
    concurrency: request.concurrency,
    hostedConcurrencyCoordinator: request.hostedConcurrencyCoordinator,
  }, resolveComicImageProvider(model), 'comic-image', `location:${key}:${view}`, 0, async () => await requestImage(viewPrompt(context.entry, view, request.notes), context.freshReferences, model, size, quality))
  await writeImage(stagedImagePath, response.result.imageBase64, response.result.mimeType)
  await validateStagedLocationImage(stagedImagePath, view)
  return { generationId, attemptsRoot, stagedImagePath }
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
    lineage: preparedContext.lineage,
    ...(dependencies.promoteImage ? { promoteImage: dependencies.promoteImage } : {}),
    ...(dependencies.injectPromotionFault ? { injectFault: dependencies.injectPromotionFault } : {}),
  })
}
