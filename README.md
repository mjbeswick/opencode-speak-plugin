# OpenCode Speak Plugin

A standalone local OpenCode V2 server plugin that provides `macos_say_text` as
an opt-in fallback when the native `speak` tool is unavailable or failing.

The tool accepts text only (1–240 characters), normalizes whitespace, and uses
the fixed `/usr/bin/say` executable. It passes text through stdin, never invokes
a shell, makes no network requests, and has a 30-second process limit. OpenCode
asks for `macos_tts:local` permission for every call; no persistent approval is
requested or saved. Do not use it for routine updates or sensitive/private
text.

This package is loaded from the global OpenCode configuration as a local
directory. Its source can be public on GitHub; it is not published to npm
(`private: true` in `package.json` prevents npm publication). It has no
external dependencies.

## Validate

```sh
node --check server/index.js
node -e 'JSON.parse(require("node:fs").readFileSync("package.json", "utf8"))'
```
