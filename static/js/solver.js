export class Solver {
    constructor(device, numX, numY) {
        this.device = device;
        this.numX = numX;
        this.numY = numY;
        this.paused = false;
        this._flip = false;

        this.params = { Du: 0.2097, Dv: 0.105, F: 0.028, k: 0.062, dt: 1.0 };

        this._createBuffers();
    }

    _createBuffers() {
        const { device, numX, numY } = this;
        const size = numX * numY * 4;
        const storageUsage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST;

        this.u    = device.createBuffer({ size, usage: storageUsage });
        this.v    = device.createBuffer({ size, usage: storageUsage });
        this.uNew = device.createBuffer({ size, usage: storageUsage });
        this.vNew = device.createBuffer({ size, usage: storageUsage });

        this.uniformBuf = device.createBuffer({
            size: 32,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
    }

    writeUniforms() {
        const { numX, numY } = this;
        const p = this.params;
        const ab = new ArrayBuffer(32);
        const dv = new DataView(ab);
        dv.setUint32(0,  numX,  true);
        dv.setUint32(4,  numY,  true);
        dv.setFloat32(8,  p.Du, true);
        dv.setFloat32(12, p.Dv, true);
        dv.setFloat32(16, p.F,  true);
        dv.setFloat32(20, p.k,  true);
        dv.setFloat32(24, p.dt, true);
        dv.setUint32(28, 0,     true);
        this.device.queue.writeBuffer(this.uniformBuf, 0, ab);
    }

    destroy() {
        this.u.destroy();
        this.v.destroy();
        this.uNew.destroy();
        this.vNew.destroy();
        this.uniformBuf.destroy();
    }

    static async create(device, numX, numY) {
        const solver = new Solver(device, numX, numY);

        const wgsl = await fetch('/shaders/gray-scott.wgsl').then(r => r.text());
        const module = device.createShaderModule({ code: wgsl });

        const UNIFORM    = 'uniform';
        const RO_STORAGE = 'read-only-storage';
        const STORAGE    = 'storage';

        const bglEntry = (binding, type) => ({
            binding,
            visibility: GPUShaderStage.COMPUTE,
            buffer: { type },
        });

        solver._bgl = device.createBindGroupLayout({
            entries: [
                bglEntry(0, UNIFORM),
                bglEntry(1, RO_STORAGE),
                bglEntry(2, RO_STORAGE),
                bglEntry(3, STORAGE),
                bglEntry(4, STORAGE),
            ],
        });

        solver._pipeline = device.createComputePipeline({
            layout: device.createPipelineLayout({ bindGroupLayouts: [solver._bgl] }),
            compute: { module, entryPoint: 'main' },
        });

        solver._createBindGroups();
        solver.writeUniforms();

        return solver;
    }

    _createBindGroups() {
        const { device, _bgl: layout } = this;
        const entry = (binding, buffer) => ({ binding, resource: { buffer } });

        this._bindGroupA = device.createBindGroup({
            layout,
            entries: [
                entry(0, this.uniformBuf),
                entry(1, this.u),
                entry(2, this.v),
                entry(3, this.uNew),
                entry(4, this.vNew),
            ],
        });

        this._bindGroupB = device.createBindGroup({
            layout,
            entries: [
                entry(0, this.uniformBuf),
                entry(1, this.uNew),
                entry(2, this.vNew),
                entry(3, this.u),
                entry(4, this.v),
            ],
        });

        this._flip = false;
    }

    step(substeps) {
        this.writeUniforms();
        const { device, numX, numY } = this;
        const dx = Math.ceil(numX / 8);
        const dy = Math.ceil(numY / 8);
        const encoder = device.createCommandEncoder();

        for (let s = 0; s < substeps; s++) {
            const pass = encoder.beginComputePass();
            pass.setPipeline(this._pipeline);
            pass.setBindGroup(0, this._flip ? this._bindGroupB : this._bindGroupA);
            pass.dispatchWorkgroups(dx, dy, 1);
            pass.end();
            this._flip = !this._flip;
        }

        device.queue.submit([encoder.finish()]);
    }

    get vBuffer() {
        return this._flip ? this.vNew : this.v;
    }

    get uBuffer() {
        return this._flip ? this.uNew : this.u;
    }

    resetFlipState() {
        this._flip = false;
    }

    setParams(overrides) {
        Object.assign(this.params, overrides);
        this.writeUniforms();
    }

    resize(numX, numY) {
        this.destroy();
        this.numX = numX;
        this.numY = numY;
        this._createBuffers();
        this._createBindGroups();
        this.writeUniforms();
    }
}
