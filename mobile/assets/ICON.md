# 앱 아이콘

- `icon.svg` — 벡터 원본(수정용)
- `icon-1024.png` — 마스터 래스터(스토어 업로드/생성기 입력용)
- `icon-512.png` — 미리보기

디자인: 다크 라운드 스퀘어 + 파란 수화기(통화) + 자물쇠 배지(암호화).

## 플랫폼 아이콘 세트 생성

여러 해상도의 아이콘을 손으로 만들 필요 없이, 아래 중 하나로 `icon-1024.png` 에서 자동 생성합니다.

### 방법 A: 온라인 생성기 (가장 간단)
- https://icon.kitchen 또는 https://www.appicon.co 에 `icon-1024.png` 업로드
- Android(mipmap) / iOS(AppIcon.appiconset) 세트를 받아 프로젝트에 복사

### 방법 B: Android Studio
- `android/app/src/main/res` 우클릭 → New → Image Asset → Launcher Icons
- Foreground 에 `icon-1024.png` 지정 → 적응형 아이콘 자동 생성

### 방법 C: Xcode
- `ios/SecretCall/Images.xcassets/AppIcon.appiconset` 에 크기별 PNG 삽입
- (Xcode 14+ 는 1024 단일 이미지만 넣어도 됨)

### 방법 D: CLI 자동화
```bash
npx @bam.tech/react-native-make set-icon --path mobile/assets/icon-1024.png
```

## 원본 수정 후 PNG 다시 뽑기

`icon.svg` 를 고친 뒤 아무 SVG→PNG 도구로 재추출하면 됩니다. 예:
```bash
npm i -D @resvg/resvg-js
node -e "const{Resvg}=require('@resvg/resvg-js');const fs=require('fs');fs.writeFileSync('assets/icon-1024.png',new Resvg(fs.readFileSync('assets/icon.svg','utf8'),{fitTo:{mode:'width',value:1024}}).render().asPng())"
```
