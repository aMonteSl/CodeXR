# CodeXR remote access with Cloudflare Quick Tunnel

## Summary

CodeXR uses **Cloudflare Quick Tunnel** to temporarily share an analysis with
people on a different network. The feature avoids configuring the router,
opening inbound ports or owning a public IP.

Remote access should be treated as a temporary collaboration and testing
feature. Quick Tunnel offers no production guarantees.

## How a connection flows

```text
Guest browser
        |
        | HTTPS and WebSocket
        v
Cloudflare (*.trycloudflare.com)
        |
        | outbound tunnel created by cloudflared
        v
Local CodeXR server
        |
        v
XR analysis and collaboration room
```

`cloudflared` opens outbound connections from the host machine to Cloudflare.
The router never needs to accept new connections from the Internet and CodeXR
does not directly publish the origin IP.

Stopping the share, closing the server or deactivating CodeXR terminates
`cloudflared`, the random URL ceases to exist, and CodeXR revokes remote
invitations, sessions and credentials.

## Why it is free

Cloudflare presents Quick Tunnels as a way to try Cloudflare Tunnel without
creating an account, moving DNS or owning a domain. It offers them to make
evaluating Tunnel easy before setting up production services.

Free does not mean guaranteed capacity or availability. Cloudflare also uses
these tunnels to test changes before rolling them out to its production
products.

## Official limits

As of June 2026, Cloudflare documents these restrictions:

- a maximum of **200 concurrent in-flight requests per tunnel**;
- requests over the limit receive HTTP `429`;
- Server-Sent Events (SSE) are not supported;
- the `*.trycloudflare.com` subdomain is random and temporary;
- the URL only works while the process keeps running;
- there is no SLA or availability guarantee;
- the service is expressly aimed at development, demos and testing.

WebSocket does work. CodeXR uses it for collaboration, presence and shared
historical comparisons. SSE-based live reload remains available on the local
network, but is not considered available through Quick Tunnel.

## Security: Cloudflare versus CodeXR

Cloudflare provides the public HTTPS transport and the tunnel down to the
local server. It does not decide who may enter a CodeXR session.

CodeXR adds its own authorization:

- invitation link with a cryptographic token;
- pending request visible to the host;
- temporary six-digit code;
- expiry and attempt limits;
- single-use browser token;
- `HttpOnly` and `Secure` session cookie;
- authorization of HTTP, WebSocket and signaling;
- revocation when the tunnel stops.

Remote traffic crosses Cloudflare's infrastructure. Keep that in mind before
sharing sensitive code, metrics or screens.

## What happens with hundreds of users

Every installation that shares a server starts its own Quick Tunnel. A hundred
hosts therefore do not consume a single shared 200-request quota: each tunnel
has its own limit.

That does not turn Quick Tunnel into guaranteed infrastructure:

- Cloudflare publishes no global capacity commitment for this use;
- it can change, limit or interrupt the service without an SLA;
- a session with many resources or clients can hit its individual limit;
- CodeXR does not control the availability of `trycloudflare.com`;
- starting up and propagating a new URL can introduce delay.

The public release must present the feature as **best effort**. A tunnel
failure must not affect the local analysis or cause data loss.

## Screen sharing through the tunnel

Screen sharing cannot travel browser-to-browser when the two ends sit on
different networks: without a TURN server, WebRTC pairing does not cross a
symmetric NAT or CGNAT. CodeXR uses no third-party services for this, so
**remote guests' video and audio are relayed by the extension's own server**
over the `/codexr-broadcast` WebSocket, which already goes through the tunnel.

The transport is decided per viewer, from their own request:

| Viewer | Transport | Reason |
|---|---|---|
| Same network | Direct WebRTC | Lower latency, does not consume the host's uplink |
| Through the tunnel | Server relay | The only route guaranteed to reach them |

Encoding: VP8 + Opus via WebCodecs where available (Chrome, Edge, the Quest
browser); elsewhere, JPEG images at ~8 fps **without audio**, and the screen
says so in its status.

### One broadcast, many subscribers

The sharing browser **encodes once and uploads a single copy** to the server,
no matter how many viewers there are: the second and later ones merely request
a keyframe to hook on. What does multiply is distribution: every remote viewer
has their own connection through the tunnel, so **N copies leave through the
host's uplink**. Without an external media server that multiplication is
inherent, and CodeXR uses no third parties or credentials.

That is why there is no viewer cap but a **quality that follows the audience**
— the same encoder is reconfigured, never duplicated:

| Remote viewers | Video | Approx. host upload |
|---|---|---|
| 1-2 | 1.5 Mbps, 1280 px | 1.5-3 Mbps |
| 3-6 | 800 kbps, 960 px | 2.4-4.8 Mbps |
| 7-14 | 500 kbps, 768 px | 3.5-7 Mbps |
| 15+ | 350 kbps, 640 px, ~12 fps | 5 Mbps and rising |

A realistic order of magnitude: on home fibre (≈10 Mbps up) the lower tiers
fit around **15-25 viewers**; on ADSL, a handful. The host sees on their
screen how many viewers there are and roughly what upload they are costing, so
inviting more people is an informed decision.

**Per-viewer degradation, without extra encoding**: video is encoded in three
temporal layers (WebCodecs `scalabilityMode`). If someone's connection
saturates, the server first drops their top layer — they see fewer fps — and
only if still stuck withholds their remaining delta frames. Keyframes, audio
and configuration are never dropped, so that viewer recovers on their own and
**nobody else notices**. Where the browser does not support layers, the stream
remains valid, simply single-layer.

## Recommended evolution

For stable or institutional scenarios two paths are contemplated:

1. **Cloudflare Named Tunnels**: an account, a stable hostname and manageable
   configuration, with the option of integrating Cloudflare Access.
2. **A CodeXR-owned relay**: project-controlled infrastructure for
   invitations, observability, usage policies and availability.

TURN will also require dedicated infrastructure or credentials if guaranteed
WebRTC screen relay across restrictive NATs is ever desired.

## Official sources

- [Cloudflare Quick Tunnels](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/do-more-with-tunnels/trycloudflare/)
- [Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/)
- [Wrangler Tunnel](https://developers.cloudflare.com/workers/wrangler/commands/tunnel/)
