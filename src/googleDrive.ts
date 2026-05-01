// Google Drive (appDataFolder) 동기화 모듈
// - 사용자별 본인 계정의 앱 전용 폴더에 schedule.json 한 파일을 두고 덮어씁니다.
// - 다른 사용자/앱은 이 파일에 접근할 수 없습니다 (drive.appdata 스코프 한정).
// - 토큰은 메모리에만 보관 (1시간 만료). 만료 시 silent re-auth 시도.

import type { AllMonths } from './storage';
import { mergeAll } from './storage';

declare global {
  interface Window {
    google?: any;
  }
}

const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const FILE_NAME = 'schedule.json';

export type DriveStatus = 'disabled' | 'signed-out' | 'signed-in';

export interface UserInfo {
  email?: string;
  name?: string;
  picture?: string;
}

let clientId: string | null = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || null;
let accessToken: string | null = null;
let tokenClient: any = null;
let tokenExpiryMs = 0;
let cachedFileId: string | null = null;
let userInfo: UserInfo | null = null;

// === 세션 영속화 ===
// 페이지 리로드(브라우저 닫고 다시 열기 포함) 시 로그인 풀림 방지를 위해
// 액세스 토큰 + 사용자 정보를 localStorage에 저장. 만료 시 자동 정리.
const SESSION_KEY = 'drive_session_v1';
interface PersistedSession {
  accessToken: string;
  expiryMs: number;
  user: UserInfo | null;
}
const saveSession = () => {
  if (!accessToken || Date.now() >= tokenExpiryMs) return;
  try {
    const data: PersistedSession = { accessToken, expiryMs: tokenExpiryMs, user: userInfo };
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {}
};
const clearSession = () => {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
};
const restoreSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const s = JSON.parse(raw) as PersistedSession;
    if (s && s.accessToken && Date.now() < s.expiryMs) {
      accessToken = s.accessToken;
      tokenExpiryMs = s.expiryMs;
      userInfo = s.user || null;
    } else {
      clearSession();
    }
  } catch {
    clearSession();
  }
};
// 모듈 로드 시 즉시 복원
restoreSession();

// === 자동 토큰 갱신 (만료 5분 전 silent refresh) ===
// 사용자가 매 시간 다시 로그인하지 않도록 백그라운드에서 새 토큰을 받아둠.
// 사용자가 Google에 여전히 로그인되어 있고 동의를 유지하는 한 클릭 없이 갱신됨.
let refreshTimer: number | null = null;
const scheduleRefresh = () => {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
  if (!accessToken || !tokenExpiryMs) return;
  const ms = tokenExpiryMs - Date.now() - 5 * 60 * 1000;
  if (ms <= 0) return; // 이미 곧 만료 — 다음 ensureToken 시 자동 처리
  refreshTimer = window.setTimeout(async () => {
    try {
      await requestToken('');
    } catch (e) {
      console.warn('Silent token refresh failed; will retry on next API call.', e);
      // 실패 시 다음 API 호출 때 prompt 띄우거나 사용자 클릭 유도
    }
  }, ms);
};
// 복원된 세션이 있으면 즉시 갱신 스케줄
if (accessToken) {
  // 모듈 init 직후엔 window.setTimeout 사용 가능 (브라우저 환경 가정)
  setTimeout(scheduleRefresh, 0);
}

export const isEnabled = () => !!clientId;

const waitForGoogle = () =>
  new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const start = Date.now();
    const t = setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        clearInterval(t);
        resolve();
      } else if (Date.now() - start > 10000) {
        clearInterval(t);
        reject(new Error('Google Identity Services failed to load'));
      }
    }, 100);
  });

const ensureTokenClient = async () => {
  if (tokenClient) return;
  await waitForGoogle();
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPE,
    callback: () => {}, // overridden per-request
  });
};

const requestToken = (prompt: '' | 'consent' = ''): Promise<string> =>
  new Promise(async (resolve, reject) => {
    await ensureTokenClient();
    tokenClient.callback = (resp: any) => {
      if (resp.error) {
        reject(new Error(resp.error));
        return;
      }
      accessToken = resp.access_token;
      tokenExpiryMs = Date.now() + (Number(resp.expires_in || 3600) - 60) * 1000;
      saveSession();
      scheduleRefresh();
      resolve(accessToken!);
    };
    try {
      const args: any = { prompt };
      // silent refresh 시 어떤 계정으로 갱신할지 hint를 주면 성공률이 높아짐
      if (prompt === '' && userInfo?.email) args.hint = userInfo.email;
      tokenClient.requestAccessToken(args);
    } catch (e) {
      reject(e as Error);
    }
  });

const ensureToken = async (): Promise<string> => {
  if (accessToken && Date.now() < tokenExpiryMs) return accessToken;
  return await requestToken('');
};

const fetchUserInfo = async (token: string): Promise<UserInfo | null> => {
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    return (await r.json()) as UserInfo;
  } catch {
    return null;
  }
};

export const signIn = async (): Promise<UserInfo | null> => {
  if (!clientId) throw new Error('Google Client ID가 설정되지 않았습니다.');
  const token = await requestToken('consent');
  userInfo = await fetchUserInfo(token);
  saveSession();
  return userInfo;
};

export const signOut = () => {
  if (accessToken && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(accessToken, () => {});
    } catch {}
  }
  accessToken = null;
  tokenExpiryMs = 0;
  cachedFileId = null;
  clearSession();
  if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
  userInfo = null;
};

export const getStatus = (): DriveStatus => {
  if (!clientId) return 'disabled';
  return accessToken && Date.now() < tokenExpiryMs ? 'signed-in' : 'signed-out';
};

export const getUser = () => userInfo;

const findFileId = async (token: string): Promise<string | null> => {
  if (cachedFileId) return cachedFileId;
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('spaces', 'appDataFolder');
  url.searchParams.set('q', `name='${FILE_NAME}' and trashed=false`);
  url.searchParams.set('fields', 'files(id,name,modifiedTime)');
  const r = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`Drive list failed: ${r.status}`);
  const data = await r.json();
  cachedFileId = data.files?.[0]?.id ?? null;
  return cachedFileId;
};

/** 충돌 보호: Drive에 있는 데이터를 받아 로컬과 병합 후 업로드. 병합본 반환. */
export const syncAll = async (local: AllMonths): Promise<AllMonths> => {
  const remote = await downloadAll();
  const merged = remote ? mergeAll(local, remote) : local;
  await uploadAll(merged);
  return merged;
};

export const downloadAll = async (): Promise<AllMonths | null> => {
  const token = await ensureToken();
  const id = await findFileId(token);
  if (!id) return null;
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`Drive download failed: ${r.status}`);
  return (await r.json()) as AllMonths;
};

export const uploadAll = async (payload: AllMonths): Promise<void> => {
  const token = await ensureToken();
  const body = JSON.stringify(payload);
  const id = await findFileId(token);

  if (id) {
    const r = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body,
      }
    );
    if (!r.ok) throw new Error(`Drive update failed: ${r.status}`);
  } else {
    const boundary = 'wht_boundary_' + Math.random().toString(36).slice(2);
    const metadata = { name: FILE_NAME, parents: ['appDataFolder'] };
    const multipart =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      `\r\n--${boundary}\r\n` +
      'Content-Type: application/json\r\n\r\n' +
      body +
      `\r\n--${boundary}--`;

    const r = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipart,
      }
    );
    if (!r.ok) throw new Error(`Drive create failed: ${r.status}`);
    const data = await r.json();
    cachedFileId = data.id;
  }
};
