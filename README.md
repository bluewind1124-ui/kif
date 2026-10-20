# 한국보험금융 교육지원 포털 (mirae-bohum)

FC 영업지원·교육지원 포털. GitHub Pages로 배포됩니다: https://bluewind1124-ui.github.io/mirae-bohum/

이 폴더가 **포털과 하위 프로그램 전체의 기준(원본)** 입니다. 개발·수정은 모두 여기서 하고, 같은 내용을 GitHub 저장소에 올려 배포합니다.

## 폴더 구조

| 경로 | 내용 |
|---|---|
| `index.html` | 포털 본체 (로그인, 메뉴, 홈, 상품 비교 연결, AI보장분석 기본형, 교육센터, 소식지·시상, 관리자) |
| `advanced/index.html` | **AI보장분석 고급형** — 보장·연금·자산 상담 설계, 제안서(시뮬레이션·발표 노트), 고객 리포트, 세법 기준표, 법령·세법 점검. 포털 메뉴에서 iframe으로 열림 |
| `classic/` | 신채널 교육지원시스템 v1.0 (상품 비교 도구 6종) |
| `ai-relay/` | AI보장분석 기본형이 쓰는 AI 중계 서버(Cloudflare Worker) 코드 |
| `content.json` | 관리자가 바꾸는 공지·소식지·시상·컨셉 |
| `version.json` | 버전과 업데이트 내역 (화면 상단·홈에 표시) |
| `app.html`, `manifest.webmanifest`, `icon-*`, `desktop-icon.zip` | 홈 화면 아이콘 설치 |
| `docs/` | 개발 문서 — 고급형 생성 기록, 법령·세법 업데이트 설명서 |

## 메뉴 연결 (index.html)

- 영업 도구: 상품 비교 · **AI보장분석 기본형**(`ai`) · **AI보장분석 고급형**(`ai2`) · 대표 상품 가설 · 이달의 컨셉
- 교육: 온라인 교육센터 · **AI보장분석 고급형**(`ai2`)
- 고급형 페이지(`PAGES.ai2`)는 `advanced/index.html`을 iframe으로 띄우고 「새 창으로 크게 열기」를 제공합니다.
- 포털 로그인 시 `sessionStorage.fc_portal_ok=1`을 남기고, 고급형은 포털 안이거나 이 값이 있을 때만 열립니다. 직접 주소로 열면 포털 로그인으로 안내합니다. (점검용: `advanced/index.html?standalone=1`)

## 관리 규칙

1. 원본은 이 폴더 하나. 다른 위치에 복사본을 두고 고치지 않습니다.
2. 고급형을 고치면 `docs/AI보장분석_고급형_생성기록.md`에 버전과 내용을, 포털 변경은 `version.json`의 `history`에 한 줄을 추가합니다.
3. 세법·법령 수치는 고급형 「기준 설정 → 세법 기준표」와 「법령·세법 점검」으로 관리합니다 (`docs/법령·세법 업데이트 설명서.md`).
4. 배포: GitHub 저장소 `bluewind1124-ui/mirae-bohum`의 `main` 브랜치에 올리면 GitHub Pages에 반영됩니다. 배포 전 작업은 별도 브랜치에 올려 둡니다.
5. 고객 자료는 각 FC 브라우저(localStorage)에만 저장됩니다. 저장소에 고객 정보나 대화 기록을 올리지 않습니다.
