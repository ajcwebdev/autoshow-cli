import type { HumanTableLogOptions } from '~/types'

export type KeyValueTableLogOptions = HumanTableLogOptions & {
  keyLabel?: string
  valueLabel?: string
}

export type SingleRowTableLogOptions = HumanTableLogOptions & {
  columns?: readonly string[]
}
