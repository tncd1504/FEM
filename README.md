# Hệ thống Phần mềm Tính toán FEM & Kết cấu (Web-based)

Ứng dụng web tĩnh (100% Client-side) phục vụ tính toán phần tử hữu hạn (FEM), phân tích kết cấu và đánh giá phương án xếp cọc bê tông ly tâm ứng suất trước (PHC) trong kho theo **TCVN 5574:2018**.

## 1. Kiến trúc & Nguyên tắc cốt lõi
- **Chạy tĩnh 100% (Client-side):** HTML5, Tailwind CSS (CDN), JavaScript ES6 Modules, trực quan hóa bằng `Plotly.js`. Tương thích trực tiếp với GitHub Pages và Web Server nội bộ.
- **Hệ đơn vị lõi SI thống nhất:** Mọi phép tính trong lõi đều dùng chuẩn SI (`m, kg, s, N, Pa, K`); giao diện hỗ trợ chuyển đổi hai chiều với hệ đơn vị kỹ thuật (`mm, MPa, kN, kN·m`).
- **Tách biệt 3 nhóm dữ liệu (`reference / input / computed`):**
  - `reference`: 33 bản vẽ tham khảo (`PHC D300A` đến `D1000C`, 24 bản v1.2, 9 bản v2.2) chỉ dùng để xem và đối chiếu sau tính; không đưa `Mcr, Mu`, tải thi công hay thép gia cường đầu cọc (`N2, ØGC, L2`) vào bộ giải.
  - `input`: Cấu tạo hình học, cấp vật liệu theo **TCVN 5574:2018**, chiều dài `L > 0` bắt buộc do người dùng nhập.
  - `computed`: Toàn bộ đặc trưng tiết diện, tự trọng và nội lực được tự tính lại và khóa chỉ đọc (`Object.freeze`).

## 2. Cấu trúc thư mục
```text
/
├── src/
│   ├── ui/
│   │   ├── xep-coc.html                # Giao diện module Xếp cọc PHC
│   │   └── app.js                      # Điều khiển DOM, Plotly.js & thuyết minh 8 mục
│   ├── core/
│   │   ├── units.js                    # Hệ đơn vị SI & chuyển đổi biên
│   │   ├── linear_solver.js            # Bộ giải hệ phương trình đại số tuyến tính
│   │   ├── fem_solver.js               # Phần tử dầm Euler–Bernoulli (Hermite bậc 3)
│   │   └── contact_solver.js           # Nhiều tầng dầm tiếp xúc một phía dọc thân (Active-Set)
│   ├── workers/
│   │   └── calculation_worker.js       # Web Worker cho BT13 (quét dung sai) & BT14 (Pareto)
│   └── modules/
│       └── xep-coc/
│           ├── section_properties.js   # Vật liệu TCVN 5574:2018 (γb1), thép DƯL theo phân loại, tiết diện & section(x)
│           ├── pile_specs.js           # Tách 3 nhóm dữ liệu & các bài tính BT00, BT01, BT02
│           ├── prestress_losses.js     # Tổn hao DƯL TCVN 5574:2018 Mục 9.1 (≥ 100 MPa), kiểm tra lúc truyền lực
│           ├── section_checker.js      # BT03: nứt (γsp), uốn (εs2), cắt (qsw ≥ 0,25Rbt·b; c ≤ 2h0)
│           ├── contact_checker.js      # BT04 nén cục bộ; BT05 vòng kín tổng quát (phương pháp lực)
│           ├── support_checker.js      # BT06–BT08 thanh kê cứng & biên lý tưởng
│           ├── stacking_model.js       # BT09–BT12 hệ xếp S1/S2/S3
│           ├── tolerance_scan.js       # BT13 quét miền (n, e)
│           ├── optimizer.js            # BT14 tập Pareto
│           └── standards/
│               ├── tcvn5574_factors.js # Hệ số/giới hạn TCVN tập trung, kèm điều khoản
│               └── standards_manager.js# Cấu hình tiêu chuẩn & đối chiếu EC2 (tham khảo)
├── data_in/
│   ├── pile_specs.json                 # Thư viện 33 bản vẽ tham khảo Phan Vũ
│   └── support_ground_specs.json       # Cấu hình kê gỗ cứng 100×100 mm & biên kho lý tưởng
├── docs/
│   ├── HDSD_xep-coc.md                 # Hướng dẫn sử dụng
│   └── co-so-tinh-toan_xep-coc.md      # Cơ sở lý thuyết & công thức đối chứng
├── tests/
│   ├── m1_verification.js              # Kiểm thử Mốc M1 (BT00–BT02)
│   ├── m2_verification.js              # Kiểm thử Mốc M2 (BT03–BT08) + đối chứng giải tích đóng
│   ├── m3_m6_verification.js           # Kiểm thử Mốc M3–M6 (BT09–BT14, tiêu chuẩn)
│   ├── m1_benchmark.html               # Trang chạy kiểm chứng trên trình duyệt
│   └── run_m1_node.mjs                 # Script chạy toàn bộ kiểm chứng qua CLI
├── index.html                          # Trang chủ (Dashboard)
├── CHANGELOG.md                        # Nhật ký phiên bản (SemVer)
└── README.md
```

## 3. Cách chạy & Kiểm thử
### Chạy Web Server tĩnh:
```powershell
python -m http.server 8080
```
Truy cập `http://localhost:8080/index.html` hoặc `http://localhost:8080/src/ui/xep-coc.html`.

### Chạy bộ kiểm chứng tự động (`BT00 – BT14`, 35 bài):
Mở `http://localhost:8080/tests/m1_benchmark.html` (Mốc M1) trên trình duyệt hoặc chạy toàn bộ qua CLI:
```powershell
node tests/run_m1_node.mjs
# Không có Node.js riêng: dùng runtime Node đi kèm VS Code
$env:ELECTRON_RUN_AS_NODE = '1'; & "$env:LOCALAPPDATA\Programs\Microsoft VS Code\Code.exe" tests/run_m1_node.mjs
```

### Lưu ý kỹ thuật (v1.1.0)
- Quy trình căng (`L_cang`, `σ_sp0`, phân loại thép DƯL, giả thiết khi `ΔT = 0`) và góc ôm tiếp xúc bắt buộc khai báo; lõi tính không tự điền mặc định.
- Kiểm tra uốn vòng thành cọc tại kê (BT05) là mô hình sàng lọc thiên an toàn. Khi nó chi phối số tầng, cần hiệu chỉnh `b_eff` bằng mô hình vỏ/khối hoặc thí nghiệm. Chi tiết tại [docs/co-so-tinh-toan_xep-coc.md](docs/co-so-tinh-toan_xep-coc.md) mục 4.
