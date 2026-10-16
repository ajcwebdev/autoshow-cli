import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

// Page pricing needs only an unambiguous article route. The explicit extension
// avoids live header probes; .invalid exposes accidental network dependencies.
const PRICE_ARTICLE_URL = 'https://example.invalid/article.html'

export const urlRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/local/text/url/defuddle.test.ts', [
    command('extract-defuddle-url', 'extract-defuddle-url', ['src/cli/create-cli.ts', 'extract', PRICE_ARTICLE_URL, '--provider', 'defuddle', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/url/url-spider.test.ts', [
    command('extract-spider-url', 'extract-spider-url', ['src/cli/create-cli.ts', 'extract', PRICE_ARTICLE_URL, '--provider', 'spider', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/url/url-zyte.test.ts', [
    command('extract-zyte-url', 'extract-zyte-url', ['src/cli/create-cli.ts', 'extract', PRICE_ARTICLE_URL, '--provider', 'zyte', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/url/scrapecreators-youtube-transcript.test.ts', [
    command('transcribe-scrapecreators-youtube-transcript', 'transcribe-scrapecreators-youtube-transcript', ['src/cli/create-cli.ts', 'extract', 'input/examples/audio/0-audio-short.mp3', '--provider', 'scrapecreators=youtube-transcript', '--price']),
  ]),
]
