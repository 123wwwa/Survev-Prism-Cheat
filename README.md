# survev-injector

`survev/survev`의 변경을 감지해 게임 클라이언트를 빌드하고, 이 저장소의 `cdn` 브랜치에 결과를 게시합니다. jsDelivr는 그 공개 파일을 CDN으로 제공합니다.

## 실행

프로젝트 폴더에서 PowerShell로 실행합니다.

```powershell
.\run.ps1 build    # 원본 업데이트 + 클라이언트 빌드, 게시하지 않음
.\run.ps1 deploy   # 업데이트 + 빌드 + GitHub 게시 + CDN 검증
.\run.ps1 watch    # 위 과정을 60초 간격으로 반복, Ctrl+C로 종료
.\run.ps1 test
```

실행 정책으로 ps1 실행이 막힌 경우 `powershell -NoProfile -ExecutionPolicy Bypass -File .\run.ps1 deploy`처럼 해당 프로세스에만 실행 정책을 지정할 수 있습니다.

Node.js 22.18+ (24 권장), pnpm, Git이 필요합니다. `run.ps1`은 PATH에 Node/pnpm이 없으면 현재 사용자에게 설치된 Codex 번들 런타임을 찾아 사용합니다. Codex 번들이 없는 PC에는 별도 설치가 필요합니다. GitHub push는 Git Credential Manager 등 기존 Git 로그인을 사용합니다. 비밀 토큰을 설정 파일에 적지 않습니다.

## 자동 실행

`watch`는 PC와 프로세스가 켜져 있는 동안 각 실행 완료 후 60초마다 원본을 확인합니다. 소스가 같아도 빌드 설정이 달라지면 재빌드합니다. 빌드나 게시 실패 시 마지막 정상 게시물을 유지하고 다음 주기에 재시도합니다.

GitHub Actions의 `Update client CDN`은 PC가 꺼져 있어도 약 5분 간격으로 확인합니다. GitHub의 스케줄 실행은 지연될 수 있고 장기 비활성 공개 저장소에서는 비활성화될 수 있습니다. 수동 실행은 Actions → Update client CDN → Run workflow를 사용합니다. 기본 브랜치는 `main`이며 `GITHUB_TOKEN`의 contents:write 권한으로 `cdn`에 push합니다.

두 방식 모두 폴링입니다. 엄밀한 즉시 반영은 원본 저장소의 webhook/dispatch 협조가 필요합니다. jsDelivr 캐시나 브라우저 캐시까지 즉시 갱신됨을 보장하지 않습니다.

## 파일과 URL

- `vendor/survev/`: 자동 업데이트되는 원본 checkout. 개인 프로젝트 Git에는 포함하지 않습니다. 직접 수정하면 자동 업데이트를 중단하여 수정 내용을 보호합니다.
- `scripts/build-client.mjs`: 원본 Vite 설정의 production 진입점, 청크 분할, 해시 파일명, 출력 경로를 유지하고 압축/난독화를 끕니다. 게임 HTML에 대응하는 JS 진입 파일만 선택하여 별도 게시용 이름으로 복사합니다. 원본 소스나 Vite 설정 파일을 수정하지 않습니다.
- `dist/survev-readable.js`: 최종 게임 클라이언트 JS.
- `dist/manifest.json`: 원본 커밋, 빌드 시각, JS SHA-256, 바이트 수, 남아 있는 JS 의존 경로.
- `client-config.hjson`: 공개 클라이언트 설정. 서버 주소/regions 등을 여기에 설정합니다. 매 주기 원본의 로컬 설정 파일에 복사하므로 원본 쪽 설정을 직접 편집하지 않습니다.
- `.pipeline/published.json`: 검증 완료한 CDN 커밋 URL과 캐시 갱신 결과.

최신 브랜치 URL:

```text
https://cdn.jsdelivr.net/gh/123wwwa/survev-injector@cdn/survev-readable.js
```

확실한 버전 고정 URL은 `@cdn` 대신 **게시 저장소의 커밋 SHA**를 사용합니다. 원본 survev 커밋과는 다릅니다. 배포 스크립트가 실제 CDN 파일의 SHA-256을 비교한 뒤 그 주소를 출력합니다. `.min.js` URL을 사용하면 jsDelivr가 자동으로 축약본을 생성할 수 있으므로 위 파일명을 그대로 사용합니다.

게시 대상은 **import가 남아 있는 게임 JS 한 개**와 출처/검증용 `manifest.json`, `LICENSE`, `THIRD_PARTY_LICENSES.md`, `README.md`뿐입니다. 사용자 선택에 따라 공통 JS, 통계 JS, 이미지, CSS, HTML은 게시하지 않습니다. 전체 빌드 결과는 `.pipeline/build/`에 남습니다.

예: `import { ... } from "./공통청크해시.js";`가 남습니다. 복사 과정에서는 JS 내용을 수정하지 않습니다. 이 상대경로를 그대로 CDN에서 로드하면 게시하지 않은 의존 파일은 없으므로 이 JS URL 하나로 실행되지 않습니다. 원본 사이트의 해시 파일명과도 일치한다는 보장이 없습니다. 사용하는 쪽에서 이번 빌드의 의존 파일을 별도로 제공하거나 경로를 처리해야 합니다. 이 프로젝트는 원본 예시 형태의 게임 진입 파일을 생성·게시하는 데까지 담당합니다. 실행에는 해당 게임 페이지의 DOM, CSS, 이미지와 서버도 필요합니다. 변수명 축약을 끄지만 번들 내 이름 충돌에 따른 변경은 가능합니다.

## 실패와 복구

- 빌드 완료 후 선택한 파일이 게임 HTML의 JS 진입점인지 확인하고, import 목록을 기록하며, 문법 및 20 MB 제한을 검사합니다.
- 게시 브랜치에 force push하지 않습니다. 다른 게시자와 충돌하면 중단하므로 로컬 watch와 Actions를 동시에 돌리는 것은 피하세요.
- CDN 검증 실패 시 재실행하면 이미 올라간 동일 버전을 다시 확인합니다. 캐시 purge 실패도 다음 실행에서 재시도합니다. 불변 커밋 URL은 별도로 검증됩니다.
- 강제 종료 후 `.pipeline/pipeline.lock`이 남으면 그 안의 PID가 실행 중인지 확인한 뒤 해당 잠금 파일만 제거합니다.
- `.pipeline/publish`에 미완료 변경이 있으면 먼저 내용을 확인해야 합니다. 정상 게시물은 `cdn` 브랜치에 남아 있습니다.
- Windows 한글 경로에서 node-canvas가 파일을 열지 못하는 문제는 `scripts/canvas-paths.cjs`가 동일 파일의 바이트를 넘겨 해결합니다. 원본 코드/설치된 의존성은 수정하지 않습니다.

참고: [jsDelivr 사용법 및 캐시 정책](https://github.com/jsdelivr/jsdelivr), [원본 프로젝트](https://github.com/survev/survev).
