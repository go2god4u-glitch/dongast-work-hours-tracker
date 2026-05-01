import { get, set, del, keys } from 'idb-keyval';

export type DayType = 'normal' | 'holiday' | 'vacation' | 'family' | 'half-day';
export interface DayEntry {
  start: string;
  end: string;
  type: DayType;
}
export type MonthSchedule = Record<string, DayEntry>;

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

export const exportAll = async (): Promise<Record<string, MonthSchedule>> => {
  const allKeys = await keys();
  const out: Record<string, MonthSchedule> = {};
  for (const k of allKeys) {
    if (typeof k === 'string' && k.startsWith('schedule:')) {
      const month = k.slice('schedule:'.length);
      const data = await get<MonthSchedule>(k);
      if (data) out[month] = data;
    }
  }
  return out;
};

export const importAll = async (payload: Record<string, MonthSchedule>) => {
  for (const [month, data] of Object.entries(payload)) {
    await set(monthKey(month), data);
  }
};
