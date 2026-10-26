import { InfraError, UsageError, ValidationError } from '~/utils/error-handler'
import { writeCommandPayload } from '~/utils/app-logger/result-emitter'
import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, mkdir, open, readFile, realpath, rename, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { acquireProjectMaintenanceLease } from '~/utils/project-maintenance-lease'
import type { MediaConsolidationPlan } from './prepare-media-consolidation'

type NativeMetadata = { path: string; sha256: string; dev: number; ino: number; nlink: number; mode: number; uid: number; gid: number; mtimeNs: string; ctimeNs: string; flags: number; xattrSha256: Record<string, string>; acl: string[] }
type PreservedIdentity = { path: string; sha256: string; dev: number; ino: number; nlink: number; mode: number; uid: number; gid: number; mtimeNs: string; ctimeNs: string }
const KERNEL_PROVENANCE = 'com.apple.provenance' as const
type KernelAssignedXattrChange = { name: typeof KERNEL_PROVENANCE; beforeSha256: string | null; afterSha256: string | null; assignment: 'clonefile(2)' }
type NativeCloneAssignment = { assignment: 'clonefile(2)'; kernelAssignedXattrs: { 'com.apple.provenance': string | null } }
export type MediaCloneAdapter = {
  capture(root: string, relative: string): Promise<NativeMetadata>
  clone(source: string, destination: string): Promise<void | NativeCloneAssignment>
  copyMetadata(original: string, destination: string): Promise<void>
}
type AppliedFile = { path: string; keeperPath: string; effectiveKeeperPath?: string; group: string; bytes: number; sha256: string; before: NativeMetadata; after: NativeMetadata; kernelAssignedXattrChanges?: KernelAssignedXattrChange[] }
type RetainedFile = { path: string; keeperPath: string; group: string; bytes: number; sha256: string; reason: 'metadata-compatible-class-representative'; native: NativeMetadata }
type AuxiliaryKeeper = NativeMetadata & { bytes: number }
export type MediaConsolidationReceipt = {
  schemaVersion: 1; operation: 'native-copy-on-write-consolidation'; status: 'running' | 'complete' | 'failed'; startedAt: string; completedAt?: string
  planPath: string; planSha256: string; nativeBaselinePath: string; nativeBaselineSha256: string
  logicalReplacementBytes: number; appliedFiles: AppliedFile[]; preservedFiles: PreservedIdentity[]; error?: string
  keeperPolicy?: 'metadata-compatible' | 'original-plan-with-kernel-provenance'; retainedFiles?: RetainedFile[]
  keeperCatalogPath?: string; keeperCatalogSha256?: string; auxiliaryKeepers?: AuxiliaryKeeper[]
  policyHistory?: Array<{ at: string; from: string; to: string; retainedPathsBefore: string[] }>
}
type Lease = { assertHeld(): Promise<void>; release(): Promise<void> }
export type MediaConsolidationDependencies = { adapter?: MediaCloneAdapter; acquireLease?: (root: string) => Promise<Lease>; beforeReplace?: (path: string) => Promise<void>; expectedPlanSha256?: string; resumeReceipt?: string; metadataCompatibleKeepers?: boolean; keeperCatalogPath?: string; acceptKernelProvenance?: boolean }

const digest = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex')
const forbidden = /^(?:\.git|\.autoshow|\.env(?:\..*)?|credentials?(?:\..*)?|protected-voice-assets|secrets?(?:\..*)?)$/i
const pathValue = (value: unknown): string => {
  if (typeof value !== 'string' || !value || isAbsolute(value) || /^[a-z]:/i.test(value) || /[\\\x00-\x1f\x7f]/.test(value) || value.split('/').some(part => !part || part === '.' || part === '..' || part === '.DS_Store' || forbidden.test(part)) || ['.pem', '.key', '.p12', '.pfx'].includes(extname(value).toLowerCase())) throw ValidationError('Unsafe or protected media consolidation path')
  return value
}
const checked = async (root: string, relative: string, missing = false): Promise<string> => {
  pathValue(relative)
  let current = root
  for (const component of relative.split('/')) {
    current = join(current, component)
    try { if ((await lstat(current)).isSymbolicLink()) throw ValidationError(`Symlink rejected: ${relative}`) } catch (error) { if (!missing || (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  }
  return current
}
const rootPath = async (value: string): Promise<string> => {
  const path = resolve(value), info = await lstat(path)
  if (!info.isDirectory() || info.isSymbolicLink()) throw ValidationError('Root must be a real directory')
  return await realpath(path)
}
const shaFile = async (root: string, relative: string): Promise<string> => {
  const path = await checked(root, relative), file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const before = await file.stat({ bigint: true })
    if (!before.isFile()) throw ValidationError(`Not a regular file: ${relative}`)
    const hash = createHash('sha256')
    for await (const chunk of file.createReadStream({ autoClose: false })) hash.update(chunk)
    const after = await file.stat({ bigint: true }), current = await lstat(path, { bigint: true })
    for (const field of ['dev', 'ino', 'size', 'mode', 'mtimeNs', 'ctimeNs', 'nlink'] as const) if (before[field] !== after[field] || after[field] !== current[field]) throw ValidationError(`File changed while hashing: ${relative}`)
    return hash.digest('hex')
  } finally { await file.close() }
}
const identity = async (root: string, relative: string, sha256: string): Promise<PreservedIdentity> => {
  const info = await lstat(await checked(root, relative), { bigint: true })
  if (!info.isFile()) throw ValidationError(`Not a regular file: ${relative}`)
  return { path: relative, sha256, dev: Number(info.dev), ino: Number(info.ino), nlink: Number(info.nlink), mode: Number(info.mode & 0o7777n), uid: Number(info.uid), gid: Number(info.gid), mtimeNs: String(info.mtimeNs), ctimeNs: String(info.ctimeNs) }
}
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)
const contentMetadata = (metadata: NativeMetadata): unknown => ({ path: metadata.path, sha256: metadata.sha256, nlink: metadata.nlink, mode: metadata.mode, uid: metadata.uid, gid: metadata.gid, mtimeNs: metadata.mtimeNs, flags: metadata.flags, xattrSha256: Object.fromEntries(Object.entries(metadata.xattrSha256).sort(([a], [b]) => a.localeCompare(b))), acl: metadata.acl })
const metadataAfterKernelAssignment = (before: NativeMetadata, changes: KernelAssignedXattrChange[] | undefined, accepted: boolean): NativeMetadata => {
  if (!changes?.length) return before
  if (!accepted || changes.length !== 1) throw ValidationError('Unauthorized kernel metadata transition')
  const change = changes[0]!
  if (change.name !== KERNEL_PROVENANCE || change.assignment !== 'clonefile(2)' || change.beforeSha256 !== (before.xattrSha256[KERNEL_PROVENANCE] ?? null) || change.beforeSha256 === change.afterSha256 || change.afterSha256 !== null && !/^[0-9a-f]{64}$/.test(change.afterSha256)) throw ValidationError('Invalid kernel-assigned provenance transition')
  const attrs = { ...before.xattrSha256 }
  if (change.afterSha256 === null) delete attrs[KERNEL_PROVENANCE]
  else attrs[KERNEL_PROVENANCE] = change.afterSha256
  return { ...before, xattrSha256: attrs }
}
const kernelChanges = (before: NativeMetadata, assignment: void | NativeCloneAssignment, accepted: boolean): KernelAssignedXattrChange[] => {
  if (!accepted) return []
  if (!assignment || assignment.assignment !== 'clonefile(2)' || !assignment.kernelAssignedXattrs || !same(Object.keys(assignment.kernelAssignedXattrs), [KERNEL_PROVENANCE])) throw ValidationError('Native clonefile kernel assignment record is required')
  const afterSha256 = assignment.kernelAssignedXattrs[KERNEL_PROVENANCE], beforeSha256 = before.xattrSha256[KERNEL_PROVENANCE] ?? null
  if (afterSha256 !== null && !/^[0-9a-f]{64}$/.test(afterSha256)) throw ValidationError('Invalid native kernel-assignment hash')
  return afterSha256 === beforeSha256 ? [] : [{ name: KERNEL_PROVENANCE, beforeSha256, afterSha256, assignment: 'clonefile(2)' }]
}
const parseNativeJson = <T>(bytes: string): T => JSON.parse(bytes.replace(/"(mtimeNs|ctimeNs)"\s*:\s*(\d+)/g, '"$1":"$2"')) as T
const readNative = (bytes: string): { files: NativeMetadata[] } => parseNativeJson(bytes)
const nativeOnly = (row: NativeMetadata): NativeMetadata => ({ path: row.path, sha256: row.sha256, dev: row.dev, ino: row.ino, nlink: row.nlink, mode: row.mode, uid: row.uid, gid: row.gid, mtimeNs: row.mtimeNs, ctimeNs: row.ctimeNs, flags: row.flags, xattrSha256: row.xattrSha256, acl: row.acl })

export const createNativeMediaCloneAdapter = async (options: { acceptKernelProvenance?: boolean } = {}): Promise<MediaCloneAdapter> => {
  if (process.platform !== 'darwin') throw InfraError('Native copy-on-write consolidation requires macOS clonefile(2); no copy fallback is permitted')
  const { dlopen, FFIType, ptr, toArrayBuffer } = await import('bun:ffi')
  const library = dlopen('/usr/lib/libSystem.B.dylib', {
    clonefile: { args: [FFIType.ptr, FFIType.ptr, FFIType.i32], returns: FFIType.i32 },
    copyfile: { args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.u32], returns: FFIType.i32 },
    listxattr: { args: [FFIType.ptr, FFIType.ptr, FFIType.u64, FFIType.i32], returns: FFIType.i64 },
    getxattr: { args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.u64, FFIType.u32, FFIType.i32], returns: FFIType.i64 },
    setxattr: { args: [FFIType.ptr, FFIType.ptr, FFIType.ptr, FFIType.u64, FFIType.u32, FFIType.i32], returns: FFIType.i32 },
    removexattr: { args: [FFIType.ptr, FFIType.ptr, FFIType.i32], returns: FFIType.i32 },
    futimens: { args: [FFIType.i32, FFIType.ptr], returns: FFIType.i32 },
    __error: { args: [], returns: FFIType.ptr }
  })
  const cstring = (value: string): Buffer => Buffer.from(`${value}\0`)
  const checkResult = (result: number | bigint, operation: string): number => {
    if (Number(result) < 0) {
      const code = new Int32Array(toArrayBuffer(library.symbols.__error()!, 0, 4))[0]
      throw InfraError(`${operation} failed with errno ${code}; no fallback was attempted`)
    }
    return Number(result)
  }
  const rawXattrs = (path: string): Record<string, Buffer> => {
    const file = cstring(path), count = checkResult(library.symbols.listxattr(ptr(file), null, 0, 0), 'listxattr')
    if (!count) return {}
    const names = Buffer.alloc(count), length = checkResult(library.symbols.listxattr(ptr(file), ptr(names), count, 0), 'listxattr')
    const result: Record<string, Buffer> = Object.create(null) as Record<string, Buffer>
    for (const name of names.subarray(0, length).toString('utf8').split('\0').filter(Boolean).sort()) {
      const key = cstring(name), size = checkResult(library.symbols.getxattr(ptr(file), ptr(key), null, 0, 0, 0), 'getxattr'), value = Buffer.alloc(Math.max(1, size))
      const used = checkResult(library.symbols.getxattr(ptr(file), ptr(key), ptr(value), size, 0, 0), 'getxattr')
      result[name] = Buffer.from(value.subarray(0, used))
    }
    return result
  }
  const xattrs = (path: string): Record<string, string> => Object.fromEntries(Object.entries(rawXattrs(path)).map(([name, value]) => [name, digest(value)]))
  const reconcileXattrs = (original: string, destination: string): void => {
    const expected = rawXattrs(original), existing = rawXattrs(destination), target = cstring(destination)
    for (const name of Object.keys(existing)) if (!(name in expected) && !(options.acceptKernelProvenance && name === KERNEL_PROVENANCE)) {
      const key = cstring(name)
      checkResult(library.symbols.removexattr(ptr(target), ptr(key), 0), `removexattr ${name}`)
    }
    for (const [name, value] of Object.entries(expected)) if (!existing[name]?.equals(value) && !(options.acceptKernelProvenance && name === KERNEL_PROVENANCE)) {
      const key = cstring(name), contents = value.length ? value : Buffer.alloc(1)
      checkResult(library.symbols.setxattr(ptr(target), ptr(key), ptr(contents), value.length, 0, 0), `setxattr ${name}`)
    }
    const remaining = (values: Record<string, string>) => Object.fromEntries(Object.entries(values).filter(([name]) => !options.acceptKernelProvenance || name !== KERNEL_PROVENANCE))
    if (!same(remaining(xattrs(original)), remaining(xattrs(destination)))) throw InfraError('Exact target extended-attribute reconciliation failed')
  }
  return {
    async capture(root, relative) {
      const path = await checked(root, relative), sha256 = await shaFile(root, relative), basic = await identity(root, relative, sha256)
      const acl = execFileSync('/bin/ls', ['-lde', path], { encoding: 'utf8', env: { ...process.env, LC_ALL: 'C' } }).split('\n').slice(1).filter(line => /^\s*\d+:/.test(line)).map(line => line.trim())
      const flags = Number(execFileSync('/usr/bin/stat', ['-f', '%f', path], { encoding: 'utf8' }).trim())
      if (!Number.isSafeInteger(flags)) throw InfraError(`Cannot read file flags: ${relative}`)
      return { ...basic, flags, xattrSha256: xattrs(path), acl }
    },
    async clone(source, destination) {
      const first = cstring(source), second = cstring(destination)
      checkResult(library.symbols.clonefile(ptr(first), ptr(second), 0), 'clonefile')
      // Capture the kernel-controlled label immediately after clonefile, before metadata copying.
      const assigned = rawXattrs(destination)[KERNEL_PROVENANCE]
      return { assignment: 'clonefile(2)', kernelAssignedXattrs: { [KERNEL_PROVENANCE]: assigned ? digest(assigned) : null } }
    },
    async copyMetadata(original, destination) {
      const info = await lstat(original, { bigint: true }), source = cstring(original), target = cstring(destination)
      // COPYFILE_ACL | COPYFILE_STAT | COPYFILE_XATTR, without COPYFILE_DATA.
      checkResult(library.symbols.copyfile(ptr(source), ptr(target), null, 7), 'copyfile metadata')
      // copyfile may silently retain keeper-only/system provenance attributes.
      // Reconcile the independent temporary clone to the original target exactly.
      reconcileXattrs(original, destination)
      const file = await open(destination, constants.O_RDONLY | constants.O_NOFOLLOW)
      try {
        const times = new BigInt64Array([info.atimeNs / 1_000_000_000n, info.atimeNs % 1_000_000_000n, info.mtimeNs / 1_000_000_000n, info.mtimeNs % 1_000_000_000n])
        checkResult(library.symbols.futimens(file.fd, ptr(times)), 'futimens')
        await file.sync()
      } finally { await file.close() }
    }
  }
}

const loadInputs = async (root: string, planPath: string) => {
  const bytes = await readFile(await checked(root, planPath)), planSha256 = digest(bytes)
  if (await readFile(await checked(root, `${dirname(planPath)}/plan.sha256`), 'utf8') !== `${planSha256}  ${basename(planPath)}\n`) throw ValidationError('Preparation plan checksum mismatch')
  const plan = JSON.parse(bytes.toString('utf8')) as MediaConsolidationPlan
  if (plan.schemaVersion !== 1 || plan.operation !== 'prepare-only' || plan.strategy !== 'copy-on-write-regular-file-replacement' || plan.preserveSourcePaths !== true || !Array.isArray(plan.mediaFiles) || !Array.isArray(plan.preservedFiles)) throw ValidationError('Invalid preparation plan')
  const nativeBaselinePath = `${dirname(planPath)}/native-metadata.json`, nativeBytes = await readFile(await checked(root, nativeBaselinePath)), native = readNative(nativeBytes.toString('utf8'))
  const nativeByPath = new Map(native.files.map(row => [pathValue(row.path), row]))
  if (nativeByPath.size !== native.files.length || nativeByPath.size !== plan.mediaFiles.length) throw ValidationError('Native baseline path set mismatch')
  const byPath = new Map(plan.mediaFiles.map(row => [pathValue(row.path), row]))
  if (byPath.size !== plan.mediaFiles.length) throw ValidationError('Duplicate media paths')
  for (const row of [...plan.mediaFiles, ...plan.preservedFiles]) pathValue(row.path)
  for (const row of plan.mediaFiles) {
    if (!nativeByPath.has(row.path)) throw ValidationError(`Missing native baseline: ${row.path}`)
    if (row.plannedReplacement) {
      const keeper = row.keeperPath && byPath.get(row.keeperPath)
      if (!keeper || keeper.plannedReplacement || row.sourceKind === 'keeper' || row.requiresExtraReview || row.nlink !== 1 || keeper.sha256 !== row.sha256 || keeper.bytes !== row.bytes) throw ValidationError(`Invalid replacement or keeper: ${row.path}`)
    }
  }
  if (digest(await readFile(await checked(root, plan.input.scopeConfigPath))) !== plan.input.scopeConfigSha256) throw ValidationError('Scope config changed')
  return { plan, planSha256, nativeBaselinePath, nativeBaselineSha256: digest(nativeBytes), nativeByPath }
}
const saveReceipt = async (root: string, output: string, receipt: MediaConsolidationReceipt): Promise<void> => {
  const directory = await checked(root, output), bytes = `${JSON.stringify(receipt, null, 2)}\n`, temporary = join(directory, `.receipt-${crypto.randomUUID()}.tmp`)
  const file = await open(temporary, 'wx', 0o600)
  try { await file.writeFile(bytes); await file.sync() } finally { await file.close() }
  await rename(temporary, join(directory, 'receipt.json'))
  await writeFile(join(directory, 'receipt.sha256'), `${digest(bytes)}  receipt.json\n`, { mode: 0o600 })
}
const readReceipt = async (root: string, receiptPath: string): Promise<MediaConsolidationReceipt> => {
  const bytes = await readFile(await checked(root, receiptPath))
  if (await readFile(await checked(root, `${dirname(receiptPath)}/receipt.sha256`), 'utf8') !== `${digest(bytes)}  ${basename(receiptPath)}\n`) throw ValidationError('Application receipt checksum mismatch')
  const receipt = JSON.parse(bytes.toString('utf8')) as MediaConsolidationReceipt
  if (receipt.schemaVersion !== 1 || receipt.operation !== 'native-copy-on-write-consolidation' || !Array.isArray(receipt.appliedFiles) || !Array.isArray(receipt.preservedFiles)) throw ValidationError('Invalid application receipt')
  return receipt
}
const checkPreservedPlanMetadata = async (root: string, row: MediaConsolidationPlan['preservedFiles'][number]): Promise<void> => {
  const info = await lstat(await checked(root, row.path))
  // Docker's millisecond timestamp baseline has floating-point/submicrosecond rounding.
  if ((info.mode & 0o7777) !== row.mode || Math.abs(info.mtimeMs - row.mtimeMs) > 0.001) throw ValidationError(`Preserved metadata mode or timestamp changed: ${row.path}`)
}
const protectedMetadataClass = (metadata: NativeMetadata): string => JSON.stringify({ sha256: metadata.sha256, xattrs: Object.entries(metadata.xattrSha256).sort(([a], [b]) => a.localeCompare(b)), acl: metadata.acl, flags: metadata.flags })
const readKeeperCatalog = async (root: string, path: string, inputs: Awaited<ReturnType<typeof loadInputs>>): Promise<{ sha256: string; keepers: AuxiliaryKeeper[] }> => {
  const bytes = await readFile(await checked(root, path)), value = parseNativeJson<{ schemaVersion: number; keepers: AuxiliaryKeeper[] }>(bytes.toString('utf8'))
  if (value.schemaVersion !== 1 || !Array.isArray(value.keepers) || !value.keepers.length) throw ValidationError('Invalid read-only keeper catalog')
  const seen = new Set<string>(), keepers: AuxiliaryKeeper[] = []
  for (const row of value.keepers) {
    pathValue(row.path)
    if (seen.has(row.path) || inputs.nativeByPath.has(row.path) || !Number.isSafeInteger(row.bytes) || row.bytes < 1 || !/^[0-9a-f]{64}$/.test(row.sha256) || !row.xattrSha256 || !Array.isArray(row.acl)) throw ValidationError('Invalid or overlapping read-only keeper')
    const compatible = inputs.plan.mediaFiles.some(source => source.plannedReplacement && source.bytes === row.bytes && source.sha256 === row.sha256 && protectedMetadataClass(inputs.nativeByPath.get(source.path)!) === protectedMetadataClass(row))
    if (!compatible) throw ValidationError(`Read-only keeper does not match an authorized metadata class: ${row.path}`)
    seen.add(row.path); keepers.push({ ...nativeOnly(row), bytes: row.bytes })
  }
  keepers.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  return { sha256: digest(bytes), keepers }
}
const keeperPolicy = (inputs: Awaited<ReturnType<typeof loadInputs>>, compatible: boolean, auxiliary: AuxiliaryKeeper[] = []): { effectiveKeepers: Map<string, string>; retainedFiles: RetainedFile[] } => {
  const effectiveKeepers = new Map<string, string>(), retainedFiles: RetainedFile[] = []
  if (!compatible) {
    for (const row of inputs.plan.mediaFiles.filter(row => row.plannedReplacement)) effectiveKeepers.set(row.path, row.keeperPath!)
    return { effectiveKeepers, retainedFiles }
  }
  type Member = { path: string; bytes: number; plannedReplacement: boolean; group?: string; keeperPath?: string; sha256: string; native: NativeMetadata }
  const classes = new Map<string, Member[]>()
  for (const row of inputs.plan.mediaFiles) {
    const key = `${row.bytes}:${protectedMetadataClass(inputs.nativeByPath.get(row.path)!)}`, group = classes.get(key) ?? []
    group.push({ ...row, native: inputs.nativeByPath.get(row.path)! }); classes.set(key, group)
  }
  for (const row of auxiliary) {
    const key = `${row.bytes}:${protectedMetadataClass(row)}`, group = classes.get(key) ?? []
    group.push({ ...row, plannedReplacement: false, native: nativeOnly(row) }); classes.set(key, group)
  }
  for (const group of classes.values()) {
    group.sort((a, b) => Number(a.plannedReplacement) - Number(b.plannedReplacement) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
    const keeper = group[0]!
    for (const row of group.filter(row => row.plannedReplacement)) {
      if (row.path === keeper.path) retainedFiles.push({ path: row.path, keeperPath: row.keeperPath!, group: row.group!, bytes: row.bytes, sha256: row.sha256, reason: 'metadata-compatible-class-representative', native: inputs.nativeByPath.get(row.path)! })
      else effectiveKeepers.set(row.path, keeper.path)
    }
  }
  retainedFiles.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  return { effectiveKeepers, retainedFiles }
}
const validateReceiptRows = (inputs: Awaited<ReturnType<typeof loadInputs>>, receipt: MediaConsolidationReceipt, complete: boolean): Map<string, AppliedFile> => {
  const planned = new Map(inputs.plan.mediaFiles.filter(row => row.plannedReplacement).map(row => [row.path, row])), applied = new Map<string, AppliedFile>(), auxiliary = receipt.auxiliaryKeepers ?? [], policy = keeperPolicy(inputs, receipt.keeperPolicy === 'metadata-compatible', auxiliary)
  if (receipt.keeperPolicy !== undefined && !['metadata-compatible', 'original-plan-with-kernel-provenance'].includes(receipt.keeperPolicy) || !same(receipt.retainedFiles ?? [], policy.retainedFiles)) throw ValidationError('Receipt retained metadata-class representatives differ from the original authorized scope')
  const retained = new Set(policy.retainedFiles.map(row => row.path))
  for (const row of receipt.appliedFiles) {
    const authorized = planned.get(pathValue(row.path)), original = inputs.nativeByPath.get(row.path)
    const effectivePath = row.effectiveKeeperPath ?? row.keeperPath, external = auxiliary.find(file => file.path === effectivePath), effective = inputs.nativeByPath.get(pathValue(effectivePath)) ?? external, effectiveMedia = inputs.plan.mediaFiles.find(file => file.path === effectivePath)
    const keeperValid = receipt.keeperPolicy === 'metadata-compatible'
      ? effective && (external || effectiveMedia && (!effectiveMedia.plannedReplacement || retained.has(effectivePath))) && (external?.bytes ?? effectiveMedia?.bytes) === row.bytes && protectedMetadataClass(effective) === protectedMetadataClass(original!)
      : effectivePath === authorized?.keeperPath
    const expectedAfter = original && metadataAfterKernelAssignment(original, row.kernelAssignedXattrChanges, receipt.keeperPolicy === 'original-plan-with-kernel-provenance')
    if (!authorized || applied.has(row.path) || retained.has(row.path) || row.keeperPath !== authorized.keeperPath || !keeperValid || row.group !== authorized.group || row.bytes !== authorized.bytes || row.sha256 !== authorized.sha256 || !same(row.before, original) || !same(contentMetadata(row.after), contentMetadata(expectedAfter!)) || row.after.ino === row.before.ino || row.after.dev !== row.before.dev) throw ValidationError('Application receipt contains an unauthorized or inconsistent replacement')
    applied.set(row.path, row)
  }
  if (complete && (applied.size + retained.size !== planned.size || ![...planned.keys()].every(path => applied.has(path) || retained.has(path)))) throw ValidationError('Applied and retained path sets differ from authorized plan')
  const sum = receipt.appliedFiles.reduce((total, row) => total + row.bytes, 0)
  if (receipt.logicalReplacementBytes !== sum || complete && sum + policy.retainedFiles.reduce((total, row) => total + row.bytes, 0) !== [...planned.values()].reduce((total, row) => total + row.bytes, 0)) throw ValidationError('Application receipt replacement byte total mismatch')
  return applied
}

export const applyMediaConsolidation = async (projectRoot: string, planPath: string, output: string, dependencies: MediaConsolidationDependencies = {}): Promise<MediaConsolidationReceipt> => {
  const root = await rootPath(projectRoot)
  pathValue(planPath); pathValue(output)
  const inputs = await loadInputs(root, planPath)
  if (dependencies.expectedPlanSha256 && inputs.planSha256 !== dependencies.expectedPlanSha256) throw ValidationError('Plan differs from the explicitly authorized checksum')
  const resumed = dependencies.resumeReceipt ? await readReceipt(root, dependencies.resumeReceipt) : undefined
  if (resumed && (dirname(dependencies.resumeReceipt!) !== output || resumed.planPath !== planPath || resumed.planSha256 !== inputs.planSha256 || resumed.nativeBaselineSha256 !== inputs.nativeBaselineSha256 || !['running', 'failed'].includes(resumed.status))) throw ValidationError('Resume receipt differs from the original incomplete application')
  const catalogPath = dependencies.keeperCatalogPath ?? resumed?.keeperCatalogPath
  const acceptKernelProvenance = dependencies.acceptKernelProvenance || resumed?.keeperPolicy === 'original-plan-with-kernel-provenance'
  const adapter = dependencies.adapter ?? await createNativeMediaCloneAdapter({ acceptKernelProvenance })
  if (dependencies.acceptKernelProvenance && dependencies.metadataCompatibleKeepers) throw UsageError('Select one explicit keeper policy')
  if (catalogPath && !dependencies.metadataCompatibleKeepers && !acceptKernelProvenance && resumed?.keeperPolicy !== 'metadata-compatible') throw UsageError('Read-only keeper catalogs require the explicit metadata-compatible keeper policy')
  const catalog = catalogPath ? await readKeeperCatalog(root, catalogPath, inputs) : undefined
  if (resumed?.keeperCatalogPath && (resumed.keeperCatalogPath !== catalogPath || resumed.keeperCatalogSha256 !== catalog?.sha256 || !same(resumed.auxiliaryKeepers, catalog?.keepers))) throw ValidationError('Original read-only keeper catalog changed')
  const outputPath = await checked(root, output, true)
  for (const row of [...inputs.plan.mediaFiles, ...inputs.plan.preservedFiles]) if (row.path === output || row.path.startsWith(`${output}/`) || output.startsWith(`${row.path}/`)) throw ValidationError('Receipt output overlaps a source')
  if (!resumed) await mkdir(outputPath, { recursive: false, mode: 0o700 })
  const lease = await (dependencies.acquireLease ?? acquireProjectMaintenanceLease)(root)
  const receipt: MediaConsolidationReceipt = resumed ?? { schemaVersion: 1, operation: 'native-copy-on-write-consolidation', status: 'running', startedAt: new Date().toISOString(), planPath, planSha256: inputs.planSha256, nativeBaselinePath: inputs.nativeBaselinePath, nativeBaselineSha256: inputs.nativeBaselineSha256, logicalReplacementBytes: 0, appliedFiles: [], preservedFiles: [] }
  const journalFlags = constants.O_WRONLY | constants.O_NOFOLLOW | (resumed ? constants.O_APPEND : constants.O_CREAT | constants.O_EXCL)
  const journal = await checked(root, `${output}/journal.jsonl`, !resumed).then(path => open(path, journalFlags, 0o600)).catch(async error => { await lease.release(); throw error })
  const event = async (value: unknown): Promise<void> => { await journal.write(`${JSON.stringify(value)}\n`); await journal.sync() }
  try {
    await lease.assertHeld()
    const alreadyApplied = validateReceiptRows(inputs, receipt, false)
    if (acceptKernelProvenance && receipt.keeperPolicy !== 'original-plan-with-kernel-provenance') {
      const transition = { at: new Date().toISOString(), from: receipt.keeperPolicy ?? 'original-plan', to: 'original-plan-with-kernel-provenance', retainedPathsBefore: (receipt.retainedFiles ?? []).map(row => row.path) }
      receipt.policyHistory = [...receipt.policyHistory ?? [], transition]; receipt.keeperPolicy = 'original-plan-with-kernel-provenance'; receipt.retainedFiles = []
      validateReceiptRows(inputs, receipt, false)
      await event({ phase: 'kernel-assigned-provenance-policy-selected', ...transition, originalAuthorizedTargets: inputs.plan.mediaFiles.filter(row => row.plannedReplacement).length })
    } else if (receipt.keeperPolicy !== 'original-plan-with-kernel-provenance' && (dependencies.metadataCompatibleKeepers || receipt.keeperPolicy === 'metadata-compatible')) {
      receipt.keeperPolicy = 'metadata-compatible'
      if (catalog && catalogPath) { receipt.keeperCatalogPath = catalogPath; receipt.keeperCatalogSha256 = catalog.sha256; receipt.auxiliaryKeepers = catalog.keepers }
      receipt.retainedFiles = keeperPolicy(inputs, true, receipt.auxiliaryKeepers).retainedFiles
      validateReceiptRows(inputs, receipt, false)
      await event({ phase: 'metadata-compatible-keeper-policy-selected', retainedPaths: receipt.retainedFiles.map(row => row.path), existingAppliedFiles: alreadyApplied.size, keeperCatalogPath: receipt.keeperCatalogPath, keeperCatalogSha256: receipt.keeperCatalogSha256 })
    }
    const policy = keeperPolicy(inputs, receipt.keeperPolicy === 'metadata-compatible', receipt.auxiliaryKeepers), sourceMetadata = new Map(inputs.nativeByPath)
    for (const row of receipt.auxiliaryKeepers ?? []) {
      await checked(root, row.path)
      if (!same(await adapter.capture(root, row.path), nativeOnly(row)) || (await lstat(await checked(root, row.path))).size !== row.bytes) throw ValidationError(`Read-only keeper baseline changed: ${row.path}`)
      sourceMetadata.set(row.path, nativeOnly(row))
    }
    if (resumed) {
      const events = (await readFile(join(outputPath, 'journal.jsonl'), 'utf8')).split('\n').filter(Boolean).map(line => JSON.parse(line) as { phase: string; path?: string; clone?: NativeMetadata; effectiveKeeperPath?: string; kernelAssignedXattrChanges?: KernelAssignedXattrChange[] })
      for (const eventRow of events.filter(row => row.phase === 'ready-to-replace' && row.path && row.clone)) {
        if (alreadyApplied.has(eventRow.path!)) continue
        const authorized = inputs.plan.mediaFiles.find(row => row.path === eventRow.path && row.plannedReplacement && policy.effectiveKeepers.has(row.path)), original = inputs.nativeByPath.get(eventRow.path!)
        if (!authorized || !original) throw ValidationError('Resume journal contains an unauthorized replacement')
        const current = await adapter.capture(root, eventRow.path!)
        if (same(current, original)) continue
        const expectedAfter = metadataAfterKernelAssignment(original, eventRow.kernelAssignedXattrChanges, receipt.keeperPolicy === 'original-plan-with-kernel-provenance')
        if (current.ino !== eventRow.clone!.ino || current.dev !== original.dev || !same(contentMetadata(current), contentMetadata(expectedAfter))) throw ValidationError(`Interrupted replacement cannot be reconciled: ${eventRow.path}`)
        const recovered: AppliedFile = { path: authorized.path, keeperPath: authorized.keeperPath!, effectiveKeeperPath: eventRow.effectiveKeeperPath ?? authorized.keeperPath!, group: authorized.group, bytes: authorized.bytes, sha256: authorized.sha256, before: original, after: current }
        if (eventRow.kernelAssignedXattrChanges?.length) recovered.kernelAssignedXattrChanges = eventRow.kernelAssignedXattrChanges
        receipt.appliedFiles.push(recovered); receipt.logicalReplacementBytes += authorized.bytes; alreadyApplied.set(authorized.path, recovered)
        await event({ phase: 'reconciled-replacement', path: authorized.path, after: current })
      }
      await event({ phase: 'resumed', completedFiles: alreadyApplied.size })
    }
    // Validate the entire media and metadata baseline before any source replacement.
    for (const row of inputs.plan.mediaFiles) {
      await checked(root, row.path)
      const actual = await adapter.capture(root, row.path), expected = alreadyApplied.get(row.path)?.after ?? inputs.nativeByPath.get(row.path)!
      if (!same(actual, expected) || actual.sha256 !== row.sha256) throw ValidationError(`Native media baseline mismatch: ${row.path}`)
    }
    const preservedBefore = new Map(receipt.preservedFiles.map(row => [row.path, row]))
    if (resumed && alreadyApplied.size && (preservedBefore.size !== inputs.plan.preservedFiles.length || receipt.preservedFiles.length !== preservedBefore.size)) throw ValidationError('Resume metadata baseline set mismatch')
    const currentPreserved: PreservedIdentity[] = []
    for (const row of inputs.plan.preservedFiles) {
      if (await shaFile(root, row.path) !== row.sha256) throw ValidationError(`Preserved metadata changed: ${row.path}`)
      await checkPreservedPlanMetadata(root, row)
      const current = await identity(root, row.path, row.sha256)
      if (resumed && alreadyApplied.size && !same(current, preservedBefore.get(row.path))) throw ValidationError(`Resume metadata identity changed: ${row.path}`)
      currentPreserved.push(current)
    }
    receipt.preservedFiles = currentPreserved
    receipt.status = 'running'; delete receipt.error
    await saveReceipt(root, output, receipt)
    for (const row of inputs.plan.mediaFiles.filter(row => row.plannedReplacement && policy.effectiveKeepers.has(row.path) && !alreadyApplied.has(row.path))) {
      await lease.assertHeld()
      const effectiveKeeperPath = policy.effectiveKeepers.get(row.path)!, before = await adapter.capture(root, row.path), keeperBefore = await adapter.capture(root, effectiveKeeperPath)
      if (!same(before, inputs.nativeByPath.get(row.path)) || !same(keeperBefore, sourceMetadata.get(effectiveKeeperPath)) || before.nlink !== 1 || before.dev !== keeperBefore.dev) throw ValidationError(`Stale replacement or cross-device keeper: ${row.path}`)
      const target = await checked(root, row.path), keeper = await checked(root, effectiveKeeperPath), temporaryRelative = `${dirname(row.path)}/.cow-${crypto.randomUUID()}.tmp`, temporary = await checked(root, temporaryRelative, true)
      await event({ phase: 'clone-started', path: row.path, keeperPath: row.keeperPath, effectiveKeeperPath, temporaryPath: temporaryRelative, before })
      const assignment = await adapter.clone(keeper, temporary)
      const cloneIdentity = await identity(root, temporaryRelative, row.sha256)
      if (cloneIdentity.ino === before.ino || cloneIdentity.ino === keeperBefore.ino || cloneIdentity.nlink !== 1 || cloneIdentity.dev !== before.dev) throw ValidationError(`Clone is not an independent regular file: ${row.path}`)
      const changes = kernelChanges(before, assignment, receipt.keeperPolicy === 'original-plan-with-kernel-provenance'), expectedAfter = metadataAfterKernelAssignment(before, changes, receipt.keeperPolicy === 'original-plan-with-kernel-provenance')
      if (receipt.keeperPolicy === 'original-plan-with-kernel-provenance') {
        const atCreation = await adapter.capture(root, temporaryRelative)
        if (!assignment || (atCreation.xattrSha256[KERNEL_PROVENANCE] ?? null) !== assignment.kernelAssignedXattrs[KERNEL_PROVENANCE] || atCreation.sha256 !== row.sha256 || atCreation.ino !== cloneIdentity.ino) throw ValidationError(`Native clone kernel assignment changed before metadata copying: ${row.path}`)
        await event({ phase: 'native-kernel-assignment-captured', path: row.path, temporaryPath: temporaryRelative, assignment, kernelAssignedXattrChanges: changes })
      }
      await adapter.copyMetadata(target, temporary)
      const clone = await adapter.capture(root, temporaryRelative), cloneAsTarget = { ...clone, path: row.path }
      if (!same(contentMetadata(cloneAsTarget), contentMetadata(expectedAfter)) || clone.ino === before.ino || clone.ino === keeperBefore.ino || clone.nlink !== 1 || clone.dev !== before.dev) throw ValidationError(`Clone integrity or metadata mismatch: ${row.path}`)
      await dependencies.beforeReplace?.(row.path)
      await lease.assertHeld()
      if (!same(await adapter.capture(root, row.path), before) || !same(await adapter.capture(root, effectiveKeeperPath), keeperBefore)) throw ValidationError(`Source changed before atomic replacement: ${row.path}`)
      await event({ phase: 'ready-to-replace', path: row.path, effectiveKeeperPath, temporaryPath: temporaryRelative, clone: cloneAsTarget, kernelAssignedXattrChanges: changes })
      await rename(temporary, target)
      const parent = await open(dirname(target), constants.O_RDONLY)
      try { await parent.sync() } finally { await parent.close() }
      const after = await adapter.capture(root, row.path)
      if (!same(contentMetadata(after), contentMetadata(expectedAfter)) || after.ino !== clone.ino) throw ValidationError(`Post-replacement verification failed: ${row.path}`)
      const applied: AppliedFile = { path: row.path, keeperPath: row.keeperPath!, effectiveKeeperPath, group: row.group, bytes: row.bytes, sha256: row.sha256, before, after }
      if (changes.length) applied.kernelAssignedXattrChanges = changes
      receipt.appliedFiles.push(applied); receipt.logicalReplacementBytes += row.bytes
      await event({ phase: 'replaced-and-verified', path: row.path, after })
      await saveReceipt(root, output, receipt)
    }
    await lease.assertHeld()
    validateReceiptRows(inputs, receipt, true)
    for (const row of receipt.auxiliaryKeepers ?? []) if (!same(await adapter.capture(root, row.path), nativeOnly(row))) throw ValidationError(`Read-only keeper changed during consolidation: ${row.path}`)
    if (receipt.keeperCatalogPath && digest(await readFile(await checked(root, receipt.keeperCatalogPath))) !== receipt.keeperCatalogSha256) throw ValidationError('Read-only keeper catalog changed during consolidation')
    for (const before of receipt.preservedFiles) if (await shaFile(root, before.path) !== before.sha256 || !same(await identity(root, before.path, before.sha256), before)) throw ValidationError(`Preserved metadata changed during consolidation: ${before.path}`)
    receipt.status = 'complete'; receipt.completedAt = new Date().toISOString(); await saveReceipt(root, output, receipt)
    return receipt
  } catch (error) {
    receipt.status = 'failed'; receipt.error = (error instanceof Error ? error.message : String(error)).replaceAll(`${root}/`, ''); await event({ phase: 'failed', error: receipt.error }); await saveReceipt(root, output, receipt); throw error
  } finally { try { await journal.close() } finally { await lease.release() } }
}

export const verifyAppliedMediaConsolidation = async (projectRoot: string, receiptPath: string, adapter?: MediaCloneAdapter): Promise<{ appliedFiles: number; logicalReplacementBytes: number; retainedFiles: number; retainedLogicalBytes: number; kernelAssignedXattrTransitions: number; verifiedMediaFiles: number; verifiedMetadataFiles: number }> => {
  const root = await rootPath(projectRoot), receipt = await readReceipt(root, receiptPath)
  if (receipt.status !== 'complete') throw ValidationError('Application is incomplete')
  const inputs = await loadInputs(root, receipt.planPath), engine = adapter ?? await createNativeMediaCloneAdapter()
  if (inputs.planSha256 !== receipt.planSha256 || inputs.nativeBaselineSha256 !== receipt.nativeBaselineSha256) throw ValidationError('Original preparation artifacts changed')
  if (receipt.keeperCatalogPath) {
    const catalog = await readKeeperCatalog(root, receipt.keeperCatalogPath, inputs)
    if (!['metadata-compatible', 'original-plan-with-kernel-provenance'].includes(receipt.keeperPolicy ?? '') || catalog.sha256 !== receipt.keeperCatalogSha256 || !same(catalog.keepers, receipt.auxiliaryKeepers)) throw ValidationError('Read-only keeper catalog verification mismatch')
    for (const row of catalog.keepers) if (!same(await engine.capture(root, row.path), nativeOnly(row))) throw ValidationError(`Read-only keeper verification mismatch: ${row.path}`)
  } else if (receipt.keeperCatalogSha256 || receipt.auxiliaryKeepers?.length) throw ValidationError('Unbound read-only keeper records')
  const applied = validateReceiptRows(inputs, receipt, true)
  for (const row of inputs.plan.mediaFiles) {
    await checked(root, row.path)
    const expected = applied.get(row.path)?.after ?? inputs.nativeByPath.get(row.path)!
    if (!same(await engine.capture(root, row.path), expected) || expected.sha256 !== row.sha256) throw ValidationError(`Applied media verification mismatch: ${row.path}`)
  }
  const preserved = new Map(receipt.preservedFiles.map(row => [row.path, row])), expectedPreserved = new Map(inputs.plan.preservedFiles.map(row => [row.path, row]))
  if (preserved.size !== receipt.preservedFiles.length || preserved.size !== expectedPreserved.size || ![...expectedPreserved].every(([path, row]) => preserved.get(path)?.sha256 === row.sha256)) throw ValidationError('Preserved metadata set mismatch')
  for (const row of receipt.preservedFiles) {
    await checkPreservedPlanMetadata(root, expectedPreserved.get(row.path)!)
    if (await shaFile(root, row.path) !== row.sha256 || !same(await identity(root, row.path, row.sha256), row)) throw ValidationError(`Preserved metadata verification mismatch: ${row.path}`)
  }
  return { appliedFiles: applied.size, logicalReplacementBytes: receipt.logicalReplacementBytes, retainedFiles: receipt.retainedFiles?.length ?? 0, retainedLogicalBytes: (receipt.retainedFiles ?? []).reduce((sum, row) => sum + row.bytes, 0), kernelAssignedXattrTransitions: receipt.appliedFiles.reduce((sum, row) => sum + (row.kernelAssignedXattrChanges?.length ?? 0), 0), verifiedMediaFiles: inputs.plan.mediaFiles.length, verifiedMetadataFiles: receipt.preservedFiles.length }
}

export const resumeMediaConsolidation = async (projectRoot: string, receiptPath: string, dependencies: MediaConsolidationDependencies = {}): Promise<MediaConsolidationReceipt> => {
  const root = await rootPath(projectRoot), receipt = await readReceipt(root, receiptPath)
  return await applyMediaConsolidation(root, receipt.planPath, dirname(receiptPath), { ...dependencies, expectedPlanSha256: receipt.planSha256, resumeReceipt: receiptPath })
}

if (import.meta.main) {
  const args = Bun.argv.slice(2), values = new Map<string, string>()
  for (let index = 0; index < args.length; index++) {
    const key = args[index]!
    if (['--metadata-compatible-keepers', '--accept-kernel-provenance'].includes(key) && !values.has(key)) { values.set(key, 'true'); continue }
    const value = args[++index]
    if (!['--root', '--plan', '--output', '--verify', '--resume', '--expected-plan-sha256', '--keeper-catalog'].includes(key) || !value || value.startsWith('--') || values.has(key)) throw UsageError('Usage: apply-media-consolidation.ts --root PATH (--plan RELATIVE_PLAN --output NEW_RECEIPT_DIRECTORY --expected-plan-sha256 HASH | --verify RELATIVE_RECEIPT | --resume RELATIVE_RECEIPT) [--accept-kernel-provenance | --metadata-compatible-keepers [--keeper-catalog RELATIVE_JSON]]')
    values.set(key, value)
  }
  const root = values.get('--root')
  const compatible = values.has('--metadata-compatible-keepers'), acceptKernelProvenance = values.has('--accept-kernel-provenance'), expectedArguments = (compatible ? 1 : 0) + (acceptKernelProvenance ? 1 : 0) + (values.has('--keeper-catalog') ? 1 : 0)
  if (compatible && acceptKernelProvenance) throw UsageError('Select one explicit keeper policy')
  if (values.has('--keeper-catalog') && !compatible) throw UsageError('--keeper-catalog requires --metadata-compatible-keepers')
  if (!root || (values.has('--verify') ? values.size !== 2 : values.has('--resume') ? values.size !== 2 + expectedArguments : values.size !== 4 + expectedArguments || !values.has('--plan') || !values.has('--output') || !/^[0-9a-f]{64}$/.test(values.get('--expected-plan-sha256') ?? ''))) throw UsageError('Expected --root and --plan/--output/--expected-plan-sha256 or --verify/--resume')
  const keeperOption = values.has('--keeper-catalog') ? { keeperCatalogPath: values.get('--keeper-catalog')! } : {}
  const result = values.has('--verify') ? await verifyAppliedMediaConsolidation(root, values.get('--verify')!) : values.has('--resume') ? await resumeMediaConsolidation(root, values.get('--resume')!, { metadataCompatibleKeepers: compatible, acceptKernelProvenance, ...keeperOption }) : await applyMediaConsolidation(root, values.get('--plan')!, values.get('--output')!, { expectedPlanSha256: values.get('--expected-plan-sha256')!, metadataCompatibleKeepers: compatible, acceptKernelProvenance, ...keeperOption })
  writeCommandPayload(JSON.stringify('status' in result ? { status: result.status, appliedFiles: result.appliedFiles.length, logicalReplacementBytes: result.logicalReplacementBytes, retainedFiles: result.retainedFiles?.length ?? 0, retainedLogicalBytes: (result.retainedFiles ?? []).reduce((sum, row) => sum + row.bytes, 0), kernelAssignedXattrTransitions: result.appliedFiles.reduce((sum, row) => sum + (row.kernelAssignedXattrChanges?.length ?? 0), 0) } : result) + '\n')
}
