import { Solver } from './solver.js';
import { Renderer } from './renderer.js';
import { loadPreset } from './presets.js';

async function init() {
    if (!navigator.gpu) {
        document.getElementById('no-webgpu').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
        return;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
        document.getElementById('no-webgpu').style.display = 'flex';
        document.getElementById('app').style.display = 'none';
        return;
    }
    const device = await adapter.requestDevice();

    const adapterInfo = adapter.info;
    const adapterName = adapterInfo.device || adapterInfo.description
        || [adapterInfo.vendor, adapterInfo.architecture].filter(Boolean).join(' ') || 'Unknown GPU';
    document.getElementById('gpu-adapter-name').textContent = adapterName;

    const overlay = document.getElementById('welcome-overlay');
    const dismissWelcome = () => {
        overlay.classList.add('welcome-hidden');
        overlay.addEventListener('transitionend', () => {
            overlay.style.display = 'none';
        }, { once: true });
    };
    document.getElementById('start-sim-btn').addEventListener('click', dismissWelcome);

    device.lost.then((info) => {
        console.error('GPU device lost:', info.message);
        document.getElementById('device-lost-banner').style.display = 'block';
    });

    const numX = 256;
    const numY = 256;

    const solver = await Solver.create(device, numX, numY);
    const container = document.getElementById('canvas-container');
    const renderer = new Renderer(container, device, solver);

    loadPreset('mitosis', solver);

    let substepsPerFrame = 16;

    let frameTimeSmoothed = 0;
    let hudCounter = 0;
    const perfHud = document.getElementById('perf-hud');

    function frame() {
        const t0 = performance.now();

        if (!solver.paused) {
            solver.step(substepsPerFrame);
        }
        renderer.draw();

        const frameTime = performance.now() - t0;
        frameTimeSmoothed = frameTimeSmoothed * 0.9 + frameTime * 0.1;
        hudCounter++;
        if (hudCounter % 10 === 0 && perfHud) {
            perfHud.textContent =
                frameTimeSmoothed.toFixed(1) + ' ms/frame | ' +
                Math.round(1000 / frameTimeSmoothed) + ' fps\n' +
                'grid: ' + solver.numX + '\u00D7' + solver.numY +
                ' | substeps: ' + substepsPerFrame;
        }

        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

init();
