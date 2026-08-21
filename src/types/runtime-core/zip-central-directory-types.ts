export type ZipArchiveOptions = {
  /** Error stage recorded on any ValidationError raised while parsing. */
  stage: string
  /** Applied to each central-directory entry name; EPUB uses it to normalize separators. */
  normalizeEntryName?: ((name: string) => string) | undefined
}
