import type { LogSink } from '~/types'

export const createJsonSink = (): LogSink => (event) => {
  process.stderr.write(`${JSON.stringify(event)}\n`)
}
