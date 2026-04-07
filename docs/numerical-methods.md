# Numerical Methods

This document covers the discretization scheme used by the simulator, its stability properties, and — for the curious reader — alternative numerical approaches used in the broader Gray-Scott literature.

For the governing equations and pattern phenomenology, see [Reaction-Diffusion Science](reaction-diffusion.md). For the GPU buffer layout and application architecture, see [System Architecture](architecture.md).

## 1. FTCS Scheme

The simulator uses **FTCS (Forward-Time Centered-Space)**: explicit Euler in time, 5-point Laplacian in space. This is the most common choice for exploratory reaction-diffusion work because it is trivially parallelizable and maps directly to GPU compute.

**Spatial discretization.** The 5-point Laplacian on a uniform grid with spacing Δx:

```
∇²u ≈ u(i-1,j) + u(i+1,j) + u(i,j-1) + u(i,j+1) − 4·u(i,j)
```

This is O(Δx²) accurate. The grid uses **column-major indexing**: `idx = i * numY + j`, where i is the column index and j is the row index. This convention is consistent across all JavaScript modules and the WGSL shader (`gray-scott.wgsl`).

**Periodic boundary conditions.** Neighbor indices wrap using modular arithmetic:

```
left  = ((i + numX - 1) % numX) * numY + j
right = ((i + 1)        % numX) * numY + j
up    = i * numY + (j + 1)        % numY
down  = i * numY + (j + numY - 1) % numY
```

This makes the domain topologically a torus — patterns that exit one edge reenter from the opposite side.

**Time integration.** Forward Euler update with fixed time step dt = 1.0, Δx = 1.0:

```
u_new = u + dt · (Du · ∇²u − u·v² + F·(1 − u))
v_new = v + dt · (Dv · ∇²v + u·v² − (F + k)·v)
```

## 2. Stability

The CFL stability constraint for explicit diffusion on a 2D grid is:

```
dt ≤ Δx² / (4 · Du)
```

With Δx = 1.0 and Du = 0.2097: dt ≤ 1.19. The simulator uses dt = 1.0, which satisfies this constraint but operates near the stability boundary. This is standard practice for Gray-Scott — pushing dt close to the limit maximizes pattern evolution speed per frame.

The scheme is first-order accurate in time, second-order in space: O(Δt, Δx²).

## 3. GPU Dispatch

The compute shader dispatches **8×8 workgroups** over the grid:

```
workgroupsX = ceil(numX / 8)
workgroupsY = ceil(numY / 8)
```

Each thread computes one grid cell. Threads whose global invocation ID exceeds the grid dimensions early-return (boundary guard). Multiple substeps (default 16) are batched into a single command encoder and submitted in one `queue.submit()` call. A **ping-pong buffer pattern** alternates which buffer pair is read vs. written each substep, avoiding read/write hazards without any buffer copies.

For full details on buffer layout and bind group strategy, see [System Architecture](architecture.md#4-gpu-pipeline).

## 4. Alternative Schemes

*The simulator uses FTCS exclusively. The following methods appear in the Gray-Scott literature and are included here for context.*

**ADI (Alternating Direction Implicit).** Split the 2D Laplacian into two 1D implicit sweeps alternating between x and y directions. Each sweep solves tridiagonal systems (Thomas algorithm, O(N)). This achieves unconditional stability for the diffusion terms, though the nonlinear reaction term still requires care. ADI is O(Δx², Δt²) and well-suited for production codes where Δx is small.

**Pseudo-spectral methods.** Compute ∇²u in Fourier space as −|k|²·û(k) using FFTs. Combined with exponential time differencing (ETD) or integrating-factor methods, the diffusion term is treated exactly in Fourier space (it diagonalizes), leaving only the nonlinear reaction for explicit stepping. The resulting scheme is spectrally accurate in space and can use large time steps. This is the method of choice for high-resolution studies on periodic domains — the Fourier assumption is actually exact for Gray-Scott with periodic BCs. Cost is O(N² log N) per step instead of O(N²), but with much larger feasible dt.

**Operator splitting (Strang splitting).** Separately integrate the diffusion and reaction sub-problems with their own optimal methods. The reaction sub-system u̇ = −uv² + F(1−u), v̇ = uv² − (F+k)v is a stiff ODE that can be solved with Runge-Kutta or even analytically (it has conserved quantities). This makes the overall scheme more accurate and stable without requiring a fully implicit nonlinear solve.

**Multigrid.** For implicit schemes on fine grids, the linear systems arising from implicit diffusion are large. Geometric multigrid achieves O(N²) solve cost (rather than O(N³) for direct methods) by cycling through coarse-to-fine grid hierarchies. This is necessary for very fine 2D or any 3D Gray-Scott simulations.

**GPU implementations.** FTCS maps trivially to GPU — each grid cell is independent per time step, so the kernel is embarrassingly parallel. Modern GPU implementations can simulate 2048×2048 grids in real time. The memory bandwidth bottleneck (reading u, v and their four neighbors) is the primary constraint, not floating-point throughput. This simulator demonstrates this approach with WebGPU compute shaders.

## 5. Assumptions and Limitations

**The model is phenomenological, not mechanistic.** The uv² term models a cubic autocatalytic reaction, but real biochemistry rarely reduces to this cleanly. Quantitative biological predictions should be treated with skepticism.

**The uniform diffusion assumption is strong.** Real biological or chemical substrates have spatially heterogeneous, anisotropic, and often concentration-dependent diffusion. The Laplacian operator in Gray-Scott assumes none of this.

**Sensitivity to initial conditions and parameter proximity to bifurcations.** Near regime boundaries in (F, k) space, qualitatively different attractors can coexist, and the final pattern depends strongly on initial conditions. This makes reproducibility in numerical experiments non-trivial — two codes with different initialization RNG will converge to different patterns even at the same parameters. The simulator's brush painting feature lets you explore this sensitivity directly.

**Numerical diffusion near the CFL boundary.** The FTCS scheme at dt ≈ dt_max introduces numerical diffusion that slightly shifts the effective Du and Dv, which can push the system across a bifurcation. This is rarely acknowledged in papers that report "interesting patterns" found by tuning parameters. When using the simulator, be aware that patterns near regime boundaries may be partly shaped by this artifact.
