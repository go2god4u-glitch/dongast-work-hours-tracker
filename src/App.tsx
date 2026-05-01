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
} from 'lucide-react';

const ADMIN_EMAIL = 'go2god4u@gmail.com';
const ADD_USER_URL = 'https://console.cloud.google.com/auth/audience?project=dongast-work-hours';
import { motion, AnimatePresence } from 'framer-motion';
import { START_TIMES, END_TIMES, WEEKEND_TIMES, HALF_DAY_TIMES } from './constants';
import { loadMonth, saveMonth, exportAll, importAll, MonthSchedule, DayEntry } from './storage';
import { getHolidaysForYear } from './holidays';
import * as drive from './googleDrive';

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
const isStandalone = () =>
  (window.matchMedia('(display-mode: standalone)').matches) ||
  (navigator as any).standalone === true;

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

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {}
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem('theme', theme); } catch {}
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b0b0e' : '#4f46e5');
  }, [theme]);
  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

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

  const pushToDrive = useCallback(async () => {
    if (!drive.isEnabled() || drive.getStatus() !== 'signed-in') return;
    setSyncState('syncing');
    try {
      const local = await exportAll();
      // 충돌 보호: 원격을 받아 일자별로 m(modifiedAt) 더 최근인 쪽이 이기도록 병합
      const merged = await drive.syncAll(local);
      // 병합 결과를 로컬에도 반영
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

  // Auto-save: IndexedDB immediately, Drive debounced
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
        // Drive 업로드 (best-effort, 실패해도 로컬엔 저장됨)
        if (drive.isEnabled() && drive.getStatus() === 'signed-in') {
          pushToDrive();
        }
      } catch (error) {
        console.error('Save failed:', error);
        setSaveStatus('error');
      } finally {
        setIsSaving(false);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [schedule, isDirty, isDataLoaded, selectedMonth, pushToDrive]);

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
      if (t === 'half-day') baseTarget += 4;
      else baseTarget += 8; // normal, family
    });

    const reductions: Record<string, number> = {};
    if (baseTarget <= 171) return { reductions, target: baseTarget };

    let excess = baseTarget - 171;
    const PER_DAY_MAX_CUT = 2; // 8 → 6 최소

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
  }, [daysInMonth, schedule]);

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
        hours[day.dateString] = Math.max(0, 8 - reduction);
        return;
      }
      if (s.type === 'half-day') {
        hours[day.dateString] = Math.max(0, 4 - reduction);
        return;
      }
      const hasInput = s.start && s.end;
      if (hasInput) {
        let rawHours = calculateHours(s.start, s.end);
        if (rawHours > 0) {
          if (day.isSunday || day.isSaturday) {
            hours[day.dateString] = rawHours * 1.5;
          } else {
            const breakTime = rawHours >= 13 ? 1.5 : 1;
            hours[day.dateString] = Math.max(0, rawHours - breakTime);
          }
        } else {
          hours[day.dateString] = 0;
        }
      } else {
        hours[day.dateString] = (day.isSunday || day.isSaturday) ? 0 : Math.max(0, 8 - reduction);
      }
    });
    return hours;
  }, [schedule, daysInMonth, capInfo]);

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

  const progressPercent = useMemo(() => {
    if (targetMonthlyHours <= 0) return 0;
    return Math.min(100, (totalHours / targetMonthlyHours) * 100);
  }, [totalHours, targetMonthlyHours]);

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
          <div className="bg-indigo-600 px-4 py-6 md:px-8 md:py-10 text-white flex flex-col md:flex-row md:items-center justify-between gap-5 md:gap-6">
            <div className="flex items-start md:items-center gap-3 md:gap-4">
              <div className="p-2 md:p-3 bg-white/20 rounded-xl shrink-0">
                <Calendar className="w-6 h-6 md:w-8 md:h-8 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold truncate">월간 근무 시간 입력</h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {renderSyncBadge()}
                  <span className="bg-indigo-800/50 px-2 py-0.5 rounded text-[10px] md:text-xs break-keep">
                    주중: 휴게시간 차감 / 주말: 1.5배 가산
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 w-full md:w-auto mt-2 md:mt-0 shrink-0">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-indigo-700 text-white border border-indigo-500 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-white/50 w-auto max-w-full font-bold cursor-pointer text-base text-center shadow-sm self-start md:self-end"
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
                {drive.isEnabled() && driveStatus === 'signed-in' && user && (
                  <div className="flex items-center gap-2 px-2 py-1 bg-indigo-800/50 rounded-lg">
                    {user.picture ? (
                      <img src={user.picture} className="w-5 h-5 rounded-full" alt="" />
                    ) : (
                      <UserIcon className="w-4 h-4" />
                    )}
                    <span className="text-xs truncate max-w-[100px]">{user.name || user.email}</span>
                    <a
                      href={ADD_USER_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-200 hover:text-white"
                      title="Google Cloud Console에서 테스트 사용자 Gmail 추가 (관리자 전용 - 권한 없으면 Google이 자동 차단)"
                      aria-label="사용자 추가"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                    </a>
                    <button onClick={handleSignOut} className="text-indigo-200 hover:text-white">
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-800/50 hover:bg-indigo-800 rounded-lg text-xs font-medium transition-colors"
                  title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
                  aria-label="테마 전환"
                >
                  {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
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

          {/* Now-clock prompt */}
          {nowPrompt && (
            <div className="mx-4 mt-4 sm:mx-6 bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm">
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

          {/* Content */}
          <div className="px-4 py-4 sm:p-6">
            <div className="space-y-2">
              {daysInMonth.map((day) => {
                const isWeekend = day.isSunday || day.isSaturday;
                const type = schedule[day.dateString]?.type || 'normal';
                const isHolidayOrWeekend = isWeekend || type === 'holiday';
                const isSpecialLeave = type === 'vacation' || type === 'family' || type === 'half-day';
                const isToday = day.dateString === todayDateString;

                let dayColor = 'text-gray-700';
                let dotColor = 'bg-indigo-400';

                if (isSpecialLeave) {
                  dayColor = 'text-pink-500';
                  dotColor = 'bg-pink-400';
                } else if (isHolidayOrWeekend) {
                  dayColor = 'text-red-500';
                  dotColor = 'bg-red-400';
                }

                const bgColor = isToday ? 'bg-indigo-50/50' : (isWeekend ? 'bg-gray-50/80' : 'bg-white');
                const borderColor = isToday ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-gray-100';

                return (
                  <div
                    key={day.dateString}
                    ref={isToday ? todayRef : null}
                    className={`flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border transition-all shadow-sm ${bgColor} ${borderColor} ${isToday ? 'z-10 relative' : ''}`}
                  >
                    <div className={`sm:w-44 font-medium flex items-center flex-wrap gap-x-2 gap-y-1 ${dayColor}`}>
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`}></span>
                      <span className="flex-shrink-0">{day.dayNumber}일 ({day.dayName})</span>
                      {holidays[day.dateString] && (
                        <span className="text-[10px] text-red-500 font-bold px-1.5 py-0.5 bg-red-50 rounded-md whitespace-nowrap">{holidays[day.dateString]}</span>
                      )}
                      {isToday && (
                        <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-md font-bold animate-pulse whitespace-nowrap">오늘</span>
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
                          {day.isFriday && <option value="family">패밀리데이</option>}
                          <option value="holiday">공휴일</option>
                          <option value="vacation">휴가</option>
                          {!isWeekend && <option value="half-day">반차</option>}
                        </select>
                      </div>

                      <div className={`${(type === 'half-day' || type === 'family') ? 'sm:col-span-2' : ''} ${schedule[day.dateString]?.type === 'holiday' || schedule[day.dateString]?.type === 'vacation' ? 'opacity-30 pointer-events-none' : ''}`}>
                        <label className="block text-[10px] font-medium text-gray-400 mb-0.5 uppercase tracking-wider">출근 시간</label>
                        <div className="relative">
                          <select
                            value={schedule[day.dateString]?.start || ''}
                            onChange={(e) => handleTimeChange(day.dateString, 'start', e.target.value)}
                            className="block w-full pl-2 pr-8 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md bg-white border appearance-none cursor-pointer"
                          >
                            <option value="">선택</option>
                            {(type === 'half-day' ? HALF_DAY_TIMES : (isWeekend ? WEEKEND_TIMES : START_TIMES)).map(time => (
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
                              className="block w-full pl-2 pr-8 py-1.5 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md bg-white border appearance-none cursor-pointer disabled:bg-gray-50 disabled:text-gray-500"
                            >
                              <option value="">선택</option>
                              {(isWeekend ? WEEKEND_TIMES : END_TIMES).map(time => (
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
                );
              })}
            </div>
          </div>
        </div>

        {/* Sticky Summary */}
        <div
          className="fixed bottom-0 left-0 right-0 p-4 sm:p-6 pointer-events-none flex justify-center z-10"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}
        >
          <div className="w-full max-w-3xl pointer-events-auto">
            <div className="flex flex-col bg-gray-900/95 backdrop-blur-md rounded-2xl p-4 sm:p-6 text-white shadow-2xl border border-gray-800 gap-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/10 rounded-lg hidden sm:block">
                    <Calculator className="w-5 h-5 text-indigo-300" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400">목표 근무 시간 (평일×8h)</span>
                    <span className="text-lg font-medium text-gray-200">{targetMonthlyHours}시간</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto justify-between sm:justify-end border-t border-gray-700 sm:border-t-0 pt-3 sm:pt-0">
                <div className="flex flex-col items-end">
                  <span className="text-xs text-gray-400">현재 누적 시간</span>
                  <div className="text-xl sm:text-2xl font-bold text-indigo-300">
                    {totalHours} <span className="text-sm font-medium text-gray-400">시간</span>
                  </div>
                </div>

                <div className="w-px h-10 bg-gray-700 hidden sm:block"></div>

                <div className="flex flex-col items-end min-w-[80px]">
                  <span className="text-xs text-gray-400">초과/부족</span>
                  <div className={`text-xl sm:text-2xl font-bold ${hoursDifference > 0 ? 'text-emerald-400' : hoursDifference < 0 ? 'text-rose-400' : 'text-gray-300'}`}>
                    {hoursDifference > 0 ? '+' : ''}{hoursDifference} <span className="text-sm font-medium text-gray-400">시간</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all duration-500 ${
                    hoursDifference >= 0 ? 'bg-emerald-400' : 'bg-indigo-400'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-xs font-bold text-gray-300 w-12 text-right tabular-nums">
                {Math.round(progressPercent)}%
              </span>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
