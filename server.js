// 마케팅 도구 모음 - 백엔드 서버
// - 정적 파일(public) 서빙
// - 네이버 검색광고 API 프록시 (API 키를 서버에 숨겨서 안전하게 호출)

const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 네이버 검색광고 API 인증정보
// 우선순위: 환경변수 → 로컬 secrets.json(깃 제외) → 빈 값
// ⚠️ 키를 코드에 직접 적지 말 것. 배포 시엔 호스팅의 환경변수에 넣는다.
let localSecrets = {};
try {
  localSecrets = require('./secrets.json'); // 로컬 개발용 (gitignore 처리됨)
} catch (_) {
  /* 파일 없으면 환경변수만 사용 */
}
const NAVER = {
  accessKey: process.env.NAVER_ACCESS_KEY || localSecrets.accessKey || '',
  secretKey: process.env.NAVER_SECRET_KEY || localSecrets.secretKey || '',
  customerId: process.env.NAVER_CUSTOMER_ID || localSecrets.customerId || '',
};
const NAVER_READY = Boolean(NAVER.accessKey && NAVER.secretKey && NAVER.customerId);
if (!NAVER_READY) {
  console.warn('⚠️  네이버 API 키가 설정되지 않았습니다. 검색량 조회 기능이 비활성화됩니다.');
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// HMAC-SHA256 서명 생성
function makeSignature(timestamp, method, apiPath, secretKey) {
  const message = `${timestamp}.${method}.${apiPath}`;
  return crypto.createHmac('sha256', secretKey).update(message).digest('base64');
}

// '< 10' 같은 문자열을 숫자로 변환
function toCount(value) {
  if (typeof value === 'number') return value;
  if (String(value).includes('<')) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// 키워드 검색량 조회 API
// body: { keywords: ["키워드1", "키워드2", ...], minVolume: 0 }
app.post('/api/keyword-volume', async (req, res) => {
  try {
    if (!NAVER_READY) {
      return res.status(503).json({ error: '서버에 네이버 API 키가 설정되지 않았습니다. 관리자에게 문의하세요.' });
    }
    const { keywords, minVolume = 0 } = req.body || {};
    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ error: '키워드를 입력해주세요.' });
    }

    const cleaned = keywords
      .map((k) => String(k).trim())
      .filter(Boolean)
      .slice(0, 100); // 한 번에 최대 100개

    const method = 'GET';
    const apiPath = '/keywordstool';
    const results = [];

    // 네이버 API는 한 번에 최대 5개 힌트키워드
    for (let i = 0; i < cleaned.length; i += 5) {
      const batch = cleaned.slice(i, i + 5);
      // 네이버 API는 공백 없는 키워드를 쉼표로 구분해 받는다.
      // 키워드별로 인코딩하고 쉼표(,)는 구분자로 그대로 둔다.
      const keywordString = batch.map((k) => k.replace(/\s+/g, '')).join(',');
      const encodedKeywords = batch
        .map((k) => encodeURIComponent(k.replace(/\s+/g, '')))
        .join(',');

      let retry = 0;
      const maxRetry = 5;
      while (retry < maxRetry) {
        try {
          const timestamp = Date.now().toString();
          const signature = makeSignature(timestamp, method, apiPath, NAVER.secretKey);
          const url = `https://api.naver.com${apiPath}?hintKeywords=${encodedKeywords}&showDetail=1`;

          const apiRes = await fetch(url, {
            method,
            headers: {
              'X-Timestamp': timestamp,
              'X-API-KEY': NAVER.accessKey,
              'X-Customer': NAVER.customerId,
              'X-Signature': signature,
            },
          });

          if (apiRes.status === 429) {
            retry++;
            await new Promise((r) => setTimeout(r, 300));
            continue;
          }
          if (!apiRes.ok) {
            const text = await apiRes.text();
            throw new Error(`네이버 API 오류 ${apiRes.status}: ${text}`);
          }

          const data = await apiRes.json();
          const list = data.keywordList || [];
          // 입력한 키워드와 정확히 일치하는 것만 우선 표시 (연관키워드 제외)
          const inputSet = new Set(batch.map((k) => k.replace(/\s/g, '').toLowerCase()));

          for (const item of list) {
            const pc = toCount(item.monthlyPcQcCnt);
            const mobile = toCount(item.monthlyMobileQcCnt);
            const total = pc + mobile;
            if (total < minVolume) continue;

            const isExact = inputSet.has(
              String(item.relKeyword).replace(/\s/g, '').toLowerCase()
            );
            results.push({
              keyword: item.relKeyword,
              pc,
              mobile,
              total,
              competition: item.compIdx || '',
              isExact,
            });
          }
          break;
        } catch (err) {
          retry++;
          if (retry >= maxRetry) {
            console.error('배치 실패:', keywordString, err.message);
          }
          await new Promise((r) => setTimeout(r, 300));
        }
      }
      // 호출 간 약간의 지연 (rate limit 방지)
      await new Promise((r) => setTimeout(r, 150));
    }

    // 정확히 일치하는 키워드 먼저, 그 다음 검색량 순
    results.sort((a, b) => {
      if (a.isExact !== b.isExact) return a.isExact ? -1 : 1;
      return b.total - a.total;
    });

    res.json({ count: results.length, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || '서버 오류' });
  }
});

// 네이버 자동완성 / 연관검색어 수집
// body: { keywords: ["키워드1", ...] }  또는  query ?q=키워드
async function fetchAutocomplete(keyword) {
  const url =
    `https://ac.search.naver.com/nx/ac?q=${encodeURIComponent(keyword)}` +
    `&con=0&frm=nv&ans=2&r_format=json&r_enc=UTF-8&r_unicode=0&t_koreng=1&run=2&rev=4&q_enc=UTF-8&st=100`;
  const res = await fetch(url, {
    headers: { Referer: 'https://search.naver.com/', 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) throw new Error(`자동완성 오류 ${res.status}`);
  const data = await res.json();
  const items = (data.items && data.items[0]) || [];
  return items.map((it) => it[0]).filter(Boolean);
}

app.post('/api/autocomplete', async (req, res) => {
  try {
    const { keywords } = req.body || {};
    if (!Array.isArray(keywords) || keywords.length === 0) {
      return res.status(400).json({ error: '키워드를 입력해주세요.' });
    }
    const seeds = keywords.map((k) => String(k).trim()).filter(Boolean).slice(0, 20);

    const groups = [];
    for (const seed of seeds) {
      try {
        const suggestions = await fetchAutocomplete(seed);
        groups.push({ seed, suggestions });
      } catch (err) {
        groups.push({ seed, suggestions: [], error: err.message });
      }
      await new Promise((r) => setTimeout(r, 120));
    }

    // 전체 중복 제거 목록도 함께 제공
    const all = [...new Set(groups.flatMap((g) => g.suggestions))];
    res.json({ groups, all, count: all.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || '서버 오류' });
  }
});

app.listen(PORT, () => {
  console.log(`\n  ✅ 도구 모음 서버 실행 중`);
  console.log(`  👉 브라우저에서 http://localhost:${PORT} 열기\n`);
});
