# The Gray-Scott Reaction-Diffusion System

The Gray-Scott model is a two-component reaction-diffusion system that produces an extraordinary range of self-organizing spatial patterns from a single nonlinear interaction. This document covers the mathematical formulation, the mechanism behind pattern formation, and the behavioral regimes accessible through the simulator's 12 presets.

For how the equations are discretized and solved, see [Numerical Methods](numerical-methods.md). For the application architecture and GPU implementation, see [System Architecture](architecture.md).

## 1. The Equations

The system describes two chemical species, U (substrate) and V (activator), with concentrations u, v ∈ [0,1]:

```
∂u/∂t = Du ∇²u − uv² + F(1 − u)
∂v/∂t = Dv ∇²v + uv² − (F + k)v
```

The autocatalytic reaction U + 2V → 3V is the nonlinear core: it consumes substrate u and self-amplifies v. The feed rate F replenishes U from a reservoir (held at u = 1), and k is the kill rate that removes V. The diffusion coefficients satisfy Du > Dv — *long-range inhibition, short-range activation* — which is the essential ingredient for Turing-type pattern formation.

The key dimensionless groups are F, k, and the ratio Du/Dv, fixed at 2 in this simulator (Du = 0.2097, Dv = 0.105). The (F, k) plane is the main parameter space. The simulator provides 12 presets spanning distinct regions of this plane, and sliders for continuous exploration.

## 2. Why Gray-Scott Is So Ubiquitous

**Mathematical richness from minimal ingredients.** Two coupled PDEs with one nonlinear term produce an extraordinary range of spatiotemporal behaviors. This makes it a canonical testbed: the model is simple enough to analyze but complex enough to be genuinely interesting. For anyone studying pattern formation, bifurcation theory, or nonlinear dynamics, Gray-Scott is essentially the hydrogen atom of reaction-diffusion systems.

**The Turing instability mechanism.** Alan Turing's 1952 paper showed that a spatially uniform steady state can be destabilized by diffusion — counterintuitive because diffusion normally homogenizes. The Gray-Scott system exhibits this: a Turing instability occurs when the activator (V) diffuses much slower than the inhibitor (here, U plays the inhibitor role through substrate depletion). A linear stability analysis of the uniform state (u*, v*) around the nontrivial fixed point yields a dispersion relation σ(q), and there is a band of wavenumbers q with positive growth rates, selecting a preferred spatial scale. This is well-understood analytically, which makes Gray-Scott attractive pedagogically.

**Pearson's 1993 Science paper** was enormously influential. It systematically mapped the (F, k) plane via computation and identified ~12 qualitatively distinct "phase regions" with exotic labels (α through μ). This made Gray-Scott a go-to benchmark for new numerical methods and computing hardware — it's essentially the "hello world" of nonlinear PDE simulation. The simulator's 12 presets sample representative points from Pearson's classification.

**Biological interpretability** (with important caveats). The model has been invoked to explain animal coat patterns (leopard spots, zebra stripes), skeletal morphogenesis, vegetation patterns in arid ecosystems, and predator-prey dynamics in ecology. The caveat is that the mapping to real biology is largely phenomenological; Gray-Scott is not a mechanistic model of any specific biochemical pathway. See [Assumptions and Limitations](numerical-methods.md#5-assumptions-and-limitations) for more on this.

## 3. Behavioral Regimes

The phenomenology is organized by position in the (F, k) plane, with Du/Dv = 2 fixed. The simulator includes presets for each of the regimes below — select one and watch the pattern evolve, or use the J/K and H/L keyboard shortcuts to continuously sweep through parameter space.

**Spots / replicating spots** (Solitons preset: F = 0.030, k = 0.062): Localized blobs of high v embedded in a u-rich background. These are essentially stable soliton-like structures. The spot diameter is set by the characteristic diffusion length ℓ ~ √(Dv / k). At nearby parameters (Pulsating Solitons: F = 0.025, k = 0.060), the spots oscillate in amplitude — a Hopf bifurcation from the stationary spot solution.

**Mazes / labyrinths** (Mazes preset: F = 0.029, k = 0.057): Stripes that coarsen slowly, forming complex interconnected channel networks. These are far from any local equilibrium and evolve on long timescales; the "final" state can take thousands of diffusion times to settle. The Waves preset (F = 0.014, k = 0.045) produces a related oscillatory labyrinthine pattern.

**Holes** (Holes preset: F = 0.039, k = 0.058): The topological dual of spots — dark (v-depleted) holes in a high-v background. The Chaos & Holes preset (F = 0.034, k = 0.056) produces a turbulent mix of holes that nucleate and annihilate.

**Worms** (Worms preset: F = 0.078, k = 0.061): Extended filamentary structures that grow, branch, and fill the domain. These emerge from a small central seed and exhibit tip-splitting dynamics.

**Moving spots** (Moving Spots preset: F = 0.014, k = 0.054): Spots that translate, sometimes erratically. This regime is close to a Hopf bifurcation from the stationary spot solution. The Spots & Loops preset (F = 0.018, k = 0.051) produces spots that occasionally elongate into closed loops.

**Spatiotemporal chaos** (Chaos preset: F = 0.026, k = 0.051): Near certain boundaries in parameter space, solutions become chaotic — no long-time regularity despite deterministic dynamics. Patterns constantly nucleate, grow, and annihilate.

**U-Skate World** (F = 0.062, k = 0.06093): A special parameter set producing glider-like structures that move, interact, and persist. Named after a well-known parameter point in the Gray-Scott community that exhibits particularly rich dynamics with emergent "organisms."

The rich phase diagram arises because the (F, k) parameter plane is crossed by several codimension-1 bifurcation curves (saddle-node, Turing, Hopf), whose intersections create codimension-2 organizing centers that control nearby behavior. Brush-painting seeds onto a cleared field is an effective way to explore how initial conditions interact with these bifurcation structures — the same (F, k) values can produce different attractors depending on the seed geometry.
