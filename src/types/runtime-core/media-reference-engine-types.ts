type MediaReferencePolicy =
  | { mode: 'strict' }
  | { mode: 'lenient', contentTypePrefix: string, fallbackMimeType: string }

export type MediaKindSpec = {
  allowedMimeTypes: readonly string[]
  mimeByExtension: Readonly<Record<string, string>>
  mimeAliases: Readonly<Record<string, string>>
  dataUrlPattern: RegExp
  policy: MediaReferencePolicy
  accept: string
  defaultFileName: (mimeType: string) => string
  errors: {
    download: (status: number, url: string) => string
    unsupportedLocal: (value: string) => string
    unsupportedUrl: (url: string) => string
    unsupportedDataUrl: () => string
  }
  downloadError: {
    stage: string
  }
}

export type MediaReferenceBytes = {
  bytes: Uint8Array
  mimeType: string
  fileName: string
}

export type ReferenceValidationOptions = {
  allowedMimeTypes?: readonly string[] | undefined
  maxInputs?: number | undefined
  maxInputsError?: ((maxInputs: number) => string) | undefined
  missingFileError: (value: string) => string
  unsupportedMimeError: (value: string) => string
}
