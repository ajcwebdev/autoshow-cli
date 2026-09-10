import { downloadDocumentUrlToTempFile } from '~/cli/commands/sources/download/document/resolve-document-source'
import type { TemporaryDirectDocumentAcquirer } from '~/types'

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
