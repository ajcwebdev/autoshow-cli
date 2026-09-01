import type { TtsConfigField } from '~/types'
import * as l from '~/utils/app-logger/app-logger'
import { createHumanTable } from '~/utils/app-logger/human-table/human-table'
import { AsyncLocalStorage } from 'node:async_hooks'

const configLogScope = new AsyncLocalStorage<Set<string>>()

export const runWithTtsConfigLogScope = async <T>(work: () => Promise<T>): Promise<T> =>
  configLogScope.getStore() ? await work() : await configLogScope.run(new Set<string>(), work)

export const logTtsConfig = (provider: string, fields: readonly TtsConfigField[]): void => {
  const rows = fields
    .filter((field) => field.value !== undefined)
    .map((field) => ({
      setting: field.label,
      value: String(field.value)
    }))

  if (rows.length === 0) {
    return
  }

  const key = JSON.stringify([provider, rows])
  const logged = configLogScope.getStore()
  if (logged?.has(key)) return
  logged?.add(key)

  l.write('info', `${provider} TTS Config`, {
    category: 'tts',
    humanTable: createHumanTable(rows, ['setting', 'value'])
  })
}
