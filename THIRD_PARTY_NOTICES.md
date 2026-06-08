# THIRD-PARTY NOTICES

This project uses third-party software components. This file lists key third-party components used directly by CodeXR templates/runtime and their upstream licenses.

## Included Notices

### 1) A-Frame
- Project: A-Frame
- Website: https://aframe.io/
- Source: https://github.com/aframevr/aframe
- License: MIT

Usage in this project:
- Loaded in XR/DOM templates from the official A-Frame CDN releases.

### 2) aframe-babia-components (BabiaXR components)
- Project: aframe-babia-components
- Website: https://babiaxr.gitlab.io/aframe-babia-components/
- Source: https://gitlab.com/babiaxr/aframe-babia-components
- License: GNU General Public License v3.0 (GPL-3.0)

Usage in this project:
- Loaded in XR/DOM templates from unpkg CDN.

### 3) Lizard
- Project: Lizard
- Source: https://github.com/terryyin/lizard
- License: MIT-style permissive license (see upstream LICENSE.txt)

Usage in this project:
- Used by the analysis tooling for cyclomatic complexity and code metrics.

### 4) Quaternius Animated Base Character
- Creator: Quaternius
- Distribution page: https://poly.pizza/m/cwYvO5UauX
- Asset URL: https://static.poly.pizza/0b65e14d-a349-44cc-836c-efdeb6933d48.glb
- License: Creative Commons Attribution 3.0 (CC BY 3.0)
- License terms: https://creativecommons.org/licenses/by/3.0/

Usage in this project:
- The model is not included in the CodeXR extension package.
- CodeXR shows the source, license, and 2.16 MiB download size in VS Code before asking the user for consent.
- When accepted, the extension stores one animated base model in its global storage and reuses it for every analysis and all six visual skins.
- When declined or offline, CodeXR uses its own procedural avatar instead.

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

### 6) Cloudflare STUN
- Service: Cloudflare Realtime STUN
- Endpoint: `stun:stun.cloudflare.com:3478`
- Documentation: https://developers.cloudflare.com/realtime/turn/

Usage in this project:
- Used as a free STUN server to help direct WebRTC screen-sharing connections discover public network candidates.
- CodeXR does not configure Cloudflare TURN credentials in version 1.2.0.

## Notes

- Third-party licenses remain the property of their respective authors.
- For exact terms and full legal text, consult each upstream project's LICENSE file.
