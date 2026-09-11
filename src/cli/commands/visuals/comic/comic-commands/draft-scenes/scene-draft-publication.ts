import { mkdir } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import * as v from 'valibot'
import type { ComicLlmResponseUsage, DraftSceneRunStats } from '~/types'
import { comicLog, formatCompactCost, formatDuration } from '../../comic-utils/comic-logger'
import {
  getInvalidSceneJsonPath,
  getSceneJsonPath
} from '../../comic-utils/project-paths'
import { ScenePromptDataSchema } from '../../schemas/schemas'
import type { SceneDraftPreparation } from './scene-draft-preparation'

export const persistInvalidSceneCandidate = async (sceneSlug: string, parsed: unknown, validationError: unknown): Promise<void> => {
  const invalidOutputPath = getInvalidSceneJsonPath(sceneSlug)
  try {
    await mkdir(dirname(invalidOutputPath), { recursive: true })
    await Bun.write(invalidOutputPath, JSON.stringify({
      schemaVersion: 4,
      validationError: validationError instanceof Error ? validationError.message : String(validationError),
      output: parsed,
    }, null, 2))
    comicLog.line(`Saved invalid scene draft candidate: ${invalidOutputPath}`)
  } catch (writeError) {
    comicLog.line(
      `Could not save invalid scene draft candidate: ${
        writeError instanceof Error ? writeError.message : String(writeError)
      }`
    )
  }
}

export const publishSceneDraft = async (sceneSlug: string, validated: v.InferOutput<typeof ScenePromptDataSchema>, stats: DraftSceneRunStats, reviewModel: string, usage: ComicLlmResponseUsage, requestDurationMs: number, blockingPlan: SceneDraftPreparation['blockingPlan'], attempt: number): Promise<void> => {
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
    blockingPlan ? `attempts=${attempt}` : undefined,
    blockingPlan ? `blockingPlan=${blockingPlan.planSha256.slice(0, 12)}` : undefined,
  ])
}
