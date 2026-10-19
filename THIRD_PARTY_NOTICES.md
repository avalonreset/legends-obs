# Attribution and third-party notices

## OBS Studio and obs-websocket

OBS Studio and its built-in `obs-websocket` v5 plugin provide the broadcasting, recording, and loopback WebSocket control surfaces used by this project. OBS Studio names and trademarks belong to their respective owners. This independently maintained module is not an official OBS Project product and is not endorsed by the OBS Project.

No OBS Studio C/C++ implementation source is redistributed in the core CLI. The core TypeScript/Node.js runtime uses Node's built-in standard library and WebSocket client under the MIT license.

## Optional extra: Legends OBS Cursor (`extras/cursor/`)

The optional animated cursor overlay in `extras/cursor/` (`legends_cursor_filter.lua` and `legends_cursor_filter.effect`) is a separable OBS Lua script and HLSL effect licensed under **GPL-2.0-or-later** to match OBS scripting/shader distribution expectations. It adapts OBS Lua cursor-effect techniques from [`upgradeQ/cursor-skin-fx`](https://github.com/upgradeQ/cursor-skin-fx) (MIT licensed; full notice preserved in [`extras/cursor/NOTICE`](extras/cursor/NOTICE) and [`extras/cursor/CREDITS.md`](extras/cursor/CREDITS.md)). The core `legends-obs` CLI remains MIT licensed and does not load or depend on `extras/cursor/`.

## CTO Legends and presentation

Part of the [CTO Legends](https://github.com/avalonreset/cto-legends) ecosystem by Avalon Reset contributors. The central routing recipe at `skills/cto-legends/SKILL.md` is copied unchanged from `avalonreset/cto-legends` under the MIT license.

Repository presentation was prepared with [legends-github](https://github.com/avalonreset/legends-github). Its typography renderers produced the banner and social preview using the supplied Legends Regular font. The font is not distributed in this repository.

FFmpeg/FFprobe, Node.js, Windows, GitHub, and other referenced products retain their respective names and licenses. Linking a tool or source does not imply partnership.
