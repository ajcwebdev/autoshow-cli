import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { deflateSync } from 'node:zlib'
import * as v from 'valibot'
import { AppUsageError, AppValidationError } from '~/utils/error-handler'
import { PROJECT_ROOT } from '~/utils/project-root'
import { writeCommandPayload } from '~/utils/app-logger/result-emitter'
import { decodePngRgba8 } from '~/utils/lossless-png'
import { normalizeHistoricalReference } from './prepare-historical-newspapers'

export const CAPACITY_MAPPING = 'input/examples/document/ocr-newspaper-expansion/long-page-protocol-v2/mapping.json'
export const CAPACITY_GUARD = 'src/tools/ocr-capacity-spending-guard.ts'
const text = v.pipe(v.string(), v.nonEmpty())
const digest = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/))
const natural = v.pipe(v.number(), v.integer(), v.minValue(0))
const positive = v.pipe(natural, v.minValue(1))
const id = v.pipe(text, v.regex(/^[a-z0-9][a-z0-9-]*$/))
const pin = v.object({ path: text, sha256: digest })
export const capacityReferenceReviewSchema = v.object({ schemaVersion: v.literal(1), kind: v.literal('ocr-capacity-reference-review'),
  planSha256: digest, status: v.literal('accepted'), regionIds: v.array(text),
  completeSourceMapping: v.literal(true), reviewedGeometry: v.literal(true),
  referenceSpansAssignedOnce: v.literal(true), providerOutputUsedAsReference: v.literal(false), reviewer: text })
const mappingSchema = v.object({
  schemaVersion: v.literal(1), kind: v.literal('ocr-capacity-region-mapping'), protocolId: id, sourceCaseId: id,
  sourceImage: v.object({ ...pin.entries, width: positive, height: positive }),
  sourceReference: v.object({ ...pin.entries, kind: v.literal('publisher-canonical'), independentOfProviders: v.literal(true),
    sourceUrl: text, sourceRevision: text }),
  protectedArtifacts: v.pipe(v.array(pin), v.minLength(1)),
  maximumHorizontalGutterOverlap: v.pipe(natural, v.maxValue(4)),
  regions: v.pipe(v.array(v.object({ id, x: natural, y: natural, width: positive, height: positive,
    spans: v.pipe(v.array(v.object({ id, start: natural, end: positive, sha256: digest })), v.minLength(1)),
    readingOrder: text })), v.minLength(1)),
  target: v.object({ provider: v.literal('gemini'), model: v.literal('gemini-3.8-flash'),
    reasoningEffort: v.literal('low'), maxOutputTokens: v.literal(8192), inputTokenAllowance: v.literal(64000),
    attemptsPerRegion: v.literal(3), globalConcurrency: v.literal(1),
    pricing: v.object({ inputCentsPerMillion: v.literal(150), outputCentsPerMillion: v.literal(750),
      registry: pin, sourceUrl: text, checkedAt: text }) }),
  rights: v.object({ imageLicense: text, referenceLicense: text, attribution: text }),
  review: v.object({ scope: text, independentFinalReview: v.boolean(), reviewEvidence: v.optional(pin) })
})
export type CapacityMapping = v.InferOutput<typeof mappingSchema>
export interface CapacityProtocolOptions { projectRoot?: string, mappingPath?: string }
export const capacityHash = (value: Uint8Array | string): string => new Bun.CryptoHasher('sha256').update(value).digest('hex')
const json = (value: unknown): string => JSON.stringify(value, null, 2) + '\n'
const portable = (path: string): void => {
  if (isAbsolute(path) || /[:\\\x00]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) throw new AppValidationError('Expected a normalized project-relative capacity artifact path')
}
export const capacityExistingPath = async (root: string, path: string): Promise<string> => {
  portable(path)
  const actual = await realpath(resolve(root, path)).catch(() => { throw new AppValidationError(`Missing capacity artifact: ${path}`) })
  const rel = relative(root, actual)
  if (isAbsolute(rel) || rel === '..' || rel.startsWith(`..${sep}`)) throw new AppValidationError('Capacity artifact escapes project root')
  return actual
}
export const writeNewCapacityEvidence = async (root: string, path: string, bytes: Uint8Array | string): Promise<void> => {
  portable(path)
  let parent = root
  for (const part of dirname(path).split('/')) {
    parent = resolve(parent, part)
    try { await mkdir(parent) } catch (error) { if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'EEXIST') throw error }
    const info = await lstat(parent)
    if (!info.isDirectory() || info.isSymbolicLink()) throw new AppValidationError('Capacity output ancestor is not a real directory')
  }
  const absolute = resolve(root, path), info = await lstat(absolute).catch(error => {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return undefined
    throw error
  })
  if (info) {
    if (!info.isFile() || info.isSymbolicLink() || capacityHash(new Uint8Array(await readFile(absolute))) !== capacityHash(bytes)) throw new AppValidationError(`Refusing to overwrite changed capacity evidence: ${path}`)
    return
  }
  await writeFile(absolute, bytes, { flag: 'wx', mode: 0o600 })
}

/** One source code unit belongs to one span; regional order may differ from article-logical order. */
export const assertCapacityReferenceCoverage = (source: string, regions: CapacityMapping['regions']): void => {
  const spans = regions.flatMap(region => region.spans)
  if (!source.trim() || new Set(spans.map(span => span.id)).size !== spans.length) throw new AppValidationError('Empty source or duplicate capacity reference span')
  const sorted = [...spans].sort((a, b) => a.start - b.start)
  let cursor = 0
  for (const span of sorted) {
    if (span.start !== cursor || span.end <= span.start || span.end > source.length) throw new AppValidationError('Capacity spans must cover the complete source exactly once without gaps or overlap')
    for (const boundary of [span.start, span.end]) {
      if (boundary > 0 && boundary < source.length && /[\p{L}\p{N}]/u.test(source[boundary - 1]!) && /[\p{L}\p{N}]/u.test(source[boundary]!)) throw new AppValidationError('Capacity span splits a printed word')
    }
    if (capacityHash(source.slice(span.start, span.end)) !== span.sha256) throw new AppValidationError('Capacity reference span hash changed')
    cursor = span.end
  }
  if (cursor !== source.length) throw new AppValidationError('Capacity spans omit the end of the source')
}

/** Cover all source pixels; only explicitly bounded horizontal gutter overlap is allowed. */
export const assertCapacityGeometry = (width: number, height: number, regions: CapacityMapping['regions'], overlap: number): void => {
  if (!regions.length || new Set(regions.map(region => region.id)).size !== regions.length) throw new AppValidationError('Duplicate or empty capacity regions')
  for (const region of regions) {
    if (!Number.isInteger(region.x) || !Number.isInteger(region.y) || !Number.isInteger(region.width) || !Number.isInteger(region.height)
      || region.x < 0 || region.y < 0 || region.width < 1 || region.height < 1 || region.x + region.width > width || region.y + region.height > height) throw new AppValidationError('Capacity region escapes source image bounds')
  }
  for (let i = 0; i < regions.length; i++) for (let j = i + 1; j < regions.length; j++) {
    const a = regions[i]!, b = regions[j]!, x = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x), y = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
    if (x > 0 && y > 0 && (x > overlap || a.x === b.x)) throw new AppValidationError('Capacity geometry overlaps outside the reviewed horizontal gutters')
  }
  const boundaries = [...new Set([0, height, ...regions.flatMap(region => [region.y, region.y + region.height])])].sort((a, b) => a - b)
  for (let i = 0; i + 1 < boundaries.length; i++) {
    const y = boundaries[i]!, end = boundaries[i + 1]!
    const ranges = regions.filter(region => region.y <= y && region.y + region.height >= end).map(region => [region.x, region.x + region.width] as const).sort((a, b) => a[0] - b[0])
    let covered = 0
    for (const [start, stop] of ranges) { if (start > covered) throw new AppValidationError('Capacity geometry omits source pixels'); covered = Math.max(covered, stop) }
    if (covered !== width) throw new AppValidationError('Capacity geometry omits source pixels')
    const events = ranges.flatMap(([start, stop]) => [[start, 1], [stop, -1]]).sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!)
    let count = 0
    for (const event of events) { count += event[1]!; if (count > 2) throw new AppValidationError('Capacity geometry duplicates a gutter more than twice') }
  }
}

const pngChunk = (type: string, bytes: Uint8Array): Uint8Array => {
  const output = new Uint8Array(bytes.length + 12), view = new DataView(output.buffer)
  view.setUint32(0, bytes.length); output.set(Buffer.from(type), 4); output.set(bytes, 8)
  view.setUint32(bytes.length + 8, Bun.hash.crc32(output.subarray(4, bytes.length + 8)))
  return output
}
const cropPng = (source: ReturnType<typeof decodePngRgba8>, region: CapacityMapping['regions'][number]): Uint8Array => {
  const rows = new Uint8Array((region.width * 4 + 1) * region.height)
  for (let row = 0; row < region.height; row++) {
    const start = ((region.y + row) * source.width + region.x) * 4
    rows.set(source.pixels.subarray(start, start + region.width * 4), row * (region.width * 4 + 1) + 1)
  }
  const header = new Uint8Array(13), view = new DataView(header.buffer)
  view.setUint32(0, region.width); view.setUint32(4, region.height); header[8] = 8; header[9] = 6
  const bytes = new Uint8Array(Buffer.concat([Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10), pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(rows, { level: 9 })), pngChunk('IEND', new Uint8Array())]))
  const decoded = decodePngRgba8(bytes)
  for (let row = 0; row < region.height; row++) {
    const start = ((region.y + row) * source.width + region.x) * 4
    if (!source.pixels.subarray(start, start + region.width * 4).every((value, column) => value === decoded.pixels[row * region.width * 4 + column])) throw new AppValidationError('Capacity crop changed source pixels')
  }
  return bytes
}

const collect = async (options: CapacityProtocolOptions) => {
  const root = await realpath(options.projectRoot ?? PROJECT_ROOT), mappingPath = options.mappingPath ?? CAPACITY_MAPPING
  portable(mappingPath)
  if (!mappingPath.startsWith('input/')) throw new AppValidationError('Capacity preparation belongs under the existing input tree')
  const read = async (path: string) => new Uint8Array(await readFile(await capacityExistingPath(root, path)))
  const mappingBytes = await read(mappingPath), mapping = v.parse(mappingSchema, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(mappingBytes)))
  const sourceBytes = await read(mapping.sourceImage.path), textBytes = await read(mapping.sourceReference.path)
  if (capacityHash(sourceBytes) !== mapping.sourceImage.sha256 || capacityHash(textBytes) !== mapping.sourceReference.sha256) throw new AppValidationError('Pinned capacity image or publisher reference changed')
  for (const artifact of [...mapping.protectedArtifacts, mapping.target.pricing.registry, ...(mapping.review.reviewEvidence ? [mapping.review.reviewEvidence] : [])]) if (capacityHash(await read(artifact.path)) !== artifact.sha256) throw new AppValidationError(`Protected capacity evidence changed: ${artifact.path}`)
  const registry: unknown = JSON.parse(new TextDecoder().decode(await read(mapping.target.pricing.registry.path)))
  const registered = (registry as { gemini?: { models?: Record<string, { costPerMInputTokensCents?: number, costPerMOutputTokensCents?: number }> } } | null)?.gemini?.models?.[mapping.target.model]
  if (registered?.costPerMInputTokensCents !== mapping.target.pricing.inputCentsPerMillion || registered.costPerMOutputTokensCents !== mapping.target.pricing.outputCentsPerMillion) throw new AppValidationError('Capacity reviewed rates differ from the pinned runtime registry')
  const source = decodePngRgba8(sourceBytes), native = await new Bun.Image(sourceBytes, { autoOrient: false, maxPixels: 3072 * 3072 }).metadata()
  if (native.format !== 'png' || source.width !== mapping.sourceImage.width || source.height !== mapping.sourceImage.height || native.width !== source.width || native.height !== source.height || source.width > 3072 || source.height > 3072 || sourceBytes.length > 5 * 1024 * 1024) throw new AppValidationError('Capacity source exceeds reviewed PNG integrity/dimension limits')
  const canonical = new TextDecoder('utf-8', { fatal: true }).decode(textBytes)
  assertCapacityGeometry(source.width, source.height, mapping.regions, mapping.maximumHorizontalGutterOverlap)
  assertCapacityReferenceCoverage(canonical, mapping.regions)
  const base = `${dirname(mappingPath)}/prepared`, outputs = new Map<string, Uint8Array | string>()
  const regions = mapping.regions.map(region => {
    const bytes = cropPng(source, region), reference = region.spans.map(span => canonical.slice(span.start, span.end).trim()).join('\n\n') + '\n'
    const normalized = normalizeHistoricalReference(reference), directory = `${base}/regions/${region.id}`
    const input = `${directory}/input.png`, referencePath = `${directory}/canonical-reference.txt`, normalizedPath = `${directory}/normalized-reference.txt`
    outputs.set(input, bytes); outputs.set(referencePath, reference); outputs.set(normalizedPath, normalized)
    return { id: region.id, x: region.x, y: region.y, width: region.width, height: region.height,
      input, inputSha256: capacityHash(bytes), pixelSha256: decodePngRgba8(bytes).pixelSha256,
      reference: referencePath, referenceSha256: capacityHash(reference), normalizedReference: normalizedPath, normalizedReferenceSha256: capacityHash(normalized),
      referenceWordCount: normalized.trim().split(/\s+/).length, spans: region.spans, readingOrder: region.readingOrder }
  })
  const perAttemptCents = (mapping.target.inputTokenAllowance * mapping.target.pricing.inputCentsPerMillion + mapping.target.maxOutputTokens * mapping.target.pricing.outputCentsPerMillion) / 1_000_000
  const totalReservedCents = Math.round(perAttemptCents * mapping.target.attemptsPerRegion * regions.length * 1_000_000) / 1_000_000
  const planPath = `${base}/execution-plan.json`, ledgerPath = `${base}/spending-ledger.json`, approvalPath = `${base}/approval.json`
  const plan = { schemaVersion: 1, kind: 'ocr-capacity-execution-plan' as const, protocolId: mapping.protocolId,
    mappingPath, mappingSha256: capacityHash(mappingBytes), sourceCaseId: mapping.sourceCaseId,
    sourceImage: mapping.sourceImage, sourceReference: mapping.sourceReference, protectedArtifacts: mapping.protectedArtifacts,
    regions, target: mapping.target, review: mapping.review, rights: mapping.rights,
    coverage: { sourceCodeUnits: canonical.length, sourceWords: normalizeHistoricalReference(canonical).trim().split(/\s+/).length,
      allSourceTextAssignedExactlyOnce: true, allSourcePixelsCovered: true, maximumHorizontalGutterOverlap: mapping.maximumHorizontalGutterOverlap,
      globalTextReconstruction: 'Sort source spans by their original offsets; concatenation reproduces the frozen canonical reference exactly. Regional references follow visible regional reading order.',
      scoreScope: 'Region recognition under the declared publisher serialization. No automatic whole-page replacement score or provider-text deduplication.' },
    spending: { inputTokenAllowance: mapping.target.inputTokenAllowance, outputTokenCeiling: mapping.target.maxOutputTokens,
      perAttemptReservedCents: perAttemptCents, attemptsPerRegion: mapping.target.attemptsPerRegion, maximumRequests: regions.length * mapping.target.attemptsPerRegion,
      onePassReservedCents: Math.round(perAttemptCents * regions.length * 1_000_000) / 1_000_000, totalReservedCents, approvalBudgetCents: Math.ceil(totalReservedCents),
      inputAllowanceCaveat: 'Unmeasured 64000-input-token reservation for one pinned PNG and bounded OCR text/schema; not a provider-enforced input ceiling. A reported allowance breach retains the full reservation and stops dispatch.',
      outputBilling: 'Candidate and thinking tokens are valued together at the reviewed output rate; no implicit caching discount or promotion is credited.',
      accountingCaveat: 'Reviewed-rate reservations and usage are not invoice settlement.' },
    ledger: ledgerPath, approval: approvalPath, referenceReview: `${base}/reference-review.json`, executionAuthorized: false, admitted: false,
    restrictions: { originalGrokSlotRedispatch: 'permanently-prohibited', targetOnly: `${mapping.target.provider}/${mapping.target.model}`, noHistoricalLedgerMutation: true,
      onlyReviewedInlinePng: true, noProviderReferenceText: true, noAutomaticAmbiguousRedispatch: true } }
  const planBytes = json(plan), planSha256 = capacityHash(planBytes)
  outputs.set(planPath, planBytes)
  const scope = { schemaVersion: 1, kind: 'ocr-capacity-dispatch-scope', protocolId: mapping.protocolId, plan: planPath, planSha256,
    approvalRequired: true, executionAuthorized: false, globalConcurrency: 1,
    jobs: regions.map(region => {
      const cli = ['src/cli/create-cli.ts', 'extract', region.input, '--provider', 'gemini=gemini-3.8-flash', '--reasoning-effort', 'low', '--provider-concurrency', '1', '--step-concurrency', 'ocr-page=1', '--output-dir', `${dirname(mappingPath)}/runs/${region.id}`, '--json']
      return { regionId: region.id,
        priceCommand: ['bun', '--no-env-file', ...cli, '--price'],
        proposedGuardedCommand: ['env', 'AUTOSHOW_OCR_CAPACITY_GUARD=1', `AUTOSHOW_OCR_CAPACITY_PLAN=${planPath}`, `AUTOSHOW_OCR_CAPACITY_PLAN_SHA256=${planSha256}`, `AUTOSHOW_OCR_CAPACITY_REGION=${region.id}`,
          'bun', '--preload', CAPACITY_GUARD, ...cli] }
    }) }
  outputs.set(`${base}/dispatch-scope.json`, json(scope))
  return { root, mappingPath, mapping, plan, planPath, planSha256, ledgerPath, approvalPath, outputs, sourcePixelSha256: source.pixelSha256 }
}

const checkAuxiliary = async (context: Awaited<ReturnType<typeof collect>>) => {
  const ledger: unknown = JSON.parse(await Bun.file(await capacityExistingPath(context.root, context.ledgerPath)).text())
  if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) throw new AppValidationError('Invalid capacity ledger')
  const row = ledger as Record<string, unknown>
  if (row['kind'] !== 'ocr-capacity-spending-ledger' || row['schemaVersion'] !== 1 || row['planSha256'] !== context.planSha256 || row['budgetCents'] !== context.plan.spending.approvalBudgetCents || !Array.isArray(row['receipts'])) throw new AppValidationError('Capacity ledger differs from the frozen plan')
}
export const inspectOcrCapacityProtocol = async (options: CapacityProtocolOptions = {}) => {
  const context = await collect(options)
  let independentReviewComplete = false
  if (await Bun.file(resolve(context.root, context.plan.referenceReview)).exists()) {
    const review = v.parse(capacityReferenceReviewSchema, JSON.parse(await Bun.file(await capacityExistingPath(context.root, context.plan.referenceReview)).text()))
    if (review.planSha256 !== context.planSha256 || JSON.stringify(review.regionIds) !== JSON.stringify(context.plan.regions.map(region => region.id))) throw new AppValidationError('Capacity reference review belongs to a different prepared scope')
    independentReviewComplete = true
  }
  return { kind: 'ocr-capacity-protocol-inspection', protocolId: context.plan.protocolId, regionCount: context.plan.regions.length,
    referenceWords: context.plan.coverage.sourceWords, perRegionWords: context.plan.regions.map(region => ({ id: region.id, words: region.referenceWordCount })),
    plannedMaximumRequests: context.plan.spending.maximumRequests, totalReservedCents: context.plan.spending.totalReservedCents,
    approvalBudgetCents: context.plan.spending.approvalBudgetCents, planPath: context.planPath, planSha256: context.planSha256,
    independentReviewComplete, executionAuthorized: false, admitted: false, providerCalls: 0 }
}
export const prepareOcrCapacityProtocol = async (options: CapacityProtocolOptions = {}) => {
  const context = await collect(options)
  for (const [path, bytes] of context.outputs) await writeNewCapacityEvidence(context.root, path, bytes)
  if (!await Bun.file(resolve(context.root, context.ledgerPath)).exists()) await writeNewCapacityEvidence(context.root, context.ledgerPath, json({ schemaVersion: 1,
    kind: 'ocr-capacity-spending-ledger', protocolId: context.plan.protocolId, planSha256: context.planSha256,
    budgetCents: context.plan.spending.approvalBudgetCents, approvalSha256: null, receipts: [] }))
  if (!await Bun.file(resolve(context.root, context.approvalPath)).exists()) await writeNewCapacityEvidence(context.root, context.approvalPath, json({ schemaVersion: 1,
    kind: 'ocr-capacity-exact-approval', status: 'required', protocolId: context.plan.protocolId, planSha256: context.planSha256,
    target: 'gemini/gemini-3.8-flash', regionIds: context.plan.regions.map(region => region.id), attemptsPerRegion: 3,
    budgetCents: context.plan.spending.approvalBudgetCents, inputAllowanceAcknowledged: false,
    evidence: 'Explicit approval of this exact dispatch scope, cumulative budget and input-allowance risk is still required.' }))
  await checkAuxiliary(context)
  return await inspectOcrCapacityProtocol(options)
}
export const validateOcrCapacityProtocol = async (options: CapacityProtocolOptions = {}) => {
  const context = await collect(options)
  for (const [path, expected] of context.outputs) if (capacityHash(new Uint8Array(await readFile(await capacityExistingPath(context.root, path)))) !== capacityHash(expected)) throw new AppValidationError(`Prepared capacity artifact differs from the pinned mapping: ${path}`)
  await checkAuxiliary(context)
  return { ...(await inspectOcrCapacityProtocol(options)), protectedArtifactsVerified: context.mapping.protectedArtifacts.length,
    derivedArtifactsVerified: context.outputs.size, writes: 0 }
}
export type CapacityExecutionPlan = Awaited<ReturnType<typeof collect>>['plan']

if (import.meta.main) {
  try {
    const args = Bun.argv.slice(2), action = args[0] ?? '--validate'
    if (args.length > 1 || !['--prepare', '--validate', '--price', '--help'].includes(action)) throw new AppUsageError('Usage: bun src/tools/ocr-preparation/prepare-capacity-protocol.ts [--prepare | --validate | --price | --help]')
    if (action === '--help') writeCommandPayload('Prepare or validate pinned OCR regions and an approval-required budget scope. --price is local reservation arithmetic; no provider calls. This helper has no dispatch action.\n')
    else writeCommandPayload(json(action === '--prepare' ? await prepareOcrCapacityProtocol() : action === '--price' ? await inspectOcrCapacityProtocol() : await validateOcrCapacityProtocol()))
  } catch (error) { writeCommandPayload((error instanceof Error ? error.message : 'Capacity preparation failed') + '\n', 'stderr'); process.exitCode = 1 }
}
