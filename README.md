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
│   │   └── fem_solver.js               # Phần tử dầm Euler–Bernoulli (Hermite bậc 3)
│   └── modules/
│       └── xep-coc/
│           ├── section_properties.js   # Vật liệu TCVN 5574:2018, tiết diện quy đổi & section(x)
│           └── pile_specs.js           # Tách 3 nhóm dữ liệu & các bài tính BT00, BT01, BT02
├── data_in/
│   ├── pile_specs.json                 # Thư viện 33 bản vẽ tham khảo Phan Vũ
│   └── support_ground_specs.json       # Cấu hình kê gỗ cứng 100×100 mm & biên kho lý tưởng
├── docs/
│   ├── HDSD_xep-coc.md                 # Hướng dẫn sử dụng
│   └── co-so-tinh-toan_xep-coc.md      # Cơ sở lý thuyết & công thức đối chứng
├── tests/
│   ├── m1_verification.js              # Bộ kiểm thử & hồi quy tự động Mốc M1
│   ├── m1_benchmark.html               # Trang chạy kiểm chứng trên trình duyệt
│   └── run_m1_node.mjs                 # Script chạy kiểm chứng qua CLI
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

### Chạy bộ kiểm chứng tự động Mốc M1 (`BT00 – BT02`):
Mở `http://localhost:8080/tests/m1_benchmark.html` trên trình duyệt hoặc chạy lệnh CLI:
```powershell
node tests/run_m1_node.mjs
```
