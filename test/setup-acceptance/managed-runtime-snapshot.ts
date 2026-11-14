import { lstat, readFile, readdir, readlink } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

type RuntimeSnapshotEntry = {
  path: string
  kind: 'directory' | 'file' | 'symlink'
  mode: number
  uid: number
  gid: number
  mtimeNs: string
  ctimeNs: string
  size?: string
  sha256?: string
  target?: string
}

/** A read-only acceptance harness; excludes access times, which filesystem reads may update. */
export const snapshotManagedRuntime = async (root: string): Promise<RuntimeSnapshotEntry[]> => {
  const entries: RuntimeSnapshotEntry[] = []
  const walk = async (path: string): Promise<void> => {
    const metadata = await lstat(path, { bigint: true })
    const record = {
      path: relative(root, path).split(sep).join('/') || '.', mode: Number(metadata.mode & 0o7777n),
      uid: Number(metadata.uid), gid: Number(metadata.gid), mtimeNs: String(metadata.mtimeNs), ctimeNs: String(metadata.ctimeNs)
    }
    if (metadata.isSymbolicLink()) entries.push({ ...record, kind: 'symlink', target: await readlink(path) })
    else if (metadata.isDirectory()) {
      entries.push({ ...record, kind: 'directory' })
      const children = (await readdir(path)).filter(name => name !== '.DS_Store').sort()
      for (const name of children) await walk(join(path, name))
    } else if (metadata.isFile()) entries.push({
      ...record, kind: 'file', size: String(metadata.size), sha256: new Bun.CryptoHasher('sha256').update(await readFile(path)).digest('hex')
    })
    else throw new Error(`Unsupported managed runtime artifact: ${record.path}`)
  }
  try { await walk(root) }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; else if (entries.length > 0) throw error }
  return entries
}

if (import.meta.main) {
  const [root, ...extra] = Bun.argv.slice(2)
  if (!root || extra.length > 0) throw new Error('Expected managed-runtime-snapshot.ts RUNTIME_DIRECTORY')
  process.stdout.write(`${JSON.stringify(await snapshotManagedRuntime(root))}\n`)
}
