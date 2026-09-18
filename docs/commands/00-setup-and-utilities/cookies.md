# YouTube Cookies

Use this when `yt-dlp` hits a YouTube sign-in prompt or `Sign in to confirm you're not a bot`.

Configure cookies with `bun autoshow setup`. The saved cookies file path or browser name applies to every command.

- A cookies file takes precedence over browser import. If that file is unreadable, AutoShow warns and does not fall back.
- `bun autoshow setup --doctor` reports the configured cookie source and whether a cookies file is readable.

## Browser Import

Use this if `yt-dlp` can read a logged-in YouTube browser profile on this machine.

```bash
bun autoshow setup --cookies-from-browser chrome
```
Replace `chrome` with another browser `yt-dlp` can read: `firefox`, `opera`, `edge`, `chromium`, `brave`, `vivaldi`, or `safari`. Add a profile when needed: `chrome:Default`. Then retry the command that failed.

## Export `cookies.txt`

Use this if browser import does not work or you want a dedicated cookie jar for this project.

1. Open a fresh private/incognito window.
2. Log into YouTube there.
3. In the same tab, open `https://www.youtube.com/robots.txt`.
4. Export only `youtube.com` cookies to a Netscape/Mozilla `cookies.txt` file. Do not use a DevTools snippet like `document.cookie`; it cannot read `HttpOnly` auth cookies. Use a conforming exporter such as `Get cookies.txt LOCALLY` for Chrome or `cookies.txt` for Firefox. Then close the private/incognito window so YouTube cannot rotate the exported session. Do not commit the exported file.
5. Put the file somewhere stable:

```bash
mkdir -p runtime/auth
cp ~/Downloads/cookies.txt runtime/auth/youtube.cookies.txt
chmod 600 runtime/auth/youtube.cookies.txt
```
6. Persist the absolute file path. AutoShow does not expand `~`.

```bash
bun autoshow setup --cookies /absolute/path/to/runtime/auth/youtube.cookies.txt
```
The file should start with `# Netscape HTTP Cookie File`.

## If It Still Fails

- Doctor reports a missing or unreadable cookies file: fix the path or run `bun autoshow setup --cookies <file>`.
- Browser import still fails: try a more specific profile such as `chrome:Default`, or export a dedicated `cookies.txt` file.
- A fresh exported file still fails: confirm the Netscape header, YouTube auth cookies, and that the path is readable.
- Cookies still are not enough: on `download` with a media URL, pass extra `yt-dlp` options after `--`. Do not pass `--cookies` that way. See [yt-dlp Passthrough](../01-sources/download/overview.md#yt-dlp-passthrough).

## References

- yt-dlp FAQ: https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp
- yt-dlp Extractors: https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies
