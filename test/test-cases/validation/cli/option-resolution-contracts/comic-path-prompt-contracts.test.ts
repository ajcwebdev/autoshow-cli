import { describe,expect,test } from 'bun:test'
import { join } from 'node:path'
import {
buildComicPagePrompt,
buildComicPagePromptData
} from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/comic-page-utils'
import { applyImagePromptVariation } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/prompt-variations'
import {
buildSketchPrompt
} from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-sketches/generate-scene-sketches'
import {
getSceneOutputDirectory
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/project-paths'
import {
getPageComicImageFilename,
getPageComicImagePath,
getPanelComicImagePath
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/scene-utils'
import type { PanelBundleData,PromptsConfig } from '~/types'

const engineeringBayLocation = { key: 'engineering-bay', raw: 'INT. ENGINEERING BAY' }

describe('option resolution contracts', () => {

  test('comic page image filenames preserve contiguous and non-contiguous panel labels', () => {
      expect(getPageComicImageFilename(1, [1, 2, 3, 4])).toBe('page-01-panels-01-04.png')
      expect(getPageComicImageFilename(2, [5, 6, 7, 8])).toBe('page-02-panels-05-08.png')
      expect(getPageComicImageFilename(1, [1, 3, 7])).toBe('page-01-panels-01_03_07.png')
    })

  test('comic final image paths nest under the resolved run directory; variations add prefixes', () => {
      const base = getSceneOutputDirectory('scene-one')
      expect(getPanelComicImagePath('scene-one', 1)).toBe(join(base, 'panels', 'panel-01.png'))
      expect(getPanelComicImagePath('scene-one', 1, 'gpt-image-2')).toBe(join(base, 'panels', 'gpt-image-2', 'panel-01.png'))
      expect(getPanelComicImagePath('scene-one', 1, 'gpt-image-2', 'animation-polish')).toBe(join(base, 'panels', 'animation-polish', 'gpt-image-2', 'panel-01.png'))
      expect(getPageComicImagePath('scene-one', 1, [1, 2], 'gpt-image-2', 'cinematic-depth')).toBe(join(base, 'pages', 'cinematic-depth', 'gpt-image-2', 'page-01-panels-01-02.png'))
    })

  test('comic final image prompt variations apply only non-canonical prompt prefixes', () => {
      const prompts = {
        'Image Prompt Variations': {
          'animation-polish': 'Production animation instruction.',
          'cinematic-depth': 'Cinematic depth instruction.',
        },
      } as unknown as PromptsConfig
      const basePrompt = 'Base final prompt.'

      expect(applyImagePromptVariation(basePrompt, 'canonical', prompts)).toBe(basePrompt)

      const animationPrompt = applyImagePromptVariation(basePrompt, 'animation-polish', prompts)
      const cinematicPrompt = applyImagePromptVariation(basePrompt, 'cinematic-depth', prompts)

      expect(animationPrompt.startsWith('Production animation instruction.')).toBe(true)
      expect(cinematicPrompt.startsWith('Cinematic depth instruction.')).toBe(true)
      expect(animationPrompt).toContain(`\n\n${basePrompt}`)
      expect(cinematicPrompt).toContain(`\n\n${basePrompt}`)
      expect(animationPrompt).not.toBe(cinematicPrompt)
    })

  test('comic final page prompt preserves panel order and speech text', () => {
      const promptData = buildComicPagePromptData([
        {
          schemaVersion: 4,
          snapshotId: 'test-snapshot',
          title: 'Co-Work Smarter',
          location: 'Engineering Bay',
          panels: [{
            number: 1,
            description: 'Commander points at the dashboard.',
            shotPlan: 'Medium eye-level shot; Commander stands screen left and points right.',
            characterKeys: ['commander'],
            speech: [{ speaker: { kind: 'character', characterKey: 'commander', offscreen: false }, line: 'We need the exact text.', tone: 'firm' }],
            sourceSegmentIds: ['beat-0001'],
            sourceSegments: [{
              id: 'beat-0001',
              type: 'dialogue',
              text: 'We need the exact text.',
              sourceSpans: [],
              beatIndex: 1,
              speakerKey: 'commander',
              speakerLabel: 'COMMANDER',
              location: engineeringBayLocation,
            }],
            locationKey: 'engineering-bay',
            locationSnapshotId: 'test-location',
          }]
        },
        {
          schemaVersion: 4,
          snapshotId: 'test-snapshot',
          title: 'Co-Work Smarter',
          location: 'Engineering Bay',
          panels: [{
            number: 3,
            description: 'Engineer nods.',
            shotPlan: 'Close shot from screen right; Engineer faces left and nods.',
            characterKeys: ['engineer'],
            speech: [{ speaker: { kind: 'character', characterKey: 'engineer', offscreen: false }, line: 'Then do not rewrite it.', tone: 'dry' }],
            sourceSegmentIds: ['beat-0002'],
            sourceSegments: [{
              id: 'beat-0002',
              type: 'dialogue',
              text: 'Then do not rewrite it.',
              sourceSpans: [],
              beatIndex: 2,
              speakerKey: 'engineer',
              speakerLabel: 'ENGINEER',
              location: engineeringBayLocation,
            }],
            locationKey: 'engineering-bay',
            locationSnapshotId: 'test-location',
          }]
        }
      ])
      const prompt = buildComicPagePrompt(promptData, [
        { key: 'commander', referenceIndex: 1, description: 'Peach-colored captain with a blue uniform.' },
        { key: 'engineer', referenceIndex: 2, description: 'Tall engineer with a red visor.' },
      ])

      expect(promptData.panels.map(panel => panel.number)).toEqual([1, 3])
      expect(prompt).toContain('Render exactly 2 sub-panels')
      expect(prompt).toContain('immutable canonical location reference')
      expect(prompt).toContain('persistent world-space geometry')
      expect(prompt).toContain('The `characterKeys` array in each source panel is exact and authoritative')
      expect(prompt).toContain('highest visual precedence for identity, physical embodiment, projection/display medium')
      expect(prompt).toContain('interface, screen, monitor, avatar, or body is never permission')
      expect(prompt).toContain('Never carry a character forward from')
      expect(prompt).toContain('Preserve location topology, not a frozen composition')
      expect(prompt).toContain('If the composition reveals an anchor\'s canonical part of the set, render that anchor there')
      expect(prompt).toContain('Treat every named fixed anchor as a presence-and-geometry requirement')
      expect(prompt).toContain('Preserve fixed furniture footprint, silhouette, connectedness, orientation, edge count, and relationship to walls')
      expect(prompt).toContain('foreground placement caused by a new camera is allowed, physical relocation is not')
      expect(prompt).toContain('Create shot diversity through camera distance, elevation, lens feel, foreground/background layering, pose, expression, eyeline, and selective cropping while staying on the declared side of the axis of action.')
      expect(prompt).not.toContain('camera side')
      expect(prompt).not.toContain('character blocking')
      expect(prompt).not.toContain('Where the prose shot plan and the ledger disagree')
      expect(prompt).not.toContain('Blocking ledger')
      expect(prompt).not.toContain('Source Segments')
      expect(prompt).not.toContain('"sourceSegments"')
      expect(prompt).toContain('Do not flatten a sequence into repeated near-identical compositions')
      expect(prompt).toContain('Exhaustive prose shot plan')
      expect(prompt).toContain('Reference 1: characterKey=commander; catalog appearance=Peach-colored captain')
      expect(prompt).toContain('Reference 2: characterKey=engineer; catalog appearance=Tall engineer')
      expect(prompt).toContain('Exact required visible characters: commander')
      expect(prompt).toContain('Referenced characters forbidden from this sub-panel: engineer')
      expect(prompt).toContain('Bubble tail must visibly point to commander')
      expect(prompt).toContain('Never substitute one referenced identity for another')
      expect(prompt).toContain('Never copy a character key, filename, reference-sheet label')
      expect(prompt).toContain('strict left-to-right two-panel layout')
      expect(prompt).toContain('We need the exact text.')
      expect(prompt).toContain('Then do not rewrite it.')
      expect(prompt.indexOf('"number": 1')).toBeLessThan(prompt.indexOf('"number": 3'))
    })

  test('comic sketch prompt asks for numeric panel labels only', () => {
      const promptData: PanelBundleData = {
        schemaVersion: 4,
        snapshotId: 'test-snapshot',
        title: 'Mechanic Repairs Everything',
        location: 'Engineering Bay',
        panels: [{
          number: 4,
          description: 'Mechanic kicks the laser cutter panel as steam escapes.',
          shotPlan: 'Wide shot; Mechanic stands screen right and kicks the panel.',
          characterKeys: [],
          speech: [{ speaker: { kind: 'character', characterKey: 'mechanic', offscreen: false }, line: 'I need the exact text.', tone: 'muttering' }],
          sourceSegmentIds: ['beat-0004'],
          sourceSegments: [{
            id: 'beat-0004',
            type: 'dialogue',
            text: 'I need the exact text.',
            sourceSpans: [],
            beatIndex: 4,
            speakerKey: 'mechanic',
            speakerLabel: 'MECHANIC',
            location: engineeringBayLocation,
          }],
          locationKey: 'engineering-bay',
          locationSnapshotId: 'test-location',
        }]
      }
      const sketchPrompts: PromptsConfig['Sketch Prompts'] = {
        Prefix: 'Generate a black-and-white rough sketch review image for comic layout approval.',
        Chunk: 'Use the ordered panel data below to produce one review sketch image with one sub-panel per source panel.',
      }

      const prompt = buildSketchPrompt(promptData, sketchPrompts)

      expect(prompt).toContain('Label each sub-panel only with its source panel number')
      expect(prompt).toContain('small boxed numeral in the upper-left corner')
      expect(prompt).toContain('caption banners such as "Wide opening shot..." or "Action panel..."')
      expect(prompt).toContain('Keep visible text limited to story content explicitly present in the panel data')
      expect(prompt).toContain('Include the exact speech bubble text')
      expect(prompt).toContain('I need the exact text.')
    })
})
