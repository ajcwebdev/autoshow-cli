import { afterAll, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildAggregatedPriceEstimate } from '~/cli/commands/pricing-orchestration/aggregate-pricing'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { isLikelyInputListFile, readInputList } from '~/cli/commands/sources/metadata/metadata-targets/metadata-input-collection'
import { readPromptFile } from '~/cli/commands/text/write/text-input-utils'
import { resolveStructuredSchema } from '~/cli/commands/text/write/structured-output/schema-resolver'

const temporary = await mkdtemp(join(tmpdir(), 'autoshow-write-input-'))
const sourcePath = join(temporary, 'source.txt')
const leafPath = join(temporary, 'leaf.json')
const prose = 'This deliberately long paragraph explains the relationship between the two observations. '.repeat(100)
await writeFile(sourcePath, prose)
await writeFile(leafPath, JSON.stringify({
  description: 'A complete transformation of the source.',
  expectedInputTokens: 10,
  expectedOutputTokens: 3000,
  instruction: 'Transform every sentence without shortening the source.',
  examples: { json: '{"content":"Complete transformed text"}', markdown: '' }
}))

afterAll(async () => { await rm(temporary, { recursive: true, force: true }) })

const options = (promptFile: string) => buildOptsFromFlags({
  openai: 'gpt-6-astra',
  'prompt-file': promptFile
}, {}, new Set(['openai', 'prompt-file']), { scope: 'write' })

test('long paragraphs and JSON-encoded prose remain text inputs', async () => {
  expect(await isLikelyInputListFile(sourcePath)).toBe(false)
  const jsonProse = join(temporary, 'structured-prose.txt')
  await writeFile(jsonProse, JSON.stringify({ paragraphs: [prose, prose] }, null, 2))
  expect(await isLikelyInputListFile(jsonProse)).toBe(false)
  const multilineJson = join(temporary, 'multiline-json.txt')
  await writeFile(multilineJson, JSON.stringify({ content: 'A line of prose ending here.\n'.repeat(30) }, null, 2))
  expect(await isLikelyInputListFile(multilineJson)).toBe(false)
})

test('real relative paths and URLs remain input lists when prose entries are too long for paths', async () => {
  const listPath = join(temporary, 'list.txt')
  await writeFile(listPath, `source.txt\nhttps://example.org/article\n${prose}\n`)
  expect(await isLikelyInputListFile(listPath)).toBe(true)
  expect(await readInputList(listPath)).toEqual([sourcePath, 'https://example.org/article'])
})

test('filename component limits do not reject long valid nested paths', async () => {
  const nested = join(temporary, 'a'.repeat(100), 'b'.repeat(100))
  await mkdir(nested, { recursive: true })
  const target = join(nested, `${'c'.repeat(100)}.txt`)
  await writeFile(target, 'Valid local source.')
  const listPath = join(temporary, 'nested-list.txt')
  await writeFile(listPath, `${target}\n`)
  expect(await isLikelyInputListFile(listPath)).toBe(true)
  expect(await readInputList(listPath)).toEqual([target])
  const unicodeProse = join(temporary, 'unicode-prose.txt')
  await writeFile(unicodeProse, 'é'.repeat(200))
  expect(await isLikelyInputListFile(unicodeProse)).toBe(false)
})

test('custom JSON prompt estimates include the source and declared response length', async () => {
  const estimate = await buildAggregatedPriceEstimate('write', sourcePath, options(leafPath))
  const step = estimate.steps[0]!
  expect(step.step).toBe('llm')
  if (step.step !== 'llm') throw new Error('Missing LLM estimate')
  expect(step.estimatedInputTokens).toBeGreaterThan(1500)
  expect(step.estimatedOutputTokens).toBe(3000)
  expect(step.totalCost).toBeGreaterThan(15)
})

test('larger source text increases custom prompt pricing without changing its output declaration', async () => {
  const largerPath = join(temporary, 'larger.txt')
  await writeFile(largerPath, prose.repeat(8))
  const small = await buildAggregatedPriceEstimate('write', sourcePath, options(leafPath))
  const large = await buildAggregatedPriceEstimate('write', largerPath, options(leafPath))
  expect(large.totalEstimatedCost).toBeGreaterThan(small.totalEstimatedCost)
  const step = large.steps[0]!
  if (step.step !== 'llm') throw new Error('Missing LLM estimate')
  expect(step.estimatedOutputTokens).toBe(3000)
})

test('freeform text prompts expose a nonzero output heuristic', async () => {
  const promptPath = join(temporary, 'freeform.txt')
  await writeFile(promptPath, 'Rewrite the complete source in clear prose.')
  const estimate = await buildAggregatedPriceEstimate('write', sourcePath, options(promptPath))
  const step = estimate.steps[0]!
  if (step.step !== 'llm') throw new Error('Missing LLM estimate')
  expect(step.estimatedOutputTokens).toBeGreaterThanOrEqual(1024)
  expect(step.pricingNote).toContain('Freeform output estimate')
  expect(step.pricingNote).toContain('reasoning')
})

test('malformed JSON prompt files fail during pricing, before paid dispatch', async () => {
  const promptPath = join(temporary, 'invalid.json')
  await writeFile(promptPath, '{"instruction":"missing required fields"}')
  await expect(buildAggregatedPriceEstimate('write', sourcePath, options(promptPath))).rejects.toThrow()
})

test('a standalone JSON prompt uses only its own response schema, without default summaries', async () => {
  const prompt = await readPromptFile(leafPath)
  if (prompt?.kind !== 'leaf') throw new Error('Missing custom prompt')
  const schema = await resolveStructuredSchema([], { extraLeaves: [{ name: prompt.name, entry: prompt.leaf }] })
  expect(schema.leafPromptNames).toEqual(['leaf'])
  expect(schema.presetNames).toEqual([])
  expect(schema.jsonSchema['required']).toEqual(['content'])
})
