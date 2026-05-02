/**
 * 관리자 — 회사 정책 설정 모달
 *
 * - 헤더의 ⚙️ 버튼 (go2god4u@gmail.com 로그인 시에만 가시) 클릭 시 열림
 * - localStorage(`app_config_v1`)에 저장 → 다음 방문에도 유지
 * - "기본값으로" 버튼: 모든 정책을 DEFAULT_CONFIG로 일괄 리셋
 *
 * 변경 가능한 정책:
 *  - 시간: 월 상한, 일일 기본/반차 시간, 슬롯 단위(분)
 *  - 휴게/가산: 짧은/긴 휴게시간, 장시간 임계, 주말 가산율(+ 활성화 토글)
 *  - 캡 차감: 일일 최대 차감, 일일 최소 보장
 *  - 시간 범위: 평일 출/퇴근, 주말, 반차 출근 시간 범위
 *  - 유형: 패밀리데이/반차 활성화 토글, 패밀리데이 적용 요일
 *  - 표시: 회사명 (선택)
 *
 * 다른 회사가 사용할 때: 관리자가 본인 회사 정책에 맞게 한 번만 설정하면 끝.
 */
import { useState } from 'react';
import { X, Settings, RotateCcw, AlertCircle } from 'lucide-react';
import { AppConfig, DEFAULT_CONFIG, resetConfig } from './config';
import * as drive from './googleDrive';

interface Props {
  cfg: AppConfig;
  onSave: (cfg: AppConfig) => void;
  onClose: () => void;
  onTestExpire?: () => void;
}

export default function AdminSettings({ cfg, onSave, onClose, onTestExpire }: Props) {
  const [draft, setDraft] = useState<AppConfig>(cfg);

  const update = <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const NumField = ({ label, k, step = 1, min = 0, suffix }: { label: string; k: keyof AppConfig; step?: number; min?: number; suffix?: string }) => (
    <label className="block">
      <span className="block text-xs font-medium text-gray-500 mb-1">{label}{suffix ? ` (${suffix})` : ''}</span>
      <input
        type="number"
        step={step}
        min={min}
        value={draft[k] as number}
        onChange={(e) => update(k as any, Number(e.target.value) as any)}
        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
      />
    </label>
  );

  const TimeField = ({ label, k }: { label: string; k: keyof AppConfig }) => (
    <label className="block">
      <span className="block text-xs font-medium text-gray-500 mb-1">{label}</span>
      <input
        type="time"
        value={draft[k] as string}
        onChange={(e) => update(k as any, e.target.value as any)}
        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
      />
    </label>
  );

  const ToggleField = ({ label, k }: { label: string; k: keyof AppConfig }) => (
    <label className="flex items-center justify-between gap-3 py-1.5 cursor-pointer">
      <span className="text-sm">{label}</span>
      <input
        type="checkbox"
        checked={draft[k] as boolean}
        onChange={(e) => update(k as any, e.target.checked as any)}
        className="w-4 h-4 accent-indigo-600"
      />
    </label>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6 animate-[fadeIn_0.2s_ease-out]"
      onClick={onClose}
    >
      <div
        className="help-modal w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-500 text-white px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            <h2 className="text-lg font-bold">관리자 — 회사 정책</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg" aria-label="닫기">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-6 text-sm">
          <section>
            <h3 className="text-base font-bold mb-3">표시</h3>
            <label className="block">
              <span className="block text-xs font-medium text-gray-500 mb-1">회사명 (헤더 부제로 표시, 빈칸 OK)</span>
              <input
                type="text"
                value={draft.companyName}
                onChange={(e) => update('companyName', e.target.value)}
                placeholder="예: 동아ST"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
              />
            </label>
          </section>

          <section>
            <h3 className="text-base font-bold mb-3">시간 정책</h3>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="월 법정 상한" k="monthlyHourCap" suffix="h" />
              <NumField label="일일 기본 시간" k="workdayHours" suffix="h" />
              <NumField label="반차 시간" k="halfDayHours" suffix="h" />
              <NumField label="시간 단위" k="timeSlotMinutes" suffix="분" />
            </div>
          </section>

          <section>
            <h3 className="text-base font-bold mb-3">휴게시간 / 가산</h3>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="기본 휴게" k="breakHoursShort" step={0.5} suffix="h" />
              <NumField label="장시간 휴게" k="breakHoursLong" step={0.5} suffix="h" />
              <NumField label="장시간 임계" k="longWorkThreshold" suffix="h 이상" />
              <NumField label="주말 가산율" k="weekendMultiplier" step={0.1} suffix="배" />
            </div>
            <div className="mt-2">
              <ToggleField label="주말 가산 활성화" k="enableWeekendBonus" />
            </div>
          </section>

          <section>
            <h3 className="text-base font-bold mb-3">월 상한 차감 룰</h3>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="일일 최대 차감" k="capMaxCutPerDay" step={0.5} suffix="h" />
              <NumField label="일일 최소 보장" k="capMinHoursPerDay" step={0.5} suffix="h" />
            </div>
            <p className="text-[11px] text-gray-500 mt-2">
              월 합계가 상한 초과 시 마지막 금요일부터 거꾸로 차감, 부족하면 목/수/화/월 순으로 cascade.
            </p>
          </section>

          <section>
            <h3 className="text-base font-bold mb-3">선택 가능 시간 범위</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <TimeField label="평일 출근 (시작)" k="startTimeFrom" />
                <TimeField label="평일 출근 (끝)" k="startTimeTo" />
                <TimeField label="평일 퇴근 (시작)" k="endTimeFrom" />
                <TimeField label="평일 퇴근 (끝)" k="endTimeTo" />
                <TimeField label="주말 시간 (시작)" k="weekendTimeFrom" />
                <TimeField label="주말 시간 (끝)" k="weekendTimeTo" />
                <TimeField label="반차 출근 (시작)" k="halfDayTimeFrom" />
                <TimeField label="반차 출근 (끝)" k="halfDayTimeTo" />
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-base font-bold mb-3">근무 유형</h3>
            <div className="space-y-1">
              <ToggleField label="패밀리데이 옵션 활성화" k="enableFamilyDay" />
              <ToggleField label="반차 옵션 활성화" k="enableHalfDay" />
            </div>
            <label className="block mt-3">
              <span className="block text-xs font-medium text-gray-500 mb-1">패밀리데이 적용 요일</span>
              <select
                value={draft.familyDayDow}
                onChange={(e) => update('familyDayDow', Number(e.target.value) as any)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
              >
                {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                  <option key={i} value={i}>{d}요일</option>
                ))}
              </select>
            </label>
          </section>

          <section className="pt-3 border-t border-gray-100">
            <h3 className="text-base font-bold mb-2 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> 테스트 도구</h3>
            <p className="text-[11px] text-gray-500 mb-2">
              토큰 만료 후 자동 갱신이 잘 되는지 검증할 때 사용.
              누르면 토큰이 만료된 것처럼 처리됨 → 모달 닫고 화면을 한 번 탭하면 백그라운드에서 silent refresh 시도.
              성공 시 헤더의 동기화 뱃지가 다시 "Drive 동기화 중"으로 돌아감.
            </p>
            <button
              onClick={() => {
                drive.forceExpireForTest();
                onTestExpire?.();
                alert('토큰을 강제 만료시켰습니다.\n\n모달 닫으면 헤더에 노란 "동기화" 버튼이 나타납니다.\n그걸 누르면 Google로 이동 후 자동 복귀하며 sync 재개됩니다.');
              }}
              className="px-3 py-2 text-sm font-medium bg-amber-100 text-amber-900 hover:bg-amber-200 rounded-lg"
            >
              토큰 강제 만료 (테스트)
            </button>
          </section>

          <section className="pt-3 border-t border-gray-100 flex gap-2">
            <button
              onClick={() => {
                if (confirm('모든 정책을 기본값으로 되돌릴까요?')) {
                  resetConfig();
                  setDraft(DEFAULT_CONFIG);
                  onSave(DEFAULT_CONFIG);
                  onClose();
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <RotateCcw className="w-4 h-4" /> 기본값으로
            </button>
            <button
              onClick={onClose}
              className="ml-auto px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              취소
            </button>
            <button
              onClick={() => { onSave(draft); onClose(); }}
              className="px-4 py-2 text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg"
            >
              저장
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
