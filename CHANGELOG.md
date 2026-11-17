# CHANGELOG

Mọi thay đổi đáng kể của phần mềm được ghi nhận tại đây theo chuẩn [Semantic Versioning (SemVer)](https://semver.org/).

## [0.1.0] - 2026-11-16 (Hoàn thành Mốc M1: `BT00 – BT02`)

### Added
- **Dữ liệu tham khảo (`data_in/`):**
  - `data_in/pile_specs.json`: Trích xuất đầy đủ 33 bản vẽ chuẩn Phan Vũ (`PHC D300A` đến `D1000C`, gồm 24 bản v1.2 và 9 bản v2.2) đặt trong nhóm `reference` (chỉ tham khảo/đối chiếu sau tính, không đưa vào bộ giải).
  - `data_in/support_ground_specs.json`: Khai báo cấu hình thanh kê gỗ `100 × 100 mm` (`0,1 × 0,1 m`) tuyệt đối cứng và điều kiện biên kho lý tưởng (nền cứng không lún, biên đủ năng lực).
- **Lõi tính toán & Hệ đơn vị SI (`src/core/`):**
  - `src/core/units.js`: Hệ đơn vị chuẩn SI (`m, kg, s, N, Pa, K`) và các hàm chuyển đổi tại biên giao diện.
  - `src/core/linear_solver.js`: Bộ giải hệ phương trình tuyến tính bằng khử Gauss có chọn phần tử trội.
  - `src/core/fem_solver.js`: Phần tử hữu hạn dầm Euler–Bernoulli Hermite bậc 3 có khôi phục chính xác nội lực `M(x), Q(x)` và độ võng `w(x)` dọc phần tử, kèm kiểm tra cân bằng lực & mômen toàn hệ.
- **Mô-đun nghiệp vụ Mốc M1 (`src/modules/xep-coc/`):**
  - `src/modules/xep-coc/section_properties.js`: Bảng tra bê tông nặng **TCVN 5574:2018** (`B15` đến `B100`), đặc trưng thép DƯL và đai xoắn, tự tính đặc trưng tiết diện hình học/quy đổi (`t, Ag, Ab, Ap, Ared, Ig, Ired, Wred, q, EIred`) và hàm phân vùng `sectionAt(x)` (bỏ qua thép dọc gia cường đầu cọc `N2, ØGC, L2`).
  - `src/modules/xep-coc/pile_specs.js`: Tách 3 nhóm dữ liệu (`reference`, `input`, `computed` khóa `Object.freeze`), triển khai các bài tính `runBT00`, `runBT01`, `runBT02` và nghiệm giải tích đóng Macaulay bracket (`solveAnalyticalBeamTwoSupports`).
- **Giao diện, Kiểm thử & Tài liệu (`index.html`, `src/ui/`, `tests/`, `docs/`):**
  - Dashboard `index.html` và giao diện `src/ui/xep-coc.html` + `src/ui/app.js` tích hợp Plotly.js, chuyển đổi đơn vị SI ↔ Kỹ thuật, lưu/nạp JSON/LocalStorage và xuất thuyết minh 8 mục chuẩn.
  - Bộ kiểm chứng tự động `tests/m1_verification.js`, `tests/m1_benchmark.html` và `tests/run_m1_node.mjs` (đạt 12/12 bài test nghiệm thu M1 với sai số tương đối `< 10⁻¹¹`).
  - Tài liệu `docs/HDSD_xep-coc.md` và `docs/co-so-tinh-toan_xep-coc.md`.
