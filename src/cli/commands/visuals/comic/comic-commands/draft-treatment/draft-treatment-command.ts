import { existsSync } from 'node:fs'
import { mkdir, readdir } from 'node:fs/promises'
import { basename, dirname, join, relative } from 'node:path'
import * as v from 'valibot'
import type { DraftTreatmentCommandOptions, DraftTreatmentResult, TreatmentCatalogMergeReport, TreatmentDraft, TreatmentDraftRequest, TreatmentDraftResponse, TreatmentDraftValidationContext } from '~/types'
import { UsageError, ValidationError } from '~/utils/error-handler'
import { writeFileExact } from '~/utils/bun-file-io'
import { atomicWriteJson } from '~/utils/filesystem'
import { buildCharacterCatalogIndex } from '../../comic-utils/character-catalog-index'
import { createCharacterCatalogService } from '../../comic-utils/character-catalog-service'
import { DEFAULT_LLM_MODEL } from '../../comic-utils/comic-argument-defaults'
import { comicLog, formatCompactCost, formatDuration } from '../../comic-utils/comic-logger'
import { extractLlmJsonPayload } from '../../comic-utils/llm-json-payload'
import { normalizeProjectPath } from '../../comic-utils/project-paths'
import { estimateLlmCostFromRegistry } from '../../comic-utils/structured-script-utils/llm-cost'
import { runComicStructuredLlm } from '../../comic-utils/structured-script-utils/run-structured-llm'
import { mergeTreatmentCharacterCatalog, mergeTreatmentLocationCatalog, readTreatmentCatalogInputs } from './treatment-catalog-merge'
import { TREATMENT_DRAFT_MAX_ATTEMPTS, TREATMENT_SCHEMA_NAME, TREATMENT_STAGE } from './treatment-defaults'
import { appendTreatmentValidationIssues, buildTreatmentDraftPrompt } from './treatment-llm-prompt'
import { buildTreatmentMergeReportMarkdown, copyTreatmentSourceArtifact, createTreatmentRunDirectory, writeTreatmentJsonArtifact, writeTreatmentTextArtifact } from './treatment-run-artifacts'
import { buildTreatmentJsonSchema, canonicalSlugline, countVoiceSwitches, TREATMENT_KEY_PATTERN, TREATMENT_SLUGLINE_PATTERN, TreatmentDraftSchema, validateTreatmentDraft } from './treatment-schemas'
import { renderTreatmentScript, selfCheckRenderedScript } from './treatment-script-renderer'
import { loadTreatmentSource } from './treatment-source-loader'

export const EPISODE_SCRIPTS_ROOT = join('input', 'scripts')

const requestDraftFromProvider = (options: DraftTreatmentCommandOptions) => async (request: TreatmentDraftRequest): Promise<TreatmentDraftResponse> => {
  const { text, metadata } = await runComicStructuredLlm(request.prompt, {
    schemaName: request.schemaName,
    valibotSchema: TreatmentDraftSchema,
    jsonSchema: request.jsonSchema,
  }, request.model, {
    hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator,
    workId: `comic-treatment:${request.slug}`,
    unitIndex: request.attempt - 1,
  })
  return {
    text,
    inputTokens: metadata.inputTokenCount,
    outputTokens: metadata.outputTokenCount,
    returnedModel: metadata.providerReturnedModel ?? metadata.llmModel,
  }
}

const listDirectoryNames = async (directory: string): Promise<string[]> => {
  try {
    return (await readdir(directory, { withFileTypes: true })).map(entry => entry.name)
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []
    throw error
  }
}

export const resolveNextEpisodeNumber = async (scriptsRoot: string = EPISODE_SCRIPTS_ROOT): Promise<string> => {
  const numbers = (await listDirectoryNames(scriptsRoot))
    .map(name => name.match(/^(\d{2})-script$/)?.[1])
    .filter((value): value is string => value !== undefined)
    .map(Number)
  const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1
  if (next > 99) throw UsageError('Episode numbering under input/scripts is exhausted; pass --episode explicitly.')
  return String(next).padStart(2, '0')
}

export const resolveTreatmentScriptTarget = async (input: {
  episode: string
  scene: string
  slug: string
  force: boolean
  scriptsRoot?: string | undefined
}): Promise<{ scriptPath: string; shorthand: string }> => {
  const directory = join(input.scriptsRoot ?? EPISODE_SCRIPTS_ROOT, `${input.episode}-script`)
  const filename = `${input.scene}-${input.slug}.md`
  const scriptPath = join(directory, filename)
  if (existsSync(scriptPath) && !input.force) {
    throw UsageError(`Script ${normalizeProjectPath(scriptPath)} already exists. Pass --force to overwrite it, or choose another --slug, --scene, or --episode.`)
  }
  const conflicts = (await listDirectoryNames(directory)).filter(name => name.endsWith('.md') && name.startsWith(`${input.scene}-`) && name !== filename)
  if (conflicts.length > 0) {
    throw UsageError(`Episode ${input.episode} already has scene ${input.scene} script${conflicts.length === 1 ? '' : 's'} ${conflicts.join(', ')}; the ${input.episode}-${input.scene} shorthand would be ambiguous. Pass another --scene or --episode.`)
  }
  return { scriptPath, shorthand: `${input.episode}-${input.scene}` }
}

const flattenSchemaIssues = (issues: [v.BaseIssue<unknown>, ...v.BaseIssue<unknown>[]]): string[] => {
  const flat = v.flatten(issues)
  return [
    ...(flat.root ?? []).map(message => `schema: ${message}`),
    ...Object.entries(flat.nested ?? {}).flatMap(([path, messages]) => (messages ?? []).map(message => `${path}: ${message}`)),
  ]
}

const evaluateTreatmentCandidate = (text: string, context: TreatmentDraftValidationContext): { parsed: unknown; draft?: TreatmentDraft; issues: string[] } => {
  let parsed: unknown
  try {
    parsed = JSON.parse(extractLlmJsonPayload(text, TREATMENT_STAGE))
  } catch (error) {
    return { parsed: text, issues: [`response is not valid JSON: ${error instanceof Error ? error.message : String(error)}`] }
  }
  const result = v.safeParse(TreatmentDraftSchema, parsed)
  if (!result.success) return { parsed, issues: flattenSchemaIssues(result.issues) }
  const issues = validateTreatmentDraft(result.output, context)
  return issues.length > 0 ? { parsed, draft: result.output, issues } : { parsed, draft: result.output, issues: [] }
}

const sluglineForLocation = (location: { key: string; aliases?: string[] | undefined; name: string }): string => {
  const alias = (location.aliases ?? []).map(canonicalSlugline).find(candidate => TREATMENT_SLUGLINE_PATTERN.test(candidate))
  if (alias) return alias
  throw ValidationError(`Existing location "${location.key}" has no slugline alias; add one such as "EXT. ${location.name.toUpperCase()} - DAY" to its aliases or define the location in the treatment draft`, { stage: TREATMENT_STAGE })
}

export const draftTreatmentCommand = async (options: DraftTreatmentCommandOptions): Promise<DraftTreatmentResult> => {
  const startTime = Date.now()
  const model = options.llmModel ?? DEFAULT_LLM_MODEL
  const source = await loadTreatmentSource(options.treatmentPath)
  const slug = options.slug ?? source.defaultSlug
  if (!TREATMENT_KEY_PATTERN.test(slug)) throw UsageError(`Invalid slug "${slug}". Expected lowercase kebab-case; pass --slug explicitly.`)
  const scriptsRoot = options.scriptsRoot ?? EPISODE_SCRIPTS_ROOT
  const episode = options.episode ?? await resolveNextEpisodeNumber(scriptsRoot)
  const target = await resolveTreatmentScriptTarget({ episode, scene: options.scene, slug, force: options.force === true, scriptsRoot })
  const styleSeed = options.styleSeed ?? `${slug}--style-seed.png`
  const catalogs = await readTreatmentCatalogInputs()
  const styleSeedPath = join(catalogs.charactersRoot, styleSeed)
  if (!existsSync(styleSeedPath)) {
    throw UsageError(`Style seed image not found at ${normalizeProjectPath(relative(process.cwd(), styleSeedPath))}; every bootstrapped character needs it as its generationReference.`, {
      hints: [
        'Generate one with bun autoshow image "<style reference prompt>" --provider openai=gpt-image-2.5-sunburst --size 1536x1024 --format png --output-dir output/<run>, then copy generated-image.png to that path.',
        'Or pass --style-seed <filename> naming an existing PNG under the characters root.',
      ],
    })
  }

  const panelRangeLabel = options.panelRange.minimum === options.panelRange.maximum ? String(options.panelRange.minimum) : `${options.panelRange.minimum}-${options.panelRange.maximum}`
  comicLog.header('comic draft-treatment', [
    `treatment=${basename(source.path)}`,
    `slug=${slug}`,
    `panels=${panelRangeLabel}`,
    `voicePacing=${options.voicePacing}`,
    `target=${target.shorthand}`,
    `model=${model}`,
  ])

  const runDirectory = createTreatmentRunDirectory(slug)
  await copyTreatmentSourceArtifact(runDirectory, source.path)
  await writeTreatmentTextArtifact(runDirectory, 'source.txt', `${source.text.trim()}\n`)
  const prompt = buildTreatmentDraftPrompt({
    source,
    panelRange: options.panelRange,
    voicePacing: options.voicePacing,
    speakers: options.speakers,
    existingCharacterKeys: catalogs.characters.characters.map(character => character.key),
    existingLocationKeys: catalogs.locations?.locations.map(location => location.key) ?? [],
  })
  await writeTreatmentTextArtifact(runDirectory, 'prompt.md', `${prompt}\n`)
  const jsonSchema = buildTreatmentJsonSchema()
  const requestDraft = options.requestDraft ?? requestDraftFromProvider(options)
  const validationContext: TreatmentDraftValidationContext = {
    panelRange: options.panelRange,
    voicePacing: options.voicePacing,
    speakers: options.speakers,
    catalogPolicy: options.catalogPolicy,
    existingCharacters: catalogs.characters,
    existingLocations: catalogs.locations,
  }

  let draft: TreatmentDraft | undefined
  let previousIssues: string[] = []
  let attempts = 0
  let inputTokens = 0
  let outputTokens = 0
  let cost = 0
  let requestDurationMs = 0
  let returnedModel: string = model
  for (let attempt = 1; attempt <= TREATMENT_DRAFT_MAX_ATTEMPTS; attempt++) {
    attempts = attempt
    const attemptPrompt = previousIssues.length > 0 ? appendTreatmentValidationIssues(prompt, previousIssues) : prompt
    const requestStart = Date.now()
    const response = await requestDraft({ prompt: attemptPrompt, schemaName: TREATMENT_SCHEMA_NAME, jsonSchema: jsonSchema.schema, model, attempt, slug })
    requestDurationMs += Date.now() - requestStart
    inputTokens += response.inputTokens ?? 0
    outputTokens += response.outputTokens ?? 0
    cost += estimateLlmCostFromRegistry(model, response.inputTokens ?? 0, response.outputTokens ?? 0)
    returnedModel = response.returnedModel ?? model
    await writeTreatmentTextArtifact(runDirectory, `response-attempt-${attempt}.json`, `${response.text.trim()}\n`)
    const evaluation = evaluateTreatmentCandidate(response.text, validationContext)
    if (evaluation.issues.length === 0 && evaluation.draft) {
      draft = evaluation.draft
      break
    }
    if (attempt < TREATMENT_DRAFT_MAX_ATTEMPTS) {
      previousIssues = evaluation.issues
      comicLog.line(`Treatment draft attempt ${attempt} failed validation; retrying once with ${evaluation.issues.length} issue${evaluation.issues.length === 1 ? '' : 's'} appended`)
      continue
    }
    await writeTreatmentJsonArtifact(runDirectory, 'treatment.invalid.json', { schemaVersion: 1, attempt, issues: evaluation.issues, output: evaluation.parsed })
    throw ValidationError(`Treatment draft for ${slug} failed validation after ${attempt} attempt${attempt === 1 ? '' : 's'}:\n- ${evaluation.issues.join('\n- ')}`, { stage: TREATMENT_STAGE })
  }
  if (!draft) throw ValidationError(`Treatment draft for ${slug} produced no candidate`, { stage: TREATMENT_STAGE })
  const panelCount = draft.panels.length
  const voiceSwitches = countVoiceSwitches(draft.panels)

  const scriptDisplayPath = normalizeProjectPath(target.scriptPath)
  const characterMerge = mergeTreatmentCharacterCatalog({
    existing: catalogs.characters,
    candidates: draft.characters,
    styleSeed,
    styleInstructions: draft.styleInstructions,
    policy: options.catalogPolicy,
  })
  const locationMerge = mergeTreatmentLocationCatalog({
    existing: catalogs.locations,
    candidates: draft.locations,
    scriptPath: scriptDisplayPath,
    styleInstructions: draft.styleInstructions,
    styleSeed,
    locationsRoot: catalogs.locationsRoot,
    policy: options.catalogPolicy,
  })
  const characterNames = new Map(characterMerge.next.characters.map(character => [character.key, character.name] as const))
  const draftSluglines = new Map(draft.locations.map(location => [location.key, canonicalSlugline(location.slugline)] as const))
  const locationSluglines = new Map<string, string>()
  for (const locationKey of new Set(draft.panels.map(panel => panel.locationKey))) {
    const location = locationMerge.next.locations.find(entry => entry.key === locationKey)
    if (!location) throw ValidationError(`Panel location "${locationKey}" is missing from the merged location catalog`, { stage: TREATMENT_STAGE })
    locationSluglines.set(locationKey, draftSluglines.get(locationKey) ?? sluglineForLocation(location))
  }

  const rendered = renderTreatmentScript({ draft, episode, sourceDisplayPath: normalizeProjectPath(options.treatmentPath), characterNames, locationSluglines })
  const mergedRaw = `${JSON.stringify(characterMerge.next, null, 2)}\n`
  const index = buildCharacterCatalogIndex(catalogs.charactersRoot, catalogs.characterConfigPath, characterMerge.next, { verifyAssets: false })
  const characterCatalog = createCharacterCatalogService(catalogs.charactersRoot, catalogs.characterConfigPath, mergedRaw, index)
  const structuredScript = selfCheckRenderedScript({
    rendered,
    scriptPath: target.scriptPath,
    characterCatalog,
    locationCatalog: locationMerge.next,
    panelCount,
  })
  await writeTreatmentJsonArtifact(runDirectory, 'treatment.json', draft)
  await writeTreatmentJsonArtifact(runDirectory, 'structured-script.preview.json', structuredScript)

  await atomicWriteJson(catalogs.characterConfigPath, characterMerge.next)
  await atomicWriteJson(catalogs.locationCatalogPath, locationMerge.next)
  await mkdir(dirname(target.scriptPath), { recursive: true })
  await writeFileExact(target.scriptPath, rendered)
  await writeTreatmentTextArtifact(runDirectory, 'script.md', rendered)

  const report: TreatmentCatalogMergeReport = {
    charactersAdded: characterMerge.charactersAdded,
    charactersSkipped: characterMerge.charactersSkipped,
    droppedAliases: characterMerge.droppedAliases,
    locationsAdded: locationMerge.locationsAdded,
    locationsSkipped: locationMerge.locationsSkipped,
    styleImage: locationMerge.styleImage,
  }
  await writeTreatmentJsonArtifact(runDirectory, 'merge-report.json', report)
  await writeTreatmentTextArtifact(runDirectory, 'merge-report.md', buildTreatmentMergeReportMarkdown(report, {
    scriptPath: scriptDisplayPath,
    shorthand: target.shorthand,
    panelCount,
    styleSeedPath: normalizeProjectPath(relative(process.cwd(), styleSeedPath)),
    speakers: options.speakers,
  }))

  comicLog.line('treatment-script generated', [
    `file=${scriptDisplayPath}`,
    `shorthand=${target.shorthand}`,
    `panels=${panelCount}`,
    `voiceSwitches=${voiceSwitches}`,
    `model=${returnedModel}`,
    `attempts=${attempts}`,
    `tokens=${(inputTokens + outputTokens).toLocaleString()}`,
    `cost=${formatCompactCost(cost)}`,
    `api=${formatDuration(requestDurationMs)}`,
  ])
  comicLog.line('catalogs merged', [
    `charactersAdded=${report.charactersAdded.length}`,
    `charactersSkipped=${report.charactersSkipped.length}`,
    `aliasesDropped=${report.droppedAliases.length}`,
    `locationsAdded=${report.locationsAdded.length}`,
    `locationsSkipped=${report.locationsSkipped.length}`,
    `styleImage=${report.styleImage.action}`,
  ])
  comicLog.summary([`attempts=${attempts}`, `duration=${formatDuration(Date.now() - startTime)}`])
  comicLog.outputDirectory(runDirectory)

  return { scriptPath: target.scriptPath, shorthand: target.shorthand, runDirectory, attempts, panelCount, voiceSwitches, report, structuredScript }
}
