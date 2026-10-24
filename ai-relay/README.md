# 회사 AI 켜기 안내서 (관리자용)

이 안내대로 한 번만 설정하면 모든 FC가 **API 키 없이** 포털에서 바로 AI로 가입설계서를 읽을 수 있습니다.
요금은 회사 AI 계정 하나로 모아서 나옵니다.

## 어떻게 동작하나요?

```
FC 포털 ──(가입설계서 내용)──▶ 회사 AI 중계 서버 ──(회사 키)──▶ Claude / ChatGPT / Gemini
        ◀───────(분석 결과)────                     ◀──────────
```

- 회사 API 키는 **중계 서버(Cloudflare) 안에만** 저장됩니다. 포털 화면이나 GitHub에는 키가 없습니다.
- FC 기기에는 아무 키도 저장되지 않습니다.

## 준비물

1. AI 회사 API 키 1개 (아래 중 하나)
   - Claude: https://console.anthropic.com/settings/keys
   - ChatGPT: https://platform.openai.com/api-keys
   - Gemini: https://aistudio.google.com/apikey (고객 정보가 들어가므로 **유료 결제가 연결된 키**를 쓰세요. 무료 키는 입력 내용이 Google 서비스 개선에 쓰일 수 있습니다.)
2. Cloudflare 무료 계정: https://dash.cloudflare.com/sign-up

## 설치 순서 (약 10분)

> Cloudflare 화면의 메뉴 이름은 조금씩 바뀔 수 있습니다. 비슷한 이름을 찾으면 됩니다.

1. **Cloudflare 로그인** → 왼쪽 메뉴 **Workers & Pages** (또는 Compute → Workers)
2. **Create** → **Create Worker** (Hello World 시작) → 이름을 `fc-ai` 로 바꾸고 **Deploy**
3. **Edit code** 를 누르고, 왼쪽 코드 전체를 지운 뒤 이 폴더의 [`worker.js`](worker.js) 내용을 통째로 붙여넣고 **Deploy**
4. Worker 화면 → **Settings** → **Variables and Secrets** → **Add** 로 아래를 넣고 **Deploy**

   | 이름 | 형식 | 값 |
   |---|---|---|
   | `API_KEY` | **Secret** | 준비한 회사 API 키 |
   | `PROVIDER` | Text | `claude` 또는 `openai` 또는 `gemini` |
   | `MODEL` | Text (선택) | 비우면 기본 모델 (claude-opus-5-5 / gpt-4.1 / gemini-2.5-flash) |
   | `ACCESS_CODE` | Secret (선택) | FC에게만 알려줄 접속코드. 넣으면 코드를 아는 FC만 씁니다 |
   | `AUTH_SECRET` | Secret (선택) | 계정 서버(kif-auth)의 `SECRET`과 **똑같은 값**. 넣으면 포털에 로그인한 사람만 씁니다 |
   | `ALLOW` | Text (선택) | `admin` = 관리자만, `all` = 로그인한 모든 사람 (기본 `all`) |

5. Worker 주소를 복사합니다. 예: `https://fc-ai.내계정.workers.dev`
   - 브라우저로 이 주소를 열어 `"ready":true` 가 보이면 정상입니다.
6. **포털 관리자** 로 로그인 → **콘텐츠 관리** → **회사 AI 서버 주소** 칸에 붙여넣기
7. **① 반영할 내용 복사** → **② GitHub 편집 화면 열기** → 붙여넣고 **Commit changes**
   - 1~2분 뒤 모든 FC 포털에 **회사 AI** 가 기본으로 켜집니다.

## 꼭 해 두세요: 요금 한도

AI 회사 콘솔에서 **월 사용 한도(Spending limit / Budget)** 를 정해 두면 예상 밖 요금을 막을 수 있습니다.

- Claude: console.anthropic.com → Settings → Limits
- ChatGPT: platform.openai.com → Settings → Limits
- Gemini: Google Cloud 콘솔 → 결제 → 예산 및 알림

## 문제가 생기면

| 포털에 보이는 말 | 확인할 것 |
|---|---|
| 회사 AI 서버에 연결하지 못했습니다 | 관리자 화면의 주소가 정확한지, Worker가 Deploy 되었는지 |
| 회사 접속코드가 맞지 않습니다 | FC가 넣은 코드와 `ACCESS_CODE` 가 같은지 |
| 서버의 API 키가 맞지 않거나 권한이 없습니다 | `API_KEY` 값과 AI 회사 결제 상태 |
| 허용되지 않은 사이트에서 온 요청 | 포털 주소가 바뀌었다면 `ALLOWED_ORIGINS` 에 새 주소를 넣기 (쉼표로 여러 개) |

회사 AI를 끄려면 관리자 화면에서 주소를 지우고 반영하면 됩니다. FC는 자동으로 **복사·붙여넣기** 방식으로 바뀝니다.


## 관리자만 쓰게 하기 (관리자 기본 연결)

관리자는 따로 등록하지 않아도 바로 회사 AI로 읽고, FC는 각자 「내 AI 등록」을 하게 하려면 다음처럼 설정합니다.

1. 위 4번 설정에 `AUTH_SECRET`(kif-auth의 SECRET과 같은 값)과 `ALLOW` = `admin`을 넣고 **Deploy**합니다.
2. 포털 **관리자 페이지 › 콘텐츠 관리 › 회사 AI**에 Worker 주소를 넣고, 「쓸 수 있는 사람」을 **관리자만**으로 고른 뒤 저장합니다.
3. 나중에 FC 모두 쓰게 하려면 `ALLOW`를 `all`로 바꾸고, 포털에서도 「모든 FC」로 바꿉니다.
