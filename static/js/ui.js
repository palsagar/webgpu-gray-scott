import { loadPreset, clearField, PRESETS } from './presets.js';

export class UI {
    constructor(solver, renderer, interaction) {
        this.solver = solver;
        this.renderer = renderer;
        this.interaction = interaction;

        this.currentPreset = 'mitosis';
        this.substepsPerFrame = 16;

        this._bindPresetButtons();
        this._bindSliders();
        this._bindPlayback();
        this._bindResolution();
        this._bindKeyboard();
    }

    _loadAndApplyPreset(presetKey) {
        this.currentPreset = presetKey;
        loadPreset(presetKey, this.solver);
        const preset = PRESETS[presetKey];
        const fSlider = document.getElementById('slider-f');
        const kSlider = document.getElementById('slider-k');
        if (fSlider) { fSlider.value = preset.F; document.getElementById('val-f').textContent = preset.F.toFixed(3); }
        if (kSlider) { kSlider.value = preset.k; document.getElementById('val-k').textContent = preset.k.toFixed(4); }
    }

    reapplyCurrentPreset() {
        this._loadAndApplyPreset(this.currentPreset);
    }

    _bindPresetButtons() {
        document.querySelectorAll('[data-preset]').forEach(btn => {
            btn.addEventListener('click', () => {
                const presetKey = btn.dataset.preset;
                if (!PRESETS[presetKey]) return;
                this._loadAndApplyPreset(presetKey);
                document.querySelectorAll('[data-preset]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    _bindSliders() {
        const fSlider = document.getElementById('slider-f');
        const kSlider = document.getElementById('slider-k');
        const substepsSlider = document.getElementById('slider-substeps');
        const brushSlider = document.getElementById('slider-brush');

        fSlider?.addEventListener('input', () => {
            const v = parseFloat(fSlider.value);
            document.getElementById('val-f').textContent = v.toFixed(3);
            this.solver.setParams({ F: v });
        });

        kSlider?.addEventListener('input', () => {
            const v = parseFloat(kSlider.value);
            document.getElementById('val-k').textContent = v.toFixed(4);
            this.solver.setParams({ k: v });
        });

        substepsSlider?.addEventListener('input', () => {
            this.substepsPerFrame = parseInt(substepsSlider.value);
            document.getElementById('val-substeps').textContent = this.substepsPerFrame;
        });

        brushSlider?.addEventListener('input', () => {
            this.interaction.brushRadius = parseInt(brushSlider.value);
            document.getElementById('val-brush').textContent = brushSlider.value;
        });
    }

    _bindPlayback() {
        const btnPlay  = document.getElementById('btn-play');
        const btnStep  = document.getElementById('btn-step');
        const btnReset = document.getElementById('btn-reset');

        const togglePause = () => {
            this.solver.paused = !this.solver.paused;
            if (btnPlay) btnPlay.textContent = this.solver.paused ? '\u25B6 Play' : '\u23F8 Pause';
        };

        const stepOnce = () => {
            if (this.solver.paused) {
                this.solver.step(this.substepsPerFrame);
                this.renderer.draw();
            }
        };

        btnPlay?.addEventListener('click', togglePause);
        btnStep?.addEventListener('click', stepOnce);
        btnReset?.addEventListener('click', () => this.reapplyCurrentPreset());

        const btnClear = document.getElementById('btn-clear');
        btnClear?.addEventListener('click', () => clearField(this.solver));

        this._togglePause = togglePause;
        this._stepOnce = stepOnce;
    }

    _bindResolution() {
        document.querySelectorAll('[data-res]').forEach(btn => {
            btn.addEventListener('click', () => {
                const res = parseInt(btn.dataset.res);
                this.solver.resize(res, res);
                this.renderer.resize(res, res);
                this.reapplyCurrentPreset();
                document.querySelectorAll('[data-res]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    _bindKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            switch (e.key) {
                case 'p': this._togglePause?.(); break;
                case 'm': this._stepOnce?.(); break;
                case 'r': this.reapplyCurrentPreset(); break;
                case 'c': clearField(this.solver); break;
            }
        });
    }
}
