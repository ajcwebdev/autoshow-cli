import { expect, test } from 'bun:test'
import { chmod, mkdir, readFile, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createRuntimeTempDirectory } from '~/utils/runtime-state'
import { snapshotManagedRuntime } from '../../../setup-acceptance/managed-runtime-snapshot'

test('read-only snapshots preserve bytes, relative paths, permissions and link relationships', async () => {
  const root = await createRuntimeTempDirectory('runtime-snapshot-')
  try {
    await mkdir(join(root, 'tools'))
    await writeFile(join(root, 'tools/worker'), 'retained payload\n')
    await chmod(join(root, 'tools/worker'), 0o755)
    await symlink('tools/worker', join(root, 'worker'))
    const first = await snapshotManagedRuntime(root)
    await readFile(join(root, 'tools/worker'))
    expect(await snapshotManagedRuntime(root)).toEqual(first)
    expect(first.find(entry => entry.path === 'worker')).toMatchObject({ kind: 'symlink', target: 'tools/worker' })
    expect(first.find(entry => entry.path === 'tools/worker')).toMatchObject({ kind: 'file', mode: 0o755, size: '17' })
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('snapshots detect permission, relationship and directory changes even when payload bytes match', async () => {
  const root = await createRuntimeTempDirectory('runtime-snapshot-metadata-')
  try {
    await writeFile(join(root, 'first'), 'same bytes')
    await writeFile(join(root, 'second'), 'same bytes')
    await symlink('first', join(root, 'current'))
    const first = await snapshotManagedRuntime(root)
    await chmod(join(root, 'first'), 0o700)
    expect(await snapshotManagedRuntime(root)).not.toEqual(first)
    const modeChanged = await snapshotManagedRuntime(root)
    await unlink(join(root, 'current'))
    await symlink('second', join(root, 'current'))
    expect(await snapshotManagedRuntime(root)).not.toEqual(modeChanged)
    const linkChanged = await snapshotManagedRuntime(root)
    await mkdir(join(root, 'new-state'))
    expect(await snapshotManagedRuntime(root)).not.toEqual(linkChanged)
  } finally { await rm(root, { recursive: true, force: true }) }
})
