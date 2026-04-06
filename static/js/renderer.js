export class Renderer {
    constructor(container, device, solver) {
        this.device = device;
        this.solver = solver;
        this.numX = solver.numX;
        this.numY = solver.numY;

        this.readbackPending = false;
        this.fieldData = null;
        this.colormapData = null;

        this._canvas = document.createElement('canvas');
        this._canvas.width = this.numX;
        this._canvas.height = this.numY;
        this._canvas.style.width = '100%';
        this._canvas.style.height = '100%';
        this._canvas.style.display = 'block';
        this._canvas.style.imageRendering = 'pixelated';
        container.appendChild(this._canvas);

        this._ctx = this._canvas.getContext('2d');
        this._imageData = this._ctx.createImageData(this.numX, this.numY);

        this._stagingBuffer = this._createStagingBuffer();

        this._loadColormap();
    }

    get canvas() {
        return this._canvas;
    }

    _createStagingBuffer() {
        return this.device.createBuffer({
            size: this.numX * this.numY * 4,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });
    }

    async _loadColormap() {
        const resp = await fetch('/colormaps/viridis.png');
        const blob = await resp.blob();
        const bitmap = await createImageBitmap(blob);
        const offscreen = document.createElement('canvas');
        offscreen.width = 256;
        offscreen.height = 1;
        const ctx = offscreen.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        this.colormapData = new Uint8Array(ctx.getImageData(0, 0, 256, 1).data.buffer);
    }

    draw() {
        const { device, solver } = this;

        if (!this.readbackPending) {
            this.readbackPending = true;
            const encoder = device.createCommandEncoder();
            encoder.copyBufferToBuffer(solver.vBuffer, 0, this._stagingBuffer, 0, this.numX * this.numY * 4);
            device.queue.submit([encoder.finish()]);

            this._stagingBuffer.mapAsync(GPUMapMode.READ).then(() => {
                const raw = this._stagingBuffer.getMappedRange();
                this.fieldData = new Float32Array(raw.slice(0));
                this._stagingBuffer.unmap();
                this.readbackPending = false;
            }).catch(() => { this.readbackPending = false; });
        }

        if (this.fieldData) {
            this._renderField(this.fieldData);
        }
    }

    _renderField(data) {
        const { numX, numY } = this;
        const cmap = this.colormapData;
        const pixels = this._imageData.data;

        for (let j = 0; j < numY; j++) {
            for (let i = 0; i < numX; i++) {
                const idx = i * numY + j;
                const pixelIdx = ((numY - 1 - j) * numX + i) * 4;
                const v = data[idx];
                const t = Math.max(0, Math.min(1, v));

                if (cmap) {
                    const lutIdx = Math.floor(t * 255) * 4;
                    pixels[pixelIdx]     = cmap[lutIdx];
                    pixels[pixelIdx + 1] = cmap[lutIdx + 1];
                    pixels[pixelIdx + 2] = cmap[lutIdx + 2];
                    pixels[pixelIdx + 3] = 255;
                } else {
                    const gray = Math.floor(t * 255);
                    pixels[pixelIdx]     = gray;
                    pixels[pixelIdx + 1] = gray;
                    pixels[pixelIdx + 2] = gray;
                    pixels[pixelIdx + 3] = 255;
                }
            }
        }

        this._ctx.putImageData(this._imageData, 0, 0);
    }

    resize(numX, numY) {
        this._stagingBuffer.destroy();
        this.numX = numX;
        this.numY = numY;
        this._canvas.width = numX;
        this._canvas.height = numY;
        this._imageData = this._ctx.createImageData(numX, numY);
        this._stagingBuffer = this._createStagingBuffer();
        this.fieldData = null;
    }
}
