export type GeminiPart = {
  text?: string | undefined
  thought?: boolean | undefined
  inlineData?: {
    data?: string | undefined
    mimeType?: string | undefined
  } | undefined
  fileData?: {
    fileUri?: string | undefined
    mimeType?: string | undefined
  } | undefined
  [key: string]: unknown
}

export type GeminiContent = {
  role?: string | undefined
  parts: GeminiPart[]
}

export type GeminiGenerateContentUsageMetadata = {
  promptTokenCount?: number | undefined
  candidatesTokenCount?: number | undefined
  totalTokenCount?: number | undefined
  cachedContentTokenCount?: number | undefined
  thoughtsTokenCount?: number | undefined
  toolUsePromptTokenCount?: number | undefined
  promptTokensDetails?: Array<{
    modality?: string | undefined
    tokenCount?: number | undefined
    [key: string]: unknown
  }> | undefined
  candidatesTokensDetails?: Array<{
    modality?: string | undefined
    tokenCount?: number | undefined
    [key: string]: unknown
  }> | undefined
  [key: string]: unknown
}

export type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[] | undefined
      [key: string]: unknown
    } | undefined
    groundingMetadata?: unknown
    [key: string]: unknown
  }> | undefined
  usageMetadata?: GeminiGenerateContentUsageMetadata | undefined
  promptFeedback?: {
    blockReason?: string | undefined
    [key: string]: unknown
  } | undefined
  modelVersion?: string | undefined
  responseId?: string | undefined
  text?: string | undefined
  sdkHttpResponse?: {
    headers: Headers
    status: number
  } | undefined
  [key: string]: unknown
}

export type GeminiFile = {
  name?: string | undefined
  uri?: string | undefined
  mimeType?: string | undefined
  state?: string | { name?: string | undefined } | undefined
  [key: string]: unknown
}

export type GeminiVideo = {
  uri?: string | undefined
  videoBytes?: string | undefined
  mimeType?: string | undefined
}

export type GeminiInlineMedia = {
  inlineData: {
    mimeType: string
    data: string
  }
}

export type GeminiVideoImageMedia = {
  mimeType: string
  bytesBase64Encoded: string
}


export type GeminiGeneratedVideo = {
  video?: GeminiVideo | undefined
}

export type GeminiVideoOperation = {
  name?: string | undefined
  done?: boolean | undefined
  error?: unknown
  metadata?: unknown
  response?: {
    generatedVideos?: GeminiGeneratedVideo[] | undefined
    raiMediaFilteredCount?: unknown
    raiMediaFilteredReasons?: unknown
  } | undefined
  [key: string]: unknown
}

export type GeminiVideoReferenceImage = {
  image: GeminiInlineMedia
  referenceType: 'asset'
}
