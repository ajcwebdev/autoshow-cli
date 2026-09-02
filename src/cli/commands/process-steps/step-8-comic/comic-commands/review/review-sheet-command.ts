import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import * as v from 'valibot'
import type { PageQaEntry, ReviewSheetCommandDependencies, ReviewSheetCommandOptions, ReviewSheetPanel, ReviewSheetPanelQa, ReviewSheetResult, ScenePromptData, StructuredScriptData } from '~/types'
import { ScenePromptDataSchema, StructuredScriptDataSchema } from '../../schemas/schemas'
import { comicLog, err } from '../../comic-utils/comic-logger'
import { parseJsonFile } from '../../comic-utils/json-prompt-utils'
import { getBlockingPanelSvgPath } from '../../comic-utils/blocking-plan-paths'
import { getPanelsDirectory, getSceneJsonPath, getSceneOutputDirectory, getStructuredScriptPath, normalizeProjectPath } from '../../comic-utils/project-paths'
import { getPanelComicImagePath } from '../../comic-utils/scene-utils'
import { getReviewDirectory, getReviewExportDocPath, getReviewSheetPath } from './review-paths'
import { InfraError } from '~/utils/error-handler'

const STAGE = 'comic:review-sheet'

const escapeHtml = (value: string): string => value
  .replace(/&/gu, '&amp;')
  .replace(/</gu, '&lt;')
  .replace(/>/gu, '&gt;')
  .replace(/"/gu, '&quot;')

/** Strips the XML prolog so the SVG can be inlined into an HTML body verbatim. */
const inlineSvg = (svg: string): string => svg.replace(/^﻿/u, '').replace(/<\?xml[^>]*\?>\s*/u, '').trim()

const describeSpeaker = (speaker: ScenePromptData['panels'][number]['speech'][number]['speaker']): string =>
  speaker.kind === 'character'
    ? `${speaker.characterKey}${speaker.offscreen ? ' (offscreen)' : ''}`
    : speaker.kind === 'caption' ? 'caption' : `voice labeled ${speaker.label}`

const readPageQaEntries = async (sceneSlug: string, provided?: PageQaEntry[] | undefined): Promise<PageQaEntry[] | null> => {
  if (provided) return provided
  const reportPath = join(getPanelsDirectory(sceneSlug), 'page-qa-report.json')
  if (!existsSync(reportPath)) return null
  try {
    const report = JSON.parse(await Bun.file(reportPath).text()) as { pages?: PageQaEntry[] }
    return Array.isArray(report.pages) ? report.pages : null
  } catch { return null }
}

const summarizeQa = (entries: PageQaEntry[] | null, panelNumber: number, attempts: number): ReviewSheetPanelQa | null => {
  if (!entries) return null
  const entry = entries.find(candidate => candidate.panelNumbers.includes(panelNumber))
  if (!entry) return null
  const panel = entry.result.panels.find(candidate => candidate.panelNumber === panelNumber)
  const hardFailureKeys: string[] = []
  if (panel) {
    const prefix = `panel-${panelNumber}:`
    if (!panel.requiredCastPresent) hardFailureKeys.push(`${prefix}requiredCastPresent`)
    if (!panel.unexpectedCastAbsent) hardFailureKeys.push(`${prefix}unexpectedCastAbsent`)
    if (panel.identityIssueKind === 'unmistakable-mismatch') hardFailureKeys.push(`${prefix}identityMatch`)
    if (!panel.locationMatch) hardFailureKeys.push(`${prefix}locationMatch`)
    if (!panel.setContinuityMatch) hardFailureKeys.push(`${prefix}setContinuityMatch`)
    if (!panel.sourcePrecedence) hardFailureKeys.push(`${prefix}sourcePrecedence`)
    if (!panel.shotPlanMatch) hardFailureKeys.push(`${prefix}shotPlanMatch`)
    if (panel.blockingAudit && panel.blockingAudit.some(item => item.status !== 'on-mark' && item.status !== 'not-assessable')) hardFailureKeys.push(`${prefix}blockingAudit`)
    if (panel.axisSideMatch === false) hardFailureKeys.push(`${prefix}axisSideMatch`)
    if (panel.dialogueIssueKind === 'content') hardFailureKeys.push(`${prefix}dialogueAccuracy`)
    if (!panel.speakerAttribution) hardFailureKeys.push(`${prefix}speakerAttribution`)
  }
  const route = entry.repairPolicy
    ? `${entry.repairPolicy.action}${entry.repairPolicy.reason ? ` (${entry.repairPolicy.reason})` : ''}`
    : entry.hardFailure ? 'unresolved' : 'none'
  return {
    attempts,
    hardFailureKeys,
    repairRoute: route,
    lineage: entry.repairPolicy?.action === 'restart' ? 'restarted from canonical references' : entry.hardFailure ? 'edited' : 'initial generation',
  }
}

const countAttempts = async (sceneSlug: string, panelNumber: number): Promise<number> => {
  const attemptsDirectory = join(getPanelsDirectory(sceneSlug), 'attempts', `panel-${String(panelNumber).padStart(2, '0')}`)
  if (!existsSync(attemptsDirectory)) return 0
  const { readdir } = await import('node:fs/promises')
  const entries = await readdir(attemptsDirectory)
  return entries.filter(name => /^attempt-\d+\.png$/u.test(name)).length
}

export const buildReviewSheetHtml = (result: Omit<ReviewSheetResult, 'outputPath' | 'exportDocPath'>): string => {
  const sections = result.panels.map(panel => [
    `<section class="panel" id="panel-${panel.panelNumber}">`,
    `<h2>Panel ${panel.panelNumber}</h2>`,
    '<div class="grid">',
    '<div class="art">',
    panel.imagePath
      ? `<img src="${escapeHtml(panel.imagePath)}" alt="Canonical panel ${panel.panelNumber}">`
      : '<p class="empty">No canonical panel image is promoted yet.</p>',
    '<div class="board">',
    panel.stageBoardSvg ? panel.stageBoardSvg : '<p class="empty">No stage board: this scene has no blocking plan.</p>',
    '</div>',
    '</div>',
    '<div class="contract">',
    '<h3>Contract</h3>',
    `<p><strong>Description:</strong> ${escapeHtml(panel.description)}</p>`,
    `<p><strong>Shot plan:</strong> ${escapeHtml(panel.shotPlan)}</p>`,
    `<p><strong>characterKeys:</strong> ${panel.characterKeys.length > 0 ? escapeHtml(panel.characterKeys.join(', ')) : 'none'}</p>`,
    '<h3>Speech</h3>',
    panel.speech.length > 0
      ? `<ul>${panel.speech.map(item => `<li><strong>${escapeHtml(item.speaker)}:</strong> ${escapeHtml(item.line)}</li>`).join('')}</ul>`
      : '<p class="empty">No dialogue.</p>',
    '<h3>Source segments</h3>',
    panel.sourceSegments.length > 0
      ? `<ul>${panel.sourceSegments.map(item => `<li><code>${escapeHtml(item.id)}</code> ${escapeHtml(item.text)}</li>`).join('')}</ul>`
      : '<p class="empty">No source segments recorded.</p>',
    '<h3>QA</h3>',
    panel.qa
      ? `<ul><li><strong>Attempts:</strong> ${panel.qa.attempts}</li><li><strong>Hard-failure keys:</strong> ${panel.qa.hardFailureKeys.length > 0 ? escapeHtml(panel.qa.hardFailureKeys.join(', ')) : 'none'}</li><li><strong>Repair route:</strong> ${escapeHtml(panel.qa.repairRoute)}</li><li><strong>Lineage:</strong> ${escapeHtml(panel.qa.lineage)}</li></ul>`
      : '<p class="empty">QA evidence not retained.</p>',
    '<h3>Notes</h3>',
    `<textarea class="notes" data-panel="${panel.panelNumber}" rows="5" placeholder="Notes for panel ${panel.panelNumber}"></textarea>`,
    '</div>',
    '</div>',
    '</section>',
  ].join('\n'))
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>Review sheet: ${escapeHtml(result.sceneTitle)}</title>`,
    '<style>',
    ':root { color-scheme: light dark; }',
    'body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; margin: 0; padding: 1.5rem; line-height: 1.5; }',
    'h1 { margin-top: 0; }',
    '.panel { border-top: 1px solid currentColor; padding-top: 1rem; margin-top: 1.5rem; }',
    '.grid { display: flex; flex-wrap: wrap; gap: 1.5rem; align-items: flex-start; }',
    '.art { flex: 1 1 22rem; min-width: 18rem; }',
    '.contract { flex: 1 1 22rem; min-width: 18rem; }',
    'img { max-width: 100%; height: auto; display: block; }',
    '.board svg { max-width: 100%; height: auto; }',
    '.empty { opacity: 0.7; font-style: italic; }',
    'textarea.notes { width: 100%; font: inherit; }',
    'pre#collected { white-space: pre-wrap; border: 1px solid currentColor; padding: 0.75rem; }',
    '</style>',
    '</head>',
    '<body>',
    `<h1>Review sheet: ${escapeHtml(result.sceneTitle)}</h1>`,
    `<p>Scene <code>${escapeHtml(result.sceneSlug)}</code>. ${result.panels.length} panels. This page makes no network request and generates nothing; it is a static reading and note-taking surface.</p>`,
    '<p>Type notes below each panel, then press Collect notes to build a <code>### Panel NN</code> Markdown block for <code>comic review-notes --notes</code>.</p>',
    '<p><button type="button" id="collect">Collect notes</button></p>',
    '<pre id="collected">Collected notes appear here.</pre>',
    ...sections,
    '<script>',
    "document.getElementById('collect').addEventListener('click', function () {",
    "  var blocks = [];",
    "  document.querySelectorAll('textarea.notes').forEach(function (field) {",
    "    var text = field.value.trim();",
    "    if (text) blocks.push('### Panel ' + field.dataset.panel + '\\n\\n' + text);",
    "  });",
    "  document.getElementById('collected').textContent = blocks.length > 0 ? blocks.join('\\n\\n') : 'No notes typed yet.';",
    '});',
    '</script>',
    '</body>',
    '</html>',
    '',
  ].join('\n')
}

export const buildReviewExportDoc = (result: Omit<ReviewSheetResult, 'outputPath' | 'exportDocPath'>): string => [
  `# ${result.sceneTitle} panel export`,
  '',
  `Scene \`${result.sceneSlug}\`. One heading per panel; write notes in the blank paragraph after each image so every note maps to its panel number.`,
  '',
  ...result.panels.flatMap(panel => [
    `### Panel ${panel.panelNumber}`,
    '',
    panel.imagePath ? `![Panel ${panel.panelNumber}](${panel.imagePath})` : `_No canonical panel image is promoted for panel ${panel.panelNumber}._`,
    '',
    '',
  ]),
].join('\n')

export const reviewSheetCommand = async (
  options: ReviewSheetCommandOptions,
  dependencies: ReviewSheetCommandDependencies = {},
): Promise<ReviewSheetResult> => {
  try {
    const sceneJsonPath = getSceneJsonPath(options.sceneSlug)
    if (!dependencies.scene && !existsSync(sceneJsonPath)) {
      throw InfraError(`Scene JSON not found at ${sceneJsonPath}. Run "bun autoshow comic draft-scenes ${options.scriptPath}" first.`, { stage: STAGE })
    }
    const scene: ScenePromptData = dependencies.scene ?? v.parse(ScenePromptDataSchema, JSON.parse(await Bun.file(sceneJsonPath).text()))
    const structuredScript: StructuredScriptData | undefined = dependencies.structuredScript
      ?? (existsSync(getStructuredScriptPath(options.sceneSlug)) ? await parseJsonFile(getStructuredScriptPath(options.sceneSlug), StructuredScriptDataSchema) : undefined)
    const segmentsById = new Map((structuredScript?.sourceSegments ?? []).map(segment => [segment.id, segment.text]))
    const pageQaEntries = await readPageQaEntries(options.sceneSlug, dependencies.pageQaEntries)
    const outputPath = getReviewSheetPath(options.sceneSlug)
    const reviewDirectory = getReviewDirectory(options.sceneSlug)

    const panels: ReviewSheetPanel[] = []
    for (const panel of scene.panels) {
      const svgPath = getBlockingPanelSvgPath(options.sceneSlug, panel.number)
      const imagePath = getPanelComicImagePath(options.sceneSlug, panel.number)
      const attempts = await countAttempts(options.sceneSlug, panel.number)
      panels.push({
        panelNumber: panel.number,
        description: panel.description,
        shotPlan: panel.shotPlan,
        characterKeys: [...panel.characterKeys],
        speech: panel.speech.map(item => ({ speaker: describeSpeaker(item.speaker), line: item.line })),
        sourceSegments: panel.sourceSegmentIds.map(id => ({ id, text: segmentsById.get(id) ?? 'source segment text unavailable' })),
        stageBoardSvg: existsSync(svgPath) ? inlineSvg(await Bun.file(svgPath).text()) : null,
        imagePath: existsSync(imagePath) ? normalizeProjectPath(relative(reviewDirectory, imagePath)) : null,
        qa: summarizeQa(pageQaEntries, panel.number, attempts),
      })
    }

    const partial = { sceneSlug: options.sceneSlug, sceneTitle: scene.title, panels }
    await mkdir(dirname(outputPath), { recursive: true })
    await Bun.write(outputPath, buildReviewSheetHtml(partial))
    let exportDocPath: string | null = null
    if (options.exportDoc) {
      exportDocPath = getReviewExportDocPath(options.sceneSlug)
      await Bun.write(exportDocPath, buildReviewExportDoc(partial))
    }

    comicLog.line('review-sheet generated', [
      `file=${relative(getSceneOutputDirectory(options.sceneSlug), outputPath)}`,
      `panels=${panels.length}`,
      `images=${panels.filter(panel => panel.imagePath !== null).length}`,
      `boards=${panels.filter(panel => panel.stageBoardSvg !== null).length}`,
      `qa=${pageQaEntries ? 'retained' : 'not-retained'}`,
      exportDocPath ? `exportDoc=${relative(getSceneOutputDirectory(options.sceneSlug), exportDocPath)}` : undefined,
    ].filter((part): part is string => part !== undefined))
    return { ...partial, outputPath, exportDocPath }
  } catch (error) {
    err('Review sheet generation failed:', error instanceof Error ? error.message : String(error))
    throw error
  }
}
