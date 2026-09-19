# survev-injector

`survev/survev` 원본의 production 빌드를 수행하고, **변수명 축약 직전의 게임 JS 진입 파일 하나**를 추출해 이 저장소의 `cdn` 브랜치에 게시합니다. jsDelivr는 공개 GitHub 파일을 제공하므로 별도 업로드/API 키는 필요하지 않습니다.

## 수동 명령

프로젝트 폴더의 PowerShell에서 실행합니다.

```powershell
.\run.ps1 check    # 원본 최신 커밋과 로컬 빌드/공개 게시 상태만 확인
.\run.ps1 build    # 원본 업데이트 + 게임 JS 추출, 게시하지 않음
.\run.ps1 update   # 변경 확인 → 필요할 때 빌드 → GitHub cdn 브랜치에 push
.\run.ps1 test
```

`deploy`는 `update`와 같은 명령입니다. Node가 PATH에 있으면 `node scripts/pipeline.mjs check` 또는 `node scripts/pipeline.mjs update`도 가능합니다. 필요할 경우 `watch`로 PC가 켜져 있는 동안 하루 간격으로 반복할 수 있지만, GitHub Actions의 일일 실행만으로도 충분합니다. 이 프로젝트는 백그라운드 감시 프로세스를 자동 시작하지 않습니다.

실행 정책이 막으면 `powershell -NoProfile -ExecutionPolicy Bypass -File .\run.ps1 update`처럼 해당 프로세스에만 실행 정책을 지정할 수 있습니다.

Node.js 22.18+ (24 권장), pnpm, Git이 필요합니다. `run.ps1`은 PATH에 Node/pnpm이 없으면 현재 사용자의 Codex 번들 런타임을 찾아 사용합니다. Codex가 없는 PC에는 별도 설치가 필요합니다. 로컬 push는 Git Credential Manager 등 기존 Git 로그인을 사용합니다. 인증 실패 시 대화창을 무한히 기다리지 않고 오류를 반환합니다.

## 자동 실행

GitHub Actions의 `Update client CDN`이 **매일 한국 시간 09:17**에 원본 변경을 확인합니다. GitHub 사정에 따라 실제 실행은 지연될 수 있습니다. 수동 실행은 Actions → Update client CDN → Run workflow를 사용합니다. 기본 브랜치는 `main`입니다.

실행 환경은 `ubuntu-24.04`, Node.js 24입니다. Actions도 Node.js 24를 사용하는 버전을 지정했습니다. 워크플로의 일회용 GitHub 토큰은 Git 게시에 사용하며, 원본의 빌드 프로세스/패키지 설치 스크립트에는 넘기지 않습니다. 코드 push만으로 자동 배포하지 않고 일일 스케줄 또는 수동 실행으로 갱신합니다.

## 원본 구조 및 import 보존

원본 소스와 Vite 설정 파일은 수정하지 않습니다. 원본의 production 진입점, 공통 청크 분할, CSS/이미지 처리, 난독화 플러그인 및 해시 파일명 생성은 그대로 둡니다. 전체 빌드에 `minify: false`를 적용하지 않습니다.

Rolldown의 `renderChunk` 단계에서 게임 진입 파일을 관찰하고 코드를 따로 보관합니다. 원래 빌드는 이후 Oxc 축약과 해시 확정을 정상 수행합니다. 보관한 게임 코드의 내부 해시 자리표시자만 **그 production 빌드에서 확정된 파일명**으로 치환해 읽을 수 있는 JS를 만듭니다. import의 export 별칭도 바꾸지 않습니다.

```js
import { a as __toESM } from "./B0Z9INg1.js";
import { U as GameConfig /* ... */ } from "./공통청크해시.js";
var AliveCountsMsg = class { /* ... */ };
```

기존 웹사이트의 `Cbg9k6wS.js` 같은 문자열을 하드코딩하는 것은 아닙니다. 이미 서비스 중인 사이트와 동일한 해시를 얻으려면 해당 배포의 소스 커밋, 설정, 의존성, 난독화 결과 등이 일치해야 합니다. 원본 난독화 플러그인에는 난수 사용도 있으므로 서로 다른 빌드의 해시가 같다고 보장할 수 없습니다. 이 도구는 **이번 production 빌드와 추출 JS의 의존 파일명이 정확히 같음**을 보장합니다. 원본 난독화 플러그인이 이미 바꾼 속성 이름을 복원하지는 않습니다.

## 파일과 CDN

- `vendor/survev/`: 자동 관리하는 원본 checkout. 개인 프로젝트 Git에는 포함하지 않습니다. 직접 수정하면 자동 업데이트를 멈추어 내용을 보호합니다.
- `.pipeline/build/`: 원본 production 결과물 전체와 별도로 추출한 `readable-game.js`.
- `dist/survev-readable.js`: 최종 게시할 게임 JS 하나.
- `dist/manifest.json`: 원본 커밋, 빌드 시각, SHA-256, 바이트 수, 원래 게임 파일명 및 공통 JS 의존 경로.
- `client-config.hjson`: 공개 클라이언트 설정. 서버 regions 등을 여기에 설정합니다. 매 주기 원본의 로컬 설정 파일에 복사합니다.
- `.pipeline/published.json`: GitHub 게시 커밋과 jsDelivr 주소. CDN 반영 검증 완료를 의미하지는 않습니다.

게시 대상은 게임 JS 하나와 출처/검증용 `manifest.json`, `LICENSE`, `THIRD_PARTY_LICENSES.md`, `README.md`입니다. 사용자 선택에 따라 공통 JS·통계 JS·이미지·CSS·HTML은 게시하지 않습니다. 따라서 CDN의 이 파일 하나로 게임이 독립 실행되지는 않습니다. 사용 환경에서 같은 빌드의 공통 JS와 나머지 자원을 제공해야 합니다.

고정 주소:

```text
https://cdn.jsdelivr.net/gh/123wwwa/survev-injector@cdn/survev-readable.js
```

GitHub push만 하면 jsDelivr에서 제공할 수 있습니다. **브랜치 URL의 기본 CDN 캐시는 12시간**이며 GitHub의 하루 1회 업데이트 주기와는 별개입니다. 브라우저 캐시도 별도로 적용됩니다. 자동 purge나 CDN 응답을 기다리는 단계를 넣지 않아 CDN 지연 때문에 Git 게시 성공이 실패로 처리되지 않습니다. 즉시 특정 버전을 지정하려면 `@cdn`을 **게시 저장소 커밋 SHA**로 바꿉니다. 원본 survev 커밋과는 다릅니다. `.min.js`를 요청하면 jsDelivr가 축약본을 만들 수 있으므로 위 이름을 그대로 사용합니다.

## 실패 원인과 복구

- `Public GitHub repository lookup returned HTTP 404`는 저장소 주소가 틀렸거나 공개 접근이 되지 않는다는 뜻입니다. 이 프로젝트의 확인된 배포 차단 원인입니다. Node/Ubuntu 사용 중단 경고와는 별개입니다. jsDelivr는 Private 저장소를 읽을 수 없습니다. GitHub Settings → General → Change visibility에서 Public으로 전환하거나 `pipeline.config.json`에 다른 공개 저장소를 지정한 뒤 `update`를 다시 실행합니다.
- 빌드 실패/게임 진입점 식별 실패/미해결 해시/문법 오류/20 MB 초과 시 게시하지 않습니다. 마지막 정상 게시물은 그대로 남습니다.
- `cdn`에 force push하지 않습니다. 동시 게시 충돌은 다음 실행에서 원격 상태를 다시 확인합니다. 개인 프로젝트 main에는 배포 스크립트가 push하지 않습니다.
- 강제 종료 후 `.pipeline/pipeline.lock`이 남으면 그 PID가 종료된 것을 확인한 뒤 해당 잠금 파일만 제거합니다.
- `.pipeline/publish`에 미완료 변경이 있으면 내용을 확인해야 합니다. 성공적으로 게시된 파일은 원격 `cdn`에 남아 있습니다.
- Windows 한글 경로의 node-canvas 파일 열기 문제는 보조 코드가 동일 파일의 바이트를 넘겨 처리합니다. 원본/의존성 파일은 수정하지 않습니다.

참고: [jsDelivr 캐시 정책](https://github.com/jsdelivr/jsdelivr#caching), [원본 프로젝트](https://github.com/survev/survev).
