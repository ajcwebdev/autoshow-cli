import { BFL_MODELS_LINKS, LTX_MODELS_LINKS, REPLICATE_MODELS_LINKS } from './model-providers'

export const FAL_IMAGE_LINKS = [
  'https://fal.ai/models/fal-ai/hidream-o1-image/api',
  'https://fal.ai/models/microsoft/mai-image-2.5/api',
  'https://fal.ai/models/microsoft/mai-image-2.5-pro/api',
  'https://fal.ai/models/alibaba/qwen-image-3/text-to-image/api',
  'https://fal.ai/models/alibaba/qwen-image-3/edit/api',
  'https://fal.ai/models/reve/2.1/text-to-image/api',
  'https://fal.ai/models/reve/2.1/edit/api'
]

export const FAL_VIDEO_LINKS = [
  'https://fal.ai/models/minimax/h3/text-to-video/api',
  'https://fal.ai/models/minimax/h3/image-to-video/api',
  'https://fal.ai/models/minimax/h3/reference-to-video/api',
  'https://fal.ai/models/fal-ai/pixverse/c1/text-to-video/api',
  'https://fal.ai/models/fal-ai/pixverse/c1/image-to-video/api',
  'https://fal.ai/models/fal-ai/pixverse/c1/reference-to-video/api',
  'https://fal.ai/models/fal-ai/pixverse/c1/transition/api'
]

export const BFL_IMAGE_LINKS = [
  'https://docs.bfl.ml/quick_start/introduction.md',
  'https://docs.bfl.ml/quick_start/get_started.md',
  'https://docs.bfl.ml/quick_start/generating_images.md',
  'https://docs.bfl.ml/quick_start/pricing.md',
  'https://docs.bfl.ml/account_management/credits_billing.md',
  'https://docs.bfl.ml/api_integration/integration_guidelines.md'
]

export const BFL_ALL_LINKS = [
  ...BFL_MODELS_LINKS,
  ...BFL_IMAGE_LINKS
]

export const LTX_VIDEO_LINKS = [
  'https://docs.ltx.video/welcome.md',
  'https://docs.ltx.video/quickstart.md',
  'https://docs.ltx.video/authentication.md',
  'https://docs.ltx.video/input-formats.md',
  'https://docs.ltx.video/api-documentation/implementation-guides/prompting-guide.md',
  'https://docs.ltx.video/async-jobs.md',
  'https://docs.ltx.video/rate-limits.md',
  'https://docs.ltx.video/errors.md',
  'https://docs.ltx.video/debugging.md',
  'https://docs.ltx.video/pricing.md',
  'https://docs.ltx.video/auto-top-up.md',
  'https://docs.ltx.video/api-documentation/api-reference/video-generation/text-to-video.md',
  'https://docs.ltx.video/api-documentation/api-reference/video-generation/image-to-video.md',
  'https://docs.ltx.video/api-documentation/api-reference/video-generation/audio-to-video.md',
  'https://docs.ltx.video/api-documentation/api-reference/video-generation/retake.md',
  'https://docs.ltx.video/api-documentation/api-reference/video-generation/extend.md'
]

export const LTX_ALL_LINKS = [
  ...LTX_MODELS_LINKS,
  ...LTX_VIDEO_LINKS
]

export const RECRAFT_IMAGE_LINKS = [
  'https://www.recraft.ai/docs/.md',
  'https://www.recraft.ai/docs/api-reference/getting-started.md',
  'https://www.recraft.ai/docs/api-reference/endpoints.md',
  'https://www.recraft.ai/docs/api-reference/examples.md',
  'https://www.recraft.ai/docs/api-reference/pricing.md',
  'https://www.recraft.ai/docs/api-reference/styles.md',
  'https://www.recraft.ai/docs/api-reference/swagger.md',
  'https://www.recraft.ai/docs/api-reference/appendix.md',
  'https://www.recraft.ai/docs/best-practices/prompting-and-image-generation.md'
]

export const REPLICATE_GENERAL_LINKS = [
  'https://replicate.com/docs/topics/predictions.md',
  'https://replicate.com/docs/topics/predictions/lifecycle.md',
  'https://replicate.com/docs/topics/predictions/rate-limits.md',
  'https://replicate.com/docs/topics/predictions/create-a-prediction.md',
  'https://replicate.com/docs/topics/predictions/input-files.md',
  'https://replicate.com/docs/topics/predictions/output-files.md',
  'https://replicate.com/docs/topics/security/api-tokens.md',
  'https://replicate.com/docs/reference/how-does-replicate-work.md',
  'https://replicate.com/docs/reference/http.md',
  'https://replicate.com/docs/llms.txt'
]

export const REPLICATE_ALL_LINKS = [
  ...REPLICATE_GENERAL_LINKS,
  ...REPLICATE_MODELS_LINKS
]
