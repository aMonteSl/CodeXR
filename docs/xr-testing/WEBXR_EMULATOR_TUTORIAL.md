# Testing CodeXR in VR and AR without a headset: the WebXR emulator

This guide explains how to validate CodeXR's immersive experience from a
desktop browser, using Meta's **Immersive Web Emulator** — a Chrome/Edge
extension that simulates a headset with its two controllers — and, as a quick
zero-install alternative, the `CodeXRDebug` commands built into every
generated scene.

> **What you can validate this way**: the height you appear at, flight,
> movement and turning with the sticks, trigger clicks, the direction of the
> laser ray, and what AR hides or keeps.
>
> **What it does NOT replace**: the real feel of a physical headset — true
> passthrough, perceived scale, performance and comfort still need hardware.

---

## 1. Install the Immersive Web Emulator

1. Open Chrome or Edge and go to the extension's page:
   - Chrome Web Store: search for **"Immersive Web Emulator"** (publisher: Meta).
   - Source code: <https://github.com/meta-quest/immersive-web-emulator>.
2. Click **Add to Chrome** and confirm.
3. If DevTools was open, close and reopen it: the emulator panel only appears
   in fresh DevTools sessions.

Nothing else needs configuring: with the extension installed, the browser
"announces" a WebXR device and the **Enter XR** button in CodeXR scenes
starts an emulated immersive session.

## 2. Prepare a CodeXR scene

1. In VS Code, run an XR analysis: right-click a folder →
   **CodeXR: Analyze Directory (XR)** (or a file → *Analyze File (XR)*).
2. Open the visualization in the browser (from ACTIVE SERVERS or the URL in
   the notification).
3. Move around for a moment in desktop mode (mouse to look, WASD to walk)
   and note **how high the table sits in your view**: that exact height is
   what you should have when entering VR or AR. It is the first check in the
   checklist.
4. Open DevTools (**F12**) and find the **WebXR** tab (if you don't see it,
   it is under the `»` overflow menu of extra DevTools tabs).

## 3. The emulator panel

The WebXR tab shows a 3D view with the headset and both controllers:

- **Drag the headset or the controllers** with the mouse to move them; each
  one carries **red/green/blue arrow gizmos** to move it along axes. *Those
  arrows are drawn by the emulator, not by CodeXR* — they will not appear on
  a real headset.
- Each controller has its **stick, trigger and button controls** in the
  panel: you can push the stick with the mouse and hold the trigger down.
- The device dropdown (Quest 2, Quest 3…) switches the emulated model.
- If you get lost, the panel's **pose reset** button returns the headset and
  controllers to their default position.

## 4. Testing VR

1. Press **Enter XR** in the scene (with the extension installed, the button
   enters emulated VR).
2. **Height check**: you must see the room at exactly the same height as in
   step 2 — standing, with the table below eye level. Not floating above the
   room, not with your eyes at floor level. (The emulated "headset" height
   replaces the desktop one; CodeXR compensates automatically when it detects
   the session.)
3. **The whole room stays visible**: nothing is hidden in VR.
4. **Movement** (the sticks in the emulator panel):
   - **Left stick**: moves you, smoothly, toward where you are looking. In
     VR flight is active: look up and push the stick forward to **rise**
     above the city; look down to descend.
   - **Right stick**: **turns** you smoothly.
5. **Point and click**: aim a controller at a chart or a panel — the ray must
   leave **straight, toward where the controller points** — and pull the
   **trigger**. The pointer belongs to the hand you used last: pull the other
   controller's trigger and the laser switches hands.
6. **Grab and steer screens with the stick**: aim at the edge of a virtual
   screen, hold the trigger to grab it and, without releasing, use the
   **stick of that same hand**: forward pushes it away, back brings it closer
   (the equivalent of dragging with the mouse and scrolling), left/right
   slides it sideways, and diagonals combine. While you grab, that stick does
   not move you — the other hand keeps walking and turning — and the laser
   does not switch hands even if you use the other one.
7. **Exit** (exit button or the Esc key): you must return to the exact spot
   and height you had on desktop, walking on the floor again.

## 5. Testing AR

1. With the extension active, the scene also offers AR mode (depending on
   the emulator version, from the Enter XR button itself or from the WebXR
   panel by choosing an `immersive-ar` session).
2. On entry, all of this must happen at once:
   - The virtual room and the environment **disappear** (walls, decorated
     floor, sky). On a real headset you would see your physical room there;
     in the emulator an empty background remains — that is expected, the
     emulator has no passthrough camera.
   - The pedestal with its chart, the controller panel, the virtual screens
     and the guide are **kept**: everything interactive.
   - You are **recentered** one step from the pedestal, facing it, instead
     of leaving it seven metres away: the table appears in front of you, on
     your own floor, at your height.
3. Sticks, flight, trigger and ray work the same as in VR.
4. On exit, the room reappears and you return to your desktop position.

## 6. Zero-install alternative: the `CodeXRDebug` commands

If you don't want to install anything, every generated scene accepts this in
the browser console (F12 → Console):

```js
CodeXRDebug.simulateAR();      // hides room and environment, recenters you by the pedestal
CodeXRDebug.simulateVR();      // keeps the whole room
CodeXRDebug.exitSimulated();   // returns to the desktop view
```

They fire the same states and events as a real session, so everything that
reacts to them really runs: AR hiding, recentering, flight enablement,
pointer handover and height. What they do **not** have is a WebXR session:
no headset pose, no stereo, no passthrough, and the emulator's sticks do not
exist — for controller movement you need the extension.
`CodeXRDebug.status()` tells you the active mode at any time (`ar`, `vr` or
`desktop`).

## 7. Validation checklist

| # | Check | Expected result |
|---|---|---|
| 1 | Height when entering VR | Same as in the desktop tab: table below eye level |
| 2 | Height when entering AR | Same, and recentered one step from the pedestal, facing it |
| 3 | VR: content | Nothing is hidden; the whole room is still there |
| 4 | AR: content | Room and environment gone; pedestal, charts, panel, screens and guide stay |
| 5 | Left stick | Smooth movement toward where you look; looking up, you fly |
| 6 | Right stick | Smooth turn; no displacement |
| 7 | Trigger | Clicks on charts and panels, with either hand |
| 8 | Ray | Leaves the controller straight, toward where it points |
| 9 | Exiting the mode | Desktop position, height and floor restored; in AR, the room reappears |

If any of these rows fails, open an issue at
<https://github.com/aMonteSl/CodeXR/issues> stating the row, the browser and
the emulator version (or the headset model).

## 8. Known issues

- **A background tab freezes**: A-Frame stops the render loop when the tab
  is not visible (`document.hidden`). If the scene seems unresponsive to
  commands, bring the tab to the front.
- **The RGB gizmos "floating" over the controllers** in your captures are
  the emulator's drag handles; they are not part of the scene.
- **The ray points "oddly" right after entering**: emulated controllers
  point wherever they are oriented in the emulator panel — reorient them
  with their gizmos or press the pose reset.
- **The AR background is black/empty**: the emulator does not emulate the
  camera; real passthrough is only visible on a physical headset.
- **The emulator's limits**: no real hand-tracking, no device spatial audio,
  and none of a headset's optics/scale. The final verdict on comfort and
  scale needs hardware; any divergence you find on a real headset is exactly
  the kind of report the CHANGELOG asks for.

## 9. MCP bridge for agents

Everything above can also be executed by an AI agent (Claude Code, Cursor,
Copilot…) without touching your mouse, through the emulator's official MCP
bridge: [`@iwer/extension-bridge`](https://www.npmjs.com/package/@iwer/extension-bridge).

```json
{
  "mcpServers": {
    "iwer": { "command": "npx", "args": ["-y", "@iwer/extension-bridge"] }
  }
}
```

The flow: the agent starts the daemon over stdio, the emulator extension
dials `ws://127.0.0.1:8723` (fixed port), and **the first time the agent acts
on the tab an "Allow" prompt appears on the page** — nothing reaches the
scene without that consent. From there the agent has ~20 tools: accept/end
the offered session, move headset and controllers (`xr_set_transform`,
`xr_look_at`), sticks and buttons (`xr_set_gamepad_state`, `xr_select`) and
tab captures (`browser_screenshot`).

This guide's checklist was validated end to end through that bridge in a
real emulator session (VR and AR entry/exit, height, AR hiding, recentering,
sticks, flight, turning and clicks on the charts, with a capture at every
step) — which is how the dead-sticks, ray-decompensation-after-handover and
incomplete-VR-exit-restore bugs fixed in 1.2.0 were found.

Limitations worth knowing:

- **The browser window must stay visible**: if it loses focus or gets
  covered, Chrome freezes the XR render loop and actions expire with
  "no frame processing the queue". Bring the window to the front and retry.
- **`xr_accept_session` only accepts the offered session** (the emulator's
  "Enter XR" button, which offers `immersive-vr`). The scene's **AR** button
  uses `requestSession` and requires a human click on the page.
- The emulator reports gamepads as `connected: false` (an IWER bug; CodeXR
  scenes compensate for it since 1.2.0). If sticks don't respond in another
  app, `xr_set_connected` with `connected: true` wakes them up.

## References

- XR scene diagnostics commands: [`XR_DEBUG_COMMANDS.md`](XR_DEBUG_COMMANDS.md)
- Emulator: <https://github.com/meta-quest/immersive-web-emulator>
- Chrome DevTools' native WebXR panel (a more limited alternative, without
  actionable sticks): DevTools → ⋮ menu → *More tools* → *WebXR*
