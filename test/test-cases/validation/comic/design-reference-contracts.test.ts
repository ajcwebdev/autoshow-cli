import { describe, expect, test } from 'bun:test'
import { resolveDesignReferencesAcrossPanels } from '~/cli/commands/process-steps/step-8-comic/comic-utils/design-reference'
import type { PanelBundleData, PanelPrimaryReferenceInput } from '~/types'

const bridgeLocation = { key: 'bridge', raw: 'bridge' }

const panelBundle = (panel: Partial<PanelBundleData['panels'][number]>): PanelBundleData => ({
  schemaVersion: 4, snapshotId: 'character-snapshot',
  title: 'Design Reference Contract', location: 'Bridge', panels: [{
    number: 1, description: 'Authored staging 1.',
    shotPlan: 'Medium eye-level shot 1; hero is screen left, facing right; exclude all unlisted cast.',
    characterKeys: ['hero'], speech: [], sourceSegmentIds: ['beat-1'],
    sourceSegments: [{ id: 'beat-1', type: 'direction', text: 'Authored staging 1.', sourceSpans: [], beatIndex: 1, location: bridgeLocation }],
    locationKey: 'bridge', locationSnapshotId: 'location-snapshot',
    ...panel,
  }],
})

const referenceInput = (bundleData: PanelBundleData): PanelPrimaryReferenceInput => ({
  panelDirectory: 'metadata/panel-prompts/panel-01', entries: [], bundleData,
})

describe('design reference contracts', () => {
  test('design references resolve from designReferenceKeys, not from the authored designReferences list', () => {
    const authoredOnly = panelBundle({
      designReferences: [{ key: 'console-panel', sourcePath: 'input/examples/comic/console.png', usage: 'Bridge console layout' }],
    })

    expect(resolveDesignReferencesAcrossPanels([referenceInput(authoredOnly)])).toEqual([])
  })

  test('panels without any design fields request no design references', () => {
    expect(resolveDesignReferencesAcrossPanels([referenceInput(panelBundle({}))])).toEqual([])
  })
})
