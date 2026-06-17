'use strict';
/* 추가 도구 모음 — app.js의 전역 헬퍼(setStatus, copyText, downloadBlob, showTab, volInput) 사용 */

/* ---------- 공통 헬퍼 ---------- */
function toBlobAsync(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}
function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    loadImage(url).then((im) => { URL.revokeObjectURL(url); resolve(im); }, reject);
  });
}
function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}
// 드롭존 만들기. onFiles(File[]) 콜백.
function makeDropzone(el, onFiles) {
  ['dragenter', 'dragover'].forEach((ev) =>
    el.addEventListener(ev, (e) => { e.preventDefault(); el.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach((ev) =>
    el.addEventListener(ev, (e) => { e.preventDefault(); el.classList.remove('dragover'); }));
  el.addEventListener('drop', (e) => {
    const files = [...(e.dataTransfer.files || [])].filter((f) => f.type.startsWith('image/'));
    if (files.length) onFiles(files);
  });
}

/* =========================================================
   글자수 세기
========================================================= */
(function () {
  const input = document.getElementById('counter-input');
  const set = (id, n) => (document.getElementById(id).textContent = n.toLocaleString());
  function update() {
    const t = input.value;
    set('cnt-all', [...t].length);
    set('cnt-nospace', [...t.replace(/\s/g, '')].length);
    set('cnt-bytes', new TextEncoder().encode(t).length);
    set('cnt-words', (t.trim().match(/\S+/g) || []).length);
    set('cnt-lines', t === '' ? 0 : t.split('\n').length);
    set('cnt-sentences', (t.match(/[.!?。！？]+/g) || []).length);
  }
  input.addEventListener('input', update);
  document.getElementById('counter-clear').addEventListener('click', () => {
    input.value = '';
    update();
    input.focus();
  });
})();

/* =========================================================
   연관검색어 · 자동완성 수집
========================================================= */
(function () {
  const input = document.getElementById('ac-input');
  const status = document.getElementById('ac-status');
  const groupsEl = document.getElementById('ac-groups');
  const output = document.getElementById('ac-output');

  document.getElementById('ac-run').addEventListener('click', async () => {
    const keywords = input.value.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!keywords.length) return setStatus(status, '키워드를 입력해주세요.', 'error');
    setStatus(status, `수집 중... (${keywords.length}개)`, 'loading');
    groupsEl.innerHTML = '';
    try {
      const res = await fetch('/api/autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '수집 실패');

      data.groups.forEach((g) => {
        const div = document.createElement('div');
        div.className = 'ac-group';
        const chips = g.suggestions
          .map((s) => `<span class="chip">${escapeHtml(s)}</span>`)
          .join('') || '<span class="stat-label">결과 없음</span>';
        div.innerHTML = `<div class="ac-seed">🔎 ${escapeHtml(g.seed)} (${g.suggestions.length})</div><div class="chips">${chips}</div>`;
        groupsEl.appendChild(div);
      });
      // 칩 클릭 시 해당 키워드를 출력창에 추가
      groupsEl.querySelectorAll('.chip').forEach((c) =>
        c.addEventListener('click', () => {
          const lines = output.value ? output.value.split('\n') : [];
          if (!lines.includes(c.textContent)) {
            lines.push(c.textContent);
            output.value = lines.join('\n');
          }
        }));

      output.value = data.all.join('\n');
      setStatus(status, `완료 — 중복 제거 ${data.count}개`, 'ok');
    } catch (err) {
      setStatus(status, '오류: ' + err.message, 'error');
    }
  });

  document.getElementById('ac-copy').addEventListener('click', () => {
    if (!output.value) return setStatus(status, '복사할 내용이 없습니다.', 'error');
    copyText(output.value, status);
  });
  document.getElementById('ac-tovolume').addEventListener('click', () => {
    if (!output.value) return setStatus(status, '먼저 수집해주세요.', 'error');
    volInput.value = output.value;
    showTab('volume');
  });
})();

/* =========================================================
   해시태그 변환 + 인스타 줄바꿈
========================================================= */
(function () {
  const tagInput = document.getElementById('tag-input');
  const tagOutput = document.getElementById('tag-output');

  document.getElementById('tag-run').addEventListener('click', () => {
    const noSpace = document.getElementById('tag-nospace').checked;
    const join = document.getElementById('tag-join').value === 'nl' ? '\n' : ' ';
    const tags = tagInput.value
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => '#' + (noSpace ? s.replace(/\s+/g, '') : s));
    tagOutput.value = [...new Set(tags)].join(join);
  });
  document.getElementById('tag-copy').addEventListener('click', () => {
    const st = document.getElementById('insta-status'); // 공용 상태 없으니 임시
    if (!tagOutput.value) return;
    navigator.clipboard.writeText(tagOutput.value);
  });

  // 인스타 줄바꿈: 빈 줄을 보이지 않는 문자로 채워 줄바꿈이 사라지지 않게 함
  const instaInput = document.getElementById('insta-input');
  const instaStatus = document.getElementById('insta-status');
  document.getElementById('insta-run').addEventListener('click', () => {
    if (!instaInput.value) return setStatus(instaStatus, '내용을 입력해주세요.', 'error');
    const converted = instaInput.value
      .split('\n')
      .map((line) => (line.trim() === '' ? '⁣' : line)) // 빈 줄 → 보이지 않는 문자
      .join('\n');
    navigator.clipboard.writeText(converted).then(
      () => setStatus(instaStatus, '변환해서 복사했습니다. 인스타/페북에 붙여넣으세요.', 'ok'),
      () => setStatus(instaStatus, '복사 실패 — 직접 복사해주세요.', 'error')
    );
  });
})();

/* =========================================================
   이미지 용량 줄이기 (압축)
========================================================= */
(function () {
  const fileInput = document.getElementById('cmp-file');
  const drop = document.getElementById('cmp-drop');
  const hint = document.getElementById('cmp-hint');
  const preview = document.getElementById('cmp-preview');
  const status = document.getElementById('cmp-status');
  const runBtn = document.getElementById('cmp-run');
  const resultEl = document.getElementById('cmp-result');
  let curImg = null;
  let originalSize = 0;

  drop.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => e.target.files[0] && load(e.target.files[0]));
  makeDropzone(drop, (files) => load(files[0]));

  async function load(file) {
    originalSize = file.size;
    curImg = await fileToImage(file);
    preview.src = curImg.src;
    preview.classList.remove('hidden');
    hint.classList.add('hidden');
    drop.classList.add('has-image');
    runBtn.disabled = false;
    resultEl.classList.add('hidden');
    setStatus(status, `원본: ${curImg.naturalWidth}×${curImg.naturalHeight}, ${fmtSize(originalSize)}`, 'ok');
  }

  runBtn.addEventListener('click', async () => {
    if (!curImg) return;
    const format = document.getElementById('cmp-format').value;
    const targetKB = parseInt(document.getElementById('cmp-target').value, 10);
    setStatus(status, '압축 중...', 'loading');

    const canvas = document.createElement('canvas');
    canvas.width = curImg.naturalWidth;
    canvas.height = curImg.naturalHeight;
    const c = canvas.getContext('2d');
    if (format === 'image/jpeg') { c.fillStyle = '#fff'; c.fillRect(0, 0, canvas.width, canvas.height); }
    c.drawImage(curImg, 0, 0);

    let blob;
    if (targetKB && targetKB > 0) {
      blob = await compressToTarget(canvas, format, targetKB * 1024);
    } else {
      blob = await toBlobAsync(canvas, format, 0.85);
    }

    const ext = format === 'image/webp' ? 'webp' : 'jpg';
    const pct = Math.max(0, Math.round((1 - blob.size / originalSize) * 100));
    resultEl.classList.remove('hidden');
    resultEl.innerHTML = `
      <div class="col">원본<br><span class="big">${fmtSize(originalSize)}</span></div>
      <div class="col">압축 후<br><span class="big">${fmtSize(blob.size)}</span></div>
      <div class="col">절감<br><span class="big down">${pct}%↓</span></div>`;
    const btn = document.createElement('button');
    btn.className = 'btn primary';
    btn.textContent = '저장';
    btn.onclick = () => downloadBlob(blob, `압축_${canvas.width}x${canvas.height}.${ext}`);
    resultEl.appendChild(btn);
    setStatus(status, '완료', 'ok');
  });

  async function compressToTarget(canvas, type, targetBytes) {
    let lo = 0.3, hi = 0.95, best = null;
    for (let i = 0; i < 8; i++) {
      const q = (lo + hi) / 2;
      const blob = await toBlobAsync(canvas, type, q);
      if (blob.size <= targetBytes) { best = blob; lo = q; } else { hi = q; }
    }
    return best || (await toBlobAsync(canvas, type, 0.3));
  }
})();

/* =========================================================
   QR 코드 생성
========================================================= */
(function () {
  const canvas = document.getElementById('qr-canvas');
  const status = document.getElementById('qr-status');
  const saveBtn = document.getElementById('qr-save');
  let logoImg = null;

  document.getElementById('qr-logo').addEventListener('change', async (e) => {
    logoImg = e.target.files[0] ? await fileToImage(e.target.files[0]) : null;
  });

  document.getElementById('qr-run').addEventListener('click', () => {
    const text = document.getElementById('qr-text').value.trim();
    if (!text) return setStatus(status, '내용을 입력해주세요.', 'error');
    if (typeof qrcode === 'undefined') return setStatus(status, 'QR 라이브러리를 불러오지 못했습니다(인터넷 연결 확인).', 'error');

    const size = Math.min(1024, Math.max(120, parseInt(document.getElementById('qr-size').value, 10) || 320));
    const fg = document.getElementById('qr-fg').value;
    const bg = document.getElementById('qr-bg').value;

    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const count = qr.getModuleCount();
    const margin = 4;
    const total = count + margin * 2;
    const cell = Math.floor(size / total);
    const dim = cell * total;
    canvas.width = dim;
    canvas.height = dim;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, dim, dim);
    ctx.fillStyle = fg;
    for (let r = 0; r < count; r++) {
      for (let col = 0; col < count; col++) {
        if (qr.isDark(r, col)) {
          ctx.fillRect((col + margin) * cell, (r + margin) * cell, cell, cell);
        }
      }
    }
    if (logoImg) {
      const lw = dim * 0.22;
      const x = (dim - lw) / 2;
      ctx.fillStyle = bg;
      ctx.fillRect(x - 6, x - 6, lw + 12, lw + 12);
      ctx.drawImage(logoImg, x, x, lw, lw);
    }
    saveBtn.disabled = false;
    setStatus(status, '생성 완료', 'ok');
  });

  saveBtn.addEventListener('click', () =>
    canvas.toBlob((b) => downloadBlob(b, 'qr.png'), 'image/png'));
})();

/* =========================================================
   이미지 워터마크
========================================================= */
(function () {
  const fileInput = document.getElementById('wm-file');
  const drop = document.getElementById('wm-drop');
  const hint = document.getElementById('wm-hint');
  const canvas = document.getElementById('wm-canvas');
  const status = document.getElementById('wm-status');
  const saveBtn = document.getElementById('wm-save');
  const typeSel = document.getElementById('wm-type');
  let baseImg = null;
  let logoImg = null;

  drop.addEventListener('click', (e) => { if (e.target === drop || e.target.closest('.drop-hint')) fileInput.click(); });
  fileInput.addEventListener('change', (e) => e.target.files[0] && loadBase(e.target.files[0]));
  makeDropzone(drop, (files) => loadBase(files[0]));
  document.getElementById('wm-logo').addEventListener('change', async (e) => {
    logoImg = e.target.files[0] ? await fileToImage(e.target.files[0]) : null;
    render();
  });

  typeSel.addEventListener('change', () => {
    const isLogo = typeSel.value === 'logo';
    document.getElementById('wm-logo-wrap').style.display = isLogo ? 'flex' : 'none';
    document.getElementById('wm-text-controls').style.display = isLogo ? 'none' : 'flex';
    render();
  });

  ['wm-text', 'wm-color', 'wm-pos'].forEach((id) =>
    document.getElementById(id).addEventListener('input', render));
  ['wm-size', 'wm-opacity'].forEach((id) =>
    document.getElementById(id).addEventListener('input', (e) => {
      document.getElementById(id + '-val').textContent = e.target.value;
      render();
    }));

  async function loadBase(file) {
    baseImg = await fileToImage(file);
    canvas.classList.remove('hidden');
    hint.classList.add('hidden');
    drop.classList.add('has-image');
    saveBtn.disabled = false;
    render();
    setStatus(status, `${baseImg.naturalWidth}×${baseImg.naturalHeight} — 옵션을 조절하세요.`, 'ok');
  }

  function placeXY(pos, w, h, mw, mh, pad) {
    const map = {
      tl: [pad, pad], tr: [w - mw - pad, pad],
      bl: [pad, h - mh - pad], br: [w - mw - pad, h - mh - pad],
      center: [(w - mw) / 2, (h - mh) / 2],
    };
    return map[pos] || map.br;
  }

  function render() {
    if (!baseImg) return;
    const w = baseImg.naturalWidth, h = baseImg.naturalHeight;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(baseImg, 0, 0);
    const pos = document.getElementById('wm-pos').value;
    const sizePct = parseInt(document.getElementById('wm-size').value, 10) / 100;
    const opacity = parseInt(document.getElementById('wm-opacity').value, 10) / 100;
    const pad = Math.round(Math.min(w, h) * 0.03);
    ctx.globalAlpha = opacity;

    if (typeSel.value === 'logo' && logoImg) {
      const lw = w * sizePct * 2;
      const lh = lw * (logoImg.naturalHeight / logoImg.naturalWidth);
      if (pos === 'tile') tile(ctx, w, h, lw * 1.6, lh * 1.6, (x, y) => ctx.drawImage(logoImg, x, y, lw, lh));
      else { const [x, y] = placeXY(pos, w, h, lw, lh, pad); ctx.drawImage(logoImg, x, y, lw, lh); }
    } else {
      const text = document.getElementById('wm-text').value || '';
      const fontSize = Math.max(10, Math.round(w * sizePct));
      ctx.font = `700 ${fontSize}px 'Noto Sans KR', sans-serif`;
      ctx.fillStyle = document.getElementById('wm-color').value;
      ctx.textBaseline = 'top';
      const mw = ctx.measureText(text).width;
      const mh = fontSize;
      if (pos === 'tile') tile(ctx, w, h, mw + fontSize, mh + fontSize, (x, y) => ctx.fillText(text, x, y));
      else { const [x, y] = placeXY(pos, w, h, mw, mh, pad); ctx.fillText(text, x, y); }
    }
    ctx.globalAlpha = 1;
  }

  function tile(ctx, w, h, stepX, stepY, draw) {
    for (let y = 0; y < h; y += stepY) for (let x = 0; x < w; x += stepX) draw(x, y);
  }

  saveBtn.addEventListener('click', () => {
    if (!baseImg) return;
    canvas.toBlob((b) => downloadBlob(b, `워터마크_${canvas.width}x${canvas.height}.png`), 'image/png');
  });
})();

/* =========================================================
   여러 이미지 일괄 변환 / 리사이즈
========================================================= */
(function () {
  const fileInput = document.getElementById('bat-file');
  const drop = document.getElementById('bat-drop');
  const status = document.getElementById('bat-status');
  const listEl = document.getElementById('bat-list');
  const runBtn = document.getElementById('bat-run');
  let files = [];

  drop.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => addFiles([...e.target.files]));
  makeDropzone(drop, (fs) => addFiles(fs));
  document.getElementById('bat-q').addEventListener('input', (e) =>
    (document.getElementById('bat-q-val').textContent = e.target.value));

  function addFiles(fs) {
    files = fs.filter((f) => f.type.startsWith('image/'));
    listEl.innerHTML = files.map((f) => `<li><span>${escapeHtml(f.name)}</span><span class="st">대기</span></li>`).join('');
    runBtn.disabled = files.length === 0;
    setStatus(status, `${files.length}장 선택됨`, 'ok');
  }

  runBtn.addEventListener('click', async () => {
    if (!files.length) return;
    if (typeof JSZip === 'undefined') return setStatus(status, 'ZIP 라이브러리를 불러오지 못했습니다(인터넷 연결 확인).', 'error');
    const format = document.getElementById('bat-format').value;
    const maxW = parseInt(document.getElementById('bat-maxw').value, 10) || 0;
    const quality = parseInt(document.getElementById('bat-q').value, 10) / 100;
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[format];
    setStatus(status, '변환 중...', 'loading');
    const zip = new JSZip();
    const rows = listEl.querySelectorAll('li .st');

    for (let i = 0; i < files.length; i++) {
      try {
        const im = await fileToImage(files[i]);
        let w = im.naturalWidth, h = im.naturalHeight;
        if (maxW > 0 && w > maxW) { h = Math.round(h * (maxW / w)); w = maxW; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const c = canvas.getContext('2d');
        if (format === 'image/jpeg') { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); }
        c.imageSmoothingQuality = 'high';
        c.drawImage(im, 0, 0, w, h);
        const blob = await toBlobAsync(canvas, format, quality);
        const base = files[i].name.replace(/\.[^.]+$/, '');
        zip.file(`${base}.${ext}`, blob);
        rows[i].textContent = '완료';
        rows[i].className = 'st ok';
      } catch (err) {
        rows[i].textContent = '실패';
      }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    downloadBlob(content, `일괄변환_${files.length}장.zip`);
    setStatus(status, `완료 — ${files.length}장 ZIP 저장`, 'ok');
  });
})();
