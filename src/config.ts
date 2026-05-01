// 회사 정책 설정 — 관리자 페이지에서 변경 가능.
// 다른 회사가 사용할 때는 이 파일의 DEFAULT_CONFIG만 바꾸면 기본값이 달라짐.

export interface AppConfig {
  /** 회사명 (헤더 부제 표시용, 빈 문자열 가능) */
  companyName: string;

  /** 월 법정 상한 시간 (예: 한국 근로기준법 171) */
  monthlyHourCap: number;

  /** 일반 평일 1일 기본 인정 시간 */
  workdayHours: number;
  /** 반차 인정 시간 */
  halfDayHours: number;

  /** 주말 가산율 (예: 1.5 = 1.5배) */
  weekendMultiplier: number;
  /** 주말 가산 활성화 여부 (false면 주말도 일반 차감 룰 적용) */
  enableWeekendBonus: boolean;

  /** 일반 근무 휴게시간 (시간 단위) */
  breakHoursShort: number;
  /** 장시간 근무 시 휴게시간 */
  breakHoursLong: number;
  /** 장시간 근무로 간주하는 임계 (시간) */
  longWorkThreshold: number;

  /** 171 캡 적용 시 한 일자에서 최대로 차감 가능한 시간 */
  capMaxCutPerDay: number;
  /** 캡 차감 후 한 일자가 가질 수 있는 최소 시간 (참고용 — capMaxCutPerDay와 workdayHours로 자동 결정됨) */
  capMinHoursPerDay: number;

  /** 시간 슬롯 간격 (분) — 30이면 30분 단위 */
  timeSlotMinutes: number;

  /** 출근 시간 선택 가능 범위 */
  startTimeFrom: string;  // 'HH:MM'
  startTimeTo: string;
  /** 퇴근 시간 선택 가능 범위 */
  endTimeFrom: string;
  endTimeTo: string;
  /** 주말 시간 선택 가능 범위 */
  weekendTimeFrom: string;
  weekendTimeTo: string;
  /** 반차 출근 시간 선택 가능 범위 */
  halfDayTimeFrom: string;
  halfDayTimeTo: string;

  /** 근무 유형 활성화 토글 */
  enableFamilyDay: boolean;
  enableHalfDay: boolean;
  /** 패밀리데이를 적용할 요일 (0=일 ~ 6=토). 기본 5(금) */
  familyDayDow: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  companyName: '',
  monthlyHourCap: 171,
  workdayHours: 8,
  halfDayHours: 4,
  weekendMultiplier: 1.5,
  enableWeekendBonus: true,
  breakHoursShort: 1,
  breakHoursLong: 1.5,
  longWorkThreshold: 13,
  capMaxCutPerDay: 2,
  capMinHoursPerDay: 6,
  timeSlotMinutes: 30,
  startTimeFrom: '07:00',
  startTimeTo: '10:00',
  endTimeFrom: '16:00',
  endTimeTo: '23:00',
  weekendTimeFrom: '00:00',
  weekendTimeTo: '23:30',
  halfDayTimeFrom: '07:00',
  halfDayTimeTo: '10:00',
  enableFamilyDay: true,
  enableHalfDay: true,
  familyDayDow: 5,
};

const STORAGE_KEY = 'app_config_v1';

export const loadConfig = (): AppConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
};

export const saveConfig = (cfg: AppConfig) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch {}
};

export const resetConfig = () => {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
};

/** HH:MM 범위와 슬롯 간격으로 시간 배열 생성 */
export const generateTimes = (from: string, to: string, slotMin: number): string[] => {
  const [fh, fm] = from.split(':').map(Number);
  const [th, tm] = to.split(':').map(Number);
  const start = fh * 60 + fm;
  const end = th * 60 + tm;
  const out: string[] = [];
  if (slotMin <= 0) return out;
  for (let m = start; m <= end; m += slotMin) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    out.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  }
  return out;
};
