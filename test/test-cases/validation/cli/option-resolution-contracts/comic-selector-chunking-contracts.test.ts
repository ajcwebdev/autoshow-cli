import { describe,expect,test } from 'bun:test'
import { mkdir,rm,writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
chunkComicGridPanels,
chunkComicPagePanels,
DEFAULT_SKETCH_PANELS_PER_IMAGE,
panelSelectionToSketchRange,
parsePanelSelector,
selectComicPanels
} from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/comic-page-utils'
import {
resolveSketchChunks,
selectSketchPanelRange
} from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-sketches/generate-scene-sketches'
import {
coerceAndValidateDraftScenes,
coerceAndValidateGenerateImages
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/cli-args'
import {
resolveComicScriptReference
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/project-paths'
import {
draftScenesCommandDefinition,
generateAudioCommandDefinition,
generateImagesCommandDefinition,
generateSlideshowCommandDefinition,
referenceSketchCommandDefinition
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/subcommand-help'
import { GLOBAL_FLAG_DEFINITIONS } from '~/cli/global-flags'
import { parseCommandInvocation } from '~/cli/native/native-parser'
import { makeTempDir } from '../../../../test-utils/temp-dirs'

const parseSubcommandArgs = (args: string[], command: typeof draftScenesCommandDefinition | typeof generateImagesCommandDefinition | typeof generateAudioCommandDefinition | typeof generateSlideshowCommandDefinition | typeof referenceSketchCommandDefinition) =>
  parseCommandInvocation([command.name, ...args], command, GLOBAL_FLAG_DEFINITIONS)

const parseDraftScenesArgs = (args: string[]) =>
  coerceAndValidateDraftScenes(parseSubcommandArgs(args, draftScenesCommandDefinition))

const parseGenerateImagesArgs = (args: string[]) =>
  coerceAndValidateGenerateImages(parseSubcommandArgs(args, generateImagesCommandDefinition))

describe('option resolution contracts', () => {

  test('comic script shorthand resolves only strict NN-SC references', async () => {
      const tempDir = await makeTempDir('autoshow-comic-script-ref-')
      const episodeDir = join(tempDir, '02-script')
      const fullPath = 'input/scripts/02-script/01-co-work-smarter.md'

      try {
        await mkdir(episodeDir, { recursive: true })
        await writeFile(join(episodeDir, '01-co-work-smarter.md'), '# Co-Work Smarter\n')

        expect(parseDraftScenesArgs(['02-01']).scriptPath).toBe('02-01')
        expect(parseGenerateImagesArgs(['02-01']).scriptPath).toBe('02-01')
        await expect(resolveComicScriptReference('02-01', { episodeScriptsRoot: tempDir }))
          .resolves.toBe(join(episodeDir, '01-co-work-smarter.md'))
        await expect(resolveComicScriptReference(fullPath, { episodeScriptsRoot: tempDir }))
          .resolves.toBe(fullPath)
        await expect(resolveComicScriptReference('2-1', { episodeScriptsRoot: tempDir }))
          .resolves.toBe('2-1')
        await expect(resolveComicScriptReference('02-02', { episodeScriptsRoot: tempDir }))
          .rejects.toThrow('Comic script shorthand "02-02" could not be resolved')

        await writeFile(join(episodeDir, '01-alt.md'), '# Alternate Scene\n')

        await expect(resolveComicScriptReference('02-01', { episodeScriptsRoot: tempDir }))
          .rejects.toThrow('Expected exactly one Markdown file')
      } finally {
        await rm(tempDir, { recursive: true, force: true })
      }
    })

  test('comic panel selectors dedupe, sort, and chunk page groups', () => {
      expect(parsePanelSelector('all')).toBe('all')
      expect(parsePanelSelector('3,1,3,2-4')).toEqual([1, 2, 3, 4])

      const selected = selectComicPanels(
        [1, 2, 3, 4, 5].map(panelNumber => ({ panelNumber })),
        parsePanelSelector('1-4'),
        undefined,
        'ep02/scene'
      )
      const chunks = chunkComicPagePanels(selected, 2)

      expect(selected.map(panel => panel.panelNumber)).toEqual([1, 2, 3, 4])
      expect(chunks.map(chunk => ({
        pageNumber: chunk.pageNumber,
        panelNumbers: chunk.panelNumbers
      }))).toEqual([
        { pageNumber: 1, panelNumbers: [1, 2] },
        { pageNumber: 2, panelNumbers: [3, 4] }
      ])
    })

  test('comic grid chunks preserve selected panel order and full grid capacity', () => {
      const grid = { columns: 2, rows: 3 }
      const exact = chunkComicGridPanels(
        Array.from({ length: 6 }, (_, index) => ({ panelNumber: index + 1 })),
        grid
      )
      const fewer = chunkComicGridPanels(
        [1, 2, 3, 4].map(panelNumber => ({ panelNumber })),
        grid
      )
      const more = chunkComicGridPanels(
        Array.from({ length: 8 }, (_, index) => ({ panelNumber: index + 1 })),
        grid
      )
      const nonContiguous = chunkComicGridPanels(
        [1, 3, 7, 9, 11, 13, 15].map(panelNumber => ({ panelNumber })),
        grid
      )

      expect(exact.map(chunk => chunk.panelNumbers)).toEqual([[1, 2, 3, 4, 5, 6]])
      expect(fewer.map(chunk => chunk.panelNumbers)).toEqual([[1, 2, 3, 4]])
      expect(more.map(chunk => chunk.panelNumbers)).toEqual([[1, 2, 3, 4, 5, 6], [7, 8]])
      expect(nonContiguous.map(chunk => ({
        pageNumber: chunk.pageNumber,
        panelNumbers: chunk.panelNumbers,
      }))).toEqual([
        { pageNumber: 1, panelNumbers: [1, 3, 7, 9, 11, 13] },
        { pageNumber: 2, panelNumbers: [15] },
      ])
    })

  test('comic sketch chunks default to six panels per image', () => {
      const panels = Array.from({ length: 13 }, (_, index) => ({ panelNumber: index + 1 }))
      const defaultChunks = resolveSketchChunks(panels, {}, 'ep02/scene')
      const selectedChunks = resolveSketchChunks(
        panels,
        {
          sketchPanels: { startPanelNumber: 1, endPanelNumber: 12 },
          panelsPerImage: DEFAULT_SKETCH_PANELS_PER_IMAGE,
        },
        'ep02/scene'
      )

      expect(defaultChunks.selectedChunks.map(chunk => [
        chunk.startPanelNumber,
        chunk.endPanelNumber
      ])).toEqual([
        [1, 6],
        [7, 12],
        [13, 13],
      ])
      expect(selectedChunks.selectedChunks.map(chunk => [
        chunk.startPanelNumber,
        chunk.endPanelNumber
      ])).toEqual([
        [1, 6],
        [7, 12],
      ])
    })

  test('comic panel selectors clamp overlong contiguous ranges to available overlap', () => {
      const panels = Array.from({ length: 11 }, (_, index) => ({ panelNumber: index + 1 }))

      const selected = selectComicPanels(
        panels,
        parsePanelSelector('9-16'),
        undefined,
        'ep02/scene'
      )
      const sketchChunk = selectSketchPanelRange(
        panels,
        { startPanelNumber: 9, endPanelNumber: 16 },
        'ep02/scene'
      )

      expect(selected.map(panel => panel.panelNumber)).toEqual([9, 10, 11])
      expect(sketchChunk.startPanelNumber).toBe(9)
      expect(sketchChunk.endPanelNumber).toBe(11)
      expect(sketchChunk.panels.map(panel => panel.panelNumber)).toEqual([9, 10, 11])
    })

  test('comic panel selectors reject no-overlap and non-contiguous missing selections', () => {
      const panels = Array.from({ length: 11 }, (_, index) => ({ panelNumber: index + 1 }))
      const gappedPanels = [1, 2, 4, 5].map(panelNumber => ({ panelNumber }))

      expect(() => selectComicPanels(
        panels,
        parsePanelSelector('12-16'),
        undefined,
        'ep02/scene'
      )).toThrow('Selected panels 12, 13, 14, 15, 16 were not found')
      expect(() => selectComicPanels(
        gappedPanels,
        parsePanelSelector('1-5'),
        undefined,
        'ep02/scene'
      )).toThrow('Selected panel 3 was not found')
      expect(() => selectComicPanels(
        panels,
        parsePanelSelector('1,99'),
        undefined,
        'ep02/scene'
      )).toThrow('Selected panel 99 was not found')
      expect(() => selectSketchPanelRange(
        gappedPanels,
        { startPanelNumber: 1, endPanelNumber: 5 },
        'ep02/scene'
      )).toThrow('Sketch panel range "1-5" was not found')
      expect(() => selectSketchPanelRange(
        panels,
        { startPanelNumber: 12, endPanelNumber: 16 },
        'ep02/scene'
      )).toThrow('Sketch panel range "12-16" was not found')
      expect(() => panelSelectionToSketchRange(parsePanelSelector('1,99'))).toThrow(
        'Sketch panel selection must be contiguous'
      )
    })
})
