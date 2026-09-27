/**
 * Universal Date & Time utilities for DragonPro
 * Ensures all dates and times match local calendar and server time
 * without UTC shifts or day rollbacks caused by .toISOString()
 */

export const formatLocalDate = (d: Date | string | number | null | undefined = new Date()): string => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(typeof d === 'string' && d.includes(' ') && !d.includes('T') ? d.replace(' ', 'T') : d);
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatLocalDateTime = (d: Date | string | number | null | undefined = new Date()): string => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(typeof d === 'string' && d.includes(' ') && !d.includes('T') ? d.replace(' ', 'T') : d);
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

export const formatLocalMonth = (d: Date | string | number | null | undefined = new Date()): string => {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

export const getFirstDayOfMonth = (d: Date | string | number | null | undefined = new Date()): string => {
  const date = d instanceof Date ? d : (d ? new Date(d) : new Date());
  if (isNaN(date.getTime())) return formatLocalDate(new Date()).slice(0, 8) + '01';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
};

export const getDaysAgo = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return formatLocalDate(d);
};

export const formatOrderTime = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  try {
    const str = String(dateStr).trim();
    const parts = str.replace('T', ' ').split(' ');
    if (parts.length >= 2) {
      const [year, month, day] = parts[0].split('-');
      const timeParts = parts[1].split(':');
      let hour = parseInt(timeParts[0] || '0', 10);
      const min = timeParts[1] || '00';
      const period = hour >= 12 ? 'م' : 'ص';
      hour = hour % 12;
      if (hour === 0) hour = 12;
      const hourDisplay = hour < 10 ? `0${hour}` : `${hour}`;
      return `${hourDisplay}:${min} ${period} - ${day}/${month}`;
    }
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      let hour = d.getHours();
      const min = String(d.getMinutes()).padStart(2, '0');
      const period = hour >= 12 ? 'م' : 'ص';
      hour = hour % 12;
      if (hour === 0) hour = 12;
      const hourDisplay = hour < 10 ? `0${hour}` : `${hour}`;
      return `${hourDisplay}:${min} ${period} - ${day}/${month}`;
    }
  } catch {}
  return String(dateStr);
};
