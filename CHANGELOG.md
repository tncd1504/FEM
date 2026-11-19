# CHANGELOG

Mọi thay đổi đáng kể của phần mềm được ghi nhận tại đây theo chuẩn [Semantic Versioning (SemVer)](https://semver.org/).

## [1.1.0] - 2026-11-19 (Hiệu chỉnh kỹ thuật theo đánh giá chuyên gia kết cấu BTCT — TCVN 5574:2018)

> Kết quả tính thay đổi so với v1.0.0. Cấu hình cũ cần bổ sung `σ_sp0`, phân loại thép DƯL và giả thiết khi `ΔT = 0` trước khi chạy BT03–BT14.

### Fixed
- **Cắt (BT03):**
  - Chỉ kể cốt đai xoắn khi `qsw ≥ 0,25·Rbt·b`.
  - `Qsw` lấy với `c ≤ 2h0`; kiểm tra tại hình chiếu `c` bất lợi nhất trong `[h0; 3h0]`.
  - v1.0.0 đánh giá `QRd` thân giữa cao khoảng 30–60%.
- **Uốn vòng thành cọc (BT05):**
  - `Wpl = 1,3·W` cho tiết diện chữ nhật (trước đây dùng 1,5).
  - Bỏ cách cộng mômen nứt bê tông với thép đai.
  - Đai xoắn chỉ được kể khi nằm ở nửa thành phía chịu kéo (đai quấn ngoài nên không góp phần khi thớ trong bị căng).
  - Bỏ hệ số kinh nghiệm 0,35. Thay bằng bộ giải vòng kín tổng quát (phương pháp lực, cân bằng bằng dòng cắt), kiểm chứng với Roark đến ~1e-15.
- **Hệ số TCVN:**
  - Thêm `γsp = 0,9` cho dự ứng lực trong kiểm tra nứt, TTGH I và cắt.
  - Thêm `γb1 = 0,9` cho tải dài hạn (lưu kho).
  - BT04/BT05 nhân `γf = 1,1` khi kiểm tra TTGH I.
- **Tổn hao DƯL:**
  - Tổng tổn hao không nhỏ hơn 100 MPa.
  - `σ_pc` lấy theo `Ared` thay cho `Ab`.
  - Giới hạn `σ_sp0` theo `0,9·Rs,n` (thép thanh) hoặc `0,8·Rs,n` (sợi/cáp), thay cho `min(0,8fpy; 0,7fpu)`.
  - Công thức chùng ứng suất chọn theo phân loại thép.
- **Uốn (BT03):** thép DƯL theo biểu đồ 3 đoạn thẳng có giới hạn chảy quy ước, giới hạn biến dạng `εs2 = 0,015`.
- **Nén cục bộ (BT04):** sửa `A_loc,max = (bx + 2t)·min(Do, bc + 2t)`. Trước đây luôn bằng `2t`.
- **S1:**
  - Lực đẩy ngang hàng đáy cộng dồn qua tiếp xúc cạnh nhau về biên lý tưởng.
  - Kiểm tra mọi hàng cọc thay vì chỉ cọc đáy.
  - Thêm kiểm tra nén cục bộ cọc–cọc và kiểm tra cọc biên tại kê (gồm tiếp xúc cạnh và lực chèn biên).
- **S3:**
  - Tải khối trên đặt lên hàng đỉnh khối dưới tại thanh kê trung gian và truyền xuống qua tiếp xúc dọc thân, kể cả lực đẩy ngang.
  - Kiểm tra hàng đỉnh tại kê trung gian.
  - Tổng tải tuyến kê lấy từ cân bằng tĩnh học của khối.
- **Eurocode 2 (tham khảo):**
  - `MRd` tính độc lập: parabol–chữ nhật, `fpd`, `εud`.
  - Cắt vùng không nứt theo EN 1992-1-1 Mục 6.2.2(2).
  - Ghi rõ giới hạn: tổn hao chưa tính riêng theo EC2.

### Changed
- **Bỏ mọi mặc định ngầm:** `L_cang` không còn tự lấy bằng `L`; `σ_sp0` bắt buộc khai báo; `ΔT = 0` phải kèm giả thiết; góc ôm tiếp xúc `θ_c` bắt buộc khai báo.
- **Kiểm tra lúc truyền lực** tách khỏi kết luận lưu kho, cần khai báo cấp bê tông lúc truyền lực. Thiếu thì báo "chưa đủ dữ liệu".
- **Miền hiệu lực:** `B > B60` báo "ngoài miền hiệu lực" (chưa hiệu chỉnh `εb0, εb2` cho bê tông cường độ cao).
- **`verified` của BT03** tính từ dư số cân bằng nghiệm số, không còn gán cứng.
- **Giao diện:** thêm ô `σ_sp0`, phân loại thép DƯL, giả thiết `ΔT = 0`, cấp bê tông lúc truyền lực và thời hạn tải. Thuyết minh hiển thị đủ các hệ số, trạng thái kể đai và cảnh báo miền hiệu lực.
- **Dữ liệu `data_in/pile_specs.json`:** 33 mẫu bổ sung `steelCategory = heat_treated_bar` (PC bar JIS G3137, người dùng xác nhận theo chứng chỉ thép).

### Added
- `src/modules/xep-coc/standards/tcvn5574_factors.js`: tập trung hệ số/giới hạn TCVN kèm điều khoản truy vết.
- **Khảo sát độ nhạy độ cứng tiếp xúc dọc thân** (×0,1 và ×10) cho S1/S3, kèm cảnh báo khi thay đổi > 5%.
- **Kiểm thử:** 35/35, bổ sung đối chứng độc lập dạng giải tích đóng:
  - cắt theo lời giải đóng;
  - `Mcrc` đàn hồi;
  - vòng chịu lực đơn `3PR/(4π)`;
  - `Wpl = 1,3W`;
  - `A_loc,max`;
  - lực đẩy cộng dồn;
  - quy tắc 100 MPa;
  - giới hạn `σ_sp0` theo loại thép;
  - chặn thiếu đầu vào.

### Known limitations
- **Uốn vòng tại kê là cơ chế chi phối ở hầu hết phương án.** Mô hình vòng phẳng trên dải `b_eff = bx + 4t` bỏ qua làm việc vỏ trụ nên thiên an toàn đáng kể (ví dụ D800/D1000 một tầng đã có `U_ring > 1`). Cần hiệu chỉnh `b_eff` bằng mô hình vỏ/khối hoặc thí nghiệm trước khi dùng kết quả làm giới hạn số tầng.
- **Nội lực S1/S3 nhạy với độ cứng tiếp xúc dọc thân** (15–32% trong dải ×0,1…×10 với các cọc mẫu).
- **Giới hạn ứng suất lúc truyền lực `0,9·Rb,n`** là giới hạn sơ bộ, cần đối chiếu điều khoản.
- **Bê tông `B > B60`** chưa có bảng `εb0, εb2` hiệu chỉnh.

## [1.0.0] - 2026-11-19 (Hoàn thành toàn bộ Mốc M3, M4, M5 & M6: `BT09 – BT14`, Web Worker, Đối chiếu tiêu chuẩn & Báo cáo)

### Added
- **Lõi tiếp xúc một phía dọc thân (`src/core/contact_solver.js`):**
  - Bộ giải hệ nhiều tầng dầm có tiếp xúc một phía (chỉ chịu nén, tự động tách hở) dọc trục `x` bằng Active-Set Iteration, bắt hiện tượng tập trung lực tiếp xúc gần gối đáy `x1, x2`.
- **Mô hình hệ xếp cọc nhiều tầng `BT09 – BT12` (`src/modules/xep-coc/stacking_model.js`):**
  - `BT10 & BT11 (S2)`: Giải S2 kê thẳng hàng và S2 lệch kê (phân biệt 2 định nghĩa mốc sai lệch: theo trục chuẩn chung vs. theo 2 mặt kê liên tiếp; hỗ trợ 5 kịch bản lệch kê).
  - `BT09 (S1)`: Giải cân bằng lưới tiếp xúc tam giác nghiêng `30°`, kết hợp tiếp xúc một phía dọc thân (`contact_solver.js`) và uốn xiên 2 phương (đứng + ngang do lực đẩy ngang biên).
  - `BT12 (S3)`: Giải sơ đồ hỗn hợp ghép nhiều khối qua thanh kê gỗ cứng trung gian, bảo toàn 100% tải tích lũy và đối chứng quy đúng về `S1` (khi 1 khối) và `S2` (khi các khối 1 tầng).
- **Khảo sát miền dung sai `BT13` & Tối ưu Pareto `BT14` (`tolerance_scan.js`, `optimizer.js`, `src/workers/calculation_worker.js`):**
  - `BT13`: Quét miền `(n, e)` tìm vùng chấp nhận liên thông chứa trạng thái danh định (`e = 0`) và tinh chỉnh biên, công bố rõ trạng thái *dung sai khảo sát*.
  - `BT14`: Trích xuất tập phương án Pareto theo 3 chỉ tiêu khả năng chịu lực của cọc (`nLayers ↑`, `allowableEccentricity_m ↑`, `nominalMaxU ↓`) trên nền Web Worker.
- **Quản lý tiêu chuẩn, Đối chiếu song song & Báo cáo (`standards_manager.js`, `data_out/report_template.html`):**
  - Mặc định `TCVN 5574:2018` làm cơ sở chính; bổ sung bộ đối chiếu song song độc lập theo **Eurocode 2 (EN 1992-1-1:2004)** với lựa chọn in độc lập (`reportStandards`), xuất CSV có nhãn tiêu chuẩn và xuất Báo cáo HTML / In PDF.
- **Kiểm chứng tự động toàn hệ thống (`tests/m3_m6_verification.js`):**
  - Đạt **27/27** bài test nghiệm thu toàn bộ Mốc M1 → M6 (`BT00 – BT14`).

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
