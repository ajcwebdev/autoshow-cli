/**
 * What a successful HTTP body is for, which decides how much of it may be held in memory.
 * `control` is small control-plane JSON (status polls, catalogs, metadata). `result` is a provider
 * deliverable: generation output, transcripts and media inlined as base64 or hex. `download` is a
 * fetched media file.
 */
export type HttpPayloadClass = 'control' | 'result' | 'download'

export type HttpPayloadReadOptions = {
  /** Defaults to `result`, so an undeclared caller never inherits the small control ceiling. */
  payloadClass?: HttpPayloadClass | undefined
  /** Replaces the class ceiling for one call. The environment override still wins. */
  maxBytes?: number | undefined
  stage?: string | undefined
}

export type HttpPayloadLimit = {
  maxBytes: number
  source: 'environment' | 'call' | 'class'
  payloadClass: HttpPayloadClass
}

export type InlineMediaResponseEstimate = {
  /** Decoded media bytes the provider is expected to return. */
  mediaBytes: number
  encoding: 'base64' | 'hex'
  /** JSON around the media field, such as timestamps. */
  envelopeBytes?: number | undefined
}
