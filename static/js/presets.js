export const PRESETS = {
    default: {
        name: 'Default',
        F: 0.037,
        k: 0.06,
        seed: 'scatteredCircles',
    },
    solitons: {
        name: 'Solitons',
        F: 0.03,
        k: 0.062,
        seed: 'scatteredCircles',
    },
    pulsatingSolitons: {
        name: 'Pulsating Solitons',
        F: 0.025,
        k: 0.06,
        seed: 'scatteredCircles',
    },
    worms: {
        name: 'Worms',
        F: 0.078,
        k: 0.061,
        seed: 'centralSquare',
    },
    mazes: {
        name: 'Mazes',
        F: 0.029,
        k: 0.057,
        seed: 'largeCentralBlock',
    },
    holes: {
        name: 'Holes',
        F: 0.039,
        k: 0.058,
        seed: 'scatteredCircles',
    },
    chaos: {
        name: 'Chaos',
        F: 0.026,
        k: 0.051,
        seed: 'scatteredCircles',
    },
    chaosAndHoles: {
        name: 'Chaos & Holes',
        F: 0.034,
        k: 0.056,
        seed: 'scatteredCircles',
    },
    movingSpots: {
        name: 'Moving Spots',
        F: 0.014,
        k: 0.054,
        seed: 'scatteredCircles',
    },
    spotsAndLoops: {
        name: 'Spots & Loops',
        F: 0.018,
        k: 0.051,
        seed: 'scatteredCircles',
    },
    waves: {
        name: 'Waves',
        F: 0.014,
        k: 0.045,
        seed: 'largeCentralBlock',
    },
    uSkateWorld: {
        name: 'U-Skate World',
        F: 0.062,
        k: 0.06093,
        seed: 'centralSquare',
    },
};

function generateSeed(type, numX, numY) {
    const size = numX * numY;
    const uData = new Float32Array(size);
    const vData = new Float32Array(size);

    uData.fill(1.0);

    if (type === 'centralSquare') {
        const halfW = Math.floor(numX * 0.1);
        const halfH = Math.floor(numY * 0.1);
        const cx = Math.floor(numX / 2);
        const cy = Math.floor(numY / 2);
        for (let i = cx - halfW; i <= cx + halfW; i++) {
            for (let j = cy - halfH; j <= cy + halfH; j++) {
                const idx = i * numY + j;
                uData[idx] = 0.5 + (Math.random() - 0.5) * 0.02;
                vData[idx] = 0.25 + (Math.random() - 0.5) * 0.02;
            }
        }
    } else if (type === 'largeCentralBlock') {
        const halfW = Math.floor(numX * 0.2);
        const halfH = Math.floor(numY * 0.2);
        const cx = Math.floor(numX / 2);
        const cy = Math.floor(numY / 2);
        for (let i = cx - halfW; i <= cx + halfW; i++) {
            for (let j = cy - halfH; j <= cy + halfH; j++) {
                const idx = i * numY + j;
                uData[idx] = 0.5 + (Math.random() - 0.5) * 0.02;
                vData[idx] = 0.25 + (Math.random() - 0.5) * 0.02;
            }
        }
    } else if (type === 'scatteredCircles') {
        const numCircles = 15;
        const minR = 3;
        const maxR = 5;
        for (let c = 0; c < numCircles; c++) {
            const cx = Math.floor(Math.random() * (numX - 20)) + 10;
            const cy = Math.floor(Math.random() * (numY - 20)) + 10;
            const r = minR + Math.floor(Math.random() * (maxR - minR + 1));
            for (let i = cx - r; i <= cx + r; i++) {
                for (let j = cy - r; j <= cy + r; j++) {
                    if (i < 0 || i >= numX || j < 0 || j >= numY) continue;
                    const dx = i - cx;
                    const dy = j - cy;
                    if (dx * dx + dy * dy <= r * r) {
                        const idx = i * numY + j;
                        uData[idx] = 0.5 + (Math.random() - 0.5) * 0.02;
                        vData[idx] = 0.25 + (Math.random() - 0.5) * 0.02;
                    }
                }
            }
        }
    }

    return { uData, vData };
}

export function loadPreset(name, solver) {
    const preset = PRESETS[name];
    const { numX, numY, device } = solver;

    solver.setParams({ F: preset.F, k: preset.k });

    const { uData, vData } = generateSeed(preset.seed, numX, numY);

    solver.resetFlipState();
    device.queue.writeBuffer(solver.u, 0, uData);
    device.queue.writeBuffer(solver.v, 0, vData);
    device.queue.writeBuffer(solver.uNew, 0, uData);
    device.queue.writeBuffer(solver.vNew, 0, vData);
}

export function clearField(solver) {
    const { numX, numY, device } = solver;
    const size = numX * numY;
    const uData = new Float32Array(size);
    const vData = new Float32Array(size);
    uData.fill(1.0);
    // vData is already all zeros

    solver.resetFlipState();
    device.queue.writeBuffer(solver.u, 0, uData);
    device.queue.writeBuffer(solver.v, 0, vData);
    device.queue.writeBuffer(solver.uNew, 0, uData);
    device.queue.writeBuffer(solver.vNew, 0, vData);
}
