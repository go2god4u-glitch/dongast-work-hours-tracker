import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Clock,
  Calendar,
  Calculator,
  CheckCircle2,
  AlertCircle,
  Download,
  Upload,
  Cloud,
  CloudOff,
  LogIn,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { KOREAN_HOLIDAYS, START_TIMES, END_TIMES, WEEKEND_TIMES, HALF_DAY_TIMES } from './constants';
import { loadMonth, saveMonth, exportAll, importAll, MonthSchedule } from './storage';
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
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isDirty, setIsDirty] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [driveStatus, setDriveStatus] = useState<drive.DriveStatus>(drive.getStatus());
  const [user, setUser] = useState<drive.UserInfo | null>(drive.getUser());
  const [syncState, setSyncState] = useState<SyncState>(drive.isEnabled() ? 'idle' : 'offline');
  const todayRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      const all = await exportAll();
      await drive.uploadAll(all);
      setSyncState('synced');
      setTimeout(() => setSyncState('idle'), 1500);
    } catch (e) {
      console.error('Drive push failed', e);
      setSyncState('error');
    }
  }, []);

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
    const holidayDates = daysInMonth.filter(day => KOREAN_HOLIDAYS[day.dateString]);
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
      let newEntry = { ...current, [field]: value };
      if (newEntry.type === 'family' || newEntry.type === 'half-day') {
        newEntry.end = '';
      }
      return { ...prev, [dateString]: newEntry as any };
    });
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

  const handleExport = async () => {
    const all = await exportAll();
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `work-hours-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      await importAll(parsed);
      const fresh = await loadMonth(selectedMonth);
      setSchedule(fresh);
      if (drive.isEnabled() && drive.getStatus() === 'signed-in') {
        pushToDrive();
      }
      alert('백업 파일을 불러왔습니다.');
    } catch (err) {
      alert('파일을 읽지 못했습니다.');
      console.error(err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const dailyHours = useMemo(() => {
    const hours: Record<string, number> = {};
    daysInMonth.forEach(day => {
      const s = schedule[day.dateString] || { start: '', end: '', type: 'normal' };
      if (s.type === 'holiday' || s.type === 'vacation') {
        hours[day.dateString] = 0;
        return;
      }
      if (s.type === 'family') {
        hours[day.dateString] = 8;
        return;
      }
      if (s.type === 'half-day') {
        hours[day.dateString] = 4;
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
        hours[day.dateString] = (day.isSunday || day.isSaturday) ? 0 : 8;
      }
    });
    return hours;
  }, [schedule, daysInMonth]);

  const totalHours = useMemo(
    () => Object.values(dailyHours).reduce((sum: number, h: number) => sum + h, 0),
    [dailyHours]
  );

  const todayDateString = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const targetMonthlyHours = useMemo(() => {
    let target = 0;
    daysInMonth.forEach(day => {
      if (!day.isSunday && !day.isSaturday) {
        const s = schedule[day.dateString];
        if (s?.type === 'holiday' || s?.type === 'vacation') {
          // skip
        } else if (s?.type === 'family') {
          target += 8;
        } else if (s?.type === 'half-day') {
          target += 4;
        } else {
          target += 8;
        }
      }
    });
    return target;
  }, [daysInMonth, schedule]);

  const hoursDifference = totalHours - targetMonthlyHours;

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
                    <button onClick={handleSignOut} className="text-indigo-200 hover:text-white">
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <button
                  onClick={handleExport}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-800/50 hover:bg-indigo-800 rounded-lg text-xs font-medium transition-colors"
                  title="모든 월 데이터 백업 다운로드"
                >
                  <Download className="w-3.5 h-3.5" /> 백업
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-800/50 hover:bg-indigo-800 rounded-lg text-xs font-medium transition-colors"
                  title="백업 파일에서 복원"
                >
                  <Upload className="w-3.5 h-3.5" /> 복원
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={handleImport}
                />
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
                      {KOREAN_HOLIDAYS[day.dateString] && (
                        <span className="text-[10px] text-red-500 font-bold px-1.5 py-0.5 bg-red-50 rounded-md whitespace-nowrap">{KOREAN_HOLIDAYS[day.dateString]}</span>
                      )}
                      {isToday && (
                        <span className="bg-indigo-600 text-white text-[10px] px-1.5 py-0.5 rounded-md font-bold animate-pulse whitespace-nowrap">오늘</span>
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
            <div className="flex flex-col sm:flex-row items-center justify-between bg-gray-900/95 backdrop-blur-md rounded-2xl p-4 sm:p-6 text-white shadow-2xl border border-gray-800 gap-4">
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
          </div>
        </div>
      </div>
    </div>
  );
}
