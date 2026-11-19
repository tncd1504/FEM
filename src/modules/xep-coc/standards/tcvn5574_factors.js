/**
 * tcvn5574_factors.js — Tập trung các hệ số, giới hạn và hằng số tiêu chuẩn dùng trong các bài
 * kiểm tra cọc PHC theo TCVN 5574:2018 (cơ sở chính) và hệ số tải theo TCVN 2737.
 *
 * Nguyên tắc (Plan v0.5.0 & Skill fem-web):
 * - Mọi đại lượng có thứ nguyên ở SI (Pa, m). Hệ số không thứ nguyên ghi rõ điều khoản để truy vết báo cáo.
 * - Không rải hằng số tiêu chuẩn trong code nghiệp vụ; mọi module lấy từ đây.
 * - Các giá trị đánh dấu `needsClauseConfirmation: true` là giới hạn sơ bộ cần đối chiếu bản in tiêu chuẩn
 *   trước khi dùng làm kết luận; chúng được tách khỏi kết luận lưu kho chính.
 */

export const TCVN5574 = Object.freeze({
  standard: 'TCVN 5574:2018',

  loads: Object.freeze({
    /** Hệ số độ tin cậy về tải trọng bản thân kết cấu bê tông cốt thép đúc sẵn (TTGH I). */
    gamma_f_selfWeight: 1.1,
    clause: 'TCVN 2737 — hệ số độ tin cậy về tải trọng bản thân kết cấu bê tông (γf = 1,1)',
  }),

  concrete: Object.freeze({
    /** Hệ số điều kiện làm việc γb1 áp dụng cho Rb, Rbt khi tải tác dụng dài hạn (lưu kho). */
    gamma_b1_longTerm: 0.9,
    gamma_b1_shortTerm: 1.0,
    clauseGammaB1: 'TCVN 5574:2018 Mục 6.1.2 — γb1 = 0,9 (tải dài hạn), 1,0 (tải ngắn hạn)',
    /** Biểu đồ trạng thái bê tông chịu nén (B ≤ B60). */
    eps_b0: 0.002,
    eps_b2: 0.0035,
    eps_bt0: 0.0001,
    eps_bt2: 0.00015,
    /** Cấp cao nhất mà bộ biến dạng giới hạn ở trên được áp dụng không cần hiệu chỉnh. */
    epsLimitsValidUpToGradeB: 60,
  }),

  prestress: Object.freeze({
    /** Hệ số độ chính xác căng γsp đối với căng trước. */
    gamma_sp_favourable: 0.9,
    gamma_sp_unfavourable: 1.1,
    clauseGammaSp: 'TCVN 5574:2018 Mục 9.1 — hệ số độ chính xác căng γsp = 0,9 (có lợi) / 1,1 (bất lợi)',
    /** Tổng tổn hao thứ nhất và thứ hai không nhỏ hơn 100 MPa. */
    minTotalLoss_Pa: 100e6,
    clauseMinLoss: 'TCVN 5574:2018 Mục 9.1 — tổng tổn hao ứng suất lấy không nhỏ hơn 100 MPa',
    /** Phân loại thép DƯL quyết định giới hạn σsp và công thức chùng ứng suất (căng cơ học). */
    steelCategories: Object.freeze({
      heat_treated_bar: Object.freeze({
        label: 'Thép thanh DƯL nhiệt luyện / cán nóng (vd. PC bar JIS G3137)',
        sigmaSpLimitFactorRsn: 0.9,
        relaxationFormula: 'eq_133_bar',
      }),
      cold_drawn_wire_or_strand: Object.freeze({
        label: 'Thép sợi kéo nguội / cáp DƯL',
        sigmaSpLimitFactorRsn: 0.8,
        relaxationFormula: 'eq_132_wire',
      }),
    }),
    clauseSigmaSpLimit: 'TCVN 5574:2018 Mục 9.1 — σsp ≤ 0,9·Rs,n (thép thanh nhiệt luyện/cán nóng), ≤ 0,8·Rs,n (thép sợi kéo nguội, cáp)',
    /** Cường độ bê tông lúc truyền lực (cấp B lúc buông thép). */
    transferMinStrength_Pa: 15e6,
    transferMinRatioToB: 0.5,
    clauseTransferStrength: 'TCVN 5574:2018 — cường độ truyền lực không nhỏ hơn 15 MPa và không nhỏ hơn 50% cấp B thiết kế',
    /** Giới hạn sơ bộ ứng suất nén bê tông khi truyền lực: σbp ≤ k·Rb,n(cấp B lúc truyền lực). */
    transferStressLimitRatio: 0.9,
    transferStressLimitNeedsClauseConfirmation: true,
  }),

  steel: Object.freeze({
    /** Biểu đồ 3 đoạn thẳng cho cốt thép có giới hạn chảy quy ước (thép DƯL). */
    sigma_s1_ratio: 0.9,
    eps_offset_conditionalYield: 0.002,
    eps_s2_conditionalYield: 0.015,
    Rsc_max_Pa: 400e6,
    gamma_s_prestressing: 1.2,
    gamma_s_spiral: 1.15,
    clauseDiagram: 'TCVN 5574:2018 Mục 6.2 — biểu đồ trạng thái thép có giới hạn chảy quy ước (σs1 = 0,9Rs; εs0 = Rs/Es + 0,002; εs2 = 0,015)',
  }),

  cracking: Object.freeze({
    /** Hệ số xét biến dạng không đàn hồi của bê tông vùng kéo cho tiết diện chữ nhật: Wpl = γ·W. */
    gammaPlastic_rectangular: 1.3,
    clause: 'TCVN 5574:2018 Mục 8.2.2 — Wpl = γ·Wred, γ = 1,3 cho tiết diện chữ nhật',
  }),

  shear: Object.freeze({
    phi_b2: 1.5,
    phi_sw: 0.75,
    /** Cốt ngang chỉ được kể khi qsw ≥ 0,25·Rbt·b. */
    qswMinRatio: 0.25,
    /** Hình chiếu c lấy trong [h0; 3h0]; phần Qsw lấy với c ≤ 2h0. */
    cMinFactor_h0: 1.0,
    cMaxFactor_h0: 3.0,
    cSwMaxFactor_h0: 2.0,
    Qb_min_factor: 0.5,
    Qb_max_factor: 2.5,
    crushFactor: 0.3,
    Rsw_max_Pa: 300e6,
    Rsw_factor_of_Rs: 0.8,
    clause: 'TCVN 5574:2018 Mục 8.1.3 — Qb = φb2·φn·Rbt·b·h0²/c (0,5…2,5·Rbt·b·h0); Qsw = φsw·qsw·c (c ≤ 2h0); kể cốt ngang khi qsw ≥ 0,25·Rbt·b',
  }),

  localCompression: Object.freeze({
    phi_b_coeff: 0.8,
    phi_b_min: 1.0,
    phi_b_max: 2.5,
    psi_nonUniform: 0.75,
    clause: 'TCVN 5574:2018 Mục 8.1.5 — N ≤ ψ·Rb,loc·Ab,loc, Rb,loc = φb·Rb, φb = 0,8·√(Ab,max/Ab,loc) ∈ [1; 2,5]',
  }),

  plainConcrete: Object.freeze({
    clause: 'TCVN 5574:2018 — cấu kiện bê tông không cốt thép chịu uốn: M ≤ Rbt·Wpl',
  }),
});

/** Đọc số cấp B (MPa) từ chuỗi 'B60' → 60. Trả về NaN nếu không hợp lệ. */
export function gradeBToMPa(gradeB) {
  const m = /^B(\d+(?:\.\d+)?)$/i.exec(String(gradeB ?? '').trim());
  return m ? Number(m[1]) : NaN;
}
