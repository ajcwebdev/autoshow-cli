import type { ComposeComicGridPageInput } from '~/types'

export type GenerateComicGridPagesDependencies = {
  composeGridPage?: (input: ComposeComicGridPageInput) => Promise<{ width: number; height: number }>
}
