import { expect, test } from 'bun:test'
import { basename, relative, resolve } from 'node:path'
import {
  getSceneMetadataDirectoryForWorkspace,
  normalizeProjectPath
} from '~/cli/commands/visuals/comic/comic-utils/project-paths'

const workspace = 'output/<timestamp>_<scene-slug>'
const docs = [
  {
    path: resolve(import.meta.dir, '../../../../../docs/diagrams/05-types-and-output.md'),
    section: '### Comic character and run layout'
  }
]
const workspaceDirectories = [
  getSceneMetadataDirectoryForWorkspace(workspace),
]

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
    expect(section).toContain('input/characters/')
    expect(section).toContain('input/locations/')
    expect(section).toContain('images read directly from current canonical roots')
    expect(section).not.toContain('  assets/')
    expect(section).not.toContain('<snapshot-id>')
  }
})
