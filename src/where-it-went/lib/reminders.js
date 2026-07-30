/**
 * Opt-in local reminders for upcoming bills — feature A's third surface.
 *
 * The in-app banner only works if you open the app. This wakes a service worker
 * periodically so a bill due in three days can say so while the app is closed.
 * Best-effort and on-device: no server, no push service. See NOTIFICATIONS.md
 * for the shared foundation and its real limits (installed PWA on Chromium
 * only; Periodic Background Sync timing is a lower bound, not a promise).
 *
 * The page owns all the date maths — `getUpcomingBills` is already tested — and
 * mirrors a small snapshot into IndexedDB. The worker only compares dates in
 * that snapshot against "now", so the two can't drift apart on the hard part.
 */
import { getUpcomingBills, DEFAULT_LEAD_DAYS } from './upcoming';
import { createIdbKv } from '../../shared/notify/idbKv';
import { requestPermission, notificationPermission, capabilities } from '../../shared/notify/permission';
import {
  registerPeriodicSync as sharedRegisterPeriodicSync,
  unregisterPeriodicSync as sharedUnregisterPeriodicSync,
} from '../../shared/notify/periodicSync';

export const REMINDERS_DB = 'wiw-reminders';
export const REMINDERS_STORE = 'kv';
export const STATE_KEY = 'state';
export const SENT_KEY = 'sent';
export const SYNC_TAG = 'wiw-bill-reminders';

/**
 * How far ahead the snapshot carries bills. Deliberately wider than the lead
 * time: the worker may not be woken for days, and a snapshot that only held the
 * next 5 days would be empty by the time anyone looked at it.
 */
export const SNAPSHOT_HORIZON_DAYS = 45;

/** Cap on remembered ids, so `sent` can't grow without bound. */
export const MAX_SENT_IDS = 200;

const remindersKv = createIdbKv(REMINDERS_DB, REMINDERS_STORE);

/** Stable per-occurrence id: one notification per bill per due date, ever. */
export function billNotificationId(bill) {
  return `${bill?.sub?.id || bill?.id}:${bill?.dueDate}`;
}

/** Whole days from `today` to a `YYYY-MM-DD`, using local dates only. */
export function daysUntilDue(dueDate, now = new Date()) {
  const m = String(dueDate || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const due = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

/**
 * The snapshot the worker needs. Flattened deliberately — the worker is a
 * classic script with no build step, so it gets plain data, never model objects.
 */
export function computeReminderState(data, options = {}) {
  const {
    enabled = false,
    leadDays = DEFAULT_LEAD_DAYS,
    now = new Date(),
  } = options;

  const bills = getUpcomingBills(data?.subscriptions, data?.transactions, {
    horizonDays: SNAPSHOT_HORIZON_DAYS,
    today: now,
  });

  return {
    enabled: !!enabled,
    leadDays: Number(leadDays) > 0 ? Number(leadDays) : DEFAULT_LEAD_DAYS,
    updatedAt: now.getTime(),
    bills: bills
      // A charge already in the ledger needs no warning — same rule the banner
      // uses, so the background nudge and the in-app one never disagree.
      .filter(b => !b.alreadyPosted)
      .map(b => ({
        id: billNotificationId(b),
        name: b.sub.name,
        amount: Number(b.sub.amount) || 0,
        type: b.sub.type || 'Expense',
        dueDate: b.dueDate,
      })),
  };
}

/**
 * Which bills should fire right now.
 *
 * `shouldFireOncePerId` from the shared layer tracks a *single* last-sent id,
 * which suits a one-stream nudge (today's journal entry) but not this: several
 * bills can be inside the lead window at once and each needs its own
 * once-ever guard. Hence a set rather than the shared helper.
 */
export function billsToNotify(state, sentIds = [], now = new Date()) {
  if (!state || !state.enabled) return [];
  const sent = new Set(sentIds || []);
  const lead = Number(state.leadDays) > 0 ? Number(state.leadDays) : DEFAULT_LEAD_DAYS;

  return (state.bills || []).filter(bill => {
    if (sent.has(bill.id)) return false;
    const days = daysUntilDue(bill.dueDate, now);
    // Past-due entries are the posting engine's business, not a reminder's.
    return days !== null && days >= 0 && days <= lead;
  });
}

/** Keep the sent list bounded, newest kept. */
export function trimSentIds(ids) {
  const list = Array.isArray(ids) ? ids : [];
  return list.length <= MAX_SENT_IDS ? list : list.slice(list.length - MAX_SENT_IDS);
}

/** The notification text for one occurrence — signed, since it may as easily
 * be income due (rent collected as a landlord) as an expense about to post. */
export function formatBillNotification(bill, now = new Date()) {
  const days = daysUntilDue(bill.dueDate, now);
  const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
  const amount = Number(bill.amount).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const sign = bill.type === 'Income' ? '+' : '−';
  return `${bill.name} · ${sign}${amount} L due ${when}`;
}

/** Mirror the snapshot into IndexedDB. Never throws — reminders are a bonus. */
export async function writeReminderState(data, options = {}) {
  try {
    await remindersKv.set(STATE_KEY, computeReminderState(data, options));
  } catch (e) {
    console.warn('Could not mirror reminder state:', e);
  }
}

export async function readReminderState() {
  try {
    return (await remindersKv.get(STATE_KEY)) || null;
  } catch {
    return null;
  }
}

export async function registerPeriodicSync() {
  // Twice a day is plenty for something measured in days, and asking for more
  // makes the browser less willing to honour it at all.
  await sharedRegisterPeriodicSync(SYNC_TAG, 12 * 60 * 60 * 1000);
}

export async function unregisterPeriodicSync() {
  await sharedUnregisterPeriodicSync(SYNC_TAG);
}

/** Request permission (must come from a user gesture) and start the sync. */
export async function enableReminders() {
  const permission = await requestPermission();
  if (permission === 'granted') await registerPeriodicSync();
  return permission;
}

export { capabilities, notificationPermission };
