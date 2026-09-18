/**
 * Set by the runner for a live run without --budget. No ceiling applies, so
 * every budgeted test is admitted without price preflight evidence. A direct
 * `bun test` never sets it and still fails closed.
 */
export const UNBUDGETED_LIVE_RUN_ENV = 'AUTOSHOW_TEST_UNBUDGETED_LIVE_RUN'
