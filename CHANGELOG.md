# CHANGELOG

Mọi thay đổi đáng kể của phần mềm được ghi nhận tại đây theo chuẩn [Semantic Versioning (SemVer)](https://semver.org/).

## [0.2.0] - 2026-11-17 (Hoàn thành Mốc M2: `BT03 – BT08` & Chuẩn hóa biểu đồ Mômen)

### Changed
- **Quy ước vẽ biểu đồ Mômen uốn `M(x)` (`src/ui/app.js`, `src/ui/xep-coc.html`):**
  - Chỉnh trục tung biểu đồ `M(x)` vẽ về thớ chịu kéo theo đúng quy tắc Cơ học kết cấu Việt Nam: **`M < 0` (căng thớ trên) hướng lên trên, `M > 0` (căng thớ dưới) hướng xuống dưới** (`yaxis.autorange = 'reversed'`).

### Added
- **Tính đầy đủ tổn hao dự ứng lực theo TCVN 5574:2018 Mục 9.1 (`src/modules/xep-coc/prestress_losses.js`):**
  - Triển khai quy trình căng trước bằng máy cơ khí tại nhà máy → hầm sấy áp suất khí quyển (`ζ_heat = 0,85`) → tháo khuôn → dưỡng hộ tự nhiên.
  - Tách riêng chiều dài cọc `L`, chiều dài thép cắt `L_cut`, chiều dài đoạn căng `L_cang` và mốc đo lực/giãn dài (`before_anchoring` / `after_anchoring` để không trừ trùng `Δσ_sp4`).
  - Tính đủ 6 khoản tổn hao (`Δσ_sp1..Δσ_sp6`), tách biệt `σ_pe`, `P_eff` và `σ_pc(Ab / Ared / Ag)`; chặn đường tắt nhập trực tiếp `σ_pc` hoặc suy ngược từ `Mcr/Mu`.
- **Kiểm tra tiết diện dọc cọc `BT03` (`src/modules/xep-coc/section_checker.js`):**
  - Tự tính mômen kháng nứt `Mcrc` (TTGH II), sức kháng uốn thiết kế `MRd` và mômen cực hạn tiêu chuẩn `Mu,ser` (TTGH I mô hình biến dạng phi tuyến 2 đoạn thẳng), và sức kháng cắt `QRd(x)` theo đúng vùng cốt đai `sectionAt(x)` (bỏ qua thép dọc gia cường đầu cọc `N2, ØGC, L2`).
- **Kiểm tra nén cục bộ `BT04` và ép ngang / uốn vòng thành cọc rỗng `BT05` (`src/modules/xep-coc/contact_checker.js`):**
  - `BT04`: Kiểm tra nén cục bộ phía cọc trên thanh kê gỗ cứng `100 × 100 mm` theo TCVN 5574:2018 Mục 8.1.5, đối chứng cân bằng tích phân áp lực tiếp xúc.
  - `BT05`: Giải nội lực vòng tròn đàn hồi kín bằng hàm Green giải tích (Roark Table 9.2) cho cả sơ đồ ép 2 điểm đối tâm (`S2`) và 3 điểm tam giác nghiêng `30°` (`S1/S3`), xét đúng hàm lượng đai vòng `sectionAt(x)`, không lấy dự ứng lực dọc `σ_pc` cho phương vòng.
- **Truyền lực qua thanh kê gỗ cứng & kiểm chứng biên lý tưởng `BT06 – BT08` (`src/modules/xep-coc/support_checker.js`):**
  - `BT06`: Giải chuyển động vật rắn `(w0, θ_y)` và tiếp xúc một phía (Active-Set Iteration) qua thanh kê gỗ `100 × 100 mm` tuyệt đối cứng (tự động bắt hiện tượng tách hở khi tải lệch tâm, không chia đều phản lực).
  - `BT07` & `BT08`: Kiểm chứng cân bằng lực nghiêng với ràng buộc giữ ngang lý tưởng và hai tuyến kê đáy trên nền kho cứng không lún (không yêu cầu dữ liệu địa kỹ thuật kho).
- **Bộ kiểm chứng tự động Mốc M2 (`tests/m2_verification.js`):**
  - Bổ sung 8 nhóm bài test tự động `M2.T1 – M2.T7` (tổng cộng 20/20 bài test M1 + M2 đạt 100%).

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
