import { mkdir } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import * as v from 'valibot'
import type { ComicLlmCommandOptionsBase, StructuredScriptRunStats } from '~/types'
import { comicLog, err, formatCompactCost, formatDuration, l } from '../comic-logger'
import { getStructuredScriptPath } from '../project-paths'
import { reviewStructuredScriptWithLlm } from './llm-review'
import { parseScriptMarkdownToStructuredData } from './structured-script-parser'
import { calculateCost } from './usage-cost'

export const generateStructuredScript = async (
  scriptPath: string,
  sceneSlug: string,
  options: ComicLlmCommandOptionsBase = {}
): Promise<StructuredScriptRunStats> => {
  const stats: StructuredScriptRunStats = {
    filesProcessed: 0,
    llmReviews: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCachedTokens: 0,
    totalCost: 0,
    totalDurationMs: 0,
  }

  try {
    const content = await Bun.file(scriptPath).text()

    if (!content.trim()) {
      l.dim(`Skipping empty file: ${basename(scriptPath)}`)
      return stats
    }

    let structuredScript = parseScriptMarkdownToStructuredData(content, scriptPath)
    let reviewModel: string | undefined

    if (options.llmModel) {
      const review = await reviewStructuredScriptWithLlm(content, structuredScript, options.llmModel)
      const usage = review.response.usage
      reviewModel = review.response.model
      if (usage) {
        const cachedTokens = usage.input_tokens_details?.cached_tokens ?? 0
        const cost = calculateCost(options.llmModel, usage)

        stats.totalInputTokens += usage.input_tokens
        stats.totalOutputTokens += usage.output_tokens
        stats.totalCachedTokens += cachedTokens
        stats.totalCost += cost
      }

      stats.llmReviews++
      stats.totalDurationMs += review.durationMs
      structuredScript = review.structuredScript
    }

    const outputPath = getStructuredScriptPath(sceneSlug)
    await mkdir(dirname(outputPath), { recursive: true })
    await Bun.write(outputPath, JSON.stringify(structuredScript, null, 2))
    stats.filesProcessed++
    comicLog.line('structured-script generated', [
      `source=${basename(scriptPath)}`,
      `file=${basename(outputPath)}`,
      reviewModel ? `model=${reviewModel}` : undefined,
      stats.llmReviews > 0 ? `tokens=${(stats.totalInputTokens + stats.totalOutputTokens).toLocaleString()}` : undefined,
      stats.llmReviews > 0 ? `cost=${formatCompactCost(stats.totalCost)}` : undefined,
      stats.totalDurationMs > 0 ? `api=${formatDuration(stats.totalDurationMs)}` : undefined,
    ])
  } catch (error) {
    if (v.isValiError(error)) {
      err(`Invalid structured script output for ${basename(scriptPath)}`)
      err(error)
    } else {
      err(`Failed to process ${basename(scriptPath)}:`, error instanceof Error ? error.message : String(error))
    }
    throw error
  }

  return stats
}
