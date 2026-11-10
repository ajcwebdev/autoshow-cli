import { describe, expect, test } from 'bun:test'
import { XApiClient } from '~/cli/commands/text/url/url-services/x-spaces/x-spaces-client'
import { collectSpaces } from '~/cli/commands/text/url/url-services/x-spaces/x-spaces-collect'
import { parseSpaceInput } from '~/cli/commands/text/url/url-services/x-spaces/input'
import type { SpacesClientContract } from '~/types'

const now = (): Date => new Date('2026-01-02T03:04:05.000Z')

const createClient = (overrides: Partial<SpacesClientContract> = {}): { client: SpacesClientContract, calls: string[] } => {
  const calls: string[] = []
  const client: SpacesClientContract = {
    getUserByUsername: async (username) => {
      calls.push(`user:${username}`)
      return { errors: [{ title: 'Partial', detail: 'partial user data' }], user: { id: 'u1', name: 'Host', username } }
    },
    getSpacesByCreatorIds: async (userIds) => {
      calls.push(`creator:${userIds.join(',')}`)
      return { data: [{ id: 'spaceA', state: 'ended', creator_id: 'u1', host_ids: ['u1'], started_at: '2026-01-01T00:00:00.000Z' }], includes: { users: [{ id: 'u2', name: 'Guest', username: 'guest' }] } }
    },
    searchSpaces: async (query) => {
      calls.push(`search:${query}`)
      return {
        data: [
          { id: 'spaceA', state: 'ended', creator_id: 'u1', host_ids: ['u2'] },
          { id: 'spaceB', state: 'live', creator_id: 'u9', host_ids: ['u1'] },
          { id: 'spaceC', state: 'live', creator_id: 'u9' }
        ],
        errors: [{ title: 'Search problem', resource_id: 'spaceZ', status: 403 }]
      }
    },
    searchRecentPostsForSpaceLinks: async (username) => {
      calls.push(`recent:${username}`)
      return {
        errors: [],
        spaceIds: ['spaceD'],
        tweets: [{ id: '900', author_id: 'u1', created_at: '2026-01-01T10:00:00.000Z', text: 'join https://x.com/i/spaces/spaceE now' }],
        users: [{ id: 'u1', name: 'Host', username }]
      }
    },
    lookupPostsByIds: async (postIds) => {
      calls.push(`posts:${postIds.join(',')}`)
      return { data: [{ id: '100', author_id: 'u2', created_at: '2025-12-31T00:00:00.000Z', text: 'https://x.com/i/spaces/spaceF' }], includes: { users: [{ id: 'u2', name: 'Guest', username: 'guest' }] } }
    },
    lookupSpacesByIds: async (spaceIds) => {
      calls.push(`lookup:${spaceIds.join(',')}`)
      return { data: spaceIds.filter(id => id !== 'spaceQ').map(id => ({ id, state: 'ended' })) }
    },
    ...overrides
  }
  return { client, calls }
}

describe('X Spaces collection contracts', () => {
  test('merges input, post lookup, creator, search, recent-post, and ID lookup sources in order', async () => {
    const { client, calls } = createClient()
    const input = parseSpaceInput(['https://x.com/i/spaces/spaceQ', 'https://x.com/guest/status/100', '!!! not valid !!!'].join('\n'), 'spaces.txt')
    const artifact = await collectSpaces({ client, input, now, username: 'host' })

    expect(calls).toEqual(['posts:100', 'user:host', 'creator:u1', 'search:host', 'recent:host', 'lookup:spaceQ,spaceF,spaceD,spaceE'])
    expect(artifact.generated_at).toBe('2026-01-02T03:04:05.000Z')
    expect(artifact.sources.map(source => source.type)).toEqual(['input', 'input-post', 'post-lookup', 'user-creator', 'space-search', 'recent-post-search', 'lookup'])
    expect(artifact.sources.find(source => source.type === 'space-search')).toEqual({ discovered_spaces: 2, label: 'Space search for @host', query: 'host', type: 'space-search', username: 'host' })
    expect(artifact.sources.find(source => source.type === 'recent-post-search')).toEqual({ discovered_ids: 1, label: 'Recent posts by @host', posts: 1, query: 'from:host space links', type: 'recent-post-search', username: 'host' })
    expect(artifact.sources.find(source => source.type === 'lookup')).toEqual({ discovered_ids: 4, discovered_spaces: 3, label: 'Space lookup by ID', type: 'lookup' })
    expect(artifact.spaces.map(space => [space.id, space.sources])).toEqual([
      ['spaceA', ['space-search', 'user-creator']],
      ['spaceB', ['space-search']],
      ['spaceD', ['lookup', 'recent-post-search']],
      ['spaceE', ['lookup', 'recent-post-search']],
      ['spaceF', ['input-post', 'lookup']]
    ])
    expect(artifact.spaces[0]?.host_ids).toEqual(['u1', 'u2'])
    expect(artifact.posts.map(post => [post.id, post.sources, post.space_ids, post.url])).toEqual([
      ['900', ['recent-post-search'], ['spaceE'], 'https://x.com/host/status/900'],
      ['100', ['input', 'post-lookup'], ['spaceF'], 'https://x.com/guest/status/100']
    ])
    expect(artifact.errors.map(error => error.source)).toEqual(['input:spaces.txt:3', 'user', 'space-search'])
    expect(artifact.errors.slice(1).map(error => error.detail)).toEqual(['partial user data', 'Search problem'])
    expect(artifact.totals).toEqual({ errors: 3, input_ids: 1, input_posts: 1, posts: 2, spaces: 5, unique_ids: 6, users: 2 })
    expect(artifact.user).toEqual({ id: 'u1', name: 'Host', username: 'host' })
  })

  test('records thrown client failures per source and keeps collecting', async () => {
    const recentFailure = createClient({
      getSpacesByCreatorIds: async () => { throw new Error('creator down') },
      searchRecentPostsForSpaceLinks: async () => { throw new Error('recent down') }
    })
    const artifact = await collectSpaces({ client: recentFailure.client, now, username: 'host' })
    expect(artifact.errors).toEqual([
      { detail: 'partial user data', source: 'user', title: 'Partial' },
      { detail: 'creator down', source: 'user-creator' },
      { detail: 'Search problem', id: 'spaceZ', source: 'space-search', status: 403, title: 'Search problem' },
      { detail: 'recent down', source: 'recent-post-search' }
    ])
    expect(artifact.sources.at(-1)).toEqual({ discovered_ids: 0, label: 'Recent posts by @host', posts: 0, query: 'from:host space links', type: 'recent-post-search', username: 'host' })

    const userFailure = createClient({ getUserByUsername: async () => { throw new Error('no such user') } })
    const failed = await collectSpaces({ client: userFailure.client, now, username: 'ghost' })
    expect(userFailure.calls).toEqual([])
    expect(failed.errors).toEqual([{ detail: 'no such user', source: 'user' }])
    expect(failed.sources).toEqual([])
    expect(failed.user).toBeUndefined()
    expect(failed.totals).toEqual({ errors: 1, input_ids: 0, input_posts: 0, posts: 0, spaces: 0, unique_ids: 0, users: 0 })
  })

  test('recent post search follows pagination and collects space IDs from URLs and text', async () => {
    const requests: string[] = []
    const pages = [
      {
        data: [{ id: '1', text: 'see https://twitter.com/i/spaces/spaceOne', entities: { urls: [{ url: 'https://t.co/a', expanded_url: 'https://x.com/i/spaces/spaceTwo', unwound_url: 'https://x.com/i/spaces/spaceThree?s=20' }] } }],
        includes: { users: [{ id: 'u1', name: 'Host', username: 'host' }] },
        meta: { next_token: 'page-2' }
      },
      { data: [{ id: '2', text: 'spaceFour' }], errors: [{ title: 'Partial' }], meta: {} },
    ]
    const client = new XApiClient({
      bearerToken: 'token',
      baseUrl: 'https://x.test',
      fetchImpl: (async (url: string) => {
        requests.push(url)
        return Response.json(pages[requests.length - 1])
      }) as unknown as typeof fetch
    })
    const result = await client.searchRecentPostsForSpaceLinks('host')
    expect(requests).toHaveLength(2)
    expect(new URL(requests[0] as string).searchParams.get('next_token')).toBeNull()
    expect(new URL(requests[1] as string).searchParams.get('next_token')).toBe('page-2')
    expect(result.spaceIds).toEqual(['spaceTwo', 'spaceThree', 'spaceOne', 'spaceFour'])
    expect(result.tweets.map(tweet => tweet.id)).toEqual(['1', '2'])
    expect(result.users).toEqual([{ id: 'u1', name: 'Host', username: 'host' }])
    expect(result.errors).toEqual([{ title: 'Partial' }])
  })
})
