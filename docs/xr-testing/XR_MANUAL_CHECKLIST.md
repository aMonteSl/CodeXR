# Manual VR/AR experience checklist

A manual validation pass over CodeXR's immersive mode: entry position,
flight, controllers and screens. It works equally with the
[WebXR emulator](WEBXR_EMULATOR_TUTORIAL.md) and with a physical headset —
on hardware, every row doubles as a device report (include the model if
something fails).

**Setup**: run an XR analysis (right-click → *CodeXR: Analyze Directory
(XR)*), open the scene in the browser and take a short walk in desktop mode
(mouse + WASD): note **where you stand and how high the table sits in your
view** — those are your references for everything below.

## 1. VR

| # | What to do | Expected result |
|---|---|---|
| 1.1 | Enter VR (Enter XR / VR button) | You appear **in the same spot and at the same height** as on desktop: standing, table below eye level. Not floating over the room, not at floor level |
| 1.2 | Look around | The whole room is still there (walls, ceiling, environment): VR hides nothing. **No white ring/dot** floats in front of your eyes |
| 1.3 | **Left** stick forward | Smooth movement toward where you look |
| 1.4 | Look up + left stick forward | You **fly** (rise); looking down, you descend |
| 1.5 | **Right** stick left/right | Smooth turn, without moving you |
| 1.6 | Aim a controller at a chart and pull the **trigger** | The ray leaves **straight toward where the controller points** and the click responds (legend/action). Repeat with the other hand: the laser **switches hands** and only **one** laser is lit |
| 1.7 | Grab a screen by its **edge** (trigger held) and use the **stick of that same hand** | Forward **pushes it away**, back **pulls it closer** (it stops before reaching your face), left/right **slides it sideways**; diagonals combine. While grabbing, that stick **does not move you** and the other hand keeps walking/turning; the laser does not switch hands even if you use the other one |
| 1.8 | Exit VR | You return **exactly** to the desktop spot and height, however far you flew |

## 2. AR

| # | What to do | Expected result |
|---|---|---|
| 2.1 | Enter AR (AR button) | Recentered one step from the pedestal, **facing it, at your height and on your own floor** |
| 2.2 | Look around | Room and environment **gone** (walls, virtual floor, sky). Pedestal, charts, controller panel, screens and guide are kept. On a real headset your physical room shows behind; in the emulator, an empty background |
| 2.3 | Look at the chart | **With depth and volume**, not flat or dim: the buildings' faces are distinguishable (the AR directional fill light is on) |
| 2.4 | Aim the laser "at nothing" (where a wall used to be) | The ray does **not stop against anything invisible** and no ghost hover appears |
| 2.5 | Grab a screen and move it far, in any direction | It moves **freely**, without bumping into invisible walls (on desktop/VR screens still collide with the room — that is correct there) |
| 2.6 | Sticks, flight and trigger | Same as in VR (rows 1.3-1.7) |
| 2.7 | Exit AR | The room and environment **reappear**, lighting returns to normal and you are back at your desktop spot |

## If something fails

- With the **emulator**: check the known issues in the
  [tutorial](WEBXR_EMULATOR_TUTORIAL.md) (frozen background tab, the
  emulator's own RGB gizmos, empty AR background…).
- On a **physical headset**: open an issue at
  <https://github.com/aMonteSl/CodeXR/issues> with the failing row, the
  headset model and the browser. This release was validated in depth under
  emulation (see the CHANGELOG); real-hardware reports are exactly what we
  need.
