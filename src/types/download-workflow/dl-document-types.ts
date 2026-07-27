import type { PreparedDocument } from '~/types'

export type EbookConvertCommandOptions = {
  resolveCalibreBin?: (tool: string) => string
  which?: (command: string) => string | null
}

export type PreparedDocumentMetadata = Pick<PreparedDocument, 'step1Metadata' | 'effectiveFilePath' | 'tempCleanup'>
