import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { draftScenesCommand } from '~/cli/commands/process-steps/step-8-comic/comic-commands/draft-scenes/draft-scenes-command'
import { generateImagesCommand } from '~/cli/commands/process-steps/step-8-comic/comic-commands/generate-images/generate-images-command'
import { comicLog } from '~/cli/commands/process-steps/step-8-comic/comic-utils/comic-logger'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/process-steps/run-dir'
import { captureConsoleText } from '../../../test-utils/console-capture'
import { getSceneOutputDirectory } from '~/cli/commands/process-steps/step-8-comic/comic-utils/project-paths'
import type {
  ImageRunStats,
  SourceCoverageReport,
} from '~/types'

const SCENE_SLUG = '01-co-work-smarter'
// Pin an explicit run directory so the suite is hermetic and never resumes or
// deletes a real timestamped run for this slug. The leading dot keeps it out of
// findLatestSceneRunDirectory (which requires a timestamp prefix).
const RUN_DIR = 'output/.test-run_01-co-work-smarter'

beforeAll(() => {
  configurePinnedRunDir(RUN_DIR)
})

afterAll(async () => {
  resetPinnedRunDir()
  // Commands may mkdir the per-run scene directory even with mocked stages; remove
  // the pinned run directory without clobbering any other real output.
  await rm(RUN_DIR, { recursive: true, force: true })
})

const imageStats = (overrides: Partial<ImageRunStats> = {}): ImageRunStats => ({
  imagesGenerated: 0,
  imagesSkipped: 0,
  totalInputTokens: 0,
  totalInputTextTokens: 0,
  totalInputImageTokens: 0,
  totalInputUnattributedTokens: 0,
  totalOutputTokens: 0,
  totalOutputTextTokens: 0,
  totalOutputImageTokens: 0,
  totalOutputUnattributedTokens: 0,
  totalCost: 0,
  totalDurationMs: 0,
  ...overrides,
})

const coverageReport = (coveredSegments = 4, totalSegments = 4): SourceCoverageReport => ({
  complete: coveredSegments === totalSegments,
  totalSegments,
  coveredSegments,
  missingSegments: [],
  missingItems: [],
  promptFiles: ['output/01-co-work-smarter/panel-prompts/panel-01/scene-panel-1.md'],
})

const removedLogFragments = [
  'Step 1/1',
  'Step 2/2',
  '═',
  '━',
  'Initialization complete',
  'All operations completed',
  'Response ID',
  'Status:',
  'Character refs:',
  'Canonical refs:',
  'Sketch refs:',
  'Prior panel refs:',
  'Skipping existing output',
]

// Comic assertions target the stdout channel, so force an interactive human sink:
// under the non-TTY runner the default sink would route info events to stderr.
const captureComicOutput = (fn: () => Promise<void>) =>
  captureConsoleText(fn, { strip: true, interactiveHumanSink: true })

const expectRemovedFragmentsAbsent = (output: string): void => {
  for (const fragment of removedLogFragments) {
    expect(output).not.toContain(fragment)
  }
}

describe('comic compact logging contracts', () => {
  test('draft-scenes runs all stages with one header and final summary', async () => {
    const captured = await captureComicOutput(async () => {
      await draftScenesCommand({
        scriptPath: 'input/scripts/01-script/01-co-work-smarter.md',
        sceneSlug: '01-co-work-smarter',
      }, {
        runStructureScripts: async () => comicLog.line('structured-script generated', ['path=structured-script.json']),
        runDraftPrompts: async () => comicLog.line('draft-prompt generated', ['path=draft-prompt.md']),
        runSceneDraft: async () => comicLog.line('scene-json generated', ['model=gpt-5.1', 'tokens=1,200', 'cost=$0.01', 'api=0.10s']),
        runPanelPrompts: async () => comicLog.line('panel-prompts generated', ['panels=4', 'coverage=4/4']),
      })
    })

    expect((captured.stdout.match(/comic draft-scenes/g) ?? [])).toHaveLength(1)
    expect(captured.stdout).toContain('stages=structure,prompt,scene,panel-prompts')
    expect(captured.stdout).toContain('structured-script generated')
    expect(captured.stdout).toContain('draft-prompt generated')
    expect(captured.stdout).toContain('scene-json generated')
    expect(captured.stdout).toContain('panel-prompts generated')
    expect(captured.stdout).toContain('summary stages=4')
    expect(captured.stdout).toContain(`output directory: ${getSceneOutputDirectory(SCENE_SLUG)}`)
    expectRemovedFragmentsAbsent(captured.stdout)
  })

  test('generate-images target sketches logs compact prep, per-sketch output, and summary', async () => {
    const captured = await captureComicOutput(async () => {
      await generateImagesCommand({
        scriptPath: 'input/scripts/01-script/01-co-work-smarter.md',
        sceneSlug: '01-co-work-smarter',
        target: 'sketches',
        panelsPerImage: 4,
      }, {
        checkScenesExist: async () => true,
        checkPromptsExist: async () => true,
        checkPanelPromptSourceCoverage: async () => coverageReport(),
        runSketches: async () => {
          comicLog.output('generated', 'sketch', [
            'id=panels-01-04',
            'panels=panel-01,panel-02,panel-03,panel-04',
            'model=gpt-image-2',
            'mode=edit',
            'refs=3',
            'cost=$0.02',
            'duration=0.20s',
            'path=output/01-co-work-smarter/sketches/panels-01-04.png',
          ])
          return imageStats({
            imagesGenerated: 1,
            totalInputTokens: 10,
            totalOutputTokens: 20,
            totalCost: 0.02,
            totalDurationMs: 200,
          })
        },
      })
    })

    expect(captured.stdout).toContain('comic generate-images scene=01-co-work-smarter target=sketches')
    expect(captured.stdout).toContain('inputs ready draft=reviewed-v4 prompts=reviewed-v4 coverage=4/4')
    expect(captured.stdout).toContain('config target=sketches')
    expect(captured.stdout).toContain('generated sketch id=panels-01-04')
    expect(captured.stdout).toContain('summary generated=1 skipped=0 tokens=30 cost=$0.02 api=200ms')
    expect(captured.stdout).toContain(`output directory: ${getSceneOutputDirectory(SCENE_SLUG)}`)
    expectRemovedFragmentsAbsent(captured.stdout)
  })

  test('existing-output skips stay concise', async () => {
    const captured = await captureComicOutput(async () => {
      await generateImagesCommand({
        scriptPath: 'input/scripts/01-script/01-co-work-smarter.md',
        sceneSlug: '01-co-work-smarter',
        target: 'sketches',
      }, {
        checkScenesExist: async () => true,
        checkPromptsExist: async () => true,
        checkPanelPromptSourceCoverage: async () => coverageReport(),
        runSketches: async () => {
          comicLog.output('skipped', 'sketch', [
            'id=panels-01-04',
            'panels=1-4',
            'model=gpt-image-2',
            'refs=3',
            'path=output/01-co-work-smarter/sketches/panels-01-04.png',
          ])
          return imageStats({ imagesSkipped: 1 })
        },
      })
    })

    expect(captured.stdout).toContain('skipped sketch id=panels-01-04')
    expect(captured.stdout).toContain('summary generated=0 skipped=1')
    expect(captured.stdout).not.toContain('Sketch chunk:')
    expectRemovedFragmentsAbsent(captured.stdout)
  })

  test('coverage errors keep actionable context', async () => {
    const coverageError = 'Panel prompt source coverage incomplete: missing 1 source text item(s): beat-0001.text "Missing line"'
    let thrown: unknown

    await captureComicOutput(async () => {
      try {
        await generateImagesCommand({
          scriptPath: 'input/scripts/01-script/01-co-work-smarter.md',
          sceneSlug: '01-co-work-smarter',
          target: 'sketches',
        }, {
          checkScenesExist: async () => true,
          checkPromptsExist: async () => true,
          checkPanelPromptSourceCoverage: async () => {
            throw new Error(coverageError)
          },
          runSketches: async () => imageStats(),
        })
      } catch (error) {
        thrown = error
      }
    })

    expect(thrown).toBeInstanceOf(Error)
    expect((thrown as Error).message).toContain('Panel prompt source coverage incomplete')
    expect((thrown as Error).message).toContain('beat-0001.text')
  })
})
