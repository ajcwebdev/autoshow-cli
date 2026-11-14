export const SETUP_FOCUSED_MODE_FLAGS = ['models', 'doctor', 'strict', 'step', 'force-redownload', 'dry-run', 'show', 'reset'] as const
export const SETUP_NETWORK_DEPENDENT_FLAGS = ['probe-url', 'probe-client', 'delay-seconds', 'port'] as const

export const SETUP_MODE_NOTES = [
  `--models cannot be combined with ${SETUP_FOCUSED_MODE_FLAGS.filter(name => name !== 'models').map(name => `--${name}`).join(', ')}.`,
  `--network-check cannot be combined with ${SETUP_FOCUSED_MODE_FLAGS.map(name => `--${name}`).join(', ')}.`,
  `${SETUP_NETWORK_DEPENDENT_FLAGS.map(name => `--${name}`).join(', ')} require --network-check.`,
  '--strict requires --doctor. --dry-run previews installation without running tools or changing files; it accepts --step and --force-redownload.',
  'Installation runs with no mode flag; --models only downloads models, and --doctor only inspects readiness.',
  '--show prints effective defaults; --reset clears runtime/autoshow.json back to empty defaults.'
] as const
