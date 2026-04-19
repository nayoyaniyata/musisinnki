// ===== カード配置演出（大きいカードが落ちてくる） =====
function animateCardPlace(slotEl, cardImg) {
    if (!slotEl) return;
    const container = document.getElementById('game-container');
    if (!container) return;

    const slotRect = slotEl.getBoundingClientRect();
    const contRect = container.getBoundingClientRect();

    const cx = slotRect.left - contRect.left + slotRect.width  / 2;
    const cy = slotRect.top  - contRect.top  + slotRect.height / 2;

    const W = slotRect.width  * 2.2;
    const H = slotRect.height * 2.2;

    const ghost = document.createElement('div');
    ghost.style.cssText = `
        position:absolute;
        width:${W}px;height:${H}px;
        border-radius:10px;overflow:hidden;
        pointer-events:none;z-index:600;
        box-shadow:0 12px 40px rgba(0,0,0,0.85),0 0 24px rgba(255,255,255,0.25);
        transform-origin:center center;
        will-change:transform,opacity;
    `;
    const src = cardImg || (() => { const im = slotEl.querySelector('img.card-full-img'); return im ? im.src : ''; })();
    if (src) ghost.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;display:block;">`;
    container.appendChild(ghost);

    // フェーズ1: 上空から回転しながら急落下（0→60%）
    // フェーズ2: 着地後に少しバウンド＋フラッシュ（60%→100%）
    const dur = 380;
    const startRot = (Math.random() > 0.5 ? 1 : -1) * (25 + Math.random() * 15); // ±25〜40deg
    const start = performance.now();

    // 着地時フラッシュ用オーバーレイ
    const flash = document.createElement('div');
    flash.style.cssText = `position:absolute;inset:0;background:rgba(255,255,255,0);pointer-events:none;z-index:601;border-radius:inherit;`;
    ghost.appendChild(flash);

    let impacted = false;

    (function tick(now) {
        const t = Math.min((now - start) / dur, 1);

        // easeInCubic で急加速落下
        const eIn = t < 0.6 ? (t / 0.6) : 1;
        const fall = eIn * eIn * eIn;

        // スケール：2.2 → 1.0（落下中）→ 1.08（バウンド）→ 1.0（静止）
        let scale;
        if (t < 0.6) {
            scale = 2.2 - 1.2 * fall;
        } else {
            const bt = (t - 0.6) / 0.4; // 0→1 during bounce
            const bounce = Math.sin(bt * Math.PI); // 0→1→0
            scale = 1.0 + 0.08 * bounce;
        }

        // 回転：落下中に回転→着地でピタッと0deg
        const rot = t < 0.6 ? startRot * (1 - fall) : 0;

        // Y位置：上から落ちてくる
        const dropOffset = (1 - fall) * 70;

        const curW = slotRect.width  * scale;
        const curH = slotRect.height * scale;
        ghost.style.left      = (cx - curW / 2) + 'px';
        ghost.style.top       = (cy - curH / 2 - dropOffset) + 'px';
        ghost.style.width     = curW + 'px';
        ghost.style.height    = curH + 'px';
        ghost.style.transform = `rotate(${rot}deg)`;
        ghost.style.opacity   = t < 0.1 ? String(t / 0.1) : '1';

        // 着地の瞬間（t≈0.6）にフラッシュ＋画面シェイク
        if (!impacted && t >= 0.6) {
            impacted = true;
            flash.style.transition = 'background 0.08s';
            flash.style.background = 'rgba(255,255,255,0.7)';
            setTimeout(() => { flash.style.background = 'rgba(255,255,255,0)'; }, 80);

            // 画面シェイク
            const shakeEl = document.getElementById('shake-wrapper') || container;
            let sk = 0;
            const shakeStart = performance.now();
            (function shaking(sn) {
                sk++;
                if (sk > 8) { shakeEl.style.transform = ''; return; }
                const mag = 6 * (1 - sk / 8);
                shakeEl.style.transform = `translate(${(Math.random()-0.5)*mag*2}px,${(Math.random()-0.5)*mag*2}px)`;
                requestAnimationFrame(shaking);
            })(shakeStart);
        }

        if (t < 1) {
            requestAnimationFrame(tick);
        } else {
            ghost.remove();
        }
    })(start);
}

function hideTurnMsgIfMyTurn() {
    const msg = document.getElementById('turn-msg');
    if (!msg) return;
    // 自分のターン表示が出ている間（不透明）のクリックでフェードアウト
    if (state && state.currentPlayer === 1 && msg.style.opacity !== "0") {
        msg.style.opacity = 0; // CSS transitionで徐々に消える
    }
}


    const AudioSys = {
        ctx: null, bgmAudio: null, 
        init: function() {
            if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; this.ctx = new AC(); }
            if (this.ctx.state === 'suspended') this.ctx.resume();
        },
        playBGM: function(url) {
            this.init(); this.stopBGM(); 
            this.bgmAudio = new Audio(); this.bgmAudio.src = url; this.bgmAudio.loop = true;
            this.bgmAudio.volume = (gameSettings.bgmVol / 100) * 0.3;
            const pp = this.bgmAudio.play(); if (pp !== undefined) pp.catch(e => console.log("Click to play"));
        },
        stopBGM: function() { if (this.bgmAudio) { this.bgmAudio.pause(); this.bgmAudio = null; } },
        updateVolumes: function() { if (this.bgmAudio) this.bgmAudio.volume = (gameSettings.bgmVol / 100) * 0.3; },
        playSE: function(type) {
            this.init();
            const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
            osc.connect(gain); gain.connect(this.ctx.destination);
            const now = this.ctx.currentTime; const vol = (gameSettings.seVol / 100);
            switch(type) {
                case 'hover': osc.type='sine'; osc.frequency.setValueAtTime(800,now); gain.gain.setValueAtTime(0.03*vol,now); osc.start(now); osc.stop(now+0.05); break;
                case 'click': case 'decide': osc.type='triangle'; osc.frequency.setValueAtTime(600,now); gain.gain.setValueAtTime(0.05*vol,now); osc.start(now); osc.stop(now+0.1); break;
                case 'place': osc.type='sine'; osc.frequency.setValueAtTime(220,now); gain.gain.setValueAtTime(0.1*vol,now); osc.start(now); osc.stop(now+0.1); break;
                case 'damage': osc.type='square'; osc.frequency.setValueAtTime(100,now); gain.gain.setValueAtTime(0.1*vol,now); osc.start(now); osc.stop(now+0.2); break;
                case 'draw': osc.type='triangle'; osc.frequency.setValueAtTime(400,now); gain.gain.setValueAtTime(0.05*vol,now); osc.start(now); osc.stop(now+0.05); break;
                case 'janken_pon': osc.type='sawtooth'; osc.frequency.setValueAtTime(500,now); gain.gain.setValueAtTime(0.05*vol,now); osc.start(now); osc.stop(now+0.1); break;
                case 'cancel': osc.type='square'; osc.frequency.setValueAtTime(150,now); gain.gain.setValueAtTime(0.05*vol,now); osc.start(now); osc.stop(now+0.1); break;
                case 'shuffle': osc.type='sawtooth'; osc.frequency.linearRampToValueAtTime(800,now+0.2); gain.gain.setValueAtTime(0.04*vol,now); osc.start(now); osc.stop(now+0.2); break;
                case 'count_down': osc.type='square'; osc.frequency.setValueAtTime(800,now); gain.gain.setValueAtTime(0.05*vol,now); osc.start(now); osc.stop(now+0.1); break;

                // ===== 必殺専用SE =====
                // C(攻撃必殺): 重低音ドン + 上昇スイープ
                case 'ultC': {
    // 🎮 ド派手覚醒波紋SE（エネルギー集中→拡散）
    const rise = this.ctx.createOscillator();
    const riseGain = this.ctx.createGain();
    rise.type = 'sawtooth';
    rise.frequency.setValueAtTime(220, now);
    rise.frequency.exponentialRampToValueAtTime(1200, now+0.25);
    riseGain.gain.setValueAtTime(0.0001, now);
    riseGain.gain.exponentialRampToValueAtTime(0.35*vol, now+0.05);
    riseGain.gain.exponentialRampToValueAtTime(0.0001, now+0.35);
    rise.connect(riseGain); riseGain.connect(this.ctx.destination);
    rise.start(now); rise.stop(now+0.4);

    // エネルギー拡散ノイズ
    const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate*0.4, this.ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for(let i=0;i<data.length;i++){ data[i] = Math.random()*2-1; }
    const noise = this.ctx.createBufferSource();
    const noiseGain = this.ctx.createGain();
    noise.buffer = noiseBuffer;
    noiseGain.gain.setValueAtTime(0.0001, now+0.1);
    noiseGain.gain.exponentialRampToValueAtTime(0.25*vol, now+0.15);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now+0.5);
    noise.connect(noiseGain); noiseGain.connect(this.ctx.destination);
    noise.start(now+0.1); noise.stop(now+0.5);
    break;
}
                // B(能力/擬態): チャイム2音
                case 'ultB': {
    // 🎮 ド派手能力覚醒SE（スパーク系）
    const spark1 = this.ctx.createOscillator();
    const g1 = this.ctx.createGain();
    spark1.type = 'square';
    spark1.frequency.setValueAtTime(900, now);
    spark1.frequency.exponentialRampToValueAtTime(1500, now+0.15);
    g1.gain.setValueAtTime(0.0001, now);
    g1.gain.exponentialRampToValueAtTime(0.3*vol, now+0.02);
    g1.gain.exponentialRampToValueAtTime(0.0001, now+0.25);
    spark1.connect(g1); g1.connect(this.ctx.destination);
    spark1.start(now); spark1.stop(now+0.3);

    const spark2 = this.ctx.createOscillator();
    const g2 = this.ctx.createGain();
    spark2.type = 'triangle';
    spark2.frequency.setValueAtTime(600, now+0.05);
    spark2.frequency.exponentialRampToValueAtTime(1400, now+0.2);
    g2.gain.setValueAtTime(0.0001, now+0.05);
    g2.gain.exponentialRampToValueAtTime(0.25*vol, now+0.08);
    g2.gain.exponentialRampToValueAtTime(0.0001, now+0.35);
    spark2.connect(g2); g2.connect(this.ctx.destination);
    spark2.start(now+0.05); spark2.stop(now+0.4);
    break;
}

            }
        }
    };
    function initAudio() { AudioSys.init(); if (!AudioSys.bgmAudio) AudioSys.playBGM(gameSettings.titleBgm); }
    function playSE(t) { AudioSys.playSE(t); }
    window.playSE = playSE;
    
    
// ===== 旧技名(#skill-display)制御 =====
let __cutinLegacySkillLock = 0;
function __setLegacySkillDisplayVisible(visible){
    const sd = document.getElementById('skill-display');
    if(!sd) return;
    if(visible){
        sd.style.display = 'block';
        sd.style.opacity = '';
    }else{
        sd.innerText = '';
        sd.classList.remove('skill-anim');
        sd.style.display = 'none';
        sd.style.opacity = '0';
    }
}
function __lockLegacySkillDisplay(){
    __cutinLegacySkillLock++;
    __setLegacySkillDisplayVisible(false);
}
function __unlockLegacySkillDisplay(){
    __cutinLegacySkillLock = Math.max(0, __cutinLegacySkillLock-1);
    if(__cutinLegacySkillLock===0){
        // 弱技のときは元の処理で表示されるので、ここでは display を戻すだけ
        __setLegacySkillDisplayVisible(true);
    }
}

function chooseUltimateStyle(skill){
    if(!skill) return null;
    // 攻撃以外（擬態など）→ B
    if(skill.ability || !(typeof skill.atk === 'number') || skill.atk <= 0) return 'B';
    // 攻撃技：30以上だけ特別演出（新C）※弱い攻撃は元の技名演出のみ
    if(typeof skill.atk === 'number' && skill.atk >= 30) return 'C';
    return null;
}

function playUltimateCutinB(skillName){
    try{ playSE('ultC'); }catch(e){}
document.body.classList.add('hide-skill-name');
    __lockLegacySkillDisplay();
    const wrap = document.createElement('div');
    wrap.className = 'ultB-wrap';
    wrap.innerHTML = `
      <div class="ultB-dim"></div>
      <div class="ultB-lines"></div>
      <div class="ultB-panel"></div>
      <div class="ultB-text">【 ${skillName} 】</div>
    `;
    document.body.appendChild(wrap);

    const gc = document.getElementById('shake-wrapper');
    if(gc){
      gc.classList.add('screen-shake-ultB');
      setTimeout(()=>gc.classList.remove('screen-shake-ultB'), 260);
    }
    setTimeout(()=>{ wrap.remove(); document.body.classList.remove('hide-skill-name'); __unlockLegacySkillDisplay(); }, 800);
}

function playUltimateCutinC(skillName){
    try{ playSE('ultC'); }catch(e){}
document.body.classList.add('hide-skill-name');
    __lockLegacySkillDisplay();

    const freeze = document.createElement('div');
    freeze.className = 'ultC-freeze';
    document.body.appendChild(freeze);

    const ring = document.createElement('div');
    ring.className = 'ultC-ring';
    document.body.appendChild(ring);

    const title = document.createElement('div');
    title.className = 'ultC-title';
    title.textContent = `【 ${skillName} 】`;
    document.body.appendChild(title);

    const gc = document.getElementById('shake-wrapper');
    if(gc){
      const prev = gc.style.filter;
      gc.style.filter = 'contrast(1.15) saturate(1.1)';
      setTimeout(()=>{ gc.style.filter = prev; }, 540);
    }

    setTimeout(()=>{ freeze.remove(); ring.remove(); title.remove(); document.body.classList.remove('hide-skill-name'); __unlockLegacySkillDisplay(); }, 1000);
}

// 互換：既存呼び出しは playCoolUltimate(skill.name, skill) 推奨
function playCoolUltimate(skillName, skillObj=null){
    try{
        const style = chooseUltimateStyle(skillObj);
        if(style === 'B') return playUltimateCutinB(skillName);
        if(style === 'C') return playUltimateCutinC(skillName);
    }catch(e){ console.warn(e); }
}

    const BUG_MASTER = [
        { name: "エゾゼミ♀", hp: 70, img: "エゾゼミ♀.png", maxHp: 70,
          activity: "昼行性", family: "セミ科", zones: ["山地帯"], seasons: ["夏","秋"], sex: "♀", rare: 4,
          skills: [{name: "翅で打つ", atk: 20}, {name: "突進", atk: 30, recoil: 10}] },

        { name: "オオミズアオ♂", hp: 80, img: "オオミズアオ♂.png", maxHp: 80,
          activity: "夜行性", family: "ヤママユガ科", zones: ["山地帯", "丘陵帯"], seasons: ["夏"], sex: "♂", rare: 3,
          reduction: 10, skills: [{name: "ミズアオの舞", atk: 40}] },

        { name: "カブトムシ♀", hp: 80, img: "カブトムシ♀.png", maxHp: 80,
          activity: "夜行性", family: "コガネムシ科", zones: ["丘陵帯"], seasons: ["夏","秋"], sex: "♀", rare: 2,
          teamBuff: "樹液の常連", skills: [{name: "たいあたり", atk: 30}] },

        { name: "コクワガタ♂", hp: 50, img: "コクワガタ♂.png", maxHp: 50,
          activity: "夜行性", family: "クワガタムシ科", zones: ["山地帯","丘陵帯"], seasons: ["夏"], sex: "♂", rare: 2,
          teamBuff: "樹液の常連", skills: [{name: "投げ飛ばす", atk: 30}] },

        { name: "シンジュサン♂", hp: 90, img: "シンジュサン♂.png", maxHp: 90,
          activity: "夜行性", family: "ヤママユガ科", zones: ["山地帯","丘陵帯"], seasons: ["夏","秋"], sex: "♂", rare: 4,
          reduction: 20, skills: [{name: "シンジュの舞", atk: 40}] },

        { name: "スズムシ♀", hp: 30, img: "スズムシ♀.png", maxHp: 30,
          activity: "夜行性", family: "コオロギ科", zones: ["丘陵帯"], seasons: ["夏","秋"], sex: "♀", rare: 4,
          skills: [{name: "噛む", atk: 10}, {name: "突進", atk: 20, recoil: 10}] },

        { name: "ナナフシモドキ♀", hp: 30, img: "ナナフシモドキ♀.png", maxHp: 30,
          activity: "夜行性", family: "ナナフシ科", zones: ["丘陵帯"], seasons: ["夏","秋"], sex: "♀", rare: 2,
          skills: [{name: "擬態", atk: 0, ability: "擬態"}, {name: "たいあたり", atk: 10}] },

        { name: "ヤママユ♀", hp: 110, img: "ヤママユ♀.png", maxHp: 110,
          activity: "夜行性", family: "ヤママユガ科", zones: ["山地帯","丘陵帯"], seasons: ["夏","秋"], sex: "♀", rare: 4,
          reduction: 10, skills: [{name: "ヤママユの舞", atk: 40}] },

        { name: "ヤママユ♂", hp: 100, img: "ヤママユ♂.png", maxHp: 100,
          activity: "夜行性", family: "ヤママユガ科", zones: ["山地帯","丘陵帯"], seasons: ["夏","秋"], sex: "♂", rare: 3,
          reduction: 10, skills: [{name: "ヤママユの舞", atk: 40}] },
    
        // ===== 追加カード(9枚) =====
        { name: "ムラサキシタバ♂", hp: 70, img: "ムラサキシタバ♂.png", maxHp: 70,
          activity: "夜行性", family: "ヤガ科", zones: ["山地帯"], seasons: ["夏","秋"], sex: "♂", rare: 5,
          thorns: 10, trait: "下翅の輝き",
          skills: [{name: "紫の閃光", atk: 50, bonusTrait: "下翅の輝き", bonusCount: 2, bonusDmg: 40}] },

        { name: "オオシロシタバ♀", hp: 50, img: "オオシロシタバ♀.png", maxHp: 50,
          activity: "夜行性", family: "ヤガ科", zones: ["山地帯","丘陵帯"], seasons: ["夏","秋"], sex: "♀", rare: 4,
          thorns: 10, trait: "下翅の輝き",
          skills: [{name: "突進", atk: 20, recoil: 10}] },

        { name: "シロシタバ♂", hp: 70, img: "シロシタバ♂.png", maxHp: 70,
          activity: "夜行性", family: "ヤガ科", zones: ["山地帯"], seasons: ["夏","秋"], sex: "♂", rare: 3,
          thorns: 10, trait: "下翅の輝き",
          skills: [{name: "鱗粉撒き", atk: 10, allEnemies: true}] },

        { name: "クスサン♂", hp: 80, img: "クスサン♂.png", maxHp: 80,
          activity: "夜行性", family: "ヤママユガ科", zones: ["山地帯","丘陵帯"], seasons: ["秋"], sex: "♂", rare: 3,
          reduction: 10, trait: "眼状紋",
          skills: [{name: "クスサンの舞", atk: 40}] },

        { name: "クスサン♀", hp: 90, img: "クスサン♀.png", maxHp: 90,
          activity: "夜行性", family: "ヤママユガ科", zones: ["山地帯","丘陵帯"], seasons: ["秋"], sex: "♀", rare: 3,
          reduction: 10, trait: "眼状紋",
          skills: [{name: "クスサンの舞", atk: 40}] },

        { name: "クロウスタビガ♂", hp: 60, img: "クロウスタビガ♂.png", maxHp: 60,
          activity: "夜行性", family: "ヤママユガ科", zones: ["山地帯"], seasons: ["秋"], sex: "♂", rare: 5,
          reduction: 10, trait: "眼状紋",
          skills: [{name: "クロウスの舞", atk: 30, ignoreEyeSpot: true}] },

        { name: "クロウスタビガ♀", hp: 70, img: "クロウスタビガ♀.png", maxHp: 70,
          activity: "夜行性", family: "ヤママユガ科", zones: ["山地帯"], seasons: ["秋"], sex: "♀", rare: 5,
          reduction: 10, trait: "眼状紋",
          skills: [{name: "クロウスの舞", atk: 30, ignoreEyeSpot: true}] },

        { name: "ヒメヤママユ♀", hp: 70, img: "ヒメヤママユ♀.png", maxHp: 70,
          activity: "夜行性", family: "ヤママユガ科", zones: ["山地帯","丘陵帯"], seasons: ["秋"], sex: "♀", rare: 3,
          reduction: 10, trait: "眼状紋",
          skills: [{name: "ヒメヤマの舞", atk: 30}] },

        { name: "トノサマバッタ♂", hp: 70, img: "トノサマバッタ♂.png", maxHp: 70,
          activity: "昼行性", family: "バッタ科", zones: ["山地帯","丘陵帯"], seasons: ["夏","秋"], sex: "♂", rare: 2,
          grassKing: true, trait: "バッタの王",
          skills: [{name: "飛翔突進", atk: 40, recoil: 20}] },

        // ===== 追加カード v2（9枚） =====
        { name: "ヒメヤママユ♂", hp: 60, img: "ヒメヤママユ♂.png", maxHp: 60,
          activity: "夜行性", family: "ヤママユガ科", zones: ["山地帯","丘陵帯"], seasons: ["秋"], sex: "♂", rare: 3,
          reduction: 10, trait: "眼状紋",
          skills: [{name: "ヒメヤマの舞", atk: 30}] },

        { name: "コクワガタ♀", hp: 40, img: "コクワガタ♀.png", maxHp: 40,
          activity: "夜行性", family: "クワガタムシ科", zones: ["山地帯","丘陵帯"], seasons: ["夏"], sex: "♀", rare: 2,
          teamBuff: "樹液の常連",
          skills: [{name: "たいあたり", atk: 20}] },

        { name: "ウスタビガ♂", hp: 60, img: "ウスタビガ♂.png", maxHp: 60,
          activity: "夜行性", family: "ヤママユガ科", zones: ["山地帯","丘陵帯"], seasons: ["秋"], sex: "♂", rare: 3,
          reduction: 10, trait: "眼状紋",
          skills: [{name: "ウスタビの舞", atk: 30}] },

        { name: "ウスタビガ♀", hp: 70, img: "ウスタビガ♀.png", maxHp: 70,
          activity: "夜行性", family: "ヤママユガ科", zones: ["山地帯","丘陵帯"], seasons: ["秋"], sex: "♀", rare: 3,
          reduction: 10, trait: "眼状紋",
          skills: [{name: "ウスタビの舞", atk: 30}] },

        { name: "ミヤマクワガタ♂", hp: 70, img: "ミヤマクワガタ♂.png", maxHp: 70,
          activity: "昼行性/夜行性", family: "クワガタムシ科", zones: ["山地帯"], seasons: ["夏"], sex: "♂", rare: 3,
          deepMountain: true, trait: "深山の恵み",
          skills: [{name: "投げ飛ばす", atk: 30}] },

        { name: "ミヤマクワガタ♀", hp: 60, img: "ミヤマクワガタ♀.png", maxHp: 60,
          activity: "昼行性/夜行性", family: "クワガタムシ科", zones: ["山地帯"], seasons: ["夏"], sex: "♀", rare: 3,
          deepMountain: true, trait: "深山の恵み",
          skills: [{name: "たいあたり", atk: 20}] },

        { name: "ノコギリクワガタ♂", hp: 70, img: "ノコギリクワガタ♂.png", maxHp: 70,
          activity: "昼行性/夜行性", family: "クワガタムシ科", zones: ["山地帯","丘陵帯"], seasons: ["夏"], sex: "♂", rare: 2,
          sawJaw: true, trait: "鋸の大顎",
          skills: [{name: "投げ飛ばす", atk: 30}] },

        { name: "ノコギリクワガタ♀", hp: 60, img: "ノコギリクワガタ♀.png", maxHp: 60,
          activity: "昼行性/夜行性", family: "クワガタムシ科", zones: ["山地帯","丘陵帯"], seasons: ["夏"], sex: "♀", rare: 2,
          skills: [{name: "たいあたり", atk: 20}, {name: "突進", atk: 30, recoil: 10}] },

        { name: "ヒメアケビコノハ♂", hp: 60, img: "ヒメアケビコノハ♂.png", maxHp: 60,
          activity: "夜行性", family: "ヤガ科", zones: ["丘陵帯"], seasons: ["夏","秋"], sex: "♂", rare: 4,
          deathMigration: true, trait: "死滅回遊",
          skills: [{name: "コノハの舞", atk: 30}] },
          
        { name:"アイテムテスト", hp:0, maxHp:0, img:"アイテムテスト.png",
        　activity:null, family:null, zones:[], seasons:[], sex:null, rare:1, type:"item", itemSubtype:"quick",
        　skills:[] },

        { name:"蚊取り線香", hp:0, maxHp:0, img:"蚊取り線香.png",
          activity:null, family:null, zones:[], seasons:[], sex:null, rare:1, type:"item", itemSubtype:"install",
          skills:[] },
          
        { name:"環境テスト", hp:0, maxHp:0, img:"環境テスト.png",
        　activity:null, family:null, zones:[], seasons:[], sex:null, rare:1, type:"environment",
        　skills:[] },
        
        { name:"天気テスト", hp:0, maxHp:0, img:"天気テスト.png",
        　activity:null, family:null, zones:[], seasons:[], sex:null, rare:1, type:"weather",
        　skills:[] },
        
        { name:"季節テスト", hp:0, maxHp:0, img:"季節テスト.png",
        　activity:null, family:null, zones:[], seasons:[], sex:null, rare:1, type:"season",
        　skills:[] },
        
        { name:"時間帯テスト", hp:0, maxHp:0, img:"時間帯テスト.png",
        　activity:null, family:null, zones:[], seasons:[], sex:null, rare:1, type:"time",
        　skills:[] },
        
];

    // ============================
    // Deck System (User / Online / AI)
    // ============================
    // 使い方:
    //  - 自分の構築デッキ: buildDeckFromConfig(normalizeUserDeckConfig(userDeckConfig))
    //  - AIデッキ: buildDeckFromPreset(AI_DECK_PRESET)
    //  - マルチ: 両者の deckConfig を交換し、ホストが両方の実デッキを生成して配布
    //
    // ※ AIデッキの内容を変えるなら AI_DECK_PRESET を編集するだけでOK
    const AI_DECK_PRESET = [
        { name: "ナナフシモドキ♀", count: 2 },
        { name: "スズムシ♀",       count: 2 },
        // そのほかの７種を4枚ずつ（合計32枚）
        { name: "エゾゼミ♀",       count: 4 },
        { name: "オオミズアオ♂",   count: 4 },
        { name: "カブトムシ♀",     count: 4 },
        { name: "コクワガタ♂",     count: 4 },
        { name: "シンジュサン♂",   count: 4 },
        { name: "ヤママユ♀",       count: 4 },
        { name: "ヤママユ♂",       count: 4 },
    ];

    function deepClone(obj){ return JSON.parse(JSON.stringify(obj)); }

    function withRuntimeFields(card){
        // 既存コード互換の一時フィールド
        return Object.assign(card, {
            id: Math.random(),
            currentInvinc:false,
            mimicActive:false,
            mimicCooldown:false,
            mimicCooldownTurns:0
        });
    }

    function shuffleInPlace(arr){
        for(let i = arr.length - 1; i > 0; i--){
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // userDeckConfig を「全種のキーがある」「合計32枚」に整形
    function normalizeUserDeckConfig(cfg){
        const out = {};
        for(let i=0;i<BUG_MASTER.length;i++) out[i]=0;

        if(cfg && typeof cfg === 'object'){
            for(const k in cfg){
                const idx = Number(k);
                if(Number.isFinite(idx) && idx >= 0 && idx < BUG_MASTER.length){
                    out[idx] = Math.max(0, Number(cfg[k])|0);
                }
            }
        }

        let total = Object.values(out).reduce((a,b)=>a+b,0);
        // 32に合わせる（不足は追加、超過は削減）
        while(total < 32){
            const idx = Math.floor(Math.random() * BUG_MASTER.length);
            out[idx]++; total++;
        }
        while(total > 32){
            const nonZero = Object.keys(out).map(Number).filter(i => out[i] > 0);
            if(nonZero.length === 0) break;
            const idx = nonZero[Math.floor(Math.random() * nonZero.length)];
            out[idx]--; total--;
        }
        return out;
    }

    function buildDeckFromConfig(cfg){
        const deck = [];
        const norm = normalizeUserDeckConfig(cfg);
        for(let i=0;i<BUG_MASTER.length;i++){
            const count = norm[i] | 0;
            for(let n=0;n<count;n++){
                deck.push(withRuntimeFields(deepClone(BUG_MASTER[i])));
            }
        }
        return shuffleInPlace(deck);
    }

    function buildDeckFromPreset(preset){
        const byName = {};
        BUG_MASTER.forEach(b => byName[b.name]=b);
        const deck = [];
        (preset||[]).forEach(item=>{
            const base = byName[item.name];
            const count = Math.max(0, Number(item.count)|0);
            if(!base) return;
            for(let i=0;i<count;i++){
                deck.push(withRuntimeFields(deepClone(base)));
            }
        });
        // 念のため32枚に調整
        while(deck.length < 32){
            const base = BUG_MASTER[Math.floor(Math.random()*BUG_MASTER.length)];
            deck.push(withRuntimeFields(deepClone(base)));
        }
        deck.length = 32;
        return shuffleInPlace(deck);
    }


    let state = {
        inBattleScene: false,
        mode: 'local', difficulty: 3, currentPlayer: 0, firstPlayer: 0,
        // ターン数（1から開始）。「先攻の最初のターンは攻撃不可」判定に使う
        turnNumber: 0,
        p1: { hand: [], field: [null, null, null], itemSlots: [null, null, null], deck: [], trash: [], isReady: false },
        p2: { hand: [], field: [null, null, null], itemSlots: [null, null, null], deck: [], trash: [], isReady: false },
        gameStarted: false, selectedAttacker: null, selectedSkill: null, isProcessing: false,
        waitingForPlacement: false, postPlacementAction: null, opponentPlacing: false,
        myJanken: null, opJanken: null, isInitialSetup: false,
        revealOpponentField: false,
        timerMax: 60 
    };

    function isFirstTurnNoAttack() {
        // ローカル視点: 自分=p1, 相手=p2
        // 「先攻の最初のターン」は、先攻側は攻撃不可（AIが先攻でも同様）
        if (!state.gameStarted) return false;
        if (!state.localFirstPlayer) return false;

        // いま行動中プレイヤーが先攻プレイヤーか？
        if (state.currentPlayer !== state.localFirstPlayer) return false;

        // 先攻プレイヤーのターン回数が0（＝最初のターン）なら攻撃禁止
        if (state.localFirstPlayer === 1) {
            return (state.p1TurnCount ?? 0) === 0;
        } else {
            return (state.p2TurnCount ?? 0) === 0;
        }
    }


    const PLACEMENT_PRIORITY = [1, 0, 2];
    



    


// --- UI Cleanup: タイトルへ戻るときに勝敗テキスト等を消す ---
    function clearEndTexts() {
        const turnMsg = document.getElementById('turn-msg');
        if (turnMsg) {
            turnMsg.style.opacity = 0;
            turnMsg.innerText = "";
        }
        const skillDisp = document.getElementById('skill-display');
        if (skillDisp) {
            skillDisp.classList.remove('skill-anim');
            skillDisp.style.opacity = 0;
            skillDisp.innerText = "";
        }
        // 勝敗専用の要素がある場合にも対応（存在しなければ無視）
        ['gameover-text','result-text','winlose-text','you-win','you-lose'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.style.opacity = 0; el.style.display = 'none'; el.innerText = ""; }
        });
    }

    // --- Battle Reset: AI/マルチ/ローカル 再戦で前回盤面を引きずらないための完全リセット ---
    function resetBattleState() {
        
        try { stopOpponentDots(); } catch(e) {}
// タイマー停止
        try { stopTimer(); } catch(e) {}
        try { clearInterval(timerInterval); } catch(e) {}
        timerInterval = null;

        // 進行中の処理・選択状態を解除
        state.isProcessing = false;
        state.selectedAttacker = null;
        state.selectedSkill = null;
        state.waitingForPlacement = false;
        state.postPlacementAction = null;
        state.opponentPlacing = false;
        state.isInitialSetup = false;
        state.revealOpponentField = false;

        // ターン関連
        state.gameStarted = false;
        state.turnNumber = 0;
        state.currentPlayer = 0;
        state.firstPlayer = 0;
        state.localFirstPlayer = null;
        state.p1TurnCount = 0;
        state.p2TurnCount = 0;
        state.turnMsgToken = (state.turnMsgToken || 0) + 1;

        // 盤面・山札・手札・トラッシュを初期化
        state.p1 = { hand: [], field: [null, null, null], itemSlots: [null, null, null], deck: [], trash: [], isReady: false };
        state.p2 = { hand: [], field: [null, null, null], itemSlots: [null, null, null], deck: [], trash: [], isReady: false };
        state.sideZones = { season: null, time: null, environment: null, weather: null };

        // UI表示を初期化（戦闘ボタン非表示）
        state.inBattleScene = false;
        const endBtn = document.getElementById('end-turn-btn');
        if (endBtn) endBtn.style.display = 'none';
        const setup = document.getElementById('setup-controls');
        if (setup) setup.classList.add('hidden');
        const sur = document.getElementById('surrender-btn');
        if (sur) sur.classList.add('hidden');

        // 表示の残骸を消す
        clearEndTexts();

        // 手札/場のDOMを消す（残留カードが次戦に影響しないように）
        ['hand-p1','hand-p2'].forEach(id=>{
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
        });
        ['field-p1','field-p2'].forEach(id=>{
            const el = document.getElementById(id);
            if (!el) return;
            el.querySelectorAll('.battle-slot, .side-slot').forEach(slot => slot.innerHTML = '');
        });

        // side-slot（季節/時間/環境/天気）もクリア
        document.querySelectorAll('.side-slot').forEach(s => { s.innerHTML = ''; s.classList.remove('has-card'); });

        // 念のため UI 更新
        try { updateUI(); } catch(e) {}
    }


    let timerInterval = null;

    // --- Opponent Turn Dots Animation (robust) ---
    let opponentDotsTimer = null;
    let opponentDotsStep = 0;
    const opponentDotsPatterns = [".", "..", "..."];

    function startOpponentDots() {
        const msg = document.getElementById('turn-msg');
        if (!msg) return;
        if (opponentDotsTimer) return; // already running
        opponentDotsStep = 0;
        // 元テキストが「相手のターン中」で始まる場合のみアニメ化
        msg.innerText = "相手のターン中" + opponentDotsPatterns[opponentDotsStep];
        opponentDotsStep = (opponentDotsStep + 1) % opponentDotsPatterns.length;
        opponentDotsTimer = setInterval(() => {
            const m = document.getElementById('turn-msg');
            if (!m) return;
            // 他のメッセージに変わっていたら止める
            if (!String(m.innerText || "").startsWith("相手のターン中")) {
                stopOpponentDots();
                return;
            }
            m.innerText = "相手のターン中" + opponentDotsPatterns[opponentDotsStep];
            opponentDotsStep = (opponentDotsStep + 1) % opponentDotsPatterns.length;
        }, 1050);
    }

    function stopOpponentDots() {
        if (opponentDotsTimer) {
            clearInterval(opponentDotsTimer);
            opponentDotsTimer = null;
        }
        opponentDotsStep = 0;
    }

    // turn-msg のテキストが書き換わったら自動でON/OFF（どこで設定していても動く）
    function attachOpponentDotsObserver() {
        const msg = document.getElementById('turn-msg');
        if (!msg || msg._dotsObserverAttached) return;
        msg._dotsObserverAttached = true;

        const handle = () => {
            const t = String(msg.innerText || "");
            if (t.startsWith("相手のターン中")) startOpponentDots();
            else stopOpponentDots();
        };

        const obs = new MutationObserver(handle);
        obs.observe(msg, { childList: true, characterData: true, subtree: true });
        // 初回
        handle();
    }

    // DOM準備後に監視開始
    window.addEventListener('load', attachOpponentDotsObserver);

    let timerSeconds = 0;
    
    function startTimer(seconds, callback) {
        clearInterval(timerInterval);
        timerSeconds = seconds;
        state.timerMax = seconds;
        const container = document.getElementById('timer-container');
        const count = document.getElementById('timer-count');
        const circle = document.getElementById('timer-circle');
        const CIRCUMFERENCE = 150.796; // 2 * π * 24

        function updateTimerUI(sec) {
            const ratio = sec / state.timerMax;
            const isLow = sec <= state.timerMax * 0.3;
            const fillColor = isLow ? 'rgba(220,50,50,0.55)' : 'rgba(255,255,255,0.18)';
            const textColor = isLow ? '#ff6b6b' : '#ffffff';
            if(count){ count.textContent = sec; count.setAttribute('fill', textColor); }
            if(circle){
                // 扇形パスを計算（中心30,30 半径28、12時方向から時計回り）
                const R = 28;
                const cx = 30, cy = 30;
                const angle = ratio * 2 * Math.PI;
                const x = cx + R * Math.sin(angle);
                const y = cy - R * Math.cos(angle);
                const largeArc = ratio > 0.5 ? 1 : 0;
                let d;
                if(ratio <= 0) {
                    d = '';
                } else if(ratio >= 1) {
                    // 満円
                    d = `M ${cx} ${cy} m 0 -${R} a ${R} ${R} 0 1 1 -0.001 0 Z`;
                } else {
                    d = `M ${cx} ${cy} L ${cx} ${cy - R} A ${R} ${R} 0 ${largeArc} 1 ${x.toFixed(3)} ${y.toFixed(3)} Z`;
                }
                circle.setAttribute('d', d);
                circle.setAttribute('fill', fillColor);
            }
        }

        container.style.display = 'block';
        updateTimerUI(seconds);

        timerInterval = setInterval(() => {
            timerSeconds--;
            updateTimerUI(timerSeconds);
            if(timerSeconds <= state.timerMax * 0.3 && timerSeconds > 0 && state.currentPlayer === 1) playSE('count_down');
            if(timerSeconds <= 0) {
                clearInterval(timerInterval);
                if (callback) callback();
            }
        }, 1000);
    }
    function stopTimer() {
        clearInterval(timerInterval);
        document.getElementById('timer-container').style.display = 'none';
    }

    function copyPeerId() {
        const id = document.getElementById('my-peer-id').innerText;
        if(id && id !== 'Connecting...') {
            navigator.clipboard.writeText(id).then(() => { alert('IDをコピーしました！'); });
        }
    }

    function autoPlayTurn() {
        // AI/自動操作: 配置待ち中は「置けるなら置く / 置けないならターン終了」だけを行う
        if (state.waitingForPlacement) {
            if (state.p1.hand.length > 0) {
                if (!state.gameStarted) {
                    onAutoReady();
                } else {
                    const slot = PLACEMENT_PRIORITY.find(i => state.p1.field[i] === null);
                    if (slot !== undefined) {
                        const bugCards = state.p1.hand.filter(c => !c.type || c.type === 'bug');
                        const pool = bugCards.length > 0 ? bugCards : state.p1.hand;
                        const randIdx = Math.floor(Math.random() * pool.length);
                        placeCard(pool[randIdx], slot);
                    }
                }
            } else {
                // 手札が無いなら終了（※自分のターン以外では userEndTurn() は何もしないのでガード）
                if (state.mode === 'online' || state.currentPlayer === 1) userEndTurn();
            }
            return;
        }

        // 通常時：オンライン以外は「自分のターン」以外では何もしない
        if (state.mode !== 'online' && state.currentPlayer !== 1) return;
        userEndTurn();
    }

    function onAutoReady() {
        if(state.p1.isReady) return;
        const hasCard = state.p1.field.some(c => c !== null);
        if (!hasCard && state.p1.hand.length > 0) {
            const slot = PLACEMENT_PRIORITY.find(idx => state.p1.field[idx] === null);
            if(slot !== undefined) {
                const bugCards = state.p1.hand.filter(c => !c.type || c.type === 'bug');
                const pool = bugCards.length > 0 ? bugCards : state.p1.hand;
                const randIdx = Math.floor(Math.random() * pool.length);
                placeCard(pool[randIdx], slot);
            }
        }
        onReadyClick();
    }

    function placeCard(card, slotIdx) {
        if(state.isProcessing) return;
        state.isProcessing = true;
        if(slotIdx === undefined) {
            slotIdx = PLACEMENT_PRIORITY.find(idx => state.p1.field[idx] === null);
            if (slotIdx === undefined) { state.isProcessing = false; return; }
        }
        playSE('place');
        const handIdx = state.p1.hand.indexOf(card);
        state.p1.field[slotIdx] = card;
        state.p1.hand = state.p1.hand.filter(c => c.id !== card.id);
        if(state.mode === 'online') Net.send('PLACE', { handIdx: handIdx, slotIdx: slotIdx }); 
        
if(state.waitingForPlacement) {
    state.waitingForPlacement = false;
    const msg = document.getElementById('turn-msg');
    msg.style.opacity = 0; // 「バトル場にカードを出してください！」を消す

    const isMyTurnNow = (state.currentPlayer === 1);

    // 直前に残っているタイマーの影響を無効化
    state.turnMsgToken++;

    msg.classList.remove('banner-in');
    msg.innerText = isMyTurnNow ? "自分のターン" : "相手のターン中...";
    msg.style.color = isMyTurnNow ? "#3498db" : "#e74c3c";
    // startTurnと同じbanner-in演出で表示
    requestAnimationFrame(() => {
        msg.classList.add('banner-in');
        msg.style.opacity = 1;
    });

    // 自分のターン表示だけ2.2秒（banner-inアニメーション終了後）に消す
    if (isMyTurnNow) {
        const _tok2 = state.turnMsgToken;
        setTimeout(() => {
            if (_tok2 !== state.turnMsgToken) return;
            if (state.currentPlayer !== 1) return;
            if (!state.waitingForPlacement) {
                msg.classList.remove('banner-in');
                msg.style.opacity = 0;
            }
        }, 2200);
    }
document.getElementById('end-turn-btn').style.display= isMyTurnNow ? 'block' : 'none';

    if(state.mode === 'online') {
        // SYNC_TIMER turn_start は「自分のターン中の配置完了」だけ送る
        // 相手ターン中（死滅回遊で空になった）の配置では送らない
        if(isMyTurnNow) Net.send('SYNC_TIMER', { type: 'turn_start' });
        if(isMyTurnNow) startTimer(60, () => autoPlayTurn());
    }
    else if (state.mode === 'ai') stopTimer();
    else if (isMyTurnNow) startTimer(60, () => autoPlayTurn());

    if (state.postPlacementAction) state.postPlacementAction();
}



        // セットアップフェーズ中（ゲーム未開始）に蟲カードを置いたらsetup-controlsを表示
        // doMulliganIfNeeded()が失敗した場合のフォールバックも兼ねる
        if (!state.gameStarted && !state.waitingForPlacement && !state.p1.isReady) {
            const hasBugOnField = state.p1.field.some(c => c && (!c.type || c.type === 'bug'));
            const setupEl = document.getElementById('setup-controls');
            if (hasBugOnField && setupEl && setupEl.classList.contains('hidden')) {
                setupEl.classList.remove('hidden');
                if (state.mode === 'online') {
                    // タイマーがまだ動いていなければ開始
                    if (!timerInterval) startTimer(60, onAutoReady);
                }
            }
        }

        updateUI();
        try { animateCardPlace(document.getElementById(`p1-slot-${slotIdx}`), card.img); } catch(e) {}
        state.isProcessing = false;
    }

    function placeSideZoneCard(cardData, zone, slotEl){
        try{
            if(!slotEl) return;

            // 手札からカードを削除
            state.p1.hand = state.p1.hand.filter(c => c.id !== cardData.id);

            // カードDOM作成（position:relativeでslot内に収める）
            const view = createCardView(cardData);
            view.style.position = 'relative';
            view.style.width = '99px';
            view.style.height = '143px';
            view.style.pointerEvents = 'auto';
            // 回転はCSSで制御（left-col=rotate90deg, right-col=rotate-90deg）
            // JS側でtransformを設定しない（CSSと干渉するため）

            // ロングプレスでプレビュー
            let t2;
            view.addEventListener('mousedown', ()=>{ t2=setTimeout(()=>{ playSE('decide'); openPreview(cardData.img); },500); });
            view.addEventListener('mouseup', ()=>{ clearTimeout(t2); });
            view.addEventListener('touchstart', ()=>{ t2=setTimeout(()=>{ playSE('decide'); openPreview(cardData.img); },500); },{passive:true});
            view.addEventListener('touchend', ()=>{ clearTimeout(t2); });

            slotEl.innerHTML = '';
            slotEl.appendChild(view);
            slotEl.classList.add('has-card');

            state.sideZones = state.sideZones || {season:null,time:null,environment:null,weather:null};
            const prevSeason = state.sideZones.season;
            if(zone) state.sideZones[zone] = cardData;

            // 死滅回遊：季節カードが置かれたら発動（自分が置いた場合のみ。オンライン受信側はPLACE_SIDEで別処理）
            if(zone === 'season') {
                try{
                    const allFields = [...(state.p1.field||[]), ...(state.p2.field||[])];
                    const deathCards = allFields.filter(c => c && c.deathMigration);
                    if(deathCards.length > 0) {
                        triggerDeathMigration(deathCards);
                    }
                }catch(e){ console.error('deathMigration error:', e); }
            }

            playSE('place');
            try{ updateUI(); }catch(e){}
        }catch(e){ console.error('placeSideZoneCard error:', e); }
    }

    function showQuickItemAnim(imgSrc) {
        const el = document.getElementById('quick-item-display');
        const img = document.getElementById('quick-item-img');
        if(!el || !img) return;
        img.src = imgSrc;
        el.classList.remove('animating');
        void el.offsetWidth;
        el.classList.add('animating');
        setTimeout(() => { el.classList.remove('animating'); }, 1250);
    }

    function useQuickItem(cardData) {
        try {
            if(!state.canPlaySideCard || state.currentPlayer !== 1) return;
            state.p1.hand = state.p1.hand.filter(c => c.id !== cardData.id);
            state.p1.trash.push(cardData);
            playSE('place');
            showQuickItemAnim(cardData.img);
            if(state.mode === 'online') Net.send('USE_ITEM', { img: cardData.img });
            // TODO: 各カードの効果実装
            updateUI();
        } catch(e) { console.error('useQuickItem error:', e); }
    }

    function placeItemCard(cardData, slotIdx, slotEl) {
        try {
            if(!slotEl) return;
            state.p1.hand = state.p1.hand.filter(c => c.id !== cardData.id);
            // 既存カードをトラッシュ
            if(state.p1.itemSlots[slotIdx]) state.p1.trash.push(state.p1.itemSlots[slotIdx]);
            state.p1.itemSlots[slotIdx] = cardData;
            // カードDOM作成
            const view = createCardView(cardData);
            view.style.position = 'relative';
            view.style.width = '99px';
            view.style.height = '143px';
            view.style.pointerEvents = 'auto';
            let t2;
            view.addEventListener('mousedown', ()=>{ t2=setTimeout(()=>{ playSE('decide'); openPreview(cardData.img); },500); });
            view.addEventListener('mouseup', ()=>{ clearTimeout(t2); });
            view.addEventListener('touchstart', ()=>{ t2=setTimeout(()=>{ playSE('decide'); openPreview(cardData.img); },500); },{passive:true});
            view.addEventListener('touchend', ()=>{ clearTimeout(t2); });
            slotEl.innerHTML = '';
            slotEl.appendChild(view);
            slotEl.classList.add('has-card');
            playSE('place');
            if(state.mode === 'online') Net.send('PLACE_ITEM', { slotIdx, cardName: cardData.name, cardId: cardData.id });
            updateUI();
        } catch(e) { console.error('placeItemCard error:', e); }
    }


    const Net = {
        peer: null, conn: null, peerId: null, isHost: false,
        _mulliganRunning: false, _mulliganQueue: [], _mulliganDataReady: false,
        myDeckCfg: null, opDeckCfg: null, gameStartedOnce: false, connectLocked: false, connectTimeoutId: null,
        init: function() {
            this.peer = new Peer();
            this.peer.on('open', (id) => { document.getElementById('my-peer-id').innerText = id; document.getElementById('lobby-status').innerText = "接続準備完了"; try{ localStorage.setItem('mushi_peer_id', id); } catch(e){} const fp = document.getElementById('friend-panel-my-id'); if(fp) fp.innerText = id; });
            this.peer.on('connection', (c) => { this.conn = c; this.isHost = true; this.setupConnection(); document.getElementById('lobby-status').innerText = "相手が接続しました"; });
        },
        connect: function(id) {
            if(!this.peer) { this.connectLocked = false; return; }
            this.conn = this.peer.connect(id); this.isHost = false; this.setupConnection();
            document.getElementById('lobby-status').innerText = "接続中...";
        },
        setupConnection: function() {
            this.conn.on('open', () => {
                this.connectLocked = false;
// 接続のホスト判定を「IDの大小」で決める（同時接続でも両者で一致する）
                try {
                    const myId = this.peer && this.peer.id ? this.peer.id : '';
                    const otherId = this.conn && this.conn.peer ? this.conn.peer : '';
                    this.isHost = (String(myId) < String(otherId));
                } catch(e) { /* ignore */ }
                document.getElementById('lobby-status').innerText = "接続完了！";
                // 自分の構築デッキを相手へ送る
                this.myDeckCfg = normalizeUserDeckConfig(userDeckConfig);
                this.send('DECK_CFG', { cfg: this.myDeckCfg });
                // ホストは両方揃ってから開始
                if (this.isHost) this.maybeStartHostGame();
            });
            this.conn.on('data', (d) => this.handleData(d));
            this.conn.on('close', () => {
                const rs = document.getElementById('screen-rematch');
                if(!rs || rs.classList.contains('hidden')) location.reload();
            });
        },
        send: function(t, p) { if(this.conn && this.conn.open) this.conn.send({ type: t, payload: p }); },
                maybeStartHostGame: function(){
            if(!this.isHost) return;
            if(this.gameStartedOnce) return;
            if(!this.conn || !this.conn.open) return;
            if(!this.myDeckCfg) this.myDeckCfg = normalizeUserDeckConfig(userDeckConfig);
            if(!this.opDeckCfg) return; // 相手のデッキ待ち
            this.gameStartedOnce = true;
            setTimeout(()=>this.hostStartGame(), 300);
        },
        hostStartGame: function() {
            state.netGameInitDone = false;
            state.p1.hand=[]; state.p2.hand=[]; state.p1.field=[null,null,null]; state.p2.field=[null,null,null]; state.p1.trash=[]; state.p2.trash=[]; state.p1.itemSlots=[null,null,null]; state.p2.itemSlots=[null,null,null];
        // アイテムスロットのDOM初期化
        ['p1-item-0','p1-item-1','p1-item-2','p2-item-0','p2-item-1','p2-item-2'].forEach(id=>{
            const el = document.getElementById(id);
            if(el){ el.innerHTML=''; el.classList.remove('has-card'); }
        });
            const hostCfg = this.myDeckCfg || normalizeUserDeckConfig(userDeckConfig);
            const guestCfg = this.opDeckCfg;
            const deckP1 = buildDeckFromConfig(hostCfg);
            const deckP2 = buildDeckFromConfig(guestCfg);
            state.p1.deck = deckP1; state.p2.deck = deckP2;
            this.send('INIT_GAME', { myDeck: deckP2, opDeck: deckP1 });
            prepareGameVisuals();
        },
        handleData: function(data) {
            switch(data.type) {
                case 'DECK_CFG':
                    this.opDeckCfg = (data.payload && data.payload.cfg) ? data.payload.cfg : null;
                    if (this.isHost) this.maybeStartHostGame();
                    break;
                case 'INIT_GAME':
                    if (state.netGameInitDone) { console.log('INIT_GAME ignored (dup)'); break; }
            state.netGameInitDone = true;
state.p1.hand=[]; state.p2.hand=[]; state.p1.field=[null,null,null]; state.p2.field=[null,null,null]; state.p1.trash=[]; state.p2.trash=[];
                    state.p1.deck = data.payload.myDeck; state.p2.deck = data.payload.opDeck;
                    prepareGameVisuals(); break;
                case 'PLACE': {
                    const fIdx = data.payload.slotIdx;
                    const hIdx = (data.payload.handIdx !== undefined) ? data.payload.handIdx : state.p2.hand.findIndex(c => c.id === data.payload.cardId);
                    if(hIdx !== -1 && hIdx < state.p2.hand.length) {
                        const placedCard = state.p2.hand[hIdx];
                        playSE('place'); state.p2.field[fIdx] = placedCard; state.p2.hand.splice(hIdx, 1); hideOpponentTurnMsg(); updateUI();
                        try { animateCardPlace(document.getElementById(`p2-slot-${fIdx}`), placedCard.img); } catch(e) {}
                    }
                    break;
                }
                case 'READY':
                    state.p2.isReady = true; if(state.p1.isReady) checkStartJanken(); break;
                case 'ATTACK': hideOpponentTurnMsg();
                    if (isFirstTurnNoAttack()) {
                        // 念のため：先攻1ターン目の攻撃は受け付けない
                        showTurnMsg("先攻1ターン目の攻撃は無効", "#e74c3c");
                        break;
                    }
                    const ac = state.p2.field[data.payload.attackerSlot]; 
                    const dc = data.payload.targetSlot === -1 ? ac : state.p1.field[data.payload.targetSlot];
                    if(ac && dc) executeAttackVisuals(ac, dc, ac.skills[data.payload.skillIdx]); break;
                case 'JANKEN_PICK':
                    state.opJanken = data.payload.hand; if (this.isHost) checkJankenMatch(); break;
                case 'JANKEN_RESULT':
                    resolveJankenVisuals(data.payload.p1Hand, data.payload.p2Hand, data.payload.winner); break;
                case 'END_TURN': endTurn(true); break;
                case 'PLACE_SIDE': { hideOpponentTurnMsg();
                    // 相手がサイドゾーンにカードを置いた（季節など）
                    const zone2 = data.payload.zone;
                    const card2 = state.p2.hand.find(c => c.id === data.payload.cardId)
                                || state.p2.hand.find(c => c.name === data.payload.cardName);
                    if(card2){
                        state.p2.hand = state.p2.hand.filter(c => c.id !== card2.id);
                        state.sideZones = state.sideZones || {season:null,time:null,environment:null,weather:null};
                        // サイドゾーンのDOM更新
                        const slotEl2 = document.querySelector(`.side-slot[data-zone="${zone2}"]`);
                        if(slotEl2) placeSideZoneCard_p2(card2, zone2, slotEl2);
                        else {
                            // DOM操作なしでstateだけ更新
                            const prev2 = state.sideZones[zone2];
                            if(prev2) state.p2.trash.push(prev2);
                            state.sideZones[zone2] = card2;
                            // ※死滅回遊はDEATH_MIGRATION_RESULTで処理
                            updateUI();
                        }
                    }
                    break;
                }
                case 'DEATH_MIGRATION_TRIGGER': {
                    // 相手が季節を置いたことで自分のカードが死滅回遊発動
                    // 受信側では state.p1 = 自分、state.p2 = 相手
                    const trigCard = state.p1.field.find(c=>c&&c.id===data.payload.cardId);
                    const trigRest = (data.payload.restIds||[]).map(id=>state.p1.field.find(c=>c&&c.id===id)).filter(Boolean);
                    if(!trigCard){ console.warn('DEATH_MIGRATION_TRIGGER: card not found', data.payload.cardId); break; }

                    // 受信側視点：ownerP=p1(自分)、enemyP=p2(相手)
                    const ownerPt = state.p1;
                    const enemyPt = state.p2;
                    const enemyAlivet = enemyPt.field.map((c,i)=>({c,i})).filter(x=>x.c);

                    state.isProcessing = true;
                    state._deathMigRunning = true;
                    const dismissBannerT = showSkillBannerPersist("死滅回遊", false);

                    if(enemyAlivet.length === 0){
                        setTimeout(()=>{
                            dismissBannerT();
                            state._deathMigRunning = false;
                            state.isProcessing = false;
                            const sit = ownerPt.field.indexOf(trigCard);
                            _deathMigTrash(trigCard, 1, sit, trigRest);
                            Net.send('DEATH_MIGRATION_RESULT', { cardId: trigCard.id, targetId: null, ownerIdx: 2 });
                        }, 700);
                    } else if(enemyAlivet.length === 1){
                        setTimeout(()=>{
                            dismissBannerT();
                            state._deathMigRunning = false;
                            state.isProcessing = false;
                            const tgtt = enemyAlivet[0].c;
                            applyDeathMigrationDamage(trigCard, tgtt, ownerPt, enemyPt, 1, trigRest);
                            Net.send('DEATH_MIGRATION_RESULT', { cardId: trigCard.id, targetId: tgtt.id, ownerIdx: 2 });
                        }, 700);
                    } else {
                        // 複数体 → 自分が選ぶ（バンド保持）
                        setTimeout(()=>{
                            state.isProcessing = true;
                            const msg = document.getElementById('turn-msg');
                            msg.innerText = "死滅回遊：攻撃する相手を選択！";
                            msg.style.color = "#e74c3c";
                            msg.style.opacity = 1;
                            enemyAlivet.forEach(({c: tgtt})=>{
                                const elt = document.getElementById(`card-${tgtt.id}`);
                                if(!elt) return;
                                elt.closest('.battle-slot')?.classList.add('valid-target');
                                elt._deathMigHandler = function(){
                                    enemyAlivet.forEach(({c:xt})=>{
                                        const xet = document.getElementById(`card-${xt.id}`);
                                        xet?.closest('.battle-slot')?.classList.remove('valid-target');
                                        if(xet?._deathMigHandler){ xet.removeEventListener('click', xet._deathMigHandler); delete xet._deathMigHandler; }
                                    });
                                    msg.style.opacity = 0;
                                    dismissBannerT();
                                    state._deathMigRunning = false;
                                    state.isProcessing = false;
                                    applyDeathMigrationDamage(trigCard, tgtt, ownerPt, enemyPt, 1, trigRest);
                                    Net.send('DEATH_MIGRATION_RESULT', { cardId: trigCard.id, targetId: tgtt.id, ownerIdx: 2 });
                                };
                                elt.addEventListener('click', elt._deathMigHandler);
                            });
                        }, 600);
                    }
                    break;
                }
                case 'DEATH_MIGRATION_RESULT': {
                    const dmCard = data.payload.cardId;
                    const dmTgt = data.payload.targetId;
                    const dmOwnerIdx = data.payload.ownerIdx;
                    state.isProcessing = false;
                    state._deathMigRunning = false;
                    showSkillBanner("死滅回遊", dmOwnerIdx === 2);
                    const _setMsgAfterDM = () => {
                        if(state.waitingForPlacement) return;
                        const msg = document.getElementById('turn-msg');
                        const isMyTurn = state.currentPlayer === 1;
                        msg.innerText = isMyTurn ? "自分のターン" : "相手のターン中...";
                        msg.style.color = isMyTurn ? "#3498db" : "#e74c3c";
                        msg.style.opacity = 1;
                        if(isMyTurn){
                            const tok = ++state.turnMsgToken;
                            setTimeout(()=>{ if(tok===state.turnMsgToken && !state.waitingForPlacement) msg.style.opacity=0; }, 1500);
                        }
                    };
                    if(!dmTgt){ updateUI(); _setMsgAfterDM(); break; }
                    setTimeout(()=>{
                        const ownerP3 = dmOwnerIdx === 2 ? state.p2 : state.p1;
                        const tgt3 = [...(state.p1.field||[]),...(state.p2.field||[])].find(c=>c&&c.id===dmTgt);
                        const src3 = ownerP3.field.find(c=>c&&c.id===dmCard);
                        if(tgt3){
                            tgt3.hp = Math.max(0, tgt3.hp - 40);
                            const te3 = document.getElementById(`card-${tgt3.id}`);
                            if(te3){ playSE('damage'); te3.classList.add('damage-shake'); _showDamagePopup(te3,40,false); setTimeout(()=>te3.classList.remove('damage-shake'),220); }
                            const hb3 = document.getElementById(`hp-badge-${tgt3.id}`); if(hb3){hb3.innerText=`HP:${tgt3.hp}`;hb3.style.display='block';}
                        }
                        if(src3){
                            const slotIdx3 = ownerP3.field.indexOf(src3);
                            setTimeout(()=>{ moveToTrash(src3, dmOwnerIdx, slotIdx3); },400);
                        }
                        updateUI();
                        _setMsgAfterDM();
                    },400);
                    break;
                }
                case 'REQUEST_PLACEMENT': {
                    // 相手から「配置してから続行して」と要求された
                    showTurnMsg("バトル場にカードを出してください！", "#e74c3c");
                    state.waitingForPlacement = true;
                    state.isProcessing = false;
                    updateUI();
                    break;
                }
                case 'SURRENDER': showGameOver(1); break;
                case 'REMATCH_REQ':
                    _rm.opWants = true;
                    document.getElementById('rematch-msg').innerText = '相手も再戦を希望しています！';
                    checkRematchReady();
                    break;
                case 'REMATCH_READY':
                    _rm.opReady = true;
                    checkBothRematchReady();
                    break;
                case 'FRIEND_REQ': {
                    const acFR = getAcct();
                    acFR.friendRequests = acFR.friendRequests || [];
                    if(!acFR.friendRequests.some(r=>r.id===data.payload.id) && !acFR.friends.some(f=>f.id===data.payload.id)){
                        acFR.friendRequests.push(data.payload);
                        saveAcct(acFR);
                    }
                    break;
                }
                case 'FRIEND_ACCEPT': {
                    const acFA = getAcct();
                    if(!acFA.friends.some(f=>f.id===data.payload.id)){
                        acFA.friends.push(data.payload);
                        saveAcct(acFA);
                    }
                    break;
                }
                case 'DRAW_ANIM': animateDraw(2, { reveal: false, fromNet: true }); break;
                case 'USE_ITEM': {
                    const img = data.payload && data.payload.img;
                    if(img) showQuickItemAnim(img);
                    break;
                }
                case 'PLACE_ITEM': {
                    const { slotIdx, cardName, cardId } = data.payload || {};
                    const cardData = BUG_MASTER.find(c => c.id === cardId || c.name === cardName);
                    if(cardData == null || slotIdx == null) break;
                    // 相手側のstateに反映
                    if(state.p2.itemSlots[slotIdx]) state.p2.trash.push(state.p2.itemSlots[slotIdx]);
                    state.p2.itemSlots[slotIdx] = cardData;
                    // 相手のDOM（p2-item-X）に表示
                    const slotEl = document.getElementById(`p2-item-${slotIdx}`);
                    if(slotEl) {
                        const view = createCardView(cardData);
                        view.style.cssText = 'position:relative;width:99px;height:143px;pointer-events:auto;';
                        slotEl.innerHTML = '';
                        slotEl.appendChild(view);
                        slotEl.classList.add('has-card');
                    }
                    playSE('place');
                    updateUI();
                    break;
                }
                case 'MULLIGAN': {
                    const mulCount = (data.payload && data.payload.count != null) ? data.payload.count : 5;
                    const drawExtra = !!(data.payload && data.payload.drawExtra);
                    const newDeck = (data.payload && data.payload.newDeck) ? data.payload.newDeck : null;
                    // キューに積んで順番に処理（両者同時マリガンでも競合しない）
                    Net._mulliganQueue.push({ mulCount, drawExtra, newDeck });
                    if (!Net._mulliganRunning) {
                        Net._mulliganRunning = true;
                        (async () => {
                            while (Net._mulliganQueue.length > 0) {
                                const job = Net._mulliganQueue.shift();
                                const jCount = job.mulCount;
                                const jExtra = job.drawExtra;
                                const jNewDeck = job.newDeck;
                                // 初期手札配布アニメが完全に終わるまで待つ
                                while (state.isInitialSetup) {
                                    await new Promise(r => setTimeout(r, 100));
                                }
                                // ★ データ更新を先に実行してからRunningをfalseに
                                // （バックグラウンドタブでもdoMulliganIfNeededが正しく評価できる）
                                if (jNewDeck) {
                                    state.p2.deck = jNewDeck;
                                    state.p2.hand = [];
                                } else {
                                    state.p2.deck.push(...state.p2.hand);
                                    state.p2.hand = [];
                                }
                                for (let _mi = 0; _mi < jCount; _mi++) {
                                    if (!state.p2.deck.length) break;
                                    state.p2.hand.push(state.p2.deck.pop());
                                }
                                // +1枚：デッキから取り出すだけ（手札追加は演出のonArriveで）
                                const _extraCard = (jExtra && state.p1.deck.length > 0) ? state.p1.deck.pop() : null;
                                // データ確定 → doMulliganIfNeededが待機解除できる
                                Net._mulliganDataReady = true;
                                // ★ 確定済み手札を最初に保存（スコープ問題を避ける）
                                const _animCards = [...state.p2.hand];
                                state.p2.hand = [];

                                await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                                const handEl2 = document.getElementById('hand-p2');
                                const deckEl2 = document.getElementById('deck-p2');
                                // DOMに旧手札が描画されていれば山札へ飛ばす演出
                                if (handEl2 && deckEl2 && handEl2.querySelectorAll('.card-container').length > 0) {
                                    const deckRect2 = deckEl2.getBoundingClientRect();
                                    const handCards2 = Array.from(handEl2.querySelectorAll('.card-container'));
                                    const rects2 = handCards2.map(ct => ct.getBoundingClientRect());
                                    const clones2 = handCards2.map((ct, idx) => {
                                        const cr = rects2[idx];
                                        const clone = ct.cloneNode(true);
                                        clone.style.cssText = `position:fixed;left:${cr.left}px;top:${cr.top}px;width:${cr.width}px;height:${cr.height}px;z-index:${520+idx};visibility:visible;pointer-events:none;transform:none;opacity:1;transition:none;`;
                                        document.body.appendChild(clone);
                                        return { clone, cr };
                                    });
                                    handEl2.innerHTML = '';
                                    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                                    const flyProms = clones2.map(({ clone, cr }, idx) => new Promise(res => {
                                        const dx = deckRect2.left + deckRect2.width/2 - (cr.left + cr.width/2);
                                        const dy = deckRect2.top  + deckRect2.height/2 - (cr.top  + cr.height/2);
                                        clone.style.transition = `transform 0.4s ease-in ${idx*40}ms, opacity 0.4s ease-in ${idx*40}ms`;
                                        clone.style.transform = `translate(${dx}px,${dy}px) scale(0.5)`;
                                        clone.style.opacity = '0';
                                        setTimeout(() => { clone.remove(); res(); }, 500 + idx * 40);
                                    }));
                                    await Promise.all(flyProms);
                                }
                                updateUI();
                                await new Promise(r => setTimeout(r, 200));

                                // ② 確定済み手札を1枚ずつ引く演出（drawOneForOpponentWithAnimと同じ動作）
                                for (const _card of _animCards) {
                                    await drawOpponentCardAnimOnly(_card);
                                    await new Promise(r => setTimeout(r, 80));
                                }
                                // ③ drawExtra：演出後にonArriveで手札に追加
                                if (_extraCard) {
                                    await playSingleDrawAnim(1, _extraCard, {
                                        reveal: true,
                                        onArrive: () => {
                                            state.p1.hand.push(_extraCard);
                                            state.p1.hand.sort(handSortCmp);
                                            updateUI();
                                        }
                                    });
                                }
                            }
                            Net._mulliganRunning = false;
                        })();
                    }
                    break;
                }
                case 'SYNC_TIMER':
                    if (data.payload.type === 'placement') {
                        // 相手が「場が空なので配置しろ」状態に入ったことを通知
                        state.opponentPlacing = true;
                        const msg = document.getElementById('turn-msg');
                        msg.innerText = "相手が配置中...";
                        msg.style.color = "#e74c3c";
                        msg.style.opacity = 1;
                        updateUI();
                        startTimer(60, null);
                    } else if (data.payload.type === 'turn_start') {
                        // 相手がターンを再開した（配置後の通知）
                        // currentPlayer=2（相手のターン）の時だけ「相手のターン中...」を表示
                        state.opponentPlacing = false;
                        if (state.currentPlayer === 2) {
                            const msg = document.getElementById('turn-msg');
                            msg.innerText = "相手のターン中...";
                            msg.style.color = "#e74c3c";
                            msg.style.opacity = 1;
                            startTimer(60, null);
                        }
                    }
                    break;
            }
        }
    };

    function toggleModal(id) {
        const el = document.getElementById(id);
        const willOpen = (el.style.display !== 'flex');
        el.style.display = willOpen ? 'flex' : 'none';
        if (willOpen && id === 'modal-settings') { syncSettingsUI(); }
    }
    function updateVol(t,v) { gameSettings[t+'Vol']=Number(v); AudioSys.updateVolumes(); saveSettingsToStorage(); if(t === 'se') playSE('decide'); }
    function updateBattleBgm(v) {
        gameSettings.battleBgm = String(v);
        AudioSys.playSE('click');
        saveSettingsToStorage();
        // 戦闘画面に入っている時だけ即反映（AI/マルチ選択直後の画面では鳴らさない）
        if (state.inBattleScene) {
            AudioSys.playBGM(gameSettings.battleBgm);
        }
    }

    let deckChangeInterval = null;
    let deckChangeTimeout = null;

    function openDeckBuilder() { 
        if(Object.keys(userDeckConfig).length===0) { BUG_MASTER.forEach((_,i)=>userDeckConfig[i]=0); }
        if(!savedDecks) loadSavedDecks();
        // スロット状態をUIへ（カルーセル）
        initDeckCarousel();
        syncDeckSlotUI();
        // 初回: フィルタUI生成
        initDeckFilterUI();
        // 表示
        applyDeckFiltersAndRender();
        toggleModal('modal-deck');
    }


    function startDeckMod(i, d) {
        if (modDeckCount(i, d)) playSE('click'); 
        deckChangeTimeout = setTimeout(() => {
            deckChangeInterval = setInterval(() => { if (modDeckCount(i, d)) playSE('click'); }, 100); 
        }, 400); 
    }

    function stopDeckMod() {
        clearTimeout(deckChangeTimeout); clearInterval(deckChangeInterval);
        deckChangeTimeout = null; deckChangeInterval = null;
    }


    // ============================
    // Deck Builder: Filter & Sort
    // ============================
    const deckUIState = {
        // filters are Sets (multi-select). empty => no filter
        activity: new Set(),
        family: new Set(),
        zone: new Set(),
        season: new Set(),
        sex: new Set(),
        // future cards (item / environment / weather / season-card / timeband)
        item: new Set(),
        itemSubtype: new Set(),
        environment: new Set(),
        weather: new Set(),
        seasonCard: new Set(),
        timeband: new Set(),
        group: 'all',
        sort: "kana",
        _inited: false
    };

    function toggleDeckFilterPanel(){
        const p = document.getElementById('deck-filter-panel');
        if(!p) return;
        p.classList.toggle('show');
    }
    function closeDeckFilterPanel(){
        const p = document.getElementById('deck-filter-panel');
        if(!p) return;
        p.classList.remove('show');
    }

    
    function setDeckFilterGroup(group){
        deckUIState.group = group || 'all';
        document.querySelectorAll('.filter-groups .filter-group-btn').forEach(b=>{
            b.classList.toggle('active', b.getAttribute('data-group') === deckUIState.group);
        });

        // グループ切り替え時にそのグループ専用フィルタをリセット
        deckUIState.activity.clear();
        deckUIState.sex.clear();
        deckUIState.family.clear();
        deckUIState.zone.clear();
        deckUIState.season.clear();
        deckUIState.itemSubtype.clear();
        deckUIState.item.clear();
        syncFilterChipsUI();

        const isBugView = (deckUIState.group === 'bug' || deckUIState.group === 'all');
        const isItemView = (deckUIState.group === 'item' || deckUIState.group === 'all');
        const bugSection = document.getElementById('filter-section-bug');
        const itemSection = document.getElementById('filter-section-item');
        if(bugSection) bugSection.style.display = isBugView ? '' : 'none';
        if(itemSection) itemSection.style.display = isItemView ? '' : 'none';

        applyDeckFiltersAndRender();
    }
function setDeckSort(v){
        deckUIState.sort = v || "none";
        applyDeckFiltersAndRender();
    }

    function resetDeckFilters(){
        deckUIState.activity.clear();
        deckUIState.family.clear();
        deckUIState.zone.clear();
        deckUIState.season.clear();
        deckUIState.sex.clear();
        deckUIState.item.clear();
        deckUIState.itemSubtype.clear();
        deckUIState.environment.clear();
        deckUIState.weather.clear();
        deckUIState.seasonCard.clear();
        deckUIState.timeband.clear();
        deckUIState.sort = (document.getElementById('deck-sort-select')?.value || "none");
        // チップ見た目更新
        syncFilterChipsUI();
        applyDeckFiltersAndRender();
    }

    function initDeckFilterUI(){
        if(deckUIState._inited) return;
        deckUIState._inited = true;

        // options
        const activities = ["昼行性","夜行性"];
        const sexes = ["♂","♀"];
        const familyOrder = ["クワガタムシ科","コオロギ科","セミ科","コガネムシ科","ナナフシ科","ヤガ科","ヤママユガ科","バッタ科"];
        const familiesRaw = Array.from(new Set(BUG_MASTER.map(b=>b.family).filter(Boolean)));
        const families = [
            ...familyOrder.filter(f => familiesRaw.includes(f)),
            ...familiesRaw.filter(f => !familyOrder.includes(f)).sort((a,b)=>a.localeCompare(b,"ja"))
        ];
        const zones = Array.from(new Set(BUG_MASTER.flatMap(b=>b.zones||[])));
        // add future zones even if no cards yet
        ["高山帯","亜高山帯"].forEach(z=>{ if(!zones.includes(z)) zones.push(z); });
        // preferred order
        const zoneOrder = ["高山帯","亜高山帯","山地帯","丘陵帯"];
        zones.sort((a,b)=>{
            const ia = zoneOrder.indexOf(a);
            const ib = zoneOrder.indexOf(b);
            if(ia !== -1 || ib !== -1){
                const aa = (ia === -1) ? 999 : ia;
                const bb = (ib === -1) ? 999 : ib;
                if(aa !== bb) return aa - bb;
            }
            return a.localeCompare(b,"ja");
        });
        // add future zones even if no cards yet
        ["高山帯","亜高山帯"].forEach(z=>{ if(!zones.includes(z)) zones.push(z); });
        const ZONE_ORDER = ["高山帯","亜高山帯","山地帯","丘陵帯"];
        zones.sort((a,b)=>{
        const ia = ZONE_ORDER.indexOf(a);
        const ib = ZONE_ORDER.indexOf(b);

        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.localeCompare(b,"ja");
        });
        const seasons = ["春", "夏", "秋", "冬"];

        buildChips("filter-activity", activities, deckUIState.activity);
        buildChips("filter-sex", sexes, deckUIState.sex);
        buildChips("filter-family", families, deckUIState.family);
        buildChips("filter-zone", zones, deckUIState.zone);
        buildChips("filter-season", seasons, deckUIState.season);

        // future cards: currently no options (will auto-populate when you add metadata)
        buildChips("filter-item", [], deckUIState.item);
        buildChips("filter-item-subtype", ["設置", "速攻"], deckUIState.itemSubtype);
        buildChips("filter-environment", [], deckUIState.environment);
        buildChips("filter-weather", [], deckUIState.weather);
        buildChips("filter-season-card", [], deckUIState.seasonCard);
        buildChips("filter-timeband", [], deckUIState.timeband);

        // sort select keep
        const sel = document.getElementById('deck-sort-select');
        if(sel) sel.value = deckUIState.sort;

        // group buttons initial
        try{ setDeckFilterGroup(deckUIState.group || 'all'); }catch(e){}
    }

    function buildChips(containerId, values, setRef){
        const wrap = document.getElementById(containerId);
        if(!wrap) return;
        wrap.innerHTML = "";

        // "全て" chip
        const all = document.createElement('div');
        all.className = 'chip active';
        all.innerText = '全て';
        all.onclick = () => { setRef.clear(); syncFilterChipsUI(); };
        wrap.appendChild(all);

        values.forEach(v=>{
            const chip = document.createElement('div');
            chip.className = 'chip';
            chip.innerText = v;
            chip.onclick = () => {
                if(setRef.has(v)) setRef.delete(v);
                else setRef.add(v);
                syncFilterChipsUI();
            };
            wrap.appendChild(chip);
        });

        syncFilterChipsUI();
    }

    function syncFilterChipsUI(){
        const pairs = [
            ["filter-activity", deckUIState.activity],
            ["filter-sex", deckUIState.sex],
            ["filter-family", deckUIState.family],
            ["filter-zone", deckUIState.zone],
            ["filter-season", deckUIState.season],
            ["filter-item", deckUIState.item],
            ["filter-item-subtype", deckUIState.itemSubtype],
            ["filter-environment", deckUIState.environment],
            ["filter-weather", deckUIState.weather],
            ["filter-season-card", deckUIState.seasonCard],
            ["filter-timeband", deckUIState.timeband],
        ];
        for(const [id,setRef] of pairs){
            const wrap = document.getElementById(id);
            if(!wrap) continue;
            const chips = Array.from(wrap.querySelectorAll('.chip'));
            // first chip is "全て"
            const allChip = chips[0];
            const any = setRef.size > 0;
            if(allChip) allChip.classList.toggle('active', !any);

            chips.slice(1).forEach(ch=>{
                ch.classList.toggle('active', setRef.has(ch.innerText));
            });
        }
    }

    function applyDeckFiltersAndRender(){
        // base list by group (all cards live in BUG_MASTER for now)
        const g = (deckUIState.group || 'all');
// map UI group -> card.type
        const groupToType = {
            bug: null,               // type is undefined for bugs
            item: "item",
            environment: "environment",
            weather: "weather",
            seasonCard: "season",
            timeband: "time"
        };

        let base = BUG_MASTER;

        if(g === 'all'){
            base = BUG_MASTER;
        } else if(g === 'bug'){
            base = BUG_MASTER.filter(b => !b.type || b.type === 'bug');
        }else{
            const want = groupToType[g];
            base = BUG_MASTER.filter(b => b && b.type === want);
        }

        const list = base.map((b, idx)=>({b, idx}));

        // filters (multi-select, AND across categories)
        const f = (arr, setRef, getter) => {
            if(!setRef || setRef.size===0) return arr;
            return arr.filter(x=>{
                const v = getter(x.b);
                if(Array.isArray(v)) return v.some(s=>setRef.has(s));
                return setRef.has(v);
            });
        };

        let out = list;
        // NOTE: these metadata filters mainly apply to bugs for now; other categories will just pass through
        out = f(out, deckUIState.activity, b=>b.activity);
        out = f(out, deckUIState.sex,      b=>b.sex);
        out = f(out, deckUIState.family,   b=>b.family);
        out = f(out, deckUIState.zone,     b=>b.zones||[]);
        out = f(out, deckUIState.season,   b=>b.seasons||[]);

        // future cards (optional metadata keys): itemTags / environments / weathers / seasonCards / timebands
        out = f(out, deckUIState.item,        b=>b.itemTags||[]);
        out = f(out, deckUIState.itemSubtype, b=>{
            if(!b.itemSubtype) return [];
            return b.itemSubtype === 'install' ? ['設置'] : b.itemSubtype === 'quick' ? ['速攻'] : [];
        });
        out = f(out, deckUIState.environment, b=>b.environments||[]);
        out = f(out, deckUIState.weather,     b=>b.weathers||[]);
        out = f(out, deckUIState.seasonCard,  b=>b.seasonCards||[]);
        out = f(out, deckUIState.timeband,    b=>b.timebands||[]);

        // sort (stable tie-breaker by name)
        const nameCmp = (a,c)=> String(a.b.name||"").localeCompare(String(c.b.name||""), "ja");
        if(deckUIState.sort === "hp") {
            out.sort((a,c)=> ((c.b.hp??-1) - (a.b.hp??-1)) || nameCmp(a,c));
        } else if(deckUIState.sort === "rare") {
            out.sort((a,c)=> ((c.b.rare??-1) - (a.b.rare??-1)) || nameCmp(a,c));
        } else {
            // default: type order then name (match 蟲神器157)
            const order = { bug:0, season:1, time:2, environment:3, weather:4, item:5 };
            out.sort((a,c)=>{
                const ta = (a.b && a.b.type) ? a.b.type : 'bug';
                const tc = (c.b && c.b.type) ? c.b.type : 'bug';
                const oa = (typeof order[ta] !== 'undefined') ? order[ta] : 99;
                const oc = (typeof order[tc] !== 'undefined') ? order[tc] : 99;
                if(oa !== oc) return oa - oc;
                return nameCmp(a,c);
            });
        }

        // We need indices into BUG_MASTER, not into the filtered base list.
        // Find the original index by name+img match (unique enough here).
        const masterIdx = (card)=>{
            // quick path: find by exact reference
            const i = BUG_MASTER.indexOf(card);
            if(i !== -1) return i;
            // fallback by (name,img)
            return BUG_MASTER.findIndex(x=>x && x.name===card.name && x.img===card.img);
        };

        renderDeckBuilder(out.map(x=> masterIdx(x.b)).filter(i=>i>=0));
        // total count update
        modDeckCount(0,0);
    }

    // --- Deck Builder: refresh counts in UI (after loading another saved deck slot) --- in UI (after loading another saved deck slot) ---
    function refreshDeckBuilderCounts(){
        try{
            // Re-render current builder list with existing filter/sort state
            if(document.getElementById('builder-container')){
                applyDeckFiltersAndRender();
            }else{
                // fallback: just update total
                modDeckCount(0,0);
            }
        }catch(e){
            try{ modDeckCount(0,0); }catch(e2){}
        }
    } 

    function renderDeckBuilder(indices){
        const c = document.getElementById('builder-container');
        if(!c) return;
        c.innerHTML = "";

        if(!indices || indices.length===0){
            c.innerHTML = `<div style="grid-column:1/-1; padding:18px; color:#bbb; text-align:center; background:rgba(255,255,255,0.05); border:1px dashed rgba(255,255,255,0.2); border-radius:12px;">このカテゴリのカードは未実装（今後追加予定）</div>`;
            return;
        }

        let __lastSection = null;
        const __sectionTitle = (t)=>{
          if(t==='bug') return '蟲';
          if(t==='season') return '季節';
          if(t==='time') return '時間帯';
          if(t==='environment') return '環境';
          if(t==='weather') return '天気';
          if(t==='item') return 'アイテム';
          return 'その他';
        };

        indices.forEach((i)=>{
            const b = BUG_MASTER[i];
            const t = (b && b.type) ? b.type : 'bug';
            if(__lastSection !== t){
              __lastSection = t;
              const h = document.createElement('div');
              h.className = 'builder-section';
              h.style.gridColumn = '1 / -1';
              h.style.padding = '8px 10px';
              h.style.margin = '4px 0 2px';
              h.style.borderRadius = '10px';
              h.style.background = 'rgba(255,255,255,0.08)';
              h.style.border = '1px solid rgba(255,255,255,0.12)';
              h.style.fontWeight = '900';
              h.style.color = 'rgba(255,255,255,0.9)';
              h.innerText = __sectionTitle(t);
              c.appendChild(h);
            }
            const d=document.createElement('div'); d.className='builder-item';

            const btnMinus = `<button class="count-btn" onmousedown="startDeckMod(${i},-1)" onmouseup="stopDeckMod()" onmouseleave="stopDeckMod()" ontouchstart="startDeckMod(${i},-1); event.preventDefault();" ontouchend="stopDeckMod()">-</button>`;
            const btnPlus  = `<button class="count-btn" onmousedown="startDeckMod(${i},1)"  onmouseup="stopDeckMod()" onmouseleave="stopDeckMod()" ontouchstart="startDeckMod(${i},1); event.preventDefault();"  ontouchend="stopDeckMod()">+</button>`;

            const cnt = (userDeckConfig && typeof userDeckConfig[i] !== 'undefined') ? userDeckConfig[i] : 0;
            d.innerHTML = `
              <img src="${b.img}" id="deck-img-${i}">
              <div class="builder-item-name">${b.name}</div>
              <div class="count-ctrl">${btnMinus}<span class="count-val" id="deck-cnt-${i}">${cnt}</span>${btnPlus}</div>
            `;
            c.appendChild(d);

            const imgEl = d.querySelector(`#deck-img-${i}`);
            let lpTimer;
            const startLP = () => { lpTimer = setTimeout(() => { playSE('decide'); openPreview(b.img); }, 500); };
            const stopLP  = () => { clearTimeout(lpTimer); };
            imgEl.addEventListener('mousedown', startLP);
            imgEl.addEventListener('mouseup', stopLP);
            imgEl.addEventListener('mouseleave', stopLP);
            imgEl.addEventListener('touchstart', startLP, {passive:true});
            imgEl.addEventListener('touchend', stopLP);
        });
    }

    function autoBuildDeck() { 
        userDeckConfig={}; BUG_MASTER.forEach((_,i)=>userDeckConfig[i]=0); 
        for(let i=0;i<32;i++) userDeckConfig[Math.floor(Math.random()*BUG_MASTER.length)]++; 
        BUG_MASTER.forEach((_,i)=>{ const el=document.getElementById(`deck-cnt-${i}`); if(el) el.innerText=userDeckConfig[i]; });
        modDeckCount(0,0); 
        saveDeckConfigToStorage();
        scheduleAutoSaveDeckSlot();
    
        applyDeckFiltersAndRender();
    }

    // デッキ構築：全カード枚数を0にリセット
    function resetDeckBuilder() {
        if(!confirm('デッキの枚数をすべて0にリセットしますか？')) return;
        userDeckConfig = {};
        BUG_MASTER.forEach((_, i) => userDeckConfig[i] = 0);

        // 表示更新（モーダルが開いているときだけ）
        BUG_MASTER.forEach((_, i) => {
            const el = document.getElementById(`deck-cnt-${i}`);
            if(el) el.innerText = '0';
        });
        modDeckCount(0,0);
        // 現状の挙動（おまかせ）に合わせて即保存
        saveDeckConfigToStorage();
        scheduleAutoSaveDeckSlot();
    }

    function saveDeckAndClose() {
        // 決定を押した時点で、編集中のデッキ名も必ず確定させる
        try{ commitDeckNameEditIfAny(); }catch(e){}
        try{ if(savedDecks && savedDecks[currentDeckSlot]){ const nm=(savedDecks[currentDeckSlot].name||'').trim(); if(!nm) savedDecks[currentDeckSlot].name=`デッキ${currentDeckSlot+1}`; } }catch(e){}
        try{ closeDeckFilterPanel(); }catch(e){}
 
        const total = Object.values(userDeckConfig).reduce((a,b)=>a+b,0);
        if(total!==32) { alert(`デッキは32枚にしてください (現在: ${total}枚)`); return; }
        saveDeckConfigToStorage();
        try{ saveCurrentDeckSlot(); }catch(e){}
        toggleModal('modal-deck');
    }
    function modDeckCount(i,d) { 
        const current = userDeckConfig[i];
        if(current+d>=0) {
            userDeckConfig[i]+=d; 
            const _cntEl = document.getElementById(`deck-cnt-${i}`);
            if(_cntEl) _cntEl.innerText = userDeckConfig[i];
            document.getElementById('total-deck-count').innerText=Object.values(userDeckConfig).reduce((a,b)=>a+b,0);
            scheduleAutoSaveDeckSlot();
            return true;
        }
        document.getElementById('total-deck-count').innerText=Object.values(userDeckConfig).reduce((a,b)=>a+b,0);
        return false;
    }

    function openPreview(src) {
        const overlay = document.getElementById('card-preview-overlay');
        const previewContent = document.getElementById('preview-content');
        previewContent.style.cssText = '';

        let wrap3d = document.getElementById('holo-3d-wrap');
        if (!wrap3d) {
            wrap3d = document.createElement('div');
            wrap3d.id = 'holo-3d-wrap';
            previewContent.parentNode.insertBefore(wrap3d, previewContent);
            wrap3d.appendChild(previewContent);
        }
        wrap3d.style.cssText = 'position:relative;transform-style:preserve-3d;transition:transform 0.08s ease;cursor:default;';

        const T = 16;
        ['holo-edge-l'].forEach(id=>{ const el=document.getElementById(id); if(el) el.remove(); });

        previewContent.style.position = 'relative';
        previewContent.style.transformStyle = 'preserve-3d';
        previewContent.style.transform = `translateZ(${T/2}px)`;
        previewContent.innerHTML = `
<img src="${src}" style="width:100%;height:100%;object-fit:cover;object-position:center;display:block;border-radius:14px;">
<div id="holo-fx" style="position:absolute;inset:0;border-radius:14px;opacity:0;pointer-events:none;mix-blend-mode:screen;transition:opacity 0.1s;"></div>
<div id="holo-sparkles" style="position:absolute;inset:0;border-radius:14px;opacity:0;pointer-events:none;overflow:hidden;"></div>`;

        const backFace = document.createElement('div');
        backFace.id = 'holo-edge-l';
        backFace.style.cssText = `position:absolute;top:0;left:0;width:360px;height:500px;border-radius:20px;overflow:hidden;transform:translateZ(-${T/2}px) rotateY(180deg);backface-visibility:hidden;`;
        backFace.innerHTML = `<img src="カード裏面.png" style="width:100%;height:100%;object-fit:cover;display:block;">`;
        wrap3d.appendChild(backFace);

        overlay.style.display = 'flex';

        if (!document.getElementById('holo-style')) {
            const st = document.createElement('style');
            st.id = 'holo-style';
            st.textContent = '@keyframes holoTwinkle{0%,100%{opacity:0;transform:scale(0.5)}50%{opacity:1;transform:scale(1.5)}}';
            document.head.appendChild(st);
        }

        const fxLayer = document.getElementById('holo-fx');
        const sparkleEl = document.getElementById('holo-sparkles');
        for (let i = 0; i < 28; i++) {
            const s = document.createElement('div');
            const x=Math.random()*100, y=Math.random()*100, sz=1+Math.random()*2.5;
            s.style.cssText=`position:absolute;left:${x}%;top:${y}%;width:${sz}px;height:${sz}px;border-radius:50%;background:white;animation:holoTwinkle ${0.8+Math.random()*1.2}s ease-in-out ${Math.random()*2}s infinite;`;
            sparkleEl.appendChild(s);
        }

        previewContent.style.transformStyle = 'preserve-3d';
        previewContent.style.transition = 'transform 0.08s ease';

        const onMove = (e) => {
            const rect = previewContent.getBoundingClientRect();
            const px = e.touches ? e.touches[0].clientX : e.clientX;
            const py = e.touches ? e.touches[0].clientY : e.clientY;
            if (px < rect.left || px > rect.right || py < rect.top || py > rect.bottom) return;
            const dx = ((px-rect.left)/rect.width)*2-1;
            const dy = ((py-rect.top)/rect.height)*2-1;
            const rotX = -dy * 25;
            const rotY = dx * 25;
            const angle = Math.atan2(dy,dx)*(180/Math.PI)+180;
            const dist = Math.min(Math.sqrt(dx*dx+dy*dy),1);
            wrap3d.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.03)`;
            fxLayer.style.opacity = dist * 0.18;
            fxLayer.style.background = `conic-gradient(from ${angle}deg,rgba(255,0,128,.8),rgba(255,165,0,.8),rgba(255,255,0,.8),rgba(0,255,128,.8),rgba(0,128,255,.8),rgba(128,0,255,.8),rgba(255,0,128,.8))`;
            fxLayer.style.transform = `rotate(${angle*0.3}deg) scale(1.6)`;
            sparkleEl.style.opacity = dist * 0.5;
        };
        const onLeave = () => {
            wrap3d.style.transition = 'transform 0.5s ease';
            wrap3d.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)';
            fxLayer.style.opacity = '0';
            sparkleEl.style.opacity = '0';
            setTimeout(()=>{ wrap3d.style.transition = 'transform 0.08s ease'; }, 500);
        };

        overlay.addEventListener('mousemove', onMove);
        overlay.addEventListener('touchmove', onMove, {passive:true});
        overlay.addEventListener('mouseleave', onLeave);
        overlay.addEventListener('touchend', onLeave);
    }
    function openTrashList(p) { 
        const c=document.getElementById('trash-list-container'); c.innerHTML='';
        document.getElementById('trash-owner-title').innerText = p===1 ? "自分のトラッシュ" : "相手のトラッシュ";
        state[`p${p}`].trash.forEach(x=>{ const i=document.createElement('img'); i.src=x.img; i.onclick=()=>openPreview(x.img); c.appendChild(i); });
        document.getElementById('trash-list-overlay').style.display='flex'; 
    }
    
    // --- バトル場だけ隠す/戻す（背景や設定/ルールは触らない） ---
const BATTLE_HIDE_IDS = [
  'field-area', 'field-divider',
  'hand-p1', 'hand-p2',
  'deck-p1', 'deck-p2',
  'trash-p1', 'trash-p2',
  'item-zone-p1', 'item-zone-p2',
  'turn-glow-p1', 'turn-glow-p2',
  'timer-container',
  'setup-controls',
  'surrender-btn',
  'end-turn-btn'
];

function setBattleLayerVisible(visible) {
  BATTLE_HIDE_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.visibility = visible ? '' : 'hidden';
  });
  // 設定・ルールは対戦中のみ表示
  const tlm = document.getElementById('top-left-menu');
  if(tlm) tlm.style.display = visible ? '' : 'none';
}

let _selectModeLocked = false;
function selectMode(m) {
    if(_selectModeLocked) return;
    _selectModeLocked = true;
    setTimeout(() => { _selectModeLocked = false; }, 3000);
    setBattleLayerVisible(false);

    AudioSys.init();
    playSE('decide');

    const title = document.getElementById('screen-mode');
    const deckBtn = document.getElementById('deck-build-btn');

    // デッキ構築ボタンだけ拡大
    deckBtn.style.transition = "transform 0.6s ease, opacity 0.6s ease";
    deckBtn.style.opacity = "0";

    // タイトル画面は拡大せずフェードのみ
    title.style.transition = "opacity 0.6s ease";
    title.style.opacity = "0";

    setTimeout(() => {
        state.mode = m;
        title.classList.add('hidden');
        deckBtn.style.display = 'none';

        // マルチ・AI選択画面では設定・ルールボタンを表示
        if(m === 'ai' || m === 'online') {
            const tlm = document.getElementById('top-left-menu');
            if(tlm) tlm.style.display = '';
        }

        if(m==='ai') document.getElementById('screen-diff').classList.remove('hidden');
        else if(m==='online') {
            document.getElementById('screen-lobby-select').classList.remove('hidden');
        }
        else prepareGame();
    }, 450);
}


    function backToTitle() {
    _selectModeLocked = false; // タイトルに戻ったらロック解除
    // lobby接続中を解除（戻るで固まらないように）
    try{ cancelConnectAttempt('待機中...'); }catch(e){}
    
    // ★負けエフェクト(赤い光)を解除
    const gc = document.getElementById('game-container');
    if (gc) gc.classList.remove('lose-effect');
 
    try { stopOpponentDots(); } catch(e) {}
clearEndTexts();
    resetBattleState();
state.netGameInitDone = false;
        try { Net.connectLocked = false; Net.gameStartedOnce = false; } catch(e) {}

        state.netGameInitDone = false;

        // 設定は維持したままタイトルへ戻る（reloadしない）
        saveSettingsToStorage();

        // ネットワークを閉じる
        try { if (Net && Net.conn) Net.conn.close(); } catch(e) {}
        try { if (Net && Net.peer) Net.peer.destroy(); } catch(e) {}
        if (Net) { Net.peer=null; Net.conn=null; Net.isHost=false; }

        // 画面を戻す
        document.getElementById('screen-lobby').classList.add('hidden');
        ['screen-lobby-select','screen-account','screen-rematch'].forEach(id=>{ const el=document.getElementById(id); if(el) el.classList.add('hidden'); });
        document.getElementById('screen-diff').classList.add('hidden');
        document.getElementById('screen-mode').classList.remove('hidden');
        // タイトルのランク表示を更新
        try { const el=document.getElementById('title-rank-text'); if(el){ const a=getAcct(); el.textContent='ランク'+calcRank(calcExp(a.wins,a.losses)); } } catch(e) {}

        // 戻ったら落ち葉演出を再始動
        try { initFallingCards(); } catch(e) {}

        // タイトルUIの見た目を復元（selectModeでopacity/displayを変えているため）
        try {
            setBattleLayerVisible(true);
        } catch(e) {}

        // setBattleLayerVisible(true)の後に隠す（中でdisplay:''に戻されるため）
        const _tlm = document.getElementById('top-left-menu'); if(_tlm) _tlm.style.display = 'none';

        const title = document.getElementById('screen-mode');
        title.style.opacity = "1";
        title.style.transition = "";

        const deckBtn = document.getElementById('deck-build-btn');
        if (deckBtn) {
            deckBtn.style.display = '';
            deckBtn.style.opacity = "1";
            deckBtn.style.transform = "";
            deckBtn.style.transition = "";
        }


        // 表示を初期化（UIだけ）
        const ls = document.getElementById('lobby-status'); if(ls) ls.innerText = "待機中.";
        const my = document.getElementById('my-peer-id'); if(my) my.innerText = "Connecting.";
        const tp = document.getElementById('target-peer-id'); if(tp) tp.value = "";

        // 戦闘関連を止めてタイトルBGMに戻す
        stopTimer();
        state.gameStarted = false;
        state.inBattleScene = false;
        state.mode = null;
        // すでにタイトルBGMが流れているなら作り直さない（先頭に戻さず継続）
        if (AudioSys.bgmAudio && AudioSys.bgmAudio.src && AudioSys.bgmAudio.src.includes(gameSettings.titleBgm)) {
            try { AudioSys.bgmAudio.volume = (gameSettings.bgmVol / 100) * 0.3; } catch(e) {}
            if (AudioSys.bgmAudio.paused) {
                AudioSys.bgmAudio.play().catch(()=>{});
            }
        } else {
            AudioSys.playBGM(gameSettings.titleBgm);
        }
    }
    
    function cancelConnectAttempt(reasonMsg){
        try{ if(Net && Net.connectTimeoutId){ clearTimeout(Net.connectTimeoutId); Net.connectTimeoutId = null; } }catch(e){}
        try{ if(Net && Net.conn && !Net.conn.open){ try{ Net.conn.close(); }catch(e){} } }catch(e){}
        try{ if(Net) { Net.conn = null; Net.connectLocked = false; } }catch(e){}
        const btn = document.getElementById('connect-btn');
        if(btn){ btn.disabled = false; btn.innerText = '接続'; }
        const st = document.getElementById('lobby-status');
        if(st) st.innerText = reasonMsg || '待機中...';
    }

function connectToPeer() {
        const id = document.getElementById('target-peer-id').value.trim();
        const btn = document.getElementById('connect-btn');
        const st = document.getElementById('lobby-status');
        if (!id) { if (st) st.innerText = "相手IDを入力してください"; return; }

        // 接続ボタン連打で複数回接続→初期ドロー(×5)重複の原因になるのでガード
        if (Net.connectLocked || (Net.conn && (Net.conn.open || Net.conn.peer))) return;

        Net.connectLocked = true;
        if (btn) { btn.disabled = true; btn.innerText = "接続中..."; }

        try { Net.connect(id);
            // 7秒でタイムアウト（誤IDで接続中が永遠にならないように）
            try { if(Net.connectTimeoutId) clearTimeout(Net.connectTimeoutId); } catch(e){}
            Net.connectTimeoutId = setTimeout(()=>{
                try{
                    if(Net && Net.conn && !Net.conn.open){
                        cancelConnectAttempt('接続できませんでした。IDを確認してください');
                    }
                }catch(e){}
            }, 7000);
}
        catch (e) {
            Net.connectLocked = false;
            if (btn) { btn.disabled = false; btn.innerText = "接続"; }
            if (st) st.innerText = "接続失敗";
        }
    }
    let _setDiffLocked = false;
    function setDiff(v) {
        if(_setDiffLocked) return;
        _setDiffLocked = true;
        setTimeout(() => { _setDiffLocked = false; }, 3000);
        state.difficulty=v;
        document.getElementById('screen-diff').classList.add('hidden');
        prepareGame();
    }

    function prepareGame() {
        AudioSys.playBGM(gameSettings.battleBgm); playSE('decide');
        const makeDeck = () => {
             if(Object.values(userDeckConfig).reduce((a,b)=>a+b,0)===32) {
                 let d=[]; BUG_MASTER.forEach((b,i)=>{ for(let k=0;k<userDeckConfig[i];k++) d.push(JSON.parse(JSON.stringify({...b, id:Math.random(), currentInvinc:false, mimicActive:false, mimicCooldown:false, mimicCooldownTurns:0}))); });
                 return d.sort(()=>Math.random()-0.5);
             }
             return Array.from({length:32}, () => JSON.parse(JSON.stringify({...BUG_MASTER[Math.floor(Math.random()*BUG_MASTER.length)], id:Math.random(), currentInvinc:false, mimicActive:false, mimicCooldown:false, mimicCooldownTurns:0})));
        };
        state.p1.deck = buildDeckFromConfig(normalizeUserDeckConfig(userDeckConfig));
        state.p2.deck = (state.mode === 'ai') ? buildDeckFromPreset(AI_DECK_PRESET) : makeDeck();
        prepareGameVisuals();
    }
    function prepareGameVisuals() {
        // ★修正: 前回ゲームのYOU WIN/LOSE・ターン表示を消してから開始
        clearEndTexts();
        const tm = document.getElementById('turn-msg');
        if(tm){ tm.innerText = ''; tm.style.opacity = 0; tm.style.color = ''; }
        // ★修正: ターン終了・降参ボタンを必ずリセット（再戦後に残留するバグ防止）
        const _etb2 = document.getElementById('end-turn-btn');
        if(_etb2) _etb2.style.display = 'none';
        const _sb2 = document.getElementById('surrender-btn');
        if(_sb2) _sb2.classList.add('hidden');
        setBattleLayerVisible(true);
        state.inBattleScene = true;
        document.getElementById('screen-lobby').classList.add('hidden');
        ['screen-lobby-select','screen-account','screen-rematch'].forEach(id=>{ const el=document.getElementById(id); if(el) el.classList.add('hidden'); });
        AudioSys.playBGM(gameSettings.battleBgm);
        state.isInitialSetup = true;
        state.revealOpponentField = false;
        // 最初はhidden：マリガン完了後に表示する
        try{ document.getElementById('setup-controls').classList.add('hidden'); }catch(e){}
        try{ document.getElementById('ready-btn').disabled=false; document.getElementById('ready-btn').innerText='準備OK'; }catch(e){}
        try{ document.getElementById('setup-msg').innerText='バトル場に蟲を出して準備OK！'; }catch(e){}
 
        // ターン数カウント（ローカル視点: p1=自分, p2=相手）
        state.p1TurnCount = 0;
        state.p2TurnCount = 0;
        state.firstPlayerGlobal = null;
        state.localFirstPlayer = null;

        (async () => {
          try {
            const initialCount = 5; // 初期手札枚数（現仕様）
            for (let i = 0; i < initialCount; i++) {
                if (!state.p1.deck.length || !state.p2.deck.length) break;

                const c1 = state.p1.deck.pop();

                // 自分：到着と同時に手札へ反映（あなた側はこれでタイミングが完璧）
                const myTask = playSingleDrawAnim(1, c1, {
                    reveal: true,
                    onArrive: () => {
                        state.p1.hand.push(c1);
                        if (state.p1.hand && state.p1.hand.sort) {
                            state.p1.hand.sort(handSortCmp);
                        }
                        updateUI();
                    }
                });

                // 相手：蟲神器113の軽い演出（山札→手札へ直行）で、到着と同時に手札へ反映
                const oppTask = drawOneForOpponentWithAnim();

                await Promise.all([myTask, oppTask]);

                // 次のループに入る前に1フレーム待って描画を確実に反映
                await nextFrame();
            }

            state.isInitialSetup = false;

            // ---- P2（相手）のマリガン用：同じく5枚引き直し（AI/ローカル） ----
            async function doP2MulliganIfNeeded() {
                const p2HasBug = state.p2.hand.some(c => !c.type || c.type === 'bug')
                    || state.p2.field.some(c => c && (!c.type || c.type === 'bug'));
                if (p2HasBug) return; // 蟲カードがあるので引き直し不要

                // P2の手札をデッキに戻す（アニメ）
                const handEl2 = document.getElementById('hand-p2');
                const deckEl2 = document.getElementById('deck-p2');
                if (handEl2 && deckEl2) {
                    const deckRect2 = deckEl2.getBoundingClientRect();
                    const cards2 = Array.from(handEl2.querySelectorAll('.card-container'));
                    const rects2 = cards2.map(ct => ct.getBoundingClientRect());
                    cards2.forEach(ct => { ct.style.visibility = 'hidden'; });
                    const flyProms2 = cards2.map((ct, idx) => new Promise(res => {
                        const cr = rects2[idx];
                        const dx = deckRect2.left + deckRect2.width/2 - (cr.left + cr.width/2);
                        const dy = deckRect2.top  + deckRect2.height/2 - (cr.top  + cr.height/2);
                        const clone = ct.cloneNode(true);
                        clone.style.cssText = `position:fixed;left:${cr.left}px;top:${cr.top}px;width:${cr.width}px;height:${cr.height}px;z-index:${520+idx};visibility:visible;pointer-events:none;transition:transform 0.4s ease-in ${idx*40}ms,opacity 0.4s ease-in ${idx*40}ms;`;
                        document.body.appendChild(clone);
                        requestAnimationFrame(() => { clone.style.transform=`translate(${dx}px,${dy}px) scale(0.5)`; clone.style.opacity='0'; });
                        setTimeout(() => { clone.remove(); res(); }, 500 + idx * 40);
                    }));
                    await Promise.all(flyProms2);
                    handEl2.innerHTML = '';
                }
                state.p2.deck.push(...state.p2.hand);
                state.p2.hand = [];
                for (let i = state.p2.deck.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [state.p2.deck[i], state.p2.deck[j]] = [state.p2.deck[j], state.p2.deck[i]];
                }
                await new Promise(r => setTimeout(r, 200));
                for (let i = 0; i < 5; i++) {
                    if (!state.p2.deck.length) break;
                    await drawOneForOpponentWithAnim();
                    await nextFrame();
                }
                // P2がさらに蟲カードを引けなかった場合は再帰（引けるまで繰り返す）
                await doP2MulliganIfNeeded();
            }

            // ============================================================
            // 自分(P1)の手札をアニメ付きでデッキに戻すヘルパー
            // クローン取得→state/DOM即クリア→クローンアニメの順で行う
            // ============================================================
            async function animateP1HandToDeck() {
                const handEl = document.getElementById('hand-p1');
                const deckEl = document.getElementById('deck-p1');
                // DOMにカードがなければupdateUIで先に描画してから計測
                if (handEl && handEl.querySelectorAll('.card-container').length === 0 && state.p1.hand.length > 0) {
                    updateUI();
                    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                }
                if (handEl && deckEl && handEl.querySelectorAll('.card-container').length > 0) {
                    const deckRect = deckEl.getBoundingClientRect();
                    const cards = Array.from(handEl.querySelectorAll('.card-container'));
                    const cardRects = cards.map(ct => ct.getBoundingClientRect());
                    // 先にクローンをDOMへ追加（transition:noneで初期位置に固定）
                    const clones = cards.map((ct, idx) => {
                        const ctRect = cardRects[idx];
                        const clone = ct.cloneNode(true);
                        clone.style.cssText = `position:fixed;left:${ctRect.left}px;top:${ctRect.top}px;width:${ctRect.width}px;height:${ctRect.height}px;z-index:${520+idx};visibility:visible;pointer-events:none;transform:none;opacity:1;transition:none;`;
                        document.body.appendChild(clone);
                        return { clone, ctRect };
                    });
                    // クローン追加後にstateとDOMをクリア
                    state.p1.deck.push(...state.p1.hand);
                    state.p1.hand = [];
                    handEl.innerHTML = '';
                    updateUI();
                    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
                    const animPromises = clones.map(({ clone, ctRect }, idx) => new Promise(res => {
                        const dx = deckRect.left + deckRect.width/2 - (ctRect.left + ctRect.width/2);
                        const dy = deckRect.top  + deckRect.height/2 - (ctRect.top  + ctRect.height/2);
                        clone.style.transition = `transform 0.4s ease-in ${idx*50}ms, opacity 0.4s ease-in ${idx*50}ms`;
                        clone.style.transform = `translate(${dx}px,${dy}px) scale(0.5)`;
                        clone.style.opacity = '0';
                        setTimeout(() => { clone.remove(); res(); }, 500 + idx * 50);
                    }));
                    await Promise.all(animPromises);
                } else {
                    // DOMがない場合でもstateはクリア
                    state.p1.deck.push(...state.p1.hand);
                    state.p1.hand = [];
                }
            }

            async function doMulliganIfNeeded() {
                // 相手のMULLIGAN処理（キュー）が完了するまで待つ
                // → state.p2.hand が確定した状態で p2HasBugNow を評価するため
                if (state.mode === 'online') {
                    // アニメではなくデータ確定を待つ
                    const _t0 = Date.now();
                    while (!Net._mulliganDataReady && Net._mulliganRunning) {
                        await new Promise(r => setTimeout(r, 50));
                        if (Date.now() - _t0 > 5000) break;
                    }
                    Net._mulliganDataReady = false;
                }

                const p1HasBug = state.p1.hand.some(c => !c.type || c.type === 'bug')
                    || state.p1.field.some(c => c && (!c.type || c.type === 'bug'));
                if (p1HasBug) {
                    document.getElementById('setup-controls').classList.remove('hidden');
                    if (state.mode === 'online') startTimer(60, onAutoReady);
                    return;
                }

                // P1が蟲カードなし → 引き直し
                await new Promise(r => setTimeout(r, 1000));

                // 手札→山札アニメ（アニメ中にupdateUI()が呼ばれても復活しない設計）
                await animateP1HandToDeck();

                // デッキシャッフル
                for (let i = state.p1.deck.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [state.p1.deck[i], state.p1.deck[j]] = [state.p1.deck[j], state.p1.deck[i]];
                }

                // この時点でのP2の蟲有無を記録（+1枚判定に使う）
                const p2HasBugNow = state.p2.hand.some(c => !c.type || c.type === 'bug');

                if (state.mode === 'online') {
                    // ① 相手にMULLIGAN通知（シャッフル後のデッキも送って両者のデッキ順を同期）
                    Net.send('MULLIGAN', { count: 5, drawExtra: p2HasBugNow, newDeck: state.p1.deck });
                    // ② 自分の画面でも相手(P2)の+1枚演出を表示
                    if (p2HasBugNow) {
                        await drawOneForOpponentWithAnim();
                        await nextFrame();
                    }
                } else if (p2HasBugNow) {
                    await drawOneForOpponentWithAnim();
                    await nextFrame();
                }

                // P1を5枚引き直す
                for (let i = 0; i < 5; i++) {
                    if (!state.p1.deck.length) break;
                    const card = state.p1.deck.pop();
                    await playSingleDrawAnim(1, card, {
                        reveal: true,
                        onArrive: () => { state.p1.hand.push(card); state.p1.hand.sort(handSortCmp); updateUI(); }
                    });
                    await nextFrame();
                }

                // 引き直してもまだ蟲カードがなければ再帰
                await doMulliganIfNeeded();
            }

            // まずP2のマリガンをチェック（AI/ローカル）、その後P1をチェック
            if (state.mode !== 'online') {
                await doP2MulliganIfNeeded();
            }
            await doMulliganIfNeeded();
          } catch(e) {
            console.error('[prepareGameVisuals] async error:', e);
            // フォールバック: エラーが起きてもsetup-controlsを表示する
            try {
                document.getElementById('setup-controls').classList.remove('hidden');
                if (state.mode === 'online') startTimer(60, onAutoReady);
            } catch(_e) {}
          }
        })();
    }

    function onReadyClick() {
        if(state.p1.field.every(s=>s===null)) { alert("蟲を場に出してください"); return; }
        state.p1.isReady = true;
        document.getElementById('ready-btn').disabled = true;
        document.getElementById('ready-btn').innerText = "相手を待っています...";
        document.getElementById('setup-msg').innerText = "対戦準備中...";
        stopTimer(); 
        if(state.mode === 'online') { Net.send('READY', {}); if(state.p2.isReady) checkStartJanken(); } 
        else { setTimeout(() => { state.p2.isReady = true; checkStartJanken(); }, 500); }
    }

    function checkStartJanken() {
        if(state.p1.isReady && state.p2.isReady) {
            document.getElementById('setup-controls').classList.add('hidden');
            showJanken();
        }
    }

    function showJanken() {
        stopTimer();
        document.getElementById('screen-janken').classList.remove('hidden');
        // じゃんけん中は手札・ターン終了ボタン・「相手を待っています」を非表示
        document.getElementById('hand-p1').style.visibility = 'hidden';
        document.getElementById('hand-p2').style.visibility = 'hidden';
        document.getElementById('end-turn-btn').style.display = 'none';
        const rb = document.getElementById('ready-btn');
        if(rb){ rb.style.display = 'none'; }
        const sm = document.getElementById('setup-msg');
        if(sm){ sm.innerText = ''; }
        // JANKEN_OPEN_RESET: 表示を毎回初期化
        try{
            const h1=document.getElementById('janken-p1-hand');
            const h2=document.getElementById('janken-p2-hand');
            if(h1){ h1.classList.remove('winner-glow'); h1.innerText='？'; }
            if(h2){ h2.classList.remove('winner-glow'); h2.innerText='？'; }
            const jp=document.getElementById('janken-prompt'); if(jp) jp.innerText='じゃんけん…';
        }catch(e){}

        state.myJanken = null; state.opJanken = null;
        document.getElementById('janken-options').classList.remove('hidden');
        document.getElementById('janken-status').innerText = "手を選んでください";
        if (state.mode !== 'ai') {
            startTimer(10, () => { if(state.myJanken === null) { playJanken(Math.floor(Math.random()*3)); } });
        } else {
            document.getElementById('janken-status').innerText = "手を選んでください";
        }
    }

    function playJanken(choice) {
        playSE('click');
        state.myJanken = choice;
        document.getElementById('janken-options').classList.add('hidden');
        document.getElementById('janken-status').innerText = "相手の選択を待っています...";
        if (state.mode === 'online') { Net.send('JANKEN_PICK', { hand: choice }); if(Net.isHost) checkJankenMatch(); } 
        else { setTimeout(() => { const ai = Math.floor(Math.random()*3); jankenCountdown(() => resolveJankenVisuals(choice, ai, calcWinner(choice, ai))); }, 300); }
    }

    function checkJankenMatch() {
        if (state.myJanken !== null && state.opJanken !== null) {
            const w = calcWinner(state.myJanken, state.opJanken);
            jankenCountdown(() => {
                resolveJankenVisuals(state.myJanken, state.opJanken, w);
                Net.send('JANKEN_RESULT', { p1Hand: state.myJanken, p2Hand: state.opJanken, winner: w });
            });
        }
    }

    function jankenCountdown(callback) {
        const prompt = document.getElementById('janken-prompt');
        const p1 = document.getElementById('janken-p1-hand');
        const p2 = document.getElementById('janken-p2-hand');
        const BEAT = 550; // 1拍のms（リズムの基本単位）

        // 手を振る（上→下→戻る）
        function shake(el) {
            el.classList.remove('janken-shake');
            void el.offsetWidth;
            el.classList.add('janken-shake');
        }
        function shakeAll() { shake(p1); shake(p2); }

        // テキストをポップ表示
        function showPrompt(text) {
            prompt.innerText = text;
            prompt.classList.remove('janken-prompt-pop');
            void prompt.offsetWidth;
            prompt.classList.add('janken-prompt-pop');
        }

        // じゃん（1拍）→ けん（1拍）→ ポン！（手が変わりながら振れる）
        showPrompt('じゃん…');
        shakeAll();

        setTimeout(() => {
            showPrompt('けん…');
            shakeAll();
        }, BEAT);

        setTimeout(() => {
            showPrompt('ポン！');
            // ポンは上に上がってそのまま止まる専用アニメ
            p1.classList.remove('janken-shake');
            p2.classList.remove('janken-shake');
            void p1.offsetWidth;
            p1.classList.add('janken-pon');
            p2.classList.add('janken-pon');
            // 上がりきったタイミングで手を変える
            setTimeout(() => {
                callback(); // resolveJankenVisualsで手の画像が変わる
            }, BEAT * 0.4);
        }, BEAT * 2);
    }

    function calcWinner(h1, h2) {
        if (h1 === h2) return 0;
        if ((h1===0 && h2===1)||(h1===1 && h2===2)||(h1===2 && h2===0)) return 1; 
        return 2; 
    }

    function resolveJankenVisuals(p1Hand, p2Hand, winner) {
        stopTimer();
        const hands = ["✊", "✌️", "✋"];
        let visualMe, visualOp;
        if (state.mode === 'online' && !Net.isHost) { visualMe = p2Hand; visualOp = p1Hand; } 
        else { visualMe = p1Hand; visualOp = p2Hand; }

        playSE('janken_pon');
        document.getElementById('janken-prompt').innerText = "ポン！";
        document.getElementById('janken-p1-hand').src = [0,1,2].includes(visualMe) ? ['guu.png','choki.png','paa.png'][visualMe] : 'guu.png';
        document.getElementById('janken-p2-hand').src = [0,1,2].includes(visualOp) ? ['guu.png','choki.png','paa.png'][visualOp] : 'guu.png';
        
        setTimeout(() => {
            let actualWinner = 0;
            if (state.mode === 'online' && !Net.isHost) { if (winner === 2) actualWinner = 1; else if (winner === 1) actualWinner = 2; } 
            else { if (winner === 1) actualWinner = 1; else if (winner === 2) actualWinner = 2; }

            if (actualWinner === 0) {
                document.getElementById('janken-prompt').innerText = "あいこで...";
                // あいこでもバウンド演出
                const _p1a = document.getElementById('janken-p1-hand');
                const _p2a = document.getElementById('janken-p2-hand');
                _p1a.classList.remove('janken-pon','janken-shake'); void _p1a.offsetWidth;
                _p2a.classList.remove('janken-pon','janken-shake'); void _p2a.offsetWidth;
                _p1a.classList.add('janken-shake');
                _p2a.classList.add('janken-shake');
                setTimeout(() => { 
                    document.getElementById('janken-p1-hand').src='guu.png'; document.getElementById('janken-p2-hand').src='guu.png'; 
                    state.myJanken = null; state.opJanken = null;
                    document.getElementById('janken-options').classList.remove('hidden'); 
                    document.getElementById('janken-status').innerText = "手を選んでください";
                    if (state.mode !== 'ai') startTimer(10, () => { if(state.myJanken===null) playJanken(Math.floor(Math.random()*3)); });
                }, 1200);
            } else {
                playSE('decide');
                const _winEl = document.getElementById(actualWinner===1 ? 'janken-p1-hand' : 'janken-p2-hand');
                const _loseEl = document.getElementById(actualWinner===1 ? 'janken-p2-hand' : 'janken-p1-hand');
                _winEl.classList.add('winner-glow');
                _loseEl.classList.add('loser-dim');
                document.getElementById('janken-prompt').innerText = actualWinner===1 ? "あなたの先攻！" : "相手の先攻！";
                // winner は「ホスト視点」で 1=ホスト先攻 / 2=ゲスト先攻 / 0=あいこ
                state.firstPlayerGlobal = winner;
                // 自分がホストなら global=1、ゲストなら global=2
                const myGlobal = (state.mode === 'online') ? (Net.isHost ? 1 : 2) : 1;
                // ローカル(p1=自分)視点に変換して currentPlayer を決める
                state.localFirstPlayer = (winner === myGlobal) ? 1 : 2;
                state.currentPlayer = state.localFirstPlayer;
                setTimeout(() => {
                    document.getElementById('screen-janken').classList.add('hidden');
                    // じゃんけん終了後に手札を再表示
                    document.getElementById('hand-p1').style.visibility = '';
                    document.getElementById('hand-p2').style.visibility = '';
                    // JANKEN_DOM_RESET_AFTER_HIDE: 次戦に前回表示を持ち越さない
                    try{
                        const h1=document.getElementById('janken-p1-hand');
                        const h2=document.getElementById('janken-p2-hand');
                        if(h1) { h1.classList.remove('winner-glow','loser-dim'); h1.src='guu.png'; }
                        if(h2) { h2.classList.remove('winner-glow','loser-dim'); h2.src='guu.png'; }
                        const jp=document.getElementById('janken-prompt'); if(jp) jp.innerText='じゃんけん…';
                        const js=document.getElementById('janken-status'); if(js) js.innerText='手を選んでください';
                        const opts=document.getElementById('janken-options'); if(opts) opts.classList.remove('hidden');
                    }catch(e){}

                    document.getElementById('surrender-btn').classList.remove('hidden');
                    state.gameStarted = true;
                    state.revealOpponentField = true;
                    state.turnNumber = 0;
                    if(state.mode === 'ai' || (state.mode === 'local' && actualWinner===2)) {
                        for(let i of PLACEMENT_PRIORITY) { if(state.p2.field[i]===null && state.p2.hand.length>0) { state.p2.field[i]=state.p2.hand.pop(); break; } }
                    }
                    updateUI(); startTurn();
                }, 1500);
            }
        }, 1000);
    }


    function handSortCmp(a, b) {
        const typeOrder = { undefined: 0, bug: 0, season: 1, time: 2, environment: 3, weather: 4, item: 5 };
        const ta = typeOrder[a.type] ?? 0;
        const tb = typeOrder[b.type] ?? 0;
        if (ta !== tb) return ta - tb;
        return String(a.name || '').localeCompare(String(b.name || ''), 'ja');
    }
    function startTurn() {
        // ターン開始（両プレイヤーの手番ごとに+1）
        if (state.gameStarted) state.turnNumber++;

        const isMyTurn = state.currentPlayer === 1;
        const _tm = document.getElementById('turn-msg');
        _tm.innerText = isMyTurn ? "自分のターン" : "相手のターン中...";
        _tm.style.color = isMyTurn ? "#3498db" : "#e74c3c";
        _tm.classList.remove('banner-in');
        _tm.classList.remove('banner-in-hold');
        requestAnimationFrame(() => {
            if(!isMyTurn && state.mode === 'online'){
                // 相手ターン：中央で止まる演出
                _tm.classList.add('banner-in-hold');
                _tm.style.opacity = 1;
                state._opTurnMsgToken = (state._opTurnMsgToken || 0) + 1;
            } else if(isMyTurn) {
                // 自分のターン：中央で止まり、クリック/タッチするまで表示
                _tm.classList.add('banner-in-hold');
                _tm.style.opacity = 1;
                state._myTurnMsgToken = (state._myTurnMsgToken || 0) + 1;
                const _tok = state._myTurnMsgToken;
                const _hideMyTurn = () => {
                    if(_tok !== state._myTurnMsgToken) return;
                    state._myTurnMsgToken++;
                    document.removeEventListener('click', _hideMyTurn);
                    document.removeEventListener('touchstart', _hideMyTurn);
                    // スライドアウト演出
                    _tm.classList.remove('banner-in-hold');
                    _tm.classList.add('banner-in-out');
                    setTimeout(() => {
                        _tm.classList.remove('banner-in-out');
                        _tm.style.opacity = 0;
                    }, 400);
                };
                // rAF2回後に登録（ターン開始直後のクリックで即消えるのを防ぐ）
                requestAnimationFrame(() => requestAnimationFrame(() => {
                    if(_tok !== state._myTurnMsgToken) return;
                    document.addEventListener('click', _hideMyTurn);
                    document.addEventListener('touchstart', _hideMyTurn);
                }));
            } else {
                _tm.classList.add('banner-in');
                _tm.style.opacity = 1;
            }
        });

        // バトル場のターン光らせ（ゲーム開始後のみ）
        const fp1 = document.getElementById('turn-glow-p1');
        const fp2 = document.getElementById('turn-glow-p2');
        if(fp1 && fp2) {
            const glowOn = state.gameStarted;
            fp1.classList.toggle('active', glowOn && isMyTurn);
            fp2.classList.toggle('active', glowOn && !isMyTurn);
        }
        
        // アニメーション終了後に自動でopacity=0になる（両ターン共通）
        
        state.isProcessing = false; state.selectedAttacker = null; state.selectedSkill = null; state.canPlaySideCard = true; 
        
        // 現在手番プレイヤーのフィールドの状態を更新
        const turnPlayerField = state.currentPlayer === 1 ? state.p1.field : state.p2.field;
        turnPlayerField.forEach(c => {
            if(!c) return;

            // 擬態の効果（無敵）は「次の自分のターン開始時」に解除
            if (c.mimicActive) {
                c.mimicActive = false;
                c.currentInvinc = false;
            }

            // 擬態：このターン開始で「このターンに擬態を使った」フラグをリセット
            if (c.mimicUsedThisTurn == null) c.mimicUsedThisTurn = false;
            c.mimicUsedThisTurn = false;

            // 擬態クールダウン（同じカードは「次の自分ターン」だけ使えない）
            if (c.mimicCooldownTurns == null) c.mimicCooldownTurns = c.mimicCooldown ? 1 : 0; // 互換
            c.mimicCooldown = (c.mimicCooldownTurns > 0);
        });

        state.p1.hand.sort(handSortCmp);
        // じゃんけん直後の裏返し演出中は updateUI() の再描画で演出が潰れるので、ここでは描画しない
        if(!state.revealOpponentField) updateUI();

        
(async () => {
    if (state.gameStarted) {
        if (state.mode === 'online') {
            // オンライン：自分のターンだけ自分が引く（相手のドローは相手側で処理）
            if (isMyTurn) await drawCardsWithAnimation(1, 1, { reveal: true });
        } else if (state.mode === 'ai') {
            // AI：自分は演出あり、相手(AI)は演出なし
            if (isMyTurn) await drawCardsWithAnimation(1, 1, { reveal: true });
            else await drawCardsWithAnimation(2, 1, { reveal: false });
            } else {
            // ローカル等：手番プレイヤーだけ引く（p2は演出なし）
            if (state.currentPlayer === 1) await drawCardsWithAnimation(1, 1, { reveal: true });
            else await drawCardsWithAnimation(2, 1, { reveal: false });
            }
    }// AIの手番は「AIのドロー完了後」に行動開始
            if (state.mode === 'ai' && !isMyTurn) {
                setTimeout(aiAction, 1500);
            }
        })();

        if (state.mode === 'online' && !isMyTurn) {
            startTimer(60, null); 
        } else {
            if(state.gameStarted) { enforceFieldPlacement(()=>{}); }
        }
    }

    function enforceFieldPlacement(cb) {
        if(state.currentPlayer===1 && state.p1.field.every(c=>c===null) && state.p1.hand.length>0) {
            state.waitingForPlacement = true; state.postPlacementAction = cb;
            const msg = document.getElementById('turn-msg');
            msg.innerText = "バトル場に蟲を出せ！";
            msg.style.opacity = 1;
            msg.style.color = "#e74c3c";
            document.getElementById('end-turn-btn').style.display='none';
            stopTimer();
            if(state.mode === 'online') {
                Net.send('SYNC_TIMER', { type: 'placement' });
                startTimer(60, () => autoPlayTurn());
            } else if (state.mode === 'ai') { /* AI: already stopped */ } else {
                startTimer(60, () => autoPlayTurn());
            }
        } else {
            if(state.currentPlayer===1) {
                document.getElementById('end-turn-btn').style.display='block';
                if (state.mode === 'ai') stopTimer();
                else startTimer(60, () => autoPlayTurn());
            }
        }
    }

    
    // --- ドロー演出（1枚ずつ / 3Dフリップ） ---
    // p: 1=自分, 2=相手（ローカル視点）
    
function nextFrame(){ return new Promise(r=>requestAnimationFrame(()=>r())); }
/* ===== 相手ドロー演出：P1と同じplaySingleDrawAnimを使い裏面で3Dアニメ ===== */
async function drawOneForOpponentWithAnim() {
    if (!state.p2.deck || state.p2.deck.length === 0) return null;
    const card = state.p2.deck.pop();
    await playSingleDrawAnim(2, card, {
        reveal: false,
        onArrive: () => {
            state.p2.hand.push(card);
            if (state.p2.hand && state.p2.hand.sort) {
                state.p2.hand.sort(handSortCmp);
            }
            updateUI();
        }
    });
    return card;
}

async function drawOpponentCardsWithAnim(count){
    for(let i=0;i<count;i++){
        if(!state.p2.deck || state.p2.deck.length===0) break;
        await drawOneForOpponentWithAnim();
    }
}

// デッキから引かずに指定カードをアニメで手札に追加（マリガン用）
async function drawOpponentCardAnimOnly(card) {
    await playSingleDrawAnim(2, card, {
        reveal: false,
        onArrive: () => {
            state.p2.hand.push(card);
            if (state.p2.hand.sort) state.p2.hand.sort(handSortCmp);
            updateUI();
        }
    });
}

function playSingleDrawAnim(p, card, opt) {
        opt = opt || {};
        const reveal = !!opt.reveal; // 自分のドローのみ表を見せる

        // WAAPI helper
        const waitAnim = (anim) => anim && anim.finished ? anim.finished.catch(()=>{}) : Promise.resolve();
        const sleep = (ms) => new Promise(r=>setTimeout(r, ms));

        // 位置は「left/topアニメ」ではなく「transform: translate3d」で動かす（見た目は同じ、処理は軽い）
        return new Promise(async (resolve) => {
            const deckEl = document.getElementById(`deck-p${p}`);
            const handEl = document.getElementById(`hand-p${p}`);
            const deckRect = deckEl ? deckEl.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
            const handRect = handEl ? handEl.getBoundingClientRect() : { left: window.innerWidth/2, top: window.innerHeight/2, width: 0, height: 0 };

            // start / targets
            const sx = (deckRect.left + deckRect.width/2 - 45);
            const sy = (deckRect.top  + deckRect.height/2 - 65);
            const cx = (window.innerWidth/2 - 45);
            const cy = (window.innerHeight/2 - 65);
            const tx = (handRect.left + handRect.width/2 - 45);
            const ty = (handRect.top + 10);

            const visual = document.createElement('div');
            visual.className = 'anim-card';
            visual.style.zIndex = '800';
            visual.style.backgroundImage = "url('カード裏面.png')";
            visual.style.left = '0px';
            visual.style.top  = '0px';
            visual.style.opacity = '1';
            visual.style.transform = `translate3d(${sx}px, ${sy}px, 0) scale(1) rotateY(0deg)`;
            document.body.appendChild(visual);

            if (typeof playSE === 'function') playSE('draw');

            // 相手のドロー（reveal=false）
            // mulliganオプションがあれば中央経由の演出、通常は速い演出
            if (p === 2 && !reveal) {
                if (opt && opt.showCenter) {
                    // マリガン用：山札→中央（裏面で停止）→手札
                    const a1 = visual.animate([
                        { transform: `translate3d(${sx}px, ${sy}px, 0) scale(1) rotateY(0deg)`, opacity: 1 },
                        { transform: `translate3d(${cx}px, ${cy}px, 0) scale(1.55) rotateY(0deg)`, opacity: 1 }
                    ], { duration: 240, easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)', fill: 'forwards' });
                    await waitAnim(a1);
                    await sleep(200);
                    const a2 = visual.animate([
                        { transform: `translate3d(${cx}px, ${cy}px, 0) scale(1.55) rotateY(0deg)`, opacity: 1 },
                        { transform: `translate3d(${tx}px, ${ty}px, 0) scale(1) rotateY(0deg)`, opacity: 1 }
                    ], { duration: 300, easing: 'ease-in', fill: 'forwards' });
                    await waitAnim(a2);
                    try { if(opt && typeof opt.onArrive === 'function') opt.onArrive(); } catch(e){}
                    try { visual.remove(); } catch(e){}
                    resolve();
                    return;
                }
                const anim = visual.animate([
                    { transform: `translate3d(${sx}px, ${sy}px, 0) scale(1.0) rotate(180deg)`, opacity: 1 },
                    { transform: `translate3d(${tx}px, ${ty}px, 0) scale(1.05) rotate(180deg)`, opacity: 0.85 }
                ], { duration: 150, easing: 'ease-out', fill: 'forwards' });

                await waitAnim(anim);
                try { if(opt && typeof opt.onArrive === 'function') opt.onArrive(); } catch(e){}
                try { visual.remove(); } catch(e){}
                resolve();
                return;
            }

            // Phase 1: 中央へ（0.24s）
            const a1 = visual.animate([
                { transform: `translate3d(${sx}px, ${sy}px, 0) scale(1) rotateY(0deg)`, opacity: 1 },
                { transform: `translate3d(${cx}px, ${cy}px, 0) scale(1.55) rotateY(0deg)`, opacity: 1 }
            ], { duration: 240, easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)', fill: 'forwards' });
            await waitAnim(a1);

            // 旧実装の「0ms→中央 / 300msでめくり開始」を維持（= 60ms停止）
            await sleep(60);

            // Phase 2: めくり（自分だけ）+ フラッシュ（旧: 300ms開始）
            if (reveal) {
                const a2a = visual.animate([
                    { transform: `translate3d(${cx}px, ${cy}px, 0) scale(1.55) rotateY(0deg)` },
                    { transform: `translate3d(${cx}px, ${cy}px, 0) scale(1.55) rotateY(90deg)` }
                ], { duration: 140, easing: 'linear', fill: 'forwards' });
                await waitAnim(a2a);

                // swap face at 90deg
                try { visual.style.backgroundImage = `url('${card.img}')`; } catch(e){}

                const a2b = visual.animate([
                    { transform: `translate3d(${cx}px, ${cy}px, 0) scale(1.55) rotateY(90deg)` },
                    { transform: `translate3d(${cx}px, ${cy}px, 0) scale(2.05) rotateY(0deg)` }
                ], { duration: 140, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' });

                // flashは使い回し（DOM生成コスト削減）
                try{
                    let flash = document.getElementById('draw-flash');
                    if(!flash){
                        flash = document.createElement('div');
                        flash.id = 'draw-flash';
                        flash.className = 'flash-effect';
                        document.body.appendChild(flash);
                    }
                    // re-trigger
                    flash.style.animation = 'none';
                    void flash.offsetWidth;
                    flash.style.animation = 'flash-anim 0.5s ease-out forwards';
                }catch(e){}

                if (typeof playSE === 'function') playSE('decide');
                await waitAnim(a2b);

                // 旧実装の「手札へ(760ms開始)」に合わせて待機（240+60+280=580 → 760まで180ms）
                await sleep(180);
            } else {
                // めくり無しでも「手札へ(760ms開始)」に合わせる（240+60=300 → 760まで460ms）
                await sleep(460);
            }

            // Phase 3: 手札へ（0.26s） + 透明化（旧: 760ms開始）
            const endRot = (p === 2) ? ' rotate(180deg)' : '';
            const a3 = visual.animate([
                { transform: getComputedStyle(visual).transform, opacity: 1 },
                { transform: `translate3d(${tx}px, ${ty}px, 0) scale(1.0)${endRot}`, opacity: 0.65 }
            ], { duration: 260, easing: 'ease-out', fill: 'forwards' });

            // 到着＝手札反映（旧: 1020ms）
            await waitAnim(a3);
            try { if(opt && typeof opt.onArrive === 'function') opt.onArrive(); } catch(e){}

            // 完了（旧: 1040ms）
            await sleep(20);
            try { visual.remove(); } catch(e){}
            resolve();
        });
    }

    async function drawCardsWithAnimation(p, count, opt) {
        opt = opt || {};
        const reveal = !!opt.reveal;
        const fromNet = !!opt.fromNet;

        state.isProcessing = true;
        for (let i = 0; i < count; i++) {
            if (!state[`p${p}`].deck || state[`p${p}`].deck.length === 0) break;

            const card = state[`p${p}`].deck.pop();
            await playSingleDrawAnim(p, card, {
                reveal,
                onArrive: () => {
                    state[`p${p}`].hand.push(card);
                    state[`p${p}`].hand.sort(handSortCmp);
                    updateUI();
                }
            });

            // 自分のドローを相手へ通知（オンラインのみ / 初期配り中は送らない / 受信起点のときも送らない）
            if (state.mode === 'online' && p === 1 && !state.isInitialSetup && !fromNet) {
                Net.send('DRAW_ANIM', {});
            }

            // 自分のドロー後、場が空なら配置フェーズへ（初期配り中は除外）
            if (state.gameStarted && p === 1 && !state.isInitialSetup) {
                enforceFieldPlacement(()=>{});
            }
        }
        state.isProcessing = false;
    }

// 相手（または演出なし）ドロー：ロジックだけ進める
async function drawCardsWithoutAnimation(p, count){
    for(let i=0;i<count;i++){
        const st = state['p'+p];
        if(!st.deck || st.deck.length===0) break;
        const card = st.deck.pop();
        st.hand.push(card);
    }
    updateUI();
}



    async function animateDraw(p, opt) {
        opt = opt || {};
        // 自分の手札だけ表を見せる（相手は常に裏）
        if (opt.reveal === undefined) opt.reveal = (p === 1);
        return drawCardsWithAnimation(p, 1, opt);
    }

    // ==== バフ中オーラ判定（樹液の常連 / 紫の閃光の条件成立時）====
    function isBuffActiveForCard(card){
        if(!card) return false;

        // owner判定（フィールドにいる前提）
        const ownerP = state.p1.field.includes(card) ? state.p1
                     : state.p2.field.includes(card) ? state.p2
                     : null;
        if(!ownerP) return false;

        // 1) 樹液の常連：同じ味方場にもう1体以上いる時
        try{
            if(card.teamBuff === "樹液の常連"){
                const ok = ownerP.field.some(x => x && x.id !== card.id && x.teamBuff === "樹液の常連");
                if(ok) return true;
            }
        }catch(e){}

        // 2) 紫の閃光（= bonusTrait/bonusCount/bonusDmg を持つ技の条件成立時）
        // 　※ダメージ計算と同じ条件に合わせる
        try{
            const skills = card.skills || [];
            for(const sk of skills){
                if(sk && sk.bonusTrait && sk.bonusCount && sk.bonusDmg){
                    const same = ownerP.field.filter(x => x && x.id !== card.id && x.trait === sk.bonusTrait).length;
                    if(same >= sk.bonusCount) return true;
                }
            }
        }catch(e){}

        // 3) 深山の恵み：この虫が山地帯のみ＆味方にdeepMountain持ちがいる場合
        try{
            if(card.zones && card.zones.length === 1 && card.zones[0] === "山地帯"){
                const hasMtn = ownerP.field.some(x => x && x.id !== card.id && x.deepMountain);
                if(hasMtn) return true;
            }
        }catch(e){}

        return false;
    }

    

function triggerDeathMigration(deathCards) {
    if(!deathCards || deathCards.length === 0) return;
    // 二重発動防止
    if(state._deathMigRunning) return;
    state._deathMigRunning = true;

    const card = deathCards[0];
    const rest = deathCards.slice(1);
    const ownerP = state.p1.field.includes(card) ? state.p1 : state.p2;
    const enemyP = ownerP === state.p1 ? state.p2 : state.p1;
    const ownerIdx = ownerP === state.p1 ? 1 : 2;

    // オンライン：カードのオーナーが相手（p2）なら、相手クライアントに処理を丸投げ
    if(state.mode === 'online' && ownerIdx === 2){
        showSkillBannerPersist("死滅回遊", true); // 帯はRESULT受信まで保持（自動タイムアウトあり）
        Net.send('DEATH_MIGRATION_TRIGGER', {
            cardId: card.id,
            restIds: rest.map(c=>c.id)
        });
        state._deathMigRunning = false;
        state.isProcessing = true;
        return;
    }

    const enemyAlive = enemyP.field.map((c,i)=>({c,i})).filter(x=>x.c);

    // 帯演出：ダメージが入るまで保持
    const dismissBanner = showSkillBannerPersist("死滅回遊", ownerIdx === 2);
    state.isProcessing = true;

    if(enemyAlive.length === 0){
        if(state.mode === 'online'){
            const enemyOwnerIdx = ownerIdx === 1 ? 2 : 1;
            if(enemyOwnerIdx === 2) Net.send('REQUEST_PLACEMENT', {});
        }
        setTimeout(()=>{
            dismissBanner();
            state.isProcessing = false;
            const slotIdx = ownerP.field.indexOf(card);
            _deathMigTrash(card, ownerIdx, slotIdx, rest);
        }, 700);
        return;
    }

    if(enemyAlive.length === 1){
        setTimeout(()=>{
            dismissBanner();
            state.isProcessing = false;
            const tgt = enemyAlive[0].c;
            if(state.mode === 'online'){
                Net.send('DEATH_MIGRATION_RESULT', { cardId: card.id, targetId: tgt.id, ownerIdx });
            }
            applyDeathMigrationDamage(card, tgt, ownerP, enemyP, ownerIdx, rest);
        }, 700);
        return;
    }

    // 複数体 → バンドを保持したまま選択UI表示
    setTimeout(()=>{
        state.isProcessing = true;
        const msg = document.getElementById('turn-msg');
        msg.innerText = "死滅回遊：攻撃する相手を選択！";
        msg.style.color = "#e74c3c";
        msg.style.opacity = 1;

        enemyAlive.forEach(({c: tgt})=>{
            const el = document.getElementById(`card-${tgt.id}`);
            if(!el) return;
            el.closest('.battle-slot')?.classList.add('valid-target');
            el._deathMigHandler = function(){
                enemyAlive.forEach(({c:x})=>{
                    const xe = document.getElementById(`card-${x.id}`);
                    xe?.closest('.battle-slot')?.classList.remove('valid-target');
                    if(xe?._deathMigHandler){ xe.removeEventListener('click', xe._deathMigHandler); delete xe._deathMigHandler; }
                });
                msg.style.opacity = 0;
                dismissBanner();
                state.isProcessing = false;
                if(state.mode === 'online'){
                    Net.send('DEATH_MIGRATION_RESULT', { cardId: card.id, targetId: tgt.id, ownerIdx });
                }
                applyDeathMigrationDamage(card, tgt, ownerP, enemyP, ownerIdx, rest);
            };
            el.addEventListener('click', el._deathMigHandler);
        });
    }, 600);
}

// p2視点でサイドゾーンにカードを配置するDOM関数（死滅回遊はDEATH_MIGRATION_RESULTで処理するためここでは発火しない）
function placeSideZoneCard_p2(cardData, zone, slotEl){
    try{
        const view = createCardView(cardData);
        view.style.position = 'relative';
        view.style.width = '99px';
        view.style.height = '143px';
        view.style.pointerEvents = 'auto';
        slotEl.innerHTML = '';
        slotEl.appendChild(view);
        slotEl.classList.add('has-card');
        state.sideZones = state.sideZones || {season:null,time:null,environment:null,weather:null};
        if(zone) state.sideZones[zone] = cardData;
        // ※死滅回遊はここでは発火しない。送信側がDEATH_MIGRATION_RESULTを送ってくる
        playSE('place');
        try{ updateUI(); }catch(e){}
    }catch(e){ console.error('placeSideZoneCard_p2 error:', e); }
}

function applyDeathMigrationDamage(card, tgt, ownerP, enemyP, ownerIdx, rest){
    tgt.hp = Math.max(0, tgt.hp - 40);
    const te = document.getElementById(`card-${tgt.id}`);
    if(te){
        playSE('damage');
        te.classList.add('damage-shake');
        _showDamagePopup(te, 40, false);
        setTimeout(()=>{ try{ te.classList.remove('damage-shake'); }catch(e){} }, 220);
    }
    const hb = document.getElementById(`hp-badge-${tgt.id}`);
    if(hb){ hb.innerText=`HP:${tgt.hp}`; hb.style.display='block'; }

    // 相手が倒れた場合
    if(tgt.hp <= 0){
        const ei = enemyP.field.indexOf(tgt);
        const enemyOwnerIdx = ownerIdx === 1 ? 2 : 1;
        const el2 = document.getElementById(`card-${tgt.id}`);
        const tr2 = document.getElementById(`trash-p${enemyOwnerIdx}`).getBoundingClientRect();
        enemyP.field[ei] = null;
        if(el2){
            const r2 = el2.getBoundingClientRect();
            el2.style.transition = "all 0.8s ease-in";
            el2.style.zIndex = "3000";
            el2.style.transform = `translate(${tr2.left-r2.left}px,${tr2.top-r2.top}px) scale(0.1)`;
            el2.style.opacity = "0";
        }
        setTimeout(()=>{ enemyP.trash.push(tgt); }, 800);
    }

    // 500ms後に自分をトラッシュ
    setTimeout(()=>{
        const slotIdx = ownerP.field.indexOf(card);
        _deathMigTrash(card, ownerIdx, slotIdx, rest);
    }, 500);
}

function _deathMigTrash(card, ownerIdx, slotIdx, rest){
    const ownerP = ownerIdx === 1 ? state.p1 : state.p2;
    if(slotIdx === -1){
        state.isProcessing = false;
        updateUI(); checkVictory(); return;
    }
    const el = document.getElementById(`card-${card.id}`);
    const trashEl = document.getElementById(`trash-p${ownerIdx}`);
    if(!trashEl){ state.isProcessing = false; updateUI(); checkVictory(); return; }
    const tr = trashEl.getBoundingClientRect();
    ownerP.field[slotIdx] = null;
    if(el){
        const r = el.getBoundingClientRect();
        el.style.transition = "all 0.8s ease-in";
        el.style.zIndex = "3000";
        el.style.transform = `translate(${tr.left-r.left}px,${tr.top-r.top}px) scale(0.1)`;
        el.style.opacity = "0";
    }
    setTimeout(()=>{
        ownerP.trash.push(card);
        state._deathMigRunning = false;
        state.isProcessing = false;
        updateUI();
        checkVictory();
        _checkPlacementNeeded();
        if(rest.length > 0){
            setTimeout(()=>triggerDeathMigration(rest), 400);
        } else if(!state.waitingForPlacement) {
            // 死滅回遊完了後、正しいターンメッセージを明示的に表示
            const msg = document.getElementById('turn-msg');
            const isMyTurn = state.currentPlayer === 1;
            msg.innerText = isMyTurn ? "自分のターン" : "相手のターン中...";
            msg.style.color = isMyTurn ? "#3498db" : "#e74c3c";
            msg.style.opacity = 1;
            if(isMyTurn){
                const tok = ++state.turnMsgToken;
                setTimeout(()=>{ if(tok===state.turnMsgToken && !state.waitingForPlacement) msg.style.opacity=0; }, 1500);
            }
        }
    }, 800);
}

function _checkPlacementNeeded(){
    // 死滅回遊後にフィールドが空になったプレイヤーへ配置フェーズを促す
    // 各クライアントはstate.p1=自分なので、p1のフィールドだけチェックする
    try{
        const p1FieldEmpty = state.p1.field.every(x => x === null);
        const p1HasBug = state.p1.hand.some(c => !c.type || c.type === 'bug');

        if(p1FieldEmpty && p1HasBug){
            // 自分のフィールドが空 → 自分に配置を促す（persist=trueで消えない）
            showTurnMsg("バトル場にカードを出してください！", "#e74c3c", true);
            state.waitingForPlacement = true;
            state.isProcessing = false;
            updateUI();
        }

        // p2（相手）のフィールドが空の場合はオンライン・AIで対応
        if(state.mode === 'ai'){
            const p2FieldEmpty = state.p2.field.every(x => x === null);
            if(p2FieldEmpty && state.p2.hand.some(c => !c.type || c.type === 'bug')){
                for(let i of [0,1,2]){
                    if(state.p2.field[i]===null && state.p2.hand.length>0){
                        state.p2.field[i] = state.p2.hand.pop();
                        break;
                    }
                }
                updateUI();
            }
        }
        // オンライン時：相手側は相手クライアントのtriggerDeathMigration完了後に自分で検知する
    }catch(e){ console.error('_checkPlacementNeeded error:', e); }
}

// 帯表示キュー（表示中に次が来たら待機）
const _skillBannerQueue = [];
let _skillBannerRunning = false;

let _skillBannerCurrentName = null;
function _flushSkillBannerQueue(){
  if(_skillBannerRunning) return;
  if(_skillBannerQueue.length === 0) return;
  _skillBannerRunning = true;
  const { skillName, isOpponent } = _skillBannerQueue.shift();
  _skillBannerCurrentName = skillName;
  _showSkillBannerNow(skillName, isOpponent, ()=>{
    _skillBannerRunning = false;
    _skillBannerCurrentName = null;
    _flushSkillBannerQueue();
  });
}

function _showSkillBannerNow(skillName, isOpponent, onDone){
  const overlay = document.createElement('div');
  overlay.className = 'skill-band-overlay';
  const wrapper = document.createElement('div');
  wrapper.className = 'skill-band-wrapper';
  const ribbon = document.createElement('div');
  ribbon.className = 'skill-band-ribbon' + (isOpponent ? ' skill-band-ribbon-opponent' : '');
  const sub = document.createElement('div');
  sub.className = 'skill-band-sub';
  sub.textContent = '特性';
  const txt = document.createElement('div');
  txt.className = 'skill-band-text';
  txt.textContent = skillName;
  ribbon.appendChild(sub);
  ribbon.appendChild(txt);
  wrapper.appendChild(ribbon);
  overlay.appendChild(wrapper);
  document.body.appendChild(overlay);
  setTimeout(()=>{ overlay.remove(); if(onDone) onDone(); }, 2200);
}

function showSkillBanner(skillName, isOpponent){
  // キューに同名が既に待機中なら積まない
  // 表示中の場合はキューに積んで消えた後に表示する
  const alreadyQueued = _skillBannerQueue.some(q => q.skillName === skillName);
  if(alreadyQueued) return;
  _skillBannerQueue.push({ skillName, isOpponent });
  // 表示中でなければ即フラッシュ
  if(!_skillBannerRunning) _flushSkillBannerQueue();
}

// 死滅回遊など「ダメージが入るまで帯を保持」したい場合に使う
// dismiss() を呼ぶとスライドアウトして消える
function showSkillBannerPersist(skillName, isOpponent){
  const overlay = document.createElement('div');
  overlay.className = 'skill-band-overlay';
  const wrapper = document.createElement('div');
  wrapper.className = 'skill-band-wrapper';
  const ribbon = document.createElement('div');
  ribbon.className = 'skill-band-ribbon skill-band-ribbon-hold' + (isOpponent ? ' skill-band-ribbon-opponent' : '');
  const sub = document.createElement('div');
  sub.className = 'skill-band-sub';
  sub.textContent = '特性';
  const txt = document.createElement('div');
  txt.className = 'skill-band-text skill-band-text-hold';
  txt.textContent = skillName;
  ribbon.appendChild(sub);
  ribbon.appendChild(txt);
  wrapper.appendChild(ribbon);
  overlay.appendChild(wrapper);
  document.body.appendChild(overlay);
  // 最低でも2.2秒後に自動消去（フォールバック）
  let dismissed = false;
  const dismiss = () => {
    if(dismissed) return;
    dismissed = true;
    ribbon.classList.remove('skill-band-ribbon-hold');
    ribbon.classList.add('skill-band-ribbon-out');
    txt.classList.remove('skill-band-text-hold');
    txt.classList.add('skill-band-text-out');
    sub.classList.add('skill-band-text-out');
    setTimeout(()=>overlay.remove(), 700);
  };
  setTimeout(dismiss, 8000); // 8秒でタイムアウト
  return dismiss;
}

function playBuffChargeParticles(cardEl){
  try{
    const rect = cardEl.getBoundingClientRect();
    const cx = rect.left + rect.width  / 2;
    const cy = rect.top  + rect.height / 2;

    const forKey = cardEl.id || '';
    document.querySelectorAll(`.buff-charge[data-for="${forKey}"]`).forEach(x=>x.remove());

    const wrap = document.createElement('div');
    wrap.className = 'buff-charge';
    wrap.dataset.for = forKey;
    wrap.style.left = cx + 'px';
    wrap.style.top  = cy + 'px';

    // カードサイズに応じて“見えない円”の大きさを調整（＝集まる範囲）
    const base = Math.max(rect.width, rect.height);
    const size = Math.max(110, Math.min(190, base * 1.25)); // だいたいカード端あたりまで
    wrap.style.width  = size + 'px';
    wrap.style.height = size + 'px';

    // 中心の小フレア
    const core = document.createElement('div');
    core.className = 'bc-core';
    wrap.appendChild(core);

    // 粒子（小さく大量）: 広めの円から中心へ吸い込む
    const COUNT = Math.round(90 + size * 0.35); // 130〜160くらい
    const R_MIN = size * 0.30;
    const R_MAX = size * 0.52;

    for(let i=0;i<COUNT;i++){
      const p = document.createElement('div');
      p.className = 'bc-p';

      const ang = Math.random() * Math.PI * 2;
      const rad = R_MIN + Math.random() * (R_MAX - R_MIN);

      // ちょい縦方向に偏らせる（“溜め”感）
      const x = Math.cos(ang) * rad * (0.90 + Math.random()*0.30);
      const y = Math.sin(ang) * rad * (1.05 + Math.random()*0.55);

      // 色：赤〜オレンジ
      const hue = 14 + Math.random() * 26;     // 14..40
      const sat = 92 + Math.random() * 8;      // 92..100
      const light = 50 + Math.random() * 14;   // 50..64
      const alpha = 0.72 + Math.random() * 0.28;

      // 速度：先に集まる粒と遅れる粒
      const dur = 520 + Math.random() * 320;   // 520..840
      const delay = Math.random() * 140;       // 0..140ms（バラつき）

      p.style.setProperty('--x', x.toFixed(1));
      p.style.setProperty('--y', y.toFixed(1));
      p.style.setProperty('--dur', dur.toFixed(0) + 'ms');
      p.style.setProperty('--delay', delay.toFixed(0) + 'ms');
      p.style.setProperty('--c', `hsla(${hue.toFixed(0)}, ${sat.toFixed(0)}%, ${light.toFixed(0)}%, ${alpha.toFixed(2)})`);

      const sizeP = 2.2 + Math.random()*2.6;   // 2.2..4.8px
      p.style.width = sizeP.toFixed(1)+'px';
      p.style.height = sizeP.toFixed(1)+'px';

      wrap.appendChild(p);
    }

    document.body.appendChild(wrap);

    setTimeout(()=>{ try{ wrap.remove(); }catch(e){} }, 1100);
  }catch(e){}
}



function playBuffMiniBurst(cardEl){
  try{
    const rect = cardEl.getBoundingClientRect();
    const cx = rect.left + rect.width  / 2;
    const cy = rect.top  + rect.height / 2;

    const forKey = cardEl.id || '';
    document.querySelectorAll(`.buff-mini-burst[data-for="${forKey}"]`).forEach(x=>x.remove());

    const b = document.createElement('div');
    b.className = 'buff-mini-burst';
    b.dataset.for = forKey;
    b.style.left = cx + 'px';
    b.style.top  = cy + 'px';

    // 爆発範囲：カード端まで
    const base = Math.max(rect.width, rect.height);
    const size = Math.max(120, Math.min(200, base * 1.35));
    b.style.width  = size + 'px';
    b.style.height = size + 'px';

    document.body.appendChild(b);
    setTimeout(()=>{ try{ b.remove(); }catch(e){} }, 520);
  }catch(e){}
}


// カードのバフグループキーを返す
function _buffGroupKey(card){
  if(card.teamBuff) return 'teamBuff:' + card.teamBuff;
  if(card.trait) return 'trait:' + card.trait;
  if(card.deepMountain) return 'deepMountain';
  if(card.zones && card.zones.length===1 && card.zones[0]==="山地帯") return 'deepMountain';
  return 'solo:' + card.id;
}

function updateBuffAuras(){
  if(!state._buffPrev) state._buffPrev = {};
  if(!state._buffFXTimers) state._buffFXTimers = {};
  if(!state._buffStartTime) state._buffStartTime = {};
  if(!state._buffBannerShown) state._buffBannerShown = {};
  if(state._buffAuraInited !== true) state._buffAuraInited = false;

  const all = [];
  for(const c of (state.p1.field||[])) if(c) all.push({card:c, owner:1});
  for(const c of (state.p2.field||[])) if(c) all.push({card:c, owner:2});

  const allowFX = state._buffAuraInited;

  // このupdateBuffAuras呼び出しで新たに発動したグループを記録
  const newlyActivatedGroups = new Set();

  // パス1：各カードのオーラON/OFFと新規発動グループの収集
  for(const {card, owner} of all){
    const el = document.getElementById(`card-${card.id}`);
    if(!el) continue;

    const inBattle = !!el.closest('.battle-slot');
    if(!inBattle){
      el.classList.remove('buff-active');
      el.classList.remove('buff-charging');
      state._buffPrev[card.id] = false;
      const tm = state._buffFXTimers[card.id];
      if(tm){ try{ clearTimeout(tm.t1); clearTimeout(tm.t2); clearTimeout(tm.t3); }catch(e){} }
      delete state._buffFXTimers[card.id];
      continue;
    }

    const flip = el.closest('.flip-card.opponent-flip');
    const faceUp = (!flip) || flip.classList.contains('flipped');
    if(!faceUp){
      el.classList.remove('buff-active');
      el.classList.remove('buff-charging');
      state._buffPrev[card.id] = false;
      try{
        const forKey = el.id || '';
        document.querySelectorAll(`.buff-charge[data-for="${forKey}"]`).forEach(x=>x.remove());
        document.querySelectorAll(`.buff-mini-burst[data-for="${forKey}"]`).forEach(x=>x.remove());
      }catch(e){}
      const tm = state._buffFXTimers[card.id];
      if(tm){ try{ clearTimeout(tm.t1); clearTimeout(tm.t2); clearTimeout(tm.t3); }catch(e){} }
      delete state._buffFXTimers[card.id];
      continue;
    }

    const now  = !!isBuffActiveForCard(card);
    const prev = !!state._buffPrev[card.id];

    if(now){
      el.classList.add('buff-active');
      // 位相をstartTimeから計算（DOM再生成後も継続）
      const startTime = state._buffStartTime[card.id] || Date.now();
      const elapsed = Date.now() - startTime;
      const fDelay = -((elapsed % 1800) / 1000).toFixed(3);
      const aDelay = -((elapsed % 1000) / 1000).toFixed(3);
      const sDelay = -((elapsed % 700)  / 1000).toFixed(3);
      el.style.setProperty('--buff-float-delay', fDelay + 's');
      el.style.setProperty('--buff-aura-delay',  aDelay + 's');
      el.style.setProperty('--buff-spark-delay', sDelay + 's');

      // 新規発動（!prev && now）→ グループキーを記録
      if(!prev){
        state._buffStartTime[card.id] = Date.now();
        const gk = owner + ':' + _buffGroupKey(card);
        newlyActivatedGroups.add(gk);
      }
    } else {
      el.classList.remove('buff-active');
      el.classList.remove('buff-charging');
      const tm = state._buffFXTimers[card.id];
      if(tm){ try{ clearTimeout(tm.t1); clearTimeout(tm.t2); clearTimeout(tm.t3); }catch(e){} }
      delete state._buffFXTimers[card.id];
      state._buffPrev[card.id] = false;
      continue;
    }

    state._buffPrev[card.id] = now;
  }

  // パス2：新規発動グループの全カードを一斉に演出リスタート＋帯表示（グループ1回のみ）
  if(allowFX && newlyActivatedGroups.size > 0){
    for(const gk of newlyActivatedGroups){
      const [ownerStr, ...keyParts] = gk.split(':');
      const ownerNum = parseInt(ownerStr);
      const groupKey = keyParts.join(':');

      // グループに属する全カードを収集
      const ownerField = ownerNum === 1 ? (state.p1.field||[]) : (state.p2.field||[]);
      const groupCards = ownerField.filter(c => {
        if(!c || !isBuffActiveForCard(c)) return false;
        return _buffGroupKey(c) === groupKey;
      });
      if(groupCards.length === 0) continue;

      // 帯演出（グループで1回のみ）
      try{
        let bannerName = null;
        const rep = groupCards[0];
        if(rep.teamBuff === "樹液の常連") bannerName = "樹液の常連";
        else if(rep.zones && rep.zones.length===1 && rep.zones[0]==="山地帯" && !rep.skills?.some(s=>s&&s.bonusDmg)) bannerName = "深山の恵み";
        else if(!rep.skills?.some(s=>s&&s.bonusDmg)){
          bannerName = (rep.skills && rep.skills.length > 0)
            ? (rep.skills.find(s=>s&&s.buff)?.name || rep.skills[0]?.name || rep.name)
            : rep.name;
        }
        if(bannerName){
          const isQueued = _skillBannerQueue.some(q => q.skillName === bannerName);
          if(!isQueued) showSkillBanner(bannerName, ownerNum === 2);
        }
      }catch(e){}

      // グループ全員の演出を同じタイミングでリスタート
      const now = Date.now();
      for(const gc of groupCards){
        const gel = document.getElementById(`card-${gc.id}`);
        if(!gel) continue;
        const tmOld = state._buffFXTimers[gc.id];
        if(tmOld){ try{ clearTimeout(tmOld.t1); clearTimeout(tmOld.t2); clearTimeout(tmOld.t3); }catch(e){} }
        state._buffStartTime[gc.id] = now;
        gel.classList.add('buff-charging');
        gel.style.setProperty('--buff-float-delay', '0s');
        gel.style.setProperty('--buff-aura-delay',  '0s');
        gel.style.setProperty('--buff-spark-delay', '0s');

        const _gc = gc; const _gel = gel;
        const t0 = setTimeout(()=>{ playBuffChargeParticles(_gel); }, 200);
        const t1 = setTimeout(()=>{
          if(!isBuffActiveForCard(_gc)) return;
          playBuffMiniBurst(_gel);
        }, 920);
        const t2 = setTimeout(()=>{
          if(!isBuffActiveForCard(_gc)) return;
          _gel.classList.remove('buff-charging');
        }, 1100);
        state._buffFXTimers[gc.id] = { t1, t2, t3: t0 };
      }
    }
  }

  state._buffAuraInited = true;
}

    function updateUI() {
        // JS側で強制的にクリック無効化
        document.getElementById('turn-msg').style.pointerEvents = 'none';

        if (state.opponentPlacing && !state.waitingForPlacement) {
            const m = document.getElementById('turn-msg');
            m.innerText = "相手が配置中...";
            m.style.opacity = 1;
            m.style.color = "#f1c40f";
        }

        for(let p=1;p<=2;p++) {
            const ps = state[`p${p}`];
            for(let i=0;i<3;i++) {
                const s = document.getElementById(`p${p}-slot-${i}`); s.innerHTML='';
                s.classList.remove('highlight-drop'); s.classList.remove('valid-target');
                if(ps.field[i]) { 
                    const el=createBattleCard(ps.field[i], p, i); 
                    s.appendChild(el); 
                    if(state.selectedAttacker && state.selectedSkill && state.currentPlayer===1 && p===2) {
                        s.classList.add('valid-target');
                        el.style.pointerEvents = 'auto';
                        el.onclick = (e) => {
                            e.stopPropagation();
                            executeAttackUser(ps.field[i], i);
                        };
                    }
                }
            }
            const dEl=document.getElementById(`deck-p${p}`); dEl.innerHTML='';
            if(ps.deck.length>0) {
                for(let k=0;k<Math.min(8,Math.ceil(ps.deck.length/4));k++) {
                    const st=document.createElement('div'); st.className='deck-card-visual'; st.style.transform=`translate(-${k*1.5}px,-${k*1.5}px)`; dEl.appendChild(st);
                }
                const cnt=document.createElement('div'); cnt.className='deck-count'; cnt.innerText=ps.deck.length; dEl.appendChild(cnt);
            }
            const tr=document.getElementById(`trash-p${p}`);
            tr.innerHTML = ps.trash.length>0 ? `<span class="trash-label">トラッシュ</span><img src="${ps.trash[ps.trash.length-1].img}" style="width:100%;height:100%;object-fit:cover;opacity:0.7;">` : `<span class="trash-label">トラッシュ</span>`;
            
            const hEl=document.getElementById(`hand-p${p}`); hEl.innerHTML='';
            const len=ps.hand.length; 
            const maxW = 550; 
            const cardW = 99;
            const baseOverlap = 30; 
            
            let overlap = baseOverlap;
            if (len > 1) {
                const requiredW = cardW + (len - 1) * (cardW - baseOverlap);
                if (requiredW > maxW) {
                    overlap = cardW - (maxW - cardW) / (len - 1);
                }
            }

            ps.hand.forEach((c,i)=>{
                const ct=document.createElement('div'); ct.className='card-container';
                if(i > 0) ct.style.marginLeft = `-${overlap}px`;
                ct.style.zIndex=i; 
                let rot = 0; let transY = 0;
                if(len > 1) {
                    rot = (i - (len - 1) / 2) * 5; 
                    transY = Math.abs(rot) * 2; 
                }
                ct.style.transform = `rotate(${rot}deg) translateY(${transY}px)`;

                const vis = document.createElement('div');
                vis.className = 'card-visual';
                
                let inn;
                if(p===1) {
                    inn=createCardView(c); 
                    vis.appendChild(inn);
                    setupCardInteraction(ct, c);
                } else {
                    inn = document.createElement('div'); inn.className='card'; inn.innerHTML=`<img src="カード裏面.png" class="card-full-img">`;
                    vis.appendChild(inn);
                }
                ct.appendChild(vis); hEl.appendChild(ct);
            });
        }

        // じゃんけん直後：相手の配置カードを「裏→表」で1回だけ裏返す
        if (state.revealOpponentField) {
            // 次フレームでクラス付与してトランジションを確実に発火
            requestAnimationFrame(() => {
                try{
                    document.querySelectorAll('.opponent-flip').forEach(el => el.classList.add('flipped'));
                }catch(e){}
            });

            // 演出後は通常表示に戻す（クリック判定などを元のカードに）
            setTimeout(() => {
                state.revealOpponentField = false;
                updateUI();
            }, 700);
        }

    
        try{ updateBuffAuras(); }catch(e){}
}

    function setupCardInteraction(el, cardData) {
        let isDragging = false;
        let startX, startY;
        let dragEl = null;
        let longPressTimer = null;
        let lastTap = 0;
        let hasMoved = false;
        let isDown = false;

        const startDrag = (e) => {
            if(state.isProcessing) return;

            const touch = e.touches ? e.touches[0] : e;
            startX = touch.clientX;
            startY = touch.clientY;
            hasMoved = false;
            isDown = true;

            longPressTimer = setTimeout(() => {
                if(!hasMoved && !isDragging && isDown) {
                    playSE('decide');
                    openPreview(cardData.img);
                }
            }, 450);
        };

        const moveDrag = (e) => {
            if(!isDown) return;
            const touch = e.touches ? e.touches[0] : e;
            if (Math.abs(touch.clientX - startX) > 18 || Math.abs(touch.clientY - startY) > 18) {
                hasMoved = true;
                clearTimeout(longPressTimer); 
            }

            if(hasMoved && !isDragging) {
                // ドラッグ移動を開始する瞬間に自分のターンかチェック
                // waitingForPlacement中は相手ターンでもバトル場に出せる
                if(state.gameStarted && state.currentPlayer !== 1 && !state.waitingForPlacement) { return; }

                isDragging = true;
                dragEl = document.createElement('div');
                dragEl.className = 'card dragging-card';
                dragEl.innerHTML = `<img src="${cardData.img}" class="card-full-img">`;
                dragEl.style.width = '99px'; dragEl.style.height = '143px';
                document.body.appendChild(dragEl);
            }

            if(isDragging && dragEl) {
                e.preventDefault(); 
                dragEl.style.left = (touch.clientX - 45) + 'px';
                dragEl.style.top = (touch.clientY - 65) + 'px';
                document.querySelectorAll('.battle-slot, .side-slot, .item-slot').forEach(s => s.classList.remove('highlight-drop'));
                const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
                const slot = dropTarget ? dropTarget.closest('.battle-slot, .side-slot, .item-slot') : null;

                const isQuickDrag = cardData.type === 'item' && cardData.itemSubtype === 'quick' && state.canPlaySideCard && state.currentPlayer === 1;
                const fieldArea = document.getElementById('turn-glow-p1');

                if(slot){
                    if(slot.classList.contains('battle-slot') && slot.id.startsWith('p1-')){
                        if((!cardData.type || cardData.type === 'bug') && !slot.hasChildNodes()) slot.classList.add('highlight-drop');
                    }
                    if(slot.classList.contains('side-slot')){
                        const slotZone = slot.getAttribute('data-zone');
                        if(cardData.type && cardData.type === slotZone && state.canPlaySideCard && state.currentPlayer === 1)
                            slot.classList.add('highlight-drop');
                    }
                    if(slot.classList.contains('item-slot') && slot.id.startsWith('p1-item')){
                        if(cardData.type === 'item' && cardData.itemSubtype === 'install' && state.canPlaySideCard && state.currentPlayer === 1)
                            slot.classList.add('highlight-drop');
                    }
                }
                // 速攻アイテム：フィールド全体を金色にグロー
                if(fieldArea) fieldArea.classList.toggle('quick-item-hover', isQuickDrag);
            }
        };

        const endDrag = (e) => {
            if(!isDown) return;
            isDown = false;
            clearTimeout(longPressTimer);
            const touch = e.changedTouches ? e.changedTouches[0] : e;

            if(isDragging && dragEl) {
                dragEl.remove();
                dragEl = null;
                isDragging = false;
                document.getElementById('turn-glow-p1')?.classList.remove('quick-item-hover');
                const dropTarget = document.elementFromPoint(touch.clientX, touch.clientY);
                const slot = dropTarget ? dropTarget.closest('.battle-slot, .side-slot, .item-slot') : null;
                if(!slot) {
                    // 速攻アイテム：手札以外のゲームコンテナ内ならどこでも発動
                    if(cardData.type === 'item' && cardData.itemSubtype === 'quick' && state.canPlaySideCard && state.currentPlayer === 1) {
                        const gc = document.getElementById('game-container');
                        const hand = document.getElementById('hand-p1');
                        const gcRect = gc ? gc.getBoundingClientRect() : null;
                        const handRect = hand ? hand.getBoundingClientRect() : null;
                        const inGC = gcRect && touch.clientX >= gcRect.left && touch.clientX <= gcRect.right && touch.clientY >= gcRect.top && touch.clientY <= gcRect.bottom;
                        const inHand = handRect && touch.clientX >= handRect.left && touch.clientX <= handRect.right && touch.clientY >= handRect.top && touch.clientY <= handRect.bottom;
                        if(inGC && !inHand) { useQuickItem(cardData); }
                    }
                    document.querySelectorAll('.battle-slot, .side-slot, .item-slot').forEach(s => s.classList.remove('highlight-drop'));
                    return;
                }

                if(slot.classList.contains('item-slot') && slot.id.startsWith('p1-item')){
                    if(cardData.type === 'item' && cardData.itemSubtype === 'install' && state.canPlaySideCard && state.currentPlayer === 1){
                        const slotIdx = parseInt(slot.id.replace('p1-item-', ''));
                        placeItemCard(cardData, slotIdx, slot);
                    }
                    document.querySelectorAll('.battle-slot, .side-slot, .item-slot').forEach(s => s.classList.remove('highlight-drop'));
                    return;
                }
                if(slot.classList.contains('battle-slot') && slot.id.startsWith('p1-')){
                    const isBug = !cardData.type || cardData.type === 'bug';
                    if(isBug && !slot.hasChildNodes()){
                        const slotIdx = parseInt(slot.id.split('-')[2]);
                        placeCard(cardData, slotIdx);
                    }
                    // 速攻アイテムはbattle-slotでも発動
                    if(cardData.type === 'item' && cardData.itemSubtype === 'quick' && state.canPlaySideCard && state.currentPlayer === 1){
                        useQuickItem(cardData);
                    }
                    document.querySelectorAll('.battle-slot, .side-slot, .item-slot').forEach(s => s.classList.remove('highlight-drop'));
                    return;
                }
                if(slot.classList.contains('side-slot')){
                    const slotZone = slot.getAttribute('data-zone') || '';
                    if(cardData.type && cardData.type === slotZone && state.canPlaySideCard && state.currentPlayer === 1){
                        if(slot.classList.contains('has-card') && state.sideZones && state.sideZones[slotZone]){
                            state.p1.trash.push(state.sideZones[slotZone]);
                            state.sideZones[slotZone] = null;
                        }
                        placeSideZoneCard(cardData, slotZone, slot);
                        if(state.mode === 'online'){
                            const handIdx = state.p1.hand.indexOf(cardData);
                            Net.send('PLACE_SIDE', { zone: slotZone, cardName: cardData.name, cardId: cardData.id });
                        }
                        document.querySelectorAll('.battle-slot, .side-slot, .item-slot').forEach(s => s.classList.remove('highlight-drop'));
                        return;
                    }
                    document.querySelectorAll('.battle-slot, .side-slot, .item-slot').forEach(s => s.classList.remove('highlight-drop'));
                    return;
                }
                document.querySelectorAll('.battle-slot, .side-slot, .item-slot').forEach(s => s.classList.remove('highlight-drop'));
            } else if (!hasMoved) {
                // ダブルタップ判定（改良版：常にターンチェック）
                const now = Date.now();
                if(now - lastTap < 350) {
                    if(!state.isProcessing && state.currentPlayer === 1 && (!cardData.type || cardData.type === 'bug')) {
                        playSE('place');
                        placeCard(cardData);
                    }
                }
                lastTap = now;
            }
            isDragging = false; dragEl = null;
        };

        el.addEventListener('mousedown', startDrag); el.addEventListener('touchstart', startDrag, {passive: false});
        window.addEventListener('mousemove', moveDrag); window.addEventListener('touchmove', moveDrag, {passive: false});
        window.addEventListener('mouseup', endDrag); window.addEventListener('touchend', endDrag);
    }

function createCardView(c) {
        const d=document.createElement('div'); d.className='card'; d.id=`card-${c.id}`;
        const hpDisp = `<div class="hp-badge" id="hp-badge-${c.id}" style="${c.hp>=c.maxHp?'display:none;':''}">HP:${c.hp}</div>`;
        const mimicDisp = c.currentInvinc ? `<div class="status-badge mimic-badge">擬態</div>` : '';
        d.innerHTML=`${hpDisp}${mimicDisp}<img class="card-full-img" src="${c.img}">`;
        const __img = d.querySelector('img.card-full-img');
        return d;
    }

    function createBattleCard(c, owner, idx) {

        // ===== 対戦開始前：相手の配置カードは裏面にして後出し有利を防ぐ =====
        // ・setup(準備)中：常に裏
        // ・じゃんけん終了後：裏→表の「裏返す」モーションを入れる（1回だけ）
        const shouldFaceDown = (owner === 2) && (!state.gameStarted || state.revealOpponentField);

        if (shouldFaceDown) {
            const wrap = document.createElement('div');
            wrap.className = 'flip-card opponent-flip';
            wrap.style.width = '100%';
            wrap.style.height = '100%';

            const inner = document.createElement('div');
            inner.className = 'flip-card-inner';

            const back = document.createElement('div');
            back.className = 'flip-card-face flip-card-back';
            back.innerHTML = `<img src="カード裏面.png" class="card-full-img">`;

            const front = document.createElement('div');
            front.className = 'flip-card-face flip-card-front';
            // 表は作っておく（裏返し後に見える）
            const frontView = createCardView(c);
            // 準備中はクリック/長押しでプレビューが出ないように無効化
            frontView.style.pointerEvents = 'none';
            front.appendChild(frontView);

            inner.appendChild(back);
            inner.appendChild(front);
            wrap.appendChild(inner);

            // 準備中は相手カードに触れないように
            wrap.style.pointerEvents = 'none';

            return wrap;
        }

        // ===== 通常（ゲーム開始後）：表面で表示 =====
        const d=createCardView(c);
        if(state.selectedAttacker && state.selectedAttacker.id===c.id) d.classList.add('selected-attacker');
        d.onmouseenter=()=>playSE('hover');

        let t; 
        const st=()=>{ t=setTimeout(()=>{playSE('decide');openPreview(c.img);t=null;},500); };
        const cl=()=>{if(t){clearTimeout(t);t=null;}};
        d.addEventListener('mousedown',st); d.addEventListener('mouseup',cl); d.addEventListener('mouseleave',cl);
        d.addEventListener('touchstart',st,{passive:true}); d.addEventListener('touchend',cl);

        d.onclick=(e)=>{
            e.stopPropagation();
            try { hideTurnMsgIfMyTurn(); } catch(_e) {}
            
            if(!state.gameStarted || state.isProcessing || state.waitingForPlacement || state.currentPlayer!==1) return;
            if (isFirstTurnNoAttack()) {
                // 先攻の最初のターンは攻撃不可
                if(owner===1){ showTurnMsg("先攻の最初のターンは攻撃できません", "#e74c3c"); }
                return;
            }

            if(owner===1) { 
                playSE('click');
                // 自分のターンテキストをスライドアウトで消す
                state._myTurnMsgToken = (state._myTurnMsgToken || 0) + 1;
                const _tm2 = document.getElementById('turn-msg');
                if(_tm2 && _tm2.classList.contains('banner-in-hold')){
                    _tm2.classList.remove('banner-in-hold');
                    _tm2.classList.add('banner-in-out');
                    setTimeout(()=>{ _tm2.classList.remove('banner-in-out'); _tm2.style.opacity=0; }, 400);
                }
                showSkillSelector(c); 
            } else if (owner===2 && state.selectedAttacker && state.selectedSkill) {
                executeAttackUser(c, idx);
            }
        };
        return d;
    }

    function handleGlobalClick(e) {
        // 自分のターン表示は、1回でもクリックしたらフェードアウト
        try {
            const tm = document.getElementById('turn-msg');
            if (tm && tm.innerText === '自分のターン' && (parseFloat(tm.style.opacity || '0') > 0)) {
                tm.style.opacity = 0;
            }
        } catch(_) {}

        if(state.selectedAttacker) {
            const clickedCard = e.target.closest('.battle-slot');
            if(clickedCard && clickedCard.id.startsWith('p2-') && clickedCard.hasChildNodes()) {
                // 有効なターゲットなので何もしない
            } else {
                if(e.target.closest('#skill-selector')) return;
                playSE('cancel');
                cancelSkill();
            }
        }
    }

    function showSkillSelector(atk) {
        state.selectedAttacker = atk;
        state.selectedSkill = null; 
        updateUI(); 

        playSE('decide'); 
        const sel=document.getElementById('skill-selector');
        const b1=document.getElementById('skill-1'); const b2=document.getElementById('skill-2');
        
        setupSkillBtn(b1, atk.skills[0]);
        if(atk.skills.length>1) { b2.style.display='flex'; setupSkillBtn(b2, atk.skills[1]); }
        else b2.style.display='none';
        
        sel.style.display='flex';
    }

    
function setupSkillBtn(btn, skill) {
        const baseDmg = (skill && typeof skill.atk === 'number') ? skill.atk : 0;
        let mod = 0;
        let modHtml = "";

        if(skill.ability !== "擬態") {
            // 所有者（P1/P2）を特定
            const ownerP = state.p1.field.some(c => c && state.selectedAttacker && c.id === state.selectedAttacker.id) ? state.p1 : state.p2;

            // 樹液の常連：自分以外に同じ能力を持つ味方がいれば +20
            if(state.selectedAttacker && state.selectedAttacker.teamBuff === "樹液の常連") {
                if(ownerP.field.some(c => c && c.id !== state.selectedAttacker.id && c.teamBuff === "樹液の常連")) {
                    mod += 20;
                }
            }

            // 深山の恵み：この虫が山地帯のみ＆味方にdeepMountain持ちがいれば、その数×10
            if(state.selectedAttacker && state.selectedAttacker.zones &&
               state.selectedAttacker.zones.length === 1 && state.selectedAttacker.zones[0] === "山地帯") {
                const mtnCount = ownerP.field.filter(c => c && c.id !== state.selectedAttacker.id && c.deepMountain).length;
                mod += mtnCount * 10;
            }

            // 条件付き火力（例：紫の閃光）
            // ※「そのカードを含まず」＝攻撃する本人はカウントしない
            // ※「味方のバトル場に同じ特性が２枚」＝自分以外で2枚以上
            if(skill.bonusTrait && skill.bonusCount && skill.bonusDmg) {
                const same = ownerP.field.filter(x => x && state.selectedAttacker && x.id !== state.selectedAttacker.id && x.trait === skill.bonusTrait).length;
                if(same >= skill.bonusCount) mod += skill.bonusDmg;
            }

            if (mod > 0) modHtml = `<span class="dmg-mod-badge mod-plus">+${mod}</span>`;
            else if (mod < 0) modHtml = `<span class="dmg-mod-badge mod-minus">${mod}</span>`;
        }

        // 表示は「ベース威力」＋「補正バッジ」。(90 +40 にならないよう、左の数字は base のまま)
        btn.innerHTML=`<div style="display:flex;justify-content:space-between;width:100%;align-items:center;"><span>${skill.name}</span><div class="skill-info-right"><span class="skill-dmg-val">${baseDmg}</span>${modHtml}</div></div>`;

        if(skill.ability === "擬態" && isMimicOnCooldown(state.selectedAttacker)) {
            btn.style.opacity = "0.5";
            btn.onclick = (e) => { e.stopPropagation(); showTurnMsg("連続では使えません！", "#e74c3c"); };
        } else {
            btn.style.opacity = "1";
            btn.onclick=(e)=>{ e.stopPropagation(); selectSkill(skill); };
        }
    }

    function isMimicOnCooldown(card) {
        return !!(card && ((card.mimicCooldownTurns ?? 0) > 0 || card.mimicCooldown));
    }

// 相手ターン中テキストを消す（相手が行動した時に呼ぶ）
function hideOpponentTurnMsg() {
    if(state.mode !== 'online' || state.currentPlayer !== 2) return;
    const m = document.getElementById('turn-msg');
    if(!m) return;
    m.classList.remove('banner-in-hold');
    m.style.opacity = 0;
    // 5秒後に再表示
    state._opTurnMsgToken = (state._opTurnMsgToken || 0) + 1;
    const tok = state._opTurnMsgToken;
    clearTimeout(state._opTurnMsgTimer);
    state._opTurnMsgTimer = setTimeout(() => {
        if(tok !== state._opTurnMsgToken) return;
        if(state.currentPlayer !== 2 || !state.gameStarted) return;
        m.classList.remove('banner-in-hold');
        void m.offsetWidth;
        m.classList.add('banner-in-hold');
        m.style.opacity = 1;
    }, 5000);
}

function showTurnMsg(text, color, persist) {
        const m = document.getElementById('turn-msg');
        state.turnMsgToken = (state.turnMsgToken || 0) + 1;
        // 自分のターン表示の操作リスナーを無効化
        state._myTurnMsgToken = (state._myTurnMsgToken || 0) + 1;
        const tok = state.turnMsgToken;
        // banner-inアニメーションがopacityを上書きするので必ず外す
        m.classList.remove('banner-in');
        m.classList.remove('banner-in-hold');
        m.innerText = text; m.style.color = color; m.style.opacity = 1;
        if(!persist) setTimeout(() => { if(tok === state.turnMsgToken && !state.waitingForPlacement) m.style.opacity = 0; }, 1500);
    }

    function selectSkill(s) {
        playSE('decide'); 
        state.selectedSkill = s;
        document.getElementById('skill-selector').style.display='none';

        if (s.ability === "擬態") {
            executeAttackUser(null, -1); 
            return;
        }

        // 相手全体攻撃（ターゲット選択なし）
        if (s.allEnemies) {
            executeAttackUser(null, -1);
            return;
        }

        const msg = document.getElementById('turn-msg');
        state.turnMsgToken = (state.turnMsgToken || 0) + 1;
        msg.classList.remove('banner-in');
        msg.innerText = "攻撃相手を選択！";
        msg.style.opacity = 1;
        msg.style.color = "#e74c3c";
        updateUI(); 
    }

    function cancelSkill() { 
        document.getElementById('skill-selector').style.display='none'; 
        state.selectedAttacker=null; state.selectedSkill=null; 
        const _tmHide = document.getElementById('turn-msg'); _tmHide.classList.remove('banner-in'); _tmHide.style.opacity = 0;
        updateUI(); 
    }

    function executeAttackUser(target, tIdx) {
        if(!state.selectedAttacker || !state.selectedSkill) return;

        // 全体攻撃はターゲット不要。オンライン同期のため tIdx は -1 に統一。
        if (state.selectedSkill && state.selectedSkill.allEnemies) {
            target = state.selectedAttacker;
            tIdx = -1;
        }

        // 擬態もターゲット不要（自分自身を指定）
        if (state.selectedSkill && state.selectedSkill.ability === "擬態") {
            target = state.selectedAttacker;
            tIdx = -1;
        }

        if(state.mode==='online') { 
            const attackerSlot = state.p1.field.findIndex(c => c && c.id === state.selectedAttacker.id);
            if(attackerSlot === -1) {
                // 念のため：空スロット(null)が混ざっていても落ちないように
                console.warn('[ATTACK] attackerSlot not found', state.selectedAttacker);
            }
            const sIdx = state.selectedAttacker.skills.findIndex(s => s.name === state.selectedSkill.name);
            Net.send('ATTACK',{attackerSlot:attackerSlot, targetSlot:tIdx, skillIdx:sIdx}); 
        }

        // 実行（全体攻撃は executeAttack 側で分岐）
        executeAttack(state.selectedAttacker, target, tIdx, state.selectedSkill);
    }


    function executeAttackVisuals(attacker, target, skill) {
        let tIdx = -1;
        if (attacker.id === target.id) { tIdx = -1; } 
        else { tIdx = state.p1.field.indexOf(target); if (tIdx === -1) tIdx = state.p2.field.indexOf(target); }
        executeAttack(attacker, target, tIdx, skill, true);
    }

    function executeAttack(attacker, target, tIdx, skill, isRemote=false) {
        state.selectedAttacker = null; state.selectedSkill = null;
        const _tmHide = document.getElementById('turn-msg'); _tmHide.classList.remove('banner-in'); _tmHide.style.opacity = 0;
        updateUI();

        state.isProcessing=true; stopTimer();
        document.getElementById('end-turn-btn').style.display='none';
        
        if (skill.ability === "擬態") {
            const sd=document.getElementById('skill-display');
        const __cutinStyle = (typeof chooseUltimateStyle==='function') ? chooseUltimateStyle(skill) : null;
        if(sd && !__cutinStyle){
            sd.style.display='block';
            sd.innerText=`【 ${skill.name} 】`;
            sd.classList.remove('skill-anim'); void sd.offsetWidth; sd.classList.add('skill-anim');
        }else{
            // B/C演出時は旧技名を出さない（残りも消す）
            __setLegacySkillDisplayVisible(false);
        }
// 擬態は攻撃ではない技 → B演出
            try{ playCoolUltimate(skill.name, skill); }catch(e){ console.warn(e); }
            setTimeout(() => {
                attacker.currentInvinc = true;
                attacker.mimicActive = true; 
                attacker.mimicUsedThisTurn = true;
                attacker.mimicCooldownTurns = 1;
                attacker.mimicCooldown = true; 
                playSE('place'); 
                updateUI();
                finish();
            }, 800);
            return;
        }

        // ===== 相手全体攻撃（例：鱗粉撒き） =====
        if (skill.allEnemies) {
            const attackerOwner = state.p1.field.includes(attacker) ? 1 : 2;
            const enemyP = state[`p${attackerOwner===1?2:1}`];
            const enemyTargets = enemyP.field.map((c, idx) => ({c, idx})).filter(o => o.c);

            // 鱗粉撒き：技名に合わせた「鱗粉(スケールダスト)」演出
            if(skill && skill.name === "鱗粉撒き"){
                try{
                    const attackerEl = document.getElementById(`card-${attacker.id}`);
                    if(attackerEl){
                        const rect = attackerEl.getBoundingClientRect();
                        const centerX = rect.left + rect.width / 2;
                        const centerY = rect.top + rect.height / 2;
                        playScaleDustEffect(centerX, centerY);
                    }
                }catch(e){}
            }

            // 技名表示（簡易）
            try{ playCoolUltimate(skill.name, skill); }catch(e){}

            setTimeout(()=>{
                let totalThorns = 0;
                enemyTargets.forEach(({c: tgt, idx: slotIdx}) => {
                    let dmg = skill.atk;

                    // ダメージ増加系（樹液の常連 / バッタの王 / 条件ボーナス）
                    if(attacker.teamBuff === "樹液の常連") {
                        const ownerP = state.p1.field.includes(attacker) ? state.p1 : state.p2;
                        if(ownerP.field.some(x => x && x.id !== attacker.id && x.teamBuff === "樹液の常連")) dmg += 20;
                    }
                    if(attacker.grassKing) {
                        const ownerP = state.p1.field.includes(attacker) ? state.p1 : state.p2;
                        const hopCount = (ownerP.trash || []).filter(x => x && x.family === "バッタ科").length;
                        dmg += hopCount * 10;
                    }
                    if(attacker.zones && attacker.zones.length === 1 && attacker.zones[0] === "山地帯") {
                        const ownerP = state.p1.field.includes(attacker) ? state.p1 : state.p2;
                        const mtnCount = ownerP.field.filter(x => x && x.id !== attacker.id && x.deepMountain).length;
                        dmg += mtnCount * 10;
                    }
                    if(attacker.sawJaw && tgt.family === "クワガタムシ科") dmg += 10;
                    if(skill.bonusTrait && skill.bonusCount && skill.bonusDmg) {
                        const ownerP = state.p1.field.includes(attacker) ? state.p1 : state.p2;
                        const same = ownerP.field.filter(x => x && x.id !== attacker.id && x.trait === skill.bonusTrait).length;
                        if(same >= skill.bonusCount) dmg += skill.bonusDmg;
                    }

                    // 眼状紋（reduction）: クロウスの舞は無視
                    if(!tgt.currentInvinc) {
                        if(tgt.reduction && !skill.ignoreEyeSpot) dmg = Math.max(0, dmg - tgt.reduction);
                        tgt.hp = Math.max(0, tgt.hp - dmg);
                        const hb=document.getElementById(`hp-badge-${tgt.id}`); if(hb) { hb.innerText=`HP:${tgt.hp}`; hb.style.display='block'; }

                        // ダメージ表記（他の技と同じポップアップ）
                        const te=document.getElementById(`card-${tgt.id}`);
                        if(te){
                            playSE('damage');
                            te.classList.add('damage-shake');
                            showDamagePopup(te, dmg, false);
                            setTimeout(()=>{ try{ te.classList.remove('damage-shake'); }catch(e){} }, 220);
                        }


                        // 下翅の輝き：反射10（能力ダメージなので軽減しない）
                        if(tgt.thorns) totalThorns += tgt.thorns;

                        if(tgt.hp<=0) { moveToTrash(tgt, attackerOwner===1?2:1, slotIdx); }
                    }
                });

                if(totalThorns>0) {
                    attacker.hp = Math.max(0, attacker.hp - totalThorns);
                    // 全体攻撃の反射ダメージ演出（他の技と同じダメージ表記）
                    try{ playSE('damage'); }catch(e){}
                    try{ const ae2=document.getElementById(`card-${attacker.id}`); if(ae2){ ae2.classList.add('damage-shake'); showDamagePopup(ae2, totalThorns, false); setTimeout(()=>{ try{ ae2.classList.remove('damage-shake'); }catch(e){} }, 220); } }catch(e){}
                    const hbA=document.getElementById(`hp-badge-${attacker.id}`); if(hbA) { hbA.innerText=`HP:${attacker.hp}`; hbA.style.display='block'; }
                    if(attacker.hp<=0) { const ao=state.p1.field.includes(attacker)?1:2; moveToTrash(attacker, ao, state[`p${ao}`].field.indexOf(attacker)); }
                }

                // 反動
                if(skill.recoil) {
                    attacker.hp=Math.max(0, attacker.hp-skill.recoil);
                    const hbA=document.getElementById(`hp-badge-${attacker.id}`); if(hbA) { hbA.innerText=`HP:${attacker.hp}`; hbA.style.display='block'; }
                    if(attacker.hp<=0) { const ao=state.p1.field.includes(attacker)?1:2; moveToTrash(attacker, ao, state[`p${ao}`].field.indexOf(attacker)); }
                }

                updateUI();
                finish();
            }, 300);
            return;
        }

        const ae=document.getElementById(`card-${attacker.id}`); const de=document.getElementById(`card-${target.id}`);
        if(!ae||!de) { state.isProcessing=false; return; }

        const sd=document.getElementById('skill-display'); sd.innerText=`【 ${skill.name} 】`;
        sd.classList.remove('skill-anim'); void sd.offsetWidth; sd.classList.add('skill-anim');


        // --- 必殺技カットイン（攻撃モーションの前に必ず出す）---
        const ultStyle = chooseUltimateStyle(skill);
        const ultimateDelay = (ultStyle === 'B') ? 800 : (ultStyle === 'C') ? 1200 : 0;
        const isUltimate = ultimateDelay > 0;
        if(ultStyle){
            try{ playCoolUltimate(skill.name, skill); }catch(e){ console.warn(e); }
        }


        setTimeout(()=>{
            const r1=ae.getBoundingClientRect(); const r2=de.getBoundingClientRect();
            ae.style.zIndex="2000"; ae.style.transform=`translate(${r2.left-r1.left}px, ${r2.top-r1.top}px) scale(1.1)`;
            
            // 攻撃エフェクト
            const isPurpleFlash = (skill && skill.name === "紫の閃光");

            // 画面に紫の閃光（スッと走る発光）
            if(isPurpleFlash){
                const pf = document.createElement('div');
                pf.className = 'purple-flash-screen';
                document.body.appendChild(pf);
                setTimeout(()=>pf.remove(), 300);
            }

            const slash = document.createElement('div');
            slash.className = 'attack-effect-container'
              + (isUltimate ? ' ultimate' : '')
              + (isPurpleFlash ? ' purple-flash' : '');
            slash.style.left = (r2.left + r2.width/2) + 'px';
            slash.style.top = (r2.top + r2.height/2) + 'px';
            // 紫の閃光は"ビームっぽい"太めラインで統一
            if(isPurpleFlash){
                slash.innerHTML =
                  `<div class="slash-line slash-1" style="--rot:0deg"></div>`+
                  `<div class="slash-line slash-2" style="--rot:8deg"></div>`+
                  `<div class="shockwave"></div>`;
            }else{
                slash.innerHTML = isUltimate
                  ? `<div class="slash-line slash-1" style="--rot:40deg"></div>`+
                    `<div class="slash-line slash-2" style="--rot:-40deg"></div>`+
                    `<div class="slash-line slash-3" style="--rot:0deg"></div>`+
                    `<div class="shockwave"></div>`
                  : `<div class="slash-line slash-1" style="--rot:45deg"></div>`+
                    `<div class="slash-line slash-2" style="--rot:-45deg"></div>`+
                    `<div class="shockwave"></div>`;
            }
            document.body.appendChild(slash);
            setTimeout(()=>slash.remove(), 600);

            const gc = document.getElementById('shake-wrapper');
            if(gc){
                if(isUltimate){
                    gc.classList.add('screen-shake-ult');
                    setTimeout(()=>gc.classList.remove('screen-shake-ult'), 260);
                }else if(isPurpleFlash){
                    gc.classList.add('screen-shake-purple');
                    setTimeout(()=>gc.classList.remove('screen-shake-purple'), 220);
                }else{
                    gc.classList.add('screen-shake');
                    setTimeout(()=>gc.classList.remove('screen-shake'), 400);
                }
            }
setTimeout(()=>{
                let dmg=skill.atk;
                
                if(attacker.teamBuff === "樹液の常連") {
                    const ownerP = state.p1.field.includes(attacker) ? state.p1 : state.p2;
                    if(ownerP.field.some(c => c && c.id !== attacker.id && c.teamBuff === "樹液の常連")) dmg += 20; 
                }

                // バッタの王：味方トラッシュのバッタ科枚数×10だけ与ダメ増加
                if(attacker.grassKing) {
                    const ownerP = state.p1.field.includes(attacker) ? state.p1 : state.p2;
                    const hopCount = (ownerP.trash || []).filter(x => x && x.family === "バッタ科").length;
                    dmg += hopCount * 10;
                }

                // 深山の恵み：この虫が山地帯のみの場合、味方のdeepMountain持ちの数×10だけ与ダメ増加
                if(attacker.zones && attacker.zones.length === 1 && attacker.zones[0] === "山地帯") {
                    const ownerP = state.p1.field.includes(attacker) ? state.p1 : state.p2;
                    const mtnCount = ownerP.field.filter(x => x && x.id !== attacker.id && x.deepMountain).length;
                    dmg += mtnCount * 10;
                }

                // 鋸の大顎：相手がクワガタムシ科なら+10
                if(attacker.sawJaw && target.family === "クワガタムシ科") dmg += 10;

                // 条件付き火力（例：紫の閃光）
                if(skill.bonusTrait && skill.bonusCount && skill.bonusDmg) {
                    const ownerP = state.p1.field.includes(attacker) ? state.p1 : state.p2;
                    const same = ownerP.field.filter(x => x && x.id !== attacker.id && x.trait === skill.bonusTrait).length;
                    if(same >= skill.bonusCount) dmg += skill.bonusDmg;
                }

                if(target.currentInvinc) { dmg=0; playSE('place'); } 
                else if(target.reduction && !skill.ignoreEyeSpot) dmg=Math.max(0,dmg-target.reduction);
                if (!target.currentInvinc) {
                    // ○○の舞：殴りヒット時に小規模鱗粉（鱗粉撒きの小さい版）
                    try{
                        if(skill && typeof skill.name === 'string' && skill.name.includes('の舞') && skill.name !== '鱗粉撒き' && dmg > 0){
                            const r = de.getBoundingClientRect();
                            playScaleDustMiniEffect(r.left + r.width/2, r.top + r.height/2);
                        }
                    }catch(e){}
                    playSE('damage'); de.classList.add('damage-shake'); showDamagePopup(de, dmg, isUltimate);
                    target.hp=Math.max(0, target.hp-dmg);

                    // 下翅の輝き：攻撃してきた蟲に10ダメージ（能力ダメージなので軽減しない）
                    if(target.thorns && attacker && attacker.id !== target.id) {
                        attacker.hp = Math.max(0, attacker.hp - target.thorns);
                        // 反射ダメージの演出（他の技と同じダメージ表記）
                        try{ playSE('damage'); }catch(e){}
                        try{ ae.classList.add('damage-shake'); showDamagePopup(ae, target.thorns, false); setTimeout(()=>{ try{ ae.classList.remove('damage-shake'); }catch(e){} }, 220); }catch(e){}
                        const hba=document.getElementById(`hp-badge-${attacker.id}`); 
                        if(hba) { hba.innerText=`HP:${attacker.hp}`; hba.style.display='block'; }
                        if(attacker.hp<=0) { 
                            const ao=state.p1.field.includes(attacker)?1:2; 
                            moveToTrash(attacker, ao, state[`p${ao}`].field.indexOf(attacker)); 
                        }
                    }

                }
                const hb=document.getElementById(`hp-badge-${target.id}`); if(hb) { hb.innerText=`HP:${target.hp}`; hb.style.display='block'; }

                setTimeout(()=>{
                    ae.style.transform=''; de.classList.remove('damage-shake');
                    if(target.hp<=0) {
                        const owner=state.p1.field.includes(target)?1:2;
                        moveToTrash(target, owner, tIdx);
                    }
                    if(skill.recoil) {
                        setTimeout(()=>{
                            playSE('damage'); ae.classList.add('damage-shake'); showDamagePopup(ae, skill.recoil, false);
                            attacker.hp=Math.max(0, attacker.hp-skill.recoil);
                            if(attacker.hp<=0) { const ao=state.p1.field.includes(attacker)?1:2; moveToTrash(attacker, ao, state[`p${ao}`].field.indexOf(attacker)); }
                            setTimeout(()=>{ ae.classList.remove('damage-shake'); finish(); },500);
                        },300);
                    } else finish();
                }, 50);
            },120);
        },400);

        function finish() {
            setTimeout(()=>{
                checkVictory();
                        state.isProcessing=false;

                // 攻撃後に「自傷(反動)などで自分のバトル場が空になった」場合も、
                // 配置フェーズを挟んでから相手ターンへ進む（マルチ/AI/ローカル共通）
                const proceedEndTurn = () => {
                    // 攻撃後のターン終了
                    // - AI戦：そのまま endTurn()
                    // - マルチ：攻撃した側（ローカル実行＝!isRemote）が END_TURN を送ってから endTurn(false)
                    // - 受信側（isRemote=true）は END_TURN を受け取った時に endTurn(true) されるので、ここでは何もしない
                    if (state.mode === 'ai') {
                        endTurn();
                    } else if (state.mode === 'online' && !isRemote) {
                        Net.send('END_TURN', {});
                        endTurn(false);
                    } else if (state.mode !== 'online' && !isRemote) {
                        // ローカル / 1人プレイ等
                        endTurn();
                    }
                };

                // 「自分(ローカル)の攻撃」で、かつ今が自分のターン中に場が空になったら配置を強制
                const needPlacement =
                    (!isRemote) &&
                    (state.currentPlayer === 1) &&
                    (state.p1.field.every(c=>c===null)) &&
                    (state.p1.hand.length > 0);

                if (needPlacement) {
                    enforceFieldPlacement(() => {
                        // 配置が完了したら、相手ターンへ
                        proceedEndTurn();
                    });
                } else {
                    proceedEndTurn();
                }
            },500);
        }
        function showDamagePopup(el, val, isUltimate=false) {
            _showDamagePopup(el, val, isUltimate);
        }
    }

    function _showDamagePopup(el, val, isUltimate=false) {
        const p=document.createElement('div'); p.className='dmg-popup';
        if(isUltimate) p.classList.add('ultimate');
        p.innerText=`-${val}`;
        const r=el.getBoundingClientRect(); p.style.left=(r.left+25)+'px'; p.style.top=r.top+'px';
        document.body.appendChild(p); setTimeout(()=>p.remove(),1000);
    }

    function moveToTrash(c, o, idx) {
        if(idx===-1) return;
        const el=document.getElementById(`card-${c.id}`); const tr=document.getElementById(`trash-p${o}`).getBoundingClientRect();
        state[`p${o}`].field[idx]=null;
        if(el) {
            // buff-activeのfireFloatアニメーションがtransformを上書きするので先に外す
            el.classList.remove('buff-active');
            el.classList.remove('buff-charging');
            el.style.animation = 'none';
            const r=el.getBoundingClientRect();
            el.style.transition="all 0.8s ease-in"; el.style.zIndex="3000";
            el.style.transform=`translate(${tr.left-r.left}px,${tr.top-r.top}px) scale(0.1)`; el.style.opacity="0";
        }
        setTimeout(()=>{ state[`p${o}`].trash.push(c); updateUI(); checkVictory(); },800);
    }

    function checkVictory() {
        const p1FieldEmpty = state.p1.field.every(x => x === null);
        const p2FieldEmpty = state.p2.field.every(x => x === null);
        const p1HandEmpty = state.p1.hand.length === 0;
        const p2HandEmpty = state.p2.hand.length === 0;
        if (p1FieldEmpty && p1HandEmpty) showGameOver(2); 
        else if (p2FieldEmpty && p2HandEmpty) showGameOver(1); 
    }

    function aiAction() {
        const ai = state.p2;
        const pl = state.p1;

        // ===== 配置フェーズ：バフ特性完成を優先、次にHP順 =====
        if (ai.hand.length > 0) {
            const emptySlots = PLACEMENT_PRIORITY.filter(i => ai.field[i] === null);
            if (emptySlots.length > 0) {
                const fieldCards = ai.field.filter(c => c !== null);
                let bestCard = null, bestScore = -Infinity;
                for (const card of ai.hand) {
                    let score = card.maxHp || 0;

                    // 樹液の常連：場に既にいれば即発動 → 大ボーナス
                    //             手札にもう1枚あれば将来発動できる → 中ボーナス
                    if (card.teamBuff === "樹液の常連") {
                        const onField = fieldCards.filter(c => c.teamBuff === "樹液の常連").length;
                        const inHand  = ai.hand.filter(c => c.id !== card.id && c.teamBuff === "樹液の常連").length;
                        score += onField * 80;  // 場に1枚いれば今すぐ発動 → 超優先
                        score += inHand  * 50;  // 手札にいれば一緒に出せる → 優先
                    }

                    // 深山の恵み：場 or 手札にシナジー相手がいれば優先
                    if (card.zones && card.zones.length === 1 && card.zones[0] === "山地帯") {
                        score += fieldCards.filter(c => c.deepMountain).length * 40;
                        score += ai.hand.filter(c => c.id !== card.id && c.deepMountain).length * 25;
                    }
                    if (card.deepMountain) {
                        score += fieldCards.filter(c => c.zones && c.zones.length === 1 && c.zones[0] === "山地帯").length * 40;
                        score += ai.hand.filter(c => c.id !== card.id && c.zones && c.zones.length === 1 && c.zones[0] === "山地帯").length * 25;
                    }

                    // 下翅の輝き：場 or 手札に同特性がいれば優先
                    if (card.trait === "下翅の輝き") {
                        score += fieldCards.filter(c => c.trait === "下翅の輝き").length * 50;
                        score += ai.hand.filter(c => c.id !== card.id && c.trait === "下翅の輝き").length * 30;
                    }

                    if (score > bestScore) { bestScore = score; bestCard = card; }
                }
                if (bestCard) {
                    playSE('place');
                    ai.field[emptySlots[0]] = bestCard;
                    ai.hand = ai.hand.filter(c => c.id !== bestCard.id);
                    updateUI();
                    try { animateCardPlace(document.getElementById(`p2-slot-${emptySlots[0]}`), bestCard.img); } catch(e) {}
                }
            }
        }

        setTimeout(() => {
            if (isFirstTurnNoAttack()) { endTurn(); return; }

            const atks = ai.field.filter(c => c !== null);
            const tgts = pl.field.filter(c => c !== null);
            if (atks.length === 0 || tgts.length === 0) { endTurn(); return; }

            // ===== 実ダメージ計算（AI視点） =====
            function calcDmg(attacker, skill, target) {
                if (!skill || skill.ability === "擬態" || skill.allEnemies) return 0;
                let dmg = skill.atk || 0;
                if (attacker.teamBuff === "樹液の常連") {
                    if (ai.field.some(c => c && c.id !== attacker.id && c.teamBuff === "樹液の常連")) dmg += 20;
                }
                if (attacker.grassKing) {
                    dmg += ((ai.trash || []).filter(x => x && x.family === "バッタ科").length) * 10;
                }
                if (attacker.zones && attacker.zones.length === 1 && attacker.zones[0] === "山地帯") {
                    dmg += ai.field.filter(x => x && x.id !== attacker.id && x.deepMountain).length * 10;
                }
                if (attacker.sawJaw && target.family === "クワガタムシ科") dmg += 10;
                if (skill.bonusTrait && skill.bonusCount && skill.bonusDmg) {
                    const same = ai.field.filter(x => x && x.id !== attacker.id && x.trait === skill.bonusTrait).length;
                    if (same >= skill.bonusCount) dmg += skill.bonusDmg;
                }
                if (target.currentInvinc) return 0;
                if (target.reduction && !skill.ignoreEyeSpot) dmg = Math.max(0, dmg - target.reduction);
                return dmg;
            }

            // ===== 全体攻撃（allEnemies）の合計ダメージ計算 =====
            function calcAllEnemiesDmg(attacker, skill) {
                if (!skill || !skill.allEnemies) return 0;
                return tgts.reduce((sum, tgt) => {
                    if (tgt.currentInvinc) return sum;
                    let dmg = skill.atk || 0;
                    if (tgt.reduction && !skill.ignoreEyeSpot) dmg = Math.max(0, dmg - tgt.reduction);
                    return sum + dmg;
                }, 0);
            }

            // ===== 全攻撃パターンを評価 =====
            const candidates = [];
            for (const atk of atks) {
                // ナナフシモドキは擬態とたいあたりをランダムに選ぶ（擬態クールダウン中は攻撃のみ）
                const isNanafushi = atk.name && atk.name.startsWith("ナナフシモドキ");
                if (isNanafushi) {
                    const mimicSkill = (atk.skills || []).find(s => s && s.ability === "擬態");
                    const atkSkill   = (atk.skills || []).find(s => s && s.ability !== "擬態");
                    const canMimic   = mimicSkill && !isMimicOnCooldown(atk);
                    // 倒せる相手がいれば確定でたいあたり、そうでなければランダム
                const canKillSomething = atkSkill && tgts.some(tgt => calcDmg(atk, atkSkill, tgt) >= tgt.hp);
                const chosenSkill = canKillSomething
                        ? atkSkill
                        : canMimic
                            ? (Math.random() < 0.5 ? mimicSkill : atkSkill)
                            : atkSkill;
                    if (chosenSkill) {
                        if (chosenSkill.ability === "擬態") {
                            executeAttack(atk, atk, -1, chosenSkill, true);
                            return;
                        }
                        for (const tgt of tgts) {
                            const isInvinc = !!tgt.currentInvinc;
                            const dmg = calcDmg(atk, chosenSkill, tgt);
                            const kills = dmg >= tgt.hp;
                            const selfDmg = (chosenSkill.recoil || 0) + (tgt.thorns ? tgt.thorns : 0);
                            const selfDies = (atk.hp - selfDmg) <= 0;
                            const tgtMaxAtk = Math.max(...(tgt.skills || []).filter(s => s && !s.ability).map(s => s.atk || 0), 0);
                            candidates.push({ atk, skill: chosenSkill, tgt, tIdx: pl.field.indexOf(tgt), dmg, kills, selfDies, buffBonus: 0, isInvinc, tgtMaxAtk });
                        }
                    }
                    continue;
                }
                const usableSkills = (atk.skills || []).filter(s => s && s.ability !== "擬態");
                const buffActive = isBuffActiveForCard(atk);
                // 全体攻撃スキルは合計ダメージで1エントリとして追加
                for (const skill of usableSkills.filter(s => s.allEnemies)) {
                    const totalDmg = calcAllEnemiesDmg(atk, skill);
                    const killsAll = tgts.every(tgt => {
                        if (tgt.currentInvinc) return false;
                        let dmg = skill.atk || 0;
                        if (tgt.reduction && !skill.ignoreEyeSpot) dmg = Math.max(0, dmg - tgt.reduction);
                        return dmg >= tgt.hp;
                    });
                    const killsAny = tgts.some(tgt => {
                        if (tgt.currentInvinc) return false;
                        let dmg = skill.atk || 0;
                        if (tgt.reduction && !skill.ignoreEyeSpot) dmg = Math.max(0, dmg - tgt.reduction);
                        return dmg >= tgt.hp;
                    });
                    const selfDies = (atk.hp - (skill.recoil || 0)) <= 0;
                    const maxTgtAtk = Math.max(...tgts.map(t => Math.max(...(t.skills||[]).filter(s=>s&&!s.ability).map(s=>s.atk||0), 0)));
                    candidates.push({ atk, skill, tgt: tgts[0], tIdx: -1, dmg: totalDmg, kills: killsAny, killsAll, selfDies, buffBonus: buffActive ? 1 : 0, isInvinc: false, tgtMaxAtk: maxTgtAtk, isAllEnemies: true });
                }
                for (const skill of usableSkills.filter(s => !s.allEnemies)) {
                    for (const tgt of tgts) {
                        const isInvinc = !!tgt.currentInvinc; // 擬態発動中
                        const dmg = calcDmg(atk, skill, tgt);
                        const kills = dmg >= tgt.hp;
                        const selfDmg = (skill.recoil || 0) + (tgt.thorns ? tgt.thorns : 0);
                        const selfDies = (atk.hp - selfDmg) <= 0;
                        const buffBonus = buffActive ? 1 : 0;
                        // 敵の最大攻撃力（倒す価値の指標）：バフ補正も含めて計算
                        const tgtMaxAtk = Math.max(...(tgt.skills || []).filter(s => s && !s.ability).map(s => {
                            let a = s.atk || 0;
                            if (tgt.teamBuff === "樹液の常連" && pl.field.some(x => x && x.id !== tgt.id && x.teamBuff === "樹液の常連")) a += 20;
                            if (tgt.zones && tgt.zones.length === 1 && tgt.zones[0] === "山地帯") a += pl.field.filter(x => x && x.id !== tgt.id && x.deepMountain).length * 10;
                            // sawJaw：AIの攻撃カードがクワガタムシ科の場合のみ+10
                            if (tgt.sawJaw && atk.family === "クワガタムシ科") a += 10;
                            return a;
                        }), 0);
                        candidates.push({ atk, skill, tgt, tIdx: pl.field.indexOf(tgt), dmg, kills, selfDies, buffBonus, isInvinc, tgtMaxAtk, isAllEnemies: false });
                    }
                }
            }

            // ===== 優先順位 =====
            // 【確殺あり】擬態なし確殺(自滅なし) > 擬態なし確殺(自滅あり) > 擬態あり確殺
            //   確殺できる中ではHP最大の敵を優先
            // 【確殺なし】バフ発動中 > 敵の攻撃力が高い > 敵のHP残量が少ない
            //   ただし擬態発動中の敵は最後回し
            let best = null;

            // 擬態なし確殺（自滅なし）
            const killSafe = candidates.filter(c => c.kills && !c.selfDies && !c.isInvinc);
            if (killSafe.length > 0) {
                // 危険度（バフ込み攻撃力）が高い敵を優先、同値ならHP高い順
                killSafe.sort((a, b) => b.tgtMaxAtk !== a.tgtMaxAtk ? b.tgtMaxAtk - a.tgtMaxAtk : b.tgt.hp - a.tgt.hp);
                best = killSafe[0];
            } else {
                // 擬態なし確殺（自滅あり）
                const killDie = candidates.filter(c => c.kills && c.selfDies && !c.isInvinc);
                if (killDie.length > 0) {
                    killDie.sort((a, b) => b.tgtMaxAtk !== a.tgtMaxAtk ? b.tgtMaxAtk - a.tgtMaxAtk : b.tgt.hp - a.tgt.hp);
                    best = killDie[0];
                } else {
                    // 擬態あり確殺（最後の手段）
                    const killInvinc = candidates.filter(c => c.kills && c.isInvinc);
                    if (killInvinc.length > 0) {
                        best = killInvinc[0];
                    } else {
                        // 確殺なし：擬態発動中を除外して優先順位で選ぶ
                        const dmgCands = candidates.filter(c => c.dmg > 0 && !c.isInvinc);
                        const fallback  = candidates.filter(c => c.dmg > 0 &&  c.isInvinc);
                        const pool = dmgCands.length > 0 ? dmgCands : fallback;
                        if (pool.length > 0) {
                            pool.sort((a, b) => {
                                // 1. バフ発動中のカードで攻撃を優先
                                if (a.buffBonus !== b.buffBonus) return b.buffBonus - a.buffBonus;
                                // 2. 敵の攻撃力が高い順（脅威排除）
                                if (a.tgtMaxAtk !== b.tgtMaxAtk) return b.tgtMaxAtk - a.tgtMaxAtk;
                                // 3. 敵のHP残量が少ない順（次ターン確殺を狙う）
                                if (a.tgt.hp !== b.tgt.hp) return a.tgt.hp - b.tgt.hp;
                                // 4. 与ダメ最大
                                return b.dmg - a.dmg;
                            });
                            best = pool[0];
                        }
                    }
                }
            }

            if (best) {
                if (best.isAllEnemies) {
                    // 全体攻撃：ターゲットはattacker自身（executeAttack内でallEnemiesフラグで分岐）
                    executeAttack(best.atk, best.atk, -1, best.skill, true);
                } else {
                    executeAttack(best.atk, best.tgt, best.tIdx, best.skill, true);
                }
            } else {
                endTurn();
            }
        }, 2000);
    }

    function userEndTurn() {
        // ユーザーがボタン等で明示的に「ターン終了」したときだけ送信する
        if(state.currentPlayer!==1 || !state.gameStarted || state.isProcessing) return;
        playSE('decide');
        if(state.mode==='online') Net.send('END_TURN',{});
        endTurn(false);
    }

    function endTurn(fromNetwork=false) {
        stopTimer();
        document.getElementById('end-turn-btn').style.display='none';

        // 重要：
        // ・END_TURN の送信は userEndTurn() のみが行う
        // ・ここ（endTurn）は送信しない（受信側で送り返してループする事故を防ぐ）

        // ターン経過を記録（攻撃禁止判定に使用）
        if (state.currentPlayer === 1) state.p1TurnCount = (state.p1TurnCount ?? 0) + 1;
        else state.p2TurnCount = (state.p2TurnCount ?? 0) + 1;

        // 擬態クールダウンの経過処理：
        // ・擬態を使ったターンの終了時は減らさない（次の自分ターンを封じるため）
        // ・次の自分ターンを終えた時点で 1→0 になり、再び使えるようになる
        const endPlayerField = state.currentPlayer === 1 ? state.p1.field : state.p2.field;
        endPlayerField.forEach(c => {
            if(!c) return;
            if (c.mimicCooldownTurns == null) c.mimicCooldownTurns = c.mimicCooldown ? 1 : 0; // 互換
            if (c.mimicUsedThisTurn) return; // このターンに擬態を使ったなら減らさない
            if (c.mimicCooldownTurns > 0) c.mimicCooldownTurns -= 1;
            c.mimicCooldown = (c.mimicCooldownTurns > 0);
        });

        state.currentPlayer = (state.currentPlayer === 1) ? 2 : 1;
        state.isProcessing=false;
        state.selectedAttacker = null; state.selectedSkill = null;
        updateUI();
        setTimeout(() => startTurn(), 800);
    }
    
    function surrender() { if(confirm("降参しますか？")) { if(state.mode==='online') Net.send('SURRENDER',{}); showGameOver(2); } }
    function showGameOver(w) {
        state.inBattleScene = false;
        state.isProcessing = false;
        stopTimer();
        state.gameStarted = false; AudioSys.stopBGM();
        recordBattleResult(w === 1 ? 'win' : 'lose');

        // 勝敗オーバーレイを生成
        const existing = document.getElementById('gameover-overlay');
        if(existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'gameover-overlay';
        overlay.style.cssText = `
            position:fixed; inset:0; z-index:9998;
            display:flex; flex-direction:column;
            align-items:center; justify-content:center;
            background: ${w===1 ? 'rgba(0,20,0,0.82)' : 'rgba(20,0,0,0.85)'};
            animation: goFadeIn 0.5s ease forwards;
        `;

        const isWin = w===1;

        // パーティクル（勝利は金、敗北は赤）
        const particleColor = isWin ? ['#f1c40f','#fff','#e67e22'] : ['#e74c3c','#c0392b','#ff6b6b'];
        for(let i=0;i<(isWin?40:20);i++){
            const p = document.createElement('div');
            const size = 4 + Math.random()*8;
            const x = Math.random()*100;
            const dur = 1.2 + Math.random()*1.5;
            const delay = Math.random()*0.8;
            const color = particleColor[Math.floor(Math.random()*particleColor.length)];
            p.style.cssText = `
                position:absolute;
                left:${x}vw; top:-10px;
                width:${size}px; height:${size}px;
                background:${color};
                border-radius:${Math.random()>0.5?'50%':'2px'};
                animation: goParticle ${dur}s ${delay}s ease-in forwards;
                transform: rotate(${Math.random()*360}deg);
            `;
            overlay.appendChild(p);
        }

        // メインテキスト
        const title = document.createElement('div');
        title.style.cssText = `
            font-size: 72px;
            font-weight: 900;
            letter-spacing: 8px;
            color: ${isWin ? '#f1c40f' : '#e74c3c'};
            text-shadow: ${isWin
                ? '0 0 30px #f1c40f, 0 0 60px #e67e22, 4px 4px 0 #000'
                : '0 0 30px #e74c3c, 0 0 60px #c0392b, 4px 4px 0 #000'};
            animation: goTitlePop 0.6s 0.3s cubic-bezier(0.175,0.885,0.32,1.275) both;
            z-index:1;
        `;
        title.innerText = isWin ? 'YOU WIN!' : 'YOU LOSE...';

        // サブテキスト
        const sub = document.createElement('div');
        sub.style.cssText = `
            font-size: 20px;
            color: ${isWin ? '#fff' : '#aaa'};
            letter-spacing: 4px;
            margin-top: 16px;
            opacity: 0;
            animation: goSubFade 0.5s 1s ease forwards;
            z-index:1;
        `;
        sub.innerText = isWin ? '〜 勝利 〜' : '〜 敗北 〜';

        overlay.appendChild(title);
        overlay.appendChild(sub);
        document.body.appendChild(overlay);

        if(w !== 1) document.getElementById('game-container').classList.add('lose-effect');

        if(state.mode === 'online' && Net.conn && Net.conn.open) {
            setTimeout(() => { overlay.remove(); openRematchScreen(w); }, 3500);
        } else {
            setTimeout(()=>{ overlay.remove(); try{ backToTitle(); } catch(e){ location.reload(); } }, 3500);
        }
    }
    function initFallingCards() {
  const cards = document.querySelectorAll('.falling-card');
  cards.forEach(card => {
    card.style.display = ''; // 再表示
    const left = Math.random() * 100;
    const duration = 8 + Math.random() * 10;
    const delay = Math.random() * 5;

    card.style.left = left + "vw";
    card.style.animationDuration = duration + "s";
    card.style.animationDelay = delay + "s";
  });
}
window.addEventListener('load', () => { try { initFallingCards(); } catch(e) {} });
function removeFallingCards() {
    document.querySelectorAll('.falling-card').forEach(card => {
      card.style.display = 'none';
    });
  }


// --- Tap Ripple ---
function spawnRipple(x, y) {
    const r = document.createElement("div");
    r.className = "ripple-effect";
    r.style.left = x + "px";
    r.style.top = y + "px";
    document.body.appendChild(r);
    r.addEventListener("animationend", () => r.remove(), { once: true });
}

document.addEventListener("pointerdown", function(e) {
    spawnRipple(e.clientX, e.clientY);
});


document.addEventListener("DOMContentLoaded", function(){
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('.btn, .mini-btn, .system-btn');
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement('span');
    ripple.className = 'btn-ripple';
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px;`;
    btn.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  });
  try {
    const tlm = document.getElementById('top-left-menu');
    if(tlm) tlm.style.display = 'none';
    const cb = document.getElementById('account-circle-btn');
    if(cb) applyAvatarToBtn(cb, getAcct().avatar);
  } catch(e){}
  const buttons = document.querySelectorAll(".filter-group-btn");
  buttons.forEach(btn=>{
    btn.addEventListener("click", function(){
      buttons.forEach(b=>b.classList.remove("active"));
      this.classList.add("active");
    });
  });
});


/* =========================
   鱗粉撒き：Scale Dust Effect
   ========================= */
function playScaleDustEffect(x, y){
    // x,y are viewport coords
    const layer = document.createElement('div');
    layer.className = 'scale-dust-layer';
    document.body.appendChild(layer);

    // Ring burst
    const ring = document.createElement('div');
    ring.className = 'scale-dust-ring';
    ring.style.left = x + 'px';
    ring.style.top  = y + 'px';
    layer.appendChild(ring);

    // Particles
    const count = 34;
    for(let i=0;i<count;i++){
        const p = document.createElement('div');
        p.className = 'scale-dust-particle';
        p.style.left = x + 'px';
        p.style.top  = y + 'px';

        const ang = Math.random() * Math.PI * 2;
        const dist = 70 + Math.random() * 120;    // travel distance
        const dx = Math.cos(ang) * dist;
        const dy = Math.sin(ang) * dist * 0.65 - (30 + Math.random()*50); // slightly upward
        const sc = 1.1 + Math.random() * 1.8;
        const dur = 700 + Math.random() * 550;

        const size = 5 + Math.random() * 10;
        p.style.width  = size + 'px';
        p.style.height = size + 'px';

        p.style.setProperty('--dx', dx.toFixed(1) + 'px');
        p.style.setProperty('--dy', dy.toFixed(1) + 'px');
        p.style.setProperty('--sc', sc.toFixed(2));
        p.style.setProperty('--dur', dur.toFixed(0) + 'ms');

        layer.appendChild(p);
    }

    // Cleanup
    setTimeout(()=>{ try{ layer.remove(); }catch(e){} }, 1200);
}

/* =========================
   ○○の舞：Hit Dust (small)
   - 鱗粉撒きの小規模版（殴りヒット時用）
   ========================= */
function playScaleDustMiniEffect(x, y){
    // x,y are viewport coords
    const layer = document.createElement('div');
    layer.className = 'scale-dust-layer';
    document.body.appendChild(layer);

    // small ring
    const ring = document.createElement('div');
    ring.className = 'scale-dust-ring';
    ring.style.left = x + 'px';
    ring.style.top  = y + 'px';
    ring.style.transform = 'translate(-50%, -50%) scale(0.65)';
    ring.style.opacity = '0.75';
    layer.appendChild(ring);

    // fewer / tighter particles
    const count = 14;
    for(let i=0;i<count;i++){
        const p = document.createElement('div');
        p.className = 'scale-dust-particle';
        p.style.left = x + 'px';
        p.style.top  = y + 'px';

        const ang = Math.random() * Math.PI * 2;
        const dist = 25 + Math.random() * 55;
        const dx = Math.cos(ang) * dist;
        const dy = Math.sin(ang) * dist * 0.55 - (10 + Math.random()*20);
        const sc = 0.75 + Math.random() * 0.9;
        const dur = 420 + Math.random() * 260;

        const size = 3 + Math.random() * 6;
        p.style.width  = size + 'px';
        p.style.height = size + 'px';

        p.style.setProperty('--dx', dx.toFixed(1) + 'px');
        p.style.setProperty('--dy', dy.toFixed(1) + 'px');
        p.style.setProperty('--sc', sc.toFixed(2));
        p.style.setProperty('--dur', dur.toFixed(0) + 'ms');

        layer.appendChild(p);
    }

    setTimeout(()=>{ try{ layer.remove(); }catch(e){} }, 750);
}


 

/* =========================================
   アカウント・フレンド・マルチロビー・再戦
   ========================================= */

// ---- ストレージ ----
function getAcct() {
    try {
        const d = JSON.parse(localStorage.getItem('musi_acct') || 'null');
        if(d) return d;
    } catch(e){}
    const def = { name:'プレイヤー', avatar:'__KABUTO__', wins:0, losses:0, history:[], friends:[], friendRequests:[] };
    saveAcct(def); return def;
}
function saveAcct(d) { try { localStorage.setItem('musi_acct', JSON.stringify(d)); } catch(e){} }

// ---- ランク計算 ----
// 1→2:3XP, 2→3:5XP, 3→4:10XP, 以降+5ずつ(15,20,25...)
const RANK_CUM = (function(){
    const steps = [3, 5, 10];
    const cum = [0];
    let total = 0;
    for (let i = 0; i < 99; i++) {
        const s = i < steps.length ? steps[i] : 10 + (i - 2) * 5;
        total += s;
        cum.push(total);
    }
    return cum;
})();
function calcExp(wins, losses) { return (wins||0)*5 + (losses||0)*3; }
function calcRank(exp) {
    let rank = 1;
    for (let i = 1; i < RANK_CUM.length; i++) {
        if (exp >= RANK_CUM[i]) rank = i + 1; else break;
    }
    return rank;
}
function rankTitle(rank) {
    if (rank <= 10) return '見習い';
    if (rank <= 20) return '一人前';
    if (rank <= 30) return '熟練';
    if (rank <= 40) return 'プロ';
    return '蟲神';
}
function rankColor(rank) {
    if (rank <= 10) return '#aaa';
    if (rank <= 20) return '#2ecc71';
    if (rank <= 30) return '#3498db';
    if (rank <= 40) return '#e67e22';
    return '#f1c40f';
}

// ---- 戦績 ----
let _opponentName = '相手';
function recordBattleResult(res) {
    const a = getAcct();
    if(res === 'win') a.wins++; else a.losses++;
    a.history.unshift({ result: res, opponent: _opponentName, date: new Date().toLocaleDateString('ja-JP') });
    if(a.history.length > 10) a.history.length = 10;
    saveAcct(a);
}

// ---- アカウント画面 ----

const KABUTO_AVATAR_ID = '__KABUTO__';
const HIRATA_AVATAR_ID = '__HIRATA__';
const HIRATA_IMG_DATA = 'data:image/png;base64,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';
const HIRATA_IMG_DATA_ORIG = HIRATA_IMG_DATA;
const KABUTO_IMG_DATA = 'data:image/png;base64,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';
const KABUTO_IMG_DATA_ORIG = 'data:image/png;base64,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';

function getAvatarDisplay(av) {
    if (av === KABUTO_AVATAR_ID) {
        return `<img src="${KABUTO_IMG_DATA}" style="width:100%;height:100%;object-fit:contain;border-radius:0;display:block;">`;
    }
    if (av === HIRATA_AVATAR_ID) {
        return `<img src="${HIRATA_IMG_DATA}" style="width:100%;height:100%;object-fit:contain;border-radius:0;display:block;">`;
    }
    return av;
}
function applyAvatarToBtn(el, av) {
    if (!el) return;
    if (av === KABUTO_AVATAR_ID) {
        el.innerHTML = `<img src="${KABUTO_IMG_DATA}" style="width:100%;height:100%;object-fit:contain;border-radius:0;display:block;">`;
        el.classList.add('kabuto-active');
    } else if (av === HIRATA_AVATAR_ID) {
        el.innerHTML = `<img src="${HIRATA_IMG_DATA}" style="width:100%;height:100%;object-fit:contain;border-radius:0;display:block;">`;
        el.classList.add('kabuto-active');
    } else {
        el.innerHTML = av;
        el.classList.remove('kabuto-active');
    }
}

const AVATARS = ['__KABUTO__','__HIRATA__','🐝','🐞','🦗','🦟','🐜','🦂','🌿','🍄','🌸','⚔️','🔥','👑','💎'];
let _avPickerOpen = false;

function openAccount() {
    const deckBtnAcct = document.getElementById('deck-build-btn');
    removeFallingCards();
    const a = getAcct();
    const reqs = a.friendRequests || [];

    // --- アニメーション演出 ---
    const cb = document.getElementById('account-circle-btn');
    const container = document.getElementById('game-container');
    const cbRect = cb.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // ぼかしオーバーレイを表示
    const blur = document.getElementById('acct-blur-overlay');
    blur.style.display = 'block';
    requestAnimationFrame(() => blur.classList.add('open'));

    // クローンボタンを作成（元ボタンの位置から開始）
    const clone = document.createElement('div');
    clone.id = 'acct-btn-clone';
    clone.style.width = cb.offsetWidth + 'px';
    clone.style.height = cb.offsetHeight + 'px';
    clone.style.fontSize = window.getComputedStyle(cb).fontSize;
    clone.style.top = (cbRect.top - containerRect.top) + 'px';
    clone.style.left = (cbRect.left - containerRect.left) + 'px';
    clone.innerHTML = cb.innerHTML;
    if(cb.classList.contains('kabuto-active')) {
        clone.classList.add('kabuto-active');
        clone.style.background = 'transparent';
        clone.style.border = 'none';
        clone.style.boxShadow = 'none';
        clone.style.borderRadius = '0';
        clone.style.overflow = 'visible';
    }
    container.appendChild(clone);
    document.body.classList.add('clone-active');
    cb.style.visibility = 'hidden';

    // アカウント画面内のアバターボタンの位置へ移動
    // screen-account: width=480px, height=740px, top=50%, left=50%, translate(-50%,-50%)
    // アバター(72px): paddingTop=24px, paddingLeft=20px
    const targetSize = 60;
    const saLeft = container.offsetWidth / 2 - 240; // screen-account左端
    const saTop  = container.offsetHeight / 2 - 370; // screen-account上端
    const targetLeft = saLeft + 94; // padding-left
    const targetTop  = saTop + 22;  // padding-top
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            clone.style.top = targetTop + 'px';
            clone.style.left = targetLeft + 'px';
            clone.style.width = targetSize + 'px';
            clone.style.height = targetSize + 'px';
            clone.style.fontSize = '36px';
        });
    });

    // フェーズ1: クローンが目的地に到着したら円状枠を展開
    setTimeout(() => {
        // クローンを消す（同化）- 3秒後（確認用）
        setTimeout(() => { clone.remove(); document.body.classList.remove('clone-active'); }, 1500);
        cb.style.visibility = 'hidden';

        // 円状枠をアイコン位置から展開
        const cb2 = document.getElementById('account-circle-btn');
        const border = document.getElementById('acct-circle-border');
        border.style.display = 'block';
        border.style.width = '60px';
        border.style.height = '60px';
        border.style.borderRadius = '50%';
        border.style.left = (targetLeft + 30) + 'px';
        border.style.top  = (targetTop + 30) + 'px';
        requestAnimationFrame(() => requestAnimationFrame(() => {
            border.style.transform = 'translate(-50%, -50%) scale(1)';
            // 0.35秒後：円から自然にアカウント画面サイズへ一気に変形
            setTimeout(() => {
                border.style.transition = 'width 0.55s cubic-bezier(0.4,0,0.2,1), height 0.55s cubic-bezier(0.4,0,0.2,1), border-radius 0.55s cubic-bezier(0.4,0,0.2,1), left 0.55s cubic-bezier(0.4,0,0.2,1), top 0.55s cubic-bezier(0.4,0,0.2,1)';
                try { _playAccountSE1(); } catch(e) {}
                border.style.width = '480px';
                border.style.height = '740px';
                border.style.borderRadius = '20px';
                border.style.left = (containerRect.width / 2) + 'px';
                border.style.top  = (containerRect.height / 2) + 'px';

                // 0.6秒後（変形0.55+余裕）にアカウント画面を表示
                setTimeout(() => {
                    border.style.opacity = '0';
                    setTimeout(() => { border.style.display = 'none'; border.style.opacity = '1'; border.style.transform = 'translate(-50%,-50%) scale(0)'; border.style.transition = ''; }, 300);

                    const sa = document.getElementById('screen-account');
                    sa.innerHTML = `
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;">
            <div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
                <div class="acct-avatar-btn${(a.avatar===KABUTO_AVATAR_ID||a.avatar===HIRATA_AVATAR_ID)?' kabuto-active':''}" id="av-btn" onclick="toggleAvPicker()">${a.avatar===KABUTO_AVATAR_ID?`<img src="${KABUTO_IMG_DATA}" style="width:100%;height:100%;object-fit:contain;border-radius:0;display:block;">`:a.avatar===HIRATA_AVATAR_ID?`<img src="${HIRATA_IMG_DATA}" style="width:100%;height:100%;object-fit:contain;border-radius:0;display:block;">`:a.avatar}</div>
                <div style="font-size:11px;font-weight:bold;letter-spacing:1px;color:${rankColor(calcRank(calcExp(a.wins, a.losses)))}">${rankTitle(calcRank(calcExp(a.wins, a.losses)))}　ランク${calcRank(calcExp(a.wins, a.losses))}</div>
            </div>
            <div>
                <div style="font-size:11px;color:#aaa;margin-bottom:4px;">プレイヤー名</div>
                <input class="acct-name-inp" id="acct-name" value="${a.name}" maxlength="16" onchange="saveAcctName()">
            </div>
        </div>
        <div id="av-picker" style="display:none;">
            <div class="avatar-picker-grid">${AVATARS.map(av=>{
                const isKabuto = av === KABUTO_AVATAR_ID;
                const isHirata = av === HIRATA_AVATAR_ID;
                const inner = isKabuto ? `<img src="${KABUTO_IMG_DATA_ORIG}" style="width:100%;height:100%;object-fit:contain;border-radius:0;display:block;">` : isHirata ? `<img src="${HIRATA_IMG_DATA_ORIG}" style="width:100%;height:100%;object-fit:contain;border-radius:0;display:block;">` : av;
                const sel = av===a.avatar?' sel':'';
                return `<div class="av-opt${sel}" data-av="${av}" ${isKabuto?'data-kabuto="1"':''} ${isHirata?'data-kabuto="1"':''} onclick="chooseAvatar('${av}')">${inner}</div>`;
            }).join('')}</div>
        </div>

        <button class="acct-menu-btn" id="abtn-record" onclick="toggleAcctPanel('record')">📋 戦績</button>
        <div class="acct-panel" id="apanel-record"></div>

        <button class="acct-menu-btn" id="abtn-friend" onclick="toggleAcctPanel('friend')" style="${reqs.length>0?'border-color:#e74c3c;':''}">
            👥 フレンド${reqs.length>0?` <span class="req-badge">${reqs.length}</span>`:''}
        </button>
        <div class="acct-panel" id="apanel-friend"></div>

        <button class="acct-menu-btn" id="abtn-rules" onclick="toggleAcctPanel('rules')">📖 ルール</button>
        <div class="acct-panel" id="apanel-rules"></div>

        <button class="acct-menu-btn" id="abtn-settings" onclick="toggleAcctPanel('settings')">⚙️ 設定</button>
        <div class="acct-panel" id="apanel-settings"></div>

    `;
                    try { _playAccountSE2(); } catch(e) {}
                    sa.classList.remove('hidden');
                    sa.classList.add('animating');
                    requestAnimationFrame(() => requestAnimationFrame(() => {
                        sa.classList.add('open');
                        document.getElementById('acct-back-btn').style.display = 'block';
                    }));
                }, 600);
            }, 350);
        }));
    }, 300);

}

let _acctOpenPanel = null;
function toggleAcctPanel(key) {
    if (_acctOpenPanel === key) {
        // 同じボタンを押したら閉じる
        document.getElementById('apanel-' + key).innerHTML = '';
        document.getElementById('apanel-' + key).classList.remove('open');
        document.getElementById('abtn-' + key).classList.remove('active');
        _acctOpenPanel = null;
        return;
    }
    // 他を閉じる
    if (_acctOpenPanel) {
        document.getElementById('apanel-' + _acctOpenPanel).innerHTML = '';
        document.getElementById('apanel-' + _acctOpenPanel).classList.remove('open');
        document.getElementById('abtn-' + _acctOpenPanel).classList.remove('active');
    }
    _acctOpenPanel = key;
    document.getElementById('abtn-' + key).classList.add('active');
    const panel = document.getElementById('apanel-' + key);
    panel.innerHTML = _buildAcctPanel(key);
    panel.classList.add('open');
    // 設定スライダーの値を同期
    if (key === 'settings') _syncAcctSettings();
    // フレンドパネルはID取得
    if (key === 'friend') setTimeout(_initFriendPeerId, 0);
}

function _buildAcctPanel(key) {
    const a = getAcct();
    if (key === 'record') {
        const total = a.wins + a.losses;
        const rate = total > 0 ? Math.round(a.wins/total*100) : 0;
        const histHTML = a.history.length === 0
            ? '<div style="color:#666;font-size:12px;text-align:center;padding:8px;">戦績なし</div>'
            : a.history.map(h =>
                `<div class="hist-item ${h.result}"><span>${h.result==='win'?'🏆 勝利':'💀 敗北'}</span><span>${h.opponent}</span><span style="color:#666;">${h.date}</span></div>`
              ).join('');
        return `
            <div class="rec-grid" style="margin:10px 0;">
                <div class="rec-box"><div class="rec-num">${a.wins}</div><div class="rec-lbl">勝利</div></div>
                <div class="rec-box"><div class="rec-num">${a.losses}</div><div class="rec-lbl">敗北</div></div>
                <div class="rec-box"><div class="rec-num">${rate}%</div><div class="rec-lbl">勝率</div></div>
            </div>
            <div class="hist-list" style="max-height:180px;">${histHTML}</div>`;
    }
    if (key === 'friend') {
        const reqs = a.friendRequests || [];
        const friends = a.friends || [];
        const reqsHTML = reqs.length === 0 ? '' : `
            <div style="background:rgba(231,76,60,.15);border:1px solid #e74c3c;border-radius:8px;padding:8px;margin-bottom:8px;font-size:13px;">
                📨 フレンド申請 (${reqs.length}件)
                ${reqs.map((r,i) => `
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:5px;">
                        <span>${r.avatar||'👤'} ${r.name} <span style="font-size:10px;color:#888;">${r.id.slice(0,8)}...</span></span>
                        <div style="display:flex;gap:4px;">
                            <button class="mini-btn" onclick="acceptFriendReq(${i})">✓</button>
                            <button class="mini-btn" style="background:#555;" onclick="rejectFriendReq(${i})">✗</button>
                        </div>
                    </div>`).join('')}
            </div>`;
        const friendsHTML = friends.length === 0
            ? '<div style="color:#666;font-size:12px;text-align:center;padding:8px;">フレンドなし</div>'
            : friends.map((f,i) =>
                `<div class="fr-item"><span class="fr-name">${f.avatar||'👤'} ${f.name}</span><span class="fr-id">${f.id.slice(0,10)}...</span><button class="mini-btn" style="background:#c0392b;font-size:10px;" onclick="removeFriend(${i})">削除</button></div>`
              ).join('');
        return `
            <div style="padding:8px 0;">
                ${reqsHTML}
                <div style="font-size:12px;color:#aaa;margin-bottom:4px;">フレンド (${friends.length}人)</div>
                <div class="fr-list" style="max-height:130px;margin-bottom:8px;">${friendsHTML}</div>
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;font-size:11px;">
                    <div><span style="color:#888;">あなたのID：</span><span id="friend-panel-my-id" style="font-family:monospace;color:#2ecc71;word-break:break-all;">取得中...</span></div>
                    <button class="mini-btn" style="flex-shrink:0;font-size:11px;padding:3px 8px;" onclick="const t=document.getElementById('friend-panel-my-id');if(t&&t.innerText!=='取得中...'){navigator.clipboard.writeText(t.innerText).then(()=>{this.innerText='✓';setTimeout(()=>this.innerText='コピー',1500)});}">コピー</button>
                </div>
                <div style="font-size:12px;color:#aaa;margin-bottom:4px;">フレンド申請（相手のPeerID）</div>
                <div style="display:flex;gap:6px;width:100%;">
                    <input class="mini-inp" id="fr-req-id" placeholder="相手のIDを入力">
                    <button class="mini-btn" onclick="sendFriendReq()">申請</button>
                </div>
            </div>`;
    }
    if (key === 'settings') {
        return `
            <div class="modal-body" style="width:100%;padding:8px 0;">
                <div class="setting-row"><span>BGM</span><input type="range" min="0" max="100" value="30" id="acct-bgm-range" oninput="updateVol('bgm', this.value)"></div>
                <div class="setting-row"><span>SE</span><input type="range" min="0" max="100" value="40" id="acct-se-range" oninput="updateVol('se', this.value)"></div>
                <div class="setting-row"><span>対戦BGM</span>
                    <select id="acct-bgm-selector" onchange="updateBattleBgm(this.value)" style="background:#333;color:white;border:1px solid #555;padding:5px;border-radius:4px;">
                        <option value="https://raw.githubusercontent.com/nayoyaniyata/musisinnki-BGM-START-/main/Break_the_Shell.mp3">BGM1</option>
                        <option value="converted.mp3">BGM2</option>
                    </select>
                </div>
            </div>`;
    }
    if (key === 'rules') {
        const rulesBody = document.querySelector('#modal-rules .rule-text');
        const tmp = rulesBody ? rulesBody.cloneNode(true) : document.createElement('div');
        tmp.querySelectorAll('center, button').forEach(el => el.remove());
        return `<div class="rule-text" style="max-height:220px;overflow-y:auto;padding:8px 0;">${tmp.innerHTML}</div>`;
    }
    return '';
}

function _syncAcctSettings() {
    try {
        const br = document.getElementById('acct-bgm-range');
        const sr = document.getElementById('acct-se-range');
        if (br) br.value = String(gameSettings.bgmVol);
        if (sr) sr.value = String(gameSettings.seVol);
        const acctSel = document.getElementById('acct-bgm-selector');
        if (acctSel) {
            const exists = Array.from(acctSel.options).some(o => o.value === gameSettings.battleBgm);
            acctSel.value = exists ? gameSettings.battleBgm : (acctSel.options[0]?.value ?? '');
        }
    } catch(e){}
}

function openAcctRecord() { toggleAcctPanel('record'); }
function openAcctFriend() { toggleAcctPanel('friend'); _initFriendPeerId(); }
function openAcctSettings() { toggleAcctPanel('settings'); }
function openAcctRules() { toggleAcctPanel('rules'); }

function _initFriendPeerId() {
    const el = () => document.getElementById('friend-panel-my-id');
    // すでにNet.peerのIDがあればすぐ表示
    if (Net.peer && Net.peer.id) {
        try { localStorage.setItem('mushi_peer_id', Net.peer.id); } catch(e) {}
        if (el()) el().innerText = Net.peer.id;
        return;
    }
    // localStorageにキャッシュがあれば使う
    try {
        const cached = localStorage.getItem('mushi_peer_id');
        if (cached) { if (el()) el().innerText = cached; return; }
    } catch(e) {}
    // なければ専用Peerを作ってIDを取得・保存
    try {
        const tmpPeer = new Peer();
        tmpPeer.on('open', (id) => {
            try { localStorage.setItem('mushi_peer_id', id); } catch(e) {}
            if (el()) el().innerText = id;
            // Net.peerがまだなければそのまま使う
            if (!Net.peer) {
                Net.peer = tmpPeer;
                const lobbyEl = document.getElementById('my-peer-id');
                if (lobbyEl) lobbyEl.innerText = id;
            } else {
                tmpPeer.destroy();
            }
        });
        tmpPeer.on('error', () => { if (el()) el().innerText = '（取得失敗）'; });
    } catch(e) { if (el()) el().innerText = '（取得失敗）'; }
}
function closeAccount() {
    const sa = document.getElementById('screen-account');
    sa.classList.remove('open');
    sa.style.transition = 'opacity 0.2s ease';
    const blur = document.getElementById('acct-blur-overlay');
    if(blur) { blur.classList.remove('open'); }
    document.getElementById('acct-back-btn').style.display = 'none';
    // borderを完全リセット
    const border = document.getElementById('acct-circle-border');
    if(border) {
        border.style.display = 'none';
        border.style.width = '60px';
        border.style.height = '60px';
        border.style.borderRadius = '50%';
        border.style.opacity = '1';
        border.style.transform = 'translate(-50%,-50%) scale(0)';
        border.style.transition = '';
    }
    // clone-activeも念のためリセット
    document.body.classList.remove('clone-active');
    setTimeout(() => {
        sa.classList.remove('animating');
        sa.classList.add('hidden');
        sa.style.transition = '';
        if(blur) blur.style.display = 'none';
        document.getElementById('account-circle-btn').style.visibility = 'visible';
    }, 250);
    document.getElementById('screen-mode').classList.remove('hidden');
    try { initFallingCards(); } catch(e) {}
    try { const el=document.getElementById('title-rank-text'); if(el){ const a=getAcct(); el.textContent='ランク'+calcRank(calcExp(a.wins,a.losses)); } } catch(e) {}
}
function toggleAvPicker() {
    const p = document.getElementById('av-picker');
    p.style.display = p.style.display === 'none' ? '' : 'none';
}
function chooseAvatar(av) {
    const a = getAcct(); a.avatar = av; saveAcct(a);
    applyAvatarToBtn(document.getElementById('av-btn'), av);
    document.querySelectorAll('.av-opt').forEach(el => el.classList.toggle('sel', el.dataset.av === av));
    document.getElementById('av-picker').style.display = 'none';
    applyAvatarToBtn(document.getElementById('account-circle-btn'), av);
}
function saveAcctName() {
    const a = getAcct();
    a.name = (document.getElementById('acct-name').value || '').trim() || 'プレイヤー';
    saveAcct(a);
}
function removeFriend(i) { const a = getAcct(); a.friends.splice(i,1); saveAcct(a); _acctOpenPanel = null; toggleAcctPanel('friend'); }
function acceptFriendReq(i) {
    const a = getAcct();
    const req = a.friendRequests[i];
    if(!a.friends.some(f=>f.id===req.id)) a.friends.push({ id:req.id, name:req.name, avatar:req.avatar||'👤' });
    a.friendRequests.splice(i,1); saveAcct(a);
    if(Net.conn && Net.conn.open){
        const me = getAcct();
        Net.send('FRIEND_ACCEPT', { id: Net.peer && Net.peer.id ? Net.peer.id : '', name: me.name, avatar: me.avatar });
    }
    _acctOpenPanel = null; openAcctFriend();
}
function rejectFriendReq(i) { const a = getAcct(); a.friendRequests.splice(i,1); saveAcct(a); _acctOpenPanel = null; toggleAcctPanel('friend'); }
function sendFriendReq() {
    const targetId = (document.getElementById('fr-req-id').value || '').trim();
    if(!targetId) return;
    const a = getAcct();
    if(a.friends.some(f=>f.id===targetId)){ alert('すでにフレンドです'); return; }
    if(!Net.peer){ alert('まずマルチ対戦画面を開いてIDを取得してください'); return; }
    const tmpConn = Net.peer.connect(targetId);
    tmpConn.on('open', () => {
        tmpConn.send({ type:'FRIEND_REQ', payload:{ id: Net.peer.id, name: a.name, avatar: a.avatar } });
        setTimeout(()=>{ try{ tmpConn.close(); }catch(e){} }, 2000);
        alert('フレンド申請を送りました！');
    });
    tmpConn.on('error', ()=>{ alert('相手に接続できませんでした（IDを確認してください）'); });
}

// ---- ロビー ----
function openFriendLobby() {
    const friends = getAcct().friends || [];
    const lobbyEl = document.getElementById('screen-lobby');
    let frListHTML = friends.length === 0
        ? '<div style="color:#888;font-size:14px;text-align:center;">フレンドがいません<br><small>アカウント画面でフレンド申請できます</small></div>'
        : '<div style="font-size:13px;color:#aaa;margin-bottom:5px;">フレンドを選んで対戦申請</div><div class="fr-list" style="max-height:160px;">'
          + friends.map((f,i)=>`<div class="fr-item"><span class="fr-name">${f.avatar||'👤'} ${f.name}</span><button class="mini-btn" onclick="inviteFriend(${i})">対戦申請</button></div>`).join('')
          + '</div>';
    lobbyEl.innerHTML = `
        <h2>フレンド対戦</h2>
        <div id="lobby-ui">
            <div class="lobby-box">${frListHTML}</div>
        </div>
        <div id="lobby-status" class="lobby-status" style="display:none;"></div>
        <button class="btn" style="background:#7f8c8d;min-width:150px;font-size:14px;margin-top:20px;" onclick="playSE('cancel'); backToLobbySelect()">← 戻る</button>`;
    document.getElementById('screen-lobby-select').classList.add('hidden');
    lobbyEl.classList.remove('hidden');
    Net.init();
}
function openIdLobby() {
    const lobbyEl = document.getElementById('screen-lobby');
    lobbyEl.innerHTML = `
        <h2>ID対戦</h2>
        <div id="lobby-ui">
            <div class="lobby-box">
                <div style="font-size:14px;color:#aaa;">あなたのID</div>
                <div style="display:flex;justify-content:center;align-items:center;gap:10px;">
                    <div id="my-peer-id" class="id-display">Connecting...</div>
                    <button class="btn" style="min-width:auto;font-size:14px;padding:8px 15px;" onclick="playSE('click'); copyPeerId()">コピー</button>
                </div>
            </div>
            <div class="lobby-box">
                <div style="font-size:14px;color:#aaa;">相手のID</div>
                <input type="text" id="target-peer-id" class="lobby-input">
                <button id="connect-btn" class="btn" style="margin-top:15px;" onclick="playSE('decide'); connectToPeer()">接続</button>
            </div>
        </div>
        <div id="lobby-status" class="lobby-status">待機中...</div>
        <button class="btn" style="background:#7f8c8d;min-width:150px;font-size:14px;margin-top:20px;" onclick="playSE('cancel'); backToLobbySelect()">← 戻る</button>`;
    document.getElementById('screen-lobby-select').classList.add('hidden');
    lobbyEl.classList.remove('hidden');
    Net.init();
}
function backToLobbySelect() {
    document.getElementById('screen-lobby').classList.add('hidden');
    document.getElementById('screen-lobby-select').classList.remove('hidden');
    try{ if(Net.conn) Net.conn.close(); }catch(e){}
    try{ if(Net.peer) Net.peer.destroy(); }catch(e){}
    Net.peer=null; Net.conn=null; Net.isHost=false; Net.gameStartedOnce=false; Net.connectLocked=false;
}
function inviteFriend(i) {
    const f = getAcct().friends[i];
    if(!Net.peer){ alert('接続準備中です。少し待ってください'); return; }
    if(Net.connectLocked || (Net.conn && Net.conn.open)) return;
    Net.connectLocked = true;
    try {
        Net.connect(f.id);
        Net.connectTimeoutId = setTimeout(()=>{
            if(Net.conn && !Net.conn.open){ Net.conn=null; Net.connectLocked=false;
                const s=document.getElementById('lobby-status'); if(s) s.innerText='接続タイムアウト';
            }
        }, 15000);
    } catch(e){ Net.connectLocked=false; }
}

// ---- 再戦 ----
const _rm = { myWants:false, opWants:false, myReady:false, opReady:false, timer:null };

function openRematchScreen(w) {
    // ★修正: turn-msgはBATTLE_HIDE_IDSに含まれないため手動で消す（2重表示防止）
    const _tm = document.getElementById('turn-msg');
    if(_tm){ _tm.style.opacity = 0; _tm.innerText = ''; _tm.style.color = ''; }
    // ★修正: ターン終了ボタンを明示的に隠す
    const _etb = document.getElementById('end-turn-btn');
    if(_etb) _etb.style.display = 'none';
    // ★修正: surrender-btnも隠す
    const _sb = document.getElementById('surrender-btn');
    if(_sb) _sb.classList.add('hidden');
    setBattleLayerVisible(false);
    _rm.myWants=false; _rm.opWants=false; _rm.myReady=false; _rm.opReady=false;
    if(_rm.timer){ clearInterval(_rm.timer); _rm.timer=null; }
    const res = document.getElementById('rematch-result');
    res.innerText = w===1 ? '🏆 YOU WIN!' : '💀 YOU LOSE...';
    res.style.color = w===1 ? '#f1c40f' : '#e74c3c';
    document.getElementById('rematch-msg').innerText = '再戦しますか？';
    document.getElementById('rematch-timer-display').style.display = 'none';
    const btn = document.getElementById('rematch-btn');
    btn.style.display = ''; btn.disabled = false; btn.innerText = '🔄 再戦する';
    // 準備OKボタンがあれば削除
    const old = document.getElementById('rematch-ready-btn');
    if(old) old.remove();
    document.getElementById('screen-rematch').classList.remove('hidden');
}

function onRematchClick() {
    _rm.myWants = true;
    const btn = document.getElementById('rematch-btn');
    btn.disabled = true; btn.innerText = '✅ 申請済み';
    document.getElementById('rematch-msg').innerText = '相手の返答を待っています...';
    Net.send('REMATCH_REQ', {});
    checkRematchReady();
}

function checkRematchReady() {
    if(!_rm.myWants || !_rm.opWants) return;
    // 両者OK → 1分カウントダウン開始
    document.getElementById('rematch-msg').innerText = 'デッキを確認してください！';
    document.getElementById('rematch-btn').style.display = 'none';
    startRematchCountdown(60);
}

function startRematchCountdown(sec) {
    let n = sec;
    const timerEl = document.getElementById('rematch-timer-display');
    timerEl.style.display = ''; timerEl.innerText = n;
    // デッキ構築ボタンを有効化
    const dk = document.getElementById('deck-build-btn');
    if(dk){ dk.style.display=''; dk.style.opacity='1'; }
    // 準備OKボタン追加
    const screen = document.getElementById('screen-rematch');
    const readyBtn = document.createElement('button');
    readyBtn.className = 'btn'; readyBtn.id = 'rematch-ready-btn';
    readyBtn.style.background = '#27ae60'; readyBtn.innerText = '✅ 準備OK！';
    readyBtn.onclick = () => {
        readyBtn.disabled = true; readyBtn.innerText = '相手を待っています...';
        _rm.myReady = true;
        Net.send('REMATCH_READY', {});
        checkBothRematchReady();
    };
    const backBtn = screen.querySelector('.btn[style*="7f8c8d"]');
    if(backBtn) screen.insertBefore(readyBtn, backBtn);

    _rm.timer = setInterval(()=>{
        n--;
        timerEl.innerText = n;
        if(n <= 0){ clearInterval(_rm.timer); _rm.timer=null; beginRematch(); }
    }, 1000);
}

function checkBothRematchReady() {
    if(_rm.myReady && _rm.opReady){ clearInterval(_rm.timer); _rm.timer=null; beginRematch(); }
}

function beginRematch() {
    const dk = document.getElementById('deck-build-btn');
    if(dk) dk.style.display = 'none';
    document.getElementById('screen-rematch').classList.add('hidden');
    // lose-effect を解除
    const gc = document.getElementById('game-container');
    if(gc) gc.classList.remove('lose-effect');
    _rm.myWants=false; _rm.opWants=false; _rm.myReady=false; _rm.opReady=false;
    // ★修正: ゲスト側で INIT_GAME が「重複」と誤判定されて無視されるバグを修正
    state.netGameInitDone = false;
    // ★修正: 前回のisReady状態が残るとじゃんけんが早期発火するバグを修正
    state.p1.isReady = false;
    state.p2.isReady = false;
    Net.gameStartedOnce = false; Net.opDeckCfg = null; Net.myDeckCfg = null;
    Net.myDeckCfg = normalizeUserDeckConfig(userDeckConfig);
    Net.send('DECK_CFG', { cfg: Net.myDeckCfg });
    if(Net.isHost) Net.maybeStartHostGame();
}


document.addEventListener('DOMContentLoaded', function() {
    var av = (function(){
        try { return JSON.parse(localStorage.getItem('musi_acct') || '{}').avatar || '__KABUTO__'; } catch(e){ return '__KABUTO__'; }
    })();
    applyAvatarToBtn(document.getElementById('account-circle-btn'), av);
    // タイトルのランク表示を初期化
    (function(){
        try {
            const el = document.getElementById('title-rank-text');
            if (!el) return;
            const a = JSON.parse(localStorage.getItem('musi_acct') || '{}');
            const wins = a.wins || 0, losses = a.losses || 0;
            const exp = wins * 5 + losses * 3;
            el.textContent = 'ランク' + calcRank(exp);
        } catch(e) {}
    })();
});

// ===== スマートフォン対応：縮小フィット =====
(function() {
    const GAME_W = 1000;
    const GAME_H = 850;

    function fitGameContainer() {
        const el = document.getElementById('game-container');
        if (!el) return;

        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const scale = Math.min(vw / GAME_W, vh / GAME_H, 1);

        // transform-origin を top left にして、position:absolute で中央配置
        // これにより「1000px分の幅を確保したまま右にはみ出す」問題を解消
        el.style.transformOrigin = 'top left';
        el.style.transform = `scale(${scale.toFixed(6)})`;
        el.style.position = 'absolute';
        el.style.left = Math.round((vw - GAME_W * scale) / 2) + 'px';
        el.style.top  = Math.round((vh - GAME_H * scale) / 2) + 'px';
        el.style.margin = '0';

        // bodyはスクロールさせない
        document.body.style.overflow = 'hidden';
        document.body.style.width  = '100vw';
        document.body.style.height = '100vh';
    }

    window.addEventListener('resize', fitGameContainer);
    window.addEventListener('orientationchange', function() {
        setTimeout(fitGameContainer, 150);
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fitGameContainer);
    } else {
        fitGameContainer();
    }
})();
