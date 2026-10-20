import * as v from 'valibot'

const ExplainerTextSchema = v.pipe(v.string(), v.minLength(1), v.regex(/\S/))
const ExplainerTextListSchema = v.array(ExplainerTextSchema)

export const SongExplainerSchema = v.strictObject({
  inputType: v.picklist(['sourceOnly', 'lyricsOnly', 'lyricsAndSource']),
  title: ExplainerTextSchema,
  overview: ExplainerTextSchema,
  background: ExplainerTextListSchema,
  glossary: v.array(v.strictObject({
    term: ExplainerTextSchema,
    kind: ExplainerTextSchema,
    explanation: ExplainerTextSchema,
    relevance: ExplainerTextSchema,
    evidenceBasis: v.picklist(['sourceText', 'lyrics', 'generalKnowledge', 'interpretation', 'uncertain']),
    locations: ExplainerTextListSchema
  })),
  lyricAnnotations: v.array(v.strictObject({
    section: ExplainerTextSchema,
    lineNumber: v.pipe(v.number(), v.integer(), v.minValue(1)),
    lyric: ExplainerTextSchema,
    explanation: ExplainerTextSchema,
    sourceConnection: v.nullable(ExplainerTextSchema)
  })),
  uncertainties: ExplainerTextListSchema
})

// Keep these cross-field checks separate from the schema sent to providers:
// custom Valibot refinements cannot be represented by the native JSON schema.
export const validateSongExplainerSemantics = (
  output: v.InferOutput<typeof SongExplainerSchema>
): string | undefined => {
  if (output.inputType === 'sourceOnly' && output.lyricAnnotations.length > 0) {
    return 'sourceOnly output must have an empty lyricAnnotations array because no lyrics were supplied'
  }
  if (output.inputType === 'lyricsOnly' && output.lyricAnnotations.some(annotation => annotation.sourceConnection !== null)) {
    return 'lyricsOnly output must use null for every sourceConnection because no original source was supplied'
  }
  for (const [index, annotation] of output.lyricAnnotations.entries()) {
    if (annotation.lineNumber !== index + 1) {
      return `lyricAnnotations[${index}].lineNumber must be ${index + 1}; global lyric line numbers must start at 1 and be contiguous in annotation order`
    }
  }
  return undefined
}
