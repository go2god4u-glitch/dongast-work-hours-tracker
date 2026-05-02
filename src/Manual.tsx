/**
 * 사용 설명서 본문 (헤더의 ❓ 버튼으로 표시되는 모달의 콘텐츠)
 *
 * 우선순위 — 실제 사용자가 자주 보는 항목 먼저, 기술/관리자 정보는 뒤로:
 *  [핵심 사용]    1. 기본 입력 / 2. 근무 유형 / 3. 자동 계산 / 4. 지금 출근·퇴근
 *  [편의 기능]    5. 빠른 입력 / 6. 통계 / 7. 헤더 타이틀
 *  [화면/꾸밈]    8. 색상 / 9. 빈 입력 / 10. 테마
 *  [처음 설치]    11. PWA / 12. Pull-to-refresh
 *  [관리/기술]    13. 데이터 저장 / 14. 관리자 사용자 추가
 *
 * 매뉴얼 내용 수정 시 이 파일만 편집.
 */
export default function Manual() {
  return (
    <>
      {/* ───── 핵심 사용 ───── */}
      <div className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider pt-1">핵심 사용</div>

      <section>
        <h3 className="text-base font-bold mb-2">1. 기본 입력</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>각 날짜별로 <b>근무 유형 / 출근 시간 / 퇴근 시간</b>을 선택</li>
          <li>시간은 <b>30분 단위</b>로만 선택 가능 (회사 정책)</li>
          <li>변경 즉시 자동 저장 — "모든 변경사항 저장됨" 메시지로 확인</li>
          <li>오늘 카드에 <b>인디고 강조 + "오늘" 배지</b>가 표시됨, 페이지 진입 시 오늘로 자동 스크롤</li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2">2. 근무 유형 5가지</h3>
        <div className="space-y-1.5">
          <div><b>일반 근무</b> — 평일 기본. 주중 8시간, 주말 시 1.5배</div>
          <div><b>패밀리데이</b> — 금요일 한정 옵션. 8시간 자동 인정</div>
          <div><b>공휴일</b> — 0시간. 한국 공휴일은 자동 마킹</div>
          <div><b>휴가</b> — 0시간. 목표 시간에서도 제외</div>
          <div><b>반차</b> — 4시간 (평일 한정)</div>
        </div>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2">3. 자동 계산 규칙</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>주중: 입력 시간에서 <b>휴게시간 1시간 차감</b> (13시간 이상 근무 시 1.5시간)</li>
          <li>주말 근무: 차감 없이 <b>1.5배</b> 가산</li>
          <li><b>월 171시간 법정 상한</b>: 평일×8시간이 171시간을 넘으면 마지막 주 금요일부터 거꾸로 자동 차감 (한 날 최대 2시간, 최소 6시간 보장 → 부족 시 목/수/화/월로 cascade)</li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2">4. "지금 출근 / 지금 퇴근" 자동 안내</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>평일 출근 시간대(<b>07:00 ~ 10:59</b>) + 오늘 출근 미입력 → 출근 안내 배너</li>
          <li>평일 퇴근 시간대(<b>16:00 ~ 22:59</b>) + 오늘 퇴근 미입력 → 퇴근 안내 배너</li>
          <li>배너는 <b>오늘 카드 바로 위</b>에 나타남 (15일이면 14일과 15일 사이)</li>
          <li>현재 시각을 30분 단위로 반올림한 값으로 한 번에 기록 — 30분 단위 정책 준수</li>
          <li>닫기 누르면 새로고침 전까지 다시 안 뜸</li>
        </ul>
      </section>

      {/* ───── 편의 기능 ───── */}
      <div className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider pt-2">편의 기능</div>

      <section>
        <h3 className="text-base font-bold mb-2">5. 빠른 입력 버튼 (📋 / ↺)</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>평일 일반 근무 카드 우상단의 <b>📋 어제와 동일</b> / <b>↺ 지난주 같은 요일과 동일</b> 버튼</li>
          <li>클릭 시 출처 데이터를 미리 보여주고 확인 후 적용 (덮어쓰기 경고 포함)</li>
          <li>월 경계를 넘어 다른 월의 데이터도 자동으로 가져옴</li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2">6. 통계 (📊 버튼)</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>헤더의 <b>📊 차트 아이콘</b> 클릭 → 이번 달 통계 모달</li>
          <li>표시 내용: 누적/목표, 야근(<b>퇴근 18시 이후</b>) 일수, 평균 출근/퇴근 시각</li>
          <li>휴일·휴가 카운트 / 주별 누적 막대 차트 / 요일별 평균 막대 차트</li>
          <li>가장 빠른 출근 / 가장 늦은 퇴근 기록</li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2">7. 헤더 동적 타이틀</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>주말</b> → "오늘은 쉬는 날 😁"</li>
          <li><b>공휴일</b> → "[공휴일명] 🎉" (예: 어린이날 🎉)</li>
          <li><b>휴가</b> → "즐거운 휴가 🏖️" / <b>패밀리데이</b> → "패밀리데이 💕"</li>
          <li><b>평일 + 퇴근시간 미입력</b> → "오늘도 출근! 💪🏻"</li>
          <li><b>평일 + 퇴근시간 입력 + 현재 &lt; 퇴근시간</b> → "퇴근까지 N시간 M분 남았어요 🤗" (1분마다 자동 갱신)</li>
          <li><b>평일 + 퇴근 시각 이후</b> → "퇴근 💕"</li>
        </ul>
      </section>

      {/* ───── 화면 / 꾸밈 ───── */}
      <div className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider pt-2">화면 / 꾸밈</div>

      <section>
        <h3 className="text-base font-bold mb-2">8. 색상 코드</h3>
        <div className="space-y-1.5">
          <div><span className="inline-block w-2 h-2 rounded-full bg-indigo-400 mr-2 align-middle" />평일 도트 (월 인디고 / 화 스카이 / 수 틸 / 목 에메랄드 / 금 바이올렛)</div>
          <div><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-2 align-middle" />주말/공휴일 (빨강)</div>
          <div><span className="inline-block w-2 h-2 rounded-full bg-pink-400 mr-2 align-middle" />휴가/패밀리데이/반차 (분홍)</div>
          <div className="pt-2"><b>초과/부족 색</b>: 부족 1~3 옅은 빨강 → 3~5 중간 → 5~8 진함 → 8 초과 가장 진한 빨강 + 깜빡임</div>
        </div>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2">9. 빈 입력 시각 신호</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>일반 근무 평일에서 출근/퇴근 미입력 시 셀렉트에 <b>옅은 노랑 outline</b> 표시</li>
          <li>실수로 빠뜨린 날 한눈에 식별</li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2">10. 테마 4종 (☀️/🌙/👑/✨)</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>헤더 우측 토글 버튼 — 누를 때마다 <b>라이트 → 다크 → 핑크(공주) → 파스텔</b> 순환</li>
          <li>선택은 자동 저장되어 다음 방문에도 유지</li>
          <li>전환 시 부드러운 페이드 애니메이션 (View Transitions API)</li>
        </ul>
      </section>

      {/* ───── 처음 설치 ───── */}
      <div className="text-[11px] font-bold text-indigo-500 uppercase tracking-wider pt-2">처음 설치</div>

      <section>
        <h3 className="text-base font-bold mb-2">11. iPhone 홈 화면 추가 (PWA)</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Safari로 사이트 접속 → 하단 공유 버튼 → <b>"홈 화면에 추가"</b></li>
          <li>홈 화면 아이콘으로 실행 시 주소창 없이 standalone으로 동작</li>
          <li>오프라인에서도 캐시된 화면 열림 (Service Worker)</li>
          <li>iOS Safari가 7일 미사용 시 IndexedDB를 자동 삭제할 수 있으므로 <b>홈 화면 추가 + Google 로그인 권장</b></li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2">12. 새로고침 (Pull-to-refresh)</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>페이지 최상단에서 손가락으로 <b>아래로 70px 이상</b> 끌고 놓으면 자동 새로고침</li>
          <li>인디케이터(↺)가 따라 내려오며 회전, 80px 초과 시 채워짐</li>
        </ul>
      </section>

      {/* ───── 관리 / 기술 ───── */}
      <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider pt-2">관리 / 기술 (참고)</div>

      <section>
        <h3 className="text-base font-bold mb-2">13. 데이터 저장</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li><b>로컬 (IndexedDB)</b>: 항상 자동 저장. 이 브라우저에서만 접근</li>
          <li><b>Google Drive 동기화</b>: 헤더의 "Google 로그인" 클릭 → 본인 Drive의 앱 전용 폴더에 자동 백업. 다른 기기에서 같은 계정 로그인 시 자동 다운로드</li>
          <li>일자별 modifiedAt 기반 충돌 병합 — 두 기기에서 동시 수정 시 더 최근 변경이 이김</li>
          <li>같이 쓰는 사용자는 각자 본인 Drive에만 저장 (서로 격리)</li>
        </ul>
      </section>

      <section>
        <h3 className="text-base font-bold mb-2">14. 관리자 — 사용자 추가</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>헤더의 <b>👤➕ 버튼</b> 클릭 → Google Cloud Console "테스트 사용자" 페이지 열림</li>
          <li>같이 쓸 직원의 Gmail을 추가 (테스트 모드 최대 100명, 무료)</li>
          <li>관리자(앱 소유자) 계정만 권한 있음 — 다른 사용자가 눌러도 Google이 자동 차단</li>
        </ul>
      </section>

      <section className="text-xs text-gray-500 pt-3 border-t border-gray-100">
        문의 / 버그: <a href="https://github.com/go2god4u-glitch/dongast-work-hours-tracker/issues" className="underline" target="_blank" rel="noopener noreferrer">GitHub Issues</a>
      </section>
    </>
  );
}
