export type OcrLikeContext = {
  flags: Record<string, unknown> & { out?: unknown }
  rawParsed: {
    explicitFlags: Set<string>
  }
}
