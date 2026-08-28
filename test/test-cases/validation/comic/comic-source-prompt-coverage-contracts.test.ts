import { describe,expect,test } from 'bun:test'
import { mkdir,rm,writeFile } from 'node:fs/promises'
import { dirname,join } from 'node:path'
import { configureCharactersRoot } from '~/cli/commands/process-steps/characters-root'
import { generateJsonPrompt } from '~/cli/commands/process-steps/step-8-comic/comic-utils/json-prompt-utils'
import {
getDraftPromptPath,
getSceneOutputDirectory,
getStructuredScriptPath
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/project-paths'
import {
assertSourceCoverageReportComplete,
formatSourceSegmentsMarkdown,
validateSceneSourceSegmentCoverage,
verifySourceSegmentCoverageInPromptFiles,
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/source-coverage-utils'
import type {
ScenePromptData,
StructuredScriptData,
StructuredScriptSourceSegment
} from '~/types'
import { redDotPng } from '../../../test-utils/media-fixtures'
import { makeTempDir } from '../../../test-utils/temp-dirs'
const testLocation = { key: 'cargo-bay', raw: 'INT. CARGO BAY - MORNING', type: 'INT', place: 'CARGO BAY - MORNING' }

const sampleSourceSegments: StructuredScriptSourceSegment[] = [
  {
    id: 'beat-0001',
    type: 'narration',
    text: 'The screen is black. A machine wakes up.',
    sourceSpans: [],
    beatIndex: 1,
    location: testLocation,
  },
  {
    id: 'beat-0002',
    type: 'dialogue',
    text: 'C’mon man, wake up, your vacation doesn’t start until tomorrow.',
    sourceSpans: [],
    beatIndex: 2,
    speakerKey: 'engineer',
    speakerLabel: 'ENGINEER',
    delivery: 'chuckling',
    location: testLocation,
  },
]

const buildSceneData = (sourceSegmentIds: string[]): ScenePromptData => ({
  schemaVersion: 4,
  title: 'Coverage Test',
  location: 'STARSHIP HORIZON',
  panels: [{
    number: 1,
    description: 'Mechanic works through a quiet ship corridor.',
    shotPlan: 'Wide corridor shot; Mechanic moves screen left to right.',
    characterKeys: [],
    speech: [],
    sourceSegmentIds,
    locationKey: testLocation.key,
  }],
})

describe('comic source coverage contracts', () => {

  test('scene source segment coverage validation rejects missing and unknown IDs', () => {
    expect(() => validateSceneSourceSegmentCoverage(
      buildSceneData(['beat-0001', 'beat-0002']),
      sampleSourceSegments,
    )).not.toThrow()

    expect(() => validateSceneSourceSegmentCoverage(
      buildSceneData(['beat-0001']),
      sampleSourceSegments,
    )).toThrow(/missing 1 source segment.*beat-0002/)

    expect(() => validateSceneSourceSegmentCoverage(
      buildSceneData(['beat-0001', 'beat-9999']),
      sampleSourceSegments,
    )).toThrow(/unknown source segment ID.*beat-9999/)
  })

  test('draft prompt includes an explicit source segment ID checklist', async () => {
    const sceneSlug = `comic-source-checklist-${Date.now()}`
    const sceneOutputDirectory = getSceneOutputDirectory(sceneSlug)
    const charactersRoot = await makeTempDir('autoshow-source-checklist-characters-')
    await writeFile(join(charactersRoot, 'guide.png'), redDotPng)
    await writeFile(join(charactersRoot, 'characters-reference.json'), JSON.stringify({
      schemaVersion: 3,
      characters: [{
        key: 'guide', name: 'Guide', aliases: ['GUIDE'], image: 'guide.png', outlineSheet: 'guide.png',
        description: 'A free-standing blue hologram above a small projector base; never inside a screen.',
        sceneTextRules: [
          { kind: 'required', pattern: '\\bhologram\\b', description: 'Every Guide panel must identify him as a hologram.' },
          { kind: 'forbidden', pattern: '\\bguide\\b.{0,80}\\bon\\b.{0,40}\\bscreen\\b', description: 'Guide must never appear on a screen.' },
        ],
      }],
      groupAliases: [],
    }))
    configureCharactersRoot(charactersRoot)
    const structuredScript: StructuredScriptData = {
      schemaVersion: 5,
      scriptSlug: sceneSlug,
      sourceFile: 'input/test.md',
      sourceIdentity: {
        schemaVersion: 1,
        canonicalPath: 'input/test.md',
        scriptSlug: sceneSlug,
        contentSha256: '0'.repeat(64),
        identityHash: '1'.repeat(64),
      },
      document: {
        heading: 'Episode Test',
        title: 'Episode Test',
        metadata: [{ label: 'STARSHIP HORIZON', raw: 'STARSHIP HORIZON' }],
      },
      scene: {
        heading: 'COLD OPEN: "Coverage Test"',
        section: 'COLD OPEN',
        title: 'Coverage Test',
        location: { key: 'cargo-bay', raw: 'STARSHIP HORIZON' },
        soundscape: { cues: [], ambientBeds: [] },
      },
      characterKeys: [],
      beats: [],
      sourceSegments: sampleSourceSegments,
    }

    try {
      await mkdir(dirname(getStructuredScriptPath(sceneSlug)), { recursive: true })
      await writeFile(getStructuredScriptPath(sceneSlug), JSON.stringify(structuredScript, null, 2))

      await generateJsonPrompt(sceneSlug)

      const prompt = await Bun.file(getDraftPromptPath(sceneSlug)).text()
      expect(prompt).toContain('## Required Source Segment ID Checklist')
      expect(prompt).toContain('- beat-0001 (narration, beat 1): The screen is black. A machine wakes up.')
      expect(prompt).toContain('- beat-0002 (dialogue, beat 2): C’mon man, wake up')
      expect(prompt).toContain('verify that every exact ID below appears in at least one panel')
      expect(prompt).toContain('no arbitrary per-panel cast-count ceiling')
      expect(prompt).not.toContain('no more than five unique keys per panel')
      expect(prompt).toContain('Canonical character canon is non-negotiable and has highest visual precedence')
      expect(prompt).toContain('"characterKeys": ["guide"]')
      expect(prompt).toContain('"characterKey": "guide"')
      expect(prompt).toContain('guide: A free-standing blue hologram above a small projector base')
      expect(prompt).toContain('REQUIRED: Every Guide panel must identify him as a hologram.')
      expect(prompt).toContain('FORBIDDEN: Guide must never appear on a screen.')
    } finally {
      configureCharactersRoot('input/characters')
      await rm(sceneOutputDirectory, { recursive: true, force: true })
      await rm(charactersRoot, { recursive: true, force: true })
    }
  })

  test('prompt coverage verifier fails when a source segment is omitted', () => {
    const report = verifySourceSegmentCoverageInPromptFiles(sampleSourceSegments, [{
      path: 'panel-01.md',
      content: formatSourceSegmentsMarkdown([sampleSourceSegments[0]!]),
    }])

    expect(report.complete).toBe(false)
    expect(report.missingSegments.map(segment => segment.id)).toEqual(['beat-0002'])
    expect(() => assertSourceCoverageReportComplete(report)).toThrow(/beat-0002/)
  })
})
