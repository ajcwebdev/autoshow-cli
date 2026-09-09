import * as v from 'valibot'

const optionalScore = () => v.optional(v.nullable(v.number()), undefined)

export const MistralOcrPageMetadataSchema = v.object({
  blocks: v.optional(v.nullable(v.array(v.object({
    type: v.string(),
    top_left_x: v.number(),
    top_left_y: v.number(),
    bottom_right_x: v.number(),
    bottom_right_y: v.number(),
    content: v.string(),
    image_id: v.optional(v.nullable(v.string()), undefined),
    table_id: v.optional(v.nullable(v.string()), undefined),
    confidence_scores: v.optional(v.nullable(v.object({
      average_content_confidence_score: optionalScore(),
      minimum_content_confidence_score: optionalScore(),
      block_type_confidence_score: optionalScore()
    })), undefined)
  }))), undefined),
  confidence_scores: v.optional(v.nullable(v.object({
    average_page_confidence_score: optionalScore(),
    minimum_page_confidence_score: optionalScore()
  })), undefined)
})
