export type BunImageSource = Uint8Array | ArrayBuffer | Blob | string

export type BunImageEncoder = {
  bytes: () => Promise<Uint8Array>
}

export type BunImageMetadataReader = {
  metadata: () => Promise<{
    width?: number | undefined
    height?: number | undefined
  }>
}

export type BunImageReaderConstructor = new (source: BunImageSource) => BunImageMetadataReader & {
  metadata: () => Promise<{ width?: number | undefined; height?: number | undefined }>
  png: () => BunImageEncoder
}
