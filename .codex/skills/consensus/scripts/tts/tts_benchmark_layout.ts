import { readdirSync } from 'node:fs';

export const TTS_CONTROL_BENCHMARKS = ['emotion', 'speed-pauses'] as const;
export type TtsControlBenchmark = typeof TTS_CONTROL_BENCHMARKS[number];

/** Each control benchmark advances independently; an emotion revision cannot hide timing results. */
export function activeTtsControlBenchmarks(root: string): Array<{ suite: TtsControlBenchmark; directory: string }> {
  const directories = readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}_/.test(entry.name))
    .map(entry => entry.name).sort();
  return TTS_CONTROL_BENCHMARKS.flatMap(suite => {
    const directory = directories.filter(name => name.endsWith(`tts-${suite}`)).at(-1);
    return directory ? [{ suite, directory }] : [];
  });
}
