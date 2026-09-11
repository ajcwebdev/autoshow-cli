import { childEnv } from '~/utils/child-env'
import { join } from 'node:path'
import type { GenerateImagesCommandOptions } from '~/types'
import { DEFAULT_CLI_CONCURRENCY } from '~/utils/concurrency-defaults'
import { AppValidationError, InfraError, ValidationError } from '~/utils/error-handler'
import { atomicWriteJson } from '~/utils/filesystem'
import { geminiGenerateContent, geminiUserContent } from '~/utils/gemini/gemini-rest'
import { getFfmpegBinary } from '~/utils/runtime-paths'
import { resolveCredential } from '~/utils/validate/env-utils'
import { createImage } from '../../comic-image-services/comic-image-targets'
import { estimateImageOutputCost } from '../../comic-image-services/image-costs'
import { writeGeneratedImage } from '../../comic-image-services/image-writer'
import { runComicHostedRequest } from '../../comic-utils/hosted-concurrency'
import { estimateLlmCostFromRegistry } from '../../comic-utils/structured-script-utils/llm-cost'
import { REVISION_COMPARISON_SCHEMA, buildRevisionComparisonPrompt, normalizeRevisionComparison, parseRevisionComparison } from './revision-comparison-policy'
import { REVISION_COMPARISON_MODEL, REVISION_IMAGE_MODEL } from './revision-evaluation-config'
import type { ComparisonResponse, LoadedRevisionEntry, LoadedRevisionPlan, PanelLedger, RevisionEvaluationDependencies, SimilarityMeasurements } from './revision-evaluation-types'
import { sha256File } from './revision-evidence-files'

const imageMimeType = (path: string): string => path.toLowerCase().endsWith('.png') ? 'image/png' : path.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg'

export const imageBase64 = async (path: string): Promise<string> => Buffer.from(await Bun.file(path).arrayBuffer()).toString('base64')

const defaultRequestComparison = async (input: { prompt: string; imagePaths: string[]; model: string }): Promise<ComparisonResponse> => {
  const response = await geminiGenerateContent(resolveCredential('gemini', 'require', { stage: 'comic:revision-comparison', description: 'Comic revision comparison' }), {
    model: input.model,
    contents: geminiUserContent([{ text: input.prompt }, ...(await Promise.all(input.imagePaths.map(async path => ({ inlineData: { mimeType: imageMimeType(path), data: await imageBase64(path) } }))))]),
    generationConfig: { responseMimeType: 'application/json', responseJsonSchema: REVISION_COMPARISON_SCHEMA },
  })
  if (!response.text) throw InfraError('Revision comparison returned no structured text.', { stage: 'comic:revision-comparison' })
  return { text: response.text, inputTokens: response.usageMetadata?.promptTokenCount ?? 0, outputTokens: (response.usageMetadata?.candidatesTokenCount ?? 0) + (response.usageMetadata?.thoughtsTokenCount ?? 0) }
}

const buildRevisionPrompt = (entry: LoadedRevisionEntry): string => [
  'Perform exactly one tightly targeted edit of Image 1, the existing canonical panel.',
  'Images after Image 1 are immutable canonical character, location, and design references in contract order.',
  `Frozen issue finding: ${entry.originalFinding}`,
  `Only requested correction: ${entry.correctionNote}`,
  'Preserve every other visible choice from Image 1: composition, camera, poses, expressions, dialogue, lettering, lighting, palette, linework, props, background, and character placement unless the correction explicitly requires changing it.',
  'Do not make the panel merely prettier, reinterpret the scene, add content, remove content, or fix unrelated details.',
  'Return one revised panel with no commentary.',
  `Reviewed full panel contract:\n${JSON.stringify(entry.bundleData)}`,
].join('\n\n')

const runFfmpegMetric = async (originalPath: string, candidatePath: string, filter: 'ssim' | 'psnr'): Promise<string> => {
  const normalize = 'scale=384:256:flags=lanczos,setsar=1,format=yuv444p'
  const filterGraph = `[0:v]${normalize}[original];[1:v]${normalize}[candidate];[original][candidate]${filter}`
  const process = Bun.spawn([getFfmpegBinary(), '-hide_banner', '-nostdin', '-i', originalPath, '-i', candidatePath, '-filter_complex', filterGraph, '-f', 'null', '-'], { env: childEnv(), stdout: 'pipe', stderr: 'pipe' })
  const [, stderr, exitCode] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited])
  if (exitCode !== 0) throw ValidationError(`FFmpeg ${filter} comparison failed: ${stderr.trim()}`, { stage: 'comic:revision-similarity' })
  return stderr
}

export const measureRevisionSimilarity = async (originalPath: string, candidatePath: string): Promise<SimilarityMeasurements> => {
  const [ssimOutput, psnrOutput] = await Promise.all([runFfmpegMetric(originalPath, candidatePath, 'ssim'), runFfmpegMetric(originalPath, candidatePath, 'psnr')])
  const ssimMatch = ssimOutput.match(/All:([0-9.]+)/)
  const mseMatch = psnrOutput.match(/mse_avg:([0-9.]+)/)
  const averagePsnrMatch = psnrOutput.match(/average:([0-9.]+)/)
  if (!ssimMatch?.[1] || (!mseMatch?.[1] && !averagePsnrMatch?.[1])) throw ValidationError('FFmpeg did not report parseable SSIM/RMSE measurements.', { stage: 'comic:revision-similarity' })
  const normalizedRmse = mseMatch?.[1]
    ? Math.sqrt(Number(mseMatch[1])) / 255
    : 10 ** (-Number(averagePsnrMatch?.[1]) / 20)
  return { ssim: Number(ssimMatch[1]), normalizedRmse }
}

export const reconcileCompletedComparisonNormalization = async (input: { ledger: PanelLedger; ledgerPath: string; panelDirectory: string; now: () => string }): Promise<void> => {
  let changed = false
  for (const slot of input.ledger.comparisonSlots) {
    if (slot.status !== 'completed' || slot.normalized?.comparisonContractVersion === 4) continue
    const evidencePath = join(input.panelDirectory, `comparison-pass-${slot.pass}.json`)
    let evidence: Record<string, unknown>
    try { evidence = JSON.parse(await Bun.file(evidencePath).text()) as Record<string, unknown> } catch (error) {
      throw ValidationError(`Completed comparison evidence is unreadable for pass ${slot.pass}: ${evidencePath}`, { stage: 'comic:revision-comparison', ...(error instanceof Error ? { cause: error } : {}) })
    }
    if (evidence['planFingerprint'] !== input.ledger.planFingerprint || evidence['panelNumber'] !== input.ledger.panelNumber || evidence['pass'] !== slot.pass) throw ValidationError(`Completed comparison evidence does not match its ledger for pass ${slot.pass}.`, { stage: 'comic:revision-comparison' })
    const raw = parseRevisionComparison(JSON.stringify(evidence['raw']))
    const normalized = normalizeRevisionComparison(raw, slot.pass)
    slot.normalized = normalized
    await atomicWriteJson(evidencePath, { ...evidence, normalized, normalizationReconciliation: { comparisonContractVersion: 4, reconciledAt: input.now(), reason: 'Reclassified shared pre-existing defects separately from candidate-introduced preservation regressions; no provider call was made.' } })
    changed = true
  }
  if (changed) await atomicWriteJson(input.ledgerPath, input.ledger)
}

export const completeImageSlot = async (input: { loaded: LoadedRevisionPlan; entry: LoadedRevisionEntry; ledger: PanelLedger; ledgerPath: string; panelDirectory: string; options: GenerateImagesCommandOptions; dependencies: RevisionEvaluationDependencies; hostedIndex: number }): Promise<void> => {
  const { entry, ledger, ledgerPath, panelDirectory, options, dependencies } = input
  const candidatePath = join(panelDirectory, 'candidate.png')
  if (ledger.imageSlot?.status === 'in-flight') {
    ledger.imageSlot = { ...ledger.imageSlot, status: 'ambiguous', completedAt: (dependencies.now ?? (() => new Date().toISOString()))(), error: 'Prior execution ended with an in-flight image slot; automatic redispatch is forbidden.' }
    await atomicWriteJson(ledgerPath, ledger)
    return
  }
  if (ledger.imageSlot) return
  const now = dependencies.now ?? (() => new Date().toISOString())
  const imageSlot: NonNullable<PanelLedger['imageSlot']> = { status: 'in-flight', attempts: 1, startedAt: now() }
  ledger.imageSlot = imageSlot
  await atomicWriteJson(ledgerPath, ledger)
  try {
    const requestImage = dependencies.requestImage ?? (async request => await createImage(request.normalizedPrompt, request.referenceImages, request.model, request.size, request.quality))
    const response = await runComicHostedRequest({ concurrency: options.concurrency ?? DEFAULT_CLI_CONCURRENCY, hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator }, 'openai', 'comic-image', `${options.sceneSlug}:revision:panel-${entry.panelNumber}`, input.hostedIndex, async () => await requestImage({ normalizedPrompt: buildRevisionPrompt(entry), referenceImages: [entry.originalPath, ...entry.referencesResolved.all], model: REVISION_IMAGE_MODEL, size: options.size ?? '1536x1024', quality: options.quality ?? 'high' }))
    await (dependencies.writeImage ?? writeGeneratedImage)(candidatePath, response.result.imageBase64, response.result.mimeType)
    ledger.candidateSha256 = await sha256File(candidatePath)
    const estimatedCostUsd = estimateImageOutputCost(REVISION_IMAGE_MODEL, options.quality ?? 'high', options.size ?? '1536x1024')
    const usage = response.usage ? { imageInputUnits: response.usage.imageInputUnits ?? 0, textInputUnits: response.usage.textInputUnits ?? 0, outputUnits: response.usage.outputUnits ?? 0 } : undefined
    ledger.imageSlot = { ...imageSlot, status: 'completed', completedAt: now(), ...(estimatedCostUsd !== null ? { estimatedCostUsd } : {}), ...(usage ? { usage } : {}) }
  } catch (error) {
    ledger.imageSlot = { ...imageSlot, status: 'ambiguous', completedAt: now(), error: error instanceof Error ? error.message : String(error) }
  }
  await atomicWriteJson(ledgerPath, ledger)
  if (ledger.imageSlot?.status === 'completed') ledger.similarity = await (dependencies.measureSimilarity ?? measureRevisionSimilarity)(join(panelDirectory, 'original.png'), candidatePath)
  await atomicWriteJson(ledgerPath, ledger)
}

export const completeComparisonSlot = async (input: { entry: LoadedRevisionEntry; ledger: PanelLedger; ledgerPath: string; panelDirectory: string; pass: 1 | 2; options: GenerateImagesCommandOptions; dependencies: RevisionEvaluationDependencies; hostedIndex: number }): Promise<void> => {
  const { entry, ledger, ledgerPath, panelDirectory, pass, options, dependencies } = input
  const existing = ledger.comparisonSlots.find(slot => slot.pass === pass)
  const now = dependencies.now ?? (() => new Date().toISOString())
  if (existing?.status === 'in-flight') {
    existing.status = 'ambiguous'; existing.completedAt = now(); existing.error = 'Prior execution ended with an in-flight comparison slot; automatic redispatch is forbidden.'
    await atomicWriteJson(ledgerPath, ledger)
    return
  }
  if (existing) return
  const slot: PanelLedger['comparisonSlots'][number] = { pass, status: 'in-flight', attempts: 1, startedAt: now() }
  ledger.comparisonSlots.push(slot)
  ledger.comparisonSlots.sort((left, right) => left.pass - right.pass)
  await atomicWriteJson(ledgerPath, ledger)
  const originalEvidencePath = join(panelDirectory, 'original.png')
  const candidatePath = join(panelDirectory, 'candidate.png')
  const imagePaths = pass === 1 ? [originalEvidencePath, candidatePath, ...entry.referencesResolved.all] : [candidatePath, originalEvidencePath, ...entry.referencesResolved.all]
  let rawText: string | undefined
  try {
    const response = await runComicHostedRequest({ concurrency: options.concurrency ?? DEFAULT_CLI_CONCURRENCY, hostedConcurrencyCoordinator: options.hostedConcurrencyCoordinator }, 'gemini', 'comic-qa', `${options.sceneSlug}:revision-compare:panel-${entry.panelNumber}:pass-${pass}`, input.hostedIndex, async () => await (dependencies.requestComparison ?? defaultRequestComparison)({ prompt: buildRevisionComparisonPrompt(entry, pass), imagePaths, model: REVISION_COMPARISON_MODEL }))
    rawText = response.text
    const raw = parseRevisionComparison(response.text)
    const normalized = normalizeRevisionComparison(raw, pass)
    const costUsd = estimateLlmCostFromRegistry(REVISION_COMPARISON_MODEL, response.inputTokens, response.outputTokens)
    Object.assign(slot, { status: 'completed' as const, completedAt: now(), usage: { inputTokens: response.inputTokens, outputTokens: response.outputTokens, costUsd }, normalized })
    await atomicWriteJson(join(panelDirectory, `comparison-pass-${pass}.json`), { schemaVersion: 1, planFingerprint: ledger.planFingerprint, panelNumber: entry.panelNumber, pass, raw, normalized, usage: slot.usage })
  } catch (error) {
    slot.status = error instanceof AppValidationError ? 'malformed' : 'failed'
    slot.completedAt = now(); slot.error = error instanceof Error ? error.message : String(error)
    await atomicWriteJson(join(panelDirectory, `comparison-pass-${pass}-error.json`), { schemaVersion: 1, planFingerprint: ledger.planFingerprint, panelNumber: entry.panelNumber, pass, error: slot.error, ...(rawText !== undefined ? { rawText } : {}) })
  }
  await atomicWriteJson(ledgerPath, ledger)
}
