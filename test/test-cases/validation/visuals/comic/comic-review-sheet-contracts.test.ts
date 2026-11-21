import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { deflateSync } from 'node:zlib'
import { configureOutputRoot } from '~/cli/commands/command-shared/output-root'
import { reviewSheetCommand } from '~/cli/commands/visuals/comic/comic-commands/review/review-sheet-command'
import { getReviewExportDocPath, getReviewSheetPath } from '~/cli/commands/visuals/comic/comic-commands/review/review-paths'
import { adoptRunCandidates, publishFirstPanelSelection, recordImageRunCandidates } from '~/cli/commands/visuals/comic/comic-utils/panel-selection'
import { beginSceneRun, resetSceneRunContext } from '~/cli/commands/visuals/comic/comic-utils/scene-run-context'
import { makeTempDir } from '../../../../test-utils/temp-dirs'
import { makeTestPng, pngChunk, SELECTION_SCENE_SLUG, SELECTION_SCRIPT_PATH, sha256Hex, snapshotSelectionState, writeRunCandidate, writeSelectionSceneInputs } from './comic-panel-selection-fixtures'

const temporaryDirectories: string[] = []
const SLUG = SELECTION_SCENE_SLUG

afterEach(async () => {
  resetSceneRunContext()
  configureOutputRoot('./output')
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

const prepare = async (options: { selectedPanels?: number[] } = {}) => {
  const workspace = await makeTempDir('autoshow-review-sheet-')
  temporaryDirectories.push(workspace)
  beginSceneRun(SLUG, { outputDir: workspace })
  await writeSelectionSceneInputs(workspace, 6)
  for (const panelNumber of options.selectedPanels ?? []) {
    const candidatePath = await writeRunCandidate(workspace, 'run-a', panelNumber, makeTestPng({ seed: panelNumber }))
    await publishFirstPanelSelection({ sceneSlug: SLUG, runId: 'run-a', service: 'openai', model: 'gpt-image-2.6-flare', panelNumber, candidatePath })
  }
  return { workspace }
}

describe('comic review sheet', () => {
  test('renders one section per panel with the contract, source segments, current selection and provenance, offline', async () => {
    await prepare({ selectedPanels: [1] })
    const result = await reviewSheetCommand({ scriptPath: SELECTION_SCRIPT_PATH, sceneSlug: SLUG })
    expect(result.outputPath).toBe(getReviewSheetPath(SLUG))
    expect(result.exportDocPath).toBeNull()
    expect(result.run).toBeNull()
    expect(result.changes).toEqual([])
    const html = await Bun.file(result.outputPath).text()
    for (const panelNumber of [1, 2, 3, 4, 5, 6]) expect(html).toContain(`<h2>Panel ${panelNumber}</h2>`)
    expect(html).toContain('<strong>Description:</strong> Authored staging 1.')
    expect(html).toContain('<strong>Shot plan:</strong> Medium eye-level shot 1;')
    expect(html).toContain('<code>beat-0001</code> Beat 1 happens in the cargo bay.')
    expect(html).toContain('<img src="../../panels/panel-01.png"')
    expect(html).toContain('Run run-a (openai/gpt-image-2.6-flare), first generation.')
    expect(html).toContain('No panel selected yet.')
    expect(html).toContain('<textarea class="notes" data-panel="1"')
    expect(html).not.toContain('QA')
    expect(html).not.toContain('stage board')
    expect(html).not.toMatch(/src="https?:\/\//u)
    expect(html).not.toContain('<link ')
    expect(html).not.toContain('cdn')
  })

  test('--export-doc writes one heading and image line per panel with a blank paragraph after each image', async () => {
    await prepare({ selectedPanels: [1] })
    const result = await reviewSheetCommand({ scriptPath: 'script.md', sceneSlug: SLUG, exportDoc: true })
    expect(result.exportDocPath).toBe(getReviewExportDocPath(SLUG))
    const markdown = await Bun.file(result.exportDocPath!).text()
    const headings = [...markdown.matchAll(/^### Panel (\d+)$/gmu)].map(match => Number(match[1]))
    expect(headings).toEqual([1, 2, 3, 4, 5, 6])
    expect(markdown).toContain('![Panel 1](../../panels/panel-01.png)\n\n\n')
    expect(markdown).toContain('_No panel is selected for panel 2._\n\n\n')
  })

  test('a legacy canonical panel without a selection record is shown with an unrecorded origin', async () => {
    const { workspace } = await prepare()
    await mkdir(join(workspace, 'panels'), { recursive: true })
    await writeFile(join(workspace, 'panels', 'panel-02.png'), makeTestPng({ seed: 2 }))
    const result = await reviewSheetCommand({ scriptPath: 'script.md', sceneSlug: SLUG })
    expect(result.panels[1]?.selection).toMatchObject({ origin: 'legacy' })
    expect(await Bun.file(result.outputPath).text()).toContain('Existing selection (origin not recorded).')
  })

  test('previews a historical run containing only a single-panel page', async () => {
    const { workspace } = await prepare()
    const pages = join(workspace, 'pages', 'historical', 'gpt-image-2.6-flare')
    await mkdir(pages, { recursive: true })
    await writeFile(join(pages, 'page-02-panels-03.png'), makeTestPng({ seed: 3 }))
    const result = await reviewSheetCommand({ scriptPath: SELECTION_SCRIPT_PATH, sceneSlug: SLUG, run: 'historical' })
    expect(result.run?.pages).toMatchObject([{ pageNumber: 2, panelNumbers: [3] }])
  })

  test('--run previews a subset run beside the selection, marks missing panels and lists pages and grids with their ranges', async () => {
    const { workspace } = await prepare({ selectedPanels: [1, 2, 3, 4, 5, 6] })
    const candidate = await writeRunCandidate(workspace, 'run-b', 3, makeTestPng({ seed: 103 }))
    await mkdir(join(workspace, 'pages', 'run-b'), { recursive: true })
    await writeFile(join(workspace, 'pages', 'run-b', 'page-01-panels-01-02.png'), makeTestPng({ seed: 200 }))
    await publishFirstPanelSelection({ sceneSlug: SLUG, runId: 'run-b', service: 'openai', model: 'gpt-image-2.6-flare', panelNumber: 3, candidatePath: candidate })
    await recordImageRunCandidates(SLUG, { runId: 'run-b', service: 'openai', model: 'gpt-image-2.6-flare', panels: [], pages: [{ pageNumber: 1, panelNumbers: [1, 2], candidatePath: 'pages/run-b/page-01-panels-01-02.png', kind: 'local-grid' }], createdAt: new Date().toISOString() })
    const result = await reviewSheetCommand({ scriptPath: 'script.md', sceneSlug: SLUG, run: 'run-b' })
    expect(result.run).toMatchObject({ runId: 'run-b', service: 'openai', model: 'gpt-image-2.6-flare', missingPanels: [1, 2, 4, 5, 6], pages: [{ pageNumber: 1, panelNumbers: [1, 2], panelRange: '1-2', kind: 'local-grid', imagePath: '../../pages/run-b/page-01-panels-01-02.png' }] })
    expect(result.panels.map(panel => panel.candidate?.status)).toEqual(['missing', 'missing', 'alternative', 'missing', 'missing', 'missing'])
    expect(result.panels[2]?.candidate?.imagePath).toBe('../../panels/run-b/panel-03.png')
    const html = await Bun.file(result.outputPath).text()
    expect(html).toContain('Subset run: no individual image for panel(s) 1, 2, 4, 5, 6.')
    expect(html).toContain('Page 1, panels 1-2 (local grid; not selectable as panels)')
    expect(html).toContain('This run has no individual image for this panel.')
    expect(html).toContain('Alternative to the current selection.')
  })

  test('ordinary review, --export-doc and --run previews leave panels/ and metadata/panel-selections.json byte-identical', async () => {
    const { workspace } = await prepare({ selectedPanels: [1, 2, 3, 4, 5, 6] })
    const candidate = await writeRunCandidate(workspace, 'run-b', 3, makeTestPng({ seed: 103 }))
    await publishFirstPanelSelection({ sceneSlug: SLUG, runId: 'run-b', service: 'openai', model: 'gpt-image-2.6-flare', panelNumber: 3, candidatePath: candidate })
    const before = await snapshotSelectionState(workspace)
    expect(Object.keys(before)).toContain('metadata/panel-selections.json')
    await reviewSheetCommand({ scriptPath: 'script.md', sceneSlug: SLUG })
    await reviewSheetCommand({ scriptPath: 'script.md', sceneSlug: SLUG, exportDoc: true })
    await reviewSheetCommand({ scriptPath: 'script.md', sceneSlug: SLUG, run: 'run-b' })
    await reviewSheetCommand({ scriptPath: 'script.md', sceneSlug: SLUG, run: 'run-b', exportDoc: true })
    await reviewSheetCommand({ scriptPath: 'script.md', sceneSlug: SLUG, run: 'run-a', exportDoc: true })
    expect(await snapshotSelectionState(workspace)).toEqual(before)
  })

  test('run preview reports deleted, replaced and undecodable candidates without relabeling or adopting their bytes', async () => {
    const { workspace } = await prepare({ selectedPanels: [1, 2, 3, 4, 5, 6] })
    const replacement = makeTestPng({ seed: 42 })
    await rm(join(workspace, 'panels/run-a/panel-01.png'))
    await writeRunCandidate(workspace, 'run-a', 2, replacement)
    await writeRunCandidate(workspace, 'run-a', 3, makeTestPng({ seed: 3 }).subarray(0, -12))
    const before = await snapshotSelectionState(workspace)

    const preview = await reviewSheetCommand({ scriptPath: SELECTION_SCRIPT_PATH, sceneSlug: SLUG, run: 'run-a', exportDoc: true })
    expect(preview.run).toMatchObject({ missingPanels: [1], changedPanels: [2], invalidPanels: [3] })
    expect(preview.panels.map(panel => panel.candidate?.status)).toEqual(['missing', 'changed', 'invalid', 'selected', 'selected', 'selected'])
    expect(preview.panels[1]?.candidate).toMatchObject({ sha256: sha256Hex(replacement), recordedSha256: sha256Hex(makeTestPng({ seed: 2 })), width: 8, height: 6 })
    const html = await Bun.file(preview.outputPath).text()
    const markdown = await Bun.file(preview.exportDocPath!).text()
    for (const document of [html, markdown]) {
      expect(document).toContain('The recorded candidate file is missing.')
      expect(document).toContain('The candidate file differs from the run record.')
      expect(document).toContain('The recorded candidate could not be verified as a readable PNG.')
      for (const number of [1, 2, 3]) expect(document).not.toContain(`../../panels/run-a/panel-0${number}.png`)
      expect(document).toContain('../../panels/run-a/panel-04.png')
    }
    expect(preview.changes).toEqual([])
    expect(await snapshotSelectionState(workspace)).toEqual(before)
    await expect(adoptRunCandidates({ sceneSlug: SLUG, runId: 'run-a', panels: [2] })).rejects.toThrow('stale hash')
    expect(await snapshotSelectionState(workspace)).toEqual(before)
  })

  test('run preview accepts a large local grid and drops its link if PNG framing is later damaged', async () => {
    const { workspace } = await prepare()
    const panelNumbers = [1, 2, 3, 4, 5, 6]
    const candidatePath = 'pages/run-grid/page-01-panels-01-06.png'
    await mkdir(join(workspace, 'pages/run-grid'), { recursive: true })
    // A legal 1-bit grayscale 8x6 landscape grid exceeds the 64 Mi pixel single-panel decode bound.
    const width = 8 * 1536, height = 6 * 1024
    const header = Buffer.alloc(13)
    header.writeUInt32BE(width)
    header.writeUInt32BE(height, 4)
    header[8] = 1
    const scanlines = Buffer.alloc((1 + width / 8) * height)
    const grid = Buffer.concat([makeTestPng().subarray(0, 8), pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(scanlines)), pngChunk('IEND', Buffer.alloc(0))])
    await writeFile(join(workspace, candidatePath), grid)
    await recordImageRunCandidates(SLUG, {
      runId: 'run-grid', service: 'openai', model: 'gpt-image-2.6-flare', panels: [], createdAt: new Date().toISOString(),
      pages: [{ pageNumber: 1, panelNumbers, candidatePath, kind: 'local-grid' }],
    })
    const options = { scriptPath: SELECTION_SCRIPT_PATH, sceneSlug: SLUG, run: 'run-grid' }
    const healthy = await reviewSheetCommand(options)
    expect(healthy.run?.pages[0]).toMatchObject({ status: 'available', imagePath: `../../${candidatePath}` })
    await writeFile(join(workspace, candidatePath), grid.subarray(0, -12))
    const damaged = await reviewSheetCommand(options)
    expect(damaged.run?.pages[0]).toMatchObject({ status: 'invalid', imagePath: null })
    expect(await Bun.file(damaged.outputPath).text()).not.toContain(candidatePath)
  })

  test('--use without --run and --panels without --use are rejected before any write', async () => {
    const { workspace } = await prepare({ selectedPanels: [1] })
    const before = await snapshotSelectionState(workspace)
    await expect(reviewSheetCommand({ scriptPath: 'script.md', sceneSlug: SLUG, use: true })).rejects.toThrow('--use requires --run')
    await expect(reviewSheetCommand({ scriptPath: 'script.md', sceneSlug: SLUG, run: 'run-a', panels: [1] })).rejects.toThrow('--panels chooses the panels to adopt')
    await expect(reviewSheetCommand({ scriptPath: 'script.md', sceneSlug: SLUG, run: 'run-missing' })).rejects.toThrow('Unknown image run')
    expect(await snapshotSelectionState(workspace)).toEqual(before)
    expect(await Bun.file(getReviewSheetPath(SLUG)).exists()).toBe(false)
  })
})
