export type ZipArchiveOptions = {
  stage: string
  normalizeEntryName?: ((name: string) => string) | undefined
}
