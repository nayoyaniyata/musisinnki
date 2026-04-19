    let gameSettings = { bgmVol: 30, seVol: 40, titleBgm: "https://github.com/nayoyaniyata/-BGM/raw/refs/heads/main/After_Midnight.mp3", battleBgm: "https://raw.githubusercontent.com/nayoyaniyata/musisinnki-BGM-START-/main/Break_the_Shell.mp3" };

    // === Settings Persistence (BGM/SE volume & BGM selections) ===
    const SETTINGS_STORAGE_KEY = "mushi_settings_v1";

    function loadSettingsFromStorage() {
        try {
            const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
            if(!raw) return;
            const obj = JSON.parse(raw);
            if(!obj || typeof obj !== 'object') return;
            // merge only known keys
            if(typeof obj.bgmVol !== 'undefined') gameSettings.bgmVol = Number(obj.bgmVol);
            if(typeof obj.seVol  !== 'undefined') gameSettings.seVol  = Number(obj.seVol);
            if(typeof obj.titleBgm === 'string') gameSettings.titleBgm = obj.titleBgm;
            if(typeof obj.battleBgm === 'string') gameSettings.battleBgm = obj.battleBgm;
        } catch(e) { /* ignore */ }
    }

    function saveSettingsToStorage() {
        try { localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(gameSettings)); } catch(e) { /* ignore */ }
    }

    function syncSettingsUI() {
        // sliders（順番: BGM -> SE）
        const ranges = document.querySelectorAll('#modal-settings input[type="range"]');
        if (ranges && ranges.length >= 1) ranges[0].value = String(gameSettings.bgmVol);
        if (ranges && ranges.length >= 2) ranges[1].value = String(gameSettings.seVol);

        // battle BGM selector
        const sel = document.getElementById('bgm-selector');
        if (sel) {
            // valueが存在しない場合は最初の選択肢にフォールバック
            const exists = Array.from(sel.options).some(o => o.value === gameSettings.battleBgm);
            sel.value = exists ? gameSettings.battleBgm : (sel.options[0]?.value ?? gameSettings.battleBgm);
            if (!exists) gameSettings.battleBgm = sel.value;
        }
    }

    // load at startup (before first UI interaction)
    loadSettingsFromStorage();

    // === アカウント画面オープン専用SE ===
    // SE1: 緑の四角が大きくなっている間（transition 0.55sに合わせた長さ）
    function _playAccountSE1() {
        if (typeof AudioSys === 'undefined' || !AudioSys.ctx) return;
        const ctx = AudioSys.ctx;
        if (ctx.state === 'suspended') ctx.resume();
        const vol = (typeof gameSettings !== 'undefined') ? (gameSettings.seVol / 100) : 0.5;
        const dur = 0.55; // CSS transitionと同じ長さ
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + dur);
        gain.gain.setValueAtTime(vol * 0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + dur);
    }

    // SE2: 大きくなり切った瞬間（アカウント画面が表示される時）
    function _playAccountSE2() {
        if (typeof AudioSys === 'undefined' || !AudioSys.ctx) return;
        const ctx = AudioSys.ctx;
        if (ctx.state === 'suspended') ctx.resume();
        const vol = (typeof gameSettings !== 'undefined') ? (gameSettings.seVol / 100) : 0.5;
        const dur = 0.15;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + dur);
        gain.gain.setValueAtTime(vol * 0.5, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + dur);
    }
