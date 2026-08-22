# YouTube Cookies

Use this when `yt-dlp` hits a YouTube sign-in prompt or `Sign in to confirm you're not a bot`.

## Outline

- [TL;DR](#tldr)
- [Fastest Fix: Browser Import](#fastest-fix-browser-import)
- [Fallback: Export `cookies.txt`](#fallback-export-cookiestxt)
- [Precedence And Diagnostics](#precedence-and-diagnostics)
- [Unsupported Legacy Env Vars](#unsupported-legacy-env-vars)
- [Passing yt-dlp arguments](#passing-yt-dlp-arguments)
- [If It Still Fails](#if-it-still-fails)
- [References](#references)

## TL;DR

Preferred:

```bash
bun autoshow config --cookies-from-browser chrome
bun autoshow extract "https://www.youtube.com/watch?v=YOUR_VIDEO_ID"
```

Fallback:

```bash
bun autoshow config --cookies /absolute/path/to/runtime/auth/youtube.cookies.txt
bun autoshow extract "https://www.youtube.com/watch?v=YOUR_VIDEO_ID"
```

Key rules:

- Cookie auth is saved once to `config/autoshow.json` and applies to every command, and it is configured only through `bun autoshow config`. Processing commands such as `extract`, `download`, and `metadata` no longer accept `--cookies` or `--cookies-from-browser`.
- Config persists the cookies file path or browser name only. Do not copy cookie-file contents into `config/autoshow.json`.
- A configured cookies file takes precedence over browser import.
- If the configured cookies path is unreadable, AutoShow warns, does not pass cookies to `yt-dlp`, and does not fall back to browser import.
- `bun autoshow setup --doctor` shows the active cookie mode and file readability from the saved config.

## Fastest Fix: Browser Import

Use this if `yt-dlp` can read a browser profile on the current machine.

1. In the browser profile already logged into YouTube, open:

```text
https://www.youtube.com/robots.txt
```

2. Persist the browser import, then retry the command that failed:

```bash
bun autoshow config --cookies-from-browser chrome
bun autoshow extract "https://www.youtube.com/watch?v=YOUR_VIDEO_ID"
```

Other common browser values:

```bash
bun autoshow config --cookies-from-browser firefox
bun autoshow config --cookies-from-browser brave
bun autoshow config --cookies-from-browser edge
```

Profile-specific values are passed through to `yt-dlp`, so values such as `chrome:Default` can be used when needed:

```bash
bun autoshow config --cookies-from-browser chrome:Default
```

3. Verify the same cookie source through doctor:

```bash
bun autoshow setup --doctor
```

## Fallback: Export `cookies.txt`

Use this if browser import does not work or you want a dedicated cookie jar for this project.

1. Open a fresh private/incognito window.
2. Log into YouTube there.
3. In the same tab, open:

```text
https://www.youtube.com/robots.txt
```

4. Export only `youtube.com` cookies to a Netscape/Mozilla `cookies.txt` file.

High-leverage notes:

- Do not use a DevTools snippet like `document.cookie`. It cannot read `HttpOnly` auth cookies.
- For a fresh private/incognito export, use a conforming browser exporter such as `Get cookies.txt LOCALLY` for Chrome or `cookies.txt` for Firefox.
- Do not commit the exported file.
- Do not paste cookie-file contents into `config/autoshow.json`. Persist the path only.

5. Put the file somewhere stable, for example:

```bash
mkdir -p runtime/auth
cp ~/Downloads/cookies.txt runtime/auth/youtube.cookies.txt
chmod 600 runtime/auth/youtube.cookies.txt 2>/dev/null || true
```

6. Persist the file path with `config --cookies`:

```bash
bun autoshow config --cookies /absolute/path/to/runtime/auth/youtube.cookies.txt
bun autoshow extract "https://www.youtube.com/watch?v=YOUR_VIDEO_ID"
```

Use a real absolute path. Do not use `~`; AutoShow passes the value through to `yt-dlp`.

7. Verify the same file through doctor:

```bash
bun autoshow setup --doctor
```

8. Quick sanity check:

```bash
head -n 1 /absolute/path/to/runtime/auth/youtube.cookies.txt
```

Expected:

```text
# Netscape HTTP Cookie File
```

`# HTTP Cookie File` also works.

## Precedence And Diagnostics

When both auth settings are saved, the cookies file wins:

```bash
bun autoshow config --cookies /absolute/path/to/runtime/auth/youtube.cookies.txt --cookies-from-browser chrome
```

If that file is unreadable, AutoShow reports the unreadable path, does not pass any cookie argument to `yt-dlp`, and does not fall back to `--cookies-from-browser`. Fix the path, permissions, or update the saved config before retrying.

Doctor reads the same saved config:

```bash
bun autoshow setup --doctor
```

The doctor output includes the configured YouTube cookie mode. For a cookies file, it also checks whether the file is readable.

## Unsupported Legacy Env Vars

The native CLI currently wires YouTube auth through these config flags only:

- `bun autoshow config --cookies-from-browser`
- `bun autoshow config --cookies`

Do not rely on these legacy env vars for native `bun autoshow` commands:

- `YTDLP_COOKIES_FROM_BROWSER`
- `YTDLP_COOKIES`
- `YTDLP_USER_AGENT`
- `YTDLP_EXTRACTOR_ARGS`

The current native code does not translate those env vars into `yt-dlp` arguments. There is no dedicated flag for user-agent overrides, extractor args, PO tokens, or client overrides either — pass them straight through instead, with `bun autoshow download <url> -- <yt-dlp args>`. See [Passing yt-dlp arguments](#passing-yt-dlp-arguments).

## Passing yt-dlp arguments

Anything after a bare `--` on the `download` command is forwarded to `yt-dlp` verbatim, so auth-adjacent options that have no dedicated AutoShow flag do not require leaving the CLI:

```bash
bun autoshow download https://youtube.com/watch?v=abc -- --user-agent "Mozilla/5.0 …"
bun autoshow download https://youtube.com/watch?v=abc -- --extractor-args "youtube:player_client=web"
```

Passthrough is accepted only by `download`, and only for media URL inputs — including a URL list file whose entries are media URLs, but not local media or document files, and not the other commands. Give `download` no input at all and it runs `yt-dlp` directly in raw mode, which is the escape hatch for multi-output workflows:

```bash
bun autoshow download -- --format bestaudio -o "%(title)s.%(ext)s" https://youtube.com/watch?v=abc
```

Configure cookies with `bun autoshow config` first. Do not pass `--cookies` through the `--` boundary.

## If It Still Fails

- `cookies-file` shows as missing in doctor: fix the path or run `bun autoshow config --cookies <file>`. AutoShow will not fall back while a cookies file is configured.
- Browser import still fails: try a more specific profile such as `chrome:Default`, or export a dedicated `cookies.txt` file.
- A fresh exported file still fails: confirm it starts with a Netscape cookie header, includes YouTube auth cookies, and was not committed or moved to a path with unreadable permissions.
- Cookies still are not enough: forward the extra `yt-dlp` options yourself with `bun autoshow download <url> -- --user-agent "…"` or `-- --extractor-args "youtube:player_client=web"`. See [Passing yt-dlp arguments](#passing-yt-dlp-arguments).

## References

- yt-dlp FAQ: https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp
- yt-dlp Extractors: https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies
- yt-dlp PO Token Guide: https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide
- MDN `document.cookie`: https://developer.mozilla.org/en-US/docs/Web/API/Document/cookie
