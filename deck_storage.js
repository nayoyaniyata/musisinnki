let userDeckConfig = {}; 
    
    // ===== デッキ構築の永続化（3スロット + 名前） =====
const DECK_STORAGE_KEY_OLD = 'mushi_userDeckConfig_v1';
const DECKS_STORAGE_KEY = 'mushi_savedDecks_v2';
const ACTIVE_DECK_SLOT_KEY = 'mushi_activeDeckSlot_v1';
let savedDecks = null;
let currentDeckSlot = 0; // 0..2

function blankDeckCfg(){
  const cfg = {};
  // BUG_MASTERはgame_slim.jsで定義されるため、未定義の場合は空オブジェクトを返す
  // normalizeDeckCfgが後から正しく補完するので問題ない
  try{
    if(typeof BUG_MASTER !== 'undefined'){
      BUG_MASTER.forEach((_,i)=>cfg[i]=0);
    }
  }catch(e){}
  return cfg;
}
function normalizeDeckCfg(cfg){
  const out = blankDeckCfg();
  try{
    if(cfg && typeof cfg === 'object'){
      Object.keys(cfg).forEach(k=>{
        const n = parseInt(k,10);
        if(!Number.isNaN(n)) out[n] = Math.max(0, parseInt(cfg[k],10)||0);
      });
    }
  }catch(e){}
  return out;
}
function loadSavedDecks(){
  try{
    const raw = localStorage.getItem(DECKS_STORAGE_KEY);
    if(raw){
      const arr = JSON.parse(raw);
      if(Array.isArray(arr) && arr.length){
        savedDecks = arr.map((d,i)=>({
          name: (d && d.name) ? String(d.name) : `デッキ${i+1}`,
          cfg: normalizeDeckCfg(d && d.cfg ? d.cfg : null)
        }));
      }
    }
  }catch(e){}
  if(!savedDecks || !Array.isArray(savedDecks) || savedDecks.length<3){
    savedDecks = [
      {name:'デッキ1', cfg: blankDeckCfg()},
      {name:'デッキ2', cfg: blankDeckCfg()},
      {name:'デッキ3', cfg: blankDeckCfg()},
    ];
  }
  // 旧キーがあればスロット1に移行（初回だけ）
  try{
    const old = localStorage.getItem(DECK_STORAGE_KEY_OLD);
    if(old){
      const obj = JSON.parse(old);
      savedDecks[0].cfg = normalizeDeckCfg(obj);
      localStorage.removeItem(DECK_STORAGE_KEY_OLD);
      saveSavedDecks();
    }
  }catch(e){}
}
function saveSavedDecks(){
  try{ localStorage.setItem(DECKS_STORAGE_KEY, JSON.stringify(savedDecks)); }catch(e){ console.warn('Decks save failed', e); }
}

function saveCurrentDeckSlot(){
  if(!savedDecks) loadSavedDecks();
  // 名前はクリック編集で変更。ただし空ならデフォルト名に補完する
  try{
    const nm = (savedDecks[currentDeckSlot]?.name || '').trim();
    if(!nm) savedDecks[currentDeckSlot].name = `デッキ${currentDeckSlot+1}`;
  }catch(e){}
  savedDecks[currentDeckSlot].cfg = normalizeDeckCfg(userDeckConfig);
  saveSavedDecks();
  syncDeckSlotUI();
}

function setDeckSlotName(slot, name){
  if(!savedDecks) loadSavedDecks();
  const s = Math.max(0, Math.min(2, parseInt(slot,10)));
  const nm = (name || '').trim();
  savedDecks[s].name = nm ? nm : (`デッキ${s+1}`);
  saveSavedDecks();
  syncDeckSlotUI();
}

function loadDeckSlot(slot){
  if(!savedDecks) loadSavedDecks();
  currentDeckSlot = Math.max(0, Math.min(2, slot|0));

  // 現在選択中スロットを永続化（リロードしても維持）
  try{ localStorage.setItem(ACTIVE_DECK_SLOT_KEY, String(currentDeckSlot)); }catch(e){}

  // スロットごとに必ず別オブジェクトへ（参照共有を絶対にしない）
  userDeckConfig = normalizeDeckCfg(savedDecks[currentDeckSlot].cfg);

  syncDeckSlotUI();
  // 画面の枚数表示を更新
  try{ refreshDeckBuilderCounts(); }catch(e){}
}


// ===== Deck Carousel & Auto Save =====
let __deckCarouselInited = false;
let __autoSaveTimer = null;
let __deckNameEditState = null; // {slot, oldName, input}

function scheduleAutoSaveDeckSlot(){
  try{
    if(__autoSaveTimer) clearTimeout(__autoSaveTimer);
    __autoSaveTimer = setTimeout(()=>{ 
      try{ saveCurrentDeckSlot(); }catch(e){} 
    }, 220);
  }catch(e){}
}

function commitDeckNameEditIfAny(){
  try{
    if(__deckNameEditState && __deckNameEditState.input){
      const inp = __deckNameEditState.input;
      // DOMに残っている場合だけ確定（blurが走らないケース対策）
      if(document.body.contains(inp)){
        try{ inp.blur(); }catch(e){}
      }
    }
  }catch(e){}
}

function initDeckCarousel(){
  if(__deckCarouselInited) return;
  __deckCarouselInited = true;

  const wrap = document.getElementById('deck-carousel');
  if(!wrap) return;

  // wheel(トラックパッド含む)でスロット切替
  // 目標：1回のスワイプで「1つ」だけ移動する（長い慣性スクロールで2つ飛ぶのを防ぐ）
  // 方針：
  // - 主要軸(δX/δYの大きい方)のみ採用（横スワイプ時のδY揺れで震えない）
  // - しきい値を超えたら1回だけ切替 → 以後は一定時間ロック
  // - 微小入力は無視
  let __deckCarouselWheelLockUntil = 0;
  let __deckCarouselWheelAccum = 0;
  function __handleDeckCarouselWheel(ev){
    ev.preventDefault();
    ev.stopPropagation();

    const now = Date.now();
    if(now < __deckCarouselWheelLockUntil) return;

    const dx = Number(ev.deltaX || 0);
    const dy = Number(ev.deltaY || 0);
    const ax = Math.abs(dx), ay = Math.abs(dy);

    // 主要軸だけ採用（横スワイプならdx、縦スクロールならdy）
    const d = (ax > ay) ? dx : dy;

    // 小さすぎる揺れは無視
    if(Math.abs(d) < 3) return;

    // 連続ホイールを積算して、閾値を越えたら「1回だけ」切替
    __deckCarouselWheelAccum += d;

    const TH = 35; // これ以上で1ステップ（トラックパッドの慣性で2回目が出にくい値）
    if(Math.abs(__deckCarouselWheelAccum) < TH) return;

    const dir = (__deckCarouselWheelAccum > 0) ? 1 : -1;
    __deckCarouselWheelAccum = 0;

    switchDeckSlotByDelta(dir);

    // ロック時間中は追加の入力を無視（長い慣性スクロールで2つ飛ばない）
    __deckCarouselWheelLockUntil = now + 650;
  }
  wrap.addEventListener('wheel', __handleDeckCarouselWheel, {passive:false});

  // click item to select
  wrap.querySelectorAll('.deck-carousel-item').forEach(item=>{
    item.addEventListener('click', ()=>{
      const slot = parseInt(item.getAttribute('data-slot'),10);
      if(!Number.isFinite(slot)) return;
      if(slot === currentDeckSlot) return;
      switchToDeckSlot(slot);
    });
  });

  // deck name: click label to edit
  wrap.addEventListener('click', (ev)=>{
    const lab = ev.target && ev.target.closest ? ev.target.closest('.deck-carousel-label') : null;
    if(!lab) return;
    ev.preventDefault();
    ev.stopPropagation();

    const slot = parseInt(lab.getAttribute('data-slot-label'), 10);
    if(!Number.isFinite(slot)) return;

    const oldName = (lab.textContent || (`デッキ${slot+1}`));
    const input = document.createElement('input');
    // 編集状態を記録（決定ボタン等で強制確定できるように）
    __deckNameEditState = { slot, oldName, input };
    input.type = 'text';
    input.value = oldName;
    input.setAttribute('data-slot-label', String(slot));
    input.className = 'deck-carousel-label deck-carousel-label-edit';
    input.style.background = 'rgba(0,0,0,0.8)';
    input.style.color = '#fff';
    input.style.border = '1px solid rgba(255,255,255,0.35)';
    input.style.outline = 'none';
    input.style.padding = '4px 10px';
    input.style.borderRadius = '999px';
    input.style.width = Math.max(90, Math.min(180, oldName.length * 12)) + 'px';
    input.style.textAlign = 'center';

    lab.replaceWith(input);
    input.focus();
    input.select();

    const commit = ()=>{
      // 空欄なら「元の名前」を保持（ユーザー要望：空のまま確定させない）
      let v = (input.value || '').trim();
      if(!v){
        v = (oldName || '').trim();
        if(!v) v = `デッキ${slot+1}`;
      }
      // 先に編集状態を解除（sync中に参照されないように）
      __deckNameEditState = null;
      setDeckSlotName(slot, v);
      // setDeckSlotName 内で syncDeckSlotUI() が走るのでDOMは差し替わる
    };

    input.addEventListener('keydown', (e)=>{
      if(e.key === 'Enter') { e.preventDefault(); commit(); }
      if(e.key === 'Escape') { e.preventDefault(); __deckNameEditState = null; syncDeckSlotUI(); }
    });
    input.addEventListener('blur', ()=>{ commit(); });
  }, true);
}

function switchDeckSlotByDelta(delta){
  const next = (currentDeckSlot + (delta>0?1: -1) + 3) % 3;
  switchToDeckSlot(next);
}

function switchToDeckSlot(slot){
  try{
    // まず現スロットを自動保存
    try{ saveCurrentDeckSlot(); }catch(e){}
    playSE('click');
    loadDeckSlot(slot);
    // 表示更新
    applyDeckFiltersAndRender();
  }catch(e){}
}

function renderDeckCarousel(){
  const wrap = document.getElementById('deck-carousel');
  if(!wrap) return;
  const items = Array.from(wrap.querySelectorAll('.deck-carousel-item'));
  if(items.length===0) return;

  const slotCount = 3;
  items.forEach(it=>{
    const slot = parseInt(it.getAttribute('data-slot'),10);
    let rel = (slot - currentDeckSlot + slotCount) % slotCount; // 0 front, 1 right/back, 2 left/back
    it.classList.remove('front','side1','side2');

    // positions: ellipse-like
    if(rel===0){
      it.classList.add('front');
      it.style.opacity = '1';
      it.style.filter = 'none';
      it.style.transform = 'translateX(0px) translateY(2px) rotateY(0deg) scale(1.05)';
      it.style.zIndex = '3';
    }else if(rel===1){
      it.classList.add('side1');
      it.style.opacity = '0.55';
      it.style.filter = 'blur(0.2px)';
      it.style.transform = 'translateX(170px) translateY(14px) rotateY(-25deg) scale(0.82)';
      it.style.zIndex = '2';
    }else{
      it.classList.add('side2');
      it.style.opacity = '0.55';
      it.style.filter = 'blur(0.2px)';
      it.style.transform = 'translateX(-170px) translateY(14px) rotateY(25deg) scale(0.82)';
      it.style.zIndex = '2';
    }
  });
}

function syncDeckSlotUI(){
  try{
    // カルーセルのラベル更新
    try{
      for(let i=0;i<3;i++){
        let lab = document.querySelector(`.deck-carousel-label[data-slot-label="${i}"]`);
        if(lab && savedDecks && savedDecks[i]){
          const name = (savedDecks[i].name || (`デッキ${i+1}`));
          // 入力中のinputが残っていると textContent 更新では表示が空になるので、必ずdivラベルへ戻す
          if(lab.tagName && lab.tagName.toUpperCase() === 'INPUT'){
            const div = document.createElement('div');
            div.className = 'deck-carousel-label';
            div.setAttribute('data-slot-label', String(i));
            div.textContent = name;
            lab.replaceWith(div);
            lab = div;
          }else{
            lab.textContent = name;
          }
        }
      }
    }catch(e){}
    renderDeckCarousel();
  }catch(e){}
}

function saveDeckConfigToStorage() {
  // 互換のため関数名は維持：現在のスロットに保存
  saveCurrentDeckSlot();
}
function loadDeckConfigFromStorage() {
  loadSavedDecks();
  // 前回選んでいたスロットを復元（なければ0）
  let slot = 0;
  try{
    const raw = localStorage.getItem(ACTIVE_DECK_SLOT_KEY);
    const n = parseInt(raw, 10);
    if(!Number.isNaN(n)) slot = n;
  }catch(e){}
  loadDeckSlot(slot);
  return true;
}
loadDeckConfigFromStorage();

// BUG_MASTERはgame_slim.jsで定義されるため、DOM読み込み完了後に再正規化する
// これによりblankDeckCfgが空だった場合でも正しいキー数に補完される
window.addEventListener('DOMContentLoaded', function(){
  try{
    if(typeof BUG_MASTER !== 'undefined' && savedDecks){
      savedDecks = savedDecks.map((d,i)=>({
        name: d.name || `デッキ${i+1}`,
        cfg: normalizeDeckCfg(d.cfg)
      }));
      userDeckConfig = normalizeDeckCfg(savedDecks[currentDeckSlot].cfg);
    }
  }catch(e){}
});