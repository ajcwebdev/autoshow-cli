# YouTube Cookies

Configure a cookie source when yt-dlp requests YouTube sign-in or reports a bot check. YouTube operations use that saved source. A configured file takes precedence over browser import; an unreadable file warns and does not fall back to the browser. `setup --doctor` reports the selected source and file readability.

## Browser Import

Use a logged-in browser profile available on this machine:

```bash
bun autoshow setup --cookies-from-browser chrome
```

yt-dlp browser/profile syntax is passed through, for example `chrome:Default`. Then retry the failed command.

## Export `cookies.txt`

Follow yt-dlp's [YouTube cookie export instructions](https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies) to produce a Netscape-format file. It should begin with `# Netscape HTTP Cookie File`. Keep it private and never commit it.

```bash
mkdir -p runtime/auth
cp ~/Downloads/cookies.txt runtime/auth/youtube.cookies.txt
chmod 600 runtime/auth/youtube.cookies.txt
bun autoshow setup --cookies /absolute/path/to/runtime/auth/youtube.cookies.txt
```

Use a stable absolute path; AutoShow does not expand `~`. Configuration stores the path or browser name, never cookie contents.

## If It Still Fails

Fix unreadable paths through `setup --cookies <file>`. Download's media-only yt-dlp passthrough goes after `--`; configure cookies through setup instead of forwarding them there. See [yt-dlp passthrough](../01-sources/download/overview.md#yt-dlp-passthrough).
