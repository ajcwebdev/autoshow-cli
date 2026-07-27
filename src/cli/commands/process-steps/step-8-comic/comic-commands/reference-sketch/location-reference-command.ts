import { randomUUID } from 'node:crypto'
import * as v from 'valibot'
import { mkdir, readdir, rename, rm } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import type { ImageGenerationQuality, ImageGenerationSize, ReferenceSketchCommandOptions } from '~/types'
import { createImage } from '../../comic-image-services/comic-image-targets'
import { writeGeneratedImage } from '../../comic-image-services/image-writer'
import { checksumFile } from '../process-scenes/character-utils'
import { combineCharacterSketchSheet } from '../character-sketch/character-sketch-sheet'
import { DEFAULT_IMAGE_MODEL, validateImageSizeForModels } from '../../comic-utils/image-size'
import { DEFAULT_LLM_MODEL, DEFAULT_QA_MODEL } from '../../comic-utils/cli-args'
import { validateReferenceImageCount } from '../../comic-utils/reference-capabilities'
import { runComicStructuredLlm } from '../../comic-utils/structured-script-utils/run-structured-llm'
import { getOpenAIClientConfig } from '~/cli/commands/process-steps/step-3-write/write-services/write-openai/openai-utils'
import { createOpenAIResponse, extractOpenAIResponseText } from '~/utils/openai/openai-client'
import { CLIUsageError, InfraError, ValidationError } from '~/utils/error-handler'
import {
  atomicWriteJson, getLocationReferencePath, getLocationsRoot, getLocationSheetPath,
  getLocationSketchManifestPath, LOCATION_KEY_PATTERN, normalizeLocationKey,
  readLocationReferenceCatalog, readLocationSketchManifest, specificationHash,
  requireCurrentLocationReference,
  type LocationReferenceEntry,
} from '../../comic-utils/location-reference'

const VIEWS = ['establishing', 'reverse', 'side'] as const
type LocationView = typeof VIEWS[number]
export type LocationViewQaResult = {
  pass: boolean
  stableFeaturesMatch: boolean
  crossViewGeometryMatch: boolean
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
  judgeView?: (input: { imagePath: string; view: LocationView; specification: string; acceptedEstablishing?: string; styleReference: string; model: string }) => Promise<LocationViewQaResult>
  composeSheet?: (sources: Array<{ view: LocationView; path: string }>, outputPath: string) => Promise<void>
  generationId?: () => string
}

const extractSceneLocation = (content: string): string | undefined => {
  const match = content.match(/^\*\*\s*((?:INT\.?|EXT\.?|INT\.?\/EXT\.?).*?)\s*\*\*\s*$/im)
  return match?.[1]
}

const collectMarkdown = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async entry => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return await collectMarkdown(path)
    return entry.isFile() && entry.name.endsWith('.md') ? [path] : []
  }))
  return nested.flat().sort()
}

export const collectLocationSourceScripts = async (key: string): Promise<Array<{ path: string; content: string }>> => {
  const root = join(dirname(getLocationsRoot()), 'episode-scripts')
  const paths = await collectMarkdown(root)
  const scripts = await Promise.all(paths.map(async path => ({ path, content: await Bun.file(path).text() })))
  return scripts.filter(script => normalizeLocationKey(extractSceneLocation(script.content) ?? '') === key)
}

const aggregateSpecification = async (input: { key: string; scripts: Array<{ path: string; content: string }>; model: string }): Promise<{ name: string; specification: string }> => {
  const prompt = [
    `Synthesize one canonical location specification for ${input.key} from every matching script below.`,
    'Include only stable architecture, spatial geometry, palette, installed equipment, and fixed features. Exclude cast, actions, dialogue, temporary props, damage, weather, time-specific lighting, and episode-specific state. Be exhaustive but concise.',
    ...input.scripts.map(script => `SOURCE ${script.path}\n${script.content}`),
  ].join('\n\n')
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

const judgeView = async (input: { imagePath: string; view: LocationView; specification: string; acceptedEstablishing?: string; styleReference: string; model: string }): Promise<LocationViewQaResult> => {
  const schema = { type: 'object', additionalProperties: false, properties: {
    pass: { type: 'boolean' }, stableFeaturesMatch: { type: 'boolean' }, crossViewGeometryMatch: { type: 'boolean' }, houseStyleMatch: { type: 'boolean' }, noPeople: { type: 'boolean' }, noCopiedStyleContent: { type: 'boolean' }, failedChecks: { type: 'array', items: { type: 'string' } }, editInstructions: { type: 'string' }, summary: { type: 'string' },
  }, required: ['pass', 'stableFeaturesMatch', 'crossViewGeometryMatch', 'houseStyleMatch', 'noPeople', 'noCopiedStyleContent', 'failedChecks', 'editInstructions', 'summary'] } as const
  const paths = [input.imagePath, ...(input.acceptedEstablishing ? [input.acceptedEstablishing] : []), input.styleReference]
  const response = await createOpenAIResponse(getOpenAIClientConfig(), { model: input.model, input: [{ role: 'user', content: [
    { type: 'input_text', text: `Strictly judge this ${input.view} canonical location view. It must match stable features and USS Acampo house style, contain no people, copy no character/text/content from the style reference, and preserve cross-view geometry. Specification:\n${input.specification}` },
    ...(await Promise.all(paths.map(async path => ({ type: 'input_image' as const, image_url: await dataUrl(path), detail: 'high' as const })))),
  ] }], text: { verbosity: 'low', format: { type: 'json_schema', name: 'location_view_qa_v1', schema, strict: true } } })
  const text = extractOpenAIResponseText(response)
  if (!text) throw InfraError('Location QA judge returned no structured result', { stage: 'comic:location-reference' })
  return JSON.parse(text) as LocationViewQaResult
}

const viewPrompt = (entry: LocationReferenceEntry, view: LocationView, revisionNotes?: string): string => [
  `Create an empty ${view} view of the canonical location "${entry.name}".`,
  `Stable specification:\n${entry.specification}`,
  view === 'establishing' ? 'Use the Duco reference strictly for clean-line 2D rendering style. Do not copy its character, pose, panels, labels, text, or content.' : 'Use the accepted establishing view as the geometry authority. Show the same fixed space from this requested angle; do not redesign it.',
  'No people, humanoids, silhouettes, temporary props, action, damage, dialogue, captions, labels, or invented text.',
  revisionNotes ? `Revision notes: ${revisionNotes}` : undefined,
].filter(Boolean).join('\n\n')

const validateQaResult = (value: LocationViewQaResult): LocationViewQaResult => {
  const checks = ['stableFeaturesMatch', 'crossViewGeometryMatch', 'houseStyleMatch', 'noPeople', 'noCopiedStyleContent'] as const
  if (!value || typeof value.pass !== 'boolean' || checks.some(key => typeof value[key] !== 'boolean') || !Array.isArray(value.failedChecks) || !value.failedChecks.every(item => typeof item === 'string') || typeof value.editInstructions !== 'string' || typeof value.summary !== 'string') {
    throw ValidationError('Location QA judge returned invalid structured output', { stage: 'comic:location-reference' })
  }
  const strictPass = checks.every(key => value[key])
  if (value.pass !== strictPass || (!strictPass && !value.editInstructions.trim())) throw ValidationError('Location QA result has inconsistent pass fields or missing actionable editInstructions', { stage: 'comic:location-reference' })
  return value
}

export const locationReferenceSketchCommand = async (options: ReferenceSketchCommandOptions, dependencies: Dependencies = {}): Promise<void> => {
  if (!options.location || !LOCATION_KEY_PATTERN.test(options.location)) throw CLIUsageError('--location must be a lowercase kebab-case key')
  const key = options.location
  const model = options.imageModels?.[0] ?? DEFAULT_IMAGE_MODEL
  if ((options.imageModels?.length ?? 1) !== 1 || !model) throw CLIUsageError('reference-sketch accepts exactly one --image-model')
  const size: ImageGenerationSize = options.size ?? '1536x1024'
  const quality: ImageGenerationQuality = options.quality ?? 'high'
  validateImageSizeForModels(size, [model])
  const catalog = await readLocationReferenceCatalog()
  const manifest = await readLocationSketchManifest()
  const stylePath = catalog.styleImage.startsWith('input/')
    ? resolve(dirname(dirname(getLocationsRoot())), catalog.styleImage)
    : resolve(getLocationsRoot(), catalog.styleImage)
  if (!(await Bun.file(stylePath).exists())) throw InfraError(`Location style image is missing: ${stylePath}`, { stage: 'comic:location-reference' })
  validateReferenceImageCount(model, options.revise ? 2 : 1, 'Initial location establishing view')
  validateReferenceImageCount(model, 2, 'Initial location reverse/side view')
  if ((options.qa ?? true) && (options.maxRepairs ?? 2) > 0) validateReferenceImageCount(DEFAULT_IMAGE_MODEL, 3, 'Location QA edit')
  const existing = catalog.locations.find(entry => entry.key === key)
  const prior = manifest.sketches.find(item => item.locationKey === key)
  if (options.revise && (!existing || !prior)) throw ValidationError(`Cannot revise unregistered location "${key}"`, { stage: 'comic:location-reference' })
  if (!options.revise && existing && prior) { await requireCurrentLocationReference(key); return }

  let entry: LocationReferenceEntry
  if (existing) entry = existing
  else {
    const scripts = await collectLocationSourceScripts(key)
    if (scripts.length === 0) throw ValidationError(`No script scene location normalizes to "${key}"`, { stage: 'comic:location-reference' })
    const aggregate = dependencies.aggregateSpecification ?? aggregateSpecification
    const result = await aggregate({ key, scripts, model: options.llmModel ?? DEFAULT_LLM_MODEL })
    entry = { key, name: result.name, specification: result.specification, sourceScripts: scripts.map(script => relative(dirname(getLocationsRoot()), script.path).replace(/\\/g, '/')) }
  }

  const generationId = dependencies.generationId?.() ?? `${Date.now()}-${randomUUID().slice(0, 8)}`
  const attemptsRoot = join(getLocationsRoot(), '.attempts', key, generationId)
  await mkdir(attemptsRoot, { recursive: true })
  const requestImage = dependencies.requestImage ?? createImage
  const writeImage = dependencies.writeImage ?? writeGeneratedImage
  const judge = dependencies.judgeView ?? judgeView
  const qaEnabled = options.qa ?? true
  const maxRepairs = options.maxRepairs ?? 2
  const accepted = new Map<LocationView, string>()
  const qaReports: Array<{ view: LocationView; attempt: number; result?: LocationViewQaResult; error?: string }> = []
  const writeQaReports = async (): Promise<void> => {
    await atomicWriteJson(join(attemptsRoot, 'location-qa-report.json'), { schemaVersion: 1, locationKey: key, generationId, attempts: qaReports })
    const rows = qaReports.map(report => `| ${report.view} | ${report.attempt} | ${report.result?.pass ? 'pass' : 'fail'} | ${(report.result?.summary ?? report.error ?? '').replace(/\|/g, '\\|')} |`)
    await Bun.write(join(attemptsRoot, 'location-qa-report.md'), ['# Location Reference QA Report', '', '| View | Attempt | Result | Summary |', '|:---|---:|:---:|:---|', ...rows, ''].join('\n'))
  }

  for (const view of VIEWS) {
    let current: string | undefined
    let lastQa: LocationViewQaResult | undefined
    for (let attempt = 0; attempt <= maxRepairs; attempt++) {
      const path = join(attemptsRoot, `${view}-attempt-${attempt}.png`)
      const references = attempt > 0 && current
        ? [current, ...(view === 'establishing' ? [stylePath] : [accepted.get('establishing')!, stylePath])]
        : view === 'establishing'
          ? options.revise ? [getLocationSheetPath(key), stylePath] : [stylePath]
          : [accepted.get('establishing')!, stylePath]
      const repair = attempt > 0 ? `Edit the first image only. Failed checks: ${lastQa?.failedChecks.join('; ')}. ${lastQa?.editInstructions} Preserve everything already correct.` : ''
      const response = await requestImage(`${viewPrompt(entry, view, options.notes)}\n\n${repair}`, references, attempt > 0 ? DEFAULT_IMAGE_MODEL : model, size, quality)
      await writeImage(path, response.result.imageBase64, response.result.mimeType)
      current = path
      if (!qaEnabled) break
      try {
        const establishing = accepted.get('establishing')
        lastQa = validateQaResult(await judge({ imagePath: path, view, specification: entry.specification, ...(view !== 'establishing' && establishing ? { acceptedEstablishing: establishing } : {}), styleReference: stylePath, model: options.qaModel ?? DEFAULT_QA_MODEL }))
        await atomicWriteJson(join(attemptsRoot, `${view}-attempt-${attempt}-qa.json`), lastQa)
        qaReports.push({ view, attempt, result: lastQa })
        await writeQaReports()
      } catch (error) {
        await atomicWriteJson(join(attemptsRoot, `${view}-attempt-${attempt}-qa-error.json`), { error: error instanceof Error ? error.message : String(error) })
        qaReports.push({ view, attempt, error: error instanceof Error ? error.message : String(error) })
        await writeQaReports()
        throw error
      }
      if (lastQa.pass) break
    }
    if (!current || (qaEnabled && !lastQa?.pass)) throw ValidationError(`Location ${view} view failed QA after ${maxRepairs} repairs; attempts were preserved at ${attemptsRoot}`, { stage: 'comic:location-reference' })
    accepted.set(view, current)
  }

  const stagedSheet = join(attemptsRoot, 'reference-sheet.png')
  if (dependencies.composeSheet) await dependencies.composeSheet(VIEWS.map(view => ({ view, path: accepted.get(view)! })), stagedSheet)
  else await combineCharacterSketchSheet({ outputPath: stagedSheet, sources: VIEWS.map(view => ({ view: view as never, path: accepted.get(view)! })) })
  const targetSheet = getLocationSheetPath(key)
  const stagedSha = await checksumFile(stagedSheet)
  const nextCatalog = { ...catalog, locations: [...catalog.locations.filter(item => item.key !== key), entry].sort((a, b) => a.key.localeCompare(b.key)) }
  const registration = { locationKey: key, generationId, specificationSha256: specificationHash(entry.specification), sheet: relative(getLocationsRoot(), targetSheet).replace(/\\/g, '/'), sheetSha256: stagedSha, model, createdAt: new Date().toISOString(), ...(prior ? { priorGenerationId: prior.generationId } : {}) }
  const nextManifest = { schemaVersion: 1 as const, sketches: [...manifest.sketches.filter(item => item.locationKey !== key), registration].sort((a, b) => a.locationKey.localeCompare(b.locationKey)) }
  await mkdir(dirname(targetSheet), { recursive: true })
  const catalogPath = getLocationReferencePath()
  const manifestPath = getLocationSketchManifestPath()
  const transaction = `${generationId}-${randomUUID()}`
  const catalogTemporary = `${catalogPath}.tmp-${transaction}`
  const manifestTemporary = `${manifestPath}.tmp-${transaction}`
  const sheetBackup = `${targetSheet}.backup-${transaction}`
  const catalogBackup = `${catalogPath}.backup-${transaction}`
  const manifestBackup = `${manifestPath}.backup-${transaction}`
  await Bun.write(catalogTemporary, `${JSON.stringify(nextCatalog, null, 2)}\n`)
  await Bun.write(manifestTemporary, `${JSON.stringify(nextManifest, null, 2)}\n`)
  const hadSheet = await Bun.file(targetSheet).exists()
  const hadCatalog = await Bun.file(catalogPath).exists()
  const hadManifest = await Bun.file(manifestPath).exists()
  try {
    if (hadSheet) await rename(targetSheet, sheetBackup)
    if (hadCatalog) await rename(catalogPath, catalogBackup)
    if (hadManifest) await rename(manifestPath, manifestBackup)
    await rename(stagedSheet, targetSheet)
    await rename(catalogTemporary, catalogPath)
    await rename(manifestTemporary, manifestPath)
    await Promise.all([sheetBackup, catalogBackup, manifestBackup].map(path => rm(path, { force: true })))
  } catch (error) {
    await Promise.all([catalogTemporary, manifestTemporary, targetSheet, catalogPath, manifestPath].map(path => rm(path, { force: true }).catch(() => undefined)))
    if (hadSheet) await rename(sheetBackup, targetSheet).catch(() => undefined)
    if (hadCatalog) await rename(catalogBackup, catalogPath).catch(() => undefined)
    if (hadManifest) await rename(manifestBackup, manifestPath).catch(() => undefined)
    throw InfraError(`Atomic location registration failed; the prior registration was restored and attempts remain at ${attemptsRoot}`, { stage: 'comic:location-reference', cause: error instanceof Error ? error : undefined })
  }
}
