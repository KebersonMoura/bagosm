/**
 * Date & Time utilities specifically configured for Brasília Timezone (America/Sao_Paulo / UTC-3).
 * Ensures consistency across client browsers, server containers, receipts, and dashboards.
 */

export const BRASILIA_TIMEZONE = 'America/Sao_Paulo';

/**
 * Robustly parse any date input (string, number, Date) ensuring
 * naive strings from MySQL or inputs without timezone offsets are treated as Brasília time (-03:00).
 */
export function parseDateBrasilia(dateInput?: string | number | Date | null): Date | null {
  if (!dateInput) return null;
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }
  if (typeof dateInput === 'number') {
    const d = new Date(dateInput);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof dateInput === 'string') {
    const s = dateInput.trim();
    if (!s) return null;
    // If it's pure YYYY-MM-DD HH:mm:ss or YYYY-MM-DDTHH:mm:ss without timezone offset (e.g. from MySQL)
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s)) {
      const iso = s.replace(' ', 'T') + '-03:00';
      const d = new Date(iso);
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/**
 * Format a date/time to "HH:mm" (or "HH:mm:ss") in Brasília timezone.
 */
export function formatTimeBrasilia(
  dateInput?: string | number | Date | null,
  options?: { includeSeconds?: boolean }
): string {
  if (!dateInput) return '';
  try {
    const d = parseDateBrasilia(dateInput);
    if (!d) return '';
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: BRASILIA_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      ...(options?.includeSeconds ? { second: '2-digit' } : {}),
      hour12: false
    }).format(d);
  } catch {
    return '';
  }
}

/**
 * Format a date/time to "DD/MM/YYYY" in Brasília timezone.
 */
export function formatDateBrasilia(dateInput?: string | number | Date | null): string {
  if (!dateInput) return '';
  try {
    const d = parseDateBrasilia(dateInput);
    if (!d) return '';
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: BRASILIA_TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(d);
  } catch {
    return '';
  }
}

/**
 * Format a date/time to "DD/MM/YYYY HH:mm" in Brasília timezone.
 */
export function formatDateTimeBrasilia(
  dateInput?: string | number | Date | null,
  options?: { includeSeconds?: boolean }
): string {
  if (!dateInput) return '';
  try {
    const d = parseDateBrasilia(dateInput);
    if (!d) return '';
    const dateStr = formatDateBrasilia(d);
    const timeStr = formatTimeBrasilia(d, options);
    if (!dateStr) return '';
    return timeStr ? `${dateStr} às ${timeStr}` : dateStr;
  } catch {
    return '';
  }
}

/**
 * Get date string formatted as "YYYY-MM-DD" in Brasília timezone.
 */
export function getDateYMDInBrasilia(dateInput?: string | number | Date | null): string {
  try {
    const d = dateInput ? parseDateBrasilia(dateInput) : new Date();
    if (!d || isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
    return new Intl.DateTimeFormat('sv-SE', { timeZone: BRASILIA_TIMEZONE }).format(d);
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Get today's date "YYYY-MM-DD" in Brasília timezone.
 */
export function getTodayBrasilia(): string {
  return getDateYMDInBrasilia(new Date());
}

/**
 * Get yesterday's date "YYYY-MM-DD" in Brasília timezone.
 */
export function getYesterdayBrasilia(): string {
  return getDateYMDInBrasilia(new Date(Date.now() - 86400000));
}
