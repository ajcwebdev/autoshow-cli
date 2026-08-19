export type TemporaryDirectDocument = {
  filePath: string
  cleanup: () => Promise<void>
}

export type TemporaryDirectDocumentAcquirer = (
  url: string
) => Promise<TemporaryDirectDocument>
