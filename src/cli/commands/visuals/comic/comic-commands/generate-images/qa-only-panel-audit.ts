import { mkdir, readdir } from 'node:fs/promises'
import { basename, join, relative } from 'node:path'
import type { ComicPanelSelection, ContinuityJudgeEntry, ContinuityJudgeRequest, GenerateImagesCommandOptions, PageQaEntry, PageQaRequest, PanelBundleData, QaOnlyContinuityAudit, ResolvedReferenceImages } from '~/types'
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
import { judgePanelContinuity } from './continuity-qa'
import { attachContinuityToPageQaEntry, buildContinuityAuditReport, buildContinuityStageState, buildQaOnlyContinuityExtension, getContinuityAuditDirectory, loadContinuityAuditContext, readReusablePageQaEntryForAudit, writeContinuityAuditArtifacts } from '../../comic-utils/continuity-audit-report'

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
  continuity?: QaOnlyContinuityAudit
}

type QaOnlyPanelAuditDependencies = {
  judgePage?: (request: PageQaRequest) => Promise<PageQaEntry>
  judgeContinuity?: (request: ContinuityJudgeRequest) => Promise<ContinuityJudgeEntry>
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
  const runId = dependencies.runId ?? createComicRunId()
  const reportDirectory = join(getSceneOutputDirectory(options.sceneSlug), 'qa', `panel-audit-${runId}`)
  const continuityRequired = options.continuityQa === true
  const pageJudgeEnabled = !(continuityRequired && options.continuityOnly === true)
  const continuity = continuityRequired
    ? await loadContinuityAuditContext(options.sceneSlug, inputs, { trustedAnchorPanel: options.trustedAnchorPanel, labelsPath: options.labels, judgeModel, composeCards: true })
    : undefined
  const continuityDirectory = continuity ? getContinuityAuditDirectory(options.sceneSlug, runId) : undefined
  await mkdir(reportDirectory, { recursive: true })
  const judge = dependencies.judgePage ?? judgeComicPage
  const judgeContinuity = dependencies.judgeContinuity ?? (async (request: ContinuityJudgeRequest) => await judgePanelContinuity(request))
  const scheduling = {
    concurrency: options.concurrency ?? DEFAULT_CLI_CONCURRENCY,
    hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator,
  }
  const results = await mapWithConcurrency(options.concurrency ?? DEFAULT_CLI_CONCURRENCY, inputs, async (input, index) => {
    let entry: PageQaEntry | undefined
    let error: string | undefined
    let continuityEntry: ContinuityJudgeEntry | undefined
    let continuityError: string | undefined
    if (pageJudgeEnabled) {
      try {
        const reusable = continuityRequired ? await readReusablePageQaEntryForAudit(input.panelPath, judgeModel, { continuityRequired: true }) : undefined
        const judged = reusable ?? await runComicHostedRequest(scheduling, provider, 'comic-qa', `${options.sceneSlug}:qa-only:panel-${input.panelNumber}`, index, async () => await judge({
          pageNumber: input.panelNumber,
          pagePath: input.panelPath,
          panelData: input.bundleData,
          identityCards: input.references.primaryCharacterRefs,
          locationSheets: input.references.secondaryRefs,
          designSheets: input.references.designReferences?.map(reference => reference.path),
          characterReferences: input.references.characterReferences,
          locationReferences: input.references.locationReferences,
          designReferences: input.references.designReferences,
          ...(input.references.rosterCharacterReferences?.length ? { rosterCards: input.references.rosterCharacterReferences } : {}),
          ...(options.blockingHardKeys?.length ? { blockingHardKeys: options.blockingHardKeys } : {}),
          model: judgeModel,
        }))
        entry = { ...judged, pageNumber: input.panelNumber, panelNumbers: [input.panelNumber], outputFile: basename(input.panelPath) }
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught)
      }
    }
    if (continuity) {
      const request = continuity.requests.find(item => item.panelNumber === input.panelNumber)
      if (!request) {
        continuityError = `No continuity request was prepared for panel ${input.panelNumber}`
      } else {
        try {
          continuityEntry = await runComicHostedRequest(scheduling, provider, 'comic-qa', `${options.sceneSlug}:continuity:panel-${input.panelNumber}`, index, async () => await judgeContinuity(request))
        } catch (caught) {
          continuityError = caught instanceof Error ? caught.message : String(caught)
        }
      }
    }
    const afterSha256 = await fileSha256(input.panelPath).catch(() => 'unreadable')
    if (afterSha256 !== input.panelSha256) {
      const changed = ValidationError(`Canonical panel changed during QA-only audit: ${input.panelPath}`, { stage: 'comic:qa-only' }).message
      if (pageJudgeEnabled) error = error ?? changed
      if (continuity) continuityError = continuityError ?? changed
    }
    return {
      input,
      entry: entry && continuityEntry ? attachContinuityToPageQaEntry(entry, continuityEntry) : entry,
      error,
      continuityEntry,
      continuityError,
      afterSha256,
    }
  })
  const entries = results.flatMap(result => result.entry ? [result.entry] : [])
  if (pageJudgeEnabled) await writePageQaReports(reportDirectory, entries)
  const continuityEntries = results.flatMap(result => result.continuityEntry ? [result.continuityEntry] : [])
  const continuityErrors = results.flatMap(result => result.continuityError ? [{ panelNumber: result.input.panelNumber, error: result.continuityError }] : [])
  let continuityAudit: QaOnlyContinuityAudit | undefined
  let continuityUsage = { inputTokens: 0, outputTokens: 0, costUsd: 0 }
  if (continuity && continuityDirectory) {
    const report = buildContinuityAuditReport({
      sceneSlug: options.sceneSlug,
      runId,
      judgeModel,
      plan: continuity.plan,
      entries: continuityEntries,
      errors: continuityErrors,
      selection: inputs.map(input => input.panelNumber),
      labels: continuity.labels,
    })
    await writeContinuityAuditArtifacts(continuityDirectory, {
      report,
      stageState: buildContinuityStageState(options.sceneSlug, continuity.plan, continuityEntries),
      entries: continuityEntries,
    })
    continuityAudit = buildQaOnlyContinuityExtension(report, continuityDirectory, options.sceneSlug)
    continuityUsage = { inputTokens: report.ledger.usage.inputTokens, outputTokens: report.ledger.usage.outputTokens, costUsd: report.ledger.usage.costUsd }
  }
  const audit = {
    schemaVersion: 1,
    mode: 'qa-only',
    sceneSlug: options.sceneSlug,
    judgeModel,
    imageGenerationCalls: 0,
    imageRepairCalls: 0,
    canonicalImagesModified: results.some(result => result.afterSha256 !== result.input.panelSha256),
    ...(continuityAudit ? { continuity: continuityAudit } : {}),
    panels: results.map(result => ({
      panelNumber: result.input.panelNumber,
      path: relative(getSceneOutputDirectory(options.sceneSlug), result.input.panelPath).replace(/\\/g, '/'),
      sha256Before: result.input.panelSha256,
      sha256After: result.afterSha256,
      ...(result.entry ? { hardFailure: result.entry.hardFailure } : {}),
      ...(result.error ? { error: result.error } : {}),
      ...(result.continuityEntry ? { continuity: { hardKeys: result.continuityEntry.hardKeys, blooperCategory: result.continuityEntry.result.blooperCategory, anchorPanel: result.continuityEntry.anchorPanel, predecessorPanel: result.continuityEntry.predecessorPanel } } : {}),
      ...(result.continuityError ? { continuityError: result.continuityError } : {}),
    })),
  }
  await Bun.write(join(reportDirectory, 'qa-only-audit.json'), `${JSON.stringify(audit, null, 2)}\n`)
  const failures = results.filter(result => result.error)
  const continuityFailures = results.filter(result => result.continuityError)
  const failureMessages = [
    failures.length > 0 ? `${failures.length} QA-only panel judgment(s) failed; partial evidence was preserved at ${reportDirectory}` : undefined,
    continuityFailures.length > 0 ? `${continuityFailures.length} continuity judgment(s) failed; partial evidence was preserved at ${continuityDirectory}` : undefined,
  ].filter((message): message is string => message !== undefined)
  if (failureMessages.length > 0) throw InfraError(failureMessages.join('; '), { stage: 'comic:qa-only' })
  return {
    reportDirectory,
    entries,
    inputTokens: entries.reduce((sum, entry) => sum + entry.usage.inputTokens, 0) + continuityUsage.inputTokens,
    outputTokens: entries.reduce((sum, entry) => sum + entry.usage.outputTokens, 0) + continuityUsage.outputTokens,
    costUsd: entries.reduce((sum, entry) => sum + entry.usage.costUsd, 0) + continuityUsage.costUsd,
    ...(continuityAudit ? { continuity: continuityAudit } : {}),
  }
}
