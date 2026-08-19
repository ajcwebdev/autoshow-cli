import type { ModelRegistry } from '~/types'

export type ModelCategory = keyof ModelRegistry

export type RetiredModelRate<Category extends ModelCategory> = Partial<
  ModelRegistry[Category][string]['models'][string]
>

export type RetiredModelRates = {
  readonly [Category in ModelCategory]: Readonly<Record<string, RetiredModelRate<Category>>>
}

export type RetiredModelReplacements = {
  readonly [Category in ModelCategory]: Readonly<Record<string, string>>
}
