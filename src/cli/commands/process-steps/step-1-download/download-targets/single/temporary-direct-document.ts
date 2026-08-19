import { downloadDocumentUrlToTempFile } from '~/cli/commands/process-steps/step-1-download/document/resolve-document-source'

export type TemporaryDirectDocument = {
  filePath: string
  cleanup: () => Promise<void>
}

export type TemporaryDirectDocumentAcquirer = (
  url: string
) => Promise<TemporaryDirectDocument>

export const withTemporaryDirectDocument = async <T>(
  url: string,
  handle: (filePath: string) => Promise<T>,
  acquire: TemporaryDirectDocumentAcquirer = downloadDocumentUrlToTempFile
): Promise<T> => {
  const document = await acquire(url)
  try {
    return await handle(document.filePath)
  } finally {
    await document.cleanup()
  }
}
