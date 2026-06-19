'use strict';
/* 추가 도구 모음 — app.js의 전역 헬퍼(setStatus, copyText, downloadBlob, showTab, volInput) 사용 */

/* ---------- 상단 드롭다운 메뉴 ---------- */
(function () {
  const menus = document.querySelectorAll('.menu');

  // 모바일/터치: 라벨 클릭으로 펼치기
  menus.forEach((menu) => {
    const label = menu.querySelector('.menu-label');
    label.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = menu.classList.contains('open');
      menus.forEach((m) => m.classList.remove('open'));
      if (!open) menu.classList.add('open');
    });
  });
  document.addEventListener('click', () => menus.forEach((m) => m.classList.remove('open')));

  // 현재 활성 탭이 속한 카테고리 라벨 강조
  function syncMenuActive() {
    const active = document.querySelector('.tab.active');
    const id = active ? active.id.replace('tab-', '') : 'home';
    menus.forEach((m) => {
      const has = [...m.querySelectorAll('[data-tab]')].some((b) => b.dataset.tab === id);
      m.querySelector('.menu-label').classList.toggle('active', has);
    });
  }
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-tab]')) setTimeout(syncMenuActive, 0);
  });
  syncMenuActive();
})();

/* =========================================================
   사주 (만세력) — 사주팔자 + 오행 + 띠 + 가벼운 풀이
   * 일주는 1901-01-01=기묘(己卯) 기준으로 보정(정확).
   * 년/월주는 절기 근사라 경계일 오차 가능.
========================================================= */
(function () {
  const GAN = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
  const GAN_H = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const JI = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
  const JI_H = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  const ANIMAL = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];
  const OH = ['목', '화', '토', '금', '수'];
  const OH_FULL = ['목(木)', '화(火)', '토(土)', '금(金)', '수(水)'];
  const OH_COLOR = ['#1f9d55', '#e0533d', '#caa14a', '#9aa0aa', '#3b5bdb']; // 목화토금수
  const JI_OH = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4]; // 자축인묘진사오미신유술해 → 오행 index
  const ganOh = (g) => Math.floor(g / 2); // 0~1목,2~3화,...

  // 율리우스 적일수
  function jdn(y, m, d) {
    const a = Math.floor((14 - m) / 12);
    const yy = y + 4800 - a;
    const mm = m + 12 * a - 3;
    return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  }
  // 사주 월지 경계(절기 근사): [월, 일, 지지index]
  const MB = [[1, 6, 1], [2, 4, 2], [3, 6, 3], [4, 5, 4], [5, 6, 5], [6, 6, 6], [7, 7, 7], [8, 8, 8], [9, 8, 9], [10, 8, 10], [11, 7, 11], [12, 7, 0]];
  function monthBranch(m, d) {
    let br = 0; // 대설~소한(자월)
    for (const [bm, bd, b] of MB) if (m > bm || (m === bm && d >= bd)) br = b;
    return br;
  }
  const beforeIpchun = (m, d) => m < 2 || (m === 2 && d < 4);

  function calc(y, m, d, hJi /* 0~11 또는 null */) {
    const yy = beforeIpchun(m, d) ? y - 1 : y;
    const yGan = ((yy - 4) % 10 + 10) % 10, yJi = ((yy - 4) % 12 + 12) % 12;
    const mJi = monthBranch(m, d);
    const inGan = ((yGan % 5) * 2 + 2) % 10;
    const mGan = (inGan + ((mJi - 2 + 12) % 12)) % 10;
    const di = (jdn(y, m, d) + 49) % 60;
    const dGan = di % 10, dJi = di % 12;
    let hGan = null;
    if (hJi !== null) hGan = (((dGan % 5) * 2) % 10 + hJi) % 10;
    return { yGan, yJi, mGan, mJi, dGan, dJi, hGan, hJi };
  }

  const READ_DAY = {
    목: '곧고 성장 지향적이며 인정이 많습니다. 새로운 일을 벌이고 추진하는 힘이 있어요.',
    화: '밝고 표현력이 좋으며 열정적입니다. 사람을 끌어당기는 활동가 기질이 있어요.',
    토: '듬직하고 신뢰감을 주며 포용력이 큽니다. 안정과 중재에 강해요.',
    금: '원칙과 의리가 분명하고 결단력이 있습니다. 맺고 끊는 것이 확실해요.',
    수: '생각이 깊고 유연하며 지혜롭습니다. 상황 적응력과 통찰이 뛰어나요.',
  };

  function pillarHTML(label, gan, ji, isMe) {
    const gOh = ganOh(gan), jOh = JI_OH[ji];
    return `<div class="saju-col${isMe ? ' me' : ''}">
      <div class="col-label">${label}${isMe ? ' (나)' : ''}</div>
      <div class="saju-char" style="background:${OH_COLOR[gOh]}">
        <div class="hanja">${GAN_H[gan]}</div><div class="hangul">${GAN[gan]}</div><div class="oh">${OH[gOh]}</div>
      </div>
      <div class="saju-char" style="background:${OH_COLOR[jOh]}">
        <div class="hanja">${JI_H[ji]}</div><div class="hangul">${JI[ji]}</div><div class="oh">${OH[jOh]}</div>
      </div>
    </div>`;
  }

  document.getElementById('saju-run').addEventListener('click', () => {
    const dateVal = document.getElementById('saju-date').value;
    const hourVal = document.getElementById('saju-hour').value;
    const status = document.getElementById('saju-status');
    if (!dateVal) return setStatus(status, '생년월일을 입력해주세요.', 'error');
    const [y, m, d] = dateVal.split('-').map(Number);
    if (y < 1900 || y > 2100) return setStatus(status, '1900~2100년 사이로 입력해주세요.', 'error');
    const hJi = hourVal === '' ? null : Number(hourVal);

    const s = calc(y, m, d, hJi);

    // 사주팔자 표시 (년 월 일 시)
    let grid = pillarHTML('년주', s.yGan, s.yJi, false) + pillarHTML('월주', s.mGan, s.mJi, false) + pillarHTML('일주', s.dGan, s.dJi, true);
    grid += s.hJi !== null
      ? pillarHTML('시주', s.hGan, s.hJi, false)
      : `<div class="saju-col"><div class="col-label">시주</div><div class="saju-char" style="background:#d4d8e0;color:#fff"><div class="hanja">?</div><div class="hangul">시간모름</div><div class="oh">-</div></div></div>`;
    document.getElementById('saju-pillars').innerHTML = grid;

    // 오행 분포
    const cnt = [0, 0, 0, 0, 0];
    cnt[ganOh(s.yGan)]++; cnt[JI_OH[s.yJi]]++;
    cnt[ganOh(s.mGan)]++; cnt[JI_OH[s.mJi]]++;
    cnt[ganOh(s.dGan)]++; cnt[JI_OH[s.dJi]]++;
    if (s.hJi !== null) { cnt[ganOh(s.hGan)]++; cnt[JI_OH[s.hJi]]++; }
    const total = cnt.reduce((a, b) => a + b, 0);
    const maxc = Math.max(...cnt);
    document.getElementById('saju-ohaeng').innerHTML = OH.map((o, i) =>
      `<div class="oh-bar-row"><div class="oh-bar-label" style="color:${OH_COLOR[i]}">${OH_FULL[i]}</div>
        <div class="oh-bar-track"><div class="oh-bar-fill" style="width:${(cnt[i] / maxc) * 100}%;background:${OH_COLOR[i]}"></div></div>
        <div class="oh-bar-count">${cnt[i]}</div></div>`).join('');

    // 가벼운 풀이
    const dayOh = OH[ganOh(s.dGan)];
    const lacking = OH.filter((o, i) => cnt[i] === 0);
    const strong = OH.filter((o, i) => cnt[i] === maxc && maxc >= 3);
    const animal = ANIMAL[s.yJi];
    let reading = `<div class="row">🐾 <b>${animal}띠</b> · 일간(나)은 <b>${GAN[s.dGan]}${GAN_H[s.dGan]}</b>, 오행으로는 <b>${dayOh}</b>입니다.</div>`;
    reading += `<div class="row">${READ_DAY[dayOh]}</div>`;
    if (strong.length) reading += `<div class="row">사주에 <b>${strong.join('·')}</b> 기운이 강한 편이에요.</div>`;
    if (lacking.length) reading += `<div class="row">상대적으로 <b>${lacking.join('·')}</b> 기운이 부족해, 이 기운을 보완하면 균형에 도움이 됩니다.</div>`;
    if (!strong.length && !lacking.length) reading += `<div class="row">오행이 비교적 고르게 분포해 균형이 좋은 편이에요.</div>`;
    document.getElementById('saju-reading').innerHTML = reading;

    document.getElementById('saju-result').classList.remove('hidden');
    setStatus(status, '사주팔자를 계산했습니다.', 'ok');
  });
})();

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
// 드롭존 만들기. onFiles(File[]) 콜백. accept = 받을 MIME 접두사.
function makeDropzone(el, onFiles, accept = 'image/') {
  ['dragenter', 'dragover'].forEach((ev) =>
    el.addEventListener(ev, (e) => { e.preventDefault(); el.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach((ev) =>
    el.addEventListener(ev, (e) => { e.preventDefault(); el.classList.remove('dragover'); }));
  el.addEventListener('drop', (e) => {
    const files = [...(e.dataTransfer.files || [])].filter((f) => f.type.startsWith(accept));
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
   단어 빈도 분석 (간이 형태소)
========================================================= */
(function () {
  const input = document.getElementById('freq-input');
  const status = document.getElementById('freq-status');
  const table = document.getElementById('freq-table');
  const tbody = table.querySelector('tbody');
  let rows = [];

  // 긴 조사부터 잘라내야 하므로 길이순 정렬
  const JOSA = [
    '으로서', '으로써', '에서는', '에게서', '이라는', '이라고', '으로', '에서', '에게',
    '한테', '부터', '까지', '처럼', '보다', '마다', '조차', '마저', '밖에', '이나', '이란',
    '으론', '에는', '에도', '이는', '은', '는', '이', '가', '을', '를', '에', '의', '와',
    '과', '도', '로', '만', '나', '야', '여', '께', '랑',
  ].sort((a, b) => b.length - a.length);

  const STOP = new Set([
    '그리고', '그러나', '하지만', '그래서', '그런데', '또한', '또', '즉', '및', '등', '이런',
    '저런', '그런', '이것', '저것', '그것', '여기', '거기', '저기', '합니다', '입니다',
    '있습니다', '없습니다', '때문', '경우', '위해', '통해', '대한', '대해', '관련', '우리',
    '저희', '정말', '너무', '매우', '아주', '가장', '더욱', '바로', '다시', '다른', '같은',
    '많은', '모든', '어떤', '무엇', '누구', '언제', '어디', '그냥', '거의', '점점',
  ]);

  function stripJosa(w) {
    for (const j of JOSA) {
      if (w.length > j.length + 1 && w.endsWith(j)) return w.slice(0, -j.length);
    }
    return w;
  }

  document.getElementById('freq-run').addEventListener('click', run);

  function run() {
    const text = input.value;
    if (!text.trim()) return setStatus(status, '원고를 입력해주세요.', 'error');

    const unit = document.getElementById('freq-unit').value;
    const minLen = parseInt(document.getElementById('freq-minlen').value, 10) || 1;
    const useJosa = document.getElementById('freq-josa').checked;
    const useStop = document.getElementById('freq-stop').checked;

    // 한글/영문·숫자 덩어리만 토큰화
    let tokens = (text.toLowerCase().match(/[가-힣]+|[a-z0-9]+/g) || []);
    if (useJosa) tokens = tokens.map((t) => (/[가-힣]/.test(t) ? stripJosa(t) : t));
    tokens = tokens.filter((t) => [...t].length >= minLen);
    if (useStop) tokens = tokens.filter((t) => !STOP.has(t));

    let units = tokens;
    if (unit === 'bigram') {
      units = [];
      for (let i = 0; i < tokens.length - 1; i++) units.push(tokens[i] + ' ' + tokens[i + 1]);
    }

    const total = units.length;
    if (total === 0) return setStatus(status, '분석할 단어가 없습니다. 옵션을 조정해보세요.', 'error');

    const counts = new Map();
    for (const u of units) counts.set(u, (counts.get(u) || 0) + 1);

    rows = [...counts.entries()]
      .map(([word, count]) => ({ word, count, pct: (count / total) * 100 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 200);

    render();
    setStatus(status, `총 ${total.toLocaleString()}개 / 고유 ${counts.size.toLocaleString()}개 — 상위 ${rows.length}개 표시`, 'ok');
  }

  function render() {
    const max = rows[0] ? rows[0].count : 1;
    tbody.innerHTML = rows
      .map(
        (r, i) => `<tr>
          <td>${i + 1}</td>
          <td><b>${escapeHtml(r.word)}</b></td>
          <td class="num">${r.count.toLocaleString()}</td>
          <td class="num">${r.pct.toFixed(1)}%</td>
          <td><div class="freq-bar" style="width:${(r.count / max) * 100}%"></div></td>
        </tr>`
      )
      .join('');
    table.classList.remove('hidden');
  }

  document.getElementById('freq-copy').addEventListener('click', () => {
    if (!rows.length) return setStatus(status, '먼저 분석해주세요.', 'error');
    copyText(rows.map((r) => `${r.word}\t${r.count}\t${r.pct.toFixed(1)}%`).join('\n'), status);
  });
  document.getElementById('freq-csv').addEventListener('click', () => {
    if (!rows.length) return setStatus(status, '먼저 분석해주세요.', 'error');
    const csv = '순위,단어,횟수,비율\n' +
      rows.map((r, i) => `${i + 1},"${r.word}",${r.count},${r.pct.toFixed(1)}%`).join('\n');
    downloadBlob(new Blob(['﻿' + csv], { type: 'text/csv' }), '단어빈도.csv');
  });
})();

/* =========================================================
   이미지 형식 변환 (JPG ↔ PNG ↔ WEBP)
========================================================= */
(function () {
  const fileInput = document.getElementById('cv-file');
  const drop = document.getElementById('cv-drop');
  const hint = document.getElementById('cv-hint');
  const preview = document.getElementById('cv-preview');
  const status = document.getElementById('cv-status');
  const runBtn = document.getElementById('cv-run');
  const formatSel = document.getElementById('cv-format');
  const qWrap = document.getElementById('cv-quality-wrap');
  const qInput = document.getElementById('cv-quality');
  let curImg = null;
  let originalSize = 0;
  let originalName = 'image';

  drop.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => e.target.files[0] && load(e.target.files[0]));
  makeDropzone(drop, (files) => load(files[0]));

  function updateQ() {
    qWrap.style.display = formatSel.value === 'image/png' ? 'none' : 'flex';
  }
  formatSel.addEventListener('change', updateQ);
  qInput.addEventListener('input', () => (document.getElementById('cv-quality-val').textContent = qInput.value));
  updateQ();

  async function load(file) {
    originalSize = file.size;
    originalName = file.name.replace(/\.[^.]+$/, '') || 'image';
    curImg = await fileToImage(file);
    preview.src = curImg.src;
    preview.classList.remove('hidden');
    hint.classList.add('hidden');
    drop.classList.add('has-image');
    runBtn.disabled = false;
    setStatus(status, `원본: ${curImg.naturalWidth}×${curImg.naturalHeight}, ${fmtSize(originalSize)}`, 'ok');
  }

  runBtn.addEventListener('click', async () => {
    if (!curImg) return;
    const format = formatSel.value;
    const quality = format === 'image/png' ? undefined : Number(qInput.value) / 100;
    const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[format];

    const canvas = document.createElement('canvas');
    canvas.width = curImg.naturalWidth;
    canvas.height = curImg.naturalHeight;
    const c = canvas.getContext('2d');
    if (format === 'image/jpeg') { c.fillStyle = '#fff'; c.fillRect(0, 0, canvas.width, canvas.height); }
    c.drawImage(curImg, 0, 0);

    const blob = await toBlobAsync(canvas, format, quality);
    if (!blob) return setStatus(status, '변환에 실패했습니다.', 'error');
    downloadBlob(blob, `${originalName}.${ext}`);
    setStatus(status, `변환 완료: ${ext.toUpperCase()} · ${fmtSize(blob.size)} (원본 ${fmtSize(originalSize)})`, 'ok');
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

/* =========================================================
   만 나이 · 날짜 계산기
========================================================= */
(function () {
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const today = () => new Date(new Date().toDateString());
  const parse = (v) => (v ? new Date(v + 'T00:00:00') : null);
  const iso = (d) => d.toISOString().slice(0, 10);
  const fmt = (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WD[d.getDay()]})`;
  const DAY = 86400000;

  // 오늘 날짜 기본값
  document.getElementById('age-base').value = iso(today());
  document.getElementById('add-base').value = iso(today());

  document.getElementById('age-run').addEventListener('click', () => {
    const b = parse(document.getElementById('age-birth').value);
    const base = parse(document.getElementById('age-base').value) || today();
    const el = document.getElementById('age-result');
    if (!b) return setStatus(el, '생년월일을 입력해주세요.', 'error');
    if (b > base) return setStatus(el, '생년월일이 기준일보다 늦습니다.', 'error');
    let age = base.getFullYear() - b.getFullYear();
    if (base.getMonth() < b.getMonth() || (base.getMonth() === b.getMonth() && base.getDate() < b.getDate())) age--;
    const days = Math.floor((base - b) / DAY);
    // 다음 생일까지
    let next = new Date(base.getFullYear(), b.getMonth(), b.getDate());
    if (next < base) next = new Date(base.getFullYear() + 1, b.getMonth(), b.getDate());
    const dleft = Math.round((next - base) / DAY);
    setStatus(el, `만 ${age}세 · 태어난 지 ${days.toLocaleString()}일 · 다음 생일까지 ${dleft === 0 ? '오늘! 🎉' : 'D-' + dleft}`, 'ok');
  });

  document.getElementById('dday-run').addEventListener('click', () => {
    const t = parse(document.getElementById('dday-target').value);
    const el = document.getElementById('dday-result');
    if (!t) return setStatus(el, '목표일을 입력해주세요.', 'error');
    const diff = Math.round((t - today()) / DAY);
    const label = diff === 0 ? 'D-day 🎯' : diff > 0 ? `D-${diff}` : `D+${-diff}`;
    setStatus(el, `${fmt(t)} → ${label}${diff > 0 ? ` (${diff}일 남음)` : diff < 0 ? ` (${-diff}일 지남)` : ''}`, 'ok');
  });

  document.getElementById('add-run').addEventListener('click', () => {
    const base = parse(document.getElementById('add-base').value);
    const n = parseInt(document.getElementById('add-days').value, 10);
    const el = document.getElementById('add-result');
    if (!base || isNaN(n)) return setStatus(el, '기준일과 일수를 입력해주세요.', 'error');
    const r = new Date(base.getTime() + n * DAY);
    setStatus(el, `${fmt(base)} 에서 ${n >= 0 ? n + '일 후' : -n + '일 전'} → ${fmt(r)}`, 'ok');
  });

  document.getElementById('diff-run').addEventListener('click', () => {
    const a = parse(document.getElementById('diff-a').value);
    const b = parse(document.getElementById('diff-b').value);
    const el = document.getElementById('diff-result');
    if (!a || !b) return setStatus(el, '두 날짜를 모두 입력해주세요.', 'error');
    const d = Math.abs(Math.round((b - a) / DAY));
    setStatus(el, `두 날짜 사이는 ${d.toLocaleString()}일 (양 끝 포함 ${(d + 1).toLocaleString()}일)`, 'ok');
  });
})();

/* =========================================================
   추첨기 · 사다리
========================================================= */
(function () {
  const input = document.getElementById('rnd-input');
  const status = document.getElementById('rnd-status');
  const resultEl = document.getElementById('rnd-result');

  const names = () => input.value.split('\n').map((s) => s.trim()).filter(Boolean);
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const chips = (arr) => `<div class="chips">${arr.map((n) => `<span class="chip">${escapeHtml(n)}</span>`).join('')}</div>`;

  document.getElementById('rnd-pick').addEventListener('click', () => {
    const list = names();
    const k = parseInt(document.getElementById('rnd-count').value, 10) || 1;
    if (list.length < 1) return setStatus(status, '후보를 입력해주세요.', 'error');
    if (k > list.length) return setStatus(status, '뽑을 인원이 후보보다 많습니다.', 'error');
    const winners = shuffle(list).slice(0, k);
    resultEl.innerHTML = `<div class="ac-group"><div class="ac-seed">🎉 당첨자 ${k}명</div>${chips(winners)}</div>`;
    setStatus(status, '추첨 완료!', 'ok');
  });

  document.getElementById('rnd-shuffle').addEventListener('click', () => {
    const list = names();
    if (list.length < 2) return setStatus(status, '후보를 2명 이상 입력해주세요.', 'error');
    const order = shuffle(list);
    resultEl.innerHTML = `<div class="ac-group"><div class="ac-seed">🔀 섞은 순서</div><ol>${order.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ol></div>`;
    setStatus(status, '순서를 섞었습니다.', 'ok');
  });

  document.getElementById('rnd-team').addEventListener('click', () => {
    const list = names();
    const t = parseInt(document.getElementById('rnd-teams').value, 10) || 2;
    if (list.length < t) return setStatus(status, '후보가 팀 수보다 적습니다.', 'error');
    const sh = shuffle(list);
    const teams = Array.from({ length: t }, () => []);
    sh.forEach((n, i) => teams[i % t].push(n));
    resultEl.innerHTML = teams
      .map((team, i) => `<div class="ac-group"><div class="ac-seed">👥 ${i + 1}팀 (${team.length}명)</div>${chips(team)}</div>`)
      .join('');
    setStatus(status, `${t}개 팀으로 나눴습니다.`, 'ok');
  });

  // 사다리타기
  const ladderTable = document.getElementById('ladder-table');
  document.getElementById('ladder-run').addEventListener('click', () => {
    const list = names();
    const results = document.getElementById('ladder-results').value.split('\n').map((s) => s.trim()).filter(Boolean);
    const st = document.getElementById('ladder-status');
    if (list.length < 1) return setStatus(st, '위쪽에 참가자를 입력해주세요.', 'error');
    if (results.length !== list.length)
      return setStatus(st, `참가자(${list.length})와 결과(${results.length}) 개수가 같아야 합니다.`, 'error');
    const shuffled = shuffle(results);
    ladderTable.querySelector('tbody').innerHTML = list
      .map((p, i) => `<tr><td>${escapeHtml(p)}</td><td><b>${escapeHtml(shuffled[i])}</b></td></tr>`)
      .join('');
    ladderTable.classList.remove('hidden');
    setStatus(st, '사다리 결과가 나왔습니다!', 'ok');
  });
})();

/* =========================================================
   단위 · 평수 변환기
========================================================= */
(function () {
  // 비율 단위(기준값 대비 배수). 온도는 별도 처리.
  const CATS = {
    area: { base: '㎡', units: { '㎡': 1, '평': 3.3057851, '제곱피트(ft²)': 0.09290304, '에이커': 4046.8564, '헥타르': 10000 } },
    length: { base: 'm', units: { 'mm': 0.001, 'cm': 0.01, 'm': 1, 'km': 1000, '인치': 0.0254, '피트': 0.3048, '야드': 0.9144, '마일': 1609.344 } },
    weight: { base: 'g', units: { 'mg': 0.001, 'g': 1, 'kg': 1000, '톤': 1000000, '온스(oz)': 28.349523, '파운드(lb)': 453.59237, '근(600g)': 600 } },
    temp: { base: '℃', units: { '℃': 1, '℉': 1, 'K': 1 } },
  };
  const catSel = document.getElementById('unit-cat');
  const fromSel = document.getElementById('unit-from');
  const valInput = document.getElementById('unit-value');
  const tbody = document.querySelector('#unit-table tbody');

  function fillUnits() {
    const cat = CATS[catSel.value];
    fromSel.innerHTML = Object.keys(cat.units).map((u) => `<option>${u}</option>`).join('');
    compute();
  }
  function tempTo(value, from, to) {
    let c = from === '℃' ? value : from === '℉' ? ((value - 32) * 5) / 9 : value - 273.15;
    if (to === '℃') return c;
    if (to === '℉') return (c * 9) / 5 + 32;
    return c + 273.15;
  }
  function compute() {
    const cat = CATS[catSel.value];
    const from = fromSel.value;
    const v = parseFloat(valInput.value);
    if (isNaN(v) || !from) { tbody.innerHTML = ''; return; }
    const rows = Object.keys(cat.units).map((u) => {
      let out;
      if (catSel.value === 'temp') out = tempTo(v, from, u);
      else out = (v * cat.units[from]) / cat.units[u];
      const rounded = Math.abs(out) >= 1e6 || (Math.abs(out) < 1e-4 && out !== 0)
        ? out.toExponential(4)
        : parseFloat(out.toFixed(6)).toLocaleString('ko-KR', { maximumFractionDigits: 6 });
      const hi = u === from ? ' style="background:var(--brand-soft)"' : '';
      return `<tr${hi}><td>${u}</td><td class="num"><b>${rounded}</b></td></tr>`;
    });
    tbody.innerHTML = rows.join('');
  }
  catSel.addEventListener('change', fillUnits);
  fromSel.addEventListener('change', compute);
  valInput.addEventListener('input', compute);
  fillUnits();
})();

/* =========================================================
   이미지 → PDF / PDF 합치기
========================================================= */
(function () {
  // --- 이미지 → PDF ---
  const imgFileInput = document.getElementById('pdf-img-file');
  const imgDrop = document.getElementById('pdf-img-drop');
  const imgStatus = document.getElementById('pdf-img-status');
  const imgListEl = document.getElementById('pdf-img-list');
  const imgRun = document.getElementById('pdf-img-run');
  let imgFiles = [];

  imgDrop.addEventListener('click', () => imgFileInput.click());
  imgFileInput.addEventListener('change', (e) => addImgs([...e.target.files]));
  makeDropzone(imgDrop, (fs) => addImgs(fs), 'image/');

  function addImgs(fs) {
    imgFiles = fs.filter((f) => f.type.startsWith('image/'));
    imgListEl.innerHTML = imgFiles.map((f, i) => `<li><span>${i + 1}. ${escapeHtml(f.name)}</span><span class="st"></span></li>`).join('');
    imgRun.disabled = imgFiles.length === 0;
    setStatus(imgStatus, `${imgFiles.length}장 선택됨`, 'ok');
  }

  imgRun.addEventListener('click', async () => {
    if (typeof PDFLib === 'undefined') return setStatus(imgStatus, 'PDF 라이브러리를 불러오지 못했습니다(인터넷 확인).', 'error');
    setStatus(imgStatus, 'PDF 만드는 중...', 'loading');
    const { PDFDocument } = PDFLib;
    const pageMode = document.getElementById('pdf-page').value;
    const doc = await PDFDocument.create();
    const A4 = [595.28, 841.89];

    for (const file of imgFiles) {
      const im = await fileToImage(file);
      // 캔버스로 JPEG 변환(흰 배경) → 용량/호환성 안정
      const canvas = document.createElement('canvas');
      canvas.width = im.naturalWidth;
      canvas.height = im.naturalHeight;
      const c = canvas.getContext('2d');
      c.fillStyle = '#fff';
      c.fillRect(0, 0, canvas.width, canvas.height);
      c.drawImage(im, 0, 0);
      const blob = await toBlobAsync(canvas, 'image/jpeg', 0.92);
      const jpg = await doc.embedJpg(await blob.arrayBuffer());

      let pw, ph;
      if (pageMode === 'a4') [pw, ph] = A4;
      else if (pageMode === 'a4l') [pw, ph] = [A4[1], A4[0]];
      else { pw = jpg.width; ph = jpg.height; }
      const page = doc.addPage([pw, ph]);
      // 페이지에 맞춰 비율 유지하며 가운데
      const scale = Math.min(pw / jpg.width, ph / jpg.height);
      const w = jpg.width * scale, h = jpg.height * scale;
      page.drawImage(jpg, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    }
    const bytes = await doc.save();
    downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `이미지모음_${imgFiles.length}장.pdf`);
    setStatus(imgStatus, `완료 — ${imgFiles.length}페이지 PDF 저장`, 'ok');
  });

  // --- PDF 합치기 ---
  const mFileInput = document.getElementById('pdf-merge-file');
  const mDrop = document.getElementById('pdf-merge-drop');
  const mStatus = document.getElementById('pdf-merge-status');
  const mListEl = document.getElementById('pdf-merge-list');
  const mRun = document.getElementById('pdf-merge-run');
  let mFiles = [];

  mDrop.addEventListener('click', () => mFileInput.click());
  mFileInput.addEventListener('change', (e) => addPdfs([...e.target.files]));
  makeDropzone(mDrop, (fs) => addPdfs(fs), 'application/pdf');

  function addPdfs(fs) {
    mFiles = fs.filter((f) => f.type === 'application/pdf');
    mListEl.innerHTML = mFiles.map((f, i) => `<li><span>${i + 1}. ${escapeHtml(f.name)}</span><span class="st"></span></li>`).join('');
    mRun.disabled = mFiles.length < 2;
    setStatus(mStatus, mFiles.length < 2 ? 'PDF를 2개 이상 선택하세요.' : `${mFiles.length}개 선택됨`, mFiles.length < 2 ? '' : 'ok');
  }

  mRun.addEventListener('click', async () => {
    if (typeof PDFLib === 'undefined') return setStatus(mStatus, 'PDF 라이브러리를 불러오지 못했습니다(인터넷 확인).', 'error');
    if (mFiles.length < 2) return;
    setStatus(mStatus, '합치는 중...', 'loading');
    const { PDFDocument } = PDFLib;
    const out = await PDFDocument.create();
    let pages = 0;
    for (const file of mFiles) {
      try {
        const src = await PDFDocument.load(await file.arrayBuffer());
        const copied = await out.copyPages(src, src.getPageIndices());
        copied.forEach((p) => { out.addPage(p); pages++; });
      } catch (err) {
        setStatus(mStatus, `'${file.name}' 처리 실패(암호화 PDF 등). 건너뜀.`, 'warn');
      }
    }
    const bytes = await out.save();
    downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `합친PDF_${mFiles.length}개.pdf`);
    setStatus(mStatus, `완료 — ${mFiles.length}개 / 총 ${pages}페이지 합침`, 'ok');
  });
})();
