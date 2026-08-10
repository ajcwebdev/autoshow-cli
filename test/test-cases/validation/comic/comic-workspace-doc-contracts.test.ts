import { expect, test } from 'bun:test'
import { basename, relative, resolve } from 'node:path'
import {
  getCharacterReferencesDirectory,
  getDesignReferencesDirectory,
  getLocationReferencesDirectory,
  getSceneAssetsDirectory,
  getSceneMetadataDirectoryForWorkspace,
  normalizeProjectPath
} from '~/cli/commands/process-steps/step-8-comic/comic-utils/project-paths'

const workspace = 'output/<timestamp>_<scene-slug>'
const docs = [
  {
    path: resolve(import.meta.dir, '../../../../docs/diagrams/05-types-and-output.md'),
    section: '### Comic character and run layout'
  },
  {
    path: resolve(import.meta.dir, '../../../../docs/release-v0.1.md'),
    section: '### Step 8: comic'
  }
]
const workspaceDirectories = [
  getSceneMetadataDirectoryForWorkspace(workspace),
  getSceneAssetsDirectory(workspace),
  getCharacterReferencesDirectory(workspace),
  getLocationReferencesDirectory(workspace),
  getDesignReferencesDirectory(workspace)
]
const snapshotDirectories = workspaceDirectories.slice(2)

const treeIndent = (directory: string): string => {
  const depth = normalizeProjectPath(relative(workspace, directory)).split('/').length
  return '  '.repeat(depth)
}

const treeLine = (directory: string): string => `${treeIndent(directory)}${basename(directory)}/`

test('comic layout docs match the workspace-parameterized path helpers', async () => {
  for (const doc of docs) {
    const markdown = await Bun.file(doc.path).text()
    const section = markdown.split(doc.section)[1]?.split('\n## ')[0]
    if (section === undefined) throw new Error(`${doc.path} is missing ${doc.section}`)

    expect(section).toContain(`${workspace}/`)
    for (const directory of workspaceDirectories) expect(section).toContain(treeLine(directory))
    for (const directory of snapshotDirectories) {
      expect(section).toContain(`${treeLine(directory)}\n${treeIndent(directory)}  <snapshot-id>/`)
    }
  }
})
