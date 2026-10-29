import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

export const TTS_AUDIO_DELIVERY_CATALOG = 'audio-delivery.json';

export interface TtsAudioDeliveryCopy {
  sourcePath: string; sourceSha256: string; sourceBytes: number;
  path: string; sha256: string; bytes: number;
  sampleRate: number; channels: number; decodedSamples: number;
}

export interface TtsAudioDeliveryCatalog {
  schemaVersion: 1;
  approval: 'user-approved-mp3-replacement';
  encoder: string;
  copies: TtsAudioDeliveryCopy[];
}

const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const digest = (value: unknown): boolean => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const positiveInteger = (value: unknown): boolean => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

function contained(root: string, value: string): string {
  if (typeof value !== 'string' || !value || isAbsolute(value) || value.includes('\\') || value.split('/').some(part => !part || part === '.' || part === '..')) throw Error('Invalid TTS delivery path');
  return resolve(root, value);
}

// The original render identity stays authoritative for synthesis and historical
// assessments. This catalog binds a user-approved playback copy to those bytes.
export function resolveTtsAudioDelivery(root: string, source: string, sourceSha256: string): (TtsAudioDeliveryCopy & { absolutePath: string; available: boolean }) | null {
  const catalogPath = join(root, TTS_AUDIO_DELIVERY_CATALOG);
  if (!existsSync(catalogPath)) return null;
  const value = JSON.parse(readFileSync(catalogPath, 'utf8')) as TtsAudioDeliveryCatalog;
  if (value.schemaVersion !== 1 || value.approval !== 'user-approved-mp3-replacement' || typeof value.encoder !== 'string' || !value.encoder || !Array.isArray(value.copies) || !value.copies.length) throw Error('Invalid TTS audio delivery catalog');
  const sources = new Set<string>(), outputs = new Set<string>();
  for (const copy of value.copies) {
    contained(root, copy.sourcePath); contained(root, copy.path);
    if (!copy.sourcePath.endsWith('.wav') || copy.path !== copy.sourcePath.replace(/\.wav$/, '.mp3') || sources.has(copy.sourcePath) || outputs.has(copy.path) ||
      !digest(copy.sourceSha256) || !digest(copy.sha256) || !positiveInteger(copy.sourceBytes) || !positiveInteger(copy.bytes) || copy.bytes >= copy.sourceBytes ||
      !positiveInteger(copy.sampleRate) || !positiveInteger(copy.channels) || !positiveInteger(copy.decodedSamples)) throw Error('Invalid or duplicate TTS audio delivery binding');
    sources.add(copy.sourcePath); outputs.add(copy.path);
  }
  const sourcePath = relative(resolve(root), resolve(source)).split('\\').join('/');
  const copy = value.copies.find(copy => copy.sourcePath === sourcePath);
  if (!copy) return null;
  if (copy.sourceSha256 !== sourceSha256) throw Error(`TTS delivery source hash mismatch: ${sourcePath}`);
  const absolutePath = contained(root, copy.path), available = existsSync(absolutePath);
  if (available) {
    const bytes = readFileSync(absolutePath);
    if (bytes.length !== copy.bytes || hash(bytes) !== copy.sha256) throw Error(`TTS delivery audio hash mismatch: ${copy.path}`);
  }
  return { ...copy, absolutePath, available };
}
