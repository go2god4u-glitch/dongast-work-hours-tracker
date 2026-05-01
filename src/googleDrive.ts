// Google Drive (appDataFolder) 동기화 모듈
// - 사용자별 본인 계정의 앱 전용 폴더에 schedule.json 한 파일을 두고 덮어씁니다.
// - 다른 사용자/앱은 이 파일에 접근할 수 없습니다 (drive.appdata 스코프 한정).
// - 토큰은 메모리에만 보관 (1시간 만료). 만료 시 silent re-auth 시도.

import type { MonthSchedule } from './storage';

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
      resolve(accessToken!);
    };
    try {
      tokenClient.requestAccessToken({ prompt });
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

export const downloadAll = async (): Promise<Record<string, MonthSchedule> | null> => {
  const token = await ensureToken();
  const id = await findFileId(token);
  if (!id) return null;
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`Drive download failed: ${r.status}`);
  return (await r.json()) as Record<string, MonthSchedule>;
};

export const uploadAll = async (payload: Record<string, MonthSchedule>): Promise<void> => {
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
