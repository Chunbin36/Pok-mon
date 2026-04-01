# 포켓몬 도감 웹앱

PokeAPI를 기반으로 만든 반응형 포켓몬 도감입니다.  
`HTML + CSS + JavaScript`만 사용해 구현했으며, 인트로 로고 클릭 후 도감이 열리는 전환 애니메이션을 제공합니다.

## 주요 기능

- 인트로 화면에서 포켓몬 로고 클릭 시 도감 오픈 전환
- 포켓몬 목록/이미지/상세 정보 표시
- 한국어 정보 표시 (이름, 도감 설명, 분류, 타입, 특성)
- 검색 기능 (한글/영문/번호)
- 페이지네이션
- 카드 클릭 시 상세 모달
- 모바일/태블릿/데스크톱 반응형 UI

## 사용 API

- [PokeAPI v2](https://pokeapi.co/api/v2)
  - `pokemon`
  - `pokemon-species`
  - `type`
  - `ability`

## 실행 방법

### 배포 버전 접속

아래 주소에서 바로 이용할 수 있습니다.  
[https://pok-mon-ecru.vercel.app](https://pok-mon-ecru.vercel.app)

### 로컬 파일 실행

1. 프로젝트를 다운로드/클론
2. `index.html`을 브라우저에서 열기

## 프로젝트 구조

```text
Pokemon/
├─ assets/
│  ├─ intro-logo.png
│  ├─ pokedex-reference.png
│  └─ pokemon-logo.png
├─ index.html
├─ style.css
├─ script.js
└─ README.md
```

## 검색 동작 참고

- 숫자 입력: 포켓몬 번호 기준 검색
- 영문 입력: 영문 이름 기준 검색
- 한글 입력: 로컬 매핑 + 한국어 이름 인덱스를 이용해 검색

## 라이선스

개인 학습/포트폴리오 용도로 제작되었습니다.  
포켓몬 관련 저작권은 원저작권자에게 있습니다.
