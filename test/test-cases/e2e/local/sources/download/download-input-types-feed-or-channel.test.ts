import { readFileBytes } from '~/utils/bun-file-io'
import { afterAll, beforeAll } from 'bun:test'
import { LOCAL_EXAMPLE_AUDIO_PATH } from '../../../../../test-utils/test-helpers'
import {
  defineSharedDownloadCases,
  setupDownloadInputTypeLifecycle,
} from './download-input-types.shared'

let feedServer: Bun.Server<undefined> | null = null
let feedBaseUrl = ''
let audioFixture: Buffer = Buffer.alloc(0)

const buildFeedXml = (): string => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>AutoShow Fixture Feed</title>
    <link>${feedBaseUrl}/</link>
    <description>Local feed fixture</description>
    <item>
      <guid>fixture-episode-1</guid>
      <title>Fixture Episode</title>
      <pubDate>Fri, 15 May 2026 12:00:00 GMT</pubDate>
      <enclosure url="${feedBaseUrl}/cover.jpg" length="1234" type="image/jpeg" />
      <enclosure url="${feedBaseUrl}/audio.mp3" length="${audioFixture.length}" type="audio/mpeg" />
    </item>
  </channel>
</rss>
`

beforeAll(async () => {
  audioFixture = await readFileBytes(LOCAL_EXAMPLE_AUDIO_PATH)

  feedServer = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(req) {
      const url = new URL(req.url)
      if (req.method === 'GET' && url.pathname === '/feed') {
        return new Response(buildFeedXml(), { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } })
      }
      if (req.method === 'GET' && url.pathname === '/audio.mp3') {
        return new Response(audioFixture, { headers: {
          'content-type': 'audio/mpeg',
          'content-length': String(audioFixture.length)
        } })
      }
      return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } })
    }
  })
  feedBaseUrl = `http://127.0.0.1:${feedServer.port}`
})

afterAll(async () => {
  if (!feedServer) return
  await feedServer.stop(true)
  feedServer = null
})

setupDownloadInputTypeLifecycle([])
defineSharedDownloadCases(['download-rss'], () => `${feedBaseUrl}/feed`)
