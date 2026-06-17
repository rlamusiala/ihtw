'use strict';

/* =========================================================
   탭 전환
========================================================= */
const tabs = document.querySelectorAll('.tab');
const navBtns = document.querySelectorAll('.nav-btn');

function showTab(name) {
  tabs.forEach((t) => t.classList.toggle('active', t.id === `tab-${name}`));
  navBtns.forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('[data-tab]').forEach((el) => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    showTab(el.dataset.tab);
  });
});

function setStatus(el, msg, type = '') {
  el.textContent = msg;
  el.className = 'status' + (type ? ' ' + type : '');
}

function copyText(text, statusEl) {
  navigator.clipboard.writeText(text).then(
    () => setStatus(statusEl, '클립보드에 복사했습니다.', 'ok'),
    () => setStatus(statusEl, '복사에 실패했습니다.', 'error')
  );
}

/* =========================================================
   1) 키워드 검색량 조회
========================================================= */
const volInput = document.getElementById('volume-input');
const volMin = document.getElementById('volume-min');
const volStatus = document.getElementById('volume-status');
const volTable = document.getElementById('volume-table');
const volBody = volTable.querySelector('tbody');
let volData = [];

document.getElementById('volume-run').addEventListener('click', runVolume);

async function runVolume() {
  const keywords = volInput.value.split('\n').map((s) => s.trim()).filter(Boolean);
  if (keywords.length === 0) {
    setStatus(volStatus, '키워드를 입력해주세요.', 'error');
    return;
  }
  setStatus(volStatus, `조회 중... (${keywords.length}개)`, 'loading');
  volTable.classList.add('hidden');

  try {
    const res = await fetch('/api/keyword-volume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keywords, minVolume: Number(volMin.value) || 0 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '조회 실패');

    volData = data.results;
    renderVolume(volData);
    setStatus(volStatus, `완료 — ${data.count}개 결과`, 'ok');
  } catch (err) {
    setStatus(volStatus, '오류: ' + err.message, 'error');
  }
}

function renderVolume(rows) {
  volBody.innerHTML = '';
  if (rows.length === 0) {
    setStatus(volStatus, '결과가 없습니다.', 'error');
    return;
  }
  for (const r of rows) {
    const tr = document.createElement('tr');
    if (r.isExact) tr.className = 'exact';
    tr.innerHTML = `
      <td>${escapeHtml(r.keyword)}</td>
      <td class="num">${r.pc.toLocaleString()}</td>
      <td class="num">${r.mobile.toLocaleString()}</td>
      <td class="num"><b>${r.total.toLocaleString()}</b></td>
      <td>${escapeHtml(r.competition)}</td>`;
    volBody.appendChild(tr);
  }
  volTable.classList.remove('hidden');
}

document.getElementById('volume-copy').addEventListener('click', () => {
  if (!volData.length) return setStatus(volStatus, '복사할 결과가 없습니다.', 'error');
  const text = volData.map((r) => `${r.keyword}\t${r.pc}\t${r.mobile}\t${r.total}`).join('\n');
  copyText(text, volStatus);
});

document.getElementById('volume-csv').addEventListener('click', () => {
  if (!volData.length) return setStatus(volStatus, '다운로드할 결과가 없습니다.', 'error');
  const header = '키워드,PC,모바일,합계,경쟁도\n';
  const body = volData
    .map((r) => `"${r.keyword}",${r.pc},${r.mobile},${r.total},"${r.competition}"`)
    .join('\n');
  downloadFile('﻿' + header + body, '키워드검색량.csv', 'text/csv');
});

/* =========================================================
   2) 키워드 조합기 (그룹 추가 + 조합 방식 선택)
========================================================= */
const combGroupsEl = document.getElementById('comb-groups');
const combRecipe = document.getElementById('comb-recipe');
const combHint = document.getElementById('comb-recipe-hint');
const combStatus = document.getElementById('comb-status');
const combOutput = document.getElementById('comb-output');

const SAMPLE_GROUPS = [
  '강남\n서초\n분당',
  '임플란트\n치아교정',
];

function addGroup(text = '') {
  const col = document.createElement('div');
  col.className = 'combiner-col';
  col.innerHTML = `
    <div class="group-head">
      <span class="group-name"><span class="group-badge"></span>번 그룹</span>
      <button class="group-del" title="이 그룹 삭제" type="button">✕</button>
    </div>
    <textarea rows="8" placeholder="한 줄에 하나씩"></textarea>`;
  col.querySelector('textarea').value = text;
  col.querySelector('.group-del').addEventListener('click', () => {
    if (combGroupsEl.querySelectorAll('.combiner-col').length <= 2) {
      setStatus(combStatus, '그룹은 최소 2개 필요합니다.', 'error');
      return;
    }
    col.remove();
    renumberGroups();
  });
  combGroupsEl.appendChild(col);
  renumberGroups();
}

function renumberGroups() {
  const cols = combGroupsEl.querySelectorAll('.combiner-col');
  cols.forEach((col, i) => {
    col.querySelector('.group-badge').textContent = i + 1;
  });
  combHint.textContent = `현재 그룹: ${cols.length}개 — 번호 1~${cols.length} 사용 가능`;
}

function getGroupWords() {
  return [...combGroupsEl.querySelectorAll('.combiner-col textarea')].map((ta) =>
    ta.value.split('\n').map((s) => s.trim()).filter(Boolean)
  );
}

// 데카르트 곱: 그룹 인덱스 배열(0-based) 순서대로 조합
function cartesian(groups, sep) {
  return groups.reduce(
    (acc, group) => acc.flatMap((prefix) => group.map((w) => [...prefix, w])),
    [[]]
  ).map((parts) => parts.join(sep));
}

document.getElementById('comb-add').addEventListener('click', () => addGroup());

document.getElementById('comb-run').addEventListener('click', () => {
  const words = getGroupWords();
  const n = words.length;
  const sep = document.getElementById('comb-sep').value;

  // 조합 방식(recipe) 파싱: "1+2, 1+3\n1+3+2" → [[1,2],[1,3],[1,3,2]]
  let recipes;
  const raw = combRecipe.value.trim();
  if (!raw) {
    recipes = [Array.from({ length: n }, (_, i) => i + 1)]; // 모든 그룹 순서대로
  } else {
    recipes = raw
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((token) => token.split('+').map((x) => parseInt(x.trim(), 10)));
  }

  const errors = [];
  const all = [];

  recipes.forEach((recipe, ri) => {
    const label = recipe.join('+');
    // 유효성 검사
    if (recipe.some((x) => !Number.isInteger(x) || x < 1 || x > n)) {
      errors.push(`"${label}" → 1~${n} 범위의 그룹 번호만 가능`);
      return;
    }
    const picked = recipe.map((idx) => words[idx - 1]);
    if (picked.some((g) => g.length === 0)) {
      errors.push(`"${label}" → 비어있는 그룹이 포함됨`);
      return;
    }
    all.push(...cartesian(picked, sep));
  });

  const result = [...new Set(all)]; // 중복 제거
  combOutput.value = result.join('\n');

  if (result.length === 0) {
    setStatus(combStatus, errors.length ? '오류: ' + errors.join(' / ') : '조합 결과가 없습니다. 그룹에 단어를 입력하세요.', 'error');
  } else if (errors.length) {
    setStatus(combStatus, `${result.length}개 생성 (일부 무시됨: ${errors.join(' / ')})`, 'warn');
  } else {
    setStatus(combStatus, `${result.length}개 조합 생성 완료`, 'ok');
  }
});

document.getElementById('comb-copy').addEventListener('click', () => {
  if (!combOutput.value) return setStatus(combStatus, '복사할 결과가 없습니다.', 'error');
  copyText(combOutput.value, combStatus);
});

document.getElementById('comb-tovolume').addEventListener('click', () => {
  if (!combOutput.value) return setStatus(combStatus, '먼저 조합을 생성해주세요.', 'error');
  volInput.value = combOutput.value;
  showTab('volume');
});

// 초기 그룹 2개
SAMPLE_GROUPS.forEach((t) => addGroup(t));

/* =========================================================
   3) 이미지 편집 (자르기 / 리사이즈 / 형식 변환 / 드래그앤드롭)
========================================================= */
const imgFile = document.getElementById('img-file');
const canvas = document.getElementById('img-canvas');
const ctx = canvas.getContext('2d');
const cropBox = document.getElementById('crop-box');
const imgStage = document.getElementById('img-stage');
const imgStatus = document.getElementById('img-status');
const ratioSel = document.getElementById('img-ratio');
const wInput = document.getElementById('img-w');
const hInput = document.getElementById('img-h');
const lockChk = document.getElementById('img-lock');
const formatSel = document.getElementById('img-format');
const qualityWrap = document.getElementById('img-quality-wrap');
const qualityInput = document.getElementById('img-quality');
const qualityVal = document.getElementById('img-quality-val');

let img = new Image();
let imgLoaded = false;
let crop = null; // 표시 좌표 기준 {x,y,w,h}

document.querySelector('.file-label').addEventListener('click', () => imgFile.click());
imgFile.addEventListener('change', (e) => {
  if (e.target.files[0]) loadImageFile(e.target.files[0]);
});

// ----- 드래그 앤 드롭 -----
['dragenter', 'dragover'].forEach((ev) =>
  imgStage.addEventListener(ev, (e) => {
    e.preventDefault();
    imgStage.classList.add('dragover');
  })
);
['dragleave', 'drop'].forEach((ev) =>
  imgStage.addEventListener(ev, (e) => {
    e.preventDefault();
    imgStage.classList.remove('dragover');
  })
);
imgStage.addEventListener('drop', (e) => {
  const file = [...(e.dataTransfer.files || [])].find((f) => f.type.startsWith('image/'));
  if (file) loadImageFile(file);
  else setStatus(imgStatus, '이미지 파일만 올릴 수 있습니다.', 'error');
});
// 페이지 다른 곳에 떨어뜨려도 브라우저가 파일을 열지 않도록
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

// 새 파일을 불러올 때 (히스토리 초기화)
function loadImageFile(file) {
  const url = URL.createObjectURL(file);
  cropHistory = [];
  imageHistory = [];
  setImageSrc(
    url,
    `불러옴: 드래그해 영역 선택 후 Enter=선택만 남기기 · ESC=취소 · Ctrl+Z=되돌리기`,
    () => URL.revokeObjectURL(url)
  );
}

// 이미지 소스를 캔버스에 표시 (파일·잘라낸 결과 공통)
function setImageSrc(src, statusMsg, after) {
  img = new Image();
  img.onload = () => {
    imgLoaded = true;
    crop = null;
    cropBox.classList.add('hidden');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.drawImage(img, 0, 0);
    if (after) after();

    imgStage.classList.add('has-image');
    wInput.value = img.naturalWidth;
    hInput.value = img.naturalHeight;
    document.getElementById('img-resize-controls').style.display = 'flex';
    document.getElementById('img-actions').style.display = 'flex';
    document.getElementById('img-reset').disabled = false;
    document.getElementById('img-crop').disabled = true;
    document.getElementById('img-apply').disabled = true;
    const dim = `${img.naturalWidth} × ${img.naturalHeight}px`;
    setStatus(imgStatus, statusMsg ? `${dim} — ${statusMsg}` : dim, 'ok');
  };
  img.onerror = () => setStatus(imgStatus, '이미지를 불러오지 못했습니다.', 'error');
  img.src = src;
}

// ----- 형식/품질 -----
function updateQualityVisibility() {
  const lossy = formatSel.value !== 'image/png';
  qualityWrap.style.display = lossy ? 'flex' : 'none';
}
formatSel.addEventListener('change', updateQualityVisibility);
qualityInput.addEventListener('input', () => (qualityVal.textContent = qualityInput.value));
updateQualityVisibility();

// ----- 크롭 영역 드래그 -----
let dragging = false;
let resizing = false;
let startX = 0, startY = 0;

canvas.addEventListener('mousedown', (e) => {
  if (!imgLoaded) return;
  pushHistory(); // 새 선택을 시작하기 전에 현재 선택을 기록 (Ctrl+Z용)
  const rect = canvas.getBoundingClientRect();
  startX = e.clientX - rect.left;
  startY = e.clientY - rect.top;
  dragging = true;
  crop = { x: startX, y: startY, w: 0, h: 0 };
  updateCropBox();
});

window.addEventListener('mousemove', (e) => {
  if (!imgLoaded) return;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const ratio = parseFloat(ratioSel.value);

  if (dragging) {
    let w = mx - startX;
    let h = my - startY;
    if (!isNaN(ratio) && ratio > 0) h = Math.sign(h || 1) * Math.abs(w) / ratio;
    crop = {
      x: Math.min(startX, startX + w),
      y: Math.min(startY, startY + h),
      w: Math.abs(w),
      h: Math.abs(h),
    };
    updateCropBox();
  } else if (resizing && crop) {
    let w = Math.max(10, mx - crop.x);
    let h = Math.max(10, my - crop.y);
    if (!isNaN(ratio) && ratio > 0) h = w / ratio;
    crop.w = w;
    crop.h = h;
    updateCropBox();
  }
});

window.addEventListener('mouseup', () => {
  if (dragging && crop && crop.w > 5 && crop.h > 5) {
    document.getElementById('img-crop').disabled = false;
    document.getElementById('img-apply').disabled = false;
  }
  dragging = false;
  resizing = false;
});

cropBox.querySelector('.handle.br').addEventListener('mousedown', (e) => {
  e.stopPropagation();
  resizing = true;
});

function updateCropBox() {
  if (!crop) return;
  const rect = canvas.getBoundingClientRect();
  const stageRect = imgStage.getBoundingClientRect();
  cropBox.style.left = rect.left - stageRect.left + crop.x + 'px';
  cropBox.style.top = rect.top - stageRect.top + crop.y + 'px';
  cropBox.style.width = crop.w + 'px';
  cropBox.style.height = crop.h + 'px';
  cropBox.classList.remove('hidden');
}

// ----- 저장 동작 -----
// 자른 영역 저장
document.getElementById('img-crop').addEventListener('click', () => {
  if (!crop || crop.w < 5) return;
  const rect = canvas.getBoundingClientRect();
  const s = canvas.width / rect.width; // 원본/표시 비율
  const sx = crop.x * s, sy = crop.y * s, sw = crop.w * s, sh = crop.h * s;
  const out = document.createElement('canvas');
  out.width = Math.round(sw);
  out.height = Math.round(sh);
  out.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
  saveCanvas(out, '재단');
});

// 리사이즈 저장
document.getElementById('img-resize-save').addEventListener('click', () => {
  const w = parseInt(wInput.value, 10);
  const h = parseInt(hInput.value, 10);
  if (!w || !h) return setStatus(imgStatus, '가로/세로 값을 확인해주세요.', 'error');
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const c = out.getContext('2d');
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  c.drawImage(img, 0, 0, w, h);
  saveCanvas(out, '리사이즈');
});

// 캔버스를 선택한 형식/품질로 저장
function saveCanvas(sourceCanvas, baseName) {
  if (!imgLoaded) return setStatus(imgStatus, '먼저 이미지를 불러오세요.', 'error');
  const format = formatSel.value;
  const quality = format === 'image/png' ? undefined : Number(qualityInput.value) / 100;
  const extMap = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
  const ext = extMap[format];

  // JPG는 투명 배경을 지원하지 않으므로 흰색으로 채운다
  let outCanvas = sourceCanvas;
  if (format === 'image/jpeg') {
    outCanvas = document.createElement('canvas');
    outCanvas.width = sourceCanvas.width;
    outCanvas.height = sourceCanvas.height;
    const c = outCanvas.getContext('2d');
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, outCanvas.width, outCanvas.height);
    c.drawImage(sourceCanvas, 0, 0);
  }

  outCanvas.toBlob(
    (blob) => {
      if (!blob) return setStatus(imgStatus, '저장에 실패했습니다.', 'error');
      const kb = Math.round(blob.size / 1024);
      downloadBlob(blob, `${baseName}_${outCanvas.width}x${outCanvas.height}.${ext}`);
      setStatus(imgStatus, `저장 완료: ${outCanvas.width}×${outCanvas.height} ${ext.toUpperCase()} (${kb}KB)`, 'ok');
    },
    format,
    quality
  );
}

// 비율 유지 리사이즈 입력
wInput.addEventListener('input', () => {
  if (lockChk.checked && imgLoaded) {
    hInput.value = Math.round(parseInt(wInput.value, 10) / (img.naturalWidth / img.naturalHeight)) || '';
  }
});
hInput.addEventListener('input', () => {
  if (lockChk.checked && imgLoaded) {
    wInput.value = Math.round(parseInt(hInput.value, 10) * (img.naturalWidth / img.naturalHeight)) || '';
  }
});

function clearSelection(msg) {
  crop = null;
  cropBox.classList.add('hidden');
  document.getElementById('img-crop').disabled = true;
  document.getElementById('img-apply').disabled = true;
  if (msg) setStatus(imgStatus, msg, '');
}

document.getElementById('img-reset').addEventListener('click', () => {
  cropHistory = [];
  clearSelection('선택 영역을 초기화했습니다.');
});

/* ----- 선택 영역만 남기기 (Enter / 버튼) -----
   선택한 영역 외는 잘라내고, 그 결과를 그대로 캔버스에 표시한다. */
function applyCrop() {
  if (!crop || crop.w < 5 || crop.h < 5) {
    setStatus(imgStatus, '먼저 자를 영역을 드래그하세요.', 'error');
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const s = canvas.width / rect.width; // 원본/표시 비율
  const sx = crop.x * s, sy = crop.y * s, sw = crop.w * s, sh = crop.h * s;

  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(sw));
  out.height = Math.max(1, Math.round(sh));
  out.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);

  // 잘라내기 전 이미지를 되돌리기용으로 저장
  imageHistory.push(canvas.toDataURL('image/png'));
  if (imageHistory.length > 20) imageHistory.shift();
  cropHistory = [];

  setImageSrc(out.toDataURL('image/png'), '선택 영역만 남겼습니다. Ctrl+Z로 되돌릴 수 있어요.');
}

document.getElementById('img-apply').addEventListener('click', applyCrop);

/* ----- 실행 취소(Ctrl+Z) / 취소(ESC) ----- */
let cropHistory = [];
let imageHistory = []; // 잘라내기 적용 전 이미지(dataURL) 스택

function pushHistory() {
  if (crop && crop.w > 3 && crop.h > 3) cropHistory.push({ ...crop });
  if (cropHistory.length > 50) cropHistory.shift();
}

function undo() {
  // 1) 드래그/리사이즈 진행 중이면 그 동작만 취소
  if (dragging || resizing) {
    dragging = false;
    resizing = false;
    clearSelection('작업을 취소했습니다.');
    return;
  }
  // 2) 현재 선택이 있으면 이전 선택으로 되돌리거나 선택 해제
  if (crop) {
    if (cropHistory.length > 0) {
      crop = cropHistory.pop();
      updateCropBox();
      document.getElementById('img-crop').disabled = false;
      document.getElementById('img-apply').disabled = false;
      setStatus(imgStatus, `이전 선택으로 되돌렸습니다. (남은 단계: ${cropHistory.length})`, '');
    } else {
      clearSelection('선택을 해제했습니다.');
    }
    return;
  }
  // 3) 선택이 없으면 마지막으로 잘라낸 이미지를 복원
  if (imageHistory.length > 0) {
    setImageSrc(imageHistory.pop(), `잘라내기를 되돌렸습니다. (남은 단계: ${imageHistory.length})`);
  } else {
    setStatus(imgStatus, '더 되돌릴 작업이 없습니다.', '');
  }
}

document.addEventListener('keydown', (e) => {
  // 이미지 편집 탭이 활성화되고 이미지가 로드된 경우에만 동작
  if (!document.getElementById('tab-image').classList.contains('active') || !imgLoaded) return;
  // 입력칸에 포커스가 있으면 기본 동작을 방해하지 않음
  const tag = (document.activeElement && document.activeElement.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  if (e.key === 'Escape') {
    e.preventDefault();
    dragging = false;
    resizing = false;
    clearSelection('선택을 취소했습니다. (ESC)');
  } else if (e.key === 'Enter') {
    e.preventDefault();
    applyCrop();
  } else if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
    e.preventDefault();
    undo();
  }
});

/* =========================================================
   유틸
========================================================= */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function downloadFile(content, name, type) {
  downloadBlob(new Blob([content], { type }), name);
}
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
