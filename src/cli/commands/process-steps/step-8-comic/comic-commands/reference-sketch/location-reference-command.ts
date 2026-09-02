import * as v from 'valibot'
import { mkdir, readdir } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import type { ImageGenerationQuality, ImageGenerationSize, LocationPlanEntry, LocationReferenceCommandDependencies, LocationReferenceContext, LocationReferenceEntry, LocationReferencePreparation, LocationSketchViewRegistration, LocationView, LocationViewCameraFacts, LocationViewGeneration, LocationViewJudgeInput, LocationViewQaReport, LocationViewQaResult, ReferenceSketchCommandOptions, ResolvedLocationReferenceRequest } from '~/types'
import * as appLog from '~/utils/app-logger/app-logger'
import { createImage } from '../../comic-image-services/comic-image-targets'
import { writeGeneratedImage } from '../../comic-image-services/image-writer'
import { checksumFile } from '../process-scenes/character-utils'
import { DEFAULT_IMAGE_MODEL, validateImageSizeForModels } from '../../comic-utils/image-size'
import { DEFAULT_LLM_MODEL, DEFAULT_QA_MODEL } from '../../comic-utils/cli-args'
import { validateReferenceImageCount } from '../../comic-utils/reference-capabilities'
import { runComicStructuredLlm } from '../../comic-utils/structured-script-utils/run-structured-llm'
import { getOpenAIClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/write-openai/openai-utils'
import { createOpenAIResponse, extractOpenAIResponseText } from '~/utils/openai/openai-client'
import { geminiGenerateContent, geminiUserContent } from '~/utils/gemini/gemini-rest'
import { resolveCredential } from '~/utils/validate/env-utils'
import { UsageError, InfraError, ValidationError } from '~/utils/error-handler'
import { resolveComicImageProvider, runComicHostedRequest } from '../../comic-utils/hosted-concurrency'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { findRegistryServiceForModel } from '~/cli/commands/setup-and-utilities/models/model-loader/registry'
import { describeMixedLocationLineage, getLocationsRoot, LOCATION_KEY_PATTERN, LOCATION_VIEWS, normalizeLocationKey, readLocationReferenceCatalog, readLocationSketchManifest, requireCurrentLocationReference, resolveLocationViewLineage, resolveRegisteredLocationImagePath } from '../../comic-utils/location-reference'
import { findLocationPlan, readLocationPlans } from '../../comic-utils/location-plan-records'
import { cameraHeadingDeg, nearestRegisteredView, normalizeDegrees, projectAnchor, projectPoint, round2 } from '../../comic-utils/blocking-geometry'
import { promoteLocationRegistrationTransaction } from './location-reference-transaction'
import { atomicWriteJson } from '~/utils/filesystem'

const CAMERA_CONTRACTS: Record<LocationView, string> = {
  establishing: 'Use a standing eye-level wide three-quarter establishing camera that clearly explains the location layout, depth, major fixed anchors, and traversable space. Keep the camera at adult standing height; never use aerial, isometric, overhead, bird\'s-eye, or plan views.',
  reverse: 'Use a materially opposite reverse camera looking back across the same space toward the establishing camera position. Reveal the reverse faces of fixed anchors and do not repeat or mirror the establishing composition.',
  side: 'Use a materially perpendicular side camera across the same space. Reveal a lateral relationship that neither the establishing nor reverse view shows; do not repeat, mirror, or slightly pan an existing composition.',
}

const IDEAL_VIEW_HEADINGS: Record<LocationView, readonly number[]> = { establishing: [0], reverse: [180], side: [90, 270] }
const SYNTHETIC_CAMERA_HEIGHT_M = 1.6
const SYNTHETIC_CAMERA_INSET_M = 0.5
const CAMERA_FACTS_LENS = 'wide' as const

const angularDistanceDeg = (a: number, b: number): number => {
  const difference = Math.abs(normalizeDegrees(a) - normalizeDegrees(b))
  return Math.min(difference, 360 - difference)
}

const describeHeading = (view: LocationView): string => view === 'reverse'
  ? 'looking back toward the establishing camera position'
  : view === 'side'
    ? 'looking laterally across the room, perpendicular to the establishing axis'
    : 'looking into the room from the establishing camera position'

const syntheticCameraCell = (plan: LocationPlanEntry, view: LocationView): LocationViewCameraFacts['cameraCell'] => {
  const { width, depth } = plan.roomExtent
  const inset = Math.min(SYNTHETIC_CAMERA_INSET_M, depth / 4, width / 4)
  const position = view === 'side'
    ? { x: round2(width / 2 - inset), y: round2(depth / 2) }
    : { x: 0, y: round2(depth - inset) }
  return { id: `synthetic-${view}`, position, heightM: SYNTHETIC_CAMERA_HEIGHT_M, synthetic: true }
}

export const buildLocationViewCameraFacts = (plan: LocationPlanEntry, view: LocationView): LocationViewCameraFacts | undefined => {
  if (view === 'establishing') return undefined
  const target = { x: 0, y: round2(plan.roomExtent.depth / 2) }
  const candidates = plan.cameraCells
    .map(cell => {
      const heading = cameraHeadingDeg({ position: cell.position, target, lens: CAMERA_FACTS_LENS })
      return { cell: { id: cell.id, position: cell.position, heightM: cell.heightM, synthetic: false }, heading, deviation: Math.min(...IDEAL_VIEW_HEADINGS[view].map(ideal => angularDistanceDeg(heading, ideal))) }
    })
    .filter(candidate => nearestRegisteredView(candidate.heading) === view)
    .sort((left, right) => left.deviation - right.deviation || left.cell.id.localeCompare(right.cell.id))
  const cameraCell = candidates[0]?.cell ?? syntheticCameraCell(plan, view)
  const setup = { position: cameraCell.position, target, lens: CAMERA_FACTS_LENS }
  const establishingSetup = { position: { x: 0, y: 0 }, target, lens: CAMERA_FACTS_LENS }
  const headingDeg = round2(cameraHeadingDeg(setup))
  const anchors = plan.anchors.map(anchor => ({
    key: anchor.key,
    projection: projectAnchor(setup, anchor).projection,
    establishingProjection: projectAnchor(establishingSetup, anchor).projection,
    inFrame: projectPoint(setup, anchor.position).inFrame !== 'out',
  }))
  const inFrame = anchors.filter(anchor => anchor.inFrame)
  const outOfFrame = anchors.filter(anchor => !anchor.inFrame)
  const text = [
    `Reviewed geometry for the ${view} view (frame: origin at the establishing camera's ground point, +x is screen-right in the establishing image, +y is depth away from the establishing camera, meters).`,
    `Camera cell "${cameraCell.id}"${cameraCell.synthetic ? ' (synthesized from the reviewed room extent because no reviewed camera cell faces this way)' : ''} at x=${round2(cameraCell.position.x)} m, y=${round2(cameraCell.position.y)} m, ${round2(cameraCell.heightM)} m above the floor, aimed at the room center (x=${target.x} m, y=${target.y} m) with heading ${headingDeg} degrees, ${describeHeading(view)}.`,
    `From this camera the reviewed anchors must appear as: ${inFrame.length > 0 ? inFrame.map(anchor => anchor.projection).join('; ') : 'none of the reviewed anchors fall inside the frame'}.`,
    `Behind or beside this camera and therefore out of frame: ${outOfFrame.length > 0 ? outOfFrame.map(anchor => anchor.key).join('; ') : 'none'}.`,
    `For contrast, the establishing view shows: ${anchors.map(anchor => anchor.establishingProjection).join('; ')}.`,
    'Keep every anchor on the stated screen side and depth for this camera; never reproduce the establishing screen sides or the establishing camera axis.',
  ].join(' ')
  return { view, cameraCell, target, headingDeg, anchors, text }
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

const imageMimeType = (path: string): string => path.endsWith('.png') ? 'image/png' : path.endsWith('.webp') ? 'image/webp' : 'image/jpeg'

const imageBase64 = async (path: string): Promise<string> => Buffer.from(await Bun.file(path).arrayBuffer()).toString('base64')

const dataUrl = async (path: string): Promise<string> => `data:${imageMimeType(path)};base64,${await imageBase64(path)}`

export const resolveLocationQaProvider = (model: string): 'openai' | 'gemini' => {
  const service = findRegistryServiceForModel('llm', model)
  if (service !== 'openai' && service !== 'gemini') throw UsageError(`Invalid location QA model "${model}". Location QA currently supports OpenAI and Gemini vision-capable LLMs.`)
  return service
}

export const buildLocationViewJudgePrompt = (input: Pick<LocationViewJudgeInput, 'view' | 'specification' | 'cameraFacts'>): string => [
  `Strictly judge this requested ${input.view} canonical location view. Camera contract: ${CAMERA_CONTRACTS[input.view]} It must match the stable features and visual language established by the supplied references, contain no people, copy no character/text/content from the style reference, preserve cross-view geometry, comply with the requested angle, and be materially distinct from every existing location view. For an establishing view with no existing location views, materiallyDistinctFromExistingViews must be true.`,
  input.cameraFacts ? `Reviewed camera geometry for requestedAngleMatch and crossViewGeometryMatch: ${input.cameraFacts} Set requestedAngleMatch=false when the candidate's anchor screen sides or depth order contradict these projections or when it reproduces the establishing camera axis.` : undefined,
  `Specification:\n${input.specification}`,
].filter(Boolean).join(' ')

const judgeView = async (input: LocationViewJudgeInput): Promise<LocationViewQaResult> => {
  const schema = { type: 'object', additionalProperties: false, properties: {
    pass: { type: 'boolean' }, stableFeaturesMatch: { type: 'boolean' }, crossViewGeometryMatch: { type: 'boolean' }, requestedAngleMatch: { type: 'boolean' }, materiallyDistinctFromExistingViews: { type: 'boolean' }, houseStyleMatch: { type: 'boolean' }, noPeople: { type: 'boolean' }, noCopiedStyleContent: { type: 'boolean' }, failedChecks: { type: 'array', items: { type: 'string' } }, editInstructions: { type: 'string' }, summary: { type: 'string' },
  }, required: ['pass', 'stableFeaturesMatch', 'crossViewGeometryMatch', 'requestedAngleMatch', 'materiallyDistinctFromExistingViews', 'houseStyleMatch', 'noPeople', 'noCopiedStyleContent', 'failedChecks', 'editInstructions', 'summary'] } as const
  const paths = [input.imagePath, ...input.existingViewPaths, input.styleReference]
  const prompt = buildLocationViewJudgePrompt(input)
  const provider = resolveLocationQaProvider(input.model)
  const text = provider === 'openai'
    ? extractOpenAIResponseText(await createOpenAIResponse(getOpenAIClientConfig(), { model: input.model, input: [{ role: 'user', content: [
        { type: 'input_text', text: prompt },
        ...(await Promise.all(paths.map(async path => ({ type: 'input_image' as const, image_url: await dataUrl(path), detail: 'high' as const })))),
      ] }], text: { verbosity: 'low', format: { type: 'json_schema', name: 'location_view_qa_v2', schema, strict: true } } }))
    : (await geminiGenerateContent(resolveCredential('gemini', 'require', { stage: 'comic:location-reference', description: 'Location QA' }), {
        model: input.model,
        contents: geminiUserContent([
          { text: prompt },
          ...(await Promise.all(paths.map(async path => ({ inlineData: { mimeType: imageMimeType(path), data: await imageBase64(path) } })))),
        ]),
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema },
      })).text
  if (!text) throw InfraError('Location QA judge returned no structured result', { stage: 'comic:location-reference' })
  return JSON.parse(text) as LocationViewQaResult
}

export const viewPrompt = (entry: LocationReferenceEntry, view: LocationView, revisionNotes?: string, cameraFacts?: string): string => [
  `Create one empty ${view} view of the canonical location "${entry.name}".`,
  CAMERA_CONTRACTS[view],
  cameraFacts,
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

const resolveLocationReferenceRequest = (options: ReferenceSketchCommandOptions): ResolvedLocationReferenceRequest => {
  if (!options.location || !LOCATION_KEY_PATTERN.test(options.location)) throw UsageError('--location must be a lowercase kebab-case key')
  const key = options.location
  const view = options.view ?? 'establishing'
  if (!LOCATION_VIEWS.includes(view)) throw UsageError(`--view must be one of: ${LOCATION_VIEWS.join(', ')}`)
  const model = options.imageModels?.[0] ?? DEFAULT_IMAGE_MODEL
  if ((options.imageModels?.length ?? 1) !== 1 || !model) throw UsageError('reference-sketch accepts exactly one --image-model')
  const size: ImageGenerationSize = options.size ?? '1536x1024'
  const quality: ImageGenerationQuality = options.quality ?? 'high'
  validateImageSizeForModels(size, [model])
  const qaEnabled = options.qa ?? true
  const qaModel = options.qaModel ?? DEFAULT_QA_MODEL
  if (qaEnabled) resolveLocationQaProvider(qaModel)
  return {
    key,
    view,
    model,
    size,
    quality,
    revise: options.revise ?? false,
    ...(options.notes ? { notes: options.notes } : {}),
    qaEnabled,
    maxRepairs: options.maxRepairs ?? 2,
    aggregationModel: options.llmModel ?? DEFAULT_LLM_MODEL,
    qaModel,
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
  validateReferenceImageCount(request.model, freshReferences.length, `Initial location ${view} view`)
  if (request.qaEnabled && request.maxRepairs > 0) validateReferenceImageCount(request.model, freshReferences.length + 1, `Location ${view} QA edit`)
  const lineageInputs: LocationSketchViewRegistration[] = view === 'establishing'
    ? (request.revise && priorTarget ? [priorTarget] : [])
    : [...(establishing ? [establishing] : []), ...otherExisting.filter(item => item.view !== 'establishing')]
  const lineage = resolveLocationViewLineage(request.model, lineageInputs)
  const lineageWarning = describeMixedLocationLineage(key, view, establishing)
  if (lineageWarning) appLog.write('warn', lineageWarning, { category: 'command', metadata: { location: key, view, lineage } })
  const plan = findLocationPlan(await readLocationPlans(), key)
  const cameraFacts = plan ? buildLocationViewCameraFacts(plan, view) : undefined
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
    ...(cameraFacts ? { cameraFacts } : {}),
    lineage,
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
  const judge = dependencies.judgeView ?? judgeView
  const qaReports: LocationViewQaReport[] = []
  let current: string | undefined
  let lastQa: LocationViewQaResult | undefined
  for (let attempt = 0; attempt <= request.maxRepairs; attempt++) {
    const retryMode = locationRetryMode(attempt, lastQa)
    const references = retryMode === 'edit' && current ? uniquePaths([current, ...context.freshReferences]) : context.freshReferences
    const repair = locationRepairPrompt(attempt, retryMode, lastQa)
    const path = join(attemptsRoot, `${view}-attempt-${attempt}.png`)
    const attemptModel = model
    const response = await runComicHostedRequest({
      concurrency: request.concurrency,
      hostedConcurrencyCoordinator: request.hostedConcurrencyCoordinator,
    }, resolveComicImageProvider(attemptModel), 'comic-image', `location:${key}:${view}`, attempt, async () => await requestImage(`${viewPrompt(context.entry, view, request.notes, context.cameraFacts?.text)}\n\n${repair}`, references, attemptModel, size, quality))
    await writeImage(path, response.result.imageBase64, response.result.mimeType)
    current = path
    if (!request.qaEnabled) break
    try {
      lastQa = validateQaResult(await runComicHostedRequest({
        concurrency: request.concurrency,
        hostedConcurrencyCoordinator: request.hostedConcurrencyCoordinator,
      }, resolveLocationQaProvider(request.qaModel), 'comic-qa', `location-qa:${key}:${view}`, attempt, async () => await judge({ imagePath: path, view, specification: context.entry.specification, existingViewPaths: context.otherExisting.map(item => item.imagePath), styleReference: context.stylePath, model: request.qaModel, ...(context.cameraFacts ? { cameraFacts: context.cameraFacts.text } : {}) })))
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
    lineage: preparedContext.lineage,
    ...(dependencies.promoteImage ? { promoteImage: dependencies.promoteImage } : {}),
    ...(dependencies.injectPromotionFault ? { injectFault: dependencies.injectPromotionFault } : {}),
  })
}
