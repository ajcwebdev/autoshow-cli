import { extname, isAbsolute, join, resolve } from 'node:path'
import * as l from '~/utils/app-logger/app-logger'
import { CLIUsageError } from '~/utils/error-handler'
import { baseMediaComparisonRow, writeMediaComparisonReports } from './media-provider-comparison'
import { costFromManifestMetadata, ensureFile, getArray, getNumber, getString, loadMediaManifest } from './benchmark-utils'
import { judgeVisionArtifact, qualityReportBase, rankVisionProviders, resolveVisionProviders, runVisionBenchmark, summarizeVisionEvaluations, writeVisionQualityJson, writeVisionQualityMarkdown } from './vision-benchmark-engine'
import type { BenchmarkFlags, ImageBenchmarkManifestView, ImageBenchmarkProvider, ImageCriterionScores, ImageEvaluation, ImageFileReference, ImageQualityProviderReport, ImageQualityReport, ImageRunEntry, JsonObject } from '~/types'
import type { VisionCriterion } from './vision-benchmark-engine'

const DEFAULT_IMAGE_JUDGE_MODEL = 'gpt-5.5'
const QUALITY_METRIC_NAME = 'image quality score'
type ImageCriterion = keyof ImageCriterionScores

const IMAGE_CRITERIA = [
  { key: 'promptAdherence', reportLabel: 'prompt adherence', markdownLabel: 'Prompt', promptLine: 'how completely the image follows the requested subject, style, structure, and constraints.' },
  { key: 'visualQuality', reportLabel: 'visual quality', markdownLabel: 'Visual', promptLine: 'overall aesthetic quality, clarity, lighting/color, and generation fidelity.' },
  { key: 'artifactControl', reportLabel: 'artifact control', markdownLabel: 'Artifacts', promptLine: 'absence of obvious distortions, malformed objects, noise, seams, or rendering errors.' },
  { key: 'composition', reportLabel: 'composition', markdownLabel: 'Composition', promptLine: 'layout, balance, hierarchy, framing, and readability of the intended scene.' },
  { key: 'detailTextHandling', reportLabel: 'detail/text handling', markdownLabel: 'Detail/Text', promptLine: 'fine detail quality and any visible text/label handling required by the prompt.' }
] as const satisfies readonly VisionCriterion<ImageCriterion>[]

const imageMimeType = (fileName: string): string => {
  switch (extname(fileName).toLowerCase()) {
    case '.png': return 'image/png'
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.webp': return 'image/webp'
    default: throw CLIUsageError(`Unsupported image benchmark file type for ${fileName}. Expected PNG, JPEG, or WebP.`)
  }
}

const parseImageRunEntry = (rawEntry: JsonObject, manifestMetadata: JsonObject, index: number): ImageRunEntry => {
  const imageService = getString(rawEntry, 'imageService')
  const imageModel = getString(rawEntry, 'imageModel')
  if (!imageService || !imageModel) {
    throw CLIUsageError(`Image benchmark metadata.image[${index}] must include imageService and imageModel.`)
  }
  const imageFileNames = getArray(rawEntry, 'imageFileNames').filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
  if (imageFileNames.length === 0) {
    throw CLIUsageError(`Image benchmark metadata.image[${index}] must include imageFileNames[].`)
  }
  const processingTimeMs = getNumber(rawEntry, 'processingTime')
  const costCents = getNumber(rawEntry, 'providerCostCents') ?? costFromManifestMetadata(manifestMetadata, imageService, imageModel)
  return {
    imageService,
    imageModel,
    imageFileNames,
    ...(processingTimeMs !== undefined ? { processingTimeMs } : {}),
    ...(costCents !== undefined ? { costCents } : {})
  }
}

const loadImageRun = async (runDir: string): Promise<{ manifestView: ImageBenchmarkManifestView, providers: ImageBenchmarkProvider[] }> => {
  const { input, entries, raw } = await loadMediaManifest(runDir, 'image', 'Image', parseImageRunEntry)
  const manifestView: ImageBenchmarkManifestView = { input, entries, raw }
  const providers = await resolveVisionProviders<ImageRunEntry, ImageFileReference, ImageBenchmarkProvider>({
    entries,
    identity: ({ imageService, imageModel }) => ({ service: imageService, model: imageModel }),
    stats: ({ processingTimeMs, costCents }) => ({
      ...(processingTimeMs !== undefined ? { processingTimeMs } : {}),
      ...(costCents !== undefined ? { costCents } : {})
    }),
    artifacts: async ({ imageFileNames }) => await Promise.all(imageFileNames.map(async (fileName) => {
      if (isAbsolute(fileName)) throw CLIUsageError(`Image benchmark imageFileNames must be relative to the run directory: ${fileName}`)
      const path = resolve(runDir, fileName)
      await ensureFile(path, `Image benchmark image file not found: ${path}`)
      return { fileName, path, mimeType: imageMimeType(fileName) }
    })),
    statsPolicy: 'first',
    assemble: (base, images) => ({ ...base, images })
  })
  return { manifestView, providers }
}

const imageDataUrl = async ({ path, mimeType }: ImageFileReference): Promise<string> => {
  const bytes = await Bun.file(path).arrayBuffer()
  return `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`
}

const buildImageJudgePrompt = (prompt: string, provider: ImageBenchmarkProvider, image: ImageFileReference): string => [
  'Evaluate this generated image for an AutoShow image benchmark.',
  'Use the original generation prompt as the target. Score only visible image quality and prompt fit; do not reward or penalize provider cost or speed.',
  'Score each criterion from 1 to 10, where 10 is excellent and 1 is unusable.', '',
  `Provider/model: ${provider.providerKey}`, `Image file: ${image.fileName}`, '',
  'Original generation prompt:', prompt, '', 'Criteria:',
  ...IMAGE_CRITERIA.map(({ key, promptLine }) => `- ${key}: ${promptLine}`),
  '', 'Return only the requested JSON.'
].join('\n')

const evaluateImageProvider = async (
  prompt: string,
  provider: ImageBenchmarkProvider,
  judgeModel: string
): Promise<Omit<ImageQualityProviderReport, 'rank'>> => {
  const images: ImageEvaluation[] = []
  for (const image of provider.images) {
    l.write('info', `Judging image: ${provider.providerKey} ${image.fileName}`)
    const result = await judgeVisionArtifact({
      domain: 'image', providerKey: provider.providerKey, fileName: image.fileName, model: judgeModel, criteria: IMAGE_CRITERIA,
      content: [
        { type: 'input_text', text: buildImageJudgePrompt(prompt, provider, image) },
        { type: 'input_image', image_url: await imageDataUrl(image), detail: 'auto' }
      ]
    })
    images.push({ fileName: image.fileName, ...result })
  }
  const summary = summarizeVisionEvaluations(IMAGE_CRITERIA, images)
  return {
    providerKey: provider.providerKey,
    provider: provider.provider,
    model: provider.model,
    group: provider.group,
    imageFiles: provider.images.map(({ fileName }) => fileName),
    imageCount: provider.images.length,
    ...(provider.processingTimeMs !== undefined ? { processingTimeMs: provider.processingTimeMs } : {}),
    ...(provider.costCents !== undefined ? { costCents: provider.costCents } : {}),
    criterionScores: summary.criterionScores,
    averageScore10: summary.averageScore10,
    qualityScore: summary.qualityScore,
    qualityMetric: QUALITY_METRIC_NAME,
    evidence: summary.evidence,
    images
  }
}

const providerComparisonRows = (report: ImageQualityReport): JsonObject[] => report.providers
  .slice()
  .sort((left, right) => left.providerKey.localeCompare(right.providerKey))
  .map((provider) => ({
    ...baseMediaComparisonRow(provider),
    imageQuality: {
      judgeModel: report.judge.model,
      qualityScore: provider.qualityScore,
      averageScore10: provider.averageScore10,
      criterionScores: provider.criterionScores,
      imageCount: provider.imageCount,
      imageFiles: provider.imageFiles,
      evidence: provider.evidence
    }
  }))

const writeImageQualityReports = async (
  runDir: string,
  manifestView: ImageBenchmarkManifestView,
  providers: readonly ImageBenchmarkProvider[],
  judgeModel: string
): Promise<{ report: ImageQualityReport, jsonOut: string, markdownOut: string }> => {
  const evaluated = [] as Array<Omit<ImageQualityProviderReport, 'rank'>>
  for (const provider of providers) evaluated.push(await evaluateImageProvider(manifestView.input, provider, judgeModel))
  const ranked: ImageQualityProviderReport[] = rankVisionProviders(evaluated)
  const report: ImageQualityReport = {
    ...qualityReportBase('image-quality-report', runDir, new Date().toISOString(), judgeModel, manifestView.input, {
      scale: '1-10', qualityScore: 'average criterion score x 10', criteria: IMAGE_CRITERIA.map(({ reportLabel }) => reportLabel)
    }),
    providerCount: ranked.length,
    imageCount: ranked.reduce((sum, provider) => sum + provider.imageCount, 0),
    providers: ranked
  }
  const jsonOut = await writeVisionQualityJson(runDir, 'image', report)
  const markdownOut = join(runDir, 'image-quality-report.md')
  await writeVisionQualityMarkdown(markdownOut, report, {
    title: 'Image', artifactLabel: 'Images', artifactCount: report.imageCount, criteria: IMAGE_CRITERIA,
    rubricCriteria: 'Prompt adherence, visual quality, artifact control, composition, and detail/text handling',
    extraRubricLines: ['- The score excludes cost, generation speed, file size, and provider latency.']
  })
  return { report, jsonOut, markdownOut }
}

export const runImageBenchmark = async (input: string | undefined, flags: BenchmarkFlags): Promise<void> => {
  await runVisionBenchmark(input, flags, {
    label: 'Image', usage: 'bun autoshow benchmark <image-run-dir> --image', artifactLabel: 'images', artifactCountKey: 'imageCount',
    defaultJudgeModel: DEFAULT_IMAGE_JUDGE_MODEL,
    judgeModel: (options) => options['image-judge-model'],
    load: loadImageRun,
    artifactCount: ({ images }) => images.length,
    writeQualityReports: writeImageQualityReports,
    writeComparisonReports: async (runDir, report) => await writeMediaComparisonReports(runDir, {
      category: 'image', categoryLabel: 'Image', proxyNoun: 'dimensions', report, rows: providerComparisonRows(report)
    })
  })
}
