import { describe, expect, test } from 'bun:test'
import { renderSpacesMarkdown } from '~/cli/commands/text/url/url-services/x-spaces/report'
import type { SpacesArtifact } from '~/types'

const totals = { errors: 2, input_ids: 3, input_posts: 1, posts: 1, spaces: 2, unique_ids: 3, users: 4 }

const populatedArtifact = {
  generated_at: '2026-01-02T03:04:05.000Z',
  totals,
  user: { id: '42', username: 'host_one', name: 'Host One' },
  sources: [
    { label: 'ids.txt', discovered_ids: 3, discovered_spaces: 2, posts: 1, invalid_lines: 2 },
    { label: 'search', discovered_ids: 0, invalid_lines: 0 },
    { label: 'bare' },
  ],
  spaces: [
    {
      id: '1AbC',
      title: '  Launch | Day\nRecap  ',
      state: 'ended',
      scheduled_start: '2026-01-01T00:00:00.000Z',
      started_at: '2026-01-01T00:01:00.000Z',
      ended_at: '2026-01-01T01:00:00.000Z',
      creator: { id: '42', username: 'host_one' },
      creator_id: '42',
      hosts: [{ id: '42', username: 'host_one' }, { id: '43', name: 'Named Only' }, { id: '44' }],
      host_ids: ['42', '43', '44'],
      speakers: [],
      speaker_ids: ['50', '51'],
      participant_count: 0,
      posts: [{ id: 'p1', url: 'https://x.com/i/status/p1', space_ids: ['1AbC'] }],
      url: 'https://x.com/i/spaces/1AbC',
    },
    {
      id: '2DeF',
      title: '   ',
      hosts: [],
      speakers: [],
      posts: [],
      url: 'https://x.com/i/spaces/2DeF',
    },
  ],
  posts: [
    {
      id: 'p1',
      url: 'https://x.com/i/status/p1',
      author_id: '42',
      created_at: '2026-01-01T00:00:30.000Z',
      space_ids: ['1AbC', '2DeF'],
      text: `Join   us\nlive ${'x'.repeat(170)}`,
    },
    { id: 'p2', url: 'https://x.com/i/status/p2', author: { id: '43', name: 'Named Only' }, space_ids: [], text: '' },
  ],
  errors: [
    { source: 'lookup|api', id: '9ZzZ', detail: 'not\nfound' },
    { source: 'search', detail: '' },
  ],
} as unknown as SpacesArtifact

const emptyArtifact = {
  generated_at: '2026-01-02T03:04:05.000Z',
  totals: { errors: 0, input_ids: 0, input_posts: 0, posts: 0, spaces: 0, unique_ids: 0, users: 0 },
  sources: [],
  spaces: [],
  posts: [],
  errors: [],
} as unknown as SpacesArtifact

describe('X Spaces Markdown report', () => {
  test('renders summary, user, sources, spaces, posts and errors in order with escaped cells', () => {
    expect(renderSpacesMarkdown(populatedArtifact)).toBe([
      '# X Spaces Report',
      '',
      'Generated: 2026-01-02T03:04:05.000Z',
      '',
      '## Summary',
      '',
      '- Spaces: 2',
      '- Unique IDs: 3',
      '- Input IDs: 3',
      '- Input Posts: 1',
      '- Posts: 1',
      '- Users: 4',
      '- Errors: 2',
      '',
      '## User',
      '',
      '- @host_one (42)',
      '',
      '## Sources',
      '',
      '- ids.txt (3 ids, 2 spaces, 1 posts, 2 invalid)',
      '- search (0 ids)',
      '- bare',
      '',
      '## Spaces',
      '',
      'Title | State | Scheduled | Started | Ended | Creator | Hosts | Speakers | Participants | Posts | URL',
      '--- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | ---',
      'Launch \\| Day Recap | ended | 2026-01-01T00:00:00.000Z | 2026-01-01T00:01:00.000Z | 2026-01-01T01:00:00.000Z | @host_one | @host_one, Named Only, 44 | 50, 51 | 0 | https://x.com/i/status/p1 | https://x.com/i/spaces/1AbC',
      '(untitled) | - | - | - | - | - | - | - | - | - | https://x.com/i/spaces/2DeF',
      '',
      '## Posts',
      '',
      'Post | Author | Created | Referenced Spaces | Text',
      '--- | --- | --- | --- | ---',
      `https://x.com/i/status/p1 | 42 | 2026-01-01T00:00:30.000Z | https://x.com/i/spaces/1AbC, https://x.com/i/spaces/2DeF | Join us live ${'x'.repeat(144)}...`,
      'https://x.com/i/status/p2 | Named Only | - | - | -',
      '',
      '## Errors',
      '',
      '- lookup\\|api (9ZzZ): not found',
      '- search: -',
      '',
    ].join('\n'))
  })

  test('renders placeholders and omits user, posts and errors sections for an empty artifact', () => {
    expect(renderSpacesMarkdown(emptyArtifact)).toBe([
      '# X Spaces Report',
      '',
      'Generated: 2026-01-02T03:04:05.000Z',
      '',
      '## Summary',
      '',
      '- Spaces: 0',
      '- Unique IDs: 0',
      '- Input IDs: 0',
      '- Input Posts: 0',
      '- Posts: 0',
      '- Users: 0',
      '- Errors: 0',
      '',
      '## Sources',
      '',
      '- None',
      '',
      '## Spaces',
      '',
      '_No Spaces found._',
      '',
    ].join('\n'))
  })
})
