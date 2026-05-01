/**
 * 로컬 저장소 — IndexedDB (idb-keyval 라이브러리 사용)
 *
 * - 키 형식: `schedule:{YYYY-MM}` (월별 한 객체)
 * - 값: { [YYYY-MM-DD]: { start, end, type, m? } }
 *   - m = modifiedAt (ms epoch). 사용자가 직접 변경한 항목은 m이 세팅되고,
 *     공휴일 자동 마킹은 m 없이 저장됨 → 충돌 시 사용자 편집이 항상 우선.
 *
 * 주요 함수:
 *  - loadMonth / saveMonth — 월 단위 입출력
 *  - exportAll / importAll — 전체 백업·복원
 *  - mergeMonth / mergeAll — 동기화 시 일자별 m 비교 후 더 최근 변경 채택
 */
import { get, set, del, keys } from 'idb-keyval';

export type DayType = 'normal' | 'holiday' | 'vacation' | 'family' | 'half-day';

export interface DayEntry {
  start: string;
  end: string;
  type: DayType;
  /** 수정 시각 (ms epoch). 동기화 충돌 해결용. 시스템 자동 마킹은 0/undefined */
  m?: number;
}

export type MonthSchedule = Record<string, DayEntry>;
export type AllMonths = Record<string, MonthSchedule>;

const monthKey = (month: string) => `schedule:${month}`;

export const loadMonth = async (month: string): Promise<MonthSchedule> => {
  return (await get<MonthSchedule>(monthKey(month))) ?? {};
};

export const saveMonth = async (month: string, data: MonthSchedule) => {
  await set(monthKey(month), data);
};

export const deleteMonth = async (month: string) => {
  await del(monthKey(month));
};

export const exportAll = async (): Promise<AllMonths> => {
  const allKeys = await keys();
  const out: AllMonths = {};
  for (const k of allKeys) {
    if (typeof k === 'string' && k.startsWith('schedule:')) {
      const month = k.slice('schedule:'.length);
      const data = await get<MonthSchedule>(k);
      if (data) out[month] = data;
    }
  }
  return out;
};

export const importAll = async (payload: AllMonths) => {
  for (const [month, data] of Object.entries(payload)) {
    await set(monthKey(month), data);
  }
};

/**
 * 두 스케줄을 일자별로 병합. 각 항목의 m(modifiedAt)이 더 최근인 쪽이 이김.
 * m이 같거나 둘 다 없으면 a 우선.
 */
export const mergeMonth = (a: MonthSchedule, b: MonthSchedule): MonthSchedule => {
  const out: MonthSchedule = { ...a };
  for (const [date, bEntry] of Object.entries(b)) {
    const aEntry = out[date];
    if (!aEntry) {
      out[date] = bEntry;
    } else {
      const am = aEntry.m ?? 0;
      const bm = bEntry.m ?? 0;
      if (bm > am) out[date] = bEntry;
    }
  }
  return out;
};

export const mergeAll = (a: AllMonths, b: AllMonths): AllMonths => {
  const out: AllMonths = { ...a };
  for (const [month, bMonth] of Object.entries(b)) {
    out[month] = out[month] ? mergeMonth(out[month], bMonth) : bMonth;
  }
  return out;
};
