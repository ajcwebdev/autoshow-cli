import { afterEach } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { configureCharactersRoot } from '~/cli/commands/command-shared/characters-root'
import { configureOutputRoot } from '~/cli/commands/command-shared/output-root'
import { getSceneJsonPath, getStructuredScriptPath } from '~/cli/commands/visuals/comic/comic-utils/project-paths'
import { beginSceneRun, resetSceneRunContext } from '~/cli/commands/visuals/comic/comic-utils/scene-run-context'
import type { BlockingPlan, BlockingScenePanelInput } from '~/types'
import { sha256Bytes } from '~/utils/value-helpers'
import { makeTempDir } from '../../../../test-utils/temp-dirs'
import { BLOCKING_FIXTURE_SCENE_SLUG, buildBlockingFixturePlan, buildBlockingFixtureScene, buildBlockingFixtureScenePanels, buildBlockingFixtureStructuredScript, buildBlockingFixtureValidationContext, writeBlockingFixtureInputRoot } from './fixtures/blocking/blocking-plan-fixture'

export const setupBlockingContractFixtures = () => {
  const temporaryDirectories: string[] = []

  afterEach(async () => {
    resetSceneRunContext()
    configureOutputRoot('./output')
    configureCharactersRoot('input/characters')
    await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
  })

  const script = buildBlockingFixtureStructuredScript()
  const segmentOrder = script.sourceSegments.map(segment => segment.id)
  const fixturePlan = (): BlockingPlan => buildBlockingFixturePlan(script)
  const fixturePanels = (): BlockingScenePanelInput[] => buildBlockingFixtureScenePanels()
  const context = () => buildBlockingFixtureValidationContext(script)
  const messages = (issues: Array<{ message: string }>): string[] => issues.map(issue => issue.message)

  const stripStampedFields = (plan: BlockingPlan): Record<string, unknown> => {
    const clone = structuredClone(plan) as unknown as Record<string, unknown>
    delete clone['schemaVersion']
    delete clone['sceneSlug']
    delete clone['structuredScriptSha256']
    delete clone['generatedBy']
    const dropHash = (citation: unknown): void => { if (citation && typeof citation === 'object') delete (citation as Record<string, unknown>)['sourceSegmentSha256'] }
    for (const location of clone['locations'] as Array<Record<string, unknown>>) {
      delete location['specificationSha256']
      delete location['geometrySource']
      for (const item of location['suppressedAnchors'] as Array<Record<string, unknown>>) dropHash(item['citation'])
      for (const item of location['dressing'] as Array<Record<string, unknown>>) dropHash(item['citation'])
    }
    for (const state of clone['stageStates'] as Array<Record<string, unknown>>) {
      dropHash(state['startsAt'])
      for (const mark of state['characters'] as Array<Record<string, unknown>>) dropHash(mark['wardrobeCitation'])
      for (const move of state['moves'] as Array<Record<string, unknown>>) dropHash(move['citation'])
    }
    return clone
  }

  const reorderKeys = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(reorderKeys)
    if (!value || typeof value !== 'object') return value
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => right.localeCompare(left))
    return Object.fromEntries(entries.map(([key, item]) => [key, reorderKeys(item)]))
  }

  const visitJsonSchema = (value: unknown, visit: (record: Record<string, unknown>) => void): void => {
    if (Array.isArray(value)) { value.forEach(item => visitJsonSchema(item, visit)); return }
    if (!value || typeof value !== 'object') return
    const record = value as Record<string, unknown>
    visit(record)
    Object.values(record).forEach(item => visitJsonSchema(item, visit))
  }

  const prepareWorkspace = async (options: { scene?: boolean | undefined } = {}) => {
    const root = await makeTempDir('autoshow-blocking-inputs-')
    temporaryDirectories.push(root)
    const inputs = await writeBlockingFixtureInputRoot(root)
    configureCharactersRoot(inputs.charactersRoot)
    const workspace = await makeTempDir('autoshow-blocking-workspace-')
    temporaryDirectories.push(workspace)
    const slug = `${BLOCKING_FIXTURE_SCENE_SLUG}-${crypto.randomUUID().slice(0, 8)}`
    beginSceneRun(slug, { outputDir: workspace })
    const structuredPath = getStructuredScriptPath(slug)
    await mkdir(join(workspace, 'metadata'), { recursive: true })
    const structuredBytes = `${JSON.stringify(script, null, 2)}\n`
    await writeFile(structuredPath, structuredBytes)
    let sceneBytes: string | undefined
    if (options.scene) {
      sceneBytes = JSON.stringify(buildBlockingFixtureScene(), null, 2)
      await writeFile(getSceneJsonPath(slug), sceneBytes)
    }
    return { slug, workspace, inputs, structuredSha256: sha256Bytes(structuredBytes), sceneBytes }
  }

  const draftResponse = (plan: BlockingPlan, extra: Record<string, unknown> = {}) => ({ text: JSON.stringify({ ...stripStampedFields(plan), ...extra }), inputTokens: 1200, outputTokens: 800 })
  return { temporaryDirectories, script, segmentOrder, fixturePlan, fixturePanels, context, messages, stripStampedFields, reorderKeys, visitJsonSchema, prepareWorkspace, draftResponse }
}
