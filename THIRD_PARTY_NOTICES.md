# THIRD-PARTY NOTICES

This project uses third-party software components. This file lists key third-party components used directly by CodeXR templates/runtime and their upstream licenses.

## Included Notices

### 1) A-Frame
- Project: A-Frame
- Website: https://aframe.io/
- Source: https://github.com/aframevr/aframe
- License: MIT

Usage in this project:
- Loaded in XR/DOM templates from the official A-Frame CDN releases (1.7.1).
- Loaded by the bundled example scenes in `examples/charts/*` from the same CDN (1.0.4).

### 2) aframe-babia-components (BabiaXR components)
- Project: aframe-babia-components
- Website: https://babiaxr.gitlab.io/aframe-babia-components/
- Source: https://gitlab.com/babiaxr/aframe-babia-components
- License: GNU General Public License v3.0 (GPL-3.0)

Usage in this project:
- Loaded in XR/DOM templates from unpkg CDN (1.3.4).
- Loaded by the bundled example scenes in `examples/charts/*` from unpkg CDN (unpinned).
- Credited in-product: the `About BabiaXR` entry in the BABIA EXAMPLES view opens a dialog with these libraries, their licenses and links.

### 3) Lizard
- Project: Lizard
- Source: https://github.com/terryyin/lizard
- License: MIT-style permissive license (see upstream LICENSE.txt)

Usage in this project:
- Used by the analysis tooling for cyclomatic complexity and code metrics.

### 4) Robot Expressive
- Creator: Tomás Laulhé (https://www.patreon.com/quaternius), modified by Don McCurdy
- Distribution page: https://github.com/mrdoob/three.js/tree/dev/examples/models/gltf/RobotExpressive
- Asset URL: https://raw.githubusercontent.com/mrdoob/three.js/b924f0cad4058dc4dde71445c796980c3cd5b5ed/examples/models/gltf/RobotExpressive/RobotExpressive.glb
- License: Creative Commons Zero 1.0 Universal (CC0 1.0, public domain dedication)
- License terms: https://creativecommons.org/publicdomain/zero/1.0/

Usage in this project:
- The model **is included** in the CodeXR extension package (`resources/avatars/robot-expressive.glb`, 463,988 bytes). Its CC0 public domain dedication places no restriction on redistribution.
- Nothing is downloaded for the avatar: the extension serves the bundled file to its own local scenes and reuses it for every analysis and all six visual skins.
- Credit is surfaced in-product: the `3D Model` entry in the COLLABORATION view opens a dialog with the author, license and links to the source page and licence text.
- If the file is missing from an installation, CodeXR falls back to its own procedural avatar.

### 5) cloudflared
- Project: Cloudflare Tunnel client (`cloudflared`)
- Source: https://github.com/cloudflare/cloudflared
- Documentation: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
- License: Apache License 2.0

Usage in this project:
- The executable is not included in the CodeXR VSIX.
- CodeXR first uses a valid system installation when available.
- Otherwise, after explicit consent, CodeXR downloads the pinned `2026.5.2` executable once into VS Code global storage and verifies its platform-specific SHA-256 before execution.
- It is executed without a shell and with a hidden window to create a temporary Cloudflare Quick Tunnel.
- CodeXR uses an isolated cloudflared home directory and does not alter the user's existing Cloudflare configuration.

### 6) aframe-environment-component
- Project: aframe-environment-component
- Source: https://github.com/supermedium/aframe-environment-component
- License: MIT

Usage in this project:
- Loaded by the bundled example scenes in `examples/charts/*` from unpkg CDN (1.0.0), to provide the scene backdrop.

### 7) aframe-extras
- Project: aframe-extras
- Creator: Don McCurdy
- Source: https://github.com/c-frame/aframe-extras
- License: MIT

Usage in this project:
- Loaded by the bundled example scenes in `examples/charts/*` from the jsDelivr CDN (v6.1.0), for movement and animation controls.

### 6) Cloudflare STUN
- Service: Cloudflare Realtime STUN
- Endpoint: `stun:stun.cloudflare.com:3478`
- Documentation: https://developers.cloudflare.com/realtime/turn/

Usage in this project:
- Used as a free STUN server to help direct WebRTC screen-sharing connections discover public network candidates.
- CodeXR does not configure Cloudflare TURN credentials in version 1.2.0.

### 7) tree-sitter-language-pack
- Project: tree-sitter-language-pack
- Source: https://github.com/kreuzberg-dev/tree-sitter-language-pack
- Package: https://pypi.org/project/tree-sitter-language-pack/
- License: MIT

Usage in this project:
- Installed at a pinned version inside the CodeXR-managed Python virtual environment.
- Provides structured parsers used by the dependency-analysis adapters.
- CodeXR retains explicit language fallbacks and reports when structured parsing is unavailable.
- The package and its parsers are installed once per CodeXR environment, not once per analysis.

## Development & Testing Tools

The following tools are used to develop and validate CodeXR. They are **not
bundled with, downloaded by, or distributed in** the extension — end users
never receive them; they simply made this release better.

### Immersive Web Emulator
- Project: Immersive Web Emulator (browser extension)
- Creator: Meta Platforms, Inc.
- Source: https://github.com/meta-quest/immersive-web-emulator
- License: MIT

Usage in this project:
- Emulates a WebXR device (headset + Touch controllers) inside a desktop
  browser. CodeXR's immersive experience for v1.2.0 — entry positioning,
  locomotion and flight, laser interaction, AR behaviour and lighting — was
  driven, debugged and validated end to end in sessions emulated by it (see
  `docs/TUTORIAL_EMULADOR_WEBXR.md`).

### IWER — Immersive Web Emulation Runtime, and @iwer/extension-bridge
- Project: immersive-web-emulation-runtime (IWER) and its MCP bridge
- Creator: Meta Platforms, Inc.
- Source: https://github.com/meta-quest/immersive-web-emulation-runtime
- License: MIT

Usage in this project:
- IWER is the WebXR emulation runtime the browser extension injects; the
  `@iwer/extension-bridge` MCP daemon lets tooling drive those emulated
  sessions programmatically. Both were used during QA to reproduce, diagnose
  and verify immersive input bugs before release.

## Notes

- Third-party licenses remain the property of their respective authors.
- For exact terms and full legal text, consult each upstream project's LICENSE file.
