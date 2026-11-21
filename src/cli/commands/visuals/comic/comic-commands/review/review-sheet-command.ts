import { CLI_INVOCATION } from '~/cli/cli-invocation'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, relative } from 'node:path'
import * as v from 'valibot'
import type {
  ComicPanelSelectionRecord,
  ReviewSheetCandidate,
  ReviewSheetCommandDependencies,
  ReviewSheetCommandOptions,
  ReviewSheetPanel,
  ReviewSheetResult,
  ReviewSheetSelectionChange,
  ScenePromptData,
  StructuredScriptData,
} from '~/types'
import { ScenePromptDataSchema, StructuredScriptDataSchema } from '../../schemas/schemas'
import { createComicSourceIdentity } from '../../comic-utils/comic-audio-contracts'
import { assertSceneRunSourceOwnership } from '../../comic-utils/compatible-scene-run'
import { comicLog, err } from '../../comic-utils/comic-logger'
import { parseJsonFile } from '../../comic-utils/json-prompt-utils'
import { adoptRunCandidates, readImageRunRecord, readPanelSelections } from '../../comic-utils/panel-selection'
import { getSceneJsonPath, getSceneOutputDirectory, getStructuredScriptPath, normalizeProjectPath } from '../../comic-utils/project-paths'
import { getPanelComicImagePath } from '../../comic-utils/scene-utils'
import { getReviewDirectory, getReviewExportDocPath, getReviewSheetPath } from './review-paths'
import { readReviewRunPreview } from './review-run-preview'
import { InfraError, ValidationError } from '~/utils/error-handler'

const STAGE = 'comic:review-sheet'

type ReviewSheetContent = Omit<ReviewSheetResult, 'outputPath' | 'exportDocPath' | 'changes'>

const escapeHtml = (value: string): string => value
  .replace(/&/gu, '&amp;')
  .replace(/</gu, '&lt;')
  .replace(/>/gu, '&gt;')
  .replace(/"/gu, '&quot;')

const describeSpeaker = (speaker: ScenePromptData['panels'][number]['speech'][number]['speaker']): string =>
  speaker.kind === 'character'
    ? `${speaker.characterKey}${speaker.offscreen ? ' (offscreen)' : ''}`
    : speaker.kind === 'caption' ? 'caption' : `voice labeled ${speaker.label}`

const describeSelection = (selection: ComicPanelSelectionRecord | null): string => {
  if (!selection) return 'No panel selected yet.'
  if (selection.origin === 'legacy') return 'Existing selection (origin not recorded).'
  const how = selection.origin === 'first-generation' ? 'first generation' : 'chosen in review'
  return `Run ${selection.runId} (${selection.service}/${selection.model}), ${how}.`
}

const describeCandidate = (candidate: ReviewSheetCandidate): string => {
  switch (candidate.status) {
    case 'missing': return candidate.recordedSha256 ? 'The recorded candidate file is missing.' : 'This run has no individual image for this panel.'
    case 'invalid': return 'The recorded candidate could not be verified as a readable PNG.'
    case 'changed': return 'The candidate file differs from the run record. Restore the recorded image to use this panel.'
    case 'selected': return 'Same image as the current selection.'
    case 'alternative': return 'Alternative to the current selection.'
  }
}

const imageFigure = (path: string | null, alt: string, emptyText: string): string =>
  path ? `<img src="${escapeHtml(path)}" alt="${escapeHtml(alt)}">` : `<p class="empty">${escapeHtml(emptyText)}</p>`

export const buildReviewSheetHtml = (result: ReviewSheetContent): string => {
  const run = result.run
  const sections = result.panels.map(panel => [
    `<section class="panel" id="panel-${panel.panelNumber}">`,
    `<h2>Panel ${panel.panelNumber}</h2>`,
    '<div class="grid">',
    '<div class="art">',
    '<h3>Current selection</h3>',
    imageFigure(panel.imagePath, `Selected panel ${panel.panelNumber}`, 'No panel selected yet.'),
    `<p class="provenance">${escapeHtml(describeSelection(panel.selection))}</p>`,
    '</div>',
    ...(run && panel.candidate ? [
      '<div class="art">',
      `<h3>Run ${escapeHtml(run.runId)}</h3>`,
      ...(panel.candidate.imagePath ? [imageFigure(panel.candidate.imagePath, `Run ${run.runId} panel ${panel.panelNumber}`, '')] : []),
      `<p class="provenance">${escapeHtml(describeCandidate(panel.candidate))}</p>`,
      '</div>',
    ] : []),
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
    '<h3>Notes</h3>',
    `<textarea class="notes" data-panel="${panel.panelNumber}" rows="5" placeholder="Notes for panel ${panel.panelNumber}"></textarea>`,
    '</div>',
    '</div>',
    '</section>',
  ].join('\n'))
  const deletedCandidate = result.panels.some(({ candidate }) => candidate?.status === 'missing' && candidate.recordedSha256 !== null)
  const issues = run ? [
    run.missingPanels.length > 0 ? `${deletedCandidate ? 'Missing individual image' : 'Subset run: no individual image'} for panel(s) ${run.missingPanels.join(', ')}.` : '',
    run.changedPanels.length > 0 ? `Changed candidate files for panel(s) ${run.changedPanels.join(', ')}.` : '',
    run.invalidPanels.length > 0 ? `Unverified candidate files for panel(s) ${run.invalidPanels.join(', ')}.` : '',
  ].filter(Boolean).join(' ') : ''
  const runSummary = run ? [
    `<h2>Run ${escapeHtml(run.runId)}</h2>`,
    `<p>Model <code>${escapeHtml(run.service)}/${escapeHtml(run.model)}</code>. ${escapeHtml(issues || 'Every panel has a candidate.')} Previewing changes no selection; adopt candidates with <code>comic review &lt;script-path&gt; --run ${escapeHtml(run.runId)} --use [--panels &lt;list&gt;]</code>.</p>`,
    ...(run.pages.length > 0 ? [
      '<h3>Pages and grids</h3>',
      ...run.pages.map(page => `<figure>${imageFigure(page.imagePath, `Page ${page.pageNumber}`, page.status === 'missing' ? 'The recorded page file is missing.' : 'The recorded page could not be verified as a readable PNG.')}<figcaption>Page ${page.pageNumber}, panels ${escapeHtml(page.panelRange)} (${page.kind === 'local-grid' ? 'local grid' : 'provider page'}; not selectable as panels)</figcaption></figure>`),
    ] : []),
  ] : []
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
    '.art { flex: 1 1 18rem; min-width: 14rem; }',
    '.contract { flex: 1 1 22rem; min-width: 18rem; }',
    'img { max-width: 100%; height: auto; display: block; }',
    'figure { margin: 0 0 1rem; max-width: 40rem; }',
    '.empty, .provenance { opacity: 0.7; font-style: italic; }',
    'textarea.notes { width: 100%; font: inherit; }',
    'pre#collected { white-space: pre-wrap; border: 1px solid currentColor; padding: 0.75rem; }',
    '</style>',
    '</head>',
    '<body>',
    `<h1>Review sheet: ${escapeHtml(result.sceneTitle)}</h1>`,
    `<p>Scene <code>${escapeHtml(result.sceneSlug)}</code>. ${result.panels.length} panels. This page makes no network request and changes no selection; it is a static reading and note-taking surface.</p>`,
    ...runSummary,
    '<p>Type notes below each panel, then press Collect notes to build a <code>### Panel NN</code> Markdown block to keep with your revision notes.</p>',
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

export const buildReviewExportDoc = (result: ReviewSheetContent): string => [
  `# ${result.sceneTitle} panel export`,
  '',
  `Scene \`${result.sceneSlug}\`. One heading per panel; write notes in the blank paragraph after each image so every note maps to its panel number.${result.run ? ` Candidates from run \`${result.run.runId}\` follow each current selection.` : ''}`,
  '',
  ...result.panels.flatMap(panel => [
    `### Panel ${panel.panelNumber}`,
    '',
    panel.imagePath ? `![Panel ${panel.panelNumber}](${panel.imagePath})` : `_No panel is selected for panel ${panel.panelNumber}._`,
    '',
    ...(result.run && panel.candidate ? [
      panel.candidate.imagePath
        ? `![Run ${result.run.runId} panel ${panel.panelNumber}](${panel.candidate.imagePath})`
        : `_Run \`${result.run.runId}\`. ${describeCandidate(panel.candidate)}_`,
      '',
    ] : []),
    '',
  ]),
].join('\n')

const assertSelectionOptions = (options: ReviewSheetCommandOptions): void => {
  if (options.use && !options.run) throw ValidationError('--use requires --run <image-run-id>; nothing was changed.', { stage: STAGE })
  if (options.panels !== undefined && !options.use) throw ValidationError('--panels chooses the panels to adopt and requires --run <image-run-id> --use.', { stage: STAGE })
}

const reportChanges = (changes: ReviewSheetSelectionChange[], runId: string): void => {
  for (const change of changes) {
    comicLog.line(change.changed ? `Panel ${change.panelNumber} selected from run ${runId}` : `Panel ${change.panelNumber} already uses run ${runId}`, [
      change.previous ? `previous=${change.previous.origin === 'legacy' ? 'legacy' : change.previous.runId}` : 'previous=none',
      `model=${change.current.model}`,
      `sha256=${change.current.sha256.slice(0, 12)}`,
    ])
  }
}

export const reviewSheetCommand = async (
  options: ReviewSheetCommandOptions,
  dependencies: ReviewSheetCommandDependencies = {},
): Promise<ReviewSheetResult> => {
  try {
    assertSelectionOptions(options)
    const sceneJsonPath = getSceneJsonPath(options.sceneSlug)
    if (!dependencies.scene && !existsSync(sceneJsonPath)) {
      throw InfraError(`Scene JSON not found at ${sceneJsonPath}. Run "${CLI_INVOCATION} comic draft-scenes ${options.scriptPath}" first.`, { stage: STAGE })
    }
    const scene: ScenePromptData = dependencies.scene ?? v.parse(ScenePromptDataSchema, JSON.parse(await Bun.file(sceneJsonPath).text()))
    const structuredScript: StructuredScriptData | undefined = dependencies.structuredScript
      ?? (existsSync(getStructuredScriptPath(options.sceneSlug)) ? await parseJsonFile(getStructuredScriptPath(options.sceneSlug), StructuredScriptDataSchema) : undefined)
    const segmentsById = new Map((structuredScript?.sourceSegments ?? []).map(segment => [segment.id, segment.text]))
    const sceneDirectory = getSceneOutputDirectory(options.sceneSlug)
    const outputPath = getReviewSheetPath(options.sceneSlug)
    const reviewDirectory = getReviewDirectory(options.sceneSlug)

    if (options.use) {
      const sourceBytes = new Uint8Array(await Bun.file(options.scriptPath).arrayBuffer())
      await assertSceneRunSourceOwnership(sceneDirectory, await createComicSourceIdentity(options.scriptPath, sourceBytes), { requireExisting: true })
    }
    const record = options.run ? await readImageRunRecord(options.sceneSlug, options.run) : undefined
    let changes: ReviewSheetSelectionChange[] = []
    if (record && options.use) {
      const before = await readPanelSelections(options.sceneSlug)
      const adopted = await adoptRunCandidates({ sceneSlug: options.sceneSlug, runId: record.runId, ...(options.panels !== undefined ? { panels: options.panels } : {}) })
      changes = adopted.map(current => {
        const previous = before.get(current.panelNumber) ?? null
        return { panelNumber: current.panelNumber, previous, current, changed: previous?.sha256 !== current.sha256 || previous.runId !== current.runId }
      })
      reportChanges(changes, record.runId)
    }
    const selections = await readPanelSelections(options.sceneSlug)
    const preview = record ? await readReviewRunPreview(record, scene.panels.map(panel => panel.number), selections, sceneDirectory, reviewDirectory) : null
    const run = preview?.run ?? null

    const panels: ReviewSheetPanel[] = scene.panels.map(panel => {
      const imagePath = getPanelComicImagePath(options.sceneSlug, panel.number)
      const selection = selections.get(panel.number) ?? null
      return {
        panelNumber: panel.number,
        description: panel.description,
        shotPlan: panel.shotPlan,
        characterKeys: [...panel.characterKeys],
        speech: panel.speech.map(item => ({ speaker: describeSpeaker(item.speaker), line: item.line })),
        sourceSegments: panel.sourceSegmentIds.map(id => ({ id, text: segmentsById.get(id) ?? 'source segment text unavailable' })),
        imagePath: existsSync(imagePath) ? normalizeProjectPath(relative(reviewDirectory, imagePath)) : null,
        selection,
        candidate: preview?.candidates.get(panel.number) ?? null,
      }
    })

    const content: ReviewSheetContent = { sceneSlug: options.sceneSlug, sceneTitle: scene.title, panels, run }
    await mkdir(dirname(outputPath), { recursive: true })
    await Bun.write(outputPath, buildReviewSheetHtml(content))
    let exportDocPath: string | null = null
    if (options.exportDoc) {
      exportDocPath = getReviewExportDocPath(options.sceneSlug)
      await Bun.write(exportDocPath, buildReviewExportDoc(content))
    }

    comicLog.line('review-sheet generated', [
      `file=${relative(sceneDirectory, outputPath)}`,
      `panels=${panels.length}`,
      `selected=${panels.filter(panel => panel.imagePath !== null).length}`,
      run ? `run=${run.runId}` : undefined,
      run && run.missingPanels.length > 0 ? `missing=${run.missingPanels.join(',')}` : undefined,
      run && run.changedPanels.length > 0 ? `changedCandidates=${run.changedPanels.join(',')}` : undefined,
      run && run.invalidPanels.length > 0 ? `invalidCandidates=${run.invalidPanels.join(',')}` : undefined,
      run && run.pages.length > 0 ? `pages=${run.pages.map(page => page.panelRange).join(',')}` : undefined,
      options.use ? `changed=${changes.filter(change => change.changed).length}` : undefined,
      exportDocPath ? `exportDoc=${relative(sceneDirectory, exportDocPath)}` : undefined,
    ].filter((part): part is string => part !== undefined))
    return { ...content, outputPath, exportDocPath, changes }
  } catch (error) {
    err('Review sheet generation failed:', error instanceof Error ? error.message : String(error))
    throw error
  }
}
