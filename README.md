# I Hate To Walk (IHTW) — 마케팅 도구함

키워드 검색량 · 키워드 조합기 · 글자수 세기 · 연관검색어 수집 · 해시태그 · 이미지 편집/압축/QR/워터마크/일괄변환을 모은 웹 도구 모음.

## 로컬 실행
```bash
npm install
node server.js
# http://localhost:3000
```
- 네이버 키는 `secrets.json`(git 제외) 또는 환경변수로 읽습니다.

## 배포 (Render.com 기준, 무료)
1. 이 폴더를 GitHub 저장소로 push (키 파일 `secrets.json`은 자동 제외됨).
2. https://render.com → **New +** → **Web Service** → GitHub 저장소 연결.
3. 설정: Runtime `Node`, Build `npm install`, Start `npm start` (render.yaml이 자동 인식).
4. **Environment**에 키 3개 등록:
   - `NAVER_ACCESS_KEY`
   - `NAVER_SECRET_KEY`
   - `NAVER_CUSTOMER_ID`
5. Deploy → `https://ihtw-tools.onrender.com` 같은 주소 발급.

## 커스텀 도메인 연결
Render 서비스 → **Settings → Custom Domains** 에 도메인 입력 → 안내된 CNAME/A 레코드를
도메인 등록업체(가비아 등) DNS에 추가하면 연결됩니다. SSL은 자동.

## 주의
- 무료 플랜은 15분 미사용 시 절전 → 첫 접속이 느릴 수 있음(수십 초).
- 네이버 검색광고 API는 사용량/요금이 발생할 수 있으니, 공개 시 남용에 유의.
