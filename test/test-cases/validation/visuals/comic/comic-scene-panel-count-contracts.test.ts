import { describe, expect, test } from 'bun:test'
import { buildSceneDraftRetryPrompt, describeSceneDraftRetryReason } from '~/cli/commands/visuals/comic/comic-commands/draft-scenes/scene-draft-candidate-validation'
import { SCENE_DRAFT_RETRY_HEADER } from '~/cli/commands/visuals/comic/comic-commands/draft-scenes/scene-draft-defaults'
import { appendPanelCountSection, buildPanelCountContract, collectPanelNoteSegmentIds, PANEL_COUNT_SECTION_HEADING, validatePanelCount } from '~/cli/commands/visuals/comic/comic-commands/draft-scenes/scene-panel-count-contract'

const segments = [
  { id: 'beat-0001', type: 'panel-note' },
  { id: 'beat-0002', type: 'narration' },
  { id: 'beat-0003', type: 'panel-note' },
  { id: 'beat-0004', type: 'dialogue' },
  { id: 'beat-0005', type: 'panel-note' },
] as unknown as Parameters<typeof collectPanelNoteSegmentIds>[0]['sourceSegments']

const panel = (number: number, sourceSegmentIds: string[]) => ({ number, sourceSegmentIds })

describe('comic scene panel-count contracts', () => {
  test('the contract is built from authored panel notes and rejects a mismatched count before any request', () => {
    expect(collectPanelNoteSegmentIds({ sourceSegments: segments })).toEqual(['beat-0001', 'beat-0003', 'beat-0005'])
    expect(buildPanelCountContract({ sourceSegments: segments }, 3)).toEqual({ panelCount: 3, panelNoteSegmentIds: ['beat-0001', 'beat-0003', 'beat-0005'] })
    expect(() => buildPanelCountContract({ sourceSegments: segments }, 4, 'metadata/structured-script.json')).toThrow('--panel-count 4 does not match the 3 authored [Panel N] notes in metadata/structured-script.json')
    expect(buildPanelCountContract({ sourceSegments: [] }, 6)).toEqual({ panelCount: 6, panelNoteSegmentIds: [] })
  })

  test('the prompt section names the count and the per-panel citations', () => {
    const prompt = appendPanelCountSection('# Base prompt\n', { panelCount: 3, panelNoteSegmentIds: ['beat-0001', 'beat-0003', 'beat-0005'] })
    expect(prompt.startsWith('# Base prompt\n\n' + PANEL_COUNT_SECTION_HEADING)).toBe(true)
    expect(prompt).toContain('Return exactly 3 panels numbered 1 through 3')
    expect(prompt).toContain('panel 1 cites beat-0001; panel 2 cites beat-0003; panel 3 cites beat-0005')
    expect(appendPanelCountSection('# Base prompt', { panelCount: 6, panelNoteSegmentIds: [] })).not.toContain('cites')
  })

  test('validation reports the wrong count and missing citations as retryable issues', () => {
    const contract = { panelCount: 3, panelNoteSegmentIds: ['beat-0001', 'beat-0003', 'beat-0005'] }
    expect(validatePanelCount({ panels: [panel(1, ['beat-0001', 'beat-0002']), panel(2, ['beat-0003', 'beat-0004']), panel(3, ['beat-0005'])] as never }, contract)).toEqual([])
    expect(validatePanelCount({ panels: [panel(1, ['beat-0001', 'beat-0002', 'beat-0003', 'beat-0004']), panel(2, ['beat-0005'])] as never }, contract)).toEqual([
      'Scene JSON has 2 panels; the panel count contract requires exactly 3',
      'Panel 2 does not cite authored panel-note segment beat-0003',
    ])
    expect(validatePanelCount({ panels: Array.from({ length: 9 }, (_, index) => panel(index + 1, [])) as never }, { panelCount: 10, panelNoteSegmentIds: [] })).toEqual(['Scene JSON has 9 panels; the panel count contract requires exactly 10'])
  })

  test('the retry prompt keeps the blocking wording by default and adds panel-count guidance when asked', () => {
    const blocking = buildSceneDraftRetryPrompt('base', ['issue one'])
    expect(blocking).toContain(SCENE_DRAFT_RETRY_HEADER)
    expect(blocking).toContain('contradicted the blocking plan geometry')
    expect(blocking.endsWith('- issue one')).toBe(true)
    const count = buildSceneDraftRetryPrompt('base', ['issue two'], 'panel-count')
    expect(count).toContain('did not honour the panel count contract')
    expect(count).not.toContain('contradicted the blocking plan geometry. Fix')
    expect(buildSceneDraftRetryPrompt('base', ['x'], 'both')).toContain('contradicted the blocking plan geometry and did not honour the panel count contract')
    expect(describeSceneDraftRetryReason('panel-count')).toBe('missed the panel count contract')
    expect(describeSceneDraftRetryReason('blocking')).toBe('contradicts the blocking plan')
  })
})
