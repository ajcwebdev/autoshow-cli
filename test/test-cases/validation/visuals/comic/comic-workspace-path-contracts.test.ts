import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { configureOutputRoot } from '~/cli/commands/command-shared/output-root'
import { configureCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import { configurePinnedRunDir, resetPinnedRunDir } from '~/cli/commands/command-shared/run-dir'
import { loadAndVerifyCharacterReferenceSnapshot } from '~/cli/commands/visuals/comic/comic-utils/character-reference-snapshot'
import {
  getDraftPromptPath,
  getPanelPromptCoverageReportPath,
  getPanelPromptsDirectory,
  getPanelsDirectory,
  getSceneJsonPath,
  getSceneWorkspaceDirectoryForPanelPrompt,
  getStructuredScriptPath,
} from '~/cli/commands/visuals/comic/comic-utils/project-paths'
import { beginSceneRun, resetSceneRunContext } from '~/cli/commands/visuals/comic/comic-utils/scene-run-context'
import { makeTempDir } from '../../../../test-utils/temp-dirs'
import { createLiveCharacterFixture } from '../../../../test-utils/live-character-reference-fixture'

const roots: string[] = []

const createReferenceFixture = async () => {
  const workspace = await makeTempDir('autoshow-comic-assets-')
  roots.push(workspace)
  const { charactersRoot } = await createLiveCharacterFixture(workspace)
  return { canonicalPath: join(charactersRoot, 'hero.png'), charactersRoot, workspace }
}

afterEach(async () => {
  resetSceneRunContext()
  resetPinnedRunDir()
  configureOutputRoot('./output')
  configureCharactersRoot('input/characters')
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

describe('panel-first comic workspace paths', () => {
  test('resolves metadata, prompt, asset-discovery, and visual paths exactly', async () => {
    const workspace = await makeTempDir('autoshow-comic-workspace-')
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
    const outputRoot = await makeTempDir('autoshow-comic-output-')
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

  test('accepts current canonical references without scene snapshot assets', async () => {
    const { workspace } = await createReferenceFixture()
    expect(loadAndVerifyCharacterReferenceSnapshot(workspace, 'snapshot', ['hero']).snapshotId).toBe('live')
  })

  test('rejects a canonical character asset path that escapes with ../', async () => {
    const { workspace, charactersRoot } = await createReferenceFixture()
    const path = join(charactersRoot, 'characters-reference.json')
    const value = JSON.parse(await Bun.file(path).text())
    value.characters[0].image = '../outside.png'
    await writeFile(path, JSON.stringify(value))
    expect(() => loadAndVerifyCharacterReferenceSnapshot(workspace, undefined, ['hero'])).toThrow(/escapes the characters root/)
  })

  test('rejects an absolute canonical character asset path even when it points inside the root', async () => {
    const { workspace, charactersRoot, canonicalPath } = await createReferenceFixture()
    const path = join(charactersRoot, 'characters-reference.json')
    const value = JSON.parse(await Bun.file(path).text())
    value.characters[0].image = canonicalPath
    await writeFile(path, JSON.stringify(value))
    expect(() => loadAndVerifyCharacterReferenceSnapshot(workspace, undefined, ['hero'])).toThrow(/must be relative/)
  })

  test('rejects a canonical character registration checksum mismatch', async () => {
    const { workspace, canonicalPath } = await createReferenceFixture()
    await writeFile(canonicalPath, 'modified canonical reference')
    expect(() => loadAndVerifyCharacterReferenceSnapshot(workspace, undefined, ['hero'])).toThrow(/stale or tampered/)
  })

  test('rejects malformed current registrations rather than trusting historical snapshots', async () => {
    const { workspace, charactersRoot } = await createReferenceFixture()
    await writeFile(join(charactersRoot, 'character-sketches.json'), JSON.stringify({ schemaVersion: 0, sketches: [] }))
    expect(() => loadAndVerifyCharacterReferenceSnapshot(workspace, undefined, ['hero'])).toThrow(/Invalid character sketch manifest/)
  })

  test('ignores a historical bundle snapshot ID when resolving current references', async () => {
    const { workspace, canonicalPath } = await createReferenceFixture()
    const manifest = loadAndVerifyCharacterReferenceSnapshot(workspace, 'stale-snapshot', ['hero'])
    expect(manifest.snapshotId).toBe('live')
    expect(join(workspace, manifest.characters[0]!.assets[0]!.path)).toBe(canonicalPath)
  })
})
