import * as v from 'valibot'

export const LumalabsGenerationSchema = v.object({
  id: v.string(),
  state: v.string(),
  failure_code: v.optional(v.nullable(v.string()), undefined),
  failure_reason: v.optional(v.nullable(v.string()), undefined),
  output: v.optional(v.nullable(v.array(v.object({
    type: v.optional(v.string(), undefined),
    url: v.string()
  }))), undefined)
})
