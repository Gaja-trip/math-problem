# 생각수학 · 수학경시대회 학습 앱

개념 이해, 문제 풀이, 오답 복습, HME 기출 PDF 등록, 맞춤 학습지 PDF 다운로드와 인쇄를 지원합니다.

HME 공식 문제지·풀이지 407쌍과 정답표 대조가 완료된 온라인 문항 4,748개를 연결했습니다. 확인되지 않은 답은 자동 채점하지 않으며 원문 학습으로 제공합니다.

앱은 `sites/think-math/`에 있습니다. 먼저 `server-runtime/` 폴더에서 `npm ci`로 의존성을 설치한 뒤, 앱 폴더에서 `npm run dev`를 실행하고 `http://127.0.0.1:4173/learning/index.html`을 여세요.

자세한 기능과 원본 자료의 수록 범위는 [앱 안내](sites/think-math/README.md)를 확인하세요.

## GitHub Desktop에서 올리기

GitHub Desktop에는 이 저장소의 루트인 `math-problem` 폴더를 등록합니다. 앱 소스와 공식 자료는 `sites/think-math/` 아래의 일반 파일로 함께 커밋됩니다. 앱 폴더만 가리키는 서브모듈은 사용하지 않습니다.

`sites/think-math/.git/`은 기존 Sites 작업 기록을 보존하기 위한 로컬 저장소입니다. GitHub에는 이 내부 Git 정보 대신 실제 앱 파일이 올라가며, 내부 `.git` 폴더를 삭제할 필요는 없습니다. 설치된 패키지, 임시 파일, 배포용 압축 파일은 커밋에서 제외됩니다.

커밋 후 GitHub Desktop에서 **Push origin**을 눌러 GitHub에 업로드합니다. 소스 업로드와 웹사이트 배포는 별도 단계입니다. 외부 배포 서비스를 연결할 때 앱의 작업 폴더는 `sites/think-math`입니다.

## Vercel 배포

저장소 루트와 `sites/think-math` 양쪽에 `vercel.json`을 제공합니다. Vercel의 Root Directory는 저장소 루트(빈 값)를 권장합니다. Framework는 **Other**이며, 빌드 명령과 출력 폴더는 설정 파일에서 자동으로 지정합니다. 별도의 환경 변수나 Sites 플러그인 설치가 필요 없습니다. GitHub의 `main`에 푸시하면 연결된 Vercel 프로젝트가 빌드합니다.

저장소 루트에서 `npm run build`를 실행하면 `sites/think-math/web-dist`가 생성됩니다. `npm test`는 빌드 후 실행합니다. 이 결과에는 문제지·해설 원본 PDF 814개와 미리 변환한 페이지·문항 이미지가 포함되며, HME에 접속하지 않고 제공합니다. `/`에서 `/learning/`으로 연결됩니다.

문제 화면은 작은 문항 이미지를 먼저 표시하고, 해설 페이지는 화면 근처로 스크롤할 때 불러옵니다. 전체 PDF는 다운로드 버튼을 누를 때만 내려받습니다. 내용 해시가 들어간 이미지·PDF 경로는 브라우저와 CDN에서 재사용됩니다.
