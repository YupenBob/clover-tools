# FFmpeg WebAssembly core

This application loads the unmodified single-thread `@ffmpeg/core` version 0.12.10 on demand. The npm package declares GPL-2.0-or-later. See [GPL-2.0.txt](GPL-2.0.txt) for the license, including its warranty disclaimer.

Corresponding upstream source and build instructions:

- https://github.com/ffmpegwasm/ffmpeg.wasm/tree/71aa99d37c02a7b4c435275ca9ef50e612f6efa1
- https://github.com/ffmpegwasm/ffmpeg.wasm/tree/71aa99d37c02a7b4c435275ca9ef50e612f6efa1/build
- https://github.com/ffmpegwasm/ffmpeg.wasm/blob/71aa99d37c02a7b4c435275ca9ef50e612f6efa1/Dockerfile
- https://ffmpeg.org/legal.html

The npm artifacts are reproduced by `scripts/prepare-hls-core.mjs`. The JavaScript file is copied unchanged; the WASM file is split byte-for-byte into static shards and reassembled without modification. This uses the bundled FFmpeg tools through a browser Worker; video/audio streams are copied without re-encoding.
