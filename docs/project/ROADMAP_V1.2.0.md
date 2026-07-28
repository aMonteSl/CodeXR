# CodeXR 1.2.0 Roadmap

## Goal

CodeXR 1.2.0 evolves code visualization into a collaborative XR workspace,
extensible and reachable from different devices. The release prioritizes a
modular architecture, understandable human presence, manageable collaboration
and the technical groundwork for new charts, local AI assistance and
cross-network connection.

## Overall status

| Area | Status | 1.2.0 scope |
| --- | --- | --- |
| 1. Foundations and architecture | In progress | Unify WebXR versions, contracts and first-party components |
| 2. Multi-station workspace | Planned | XR stations and persistent spatial organization |
| 3. Dependency graph | Implemented; multi-user validation pending | On-demand analysis, 23 languages, three layouts and collaboration |
| 4. Temporal comparator | Implemented; multi-user validation pending | Dual table, provider-independent local Git, transactional selector and Live source |
| 5. Project Evolution | In implementation | Chronological project film from local Git commits with an XR player |
| 6. Collaboration 2.0 | Implemented; XR validation pending | Per-installation profile, avatars, presence and pointer |
| 7. Cross-network connection | Implemented; real-world test pending | Quick Tunnel, pairing, sessions and revocation |
| 8. AI assistance | Under study | Local or free AI, private and optional |
| 9. Quality and release | In progress | Tests, XR performance, documentation and release |

Scope note: the `codexr-boats` prototype is paused outside 1.2.0. The release
goes back to `Babia Boats` as the default hierarchical XR chart, while keeping
the chart selector in `CodeXR Field Mapping` to switch between the BabiaXR
options available in the scene.

## 1. Foundations and architecture

- Keep CodeXR components decoupled from the transport, from BabiaXR and from
  the VS Code UI.
- Unify the XR and DOM scenes on A-Frame 1.7.1.
- Keep `loadedFiles` as the contract for generated textual content.
- Avoid bundling large resources when they can be obtained optionally and
  with consent.
- Keep the compatible technical identifier `code-xr`, with `CodeXR` as the
  visible name.
- Define small public APIs so charts, screens and future components can
  cooperate without knowing about WebSocket.
- Keep `Babia Boats` as the default XR chart in 1.2.0 and pause the
  first-party `codexr-boats` chart until a later release.
- Allow live chart switching from `CodeXR Field Mapping`, applying the chosen
  chart's default mappings.

## 2. Multi-station workspace

- Create configurable XR stations for analysis, charts, screens,
  documentation and conversation.
- Allow saving, restoring and sharing their spatial layout.
- Add anchors and quick navigation between stations.
- Prepare station synchronization in the room protocol.
- Design performance budgets for desktop, mobile and standalone headsets.

## 3. Dependency graph

- First-party `codexr-dependency-graph` component, without modifying BabiaXR.
- Directional edges with per-type and per-intensity presets, adaptive flow
  and an aggregated portal for hidden external dependencies.
- Third mode of `codexr-analysis-table`, activated from the compact panel.
- On-demand analysis of the 23 languages in the metrics contract.
- Imports, includes, requires, inheritance, implementation and calls with
  explicit confidence.
- File or group view, optional external dependencies and cycle detection.
- `force-3d`, `hierarchical` and `metric-space` layouts computed in a Web
  Worker.
- Independent mapping of size, height, colour and position to graph metrics.
- Authoritative state and shared configuration over WebSocket.

The architecture, resolution, limits, Git-provider compatibility and testing
strategy are described in
[XR dependency graph](../features/DEPENDENCY_GRAPH_XR.md).

## 4. Temporal comparator

The XR analysis starts with the normal table and lets you open, from inside
the scene, a shared comparison between the working tree and the branches,
tags or commits available locally. CodeXR materializes snapshots without
switching the active branch, presents two charts side by side and applies the
same metric selector to both.

The first delivery includes a summary of added, removed, modified and
unchanged elements. Overlay and per-element highlighting are reserved for a
later iteration.

The architecture splits into a `codexr-analysis-table` table, per-chart
`codexr-chart-containment` controllers, a shell-less Git service and one
authoritative coordinator per server. Shared requests travel over WebSocket
so they keep working through Quick Tunnel.

The architecture, GitHub/GitLab compatibility, safe materialization, Live
reactivity, Field Mapping and testing strategy are described in
[XR historical comparator](../features/HISTORICAL_COMPARISON_XR.md).

- Compare two revisions, branches or captures of the same analysis.
- Represent additions, removals and complexity changes spatially.
- Allow an overlaid view and a side-by-side view.
- Add filters by file, language, author and change magnitude.
- Prepare Git integration without blocking the normal local analysis.

## 5. Project Evolution

`Project Evolution` adds a chronological XR mode to watch the project as a
film. Unlike the temporal comparator, it does not split the table in two: it
uses a single full-size chart and walks its datasource from older commits
toward recent ones.

- New `project-evolution` mode inside `Visualization mode`.
- Automatic timeline by default using local Git commits from old to recent,
  with sampling for large repositories.
- XR panel with film generation, play/pause, previous/next and playback
  speed.
- Reuse of the safe Git materialization and the current Python/Lizard
  analysis.
- No GitHub/GitLab remote APIs in the first delivery.

The initial architecture and limits are described in
[Project Evolution XR](../features/PROJECT_EVOLUTION_XR.md).

## 6. Collaboration 2.0

### Implemented

- Authoritative `ParticipantState` with `host` and `guest`.
- First participant becomes host, with automatic promotion of the oldest
  guest.
- Host transfer, kicking the current connection and administrative stop of
  presentations.
- Default anonymous identity with a Star Wars alias stable for the session.
- Custom Unicode name of 2 to 32 characters, no control characters, with
  suffixes for duplicates.
- Persistent, centralized profile in the extension's global storage.
- Six switchable skins, synchronized live.
- Independent `codexr-avatar` component, free of network logic.
- Immediate procedural body and offline fallback.
- Optional animated glTF avatar, with interpolation, `idle`/`walk`/`run`
  detection, LOD and distance-based hiding.
- Main `COLLABORATION` section in the VS Code side panel.
- Explicit consent in VS Code before downloading the model: size (2.16 MiB),
  origin and licence are shown.
- Single download into `globalStorage`, reused by every analysis.
- The six skins reuse one downloaded geometry to reduce traffic and memory.
- Hands at the controllers' real pose, body stable from the rig and heading
  from the head.
- The scene shows no configuration, role, participant or presentation
  panels.
- Following and teleport were removed to keep the spatial experience simple.
- A single main presenter per room.
- Shared ray from the right controller or the desktop cursor.
- Runtimes bundled into file, directory and DOM analyses.
- Every direct browser always receives an anonymous identity.
- Tabs opened by CodeXR receive that installation's profile through a
  single-use browser token.
- Profiles of different installations stay isolated and their changes
  propagate only to their own connections.
- Procedural hands hide when the glTF is active and only genuinely tracked
  XR controller poses are transmitted.
- Movement is computed on the horizontal plane and rest only uses `idle`,
  `stand` or equivalent clips; without a valid clip the base pose is kept.

### Protocol

```ts
type CollaborationRole = 'host' | 'guest';
type IdentityMode = 'anonymous' | 'custom';

interface ParticipantState {
    peerId: string;
    displayName: string;
    identityMode: IdentityMode;
    avatarId: string;
    role: CollaborationRole;
    isPresenter: boolean;
    connectedAt: string;
}
```

Room messages:

- `participant-updated`
- `participant-kick`
- `host-transfer`
- `role-updated`
- `presenter-started`
- `presenter-stopped`

Identity is no longer modified through editable browser messages. The server
takes it from a session issued by CodeXR or forces anonymity for direct
connections. It also validates skins, administrative authority and presenter
exclusivity. A client cannot grant itself the host role.

### Components

| Component | Responsibility |
| --- | --- |
| `CollaborationRoomServer` | Room, authority, roles, identity, presentation and shared state |
| `codexrCollaborationRuntime.js` | Transport, client state, presence and public API |
| `codexrAvatarRuntime.js` | Humanoid rendering, animation, skins, LOD and consented resources |
| `CollaborationProfileManager` | Global profile, optional download and propagation to active servers |
| `CollaborationSectionProvider` | Central configuration from the VS Code side panel |
| `RemoteSessionAuthority` | Invitations, codes, tokens, cookies, expiry, limits and revocation |
| `RemoteAccessManager` | Tunnel lifecycle, server actions and guest connections |
| `CloudflaredBinaryManager` | Discovery, consent, pinned download and SHA-256 verification |

### Avatar resources

The final implementation bundles no GLB inside the VSIX. The user decides
whether to download the resource when using full avatars:

- Current download: 2,266,136 bytes, shown as 2.16 MiB.
- Geometry: approximately 13,744 triangles.
- Source: Quaternius, distributed through Poly Pizza.
- Licence of the downloaded resource: CC BY 3.0.
- Without consent or without network: procedural avatar.
- With consent: one extension-wide download, reused across analyses and
  skins.

This design replaces the binary-copy approach proposed initially. No binary
pipeline is added to the plugin because there is no first-party binary to
package.

### Tests in place

- Host and guest assignment.
- Automatic promotion and host transfer.
- Restriction of administrative actions.
- Kicking a connection.
- Authoritative identity, anonymous browsers, duplicates, tampered profiles
  and invalid skins.
- Presenter exclusivity and release.
- Prior consent, announced size and single global download.
- Avatar and collaboration included in XR and DOM scenes without an overlay
  panel.
- Collaboration client compatibility in DOM-less contexts.

### Pending work

- Manual validation with two browsers and two physical devices.
- Real measurement with two, four and eight avatars on Quest.
- Bone/hand adjustments for additional models if another pack is adopted.
- Station-specific synchronization once the multi-station workspace exists.
- Authenticated TURN for networks where direct WebRTC fails.

## 7. Cross-network connection

### Implemented

- Capability disabled by default via `ServerSettings.remoteAccess`.
- Explicit per-server action from `Active Servers`; enabling the capability
  does not publish servers automatically.
- Temporary Cloudflare Quick Tunnel with no account or router configuration.
- Operating guide, limits and security model:
  [Remote access with Cloudflare Quick Tunnel](../features/CLOUDFLARE_REMOTE_ACCESS.md).
- Detection of an existing `cloudflared` installation and optional single
  download into `globalStorage`.
- Version `2026.5.2` pinned, shell-less download, hidden window and SHA-256
  verification before execution.
- Isolated home directory so a user's `~/.cloudflared/config.yaml` cannot
  interfere with Quick Tunnel.
- `stopped`, `starting`, `shared` and `error` states, with invitation copy,
  pending requests and explicit stop.
- Link with a cryptographic token, pending request, six-digit code,
  five-minute expiry and five attempts.
- Codes stored only as salted hashes; no tokens or codes are written to HTTP
  logs.
- A separate token for the guest extension and a single-use browser token.
- `HttpOnly` session cookie, `Secure` on remote access, `SameSite=Lax` and
  session-scoped.
- HTTP, the room WebSocket and screen signaling reject unauthenticated
  remote access as a non-existent resource.
- Per-address request limit, global limit, code bound to the address and
  revocation when the tunnel closes.
- `Join Remote Session` action inside `COLLABORATION`, using the profile
  configured in the guest CodeXR.
- Minimal landing page for direct browsers; after pairing they stay
  anonymous.
- Cloudflare's free STUN for WebRTC: `stun:stun.cloudflare.com:3478`.

### Known limits

- Quick Tunnel is temporary and development-grade, not production
  infrastructure.
- Cloudflare Quick Tunnel does not support SSE; collaboration works, but
  SSE-based analysis updates are limited during remote access.
- Screen sharing depends on the direct WebRTC connection crossing both NATs.
- TURN is left as a later extension because it requires credentials and
  relay traffic.
- The full flow across two physical networks remains to be validated before
  acceptance is considered closed.

## 8. Silent re-analysis

- Keep CodeXR's local auto-analysis free of external dependencies.
- Keep the configurable delay before re-analyzing changes.
- Run the automatic re-analysis in the background so it never interrupts
  typing.
- Update `data.json` and open viewers only when there are real changes.
- Avoid persistent notifications during the normal flow; use discreet status
  messages for temporary debugging.
- Keep any external generative-assistance integration out of 1.2.0's scope.

## 9. Quality and release

- Run TypeScript, ESLint, Node and Python tests before every candidate.
- Add visual validation on desktop and mobile browsers.
- Test at least one standalone headset and one PC-connected headset.
- Measure FPS, memory, load time and presence traffic.
- Validate reconnection, profile restoration and offline degradation.
- Prepare migration notes from 1.1.0 and privacy notices.
- Keep Lizard as the only metrics engine for 1.2.0.

Current automated status: TypeScript and ESLint clean, Node and Python tests
under continuous validation.

## Delivery sequence

1. `1.2.0-alpha.1`: Collaboration 2.0 on the local network.
2. `1.2.0-alpha.2`: multi-station workspace and live chart selector in Field
   Mapping.
3. `1.2.0-beta.1`: cross-network connection and invitations.
4. `1.2.0-beta.2`: optional AI, temporal comparator and Project Evolution.
5. `1.2.0-rc.1`: performance, accessibility, documentation and hardware
   tests.
6. `1.2.0`: stable release.

## Exit criteria

- No existing analysis flow breaks.
- Every administrative operation is validated by the server.
- Collaboration works without downloading avatars.
- No model is downloaded without consent.
- The scene remains usable if the network or the glTF resource fails.
- The automated suite and the two-client manual tests are documented.
