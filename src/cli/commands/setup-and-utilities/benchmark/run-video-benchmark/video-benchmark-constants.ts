export const DEFAULT_VIDEO_JUDGE_MODEL = 'gpt-5.5'
export const QUALITY_METRIC_NAME = 'video quality score'
export const VIDEO_FRAME_COUNT = 10

export const VIDEO_QUALITY_CRITERIA = [
  'prompt adherence',
  'visual quality',
  'artifact control',
  'temporal consistency',
  'composition/camera'
] as const

export const VIDEO_JUDGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'promptAdherence',
    'visualQuality',
    'artifactControl',
    'temporalConsistency',
    'compositionCamera',
    'summary',
    'strengths',
    'issues'
  ],
  properties: {
    promptAdherence: { type: 'integer', minimum: 1, maximum: 10 },
    visualQuality: { type: 'integer', minimum: 1, maximum: 10 },
    artifactControl: { type: 'integer', minimum: 1, maximum: 10 },
    temporalConsistency: { type: 'integer', minimum: 1, maximum: 10 },
    compositionCamera: { type: 'integer', minimum: 1, maximum: 10 },
    summary: { type: 'string' },
    strengths: {
      type: 'array',
      items: { type: 'string' }
    },
    issues: {
      type: 'array',
      items: { type: 'string' }
    }
  }
} as const
