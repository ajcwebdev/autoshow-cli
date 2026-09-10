import type { PriceSelectionEntry } from '~/types'
import { command, exact } from '../helpers'

export const urlRegistry: PriceSelectionEntry[] = [
  ...exact('test/test-cases/e2e/service/text/url/url-supadata.test.ts', [
    command('extract-supadata-url', 'extract-supadata-url', ['src/cli/create-cli.ts', 'extract', 'https://ajcwebdev.com', '--provider', 'supadata', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/url/url-firecrawl.test.ts', [
    command('extract-firecrawl-url', 'extract-firecrawl-url', ['src/cli/create-cli.ts', 'extract', 'https://ajcwebdev.com', '--provider', 'firecrawl', '--price']),
  ]),
  ...exact('test/test-cases/e2e/service/text/url/url-glm-reader.test.ts', [
    command('extract-glm-reader-url', 'extract-glm-reader-url', ['src/cli/create-cli.ts', 'extract', 'https://ajcwebdev.com', '--provider', 'glm-reader', '--price']),
  ]),
]
