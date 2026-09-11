import { mkdir } from 'node:fs/promises'
import { basename, dirname } from 'node:path'
import type { BlockingBindings, BlockingPlan, GenerateBlockingPlanOptions, GenerateBlockingPlanResult } from '~/types'
import { serializeBlockingPlan } from '../../comic-utils/blocking-plan-compile'
import { getInvalidBlockingPlanPath } from '../../comic-utils/blocking-plan-paths'
import { comicLog, formatCompactCost, formatDuration } from '../../comic-utils/comic-logger'
import { BLOCKING_PLAN_SCHEMA_VERSION } from '../../schemas/blocking-plan-schemas'

export const writeInvalidPlan = async (sceneSlug: string, output: unknown, errors: readonly string[]): Promise<string> => {
  const path = getInvalidBlockingPlanPath(sceneSlug)
  await mkdir(dirname(path), { recursive: true })
  await Bun.write(path, `${JSON.stringify({ schemaVersion: BLOCKING_PLAN_SCHEMA_VERSION, validationErrors: [...errors], output }, null, 2)}\n`)
  return path
}

export const publishBlockingPlan = async ({ plan, bindings, planPath, bindingsPath, stats, mode, bind, options, attempts }: { plan: BlockingPlan; bindings: BlockingBindings | null; planPath: string; bindingsPath: string; stats: GenerateBlockingPlanResult['stats']; mode: 'llm' | 'import'; bind: boolean; options: GenerateBlockingPlanOptions; attempts: number }): Promise<GenerateBlockingPlanResult> => {
  await mkdir(dirname(planPath), { recursive: true })
  await Bun.write(planPath, serializeBlockingPlan(plan))
  stats.filesProcessed++
  if (bindings) {
    await Bun.write(bindingsPath, `${JSON.stringify(bindings, null, 2)}\n`)
    stats.filesProcessed++
  }
  const details = [
    `file=${basename(planPath)}`,
    mode === 'llm' ? `model=${plan.generatedBy.model ?? options.model}` : 'source=import',
    mode === 'llm' ? `tokens=${(stats.totalInputTokens + stats.totalOutputTokens).toLocaleString()}` : undefined,
    mode === 'llm' ? `cost=${formatCompactCost(stats.totalCost)}` : undefined,
    mode === 'llm' ? `api=${formatDuration(stats.totalDurationMs)}` : undefined,
    `attempts=${attempts}`,
    `states=${plan.stageStates.length}`,
    `cameras=${plan.cameraSetups.length}`,
  ]
  comicLog.line(mode === 'llm' ? 'blocking-plan generated' : 'blocking-plan imported', details)
  if (bindings) comicLog.line('blocking-bindings generated', [`file=${basename(bindingsPath)}`, `panels=${bindings.panels.length}`])
  return { mode, bind, planPath, bindingsPath: bindings ? bindingsPath : null, plan, bindings, attempts, stats }
}
