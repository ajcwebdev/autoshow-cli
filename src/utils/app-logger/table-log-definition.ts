import type { HumanLogTable, LogCategory, LogLevel, LogMetadata, TableLogger } from '~/types'

type TableLogDefinition<T> = {
  title: string
  category: LogCategory
  buildTable: (value: T) => HumanLogTable
  level: LogLevel | ((value: T) => LogLevel)
  metadata: (value: T) => LogMetadata
}

export const defineTableLog = <T>(definition: TableLogDefinition<T>) => {
  const log = (logger: TableLogger, value: T, level?: LogLevel): void => {
    const defaultLevel = typeof definition.level === 'function'
      ? definition.level(value)
      : definition.level
    logger.write(level ?? defaultLevel, definition.title, {
      category: definition.category,
      humanTable: definition.buildTable(value),
      metadata: definition.metadata(value)
    })
  }

  return { buildTable: definition.buildTable, log }
}
