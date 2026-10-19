import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import type { WriteRuntimeOptions } from '~/types'
import { collectLeafPrompts, getAvailablePromptNames, getAvailablePromptNamesForHelp, resolvePromptNames } from '~/prompts/prompt-loader'
import { runTextWrite } from '~/cli/commands/text/write/run-text-write'
import { buildOptsFromFlags } from '~/cli/options/option-resolution/build-options-from-flags'
import { readManifest } from '~/cli/commands/command-shared/pipeline-manifest'
import { resolveStructuredSchema } from '~/cli/commands/text/write/structured-output/schema-resolver'
import { parseAndValidateStructured } from '~/cli/commands/text/write/structured-output/validator'
import { renderToPlainText } from '~/cli/commands/text/write/structured-output/renderers'
import { installFetch, installOpenAIRestContractHooks, jsonResponse, withTempDir } from '../../providers/openai-rest-contracts/shared'

installOpenAIRestContractHooks()

const FIRST_REFERENCE = '[00:03:12.450]'
const SOURCE_TEXT = `${FIRST_REFERENCE} Morgan describes the Harbor Survey and its observational method. No author or publication year is supplied.`
const SOURCE = {
  sourceCategory: 'createdWork',
  sourceName: 'Harbor Survey',
  authorCreator: null,
  sourceType: 'survey',
  firstReference: FIRST_REFERENCE,
  context: 'Morgan describes its observational method.',
  confidence: 0.9
}
const SOURCES = { sources: [SOURCE] }
const REVIEW = {
  title: 'Observational methods in the supplied discussion',
  abstract: 'The input describes a survey but supplies no comparative studies.',
  introduction: 'The discussion concerns observational research.',
  themes: [{
    heading: 'Observation',
    synthesis: 'The described survey uses observation; the input provides no detail about sampling.',
    evidence: ['[00:03:12.450] Morgan describes the observational method.']
  }],
  theoreticalFrameworks: [],
  methodologicalAnalysis: 'Only the observational method is supplied; its design cannot be assessed further.',
  criticalEvaluation: 'The supplied material does not establish comparative validity.',
  researchGaps: ['Sampling and measurement details are absent from the input.'],
  futureDirections: ['Compare the described method with additional supplied studies.'],
  conclusion: 'A limited synthesis is possible from this input.',
  references: ['Harbor Survey (author and publication details not supplied).']
}
const RESEARCH_PROMPTS = ['sources', 'literatureReview'] as const

const mockedWrite = async (dir: string, prompts: string[], response: string) => {
  process.env['OPENAI_API_KEY'] = 'test'
  const calls = installFetch(() => jsonResponse({
    model: 'gpt-6.1-sol',
    output_text: response,
    usage: { input_tokens: 50, output_tokens: 30 }
  }))
  const input = join(dir, 'research-input.txt')
  await Bun.write(input, SOURCE_TEXT)
  const flags = { openai: 'gpt-6.1-sol', prompt: prompts, 'rendered-text': true }
  const opts = {
    ...buildOptsFromFlags(flags, {}, new Set(Object.keys(flags)), { scope: 'write' }),
    configPath: undefined
  } as WriteRuntimeOptions
  const { outputDir } = await runTextWrite(input, dir, opts)
  return { calls, outputDir }
}

describe('research prompt discovery and source-grounding contracts', () => {
  test('discovers both named presets for command resolution and help', async () => {
    const names = await getAvailablePromptNames()
    const helpNames = getAvailablePromptNamesForHelp()
    for (const name of RESEARCH_PROMPTS) {
      expect(names).toContain(name)
      expect(helpNames).toContain(name)
      const schema = await resolveStructuredSchema([name])
      expect(schema.leafPromptNames).toEqual([name])
      expect(schema.presetNames).toEqual([name])
    }
  })

  test('both published JSON examples validate against their actual preset', async () => {
    for (const { name, entry } of await collectLeafPrompts([...RESEARCH_PROMPTS])) {
      const schema = await resolveStructuredSchema([name])
      const validation = parseAndValidateStructured(schema.schema, entry.examples.json)
      expect(validation.success).toBe(true)
      const markdown = await resolvePromptNames([name], { exampleFormat: 'markdown' })
      expect(markdown).toContain(entry.examples.markdown.trimEnd())
    }
  })

  test('instructions distinguish supplied evidence from unsupported external research', async () => {
    const [sources, review] = await collectLeafPrompts([...RESEARCH_PROMPTS])
    for (const leaf of [sources, review]) {
      expect(leaf?.entry.instruction).toMatch(/(?:supplied|provided|input)/i)
      expect(leaf?.entry.instruction).toMatch(/(?:do not|never) (?:invent|fabricate)/i)
      expect(leaf?.entry.instruction).toMatch(/(?:brows|web|external)/i)
    }
    expect(sources?.entry.instruction).toMatch(/(?:empty|\[\])/i)
    expect(sources?.entry.instruction).toMatch(/(?:timestamp|location)/i)
    expect(review?.entry.instruction).toMatch(/(?:insufficient|limitation|limited|missing)/i)
    expect(review?.entry.instruction).toMatch(/references/i)
  })
})

describe('sources decoded output contracts', () => {
  test('accepts all source categories, unknown authors, confidence boundaries, and exact original locations', async () => {
    const schema = await resolveStructuredSchema(['sources'])
    for (const sourceCategory of ['createdWork', 'officialRecord', 'personalAccount']) {
      for (const confidence of [0, 1]) {
        for (const firstReference of [FIRST_REFERENCE, '1:02:03', 'Chapter 2, paragraph 7']) {
          const payload = { sources: [{ ...SOURCE, sourceCategory, confidence, firstReference }] }
          const validated = parseAndValidateStructured(schema.schema, JSON.stringify(payload))
          expect(validated.success).toBe(true)
          expect(validated.value).toEqual(payload)
          expect(renderToPlainText(validated.value, ['sources'])).toContain(firstReference)
        }
      }
    }
    expect(parseAndValidateStructured(schema.schema, JSON.stringify({ sources: [{ ...SOURCE, authorCreator: 'Morgan' }] })).success).toBe(true)
    expect(parseAndValidateStructured(schema.schema, '{"sources":[]}').success).toBe(true)
    expect(renderToPlainText({ sources: [] }, ['sources'])).toContain('(none)')
  })

  test('rejects missing fields, unknown taxonomy, invalid confidence, bad collections, and extra fields', async () => {
    const schema = await resolveStructuredSchema(['sources'])
    const invalid: unknown[] = [
      {}, { sources: null }, { sources: {} }, { sources: ['Harbor Survey'] },
      { ...SOURCES, inventedField: true },
      { sources: [{ ...SOURCE, inventedField: true }] },
      { sources: [{ ...SOURCE, sourceCategory: 'website' }] },
      ...[-0.01, 1.01, '0.9', null].map(confidence => ({ sources: [{ ...SOURCE, confidence }] })),
      ...['sourceName', 'sourceType', 'firstReference', 'context', 'authorCreator'].map(key => ({ sources: [{ ...SOURCE, [key]: '' }] })),
      ...['sourceName', 'sourceType', 'firstReference', 'context'].map(key => ({ sources: [{ ...SOURCE, [key]: null }] })),
      ...Object.keys(SOURCE).map(key => ({ sources: [Object.fromEntries(Object.entries(SOURCE).filter(([field]) => field !== key))] }))
    ]
    for (const payload of invalid) {
      expect(parseAndValidateStructured(schema.schema, JSON.stringify(payload)).success).toBe(false)
    }
    expect(parseAndValidateStructured(schema.schema, '{"sources":[').success).toBe(false)
  })
})

describe('literature review decoded output contracts', () => {
  test('accepts evidence-backed sections and explicit absence of evidence or references', async () => {
    const schema = await resolveStructuredSchema(['literatureReview'])
    const validated = parseAndValidateStructured(schema.schema, JSON.stringify(REVIEW))
    expect(validated.success).toBe(true)
    expect(validated.value).toEqual(REVIEW)
    const limitedReview = {
      ...REVIEW,
      themes: [{ ...REVIEW.themes[0], evidence: [] }],
      theoreticalFrameworks: [], researchGaps: [], futureDirections: [], references: []
    }
    expect(parseAndValidateStructured(schema.schema, JSON.stringify(limitedReview)).success).toBe(true)
    expect(parseAndValidateStructured(schema.schema, JSON.stringify({ ...limitedReview, themes: [] })).success).toBe(true)
    const rendered = renderToPlainText(validated.value, ['literatureReview'])
    expect(rendered).toContain('## Methodological Analysis')
    expect(rendered).toContain(REVIEW.methodologicalAnalysis)
    expect(rendered).toContain(REVIEW.references[0]!)
    expect(rendered).toContain(FIRST_REFERENCE)
  })

  test('rejects missing sections, malformed arrays, empty required text, and extra properties', async () => {
    const schema = await resolveStructuredSchema(['literatureReview'])
    const invalid: unknown[] = [
      ...Object.keys(REVIEW).map(key => Object.fromEntries(Object.entries(REVIEW).filter(([field]) => field !== key))),
      ...['title', 'abstract', 'introduction', 'methodologicalAnalysis', 'criticalEvaluation', 'conclusion'].flatMap(key => [
        { ...REVIEW, [key]: '' }, { ...REVIEW, [key]: null }
      ]),
      ...['theoreticalFrameworks', 'researchGaps', 'futureDirections', 'references'].flatMap(key => [
        { ...REVIEW, [key]: 'not an array' }, { ...REVIEW, [key]: [''] }, { ...REVIEW, [key]: [null] }
      ]),
      { ...REVIEW, extra: true }, { ...REVIEW, themes: {} }, { ...REVIEW, themes: ['unstructured theme'] },
      ...[
        { heading: '', synthesis: 'A synthesis', evidence: [] },
        { heading: 'A theme', synthesis: '', evidence: [] },
        { heading: 'A theme', synthesis: 'A synthesis' },
        { heading: 'A theme', synthesis: 'A synthesis', evidence: [''] },
        { heading: 'A theme', synthesis: 'A synthesis', evidence: null },
        { heading: 'A theme', synthesis: 'A synthesis', evidence: [], invented: true }
      ].map(theme => ({ ...REVIEW, themes: [theme] }))
    ]
    for (const payload of invalid) {
      expect(parseAndValidateStructured(schema.schema, JSON.stringify(payload)).success).toBe(false)
    }
    expect(parseAndValidateStructured(schema.schema, 'not JSON').success).toBe(false)
  })

  test('combined selection validates separate named leaves and its composed JSON example', async () => {
    const names = [...RESEARCH_PROMPTS]
    const schema = await resolveStructuredSchema(names)
    expect(schema.presetNames).toEqual(names)
    const payload = { sources: SOURCES, literatureReview: REVIEW }
    const validated = parseAndValidateStructured(schema.schema, JSON.stringify(payload))
    expect(validated.success).toBe(true)
    expect(validated.value).toEqual(payload)
    expect(parseAndValidateStructured(schema.schema, JSON.stringify(SOURCES)).success).toBe(false)
    const prompt = await resolvePromptNames(names)
    const example = prompt.split('Example JSON output:\n\n')[1]
    expect(example).toBeDefined()
    expect(parseAndValidateStructured(schema.schema, example!).success).toBe(true)
    expect(renderToPlainText(validated.value, names)).toContain('## Literature Review')
  })
})

describe('research write mocked transport and artifact integrity', () => {
  // Mocked fixtures establish dispatch and decoded artifact integrity, not generated factual quality.
  for (const { prompts, payload } of [
    { prompts: ['sources'], payload: SOURCES },
    { prompts: ['literatureReview'], payload: REVIEW },
    { prompts: [...RESEARCH_PROMPTS], payload: { sources: SOURCES, literatureReview: REVIEW } }
  ]) {
    test(`${prompts.join('+')} dispatches a native schema and saves valid JSON, rendered text, and manifest metadata`, async () => {
      await withTempDir(async dir => {
        const { calls, outputDir } = await mockedWrite(dir, prompts, JSON.stringify(payload))
        const schema = await resolveStructuredSchema(prompts)
        expect(calls).toHaveLength(1)
        expect(calls[0]?.url).toEndWith('/responses')
        expect(calls[0]?.bodyJson).toMatchObject({
          model: 'gpt-6.1-sol',
          text: { format: { type: 'json_schema', name: schema.schemaName, strict: true, schema: schema.jsonSchema } }
        })
        expect(calls[0]?.bodyJson?.['input']).toContain(SOURCE_TEXT)
        expect(await Bun.file(join(outputDir, 'text.json')).json()).toEqual(payload)
        expect(await Bun.file(join(outputDir, 'text.md')).text()).toContain('Harbor Survey')
        const manifest = await readManifest(outputDir)
        expect(manifest?.items[0]?.metadata['step3']).toMatchObject({
          llmService: 'openai', llmModel: 'gpt-6.1-sol', structuredMode: 'native',
          structuredPresetNames: prompts, validationFailed: false, outputFileName: 'text.json'
        })
        expect(manifest?.items[0]?.providers[0]?.settings?.local).toMatchObject({ prompts, structuredPresetNames: prompts })
      })
    })
  }

  for (const prompt of RESEARCH_PROMPTS) {
    test(`${prompt} preserves invalid mocked provider output as a marked failure artifact`, async () => {
      await withTempDir(async dir => {
        const raw = '{"unsupported":"invented output shape"}'
        const { calls, outputDir } = await mockedWrite(dir, [prompt], raw)
        expect(calls).toHaveLength(1)
        const artifact = await Bun.file(join(outputDir, 'text.json')).json()
        expect(artifact).toMatchObject({ _raw: raw, _validationError: expect.any(String) })
        expect(artifact).not.toHaveProperty(prompt === 'sources' ? 'sources' : 'title')
        const rendered = await Bun.file(join(outputDir, 'text.md')).text()
        expect(rendered).toContain('## Structured Validation Error')
        expect(rendered).toContain(raw)
        const manifest = await readManifest(outputDir)
        expect(manifest?.items[0]?.metadata['step3']).toMatchObject({ validationFailed: true, structuredPresetNames: [prompt] })
      })
    })
  }
})
