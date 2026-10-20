# 생각수학 · 수학경시대회 학습 앱

개념 이해, 문제 풀이, 오답 복습, HME 기출 PDF 등록, 맞춤 학습지 PDF 다운로드와 인쇄를 지원합니다.

HME 공식 문제지·풀이지 407쌍과 정답표 대조가 완료된 온라인 문항 4,748개를 연결했습니다. 확인되지 않은 답은 자동 채점하지 않으며 원문 학습으로 제공합니다.

앱은 `sites/think-math/`에 있습니다. 먼저 `server-runtime/` 폴더에서 `npm ci`로 의존성을 설치한 뒤, 앱 폴더에서 `npm run dev`를 실행하고 `http://127.0.0.1:4173/learning/index.html`을 여세요.

자세한 기능과 원본 자료의 수록 범위는 [앱 안내](sites/think-math/README.md)를 확인하세요.

## GitHub Desktop에서 올리기

GitHub Desktop에는 이 저장소의 루트인 `math-problem` 폴더를 등록합니다. 앱 소스와 공식 자료는 `sites/think-math/` 아래의 일반 파일로 함께 커밋됩니다. 앱 폴더만 가리키는 서브모듈은 사용하지 않습니다.

`sites/think-math/.git/`은 기존 Sites 작업 기록을 보존하기 위한 로컬 저장소입니다. GitHub에는 이 내부 Git 정보 대신 실제 앱 파일이 올라가며, 내부 `.git` 폴더를 삭제할 필요는 없습니다. 설치된 패키지, 임시 파일, 배포용 압축 파일은 커밋에서 제외됩니다.

커밋 후 GitHub Desktop에서 **Push origin**을 눌러 GitHub에 업로드합니다. 소스 업로드와 웹사이트 배포는 별도 단계입니다. 외부 배포 서비스를 연결할 때 앱의 작업 폴더는 `sites/think-math`입니다.
