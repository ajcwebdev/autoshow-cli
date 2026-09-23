# YouTube Cookies

Use this when `yt-dlp` hits a YouTube sign-in prompt or `Sign in to confirm you're not a bot`.

Save the cookie source with `bun autoshow setup`. Commands that read YouTube through `yt-dlp` use that saved source.

- A cookies file is used instead of browser import. If the file is unreadable, AutoShow warns and does not use the browser.
- `bun autoshow setup --doctor` reports the cookie source and whether a cookies file is readable.

## Browser Import

Use this when `yt-dlp` can read a logged-in YouTube profile on this machine.

```bash
bun autoshow setup --cookies-from-browser chrome
```

Replace `chrome` with `firefox`, `opera`, `edge`, `chromium`, `brave`, `vivaldi`, or `safari`. Name a profile when the default one is not logged in, for example `chrome:Default`. Then retry the command that failed.

## Export `cookies.txt`

Use this when browser import does not work, or when you want a cookie file for this project.

1. Open a fresh private/incognito window.
2. Log into YouTube there.
3. In the same tab, open `https://www.youtube.com/robots.txt`.
4. Export only `youtube.com` cookies to a Netscape `cookies.txt` file with an exporter such as `Get cookies.txt LOCALLY` (Chrome) or `cookies.txt` (Firefox). `document.cookie` does not include the auth cookies. Close the private window after exporting, and do not commit the file.
5. Put the file somewhere stable:

```bash
mkdir -p runtime/auth
cp ~/Downloads/cookies.txt runtime/auth/youtube.cookies.txt
chmod 600 runtime/auth/youtube.cookies.txt
```

6. Save the absolute path. AutoShow does not expand `~`.

```bash
bun autoshow setup --cookies /absolute/path/to/runtime/auth/youtube.cookies.txt
```

The file should start with `# Netscape HTTP Cookie File`.

## If It Still Fails

- Doctor reports a missing or unreadable cookies file: fix the path with `bun autoshow setup --cookies <file>`.
- Extra `yt-dlp` options on `download` go after `--` and only for a media URL. Set cookies with `setup`, not with `--cookies` after `--`. See [yt-dlp Passthrough](../01-sources/download/overview.md#yt-dlp-passthrough).

## References

- [Exporting YouTube cookies](https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies)
