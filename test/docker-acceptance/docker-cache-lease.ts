import { mkdir, readFile, readdir, rmdir, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface AcceptanceCacheOwner { runId: string; pid: number; output: string; startedAt: string }
export interface AcceptanceCacheLease { path: string; runId: string }

/** The exclusive directory lease spans provisioning and scenarios that share mutable model caches. */
export async function acquireAcceptanceCacheLease(cache: string, owner: AcceptanceCacheOwner): Promise<AcceptanceCacheLease> {
  await mkdir(cache, { recursive: true })
  const path = join(cache, 'acceptance.lock')
  await mkdir(path).catch(() => { throw new Error(`Cache already in use: ${path}. Inspect its owner.json before recovering an abandoned lock.`) })
  try { await writeFile(join(path, 'owner.json'), JSON.stringify(owner) + '\n', { flag: 'wx' }) }
  catch (error) { await rmdir(path).catch(() => undefined); throw error }
  return { path, runId: owner.runId }
}

/** Delete only our lease metadata. Unexpected contents or replacement ownership are retained. */
export async function releaseAcceptanceCacheLease(lease: AcceptanceCacheLease): Promise<void> {
  const entries = await readdir(lease.path)
  if (entries.length !== 1 || entries[0] !== 'owner.json') throw new Error('Cache lease contains unexpected files; retained for inspection')
  const owner: unknown = JSON.parse(await readFile(join(lease.path, 'owner.json'), 'utf8'))
  if (!owner || typeof owner !== 'object' || !('runId' in owner) || owner.runId !== lease.runId) throw new Error('Cache lease ownership changed; retained for inspection')
  await unlink(join(lease.path, 'owner.json'))
  await rmdir(lease.path)
}
