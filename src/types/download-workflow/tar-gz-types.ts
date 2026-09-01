export type TarGzExtractOptions = {
  destination: string
  stripComponents?: number
  maxCompressedBytes?: number
  maxExpandedBytes?: number
  maxEntryBytes?: number
  maxEntries?: number
}
