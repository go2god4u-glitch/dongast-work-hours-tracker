/**
 * ============================================================
 *  오늘도 출근! 💪🏻 — 출퇴근 시간 기록 PWA
 *  Repo: github.com/go2god4u-glitch/dongast-work-hours-tracker
 * ============================================================
 *
 * [ 데이터 / 저장 ]
 *  - 주 저장소: 브라우저 IndexedDB (idb-keyval, src/storage.ts)
 *  - 보조 저장소: Google Drive appDataFolder (사용자 본인만 접근 가능)
 *  - 일자 항목마다 m(modifiedAt) 타임스탬프 → 다중 기기 동시 편집 시 일자별 머지
 *  - 로컬 저장 = 즉시 / Drive sync = 30초마다 + 탭 숨김 + 페이지 떠날 때 자동 push
 *  - 세션은 localStorage에 영속화. 토큰 만료 5분 전 silent refresh 자동 스케줄
 *
 * [ 입력 / 계산 ]
 *  - 30분 단위 시간 슬롯 (회사 정책, 관리자 설정에서 변경 가능)
 *  - 5가지 근무 유형: 일반 / 패밀리데이 / 공휴일 / 휴가 / 반차
 *  - 휴게시간 자동 차감 (8h↑ 1시간, 13h↑ 1.5시간 — 모두 설정 가능)
 *  - 주말 1.5배 가산 (설정 가능)
 *  - 월 171시간 법정 상한 — 초과 시 마지막 금요일부터 거꾸로 차감
 *    (한 날 최대 2시간, 최소 6시간 보장 → 부족 시 목/수/화/월로 cascade)
 *  - 한국 공휴일 자동 마킹 (date.nager.at API + 7일 캐시 + 정적 폴백)
 *
 * [ UI / UX ]
 *  - 헤더 동적 타이틀: "오늘도 출근! 💪🏻" / "퇴근까지 N시간 M분 🤗" / "퇴근 💕"
 *  - "지금 출근/퇴근" 1-탭 기록 배너 (오늘 카드 위, 시간대 조건 충족 시)
 *  - 빠른 입력: "어제와 동일" / "지난주 같은 요일과 동일" (확인 다이얼로그)
 *  - 월말 회고 모달 (📊): 야근(18시 이후), 평균 출근/퇴근, 주별/요일별 차트
 *  - 4가지 테마: 라이트 / 다크 / 핑크(공주) / 파스텔 (View Transitions API 페이드)
 *  - Pull-to-refresh: 70px 끌면 새로고침
 *  - PWA: manifest + service worker + 오프라인 캐시
 *  - 미입력 셀에 옅은 노랑 hint outline
 *  - 좌측 컬러 stripe (요일/유형별), 호버 lift, hover shimmer
 *  - "오늘" 카드 강조 (글로우 + 펄스 배지 + 도트 패턴)
 *  - 부족 시간 단계별 빨강 그라데이션 (1~3 옅음 → 8 초과 진한+깜빡임)
 *  - CountUp 애니메이션 (숫자 변경 시 부드럽게 차오름)
 *  - 헤더 캘린더 아이콘 둥둥 부유 (animate-float)
 *  - 글래스모피즘 (헤더 안 박스들)
 *
 * [ 관리자 (go2god4u@gmail.com 한정) ]
 *  - ⚙️ 회사 정책 모달 (src/AdminSettings.tsx)
 *      • 171시간 상한, 일일 시간, 휴게/가산, 시간 단위, 시간 범위, 유형 토글 등 모두 변경 가능
 *      • localStorage(`app_config_v1`)에 저장 → 다른 회사도 자기 정책으로 사용 가능
 *  - 👤➕ Google Cloud Console 테스트 사용자 추가 바로가기
 *
 * [ 사용 설명서 (❓) ]
 *  - 14개 섹션: 입력/타이틀/유형/계산/빠른입력/지금기록/회고/저장/색상/테마/PWA/PTR/관리자/hint
 *  - src/Manual.tsx 별도 파일로 분리 — 매뉴얼 수정 시 그 파일만 편집
 *
 * [ 폰트 ]
 *  - Inter + JetBrains Mono를 fontsource로 self-host (Google Fonts CDN 의존성 0)
 *
 * [ 버전 표시 ]
 *  - 화면 맨 아래 "v{날짜} · {git short hash}" — 매 push마다 vite.config.ts가 자동 갱신
 *
 * [ 진행한 주요 변화 (시간순) ]
 *  - Firebase 의존 → 완전 제거, IndexedDB + Drive appDataFolder로 전환
 *  - 다중 사용자 → 각자 본인 Drive에 격리 저장
 *  - GitHub Pages 자동 배포 (.github/workflows/deploy.yml)
 *  - 30분 단위 정책, 171시간 캡 cascade, 공휴일 자동 갱신
 *  - 동기화 충돌 보호 (per-day modifiedAt 머지)
 *  - PWA + iOS safe-area + ITP 회피 안내
 *  - 4 테마 + Pull-to-refresh + 시각 디테일 14가지
 *  - 토큰 영속화 + silent refresh로 1시간 재로그인 문제 해결
 *  - Drive sync를 저장 흐름과 분리 → UI 빠른 응답
 *  - 회사 정책 관리 페이지 (다른 회사도 사용 가능)
 *  - 햅틱 제거 (iOS 미지원)
 * ============================================================
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Clock,
  Calendar,
  Calculator,
  CheckCircle2,
  AlertCircle,
  Cloud,
  CloudOff,
  LogIn,
  LogOut,
  User as UserIcon,
  Sun,
  Moon,
  Copy,
  RotateCcw,
  UserPlus,
  Crown,
  Sparkles,
  HelpCircle,
  X,
  BarChart3,
  Settings,
  TrendingUp,
  Award,
  Coffee,
  Sunrise,
  Sunset,
} from 'lucide-react';

const ADMIN_EMAIL = 'go2god4u@gmail.com';
const ADD_USER_URL = 'https://console.cloud.google.com/auth/audience?project=dongast-work-hours';
import { motion, AnimatePresence } from 'framer-motion';
import { loadMonth, saveMonth, exportAll, importAll, MonthSchedule, DayEntry } from './storage';
import { getHolidaysForYear } from './holidays';
import * as drive from './googleDrive';
import Manual from './Manual';
import { AppConfig, loadConfig, saveConfig, generateTimes } from './config';
import AdminSettings from './AdminSettings';

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
const isStandalone = () =>
  (window.matchMedia('(display-mode: standalone)').matches) ||
  (navigator as any).standalone === true;

function CountUp({ value, decimals = 0, duration = 500 }: { value: number; decimals?: number; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);
  useEffect(() => {
    const start = prevRef.current;
    const target = value;
    if (start === target) { setDisplay(target); return; }
    const startTime = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - startTime) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(start + (target - start) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  const formatted = decimals === 0 ? Math.round(display).toString() : display.toFixed(decimals);
  return <>{formatted}</>;
}

const calculateHours = (start: string, end: string) => {
  if (!start || !end) return 0;
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  const diff = ((endH * 60 + endM) - (startH * 60 + startM)) / 60;
  return diff > 0 ? diff : 0;
};

type SyncState = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export default function App() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [schedule, setSchedule] = useState<MonthSchedule>({});
  const [holidays, setHolidays] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isDirty, setIsDirty] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [driveStatus, setDriveStatus] = useState<drive.DriveStatus>(drive.getStatus());
  const [user, setUser] = useState<drive.UserInfo | null>(drive.getUser());
  const [syncState, setSyncState] = useState<SyncState>(drive.isEnabled() ? 'idle' : 'offline');
  const todayRef = useRef<HTMLDivElement>(null);
  const [showIntro, setShowIntro] = useState(() => {
    try {
      return localStorage.getItem('intro_dismissed') !== '1' && isIOS() && !isStandalone();
    } catch {
      return false;
    }
  });
  const dismissIntro = () => {
    try { localStorage.setItem('intro_dismissed', '1'); } catch {}
    setShowIntro(false);
  };

  const [nowPromptDismissed, setNowPromptDismissed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const [showAdminSettings, setShowAdminSettings] = useState(false);
  const [cfg, setCfg] = useState<AppConfig>(loadConfig);
  const startTimes = useMemo(() => generateTimes(cfg.startTimeFrom, cfg.startTimeTo, cfg.timeSlotMinutes), [cfg.startTimeFrom, cfg.startTimeTo, cfg.timeSlotMinutes]);
  const endTimes = useMemo(() => generateTimes(cfg.endTimeFrom, cfg.endTimeTo, cfg.timeSlotMinutes), [cfg.endTimeFrom, cfg.endTimeTo, cfg.timeSlotMinutes]);
  const weekendTimes = useMemo(() => generateTimes(cfg.weekendTimeFrom, cfg.weekendTimeTo, cfg.timeSlotMinutes), [cfg.weekendTimeFrom, cfg.weekendTimeTo, cfg.timeSlotMinutes]);
  const halfDayTimes = useMemo(() => generateTimes(cfg.halfDayTimeFrom, cfg.halfDayTimeTo, cfg.timeSlotMinutes), [cfg.halfDayTimeFrom, cfg.halfDayTimeTo, cfg.timeSlotMinutes]);
  // 헤더 타이틀이 1분마다 갱신되도록 tick
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  type Theme = 'light' | 'dark' | 'pink' | 'pastel';
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('theme') as Theme | null;
      if (saved && ['light', 'dark', 'pink', 'pastel'].includes(saved)) return saved;
    } catch {}
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('dark', 'pink', 'pastel');
    if (theme !== 'light') html.classList.add(theme);
    try { localStorage.setItem('theme', theme); } catch {}
    const colors: Record<Theme, string> = {
      light: '#4f46e5',
      dark: '#0b0b0e',
      pink: '#ec4899',
      pastel: '#c4b5fd',
    };
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', colors[theme]);
  }, [theme]);
  const themeOrder: Theme[] = ['light', 'dark', 'pink', 'pastel'];
  const cycleTheme = () => {
const apply = () => setTheme((t) => themeOrder[(themeOrder.indexOf(t) + 1) % themeOrder.length]);
    if ((document as any).startViewTransition) {
      (document as any).startViewTransition(apply);
    } else {
      apply();
    }
  };

  // Pull-to-refresh: 스크롤 최상단에서 아래로 끌어 80px 이상 → 새로고침
  const [ptrDistance, setPtrDistance] = useState(0);
  const [ptrRefreshing, setPtrRefreshing] = useState(false);
  const PTR_THRESHOLD = 70;
  const PTR_MAX = 140;
  const ptrDistRef = useRef(0);
  const setDist = useCallback((d: number) => {
    ptrDistRef.current = d;
    setPtrDistance(d);
  }, []);
  useEffect(() => {
    let startY: number | null = null;
    let lastY = 0;

    const getScrollTop = () =>
      window.scrollY ||
      document.documentElement.scrollTop ||
      document.body.scrollTop ||
      0;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { startY = null; return; }
      // 시작 시점이 최상단이 아니면 일단 보류 — 나중에 최상단 도달 시 재설정
      startY = getScrollTop() <= 0 ? e.touches[0].clientY : null;
      lastY = e.touches[0].clientY;
    };

    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const y = e.touches[0].clientY;
      lastY = y;
      const top = getScrollTop();

      if (top > 0) {
        // 최상단이 아니면 추적 안 함
        if (ptrDistRef.current !== 0) setDist(0);
        startY = null;
        return;
      }

      if (startY === null) {
        // 방금 막 최상단에 도달 → 여기서부터 시작 기준
        startY = y;
        return;
      }

      const delta = y - startY;
      if (delta <= 0) {
        // 위로 올라가는 동작 → start 재설정
        startY = y;
        if (ptrDistRef.current !== 0) setDist(0);
        return;
      }

      const damped = Math.min(PTR_MAX, delta * 0.55);
      setDist(damped);
    };

    const onEnd = () => {
      if (ptrDistRef.current >= PTR_THRESHOLD) {
        setPtrRefreshing(true);
        // 부드럽게 인디케이터 표시 후 새로고침
        setTimeout(() => window.location.reload(), 350);
      } else {
        setDist(0);
      }
      startY = null;
      lastY = 0;
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    document.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, [setDist]);
  const themeMeta: Record<Theme, { icon: typeof Sun; label: string }> = {
    light: { icon: Sun, label: '라이트' },
    dark: { icon: Moon, label: '다크' },
    pink: { icon: Crown, label: '핑크 (공주)' },
    pastel: { icon: Sparkles, label: '파스텔' },
  };

  // Load month from IndexedDB
  useEffect(() => {
    setIsDataLoaded(false);
    setSchedule({});
    let cancelled = false;
    loadMonth(selectedMonth).then(data => {
      if (cancelled) return;
      setSchedule(data);
      setIsDataLoaded(true);
      setIsDirty(false);
    });
    return () => { cancelled = true; };
  }, [selectedMonth]);

  // 사용자 정보가 비어있으면 한 번만 silent로 보강 (signed-in 상태에서만).
  // 'expired' 상태에서는 자동 갱신을 시도하지 않음 — iOS Safari가 popup 차단 다이얼로그를
  // 띄우는 원인이기 때문. 사용자가 명시적으로 로그아웃/로그인 하면 정상 복구됨.
  useEffect(() => {
    if (!drive.isEnabled()) return;
    if (drive.getStatus() === 'signed-in' && !drive.getUser()) {
      drive.refreshUserInfo().then(u => setUser(u));
    }
  }, []);

  // Fetch holidays for selected month's year (cached, fallback to static)
  useEffect(() => {
    const year = Number(selectedMonth.split('-')[0]);
    let cancelled = false;
    getHolidaysForYear(year).then(h => {
      if (!cancelled) setHolidays(h);
    });
    return () => { cancelled = true; };
  }, [selectedMonth]);

  // After sign-in, pull from Drive and merge into IndexedDB
  const pullFromDrive = useCallback(async () => {
    if (!drive.isEnabled() || drive.getStatus() !== 'signed-in') return;
    setSyncState('syncing');
    try {
      const remote = await drive.downloadAll();
      if (remote) {
        await importAll(remote);
        // refresh current month view
        const fresh = await loadMonth(selectedMonth);
        setSchedule(fresh);
      }
      setSyncState('synced');
      setTimeout(() => setSyncState('idle'), 1500);
    } catch (e) {
      console.error('Drive pull failed', e);
      setSyncState('error');
    }
  }, [selectedMonth]);

  // Drive에 보낼 미저장 변경분이 있는지 추적 (UI 재렌더와 무관)
  const driveDirtyRef = useRef(false);
  // 연속 실패 카운터 — 일시적 끊김(iOS 백그라운드 fetch 중단 등)에 에러 뱃지 안 띄우기 위함
  const failuresRef = useRef(0);

  // 조용한 백그라운드 동기화 — Drive와 일자별 modifiedAt 머지 후 업로드.
  // 다중 기기 동시 편집 보호: 두 기기에서 다른 날을 편집해도 둘 다 보존.
  // schedule 갱신은 실제 변경이 있을 때만 (불필요한 재렌더 방지).
  // 연속 3회 이상 실패해야 사용자에게 에러 뱃지 표시 (단발성 끊김 무시).
  const silentPush = useCallback(async () => {
    if (!drive.isEnabled() || drive.getStatus() !== 'signed-in') return;
    if (!driveDirtyRef.current) return;
    driveDirtyRef.current = false;
    // syncing 뱃지는 즉시 표시 (사용자에게 작업 중임을 알림)
    setSyncState('syncing');
    try {
      const local = await exportAll();
      const merged = await drive.syncAll(local);
      await importAll(merged);
      const currentMerged = merged[selectedMonth] || {};
      setSchedule(prev => {
        const prevKeys = Object.keys(prev);
        const newKeys = Object.keys(currentMerged);
        if (prevKeys.length !== newKeys.length) return currentMerged;
        for (const k of newKeys) {
          const a = prev[k];
          const b = currentMerged[k];
          if (!a || a.start !== b.start || a.end !== b.end || a.type !== b.type || a.m !== b.m) {
            return currentMerged;
          }
        }
        return prev;
      });
      failuresRef.current = 0; // 성공 — 카운터 리셋
      setSyncState('synced');
      setTimeout(() => setSyncState('idle'), 1500);
    } catch (e: any) {
      console.warn('Background drive sync failed:', e);
      driveDirtyRef.current = true; // 다음 주기 재시도
      failuresRef.current += 1;
      const msg = String(e?.message || e || '');
      const looksLikeAuth = /401|unauthor|invalid_token|access_denied/i.test(msg);
      // 토큰 만료성 오류면 silent refresh 한 번 시도 후 즉시 재시도
      if (looksLikeAuth && drive.refreshUserInfo) {
        try {
          await drive.refreshUserInfo();
          // 재시도는 다음 30초 주기로 자연스럽게
        } catch {}
      }
      // 단발성 실패는 사용자에게 안 보임. 연속 3회 이상에만 에러 뱃지 표시.
      if (failuresRef.current >= 3) {
        setSyncState('error');
      } else {
        setSyncState('idle');
      }
    }
  }, [selectedMonth]);

  // 초기 pull/sync용 — 사용자가 명시적으로 동기화 요청 (signIn 직후 등)
  const pushToDrive = useCallback(async () => {
    if (!drive.isEnabled() || drive.getStatus() !== 'signed-in') return;
    setSyncState('syncing');
    try {
      const local = await exportAll();
      const merged = await drive.syncAll(local);
      await importAll(merged);
      const fresh = await loadMonth(selectedMonth);
      setSchedule(fresh);
      setSyncState('synced');
      setTimeout(() => setSyncState('idle'), 1500);
    } catch (e) {
      console.error('Drive push failed', e);
      setSyncState('error');
    }
  }, [selectedMonth]);

  // Scroll to today
  useEffect(() => {
    if (!isDataLoaded) return;
    const timer = setTimeout(() => {
      todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
    return () => clearTimeout(timer);
  }, [isDataLoaded, selectedMonth]);

  // 로컬 저장 — IndexedDB만, 1초 debounce. UI 즉각 반영. Drive와 무관.
  useEffect(() => {
    if (!isDirty || !isDataLoaded) return;
    const timer = setTimeout(async () => {
      setIsSaving(true);
      setSaveStatus('idle');
      try {
        await saveMonth(selectedMonth, schedule);
        setSaveStatus('success');
        setIsDirty(false);
        setTimeout(() => setSaveStatus('idle'), 2000);
        driveDirtyRef.current = true; // 백그라운드 sync에 알림
      } catch (error) {
        console.error('Save failed:', error);
        setSaveStatus('error');
      } finally {
        setIsSaving(false);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [schedule, isDirty, isDataLoaded, selectedMonth]);

  // Drive 백그라운드 sync — 30초마다 미저장 변경분 일괄 업로드.
  // + 탭 숨김 시 / 페이지 떠날 때 마지막 push로 데이터 보존.
  useEffect(() => {
    const interval = setInterval(silentPush, 30000);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') silentPush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', silentPush);
    window.addEventListener('pagehide', silentPush);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', silentPush);
      window.removeEventListener('pagehide', silentPush);
    };
  }, [silentPush]);

  const daysInMonth = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const days = [];
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    for (let i = 1; i <= lastDay; i++) {
      const dateObj = new Date(year, month - 1, i);
      const dayOfWeek = dateObj.getDay();
      const dateString = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        dateString,
        dayNumber: i,
        dayName: dayNames[dayOfWeek],
        isSunday: dayOfWeek === 0,
        isSaturday: dayOfWeek === 6,
        isFriday: dayOfWeek === 5,
      });
    }
    return days;
  }, [selectedMonth]);

  // Auto-mark holidays
  useEffect(() => {
    if (!isDataLoaded) return;
    const currentMonthPrefix = selectedMonth;
    const holidayDates = daysInMonth.filter(day => holidays[day.dateString]);
    const missingHolidays = holidayDates.filter(day => {
      const entry = schedule[day.dateString];
      return day.dateString.startsWith(currentMonthPrefix) && (!entry || entry.type === 'normal');
    });

    if (missingHolidays.length > 0) {
      setSchedule(prev => {
        const next = { ...prev };
        let changed = false;
        missingHolidays.forEach(day => {
          if (!next[day.dateString] || next[day.dateString].type === 'normal') {
            next[day.dateString] = {
              ...(next[day.dateString] || { start: '', end: '' }),
              type: 'holiday'
            };
            changed = true;
          }
        });
        return changed ? next : prev;
      });
      setIsDirty(true);
    }
  }, [daysInMonth, schedule, selectedMonth, isDataLoaded]);

  const [flashedDate, setFlashedDate] = useState<string | null>(null);
  const handleTimeChange = (dateString: string, field: 'start' | 'end' | 'type', value: string) => {
    setSchedule(prev => {
      const current = prev[dateString] || { start: '', end: '', type: 'normal' };
      let newEntry: DayEntry = { ...current, [field]: value, m: Date.now() };
      if (newEntry.type === 'family' || newEntry.type === 'half-day') {
        newEntry.end = '';
      }
      return { ...prev, [dateString]: newEntry };
    });
    setIsDirty(true);
    setFlashedDate(dateString);
    setTimeout(() => setFlashedDate(p => (p === dateString ? null : p)), 700);
  };

  const dateOffset = (dateString: string, daysBack: number): string => {
    const d = new Date(dateString + 'T00:00:00');
    d.setDate(d.getDate() - daysBack);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  /** 다른 날짜 항목 복사 (출/퇴근/유형). 다른 월도 자동 로드. 확인 후 진행 */
  const copyFromDate = async (targetDate: string, sourceDate: string, label: string) => {
    let source: DayEntry | undefined = schedule[sourceDate];
    if (!source && !sourceDate.startsWith(selectedMonth)) {
      const otherMonth = sourceDate.slice(0, 7);
      const otherData = await loadMonth(otherMonth);
      source = otherData[sourceDate];
    }

    const formatDate = (d: string) => {
      const dt = new Date(d + 'T00:00:00');
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
      return `${dt.getMonth() + 1}월 ${dt.getDate()}일 (${dayNames[dt.getDay()]})`;
    };
    const typeLabels: Record<string, string> = {
      normal: '일반 근무',
      family: '패밀리데이',
      holiday: '공휴일',
      vacation: '휴가',
      'half-day': '반차',
    };

    if (!source || (!source.start && !source.end && (!source.type || source.type === 'normal'))) {
      alert(`${label} (${formatDate(sourceDate)})에 복사할 데이터가 없습니다.`);
      return;
    }

    const summary = [
      `근무 유형: ${typeLabels[source.type] || source.type}`,
      source.start ? `출근: ${source.start}` : null,
      source.end ? `퇴근: ${source.end}` : null,
    ].filter(Boolean).join('\n');

    const ok = window.confirm(
      `${formatDate(targetDate)}을(를) ${label} (${formatDate(sourceDate)})과 동일하게 입력합니다.\n\n` +
      `${summary}\n\n` +
      `현재 입력된 값이 있으면 덮어쓰여집니다. 진행할까요?`
    );
    if (!ok) return;

    setSchedule(prev => ({
      ...prev,
      [targetDate]: { start: source!.start, end: source!.end, type: source!.type, m: Date.now() },
    }));
    setIsDirty(true);
  };

  const handleReauth = async () => {
    try {
      const u = await drive.reauthorize();
      setUser(u);
      setDriveStatus(drive.getStatus());
      // 재인증 후엔 백그라운드 sync로 자연스럽게 따라잡음 — 즉시 pull은 하지 않음 (UI 안 막음)
    } catch (e: any) {
      console.error('Reauth failed', e);
      setSyncState('error');
    }
  };

  const handleSignIn = async () => {
    try {
      const u = await drive.signIn();
      setUser(u);
      setDriveStatus(drive.getStatus());
      await pullFromDrive();
    } catch (e: any) {
      console.error('Sign-in failed', e);
      setSyncState('error');
      const msg = String(e?.message || e);
      if (msg.includes('popup') || msg.includes('blocked')) {
        alert('팝업이 차단되었습니다. 브라우저 설정에서 이 사이트의 팝업을 허용한 뒤 다시 시도해 주세요.');
      } else if (msg.includes('Client ID')) {
        alert('Google Drive 동기화가 아직 설정되지 않았습니다. (.env.local의 VITE_GOOGLE_CLIENT_ID 필요)');
      }
    }
  };

  const handleSignOut = () => {
    const ok = window.confirm(
      '정말 로그아웃하시겠어요?\n\n' +
      '• 로컬 데이터(이 기기에 저장된 입력)는 그대로 남습니다.\n' +
      '• 다음 사용 시 Google 동기화를 위해 다시 로그인해야 합니다.'
    );
    if (!ok) return;
    drive.signOut();
    setUser(null);
    setDriveStatus(drive.getStatus());
    setSyncState('idle');
  };

  // 월 171시간 법정 상한: 일반 근무일은 최소 6시간 유지(=하루당 최대 2시간만 차감).
  // 우선순위: 마지막 주 금요일 → 거슬러 올라가며 모든 금요일 → 목요일 → 수요일 → 화요일 → 월요일.
  // 패밀리데이/공휴일/휴가/반차는 차감 대상 제외.
  const capInfo = useMemo(() => {
    let baseTarget = 0;
    daysInMonth.forEach(day => {
      if (day.isSunday || day.isSaturday) return;
      const t = schedule[day.dateString]?.type;
      if (t === 'holiday' || t === 'vacation') return;
      if (t === 'half-day') baseTarget += cfg.halfDayHours;
      else baseTarget += cfg.workdayHours; // normal, family
    });

    const reductions: Record<string, number> = {};
    if (baseTarget <= cfg.monthlyHourCap) return { reductions, target: baseTarget };

    let excess = baseTarget - cfg.monthlyHourCap;
    const PER_DAY_MAX_CUT = cfg.capMaxCutPerDay;

    const dowOf = (dateStr: string) => new Date(dateStr + 'T00:00:00').getDay();
    // 금(5) → 목(4) → 수(3) → 화(2) → 월(1) 순으로 차감 대상 확장
    const dayOrder = [5, 4, 3, 2, 1];

    for (const dow of dayOrder) {
      if (excess <= 0) break;
      const candidates = daysInMonth
        .filter(d => dowOf(d.dateString) === dow)
        .reverse() // 같은 요일 안에서는 마지막부터
        .filter(d => {
          const t = schedule[d.dateString]?.type;
          return !t || t === 'normal'; // 일반 근무일만
        });
      for (const day of candidates) {
        if (excess <= 0) break;
        const cut = Math.min(excess, PER_DAY_MAX_CUT);
        reductions[day.dateString] = cut;
        excess -= cut;
      }
    }

    const totalReduced = Object.values(reductions).reduce((a, b) => a + b, 0);
    return { reductions, target: baseTarget - totalReduced };
  }, [daysInMonth, schedule, cfg.workdayHours, cfg.halfDayHours, cfg.monthlyHourCap, cfg.capMaxCutPerDay]);

  const dailyHours = useMemo(() => {
    const hours: Record<string, number> = {};
    daysInMonth.forEach(day => {
      const s = schedule[day.dateString] || { start: '', end: '', type: 'normal' };
      const reduction = capInfo.reductions[day.dateString] || 0;

      if (s.type === 'holiday' || s.type === 'vacation') {
        hours[day.dateString] = 0;
        return;
      }
      if (s.type === 'family') {
        hours[day.dateString] = Math.max(0, cfg.workdayHours - reduction);
        return;
      }
      if (s.type === 'half-day') {
        hours[day.dateString] = Math.max(0, cfg.halfDayHours - reduction);
        return;
      }
      const hasInput = s.start && s.end;
      if (hasInput) {
        let rawHours = calculateHours(s.start, s.end);
        if (rawHours > 0) {
          if ((day.isSunday || day.isSaturday) && cfg.enableWeekendBonus) {
            hours[day.dateString] = rawHours * cfg.weekendMultiplier;
          } else {
            const breakTime = rawHours >= cfg.longWorkThreshold ? cfg.breakHoursLong : cfg.breakHoursShort;
            hours[day.dateString] = Math.max(0, rawHours - breakTime);
          }
        } else {
          hours[day.dateString] = 0;
        }
      } else {
        hours[day.dateString] = (day.isSunday || day.isSaturday) ? 0 : Math.max(0, cfg.workdayHours - reduction);
      }
    });
    return hours;
  }, [schedule, daysInMonth, capInfo, cfg.workdayHours, cfg.halfDayHours, cfg.weekendMultiplier, cfg.enableWeekendBonus, cfg.breakHoursShort, cfg.breakHoursLong, cfg.longWorkThreshold]);

  const totalHours = useMemo(
    () => Object.values(dailyHours).reduce((sum: number, h: number) => sum + h, 0),
    [dailyHours]
  );

  const todayDateString = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const targetMonthlyHours = capInfo.target;

  const hoursDifference = totalHours - targetMonthlyHours;

  /**
   * "지금 출근/퇴근" 1-탭 기록 안내.
   * - 평일이고 오늘 날짜가 현재 보고 있는 월에 속할 때만
   * - 휴일/휴가/패밀리/반차 유형이면 안 띄움
   * - 출근 시간대(07-10시)에 start 미입력
   * - 퇴근 시간대(16-22시)에 end 미입력
   * - 닫기 누르면 새로고침 전까지 다시 안 뜸
   */
  const nowPrompt = useMemo(() => {
    if (nowPromptDismissed || !isDataLoaded) return null;
    if (!todayDateString.startsWith(selectedMonth)) return null;
    const now = new Date();
    const dow = now.getDay();
    if (dow === 0 || dow === 6) return null;

    const today = schedule[todayDateString];
    if (today?.type && today.type !== 'normal') return null;

    const total = now.getHours() * 60 + now.getMinutes();
    const rounded = Math.round(total / 30) * 30;
    const h = Math.floor(rounded / 60) % 24;
    const m = rounded % 60;
    const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    const hour = now.getHours();
    if (hour >= 7 && hour <= 10 && !today?.start) return { kind: 'start' as const, time };
    if (hour >= 16 && hour <= 22 && !today?.end) return { kind: 'end' as const, time };
    return null;
  }, [todayDateString, schedule, isDataLoaded, selectedMonth, nowPromptDismissed]);

  const acceptNowPrompt = () => {
    if (!nowPrompt) return;
    handleTimeChange(todayDateString, nowPrompt.kind, nowPrompt.time);
    setNowPromptDismissed(true);
  };

  /**
   * 부족 시간 단계별 색상 (점점 진한 빨강).
   *  - 1 ≤ 부족 ≤ 3: 단계 1 (옅은 빨강)
   *  - 3 < 부족 ≤ 5: 단계 2 (중간 빨강)
   *  - 5 < 부족 ≤ 8: 단계 3 (진한 빨강)
   *  - 8 초과:        단계 4 (가장 진한 빨강 + pulse)
   *  - 0~1 미만:      차감 무시 (회색)
   *  - 초과(+):       에메랄드
   */
  const deficit = -hoursDifference; // 양수면 부족 시간
  const diffStyle = useMemo<React.CSSProperties>(() => {
    if (deficit < 1) return {};
    if (deficit <= 3) return { color: 'hsl(0, 60%, 70%)' };
    if (deficit <= 5) return { color: 'hsl(0, 72%, 60%)' };
    if (deficit <= 8) return { color: 'hsl(0, 82%, 52%)' };
    return { color: 'hsl(0, 92%, 45%)' };
  }, [deficit]);
  const diffWeight = deficit > 8 ? 'font-extrabold' : 'font-bold';
  const diffPulse = deficit > 8 ? 'animate-pulse' : '';

  /** 월말 회고 통계 */
  const recap = useMemo(() => {
    const fmtMin = (m: number) => {
      const h = Math.floor(m / 60);
      const mm = Math.round(m % 60);
      return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    };

    const startMins: number[] = [];
    const endMins: number[] = [];
    let overtimeDays = 0;
    let earliestStart: { date: string; time: string; total: number } | null = null;
    let latestEnd: { date: string; time: string; total: number } | null = null;
    const counts = { holiday: 0, vacation: 0, family: 0, halfDay: 0 };

    daysInMonth.forEach(d => {
      const e = schedule[d.dateString];
      if (!e) return;
      if (e.type === 'holiday') counts.holiday++;
      else if (e.type === 'vacation') counts.vacation++;
      else if (e.type === 'family') counts.family++;
      else if (e.type === 'half-day') counts.halfDay++;

      if (e.start) {
        const [h, m] = e.start.split(':').map(Number);
        const total = h * 60 + m;
        startMins.push(total);
        if (!earliestStart || total < earliestStart.total) {
          earliestStart = { date: d.dateString, time: e.start, total };
        }
      }
      if (e.end) {
        const [h, m] = e.end.split(':').map(Number);
        const total = h * 60 + m;
        endMins.push(total);
        if (!latestEnd || total > latestEnd.total) {
          latestEnd = { date: d.dateString, time: e.end, total };
        }
        if (total >= 18 * 60) overtimeDays++;
      }
    });

    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

    // 주차 합계 — 월의 첫째 일요일 기준
    const weekMap = new Map<number, number>();
    daysInMonth.forEach(d => {
      const dt = new Date(d.dateString + 'T00:00:00');
      const day1 = new Date(dt.getFullYear(), dt.getMonth(), 1);
      const offset = day1.getDay();
      const weekIdx = Math.floor((dt.getDate() + offset - 1) / 7);
      weekMap.set(weekIdx, (weekMap.get(weekIdx) || 0) + (dailyHours[d.dateString] || 0));
    });
    const weekly = Array.from(weekMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([idx, h]) => ({ label: `${idx + 1}주차`, hours: Math.round(h * 10) / 10 }));

    // 요일별 평균 — 실제 입력된 평일만
    const dowBuckets: number[][] = [[], [], [], [], [], [], []];
    daysInMonth.forEach(d => {
      const dt = new Date(d.dateString + 'T00:00:00');
      const dow = dt.getDay();
      const e = schedule[d.dateString];
      if (e?.start && e?.end) {
        const h = dailyHours[d.dateString] || 0;
        if (h > 0) dowBuckets[dow].push(h);
      }
    });
    const dowAvg = dowBuckets.map(arr =>
      arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0
    );

    // 연속 출근 streak (start+end 모두 입력된 날)
    let maxStreak = 0;
    let curStreak = 0;
    [...daysInMonth].forEach(d => {
      const e = schedule[d.dateString];
      if (e?.start && e?.end) {
        curStreak++;
        maxStreak = Math.max(maxStreak, curStreak);
      } else {
        curStreak = 0;
      }
    });

    const enteredDays = daysInMonth.filter(d => {
      const e = schedule[d.dateString];
      return e?.start && e?.end;
    }).length;

    return {
      fmtMin,
      avgStart: avg(startMins),
      avgEnd: avg(endMins),
      overtimeDays,
      counts,
      weekly,
      dowAvg,
      earliestStart: earliestStart as null | { date: string; time: string; total: number },
      latestEnd: latestEnd as null | { date: string; time: string; total: number },
      maxStreak,
      enteredDays,
    };
  }, [daysInMonth, schedule, dailyHours]);

  const renderSyncBadge = () => {
    if (!drive.isEnabled()) {
      return (
        <span className="flex items-center gap-1 text-xs text-indigo-200">
          <CloudOff className="w-3.5 h-3.5" /> 로컬 전용
        </span>
      );
    }
    if (driveStatus === 'signed-out') {
      return (
        <span className="flex items-center gap-1 text-xs text-amber-200">
          <CloudOff className="w-3.5 h-3.5" /> Drive 미연결
        </span>
      );
    }
    // 'expired'는 사용자에게 안 보임 — 백그라운드에서 자동 silent refresh 시도
    if (syncState === 'syncing') {
      return (
        <span className="flex items-center gap-1 text-xs text-indigo-100">
          <div className="w-3 h-3 border-2 border-indigo-200 border-t-white rounded-full animate-spin" />
          동기화 중
        </span>
      );
    }
    if (syncState === 'error') {
      return (
        <span className="flex items-center gap-1 text-xs text-rose-200">
          <AlertCircle className="w-3.5 h-3.5" /> 동기화 실패
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-200">
        <Cloud className="w-3.5 h-3.5" /> Drive 동기화 중
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-[max(env(safe-area-inset-top),1rem)] pb-8 px-4 sm:px-6 lg:px-8 font-sans">
      {(ptrDistance > 0 || ptrRefreshing) && (
        <div
          className={`ptr-indicator ${ptrRefreshing ? 'refreshing' : ''}`}
          style={{
            transform: `translate(-50%, ${ptrRefreshing ? 30 : ptrDistance - 50}px) rotate(${ptrRefreshing ? 0 : ptrDistance * 3}deg)`,
            opacity: Math.min(1, ptrDistance / 60),
          }}
        >
          <RotateCcw className="w-5 h-5 text-indigo-600" />
        </div>
      )}

      {showRecap && (() => {
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const maxWeekly = Math.max(...recap.weekly.map(w => w.hours), 1);
        const maxDow = Math.max(...recap.dowAvg, 1);
        const fmtDate = (d: string) => {
          const dt = new Date(d + 'T00:00:00');
          return `${dt.getMonth() + 1}/${dt.getDate()} (${dayNames[dt.getDay()]})`;
        };
        return (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6 animate-[fadeIn_0.2s_ease-out]"
            onClick={() => setShowRecap(false)}
          >
            <div
              className="help-modal w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <div className="sticky top-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-500 text-white px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  <h2 className="text-lg font-bold">{selectedMonth} 회고</h2>
                </div>
                <button onClick={() => setShowRecap(false)} className="p-1.5 hover:bg-white/20 rounded-lg" aria-label="닫기">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-5 py-5 space-y-6 text-sm">
                {/* 핵심 숫자 카드 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl bg-indigo-50 p-3">
                    <div className="text-xs text-indigo-700 mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> 누적</div>
                    <div className="text-xl font-bold num text-indigo-900">{totalHours}<span className="text-xs font-medium ml-0.5">h</span></div>
                    <div className="text-[10px] text-indigo-600 mt-0.5">목표 {targetMonthlyHours}h</div>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-3">
                    <div className="text-xs text-amber-700 mb-1 flex items-center gap-1"><Coffee className="w-3 h-3" /> 야근</div>
                    <div className="text-xl font-bold num text-amber-900">{recap.overtimeDays}<span className="text-xs font-medium ml-0.5">일</span></div>
                    <div className="text-[10px] text-amber-600 mt-0.5">퇴근 18시 이후</div>
                  </div>
                  <div className="rounded-xl bg-emerald-50 p-3">
                    <div className="text-xs text-emerald-700 mb-1 flex items-center gap-1"><Award className="w-3 h-3" /> 연속 출근</div>
                    <div className="text-xl font-bold num text-emerald-900">{recap.maxStreak}<span className="text-xs font-medium ml-0.5">일</span></div>
                    <div className="text-[10px] text-emerald-600 mt-0.5">최장 streak</div>
                  </div>
                  <div className="rounded-xl bg-sky-50 p-3">
                    <div className="text-xs text-sky-700 mb-1 flex items-center gap-1"><Sunrise className="w-3 h-3" /> 평균 출근</div>
                    <div className="text-xl font-bold num text-sky-900">{recap.avgStart > 0 ? recap.fmtMin(recap.avgStart) : '-'}</div>
                  </div>
                  <div className="rounded-xl bg-rose-50 p-3">
                    <div className="text-xs text-rose-700 mb-1 flex items-center gap-1"><Sunset className="w-3 h-3" /> 평균 퇴근</div>
                    <div className="text-xl font-bold num text-rose-900">{recap.avgEnd > 0 ? recap.fmtMin(recap.avgEnd) : '-'}</div>
                  </div>
                  <div className="rounded-xl bg-purple-50 p-3">
                    <div className="text-xs text-purple-700 mb-1">기록 일수</div>
                    <div className="text-xl font-bold num text-purple-900">{recap.enteredDays}<span className="text-xs font-medium ml-0.5">일</span></div>
                    <div className="text-[10px] text-purple-600 mt-0.5">출/퇴근 모두 입력</div>
                  </div>
                </div>

                {/* 휴일/휴가 */}
                <div className="rounded-xl border border-gray-100 p-3">
                  <div className="text-xs font-bold text-gray-500 mb-2">휴일 · 휴가</div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div><div className="text-lg font-bold num">{recap.counts.holiday}</div><div className="text-[10px] text-gray-500">공휴일</div></div>
                    <div><div className="text-lg font-bold num">{recap.counts.vacation}</div><div className="text-[10px] text-gray-500">휴가</div></div>
                    <div><div className="text-lg font-bold num">{recap.counts.family}</div><div className="text-[10px] text-gray-500">패밀리데이</div></div>
                    <div><div className="text-lg font-bold num">{recap.counts.halfDay}</div><div className="text-[10px] text-gray-500">반차</div></div>
                  </div>
                </div>

                {/* 주별 막대 차트 */}
                <div>
                  <div className="text-xs font-bold text-gray-500 mb-2">주별 누적 시간</div>
                  <div className="flex items-end gap-2 px-1">
                    {recap.weekly.map((w, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] num text-gray-600">{w.hours}h</span>
                        <div
                          className="w-full bg-gradient-to-t from-indigo-500 to-purple-400 rounded-t-md"
                          style={{ height: `${Math.max(4, (w.hours / maxWeekly) * 96)}px` }}
                        />
                        <span className="text-[10px] text-gray-500">{w.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 요일별 평균 */}
                <div>
                  <div className="text-xs font-bold text-gray-500 mb-2">요일별 평균 근무 시간</div>
                  <div className="space-y-1.5">
                    {[1, 2, 3, 4, 5].map(dow => (
                      <div key={dow} className="flex items-center gap-2">
                        <div className="w-6 text-xs text-gray-600 font-medium">{dayNames[dow]}</div>
                        <div className="flex-1 bg-gray-100 rounded h-5 relative overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-400 to-purple-400 rounded"
                            style={{ width: `${(recap.dowAvg[dow] / maxDow) * 100}%` }}
                          />
                          <span className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] num font-bold text-gray-700">
                            {recap.dowAvg[dow] > 0 ? `${recap.dowAvg[dow]}h` : '-'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 기록 */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-yellow-50 p-3">
                    <div className="text-xs text-yellow-700 mb-1">가장 빠른 출근</div>
                    <div className="text-base font-bold num text-yellow-900">{recap.earliestStart ? recap.earliestStart.time : '-'}</div>
                    <div className="text-[10px] text-yellow-600 mt-0.5">{recap.earliestStart ? fmtDate(recap.earliestStart.date) : ''}</div>
                  </div>
                  <div className="rounded-xl bg-orange-50 p-3">
                    <div className="text-xs text-orange-700 mb-1">가장 늦은 퇴근</div>
                    <div className="text-base font-bold num text-orange-900">{recap.latestEnd ? recap.latestEnd.time : '-'}</div>
                    <div className="text-[10px] text-orange-600 mt-0.5">{recap.latestEnd ? fmtDate(recap.latestEnd.date) : ''}</div>
                  </div>
                </div>

                {recap.enteredDays === 0 && (
                  <div className="text-center text-gray-400 text-xs py-4">
                    아직 기록된 데이터가 없습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {showAdminSettings && (
        <AdminSettings
          cfg={cfg}
          onSave={(next) => { setCfg(next); saveConfig(next); }}
          onClose={() => setShowAdminSettings(false)}
        />
      )}

      {showHelp && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6 animate-[fadeIn_0.2s_ease-out]"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="help-modal w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-500 text-white px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5" />
                <h2 className="text-lg font-bold">사용 설명서</h2>
              </div>
              <button onClick={() => setShowHelp(false)} className="p-1.5 hover:bg-white/20 rounded-lg" aria-label="닫기">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-6 text-sm leading-relaxed text-gray-700">
              <Manual />
            </div>
          </div>
        </div>
      )}
      {showIntro && (
        <div className="max-w-3xl mx-auto mb-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-900 shadow">
          <div className="font-bold mb-1.5 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            iOS 사용자 안내
          </div>
          <ul className="list-disc pl-5 space-y-1 text-amber-800">
            <li><b>홈 화면에 추가</b>를 권장합니다 — Safari 공유 버튼 → "홈 화면에 추가". 그래야 데이터가 자동 삭제되지 않습니다.</li>
            <li>여러 기기 사이 동기화·영구 백업이 필요하면 우측 상단 <b>Google 로그인</b>을 켜주세요.</li>
          </ul>
          <button
            onClick={dismissIntro}
            className="mt-3 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg"
          >
            확인
          </button>
        </div>
      )}
      <div className="max-w-3xl mx-auto relative pb-32">
        <div className="bg-white shadow-xl rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-500 px-4 py-6 md:px-8 md:py-10 text-white flex flex-col md:flex-row md:items-center justify-between gap-5 md:gap-6">
            <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-10 w-72 h-72 bg-fuchsia-300/20 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-start md:items-center gap-3 md:gap-4">
              <div className="p-2 md:p-3 glass rounded-xl shrink-0 animate-float">
                <Calendar className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold truncate">{(() => {
                  const now = new Date();
                  const today = schedule[todayDateString];
                  // 1. 오늘이 공휴일이면 공휴일 이름 표시
                  const holidayName = holidays[todayDateString];
                  if (holidayName) return `${holidayName} 🎉`;
                  // 2. 휴가 / 패밀리데이는 유형 우선
                  if (today?.type === 'vacation') return '즐거운 휴가 🏖️';
                  if (today?.type === 'family') return '패밀리데이 💕';
                  // 3. 토/일은 쉬는 날
                  const dow = now.getDay();
                  if (dow === 0 || dow === 6) return '오늘은 쉬는 날 😁';
                  // 4. 평일 — 기존 카운트다운 로직
                  const endStr = today?.end;
                  if (endStr) {
                    const [eh, em] = endStr.split(':').map(Number);
                    const endDate = new Date(now);
                    endDate.setHours(eh, em, 0, 0);
                    if (now >= endDate) return '퇴근 💕';
                    const totalMin = Math.ceil((endDate.getTime() - now.getTime()) / 60000);
                    const h = Math.floor(totalMin / 60);
                    const m = totalMin % 60;
                    const remain = h > 0 && m > 0 ? `${h}시간 ${m}분` : h > 0 ? `${h}시간` : `${m}분`;
                    return `퇴근까지 ${remain} 남았어요 🤗`;
                  }
                  return '오늘도 출근! 💪🏻';
                })()}</h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {renderSyncBadge()}
                  {cfg.companyName && (
                    <span className="bg-indigo-800/50 px-2 py-0.5 rounded text-[10px] md:text-xs break-keep">
                      {cfg.companyName}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 w-full md:w-auto mt-2 md:mt-0 shrink-0">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="glass text-white rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-white/50 w-auto max-w-full font-bold cursor-pointer text-base text-center self-start md:self-end"
              />
              <div className="flex items-center gap-2 flex-wrap">
                {drive.isEnabled() && driveStatus === 'signed-out' && (
                  <button
                    onClick={handleSignIn}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-indigo-700 hover:bg-indigo-50 rounded-lg text-xs font-bold transition-colors"
                  >
                    <LogIn className="w-3.5 h-3.5" /> Google 로그인
                  </button>
                )}
                {drive.isEnabled() && (driveStatus === 'signed-in' || driveStatus === 'expired') && user && (
                  <div className="flex items-center gap-2 px-2 py-1 bg-indigo-800/50 rounded-lg">
                    {user.picture ? (
                      <img src={user.picture} className="w-5 h-5 rounded-full" alt="" />
                    ) : (
                      <UserIcon className="w-4 h-4" />
                    )}
                    <span className="text-xs truncate max-w-[140px]" title={user.email}>{user.email || user.name}</span>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-1 text-indigo-100 hover:text-white hover:bg-white/10 rounded-md px-1.5 py-0.5 transition-colors"
                      title="Google 로그아웃 (확인 후 진행)"
                      aria-label="로그아웃"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span className="text-[11px] font-medium">로그아웃</span>
                    </button>
                  </div>
                )}
                {(() => {
                  const Icon = themeMeta[theme].icon;
                  const next = themeOrder[(themeOrder.indexOf(theme) + 1) % themeOrder.length];
                  return (
                    <button
                      onClick={cycleTheme}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-800/50 hover:bg-indigo-800 rounded-lg text-xs font-medium transition-colors"
                      title={`현재: ${themeMeta[theme].label} → 클릭하면 ${themeMeta[next].label}`}
                      aria-label="테마 전환"
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  );
                })()}
                {(user?.email || '').trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() && (
                  <>
                    <button
                      onClick={() => setShowAdminSettings(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-800/50 hover:bg-indigo-800 rounded-lg text-xs font-medium transition-colors"
                      title="회사 정책 설정 (관리자 전용)"
                      aria-label="관리자 설정"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                    <a
                      href={ADD_USER_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-800/50 hover:bg-indigo-800 rounded-lg text-xs font-medium transition-colors"
                      title="Google Cloud Console에서 테스트 사용자 Gmail 추가 (관리자 전용)"
                      aria-label="사용자 추가"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                    </a>
                  </>
                )}
                <button
                  onClick={() => setShowRecap(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-800/50 hover:bg-indigo-800 rounded-lg text-xs font-medium transition-colors"
                  title="이번 달 회고"
                  aria-label="이번 달 회고"
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setShowHelp(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-800/50 hover:bg-indigo-800 rounded-lg text-xs font-medium transition-colors"
                  title="사용 설명서"
                  aria-label="사용 설명서"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Save Action */}
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              isSaving ? 'text-indigo-600' : isDirty ? 'text-amber-500' : 'text-emerald-600'
            }`}>
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                  <span>저장 중...</span>
                </>
              ) : isDirty ? (
                <>
                  <Clock className="w-4 h-4 animate-pulse" />
                  <span>저장 대기 중...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>모든 변경사항 저장됨</span>
                </>
              )}
            </div>
            <AnimatePresence>
              {saveStatus === 'error' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-2 text-sm font-bold text-rose-600"
                >
                  <AlertCircle className="w-4 h-4" />
                  저장 실패
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Content */}
          <div className="px-4 py-4 sm:p-6">
            <div className="space-y-2">
              {!isDataLoaded && Array.from({ length: 8 }).map((_, i) => (
                <div key={`sk-${i}`} className="h-20 rounded-xl bg-gray-100 animate-pulse" />
              ))}
              {isDataLoaded && daysInMonth.map((day) => {
                const isWeekend = day.isSunday || day.isSaturday;
                const type = schedule[day.dateString]?.type || 'normal';
                const isHolidayOrWeekend = isWeekend || type === 'holiday';
                const isSpecialLeave = type === 'vacation' || type === 'family' || type === 'half-day';
                const isToday = day.dateString === todayDateString;

                let dayColor = 'text-gray-700';
                // 평일별 도트 색상 다양화 (월·화·수·목·금)
                const weekdayDots = ['', 'bg-indigo-400', 'bg-sky-400', 'bg-teal-400', 'bg-emerald-400', 'bg-violet-500', ''];
                const dow = new Date(day.dateString + 'T00:00:00').getDay();
                let dotColor = weekdayDots[dow] || 'bg-indigo-400';

                if (isSpecialLeave) {
                  dayColor = 'text-pink-500';
                  dotColor = 'bg-pink-400';
                } else if (isHolidayOrWeekend) {
                  dayColor = 'text-red-500';
                  dotColor = 'bg-red-400';
                }

                const bgColor = isToday
                  ? 'bg-indigo-50/50'
                  : (isWeekend ? 'bg-gray-50/80' : 'bg-white');
                const borderColor = isToday
                  ? 'border-indigo-300 ring-2 ring-indigo-400/30 shadow-indigo-200/50'
                  : 'border-gray-100';
                const stripeColor = isSpecialLeave
                  ? 'bg-gradient-to-b from-pink-400 to-rose-400'
                  : isHolidayOrWeekend
                  ? 'bg-gradient-to-b from-red-400 to-rose-400'
                  : isToday
                  ? 'bg-gradient-to-b from-indigo-500 to-purple-500'
                  : 'bg-gradient-to-b from-indigo-300 to-indigo-200';

                const showPattern = isToday || (isHolidayOrWeekend && type === 'holiday');
                const isFlash = flashedDate === day.dateString;
                return (
                  <React.Fragment key={day.dateString}>
                    {isToday && nowPrompt && (
                      <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm">
                        <div className="min-w-0">
                          <div className="font-bold text-indigo-900 text-sm mb-0.5">
                            {nowPrompt.kind === 'start' ? '지금 출근하셨나요?' : '지금 퇴근하시나요?'}
                          </div>
                          <div className="text-xs text-indigo-700">
                            현재 시각을 30분 단위로 반올림해 <b>{nowPrompt.time}</b>으로 기록합니다.
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={acceptNowPrompt}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold px-3 sm:px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
                          >
                            {nowPrompt.time} 기록
                          </button>
                          <button
                            onClick={() => setNowPromptDismissed(true)}
                            className="text-gray-500 hover:text-gray-700 text-xs sm:text-sm px-2 py-2"
                            aria-label="닫기"
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    )}
                  <div
                    ref={isToday ? todayRef : null}
                    className={`shimmer-card relative overflow-hidden flex flex-col sm:flex-row sm:items-center gap-3 p-3 pl-4 rounded-xl border transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 ${bgColor} ${borderColor} ${isToday ? 'z-10 relative shadow-lg' : ''} ${isFlash ? 'animate-flash' : ''}`}
                  >
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${stripeColor}`} />
                    {showPattern && (
                      <div className={`bg-dots absolute inset-0 ${isToday ? 'text-indigo-500' : 'text-red-500'}`} />
                    )}
                    <div className={`sm:w-44 font-medium flex items-center flex-wrap gap-x-2 gap-y-1 ${dayColor}`}>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`}></span>
                      <span className="flex-shrink-0">{day.dayNumber}일 ({day.dayName})</span>
                      {holidays[day.dateString] && (
                        <span className="text-[10px] text-red-500 font-bold px-1.5 py-0.5 bg-red-50 rounded-md whitespace-nowrap">{holidays[day.dateString]}</span>
                      )}
                      {isToday && (
                        <span className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[10px] px-1.5 py-0.5 rounded-md font-bold animate-pulse whitespace-nowrap shadow-sm shadow-indigo-500/30">오늘</span>
                      )}
                      {!isWeekend && type === 'normal' && (
                        <span className="flex items-center gap-1 ml-auto">
                          <button
                            onClick={() => copyFromDate(day.dateString, dateOffset(day.dateString, 1), '어제')}
                            className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
                            title="어제와 동일하게 입력 (확인 후 진행)"
                            aria-label="어제와 동일"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => copyFromDate(day.dateString, dateOffset(day.dateString, 7), '지난주 같은 요일')}
                            className="p-1 rounded text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
                            title="지난주 같은 요일과 동일하게 입력 (확인 후 진행)"
                            aria-label="지난주 같은 요일과 동일"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      )}
                    </div>

                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="col-span-2 sm:col-span-1">
                        <label className="block text-[10px] font-medium text-gray-400 mb-0.5 uppercase tracking-wider">근무 유형</label>
                        <select
                          value={schedule[day.dateString]?.type || 'normal'}
                          onChange={(e) => handleTimeChange(day.dateString, 'type', e.target.value as any)}
                          className="block w-full pl-2 pr-8 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md bg-white border appearance-none cursor-pointer"
                        >
                          <option value="normal">일반 근무</option>
                          {cfg.enableFamilyDay && new Date(day.dateString + 'T00:00:00').getDay() === cfg.familyDayDow && <option value="family">패밀리데이</option>}
                          <option value="holiday">공휴일</option>
                          <option value="vacation">휴가</option>
                          {cfg.enableHalfDay && !isWeekend && <option value="half-day">반차</option>}
                        </select>
                      </div>

                      <div className={`${(type === 'half-day' || type === 'family') ? 'sm:col-span-2' : ''} ${schedule[day.dateString]?.type === 'holiday' || schedule[day.dateString]?.type === 'vacation' ? 'opacity-30 pointer-events-none' : ''}`}>
                        <label className="block text-[10px] font-medium text-gray-400 mb-0.5 uppercase tracking-wider">출근 시간</label>
                        <div className="relative">
                          <select
                            value={schedule[day.dateString]?.start || ''}
                            onChange={(e) => handleTimeChange(day.dateString, 'start', e.target.value)}
                            className={`block w-full pl-2 pr-8 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md bg-white border appearance-none cursor-pointer ${!schedule[day.dateString]?.start && type === 'normal' && !isWeekend ? 'hint-empty' : ''}`}
                          >
                            <option value="">선택</option>
                            {(type === 'half-day' ? halfDayTimes : (isWeekend ? weekendTimes : startTimes)).map(time => (
                              <option key={time} value={time}>{time}</option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                            <Clock className="h-4 w-4" />
                          </div>
                        </div>
                      </div>

                      {type !== 'half-day' && type !== 'family' && (
                        <div className={type !== 'normal' ? 'opacity-30 pointer-events-none' : ''}>
                          <label className="block text-[10px] font-medium text-gray-400 mb-0.5 uppercase tracking-wider">퇴근 시간</label>
                          <div className="relative">
                            <select
                              value={schedule[day.dateString]?.end || ''}
                              onChange={(e) => handleTimeChange(day.dateString, 'end', e.target.value)}
                              disabled={type === 'family'}
                              className={`block w-full pl-2 pr-8 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md bg-white border appearance-none cursor-pointer disabled:bg-gray-50 disabled:text-gray-500 ${!schedule[day.dateString]?.end && type === 'normal' && !isWeekend ? 'hint-empty' : ''}`}
                            >
                              <option value="">선택</option>
                              {(isWeekend ? weekendTimes : endTimes).map(time => (
                                <option key={time} value={time}>{time}</option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                              <Clock className="h-4 w-4" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="w-24 text-right sm:text-center">
                      <div className="text-[10px] font-medium text-gray-400 mb-0.5 sm:hidden uppercase tracking-wider">근무 시간</div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        schedule[day.dateString]?.start && schedule[day.dateString]?.end
                          ? 'bg-indigo-100 text-indigo-800'
                          : (dailyHours[day.dateString] > 0 ? 'bg-gray-100 text-gray-500' : 'bg-gray-100 text-gray-400')
                      }`}>
                        {schedule[day.dateString]?.start && schedule[day.dateString]?.end
                          ? `${dailyHours[day.dateString]}시간`
                          : (dailyHours[day.dateString] > 0 ? `기본 ${dailyHours[day.dateString]}시간` : '-')}
                      </span>
                    </div>
                  </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* Version footer — 항상 표시, 매 push마다 자동 갱신 */}
        <div className="mt-6 text-center text-[11px] text-gray-400 num">
          v{__APP_BUILD_DATE__} · <span className="font-mono">{__APP_VERSION__}</span>
        </div>

        {/* Sticky Summary */}
        <div
          className="fixed bottom-0 left-0 right-0 p-4 sm:p-6 pointer-events-none flex justify-center z-10"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}
        >
          <div className="w-full max-w-3xl pointer-events-auto">
            <div className="relative overflow-hidden flex flex-col app-sticky-bg backdrop-blur-md rounded-2xl p-4 sm:p-6 text-white shadow-2xl border border-indigo-900/40 gap-4">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-lg hidden sm:block">
                    <Calculator className="w-5 h-5 text-indigo-300" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-300">목표 근무 시간 (평일×8h)</span>
                    <span className="text-lg font-medium text-white num"><CountUp value={targetMonthlyHours} />시간</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto justify-between sm:justify-end border-t border-gray-700 sm:border-t-0 pt-3 sm:pt-0">
                <div className="flex flex-col items-end">
                  <span className="text-xs text-gray-300">현재 누적 시간</span>
                  <div className="text-xl sm:text-2xl font-bold text-indigo-200 num">
                    <CountUp value={totalHours} decimals={Number.isInteger(totalHours) ? 0 : 1} /> <span className="text-sm font-medium text-gray-300">시간</span>
                  </div>
                </div>

                <div className="w-px h-10 bg-white/20 hidden sm:block"></div>

                <div className="flex flex-col items-end min-w-[80px]">
                  <span className="text-xs text-gray-300 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 animate-twinkle text-indigo-200" />
                    {hoursDifference > 0 ? '초과' : hoursDifference < 0 ? '부족' : '목표 달성'}
                  </span>
                  <div
                    className={`text-xl sm:text-2xl num ${diffWeight} ${diffPulse} ${
                      hoursDifference > 0 ? 'text-emerald-300' : hoursDifference === 0 ? 'text-gray-200' : ''
                    } transition-colors duration-300`}
                    style={diffStyle}
                  >
                    {hoursDifference > 0 ? '+' : ''}<CountUp value={hoursDifference} decimals={Number.isInteger(hoursDifference) ? 0 : 1} /> <span className="text-sm font-medium text-gray-300">시간</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
