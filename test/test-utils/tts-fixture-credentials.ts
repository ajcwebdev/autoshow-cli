import { beforeEach, afterEach } from 'bun:test'

/** Supply local readiness credentials for suites whose synthesis targets are injected fixtures. */
export const setupTtsFixtureCredentials = (): void => {
  let previous: string | undefined
  beforeEach(() => {
    previous = process.env['OPENAI_API_KEY']
    process.env['OPENAI_API_KEY'] = 'local-tts-fixture-key'
  })
  afterEach(() => {
    if (previous === undefined) delete process.env['OPENAI_API_KEY']
    else process.env['OPENAI_API_KEY'] = previous
  })
}
