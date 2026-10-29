import { randomUUID } from 'node:crypto'
import { open, readFile, realpath, rename, unlink } from 'node:fs/promises'
import { dirname } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import * as v from 'valibot'
import { AppValidationError } from '~/utils/error-handler'
import { PROJECT_ROOT } from '~/utils/project-root'
import { sleepWithAbortSignal } from '~/utils/retry-abortable-delay'
import { decodePngRgba8 } from '~/utils/lossless-png'
import { buildHostedOcrJsonPrompt, HOSTED_OCR_PAGES_JSON_SCHEMA } from '~/cli/commands/text/ocr/ocr-utils/hosted-ocr-json'
import { capacityExistingPath, capacityHash, capacityReferenceReviewSchema, validateOcrCapacityProtocol, writeNewCapacityEvidence, type CapacityExecutionPlan } from './ocr-preparation/prepare-capacity-protocol'

const text = v.pipe(v.string(), v.nonEmpty())
const digest = v.pipe(v.string(), v.regex(/^[a-f0-9]{64}$/))
const count = v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(Number.MAX_SAFE_INTEGER))
const amount = v.pipe(v.number(), v.finite(), v.minValue(0))
const pin = v.object({ path: text, sha256: digest })
const approvalSchema = v.strictObject({ schemaVersion: v.literal(1), kind: v.literal('ocr-capacity-exact-approval'),
  status: v.literal('approved'), protocolId: text, planSha256: digest, target: v.literal('gemini/gemini-3.8-flash'),
  regionIds: v.array(text), attemptsPerRegion: v.literal(3), budgetCents: amount,
  inputAllowanceAcknowledged: v.literal(true), evidence: v.pipe(text, v.minLength(12)), referenceReview: pin })
const receiptSchema = v.strictObject({ id: text, regionId: text, requestSha256: digest, createdAt: text,
  status: v.picklist(['reserved', 'settled', 'ambiguous', 'breach', 'rejected']), reservedCents: amount, chargedCents: amount,
  previousSha256: v.nullable(digest), sha256: digest,
  response: v.optional(pin), httpStatus: v.optional(v.pipe(count, v.minValue(100), v.maxValue(599))),
  usage: v.optional(v.object({ inputTokens: count, outputTokens: count })),
  artifactStatus: v.optional(v.picklist(['scorable', 'schema-invalid', 'native-incomplete', 'http-error', 'unknown'])) })
const ledgerSchema = v.strictObject({ schemaVersion: v.literal(1), kind: v.literal('ocr-capacity-spending-ledger'),
  protocolId: text, planSha256: digest, budgetCents: amount, approvalSha256: v.nullable(digest), receipts: v.array(receiptSchema) })
type Receipt = v.InferOutput<typeof receiptSchema>
type Ledger = v.InferOutput<typeof ledgerSchema>
export interface CapacityGuardOptions {
  projectRoot?: string
  planPath: string
  planSha256: string
  regionId: string
  fetchImplementation?: (request: Request) => Promise<Response>
}
const fail = (message: string): never => { throw new AppValidationError(`OCR capacity guard: ${message}`) }
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const round = (value: number): number => Math.round(value * 1_000_000) / 1_000_000
const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable) : object(value)
  ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)])) : value
const receiptDigest = (receipt: Omit<Receipt, 'sha256'>): string => capacityHash(JSON.stringify(stable(receipt)))
const withoutDigest = ({ sha256: _sha256, ...receipt }: Receipt): Omit<Receipt, 'sha256'> => receipt
const retryPrompt = ['Return only valid JSON for this single OCR page.',
  'Use exactly this shape: {"pages":[{"pageNumber":1,"text":"..."}]}.',
  'Do not include markdown, explanations, extra keys, or text outside the JSON object.'].join('\n')

const readUsage = (value: unknown): { inputTokens: number, outputTokens: number } | undefined => {
  if (!object(value) || !object(value['usageMetadata'])) return undefined
  const usage = value['usageMetadata'], input = usage['promptTokenCount'], candidate = usage['candidatesTokenCount'], thoughts = usage['thoughtsTokenCount'] ?? 0
  if (![input, candidate, thoughts].every(value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) || input === 0) return undefined
  return { inputTokens: input as number, outputTokens: (candidate as number) + (thoughts as number) }
}
const artifactStatus = (value: unknown, httpStatus: number): NonNullable<Receipt['artifactStatus']> => {
  if (httpStatus < 200 || httpStatus >= 300) return 'http-error'
  if (!object(value) || !Array.isArray(value['candidates']) || value['candidates'].length !== 1 || !object(value['candidates'][0])) return 'unknown'
  const candidate = value['candidates'][0]
  if (candidate['finishReason'] !== 'STOP') return 'native-incomplete'
  if (!object(candidate['content']) || !Array.isArray(candidate['content']['parts'])) return 'schema-invalid'
  const raw = candidate['content']['parts'].filter(part => object(part) && part['thought'] !== true).map(part => object(part) && typeof part['text'] === 'string' ? part['text'] : '').join('')
  try {
    const payload: unknown = JSON.parse(raw)
    if (!object(payload) || Object.keys(payload).length !== 1 || !Array.isArray(payload['pages']) || payload['pages'].length !== 1 || !object(payload['pages'][0])) return 'schema-invalid'
    const page = payload['pages'][0]
    return Object.keys(page).length === 2 && page['pageNumber'] === 1 && typeof page['text'] === 'string' ? 'scorable' : 'schema-invalid'
  } catch { return 'schema-invalid' }
}
const expectedCharge = (plan: CapacityExecutionPlan, usage: { inputTokens: number, outputTokens: number }): number =>
  round((usage.inputTokens * plan.target.pricing.inputCentsPerMillion + usage.outputTokens * plan.target.pricing.outputCentsPerMillion) / 1_000_000)

/** Reject before transport unless the whole new plan, all regions, budget risk and independent reference review are explicitly approved. */
export const createCapacityProtocolFetchGuard = async (options: CapacityGuardOptions): Promise<typeof fetch> => {
  const root = await realpath(options.projectRoot ?? PROJECT_ROOT)
  const planBytes = new Uint8Array(await readFile(await capacityExistingPath(root, options.planPath)))
  if (capacityHash(planBytes) !== options.planSha256) fail('execution plan fingerprint changed')
  const rawPlan: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(planBytes))
  if (!object(rawPlan) || typeof rawPlan['mappingPath'] !== 'string') fail('missing frozen region mapping')
  const planRecord = rawPlan as Record<string, unknown>
  const inspected = await validateOcrCapacityProtocol({ projectRoot: root, mappingPath: planRecord['mappingPath'] as string })
  if (inspected.planPath !== options.planPath || inspected.planSha256 !== options.planSha256) fail('plan is not the deterministic prepared scope')
  const plan = rawPlan as unknown as CapacityExecutionPlan
  const approvalBytes = new Uint8Array(await readFile(await capacityExistingPath(root, plan.approval)))
  const approval = v.parse(approvalSchema, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(approvalBytes)))
  if (approval.planSha256 !== options.planSha256 || approval.protocolId !== plan.protocolId
    || approval.referenceReview.path !== plan.referenceReview
    || approval.budgetCents !== plan.spending.approvalBudgetCents || !isDeepStrictEqual(approval.regionIds, plan.regions.map(region => region.id))) fail('approval does not name this exact cumulative plan')
  const reviewBytes = new Uint8Array(await readFile(await capacityExistingPath(root, approval.referenceReview.path)))
  if (capacityHash(reviewBytes) !== approval.referenceReview.sha256) fail('independent reference review changed')
  const review = v.parse(capacityReferenceReviewSchema, JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(reviewBytes)))
  if (review.planSha256 !== options.planSha256 || !isDeepStrictEqual(review.regionIds, plan.regions.map(region => region.id))) fail('independent review does not cover this exact plan')
  const region = plan.regions.find(region => region.id === options.regionId)
  if (!region) fail('unselected region')
  const selected = region!
  const livePins = [
    { path: plan.mappingPath, sha256: plan.mappingSha256 }, plan.sourceImage, plan.sourceReference,
    ...plan.protectedArtifacts, plan.target.pricing.registry,
    ...plan.regions.flatMap(region => [{ path: region.input, sha256: region.inputSha256 },
      { path: region.reference, sha256: region.referenceSha256 }, { path: region.normalizedReference, sha256: region.normalizedReferenceSha256 }])
  ]
  const approvalSha256 = capacityHash(approvalBytes), ledgerPath = await capacityExistingPath(root, plan.ledger)
  const sourceBytes = new Uint8Array(await readFile(await capacityExistingPath(root, selected.input)))
  if (capacityHash(sourceBytes) !== selected.inputSha256) fail('selected region image changed')
  const decoded = decodePngRgba8(sourceBytes)
  if (decoded.width !== selected.width || decoded.height !== selected.height || decoded.pixelSha256 !== selected.pixelSha256) fail('selected region PNG is invalid')
  const originalFetch = globalThis.fetch
  const fetchImplementation = options.fetchImplementation ?? (async (request: Request) => await originalFetch(request))
  const usageCents = (usage: { inputTokens: number, outputTokens: number }) => expectedCharge(plan, usage)

  const loadLedger = async (): Promise<Ledger> => {
    if (await capacityExistingPath(root, plan.ledger) !== ledgerPath) fail('ledger route changed')
    const ledger = v.parse(ledgerSchema, JSON.parse(await Bun.file(ledgerPath).text()))
    if (ledger.planSha256 !== options.planSha256 || ledger.protocolId !== plan.protocolId || ledger.budgetCents !== approval.budgetCents
      || ledger.approvalSha256 !== null && ledger.approvalSha256 !== approvalSha256
      || ledger.approvalSha256 === null && ledger.receipts.length) fail('ledger or approval identity changed')
    let previous: string | null = null
    const ids = new Set<string>()
    for (const receipt of ledger.receipts) {
      if (ids.has(receipt.id) || receipt.previousSha256 !== previous || receipt.sha256 !== receiptDigest(withoutDigest(receipt))
        || !plan.regions.some(region => region.id === receipt.regionId) || receipt.reservedCents !== plan.spending.perAttemptReservedCents
        || !Number.isFinite(Date.parse(receipt.createdAt))) fail('receipt chain differs from the approved scope')
      ids.add(receipt.id); previous = receipt.sha256
      if (['reserved', 'ambiguous'].includes(receipt.status) && receipt.chargedCents !== receipt.reservedCents
        || receipt.status === 'rejected' && receipt.chargedCents !== 0
        || receipt.status === 'settled' && (!receipt.usage || receipt.chargedCents !== usageCents(receipt.usage))
        || receipt.status === 'breach' && receipt.chargedCents < receipt.reservedCents) fail('receipt costs do not preserve the reservation policy')
      if (receipt.response) {
        if (receipt.response.path !== `${dirname(plan.ledger)}/receipts/${receipt.id}.json`) fail('response evidence path changed')
        const bytes = new Uint8Array(await readFile(await capacityExistingPath(root, receipt.response.path)))
        if (capacityHash(bytes) !== receipt.response.sha256) fail('response evidence bytes changed')
        if (receipt.usage) {
          let payload: unknown
          try { payload = JSON.parse(new TextDecoder().decode(bytes)) } catch { fail('settled response evidence is not JSON') }
          if (!isDeepStrictEqual(readUsage(payload), receipt.usage)) fail('receipt usage differs from its original response')
        }
      } else if (receipt.status === 'settled' || receipt.status === 'rejected' || receipt.usage) fail('settled receipt lacks original response evidence')
    }
    for (const region of plan.regions) if (ledger.receipts.filter(receipt => receipt.regionId === region.id).length > plan.target.attemptsPerRegion) fail('per-region attempt limit was exceeded')
    return ledger
  }
  const withLedger = async <T>(action: (ledger: Ledger) => Promise<T>): Promise<T> => {
    const lockPath = `${ledgerPath}.lock`, token = randomUUID(), deadline = Date.now() + 5000
    let lock: Awaited<ReturnType<typeof open>>
    while (true) {
      try { lock = await open(lockPath, 'wx', 0o600); break } catch (error) {
        if (!object(error) || error['code'] !== 'EEXIST') throw error
        if (Date.now() >= deadline) fail('ledger is locked; reconcile ownership before retrying')
        await sleepWithAbortSignal(10)
      }
    }
    try {
      await lock.writeFile(token)
      return await action(await loadLedger())
    } finally {
      await lock.close()
      if (await Bun.file(lockPath).text().catch(() => '') === token) await unlink(lockPath)
    }
  }
  const saveLedger = async (ledger: Ledger) => {
    const temporary = `${ledgerPath}.${randomUUID()}.tmp`, file = await open(temporary, 'wx', 0o600)
    try { await file.writeFile(JSON.stringify(ledger, null, 2) + '\n'); await file.sync() } finally { await file.close() }
    await rename(temporary, ledgerPath)
  }
  const guarded = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? new Request(input, init) : new Request(String(input), init), url = new URL(request.url)
    if (url.origin !== 'https://generativelanguage.googleapis.com' || url.pathname !== '/v1beta/models/gemini-3.8-flash:generateContent'
      || url.search || url.hash || url.username || url.password || request.method !== 'POST') fail('endpoint or method is outside the approved Gemini operation')
    const bodyBytes = new Uint8Array(await request.clone().arrayBuffer())
    let body: unknown
    try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bodyBytes)) } catch { fail('request is not JSON') }
    if (!object(body) || !isDeepStrictEqual(Object.keys(body).sort(), ['contents', 'generationConfig'])) fail('unapproved request fields')
    const parsed = body as Record<string, unknown>, config = parsed['generationConfig']
    if (!isDeepStrictEqual(config, { responseMimeType: 'application/json', responseJsonSchema: HOSTED_OCR_PAGES_JSON_SCHEMA,
      maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: 'LOW' } })) fail('native output, reasoning or schema controls changed')
    const contents = parsed['contents']
    if (!Array.isArray(contents) || contents.length !== 1 || !object(contents[0]) || contents[0]['role'] !== 'user' || !Array.isArray(contents[0]['parts'])
      || !isDeepStrictEqual(Object.keys(contents[0]).sort(), ['parts', 'role']) || contents[0]['parts'].length !== 2) fail('expected one reviewed text-plus-image user input')
    const first = (contents as Record<string, unknown>[])[0]!, [prompt, image] = first['parts'] as unknown[]
    if (!object(prompt) || Object.keys(prompt).length !== 1 || ![buildHostedOcrJsonPrompt(1), retryPrompt].includes(String(prompt['text']))
      || !object(image) || Object.keys(image).length !== 1 || !object(image['inlineData'])) fail('unreviewed prompt, extra media or file upload')
    const inline = (image as Record<string, unknown>)['inlineData'] as Record<string, unknown>
    if (!isDeepStrictEqual(Object.keys(inline).sort(), ['data', 'mimeType']) || inline['mimeType'] !== 'image/png' || typeof inline['data'] !== 'string') fail('expected exactly one inline PNG')
    const base64 = inline['data'] as string, imageBytes = Buffer.from(base64, 'base64')
    if (imageBytes.toString('base64') !== base64 || capacityHash(imageBytes) !== selected.inputSha256) fail('request image differs from the selected region')
    const scrubbed = { ...parsed, contents: [{ role: 'user', parts: [prompt, { inlineData: '<pinned-region>' }] }] }
    if (Buffer.byteLength(JSON.stringify(scrubbed)) > 8192 || imageBytes.length > 5 * 1024 * 1024) fail('request text/schema or PNG exceeds the reviewed allowance')
    const receiptId = randomUUID()
    await withLedger(async ledger => {
      if (capacityHash(new Uint8Array(await readFile(await capacityExistingPath(root, options.planPath)))) !== options.planSha256
        || capacityHash(new Uint8Array(await readFile(await capacityExistingPath(root, plan.approval)))) !== approvalSha256
        || capacityHash(new Uint8Array(await readFile(await capacityExistingPath(root, approval.referenceReview.path)))) !== approval.referenceReview.sha256) fail('plan, approval or independent review was changed or revoked')
      for (const pin of livePins) if (capacityHash(new Uint8Array(await readFile(await capacityExistingPath(root, pin.path)))) !== pin.sha256) fail(`pinned source, reference or runtime scope changed: ${pin.path}`)
      if (ledger.receipts.some(receipt => ['reserved', 'ambiguous', 'breach'].includes(receipt.status))) fail('unsettled request blocks dispatch pending reconciliation')
      const earlier = ledger.receipts.filter(receipt => receipt.regionId === selected.id)
      if (earlier.some(receipt => receipt.artifactStatus === 'scorable' || receipt.artifactStatus === 'native-incomplete')) fail('completed or native-incomplete region may not be repurchased under this scope')
      if (earlier.length >= plan.target.attemptsPerRegion) fail('per-region attempt limit reached')
      if (round(ledger.receipts.reduce((sum, receipt) => sum + receipt.chargedCents, 0) + plan.spending.perAttemptReservedCents) > ledger.budgetCents) fail('cumulative budget would be exceeded')
      ledger.approvalSha256 = approvalSha256
      const receipt: Omit<Receipt, 'sha256'> = { id: receiptId, regionId: selected.id, requestSha256: capacityHash(bodyBytes), createdAt: new Date().toISOString(),
        status: 'reserved', reservedCents: plan.spending.perAttemptReservedCents, chargedCents: plan.spending.perAttemptReservedCents,
        previousSha256: ledger.receipts.at(-1)?.sha256 ?? null }
      ledger.receipts.push({ ...receipt, sha256: receiptDigest(receipt) }); await saveLedger(ledger)
    })
    let response: Response
    try { response = await fetchImplementation(new Request(request, { redirect: 'error' })) } catch (error) {
      await withLedger(async ledger => {
        const receipt = ledger.receipts.find(receipt => receipt.id === receiptId)!
        receipt.status = 'ambiguous'; receipt.artifactStatus = 'unknown'; receipt.sha256 = receiptDigest(withoutDigest(receipt)); await saveLedger(ledger)
      })
      throw error
    }
    const responseBytes = new Uint8Array(await response.clone().arrayBuffer())
    const responsePath = `${dirname(plan.ledger)}/receipts/${receiptId}.json`
    await writeNewCapacityEvidence(root, responsePath, responseBytes)
    let payload: unknown
    try { payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(responseBytes)) } catch { payload = undefined }
    let breached = false
    await withLedger(async ledger => {
      const receipt = ledger.receipts.find(receipt => receipt.id === receiptId)!, usage = readUsage(payload)
      receipt.response = { path: responsePath, sha256: capacityHash(responseBytes) }; receipt.httpStatus = response.status
      receipt.artifactStatus = artifactStatus(payload, response.status)
      if (usage) {
        receipt.usage = usage; receipt.chargedCents = usageCents(usage)
        breached = usage.inputTokens > plan.target.inputTokenAllowance || usage.outputTokens > plan.target.maxOutputTokens || receipt.chargedCents > receipt.reservedCents
        receipt.status = breached ? 'breach' : 'settled'
        if (breached) receipt.chargedCents = Math.max(receipt.reservedCents, receipt.chargedCents)
      } else if ([400, 401, 403, 404, 429].includes(response.status)) { receipt.status = 'rejected'; receipt.chargedCents = 0 }
      else { receipt.status = 'ambiguous'; receipt.chargedCents = receipt.reservedCents }
      receipt.sha256 = receiptDigest(withoutDigest(receipt)); await saveLedger(ledger)
    })
    if (breached) fail('provider usage exceeded the reviewed allowance; full hold retained and dispatch stopped')
    return response
  }
  return Object.assign(guarded, { preconnect: (_url: string | URL) => fail('preconnect is outside the approved operation') }) as typeof fetch
}

if (process.env['AUTOSHOW_OCR_CAPACITY_GUARD'] === '1') {
  const required = (name: string): string => process.env[name]?.trim() || fail(`missing ${name}`)
  globalThis.fetch = await createCapacityProtocolFetchGuard({ planPath: required('AUTOSHOW_OCR_CAPACITY_PLAN'),
    planSha256: required('AUTOSHOW_OCR_CAPACITY_PLAN_SHA256'), regionId: required('AUTOSHOW_OCR_CAPACITY_REGION') })
}
