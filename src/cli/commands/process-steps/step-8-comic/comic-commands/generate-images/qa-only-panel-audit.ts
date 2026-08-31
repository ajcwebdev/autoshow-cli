import { mkdir, readdir } from 'node:fs/promises'
import { basename, join, relative } from 'node:path'
import type { ComicPanelSelection, GenerateImagesCommandOptions, PageQaEntry, PageQaRequest, PanelBundleData, ResolvedReferenceImages } from '~/types'
import { InfraError, ValidationError } from '~/utils/error-handler'
import { mapWithConcurrency } from '~/utils/run-with-concurrency'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { getPanelPromptsDirectory, getSceneOutputDirectory } from '../../comic-utils/project-paths'
import { extractPanelBundleData, getPanelNumberFromName, getPromptBundleFilename, resolveReferenceImages, resolveScenePanelDirectories } from '../../comic-utils/panel-prompt-utils'
import { getPanelComicImagePath } from '../../comic-utils/scene-utils'
import { selectComicPanels } from './comic-page-utils'
import { DEFAULT_IMAGE_MODEL } from '../../comic-utils/image-size'
import { judgeComicPage, resolveComicQaProvider, writePageQaReports } from './comic-page-qa'
import { runComicHostedRequest } from '../../comic-utils/hosted-concurrency'
import { createComicRunId } from '../../comic-utils/comic-run-id'

export const QA_ONLY_ESTIMATED_INPUT_TOKENS_PER_PANEL = 5000
export const QA_ONLY_ESTIMATED_OUTPUT_TOKENS_PER_PANEL = 1200

type QaOnlyPanelInput = {
  panelNumber: number
  panelPath: string
  panelSha256: string
  bundleData: PanelBundleData
  references: ResolvedReferenceImages
}

export type QaOnlyPanelAuditResult = {
  reportDirectory: string
  entries: PageQaEntry[]
  inputTokens: number
  outputTokens: number
  costUsd: number
}

type QaOnlyPanelAuditDependencies = {
  judgePage?: (request: PageQaRequest) => Promise<PageQaEntry>
  runId?: string
}

const fileSha256 = async (path: string): Promise<string> => new Bun.CryptoHasher('sha256').update(new Uint8Array(await Bun.file(path).arrayBuffer())).digest('hex')

const selectPanelEntries = async (sceneSlug: string, selection: ComicPanelSelection | undefined) => {
  const panelPromptsDirectory = getPanelPromptsDirectory(sceneSlug)
  const entries = resolveScenePanelDirectories(await readdir(panelPromptsDirectory, { withFileTypes: true }), panelPromptsDirectory)
  if (selection === undefined) return entries
  return selectComicPanels(entries.map(entry => ({ panelNumber: getPanelNumberFromName(entry.name)!, entry })), selection, undefined, sceneSlug).map(item => item.entry)
}

export const loadQaOnlyPanelInputs = async (sceneSlug: string, selection: ComicPanelSelection | undefined): Promise<QaOnlyPanelInput[]> => {
  const panelPromptsDirectory = getPanelPromptsDirectory(sceneSlug)
  const selected = await selectPanelEntries(sceneSlug, selection)
  const inputs: QaOnlyPanelInput[] = []
  const failures: string[] = []
  for (const entry of selected) {
    const panelNumber = getPanelNumberFromName(entry.name)
    if (!panelNumber) {
      failures.push(`Invalid panel directory ${entry.name}`)
      continue
    }
    try {
      const panelDirectory = join(panelPromptsDirectory, entry.name)
      const panelEntries = await readdir(panelDirectory, { withFileTypes: true })
      const promptFilename = getPromptBundleFilename(panelDirectory, panelEntries)
      const bundleData = extractPanelBundleData(await Bun.file(join(panelDirectory, promptFilename)).text())
      const references = resolveReferenceImages(panelDirectory, panelEntries, bundleData, DEFAULT_IMAGE_MODEL)
      const panelPath = getPanelComicImagePath(sceneSlug, panelNumber)
      const requiredPaths = [panelPath, ...references.all]
      const missing = (await Promise.all(requiredPaths.map(async path => await Bun.file(path).exists() ? undefined : path))).filter((path): path is string => !!path)
      if (missing.length > 0) throw ValidationError(`Missing required QA input(s): ${missing.join(', ')}`, { stage: 'comic:qa-only' })
      inputs.push({ panelNumber, panelPath, panelSha256: await fileSha256(panelPath), bundleData, references })
    } catch (error) {
      failures.push(`${entry.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  if (failures.length > 0) throw ValidationError(`QA-only preflight failed before any provider calls:\n- ${failures.join('\n- ')}`, { stage: 'comic:qa-only' })
  return inputs
}

export const runQaOnlyPanelAudit = async (options: GenerateImagesCommandOptions, dependencies: QaOnlyPanelAuditDependencies = {}): Promise<QaOnlyPanelAuditResult> => {
  const inputs = await loadQaOnlyPanelInputs(options.sceneSlug, options.panels)
  const judgeModel = options.qaModel!
  const provider = resolveComicQaProvider(judgeModel)
  const reportDirectory = join(getSceneOutputDirectory(options.sceneSlug), 'qa', `panel-audit-${dependencies.runId ?? createComicRunId()}`)
  await mkdir(reportDirectory, { recursive: true })
  const judge = dependencies.judgePage ?? judgeComicPage
  const results = await mapWithConcurrency(options.concurrency ?? DEFAULT_CLI_CONCURRENCY, inputs, async (input, index) => {
    try {
      const entry = await runComicHostedRequest({
        concurrency: options.concurrency ?? DEFAULT_CLI_CONCURRENCY,
        hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator,
      }, provider, 'comic-qa', `${options.sceneSlug}:qa-only:panel-${input.panelNumber}`, index, async () => await judge({
        pageNumber: input.panelNumber,
        pagePath: input.panelPath,
        panelData: input.bundleData,
        identityCards: input.references.primaryCharacterRefs,
        locationSheets: input.references.secondaryRefs,
        designSheets: input.references.designReferences?.map(reference => reference.path),
        characterReferences: input.references.characterReferences,
        locationReferences: input.references.locationReferences,
        designReferences: input.references.designReferences,
        model: judgeModel,
      }))
      const afterSha256 = await fileSha256(input.panelPath)
      if (afterSha256 !== input.panelSha256) throw ValidationError(`Canonical panel changed during QA-only audit: ${input.panelPath}`, { stage: 'comic:qa-only' })
      return { input, entry: { ...entry, pageNumber: input.panelNumber, panelNumbers: [input.panelNumber], outputFile: basename(input.panelPath) }, afterSha256 }
    } catch (error) {
      return { input, error: error instanceof Error ? error.message : String(error), afterSha256: await fileSha256(input.panelPath).catch(() => 'unreadable') }
    }
  })
  const entries = results.flatMap(result => result.entry ? [result.entry] : [])
  await writePageQaReports(reportDirectory, entries)
  const audit = {
    schemaVersion: 1,
    mode: 'qa-only',
    sceneSlug: options.sceneSlug,
    judgeModel,
    imageGenerationCalls: 0,
    imageRepairCalls: 0,
    canonicalImagesModified: results.some(result => result.afterSha256 !== result.input.panelSha256),
    panels: results.map(result => ({
      panelNumber: result.input.panelNumber,
      path: relative(getSceneOutputDirectory(options.sceneSlug), result.input.panelPath).replace(/\\/g, '/'),
      sha256Before: result.input.panelSha256,
      sha256After: result.afterSha256,
      ...(result.entry ? { hardFailure: result.entry.hardFailure } : {}),
      ...(result.error ? { error: result.error } : {}),
    })),
  }
  await Bun.write(join(reportDirectory, 'qa-only-audit.json'), `${JSON.stringify(audit, null, 2)}\n`)
  const failures = results.filter(result => result.error)
  if (failures.length > 0) throw InfraError(`${failures.length} QA-only panel judgment(s) failed; partial evidence was preserved at ${reportDirectory}`, { stage: 'comic:qa-only' })
  return {
    reportDirectory,
    entries,
    inputTokens: entries.reduce((sum, entry) => sum + entry.usage.inputTokens, 0),
    outputTokens: entries.reduce((sum, entry) => sum + entry.usage.outputTokens, 0),
    costUsd: entries.reduce((sum, entry) => sum + entry.usage.costUsd, 0),
  }
}
