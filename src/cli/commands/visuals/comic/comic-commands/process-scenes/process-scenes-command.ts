import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import * as v from 'valibot'
import type { BlockingBindings, BlockingPlan, CharacterCatalogService, CharacterKey, ProcessSceneOptions, ProcessSceneResult, SceneBlockingCompilation, ScenePromptData, StructuredScriptData } from '~/types'
import { PanelBundleDataSchema, ScenePromptDataSchema, StructuredScriptDataSchema, validateSceneCharacters, validateStructuredScriptCharacters } from '../../schemas/schemas'
import { BlockingBindingsSchema, BlockingPlanSchema } from '../../schemas/blocking-plan-schemas'
import { parseJsonFile } from '../../comic-utils/json-prompt-utils'
import { comicLog, err } from '../../comic-utils/comic-logger'
import { getSceneWorkspaceDirectoryForPanelPrompt, getStructuredScriptPath } from '../../comic-utils/project-paths'
import { getBlockingBindingsPathForWorkspace, getBlockingDirectoryForWorkspace, getBlockingPlanPathForWorkspace } from '../../comic-utils/blocking-plan-paths'
import { compileSceneBlocking, writeBlockingArtifacts } from '../../comic-utils/blocking-plan-compile'
import { validateScenePanelBlocking } from '../../comic-utils/blocking-plan-validation'
import { validateSceneRecapMontageExpansion } from '../../comic-utils/recap-montage-utils'
import { getPanelPromptTemplate, loadPromptsConfig, validatePanelNumberSequence } from '../../comic-utils/scene-utils'
import { mapWithConcurrency } from '~/utils/run-with-concurrency'
import { assertSourceCoverageReportComplete, formatSourceSegmentsMarkdown, resolvePanelSourceSegments, validateSceneSourceSegmentCoverage, verifySourceSegmentCoverageInPromptFiles, writePanelPromptCoverageReport } from '../../comic-utils/source-coverage-utils'
import { loadCharacterCatalog } from '../../comic-utils/character-reference-config'
import { createCharacterReferenceSnapshot } from '../../comic-utils/character-reference-snapshot'
import { createLocationReferenceSnapshots } from '../../comic-utils/location-reference'
import { createDesignReferenceSnapshot } from '../../comic-utils/design-reference'
import { ValidationError } from '~/utils/error-handler'
import { sha256Bytes } from '~/utils/value-helpers'

const STAGE = 'comic:process-scenes'

const getPanelDirectoryName = (panelNumber: number): string => `panel-${String(panelNumber).padStart(2, '0')}`

type SceneBlockingState = {
  plan: BlockingPlan
  planSha256: string
  bindings: BlockingBindings | undefined
  compilation: SceneBlockingCompilation
  onStageKeys: CharacterKey[]
}

const formatPanelNumbers = (numbers: readonly number[]): string => numbers.join(', ')

const hashFile = async (path: string): Promise<string> => sha256Bytes(new Uint8Array(await Bun.file(path).arrayBuffer()))

export const collectPlanOnStageKeys = (plan: BlockingPlan, catalog: Pick<CharacterCatalogService, 'characterKeys' | 'requireKey'>): CharacterKey[] => {
  const keys: CharacterKey[] = []
  const seen = new Set<string>()
  const push = (key: string): void => {
    if (seen.has(key) || !catalog.characterKeys.includes(key as CharacterKey)) return
    seen.add(key)
    keys.push(catalog.requireKey(key))
  }
  for (const state of plan.stageStates) {
    for (const mark of state.characters) push(mark.characterKey)
    for (const extras of state.extras) push(extras.ensembleKey)
  }
  return keys
}

const loadSceneBlocking = async (input: {
  workspaceDirectory: string
  sceneSlug: string
  sceneJsonPath: string
  sceneData: ScenePromptData
  structuredScript: StructuredScriptData
  catalog: CharacterCatalogService
}): Promise<SceneBlockingState | undefined> => {
  const planPath = getBlockingPlanPathForWorkspace(input.workspaceDirectory)
  if (!existsSync(planPath)) return undefined
  const plan = await parseJsonFile(planPath, BlockingPlanSchema)
  const planSha256 = await hashFile(planPath)
  const structuredScriptSha256 = await hashFile(getStructuredScriptPath(input.sceneSlug))
  if (plan.structuredScriptSha256 !== structuredScriptSha256) {
    throw ValidationError(`Blocking plan at ${planPath} was drafted against a different structured script; run "bun autoshow comic draft-scenes <script-path> --only blocking --rebind" first.`, { stage: STAGE })
  }
  const bindingsPath = getBlockingBindingsPathForWorkspace(input.workspaceDirectory)
  let bindings: BlockingBindings | undefined
  if (existsSync(bindingsPath)) {
    bindings = await parseJsonFile(bindingsPath, BlockingBindingsSchema)
    if (bindings.planSha256 !== planSha256) {
      throw ValidationError(`Blocking bindings at ${bindingsPath} were bound to plan ${bindings.planSha256} but metadata/blocking-plan.json is ${planSha256}; rerun draft-scenes --only blocking`, { stage: STAGE })
    }
    const sceneSha256 = await hashFile(input.sceneJsonPath)
    if (bindings.sceneSha256 !== sceneSha256) {
      throw ValidationError(`Blocking bindings at ${bindingsPath} were bound to a different metadata/scene.json (${bindings.sceneSha256} versus ${sceneSha256}); rerun draft-scenes --only blocking`, { stage: STAGE })
    }
  }
  const unbound = input.sceneData.panels.filter(panel => !panel.blocking && !bindings?.panels.some(item => item.panelNumber === panel.number)).map(panel => panel.number)
  if (unbound.length > 0) {
    throw ValidationError(`Blocking plan exists but panel${unbound.length === 1 ? '' : 's'} ${formatPanelNumbers(unbound)} carr${unbound.length === 1 ? 'ies' : 'y'} no blocking citation and metadata/blocking-bindings.json does not bind ${unbound.length === 1 ? 'it' : 'them'}; rerun draft-scenes --only blocking (bind mode) or --only scene`, { stage: STAGE })
  }
  const segmentOrder = input.structuredScript.sourceSegments.map(segment => segment.id)
  const issues = validateScenePanelBlocking(plan, input.sceneData.panels, { segmentOrder, bindings })
  if (issues.length > 0) {
    throw ValidationError(`Scene JSON contradicts the blocking plan:\n- ${issues.map(issue => issue.message).join('\n- ')}`, { stage: STAGE })
  }
  const compilation = compileSceneBlocking(plan, input.sceneData.panels, bindings, { segmentOrder, planSha256 })
  return { plan, planSha256, bindings, compilation, onStageKeys: collectPlanOnStageKeys(plan, input.catalog) }
}

export const processScene = async ({ sceneSlug, sceneJsonPath, outputDir, concurrency, blocking: useBlockingPlan }: ProcessSceneOptions): Promise<ProcessSceneResult> => {
  const stats: ProcessSceneResult = { success: 0, errors: 0, panels: 0 }
  try {
    const sceneContent = await Bun.file(sceneJsonPath).text()
    if (!sceneContent.trim()) throw ValidationError(`Scene JSON file is empty: ${sceneJsonPath}`, { stage: STAGE })
    const catalog = loadCharacterCatalog()
    const sceneData = v.parse(ScenePromptDataSchema, JSON.parse(sceneContent))
    validateSceneCharacters(sceneData, catalog)
    const structuredScript = await parseJsonFile(getStructuredScriptPath(sceneSlug), StructuredScriptDataSchema)
    validateStructuredScriptCharacters(structuredScript, catalog)
    stats.panels = sceneData.panels.length
    validatePanelNumberSequence(sceneData.title, sceneData.panels)
    validateSceneSourceSegmentCoverage(sceneData, structuredScript.sourceSegments)
    await validateSceneRecapMontageExpansion(sceneData, structuredScript)

    const visibleKeys = sceneData.panels.flatMap(panel => panel.characterKeys.map(key => catalog.requireKey(key)))
    const workspaceDirectory = getSceneWorkspaceDirectoryForPanelPrompt(join(outputDir, getPanelDirectoryName(1)))
    const blocking = useBlockingPlan === false ? undefined : await loadSceneBlocking({ workspaceDirectory, sceneSlug, sceneJsonPath, sceneData, structuredScript, catalog })
    const snapshotKeys = blocking ? [...visibleKeys, ...blocking.onStageKeys.filter(key => !visibleKeys.includes(key))] : visibleKeys
    const manifest = await createCharacterReferenceSnapshot(workspaceDirectory, snapshotKeys, catalog)
    const locationKeys = Array.from(new Set(sceneData.panels.map(panel => panel.locationKey)))
    const locationManifest = await createLocationReferenceSnapshots(workspaceDirectory, locationKeys)
    const locationSnapshotByKey = new Map(locationManifest.snapshots.map(snapshot => [snapshot.locationKey, snapshot]))
    const designManifest = await createDesignReferenceSnapshot(workspaceDirectory, sceneData.panels.flatMap(panel => panel.designReferences ?? []))
    const prompts = await loadPromptsConfig()
    const scenePrompts = prompts['Scene Prompts']
    const prefix = scenePrompts.Prefix || ''
    await mkdir(outputDir, { recursive: true })

    const promptFiles = await mapWithConcurrency(concurrency, sceneData.panels, async (currentPanel, index) => {
      const panelNum = index + 1
      const panelDirectory = join(outputDir, getPanelDirectoryName(panelNum))
      await mkdir(panelDirectory, { recursive: true })
      const promptTemplate = getPanelPromptTemplate(scenePrompts, panelNum)
      let panelContent = `${prefix ? `${prefix}\n\n${promptTemplate}` : promptTemplate}\n\n`
      const sourceSegments = resolvePanelSourceSegments(currentPanel.sourceSegmentIds, structuredScript.sourceSegments)
      const locationSnapshot = locationSnapshotByKey.get(currentPanel.locationKey)
      if (!locationSnapshot) throw ValidationError(`No location snapshot was staged for panel ${currentPanel.number} key "${currentPanel.locationKey}"`, { stage: STAGE })
      const compiledBlocking = blocking?.compilation.panels[index]
      if (blocking && !compiledBlocking) throw ValidationError(`No compiled blocking object exists for panel ${currentPanel.number}`, { stage: STAGE })
      const bundle = v.parse(PanelBundleDataSchema, {
        schemaVersion: 4,
        snapshotId: manifest.snapshotId,
        title: sceneData.title,
        location: sceneData.location,
        panels: [{ ...currentPanel, number: panelNum, sourceSegments, locationSnapshotId: locationSnapshot.snapshotId, ...(currentPanel.designReferences?.length ? { designSnapshotId: designManifest?.snapshotId, designReferenceKeys: currentPanel.designReferences.map(reference => reference.key) } : {}) }],
        ...(blocking && compiledBlocking ? { blocking: compiledBlocking, planSha256: blocking.compilation.planSha256 } : {}),
      })
      panelContent += `${formatSourceSegmentsMarkdown(sourceSegments)}\n\n`
      panelContent += `\`\`\`json\n${JSON.stringify(bundle, null, 2)}\n\`\`\``
      const promptPath = join(panelDirectory, `${sceneSlug}-panel-${panelNum}.md`)
      await Bun.write(promptPath, panelContent)
      return { path: promptPath, content: panelContent }
    })

    const blockingArtifacts = blocking ? await writeBlockingArtifacts(getBlockingDirectoryForWorkspace(workspaceDirectory), blocking.compilation) : []
    const coverageReport = verifySourceSegmentCoverageInPromptFiles(structuredScript.sourceSegments, promptFiles)
    await writePanelPromptCoverageReport(sceneSlug, coverageReport)
    assertSourceCoverageReportComplete(coverageReport)
    stats.coverageReport = coverageReport
    stats.success++
    comicLog.line('panel-prompts generated', [
      `panels=${sceneData.panels.length}`,
      `snapshot=${manifest.snapshotId}`,
      `locationSnapshots=${locationManifest.snapshots.length}`,
      `designs=${designManifest?.designs.length ?? 0}`,
      `characters=${manifest.characters.length}`,
      `coverage=${coverageReport.coveredSegments}/${coverageReport.totalSegments}`,
      blocking ? `blocking=${blocking.compilation.panels.length}` : undefined,
      blocking ? `blockingPlan=${blocking.planSha256.slice(0, 12)}` : undefined,
      blocking ? `blockingArtifacts=${blockingArtifacts.length}` : undefined,
    ])
  } catch (error) {
    stats.errors++
    err('Panel prompt generation failed:', error instanceof Error ? error.message : String(error))
    throw error
  }
  return stats
}
