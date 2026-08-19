import { afterEach, describe, expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { configureOutputRoot } from '~/cli/commands/process-steps/output-root'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/process-steps/run-dir'
import { loadAndVerifyCharacterReferenceSnapshot } from '~/cli/commands/process-steps/step-8-comic/comic-utils/character-reference-snapshot'
import {
  getDraftPromptPath,
  getPanelPromptCoverageReportPath,
  getPanelPromptsDirectory,
  getPanelsDirectory,
  getSceneJsonPath,
  getSceneWorkspaceDirectoryForPanelPrompt,
  getStructuredScriptPath,
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/project-paths'
import { beginSceneRun, resetSceneRunContext } from '~/cli/commands/process-steps/step-8-comic/comic-utils/scene-run-context'
import type { SnapshotFixtureOptions } from '~/types'

const roots: string[] = []

const createSnapshotFixture = async (options: SnapshotFixtureOptions = {}) => {
  const workspace = await mkdtemp(join(tmpdir(), 'autoshow-comic-assets-'))
  roots.push(workspace)
  const bytes = Buffer.from('canonical-reference')
  const canonicalPath = join(workspace, 'assets', 'character-references', 'snapshot', 'hero', 'reference.png')
  await mkdir(join(workspace, 'assets', 'character-references', 'snapshot', 'hero'), { recursive: true })
  await Bun.write(canonicalPath, bytes)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const assetPath = typeof options.assetPath === 'function'
    ? options.assetPath(canonicalPath)
    : options.assetPath ?? 'assets/character-references/snapshot/hero/reference.png'
  await Bun.write(join(workspace, 'assets', 'character-references.json'), JSON.stringify({
    schemaVersion: options.schemaVersion ?? 2,
    snapshotId: 'snapshot',
    catalogHash: 'catalog',
    createdAt: '2026-01-01T00:00:00.000Z',
    characters: [{ key: 'hero', name: 'Hero', description: 'Hero.', sourceSketchVersion: 'v1', assets: [
      { role: 'sketch-sheet', path: assetPath, sha256: options.registeredSha256 ?? sha256 },
      { role: 'source-image', path: assetPath, sha256: options.registeredSha256 ?? sha256 },
    ] }],
  }))
  return { canonicalPath, workspace }
}

afterEach(async () => {
  resetSceneRunContext()
  resetPinnedRunDir()
  configureOutputRoot('./output')
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('panel-first comic workspace paths', () => {
  test('resolves metadata, prompt, asset-discovery, and visual paths exactly', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'autoshow-comic-workspace-'))
    roots.push(workspace)
    beginSceneRun('scene', { outputDir: workspace })

    expect(getStructuredScriptPath('scene')).toBe(join(workspace, 'metadata', 'structured-script.json'))
    expect(getDraftPromptPath('scene')).toBe(join(workspace, 'metadata', 'draft-prompt.md'))
    expect(getSceneJsonPath('scene')).toBe(join(workspace, 'metadata', 'scene.json'))
    expect(getPanelPromptsDirectory('scene')).toBe(join(workspace, 'metadata', 'panel-prompts'))
    expect(getPanelPromptCoverageReportPath('scene')).toBe(join(workspace, 'metadata', 'panel-prompts', 'source-coverage.json'))
    expect(getPanelsDirectory('scene')).toBe(join(workspace, 'panels'))
    expect(getSceneWorkspaceDirectoryForPanelPrompt(join(workspace, 'metadata', 'panel-prompts', 'panel-01'))).toBe(workspace)
    expect(() => getSceneWorkspaceDirectoryForPanelPrompt(join(workspace, 'panel-prompts', 'panel-01'))).toThrow(/is not inside metadata\/panel-prompts\//)
  })

  test('resumes the latest run and honors a pinned scene workspace', async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), 'autoshow-comic-output-'))
    roots.push(outputRoot)
    configureOutputRoot(outputRoot)
    const older = join(outputRoot, '2026-01-01_00-00-00-000_scene')
    const latest = join(outputRoot, '2026-01-02_00-00-00-000_scene')
    await mkdir(join(older, 'metadata'), { recursive: true })
    await mkdir(join(latest, 'metadata'), { recursive: true })
    expect(beginSceneRun('scene', { resume: true })).toBe(latest)

    resetSceneRunContext()
    const pinned = join(outputRoot, 'reviewed-scene')
    configurePinnedRunDir(pinned)
    expect(beginSceneRun('scene')).toBe(pinned)
    expect(getSceneJsonPath('scene')).toBe(join(pinned, 'metadata', 'scene.json'))
  })

  test('accepts a valid character-reference snapshot', async () => {
    const { workspace } = await createSnapshotFixture()
    expect(loadAndVerifyCharacterReferenceSnapshot(workspace, 'snapshot').snapshotId).toBe('snapshot')
  })

  test('rejects a character-reference asset path that escapes with ../', async () => {
    const { workspace } = await createSnapshotFixture({ assetPath: '../outside.png' })
    expect(() => loadAndVerifyCharacterReferenceSnapshot(workspace, 'snapshot')).toThrow(/Unsafe snapshot asset path/)
  })

  test('rejects an absolute character-reference asset path even when it points inside the workspace', async () => {
    const { workspace } = await createSnapshotFixture({ assetPath: canonicalPath => canonicalPath })
    expect(() => loadAndVerifyCharacterReferenceSnapshot(workspace, 'snapshot')).toThrow(/Unsafe snapshot asset path/)
  })

  test('rejects a character-reference checksum mismatch', async () => {
    const { workspace } = await createSnapshotFixture({ registeredSha256: '0'.repeat(64) })
    expect(() => loadAndVerifyCharacterReferenceSnapshot(workspace, 'snapshot')).toThrow(/modified or corrupted/)
  })

  test('rejects a legacy character-reference schema version', async () => {
    const { workspace } = await createSnapshotFixture({ schemaVersion: 1 })
    expect(() => loadAndVerifyCharacterReferenceSnapshot(workspace, 'snapshot')).toThrow(/schemaVersion 2/)
  })

  test('rejects a stale character-reference snapshot ID', async () => {
    const { workspace } = await createSnapshotFixture()
    expect(() => loadAndVerifyCharacterReferenceSnapshot(workspace, 'stale-snapshot')).toThrow(/does not match manifest snapshot/)
  })
})
