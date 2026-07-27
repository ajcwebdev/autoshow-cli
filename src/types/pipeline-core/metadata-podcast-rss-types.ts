import type { ParsedEpisode } from '~/types'

export type PodcastRssParsedFeed = {
  title: string | undefined
  link: string | undefined
  author: string | undefined
  image: string | undefined
  episodes: ParsedEpisode[]
}
