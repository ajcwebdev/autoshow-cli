import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import * as v from 'valibot'
import type { ProcessSceneOptions, ProcessSceneResult } from '~/types'
import { PanelBundleDataSchema, ScenePromptDataSchema, StructuredScriptDataSchema, validateSceneCharacters, validateStructuredScriptCharacters } from '../../schemas/schemas'
import { parseJsonFile } from '../../comic-utils/json-prompt-utils'
import { comicLog, err } from '../../comic-utils/comic-logger'
import { getSceneWorkspaceDirectoryForPanelPrompt, getStructuredScriptPath } from '../../comic-utils/project-paths'
import { validateSceneRecapMontageExpansion } from '../../comic-utils/recap-montage-utils'
import { getPanelPromptTemplate, loadPromptsConfig, validatePanelNumberSequence } from '../../comic-utils/scene-utils'
import { mapWithConcurrency } from '../../comic-utils/run-with-concurrency'
import { assertSourceCoverageReportComplete, formatSourceSegmentsMarkdown, resolvePanelSourceSegments, validateSceneSourceSegmentCoverage, verifySourceSegmentCoverageInPromptFiles, writePanelPromptCoverageReport } from '../../comic-utils/source-coverage-utils'
import { loadCharacterCatalog } from '../../comic-utils/character-reference-config'
import { createCharacterReferenceSnapshot } from '../../comic-utils/character-reference-snapshot'
import { createLocationReferenceSnapshots } from '../../comic-utils/location-reference'
import { createDesignReferenceSnapshot } from '../../comic-utils/design-reference'
import { ValidationError } from '~/utils/error-handler'

const getPanelDirectoryName = (panelNumber: number): string => `panel-${String(panelNumber).padStart(2, '0')}`

export const processScene = async ({ sceneSlug, sceneJsonPath, outputDir, concurrency }: ProcessSceneOptions): Promise<ProcessSceneResult> => {
  const stats: ProcessSceneResult = { success: 0, errors: 0, panels: 0 }
  try {
    const sceneContent = await Bun.file(sceneJsonPath).text()
    if (!sceneContent.trim()) throw ValidationError(`Scene JSON file is empty: ${sceneJsonPath}`, { stage: 'comic:process-scenes' })
    const catalog = loadCharacterCatalog()
    const sceneData = v.parse(ScenePromptDataSchema, JSON.parse(sceneContent))
    validateSceneCharacters(sceneData, catalog)
    const structuredScript = await parseJsonFile(getStructuredScriptPath(sceneSlug), StructuredScriptDataSchema)
    validateStructuredScriptCharacters(structuredScript, catalog)
    stats.panels = sceneData.panels.length
    validatePanelNumberSequence(sceneData.title, sceneData.panels)
    validateSceneSourceSegmentCoverage(sceneData, structuredScript.sourceSegments)
    await validateSceneRecapMontageExpansion(sceneData, structuredScript)

    // Validate every required live asset before writing a single panel bundle.
    const visibleKeys = sceneData.panels.flatMap(panel => panel.characterKeys.map(key => catalog.requireKey(key)))
    const workspaceDirectory = getSceneWorkspaceDirectoryForPanelPrompt(join(outputDir, getPanelDirectoryName(1)))
    const manifest = await createCharacterReferenceSnapshot(workspaceDirectory, visibleKeys, catalog)
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
      if (!locationSnapshot) throw ValidationError(`No location snapshot was staged for panel ${currentPanel.number} key "${currentPanel.locationKey}"`, { stage: 'comic:process-scenes' })
      const bundle = v.parse(PanelBundleDataSchema, {
        schemaVersion: 4,
        snapshotId: manifest.snapshotId,
        title: sceneData.title,
        location: sceneData.location,
        panels: [{ ...currentPanel, number: panelNum, sourceSegments, locationSnapshotId: locationSnapshot.snapshotId, ...(currentPanel.designReferences?.length ? { designSnapshotId: designManifest?.snapshotId, designReferenceKeys: currentPanel.designReferences.map(reference => reference.key) } : {}) }],
      })
      panelContent += `${formatSourceSegmentsMarkdown(sourceSegments)}\n\n`
      panelContent += `\`\`\`json\n${JSON.stringify(bundle, null, 2)}\n\`\`\``
      const promptPath = join(panelDirectory, `${sceneSlug}-panel-${panelNum}.md`)
      await Bun.write(promptPath, panelContent)
      return { path: promptPath, content: panelContent }
    })

    const coverageReport = verifySourceSegmentCoverageInPromptFiles(structuredScript.sourceSegments, promptFiles)
    await writePanelPromptCoverageReport(sceneSlug, coverageReport)
    assertSourceCoverageReportComplete(coverageReport)
    stats.coverageReport = coverageReport
    stats.success++
    comicLog.line('panel-prompts generated', [`panels=${sceneData.panels.length}`, `snapshot=${manifest.snapshotId}`, `locationSnapshots=${locationManifest.snapshots.length}`, `designs=${designManifest?.designs.length ?? 0}`, `characters=${manifest.characters.length}`, `coverage=${coverageReport.coveredSegments}/${coverageReport.totalSegments}`])
  } catch (error) {
    stats.errors++
    err('Panel prompt generation failed:', error instanceof Error ? error.message : String(error))
    throw error
  }
  return stats
}
