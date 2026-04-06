export class Interaction {
    constructor(canvas, solver) {
        this.canvas = canvas;
        this.solver = solver;
        this.brushRadius = 5;
        this.painting = false;

        canvas.addEventListener('mousedown', (e) => this._onDown(e.clientX, e.clientY));
        canvas.addEventListener('mousemove', (e) => this._onMove(e.clientX, e.clientY));
        canvas.addEventListener('mouseup',   ()  => this._onUp());
        canvas.addEventListener('mouseleave', () => this._onUp());
    }

    screenToSim(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const mx = clientX - rect.left;
        const my = clientY - rect.top;
        const { numX, numY } = this.solver;
        const i = Math.floor(mx / rect.width * numX);
        const j = Math.floor((1.0 - my / rect.height) * numY);
        return { i, j };
    }

    _onDown(clientX, clientY) {
        this.painting = true;
        this._paint(clientX, clientY);
    }

    _onMove(clientX, clientY) {
        if (!this.painting) return;
        this._paint(clientX, clientY);
    }

    _onUp() {
        this.painting = false;
    }

    _paint(clientX, clientY) {
        const { i: ci, j: cj } = this.screenToSim(clientX, clientY);
        const { numX, numY, device } = this.solver;
        const r = this.brushRadius;

        for (let di = -r; di <= r; di++) {
            for (let dj = -r; dj <= r; dj++) {
                if (di * di + dj * dj > r * r) continue;
                const i = ci + di;
                const j = cj + dj;
                if (i < 0 || i >= numX || j < 0 || j >= numY) continue;
                const idx = i * numY + j;

                const uVal = new Float32Array([0.5]);
                const vVal = new Float32Array([0.5]);
                device.queue.writeBuffer(this.solver.u,    idx * 4, uVal);
                device.queue.writeBuffer(this.solver.uNew, idx * 4, uVal);
                device.queue.writeBuffer(this.solver.v,    idx * 4, vVal);
                device.queue.writeBuffer(this.solver.vNew, idx * 4, vVal);
            }
        }
    }
}
