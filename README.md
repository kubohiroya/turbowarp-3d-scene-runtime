# TurboWarp-3D-Scene-Runtime

**English** | [日本語](README.ja.md)

TurboWarp-3D-Scene-Runtime applies a 3D/AR scene written as YAML or JSON. One block takes the
description; the extension validates it, turns it into a call plan, and builds the scene by calling
`turbowarp-aframe` and `turbowarp-ar` through their runtime capabilities.

The description stays the source of truth. Nothing is compiled into blocks, so re-applying an edited
scene is one block call rather than a rewritten project.

## What it does

- Accepts a scene graph document, or a `{scene3d, ar}` fragment carrying both halves.
- Validates and normalizes it with `@kubohiroya/turbowarp-scene-graph`, filling ids and defaults.
- Builds the 3D scene before the AR scene, so the nodes an AR target binds to already exist.
- Reports status, readiness, and the last error as blocks, instead of stopping a script.
- Reports which companion extension is missing or too old when it cannot build the scene.

## Requirements and safety

- TurboWarp's **Run extension without sandbox** option.
- `turbowarp-aframe` 0.7.0 or newer loaded in the same project, for any scene with 3D nodes.
- `turbowarp-ar` 0.4.0 or newer, and `turbowarp-camera-source`, for a scene with an `ar` fragment.
- A secure context and camera permission when the scene uses AR.

This extension performs no I/O of its own. It reads the text a project gives it and calls the two
companion extensions; camera access, network access, and DOM ownership stay with them.

## Install

Load the companion extensions first, then this one, as unsandboxed custom extensions.

```text
https://cdn.jsdelivr.net/npm/@kubohiroya/turbowarp-3d-scene-runtime@0.1.0/dist/3d-scene-runtime.js
```

For local development:

```bash
pnpm add @kubohiroya/turbowarp-3d-scene-runtime@0.1.0
```

## Quick start

```text
apply 3D scene [formatVersion: 1
root:
  children:
    - type: box
      id: card
      class: monster
      attributes:
        position: 0 1 -3]
```

With AR, pass both halves:

```yaml
scene3d:
  formatVersion: 1
  root:
    children:
      - type: box
        id: card
ar:
  cameraId: front
  targets:
    - targetId: marker-1
      selector: "#card"
```

A bare document is treated as `scene3d`, so a project that only builds 3D does not have to nest it.
An empty description applies nothing and is not an error.

## How it reaches the other extensions

It reads `Scratch.vm.runtime.turbowarpAFrameCapability` and
`Scratch.vm.runtime.turbowarpARCapability`, and feature-detects the methods it uses rather than
gating on a version number, which is how both capabilities are documented to grow. A capability that
is absent, or present without the methods a call plan needs, is reported through `3D scene error`
naming the extension and the version that provides them.

Only the capabilities the scene actually needs are required: a scene with no `ar` fragment builds
without `turbowarp-ar` loaded.

Applying a scene that contains an `ar` fragment stops any running AR session first, so re-applying
does not leave a stale camera lease behind.

## Block reference

<!-- BEGIN GENERATED BLOCKS -->

### `apply 3D scene [SOURCE]`

Validates a YAML or JSON scene description and builds it by dispatching its call plan to turbowarp-aframe and turbowarp-ar.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `applyScene` |
| `SOURCE` | String, default: `formatVersion: 1` |

### `3D scene status`

Returns idle, applying, ready, or error.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `sceneStatus` |

### `3D scene error`

Returns the message from the last failed apply, or an empty string.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `sceneError` |

### `3D scene is ready?`

Reports whether the last apply finished without an error.

| Property | Value |
|---|---|
| Type | Boolean |
| Opcode | `isSceneReady` |

### `when 3D scene applied`

Fires once each time a scene finishes being applied.

| Property | Value |
|---|---|
| Type | Hat |
| Opcode | `whenSceneApplied` |

<!-- END GENERATED BLOCKS -->

## Compatibility

The extension ID is `kubohiroya3dsceneruntime`. Changing the extension ID or opcode names requires
an SB3 migration plan.

## Development

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run check
```

The generated extension bundle is `dist/3d-scene-runtime.js`; the deterministic API manifest is
`dist/extension-manifest.json`.

## License

MPL-2.0. See [LICENSE](LICENSE).
