# System Architecture

This document covers the application structure, GPU pipeline, rendering, and interactive features of the Gray-Scott simulator.

For the reaction-diffusion equations and pattern science, see [Reaction-Diffusion Science](reaction-diffusion.md). For the numerical scheme and stability analysis, see [Numerical Methods](numerical-methods.md).

## 1. Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | FastAPI + uvicorn (~30 lines), `NoCacheMiddleware` for dev |
| Frontend | Vanilla ES modules, no build step |
| Compute | Single WGSL compute shader (`gray-scott.wgsl`) |
| Rendering | 2D canvas, `putImageData` with 256×1 PNG colormap LUT |
| Deployment | Docker (optional) |

## 2. Module Dependency Graph

```
main.js            → WebGPU init, requestAnimationFrame loop
├── solver.js      → 4 GPU storage buffers + 1 uniform, compute pipeline, ping-pong dispatch
├── renderer.js    → staging buffer readback, colormap lookup, canvas putImageData
├── interaction.js → mouse brush painting (circular, writes to all 4 buffers)
├── ui.js          → DOM bindings: presets, F/k sliders, playback, resolution, keyboard
└── presets.js     → 12 (F,k) preset configs + 3 seed pattern generators
```

**`main.js`** is the entry point. It requests the WebGPU adapter and device, creates the Solver, Renderer, Interaction, and UI instances, loads the default preset, and starts the animation loop.

**`solver.js`** owns all GPU compute state. The `Solver` class creates four storage buffers (u, v, uNew, vNew), one uniform buffer (32 bytes), the compute pipeline with an explicit bind group layout, and two bind groups for ping-pong. The `step(substeps)` method builds a single command encoder with N compute passes and submits once.

**`renderer.js`** handles GPU→CPU readback and canvas rendering. Each frame, it copies the current V buffer to a staging buffer, maps it asynchronously, and renders the field through the colormap. A `readbackPending` flag prevents stacking multiple readback requests (one-frame latency is expected).

**`interaction.js`** translates mouse events to grid coordinates and writes u = 0.5, v = 0.5 to a circular brush region. Writes go to all four buffers (u, v, uNew, vNew) since the solver may read from either pair depending on flip state.

**`ui.js`** binds all DOM controls: preset buttons, F/k/substeps/brush sliders, play/pause/step/reset/clear buttons, resolution picker, and keyboard shortcuts. It also manages the accordion-style guide modal.

**`presets.js`** exports 12 preset configurations (F, k, seed type) and two functions: `loadPreset()` which sets parameters and seeds the field, and `clearField()` which blanks the grid (u = 1 everywhere, v = 0).

## 3. Frame Loop

```
requestAnimationFrame(frame)
  └─ frame()
       ├─ if !paused: solver.step(substepsPerFrame)
       │    ├─ writeUniforms()              // push F, k, etc. to GPU
       │    ├─ encoder = createCommandEncoder()
       │    ├─ for s in 0..substeps:
       │    │    ├─ beginComputePass()
       │    │    ├─ setBindGroup(flip ? B : A)  // ping-pong
       │    │    ├─ dispatchWorkgroups(ceil(numX/8), ceil(numY/8))
       │    │    ├─ end()
       │    │    └─ flip = !flip
       │    └─ queue.submit([encoder.finish()])
       │
       ├─ renderer.draw()
       │    ├─ if !readbackPending:
       │    │    ├─ copyBufferToBuffer(solver.vBuffer → staging)
       │    │    ├─ queue.submit()
       │    │    └─ staging.mapAsync() → fieldData = Float32Array(copy)
       │    └─ if fieldData: renderField()
       │         ├─ for each cell (i,j):
       │         │    ├─ idx = i * numY + j           // column-major
       │         │    ├─ pixelIdx = ((numY-1-j)*numX + i)*4  // Y-flip
       │         │    └─ pixels[pixelIdx] = colormap[floor(v * 255)]
       │         └─ ctx.putImageData()
       │
       ├─ update performance HUD (every 10 frames)
       └─ requestAnimationFrame(frame)
```

## 4. GPU Pipeline

### Buffer Layout

**Four storage buffers** (u, v, uNew, vNew), each `numX × numY × 4` bytes (f32 per cell):

| Buffer | Usage Flags | Role |
|--------|-------------|------|
| u, v | STORAGE \| COPY_SRC \| COPY_DST | Current field (or output, depending on flip) |
| uNew, vNew | STORAGE \| COPY_SRC \| COPY_DST | Output field (or current, depending on flip) |

**One uniform buffer** (32 bytes, std140 layout):

```
offset  0: numX (u32)     offset 16: F  (f32)
offset  4: numY (u32)     offset 20: k  (f32)
offset  8: Du   (f32)     offset 24: dt (f32)
offset 12: Dv   (f32)     offset 28: pad (u32)
```

Fixed values: Du = 0.2097, Dv = 0.105, dt = 1.0.

### Bind Group Strategy

The bind group layout is created **explicitly** (not `layout: 'auto'`):

| Binding | Type | Role |
|---------|------|------|
| 0 | uniform | Params (numX, numY, Du, Dv, F, k, dt) |
| 1 | read-only-storage | uIn |
| 2 | read-only-storage | vIn |
| 3 | storage | uOut |
| 4 | storage | vOut |

Two bind groups (A and B) are created with **swapped read/write roles**:
- **Bind group A:** reads from (u, v), writes to (uNew, vNew)
- **Bind group B:** reads from (uNew, vNew), writes to (u, v)

### Ping-Pong Pattern

A `_flip` boolean alternates which bind group is active each substep. No buffer copies are performed — the swap is purely which bind group is set on the compute pass. After N substeps, the `vBuffer` getter returns whichever buffer holds the latest V field (vNew if flip is true, v otherwise).

## 5. Rendering Pipeline

1. **Staging readback.** A MAP_READ | COPY_DST staging buffer receives V field data via `copyBufferToBuffer`. The `mapAsync()` call is non-blocking; the result arrives one frame later.
2. **Colormap lookup.** A 256×1 PNG (`static/colormaps/viridis.png`) is loaded at startup into a Uint8Array. Each V value is clamped to [0, 1], multiplied by 255, and used as an index into the LUT. The colormap is a 5-stop gradient: black(0) → green(0.2) → yellow(0.21) → red(0.4) → white(0.6+). The tight green→yellow transition at V ≈ 0.2 creates vivid pattern edges.
3. **Canvas Y-flip.** The GPU grid has j = 0 at bottom; the canvas has y = 0 at top. The mapping is: `pixelIdx = ((numY - 1 - j) * numX + i) * 4`.
4. **putImageData.** The entire ImageData is written to the 2D canvas context each frame.

## 6. Interaction Model

Mouse events on the canvas are converted to grid coordinates:

```
i = floor(mx / canvasWidth * numX)
j = floor((1 - my / canvasHeight) * numY)
```

The Y-flip matches the canvas rendering convention. A circular brush of configurable radius (1–20 pixels, default 5) writes u = 0.5, v = 0.5 to every cell within the circle. Writes go to **all four buffers** (u, v, uNew, vNew) via individual `device.queue.writeBuffer()` calls, ensuring consistent state regardless of the current flip position.

## 7. Preset System

### 12 Presets

| Preset | F | k | Seed |
|--------|---|---|------|
| Default | 0.037 | 0.060 | scatteredCircles |
| Solitons | 0.030 | 0.062 | scatteredCircles |
| Pulsating Solitons | 0.025 | 0.060 | scatteredCircles |
| Worms | 0.078 | 0.061 | centralSquare |
| Mazes | 0.029 | 0.057 | largeCentralBlock |
| Holes | 0.039 | 0.058 | scatteredCircles |
| Chaos | 0.026 | 0.051 | scatteredCircles |
| Chaos & Holes | 0.034 | 0.056 | scatteredCircles |
| Moving Spots | 0.014 | 0.054 | scatteredCircles |
| Spots & Loops | 0.018 | 0.051 | scatteredCircles |
| Waves | 0.014 | 0.045 | largeCentralBlock |
| U-Skate World | 0.062 | 0.06093 | centralSquare |

### Seed Generators

- **scatteredCircles:** 15 random circles (radius 3–5) scattered across the grid. u = 0.5 ± noise, v = 0.25 ± noise.
- **centralSquare:** 10% × 10% centered square. Same u/v values.
- **largeCentralBlock:** 20% × 20% centered square. Same u/v values.

### Load Flow

`loadPreset(name, solver)`:
1. Set F and k on the solver via `setParams()`
2. Generate seed data (uData, vData Float32Arrays)
3. Reset flip state to false
4. Write seed to **all four** buffers (u, v, uNew, vNew)

`clearField(solver)`: Same flow but fills u = 1.0, v = 0.0 everywhere.

## 8. UI & Keyboard

### Controls

| Control | Element | Behavior |
|---------|---------|----------|
| Preset buttons | `[data-preset]` | Load preset, sync sliders, highlight active |
| F slider | range 0.01–0.08, step 0.001 | Live-updates solver params |
| k slider | range 0.03–0.07, step 0.0001 | Live-updates solver params |
| Speed slider | range 1–64 substeps/frame | Controls simulation speed |
| Brush slider | range 1–20 pixels | Sets painting brush radius |
| Resolution | 256 / 512 / 1024 buttons | Resizes grid, reloads preset |
| Play/Pause | toggle | Stops/starts solver stepping |
| Step | button | Single step when paused |
| Reset | button | Reload current preset seed |
| Clear | button | Blank field (u=1, v=0) |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `P` | Play / Pause |
| `M` | Step one frame (paused only) |
| `R` | Reset to current preset |
| `C` | Clear field |
| `J` / `K` | Decrease / increase F by 0.001 |
| `H` / `L` | Decrease / increase k by 0.0001 |

The J/K/H/L vim-style bindings allow fine-grained parameter sweeps. The slider values update in sync. Keyboard input is ignored when an `<input>` element has focus.

### Resolution

The vertical cell count (numY) is set by the resolution picker (256, 512, or 1024). The horizontal count (numX) is derived from the canvas container's aspect ratio:

```
numX = round(numY × aspectRatio / 8) × 8
```

The rounding to multiples of 8 aligns with the compute shader's 8×8 workgroup size. This means the grid adapts to the browser window shape, keeping patterns undistorted.
