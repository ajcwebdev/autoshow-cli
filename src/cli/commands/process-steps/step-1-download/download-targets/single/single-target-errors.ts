import { CLIUsageError } from '~/utils/error-handler'

export const throwUnrecognizedExtractInput = (
  item: string
): never => {
  throw CLIUsageError(`Could not classify extract input "${item}". Verify the file type or route it explicitly as media or document content.`)
}
