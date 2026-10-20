import * as v from 'valibot'

const ResearchTextSchema = v.pipe(v.string(), v.minLength(1))
const ResearchTextListSchema = v.array(ResearchTextSchema)

const DiscussedSourceSchema = v.strictObject({
  sourceCategory: v.picklist(['createdWork', 'officialRecord', 'personalAccount']),
  sourceName: ResearchTextSchema,
  authorCreator: v.nullable(ResearchTextSchema),
  sourceType: ResearchTextSchema,
  firstReference: ResearchTextSchema,
  context: ResearchTextSchema,
  confidence: v.pipe(v.number(), v.minValue(0), v.maxValue(1))
})

const LiteratureThemeSchema = v.strictObject({
  heading: ResearchTextSchema,
  synthesis: ResearchTextSchema,
  evidence: ResearchTextListSchema
})

export const RESEARCH_PRESET_SCHEMAS = {
  sources: v.strictObject({
    sources: v.array(DiscussedSourceSchema)
  }),
  literatureReview: v.strictObject({
    title: ResearchTextSchema,
    abstract: ResearchTextSchema,
    introduction: ResearchTextSchema,
    theoreticalFrameworks: ResearchTextListSchema,
    themes: v.array(LiteratureThemeSchema),
    methodologicalAnalysis: ResearchTextSchema,
    criticalEvaluation: ResearchTextSchema,
    researchGaps: ResearchTextListSchema,
    futureDirections: ResearchTextListSchema,
    conclusion: ResearchTextSchema,
    references: ResearchTextListSchema
  })
} as const
