/**
 * units.js — Hệ đơn vị SI thống nhất cho lõi tính (m, kg, s, N, Pa, K).
 * Chuyển đổi chỉ thực hiện tại biên nhập/xuất (giao diện, báo cáo, file).
 */

/** Gia tốc trọng trường tiêu chuẩn, m/s² (dùng để đổi khối lượng → trọng lượng). */
export const G_STANDARD = 9.80665;

/** Hệ số nhân để đổi từ đơn vị hiển thị sang SI. */
export const UNIT_FACTORS = Object.freeze({
  // chiều dài
  m: 1, cm: 1e-2, mm: 1e-3,
  // diện tích, mômen quán tính, môđun chống uốn
  'm2': 1, 'cm2': 1e-4, 'mm2': 1e-6,
  'm3': 1, 'cm3': 1e-6, 'mm3': 1e-9,
  'm4': 1, 'cm4': 1e-8, 'mm4': 1e-12,
  // lực, mômen
  N: 1, kN: 1e3, MN: 1e6,
  'N·m': 1, 'kN·m': 1e3,
  // tải phân bố
  'N/m': 1, 'kN/m': 1e3,
  // ứng suất, môđun
  Pa: 1, kPa: 1e3, MPa: 1e6, GPa: 1e9,
  // khối lượng
  kg: 1, 'kg/m': 1, 'kg/m3': 1,
  // trọng lượng thể tích
  'N/m3': 1, 'kN/m3': 1e3,
  // thời gian
  s: 1, h: 3600,
});

/** SI unit tương ứng với đơn vị hiển thị (để ghi nhãn). */
export const SI_OF = Object.freeze({
  m: 'm', cm: 'm', mm: 'm',
  'm2': 'm²', 'cm2': 'm²', 'mm2': 'm²',
  'm3': 'm³', 'cm3': 'm³', 'mm3': 'm³',
  'm4': 'm⁴', 'cm4': 'm⁴', 'mm4': 'm⁴',
  N: 'N', kN: 'N', MN: 'N', 'N·m': 'N·m', 'kN·m': 'N·m',
  'N/m': 'N/m', 'kN/m': 'N/m',
  Pa: 'Pa', kPa: 'Pa', MPa: 'Pa', GPa: 'Pa',
  kg: 'kg', 'kg/m': 'kg/m', 'kg/m3': 'kg/m³', 'N/m3': 'N/m³', 'kN/m3': 'N/m³',
  s: 's', h: 's',
});

function factor(unit) {
  const f = UNIT_FACTORS[unit];
  if (f === undefined) throw new Error(`Đơn vị không được hỗ trợ: "${unit}"`);
  return f;
}

/** Đổi giá trị từ đơn vị hiển thị sang SI. Trả về NaN nếu value không phải số hữu hạn. */
export function toSI(value, unit) {
  const v = typeof value === 'string' ? Number(value.replace(',', '.')) : value;
  if (v === null || v === undefined || v === '' || !Number.isFinite(v)) return NaN;
  return v * factor(unit);
}

/** Đổi giá trị SI sang đơn vị hiển thị. */
export function fromSI(value, unit) {
  if (!Number.isFinite(value)) return NaN;
  return value / factor(unit);
}

/** Nhiệt độ: °C → K (nhiệt độ tuyệt đối). Hiệu nhiệt độ KHÔNG cộng 273,15. */
export function celsiusToKelvin(tC) { return tC + 273.15; }
export function deltaCelsiusToKelvin(dC) { return dC; }

/** Định dạng số cho hiển thị (dấu thập phân kiểu Việt Nam tùy chọn). */
export function fmt(value, digits = 4) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const a = Math.abs(value);
  if (a !== 0 && (a < 1e-3 || a >= 1e6)) return value.toExponential(digits - 1);
  return Number(value.toPrecision(digits)).toString();
}
