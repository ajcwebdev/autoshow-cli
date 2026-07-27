import type { DownloadFlowId } from '~/types'

export type GithubArchiveOptions = {
  owner: string
  repo: string
  ref: string
}

export type DownloadGithubArchiveOptions = GithubArchiveOptions & {
  destination: string
  stripComponents?: number
  flowId?: DownloadFlowId
}
