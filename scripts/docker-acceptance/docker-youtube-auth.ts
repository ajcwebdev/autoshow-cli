import assert from 'node:assert/strict'
import { chmod, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { isAbsolute, join, relative, resolve } from 'node:path'

export const YOUTUBE_COOKIE_MOUNT = '/run/autoshow-youtube-cookies.txt'
export interface DockerYoutubeAuth {
  mount: { host: string; container: string; readonly: true }
  groupId: number
}

export function youtubeCookiesOnly(text: string): string {
  assert(/^#(?: Netscape)? HTTP Cookie File\r?$/m.test(text), 'YouTube cookies must use Netscape cookie-file format')
  const rows = text.split(/\r?\n/).filter(line => {
    if (!line || (line.startsWith('#') && !line.startsWith('#HttpOnly_'))) return false
    const fields = line.split('\t')
    assert.equal(fields.length, 7, 'Invalid Netscape cookie record')
    return /(^|\.)youtube\.com$/i.test(fields[0]!.replace(/^#HttpOnly_/, ''))
  })
  assert(rows.length, 'The cookie file contains no YouTube cookies')
  return `# Netscape HTTP Cookie File\n${rows.join('\n')}\n`
}

export async function withDockerYoutubeCookies<T>(source: string, artifactRoots: string[], run: (auth: DockerYoutubeAuth) => Promise<T>): Promise<T> {
  assert(process.getgid, 'YouTube cookie mounts require a POSIX host')
  const sourcePath = await realpath(source)
  for (const root of artifactRoots) {
    const artifactRoot = await realpath(root).catch(() => resolve(root))
    const suffix = relative(artifactRoot, sourcePath)
    assert(suffix && (suffix === '..' || suffix.startsWith('../') || isAbsolute(suffix)), 'Keep YouTube cookies outside acceptance evidence and caches')
  }
  const info = await stat(sourcePath)
  assert(info.isFile() && info.size > 0 && info.size <= 1024 * 1024, 'YouTube cookie file must be a nonempty file of at most 1 MiB')
  const cookies = youtubeCookiesOnly(await readFile(sourcePath, 'utf8'))
  // Only a filtered snapshot is mounted. Its private parent is never an artifact or cache.
  const directory = await mkdtemp(join(tmpdir(), 'autoshow-youtube-auth-'))
  const snapshot = join(directory, 'cookies.txt')
  try {
    await writeFile(snapshot, cookies, { mode: 0o640 })
    await chmod(snapshot, 0o640)
    return await run({ mount: { host: snapshot, container: YOUTUBE_COOKIE_MOUNT, readonly: true }, groupId: process.getgid() })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

// yt-dlp rewrites its cookie jar. Give it a private container-only copy, and keep
// authenticated response caches out of the shared home mount. exec preserves signals.
export const YOUTUBE_AUTH_LAUNCHER = `set -eu
umask 077
auth_dir="$(mktemp -d /tmp/autoshow-youtube.XXXXXX)"
cp ${YOUTUBE_COOKIE_MOUNT} "$auth_dir/cookies.txt"
printf '{"auth":{"cookies":"%s/cookies.txt"}}\\n' "$auth_dir" > "$auth_dir/config.json"
export XDG_CACHE_HOME="$auth_dir/cache"
exec "$@" --config-path "$auth_dir/config.json"`
