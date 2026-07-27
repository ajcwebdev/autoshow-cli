import { expect, test } from 'bun:test'
import { runCommand } from '../../../../test-utils/test-helpers'

test('metadata --markdown prints stable frontmatter instead of JSON', async () => {
  const result = await runCommand([
    'src/cli/create-cli.ts',
    'metadata',
    'https://example.com/audio.mp3',
    '--markdown'
  ])

  expect(result.exitCode).toBe(0)
  expect(result.stdout).toContain(`---
title: 'audio'
slug: 'audio'
duration: 'Unknown'
channel: 'Unknown'
url: 'https://example.com/audio.mp3'
---`)
  expect(result.stdout).not.toContain('{\n  "title"')
})
