# Hướng dẫn sử dụng Module Xếp cọc Bê tông Ly tâm (PHC) — Mốc M1 (`BT00 – BT02`)

## 1. Giới thiệu & Phạm vi Mốc M1
Module **Xếp cọc Bê tông Ly tâm Ứng suất trước (PHC)** tại Mốc M1 triển khai và kiểm chứng độc lập 3 bài toán nền tảng:
- **BT00:** Chuẩn hóa cấu tạo cọc, phân vùng cốt đai dọc trục `section(x)`, xác lập đặc trưng vật liệu thiết kế theo **TCVN 5574:2018**, chuyển đổi về **hệ đơn vị chuẩn SI (`m, kg, s, N, Pa`)** và tách biệt nghiêm ngặt 3 nhóm dữ liệu (`reference`, `input`, `computed`).
- **BT01:** Phân tích phần tử hữu hạn (FEM) dầm một cọc đặt trên hai gối có hai đoạn hẫng chỉ chịu tự trọng `q` tự tính từ BT00, đối chứng trực tiếp với nghiệm giải tích đóng.
- **BT02:** Phân tích một cọc nhận thêm tải tập trung `P1, P2` từ hai tuyến kê tầng trên ở trạng thái **đặt đúng gối** (`e1 = e2 = 0`) và **lệch gối** (`e1, e2 ≠ 0`), đối chứng với nghiệm giải tích Macaulay bracket và nguyên lý cộng tác dụng.

---

## 2. Cách khởi chạy ứng dụng
Vì ứng dụng sử dụng chuẩn **JavaScript ES6 Modules**, trình duyệt yêu cầu mở qua HTTP Server tĩnh (hoặc GitHub Pages):

```powershell
# Chạy tại thư mục gốc C:\DuAn_AI\FEM
python -m http.server 8080
```
Sau đó mở trình duyệt tại:
- Trang chủ (Dashboard): `http://localhost:8080/index.html`
- Giao diện Module Xếp cọc: `http://localhost:8080/src/ui/xep-coc.html`
- Trang kiểm chứng tự động (Benchmark M1): `http://localhost:8080/tests/m1_benchmark.html`

---

## 3. Quy trình thao tác trên giao diện

### Bước 1: Xem bản vẽ tham khảo (`reference`) hoặc tự nhập mới
1. Tại khung **1. Nhóm REFERENCE**, bạn có thể chọn một trong **33 bản vẽ chuẩn Phan Vũ** (`PHC D300A` đến `D1000C`, gồm 24 bản v1.2 và 9 bản v2.2).
2. Nhấn **"Nạp cấu tạo hình học vào INPUT"** nếu muốn lấy nhanh `Do, Dp, Di, N1, ØPC, ØFs` từ bản vẽ sang khung nhập liệu.
3. **Lưu ý quan trọng:** Các số liệu công bố trên bản vẽ (`Mcr, Mu`, tải thi công) và thép dọc gia cường đầu cọc (`N2, ØGC, L2`) chỉ dùng để xem/đối chiếu, **không đi vào bộ giải**. Bạn có thể bấm nút **"Test cô lập Reference"** để kiểm chứng trực tiếp rằng việc thay đổi các số công bố này không làm đổi kết quả tự tính.

### Bước 2: Xác lập dữ liệu đầu vào (`input`)
1. **Nhập chiều dài cọc `L` (m):** Bắt buộc `L > 0` do người dùng nhập (không tự suy từ mã cọc).
2. **Chọn cấp độ bền chịu nén `B` của bê tông theo TCVN 5574:2018:** Ví dụ `B60, B70, B80, B90` (phần mềm không tự động đồng nhất `80 MPa` mẫu trụ trên bản vẽ với cấp `B80` nếu người dùng chưa chọn).
3. **Khai báo vị trí hai gối kê `x1, x2` (m) và tải tập trung tầng trên `P1, P2` (kN) cùng độ lệch `e1, e2` (m):**
   - Bấm **"Đặt x1 = 0.2071L"** để đặt nhanh hai gối đối xứng cân bằng mômen âm tại gối và mômen dương giữa nhịp (`a = ((√2 - 1)/2)·L ≈ 0,2071L`).
   - Sử dụng các nút kịch bản nhanh: **Đúng gối (`e1 = 0, e2 = 0`)**, **Lệch vào nhịp**, **Lệch ra đầu hẫng**, **Chỉ lệch tuyến 1**.

### Bước 3: Xem kết quả tự tính (`computed`), biểu đồ & thuyết minh 8 mục
- Khung **3. Nhóm COMPUTED** hiển thị các đặc trưng tự tính chỉ đọc (`t, Ag, Ab, Ap, Ared, Ig, Ired, Wred, q, EIred`).
- Có thể chuyển đổi tức thời giữa **Đơn vị Kỹ thuật (`mm, MPa, kN, kN·m`)** và **Đơn vị SI chuẩn (`m, Pa, N, N·m`)** trên thanh công cụ trên cùng.
- Xem trực quan mặt cắt ngang, sơ đồ phân vùng đai `section(x)` dọc cọc cùng thanh kê gỗ cứng `100 × 100 mm`, biểu đồ `M(x), Q(x), w(x)` và bảng thuyết minh 8 mục chuẩn cho từng bài `BT00`, `BT01`, `BT02`.
