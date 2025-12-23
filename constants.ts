
import { PaymentMethod, OrderStatus, PaymentOrder } from './types';

export const generateUUID = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const normalizeInputNumber = (str: string): string => {
  if (!str) return '';
  const persianDigits = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
  const arabicDigits = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
  
  let result = str;
  for (let i = 0; i < 10; i++) {
    result = result.replace(persianDigits[i], i.toString()).replace(arabicDigits[i], i.toString());
  }
  return result;
};

export const formatNumberString = (value: string | number | undefined): string => {
  if (value === undefined || value === null || value === '') return '';
  const str = value.toString();
  const normalized = normalizeInputNumber(str).replace(/[^0-9.]/g, '');
  if (!normalized) return '';
  const parts = normalized.split('.');
  const integerPart = parts[0];
  const decimalPart = parts.length > 1 ? '.' + parts[1] : '';
  return integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + decimalPart;
};

export const deformatNumberString = (value: string): number => {
  if (!value) return 0;
  const normalized = normalizeInputNumber(value).replace(/[^0-9.]/g, '');
  return parseFloat(normalized) || 0;
};

export const INITIAL_ORDERS: PaymentOrder[] = [];

export const getStatusLabel = (status: OrderStatus) => {
    switch (status) {
        case OrderStatus.PENDING: return 'در انتظار مالی';
        case OrderStatus.APPROVED_FINANCE: return 'تایید مالی';
        case OrderStatus.APPROVED_MANAGER: return 'تایید مدیریت';
        case OrderStatus.APPROVED_CEO: return 'تایید نهایی';
        case OrderStatus.REJECTED: return 'رد شده';
        case OrderStatus.REVOCATION_PENDING_FINANCE: return 'درخواست ابطال (مالی)';
        case OrderStatus.REVOCATION_PENDING_MANAGER: return 'تایید ابطال (مدیریت)';
        case OrderStatus.REVOCATION_PENDING_CEO: return 'تایید ابطال (مدیرعامل)';
        case OrderStatus.REVOKED: return 'باطل شده';
        default: return status;
    }
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('fa-IR').format(amount) + ' ریال';
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('fa-IR-u-ca-persian', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export const jalaliToGregorian = (j_y: number, j_m: number, j_d: number): Date => {
  const jy = j_y - 979;
  const jm = j_m - 1;
  const jd = j_d - 1;

  let j_day_no = 365 * jy + Math.floor(jy / 33) * 8 + Math.floor((jy % 33 + 3) / 4);
  for (let i = 0; i < jm; ++i) j_day_no += (i < 6) ? 31 : 30;
  j_day_no += jd;

  let g_day_no = j_day_no + 79;

  let gy = 1600 + 400 * Math.floor(g_day_no / 146097);
  g_day_no = g_day_no % 146097;

  let leap = true;
  if (g_day_no >= 36525) {
    g_day_no--;
    gy += 100 * Math.floor(g_day_no / 36524);
    g_day_no = g_day_no % 36524;

    if (g_day_no >= 365) g_day_no++;
    else leap = false;
  }

  gy += 4 * Math.floor(g_day_no / 1461);
  g_day_no %= 1461;

  if (g_day_no >= 366) {
    leap = false;
    g_day_no--;
    gy += Math.floor(g_day_no / 365);
    g_day_no = g_day_no % 365;
  }

  let i;
  for (i = 0; g_day_no >= ((i < 1) ? (31 + (leap ? 1 : 0)) : ((i === 1) ? 28 : ((i < 7) ? 31 : 30))); i++) {
    g_day_no -= ((i < 1) ? (31 + (leap ? 1 : 0)) : ((i === 1) ? 28 : ((i < 7) ? 31 : 30)));
  }
  
  const gm = i + 1;
  const gd = g_day_no + 1;

  return new Date(gy, gm - 1, gd);
};

export const parsePersianDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
    const [y, m, d] = parts.map(Number);
    if (!y || !m || !d) return null;
    if (y < 1900) {
        return jalaliToGregorian(y, m, d);
    }
    return new Date(y, m - 1, d);
};

export const getCurrentShamsiDate = () => {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = { calendar: 'persian', year: 'numeric', month: 'numeric', day: 'numeric' };
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', options).formatToParts(now);
  const y = parseInt(parts.find(p => p.type === 'year')?.value || '1403');
  const m = parseInt(parts.find(p => p.type === 'month')?.value || '1');
  const d = parseInt(parts.find(p => p.type === 'day')?.value || '1');
  return { year: y, month: m, day: d };
};

export const getShamsiDateFromIso = (isoDate: string) => {
  const [yStr, mStr, dStr] = isoDate.split('-').map(Number);
  const date = new Date(yStr, mStr - 1, dStr);
  const options: Intl.DateTimeFormatOptions = { calendar: 'persian', year: 'numeric', month: 'numeric', day: 'numeric' };
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', options).formatToParts(date);
  const y = parseInt(parts.find(p => p.type === 'year')?.value || '1403');
  const m = parseInt(parts.find(p => p.type === 'month')?.value || '1');
  const d = parseInt(parts.find(p => p.type === 'day')?.value || '1');
  return { year: y, month: m, day: d };
};

export const calculateDaysDiff = (startDateStr: string, endDateStr?: string): number | null => {
    const start = parsePersianDate(startDateStr);
    if (!start) return null;
    let end = new Date();
    if (endDateStr) {
        const parsedEnd = parsePersianDate(endDateStr);
        if (parsedEnd) end = parsedEnd;
    }
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : 0;
};

// --- NUMBER TO WORD CONVERTER ---
const letters = [
    ['', 'یک', 'دو', 'سه', 'چهار', 'پنج', 'شش', 'هفت', 'هشت', 'نه'],
    ['ده', 'یازده', 'دوازده', 'سیزده', 'چهارده', 'پانزده', 'شانزده', 'هفده', 'هجده', 'نوزده', 'بیست'],
    ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود'],
    ['', 'یکصد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد'],
    ['', ' هزار', ' میلیون', ' میلیارد', ' تریلیون']
];

export const numberToPersianWords = (input: number | string): string => {
    if (input === 0 || input === '0') return 'صفر';
    const str = typeof input === 'number' ? input.toString() : input;
    if (!/^\d+$/.test(str)) return '';

    const prepareNumber = (num: string) => {
        let out = num;
        if (out.length % 3 === 1) out = '00' + out;
        else if (out.length % 3 === 2) out = '0' + out;
        return out.replace(/\d{3}(?=\d)/g, '$&,').split(',');
    };

    const threeDigitToWord = (numStr: string) => {
        const n = parseInt(numStr);
        if (n === 0) return '';
        
        const d1 = Math.floor(n / 100);
        const d2 = Math.floor((n % 100) / 10);
        const d3 = n % 10;
        
        const parts = [];
        
        if (d1 > 0) parts.push(letters[3][d1]);
        
        if (d2 > 1) {
            parts.push(letters[2][d2]);
            if (d3 > 0) parts.push(letters[0][d3]);
        } else if (d2 === 1) {
            parts.push(letters[1][d3 + (d2 * 10) - 10]);
        } else if (d3 > 0) {
            parts.push(letters[0][d3]);
        }
        
        return parts.join(' و ');
    };

    const groups = prepareNumber(str);
    const result = [];
    
    for (let i = 0; i < groups.length; i++) {
        const word = threeDigitToWord(groups[i]);
        if (word) {
            result.push(word + letters[4][groups.length - 1 - i]);
        }
    }
    
    return result.join(' و ') + ' ریال';
};
