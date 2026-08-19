import type { SttTarget } from '~/types'

export type SttProviderProgressSelector = {
  rootDir: string
  artifactDir: string
  target: Pick<SttTarget, 'service' | 'model'>
}
