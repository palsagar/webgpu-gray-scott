struct Params {
    numX : u32,
    numY : u32,
    Du   : f32,
    Dv   : f32,
    F    : f32,
    k    : f32,
    dt   : f32,
    pad  : u32,
}

@group(0) @binding(0) var<uniform> p : Params;
@group(0) @binding(1) var<storage, read>       uIn  : array<f32>;
@group(0) @binding(2) var<storage, read>       vIn  : array<f32>;
@group(0) @binding(3) var<storage, read_write> uOut : array<f32>;
@group(0) @binding(4) var<storage, read_write> vOut : array<f32>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) id : vec3u) {
    let i = id.x;
    let j = id.y;
    if (i >= p.numX || j >= p.numY) {
        return;
    }

    let idx = i * p.numY + j;
    let u = uIn[idx];
    let v = vIn[idx];

    // 5-point Laplacian with periodic boundary (modular arithmetic)
    let left  = ((i + p.numX - 1u) % p.numX) * p.numY + j;
    let right = ((i + 1u)          % p.numX) * p.numY + j;
    let up    = i * p.numY + (j + 1u)          % p.numY;
    let down  = i * p.numY + (j + p.numY - 1u) % p.numY;

    let lapU = uIn[left] + uIn[right] + uIn[up] + uIn[down] - 4.0 * u;
    let lapV = vIn[left] + vIn[right] + vIn[up] + vIn[down] - 4.0 * v;

    // Reaction: U + 2V -> 3V (autocatalytic)
    let uvv = u * v * v;

    // Forward Euler update
    uOut[idx] = u + p.dt * (p.Du * lapU - uvv + p.F * (1.0 - u));
    vOut[idx] = v + p.dt * (p.Dv * lapV + uvv - (p.F + p.k) * v);
}
