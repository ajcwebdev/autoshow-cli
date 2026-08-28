import type { HumanLogTable, HumanTableLogOptions, LogCategory, LogLevel, LogMetadata } from '~/types'

export type TableLogDefinition<T> = {
  title: string
  category: LogCategory
  buildTable: (value: T) => HumanLogTable
  level: LogLevel | ((value: T) => LogLevel)
  metadata: (value: T) => LogMetadata
}

export type KeyValueTableLogOptions = HumanTableLogOptions & {
  keyLabel?: string
  valueLabel?: string
}

export type SingleRowTableLogOptions = HumanTableLogOptions & {
  columns?: readonly string[]
}
