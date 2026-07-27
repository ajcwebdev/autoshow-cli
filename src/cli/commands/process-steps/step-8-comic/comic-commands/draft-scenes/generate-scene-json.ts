import { mkdir } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import * as v from 'valibot'
import type { ComicLlmResponseUsage, DraftSceneRunStats, GenerateSceneJsonOptions } from '~/types'
import { buildSceneJsonSchema, ScenePromptDataSchema, StructuredScriptDataSchema, validateSceneCharacters } from '../../schemas/schemas'
import { parseJsonFile } from '../../comic-utils/json-prompt-utils'
import { comicLog, err, formatCompactCost, formatDuration, l } from '../../comic-utils/comic-logger'
import { runComicStructuredLlm } from '../../comic-utils/structured-script-utils/run-structured-llm'
import { estimateLlmCostFromRegistry } from '../../comic-utils/structured-script-utils/llm-cost'
import {
getDraftPromptPath,
getInvalidSceneJsonPath,
getSceneJsonPath,
getStructuredScriptPath,
} from '../../comic-utils/project-paths'
import { validateSceneRecapMontageExpansion } from '../../comic-utils/recap-montage-utils'
import { validateSceneSourceSegmentCoverage } from '../../comic-utils/source-coverage-utils'
import { ValidationError } from '~/utils/error-handler'
import { loadCharacterCatalog } from '../../comic-utils/character-reference-config'

const extractJsonPayload = (content: string): string => {
  const trimmed = content.trim()
  if (!trimmed) {
    throw ValidationError('Model response was empty', { stage: 'comic:draft-scenes' })
  }

  const fencedJsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fencedJsonMatch?.[1]) {
    return fencedJsonMatch[1].trim()
  }

  const firstBraceIndex = trimmed.indexOf('{')
  const lastBraceIndex = trimmed.lastIndexOf('}')
  if (firstBraceIndex >= 0 && lastBraceIndex > firstBraceIndex) {
    return trimmed.slice(firstBraceIndex, lastBraceIndex + 1)
  }

  return trimmed
}

const parseSceneJsonResponse = (
  content: string,
  options: { lenient: boolean }
): unknown => {
  return JSON.parse(options.lenient ? extractJsonPayload(content) : content)
}

export const generateSceneJson = async (
  sceneSlug: string,
  options: GenerateSceneJsonOptions
): Promise<DraftSceneRunStats> => {
  const stats: DraftSceneRunStats = {
    filesProcessed: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCachedTokens: 0,
    totalCost: 0,
    totalDurationMs: 0
  }

  try {
    const filePath = getDraftPromptPath(sceneSlug)
    const content = await Bun.file(filePath).text()

    if (!content.trim()) {
      l.dim(`Skipping empty draft prompt bundle: ${sceneSlug}`)
      return stats
    }

    const catalog = loadCharacterCatalog()
    const sceneJsonSchema = buildSceneJsonSchema(catalog.characterKeys)
    const requestStart = Date.now()
    const { text, metadata } = await runComicStructuredLlm(content, {
      schemaName: sceneJsonSchema.name,
      valibotSchema: ScenePromptDataSchema,
      jsonSchema: sceneJsonSchema.schema,
    }, options.model)
    const requestDurationMs = Date.now() - requestStart

    const usage: ComicLlmResponseUsage = {
      input_tokens: metadata.inputTokenCount,
      output_tokens: metadata.outputTokenCount,
      total_tokens: metadata.inputTokenCount + metadata.outputTokenCount,
    }
    const reviewModel = metadata.providerReturnedModel ?? metadata.llmModel
    stats.totalInputTokens += usage.input_tokens
    stats.totalOutputTokens += usage.output_tokens
    stats.totalCost += estimateLlmCostFromRegistry(options.model, usage.input_tokens, usage.output_tokens)
    stats.totalDurationMs += requestDurationMs

    const parsed = parseSceneJsonResponse(text, { lenient: true })

    // Strip null tone values before validation
    if (parsed && typeof parsed === 'object' && 'panels' in parsed && Array.isArray(parsed.panels)) {
      for (const panel of parsed.panels) {
        if (
          panel
          && typeof panel === 'object'
          && 'speech' in panel
          && Array.isArray(panel.speech)
        ) {
          for (const item of panel.speech) {
            if (item && typeof item === 'object' && 'tone' in item && item.tone === null) {
              delete item.tone
            }
          }
        }
      }
    }

    let validated: v.InferOutput<typeof ScenePromptDataSchema>
    try {
      validated = v.parse(ScenePromptDataSchema, parsed)
      validateSceneCharacters(validated, catalog)
      const structuredScript = await parseJsonFile(getStructuredScriptPath(sceneSlug), StructuredScriptDataSchema)
      validateSceneSourceSegmentCoverage(validated, structuredScript.sourceSegments)
      await validateSceneRecapMontageExpansion(validated, structuredScript)
    } catch (validationError) {
      const invalidOutputPath = getInvalidSceneJsonPath(sceneSlug)
      try {
        await mkdir(dirname(invalidOutputPath), { recursive: true })
        await Bun.write(invalidOutputPath, JSON.stringify({
          schemaVersion: 4,
          validationError: validationError instanceof Error ? validationError.message : String(validationError),
          output: parsed,
        }, null, 2))
        l.dim(`Saved invalid scene draft candidate: ${invalidOutputPath}`)
      } catch (writeError) {
        l.dim(
          `Could not save invalid scene draft candidate: ${
            writeError instanceof Error ? writeError.message : String(writeError)
          }`
        )
      }
      throw validationError
    }

    const outputPath = getSceneJsonPath(sceneSlug)
    await mkdir(dirname(outputPath), { recursive: true })
    await Bun.write(outputPath, JSON.stringify(validated, null, 2))

    stats.filesProcessed++
    comicLog.line('scene-json generated', [
      `file=${basename(outputPath)}`,
      `model=${reviewModel}`,
      `tokens=${usage.total_tokens.toLocaleString()}`,
      `cost=${formatCompactCost(stats.totalCost)}`,
      `api=${formatDuration(requestDurationMs)}`,
    ])
  } catch (error) {
    err(`Failed to generate scene JSON for ${sceneSlug}:`, error instanceof Error ? error.message : String(error))
    throw error
  }

  return stats
}
