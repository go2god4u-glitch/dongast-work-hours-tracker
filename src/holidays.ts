/**
 * 한국 공휴일 동적 로드
 *
 * 데이터 소스: date.nager.at의 공개 API
 *  - 무료, API 키 불필요, CORS 허용
 *  - URL 형식: https://date.nager.at/api/v3/PublicHolidays/{year}/KR
 *
 * 캐시 전략:
 *  - IndexedDB에 연도별 캐시 (1주 TTL)
 *  - 메모리 캐시 (yearCache Map) — 같은 세션 내 중복 요청 방지
 *  - 네트워크 실패 시 constants.ts의 정적 데이터로 폴백
 *
 * 매년 코드 수정 부담 없음. 대체공휴일도 자동 반영됨.
 */

import { get, set } from 'idb-keyval';
import { KOREAN_HOLIDAYS } from './constants';

const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일

interface CacheEntry {
  fetchedAt: number;
  data: Record<string, string>;
}

interface NagerHoliday {
  date: string; // YYYY-MM-DD
  localName: string;
  name: string;
}

const cacheKey = (year: number) => `holidays:${year}`;

const fetchYear = async (year: number): Promise<Record<string, string> | null> => {
  try {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/KR`);
    if (!res.ok) return null;
    const data: NagerHoliday[] = await res.json();
    const out: Record<string, string> = {};
    data.forEach((h) => {
      out[h.date] = h.localName;
    });
    return out;
  } catch {
    return null;
  }
};

/** 정적 상수에서 해당 연도만 추출 */
const fromStatic = (year: number): Record<string, string> => {
  const prefix = `${year}-`;
  const out: Record<string, string> = {};
  for (const [date, name] of Object.entries(KOREAN_HOLIDAYS)) {
    if (date.startsWith(prefix)) out[date] = name;
  }
  return out;
};

const yearCache = new Map<number, Record<string, string>>();

export const getHolidaysForYear = async (year: number): Promise<Record<string, string>> => {
  if (yearCache.has(year)) return yearCache.get(year)!;

  // IndexedDB 캐시 확인
  try {
    const cached = await get<CacheEntry>(cacheKey(year));
    if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
      yearCache.set(year, cached.data);
      return cached.data;
    }
  } catch {}

  // 네트워크 시도
  const fresh = await fetchYear(year);
  if (fresh && Object.keys(fresh).length > 0) {
    try {
      await set(cacheKey(year), { fetchedAt: Date.now(), data: fresh } as CacheEntry);
    } catch {}
    yearCache.set(year, fresh);
    return fresh;
  }

  // 폴백: 정적 데이터
  const fallback = fromStatic(year);
  yearCache.set(year, fallback);
  return fallback;
};
