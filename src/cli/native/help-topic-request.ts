import { UsageError } from '~/utils/error-handler'

export const takeHelpTopic = (argv: readonly string[]): { argv: string[], topic?: string } => {
  const result: string[] = []
  let topic: string | undefined
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (arg === '--') { result.push(...argv.slice(i)); break }
    if (arg === '--help-topic' || arg.startsWith('--help-topic=')) {
      if (topic !== undefined) throw UsageError('Specify --help-topic only once.')
      const value = arg === '--help-topic' ? argv[++i] : arg.slice('--help-topic='.length)
      if (!value?.trim() || value.startsWith('-')) throw UsageError('--help-topic requires a topic. Use --help to list topics.')
      topic = value.trim()
    } else result.push(arg)
  }
  if (topic !== undefined) {
    const boundary = result.indexOf('--')
    result.splice(boundary < 0 ? result.length : boundary, 0, '--help')
  }
  return { argv: result, ...(topic !== undefined ? { topic } : {}) }
}
