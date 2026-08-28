# YouTube Cookies

Use this when `yt-dlp` hits a YouTube sign-in prompt or `Sign in to confirm you're not a bot`.

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

- Configure cookies only with `bun autoshow config`. The saved cookies file path or browser name applies to every command.
- Persist the cookies file path or browser name only. Do not copy cookie-file contents into `config/autoshow.json`.
- A configured cookies file takes precedence over browser import. If that file is unreadable, AutoShow warns and does not fall back to browser import.
- `bun autoshow setup --doctor` reports the configured cookie source and whether a cookies file is readable.

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

Specify a profile when needed:

```bash
bun autoshow config --cookies-from-browser chrome:Default
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

Do not use a DevTools snippet like `document.cookie`. It cannot read `HttpOnly` auth cookies. For a fresh private/incognito export, use a conforming browser exporter such as `Get cookies.txt LOCALLY` for Chrome or `cookies.txt` for Firefox. Do not commit the exported file.

5. Put the file somewhere stable, for example:

```bash
mkdir -p runtime/auth
cp ~/Downloads/cookies.txt runtime/auth/youtube.cookies.txt
chmod 600 runtime/auth/youtube.cookies.txt
```

6. Persist the file path with `config --cookies`:

```bash
bun autoshow config --cookies /absolute/path/to/runtime/auth/youtube.cookies.txt
bun autoshow extract "https://www.youtube.com/watch?v=YOUR_VIDEO_ID"
```

Use a real absolute path. Do not use `~`; AutoShow does not expand it.

7. Confirm the file starts with a Netscape cookie header:

```bash
head -n 1 /absolute/path/to/runtime/auth/youtube.cookies.txt
```

Expected:

```text
# Netscape HTTP Cookie File
```

## If It Still Fails

- Doctor reports a missing cookies file: fix the path or run `bun autoshow config --cookies <file>`. AutoShow will not fall back while a cookies file is configured.
- Browser import still fails: try a more specific profile such as `chrome:Default`, or export a dedicated `cookies.txt` file.
- A fresh exported file still fails: confirm it starts with a Netscape cookie header, includes YouTube auth cookies, and was not committed or moved to a path with unreadable permissions.
- Cookies still are not enough: forward extra `yt-dlp` options with `download` after a bare `--`, for example `bun autoshow download <url> -- --user-agent "…"` or `-- --extractor-args "youtube:player_client=web"`. Passthrough is accepted only by `download`, and only for media URL inputs. Configure cookies with `bun autoshow config` first; do not pass `--cookies` through the `--` boundary. See [yt-dlp Passthrough](commands/process-steps/step-1-download/download-file.md#yt-dlp-passthrough).

## References

- yt-dlp FAQ: https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp
- yt-dlp Extractors: https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies
- yt-dlp PO Token Guide: https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide
