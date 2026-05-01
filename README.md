# 동아ST 근무 시간 기록기

월간 근무 시간을 입력·집계하는 단일 사용자용 웹앱입니다. 데이터는 외부 서버 없이 **브라우저의 IndexedDB**에만 저장됩니다.

## 기능
- 월별 출근/퇴근 시간 입력, 근무 유형 선택 (일반/패밀리데이/공휴일/휴가/반차)
- 한국 공휴일 자동 마킹
- 주중 휴게시간 차감 (8시간 미만 1h, 13시간 이상 1.5h), 주말 1.5배 가산
- 월간 누적 시간 / 목표 시간 / 초과·부족 자동 계산
- 자동 저장 (1초 debounce)
- 전체 데이터 JSON 백업/복원

## 실행
```bash
npm install
npm run dev
```
http://localhost:3000

## 빌드
```bash
npm run build
```

## 기술 스택
React 19 · Vite · TypeScript · Tailwind CSS · idb-keyval · framer-motion · lucide-react
