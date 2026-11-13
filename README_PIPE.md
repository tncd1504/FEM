# Mặt cắt ống dài chịu ép hướng tâm

Bài toán riêng có thép đai/thép dọc: [hướng dẫn](./README_PIPE_RC.md), trang
`/pipe_rc.html`. Bài toán trong tài liệu này vẫn không kể độ cứng cốt thép.

Chạy từ thư mục dự án:

```powershell
python app.py --no-browser
```

Mở **http://127.0.0.1:8080/pipe.html**. Các trang tấm và khối tròn xoay hiện có
vẫn dùng các đường dẫn cũ. Cần Python, NumPy và SciPy; giao diện không tải thư
viện JavaScript từ Internet. `FEM_PORT` cho phép đổi cổng của máy chủ.

## Bộ dữ liệu mặc định trên giao diện: cọc D600, thành 100 mm

- Đường kính ngoài 600 mm: R = 300 mm, r = 200 mm; bê tông nặng B60,
  E = 39,5 GPa, ν = 0,2.
- Hai lực đường không đổi dọc cọc: mỗi lực 20 kN/m, hướng vào tâm, tại
  góc 60° và 120°. Không có áp lực phân bố thêm.
- Nền cứng tại 270° chặn chuyển vị xuống dưới; cọc bên phải tại 0° chặn
  sang phải, cọc bên trái tại 180° chặn sang trái. Cả ba là chặn một chiều,
  khe hở 0, tự do theo phương tiếp tuyến (không ma sát).
- Các tiếp xúc được lý tưởng hóa tại ba điểm trên biên ngoài. Chưa mô phỏng
  cả miền tiếp xúc của nền/cọc lân cận hoặc độ cứng biến dạng của hai cọc bên.
- Lưới 6 × 96. Nút ngoài đặt lực: 593 (60°), 609 (120°); các nút chặn:
  577 (0°), 625 (180°), 649 (270°). Kiểm tra lại số nút nếu tự đổi lưới.
- Nén trước hữu hiệu vẫn là giá trị đang nhập; 5 MPa khởi đầu là minh họa,
  chưa phải số liệu dự ứng lực do người dùng xác nhận cho cọc D600.
- Nút “Nạp lại bộ D600 × 100 · B60” khôi phục hình học, E, ν, cấp bê tông,
  lưới, lực và chặn; giữ nguyên nén trước hữu hiệu, hệ số tải và giới hạn kiểm tra.

Hai lực có tổng thành phần đứng 20√3 = 34,641 kN/m hướng xuống; phản lực
đứng của nền phải cân bằng giá trị này. Lực/gối điểm có thể gây ứng suất
cục bộ phụ thuộc lưới; không dùng bộ mặc định để kết luận chống nứt đầy đủ.

## Phạm vi

- Ống dài, tải và gối bất biến dọc trục. Lưới Q4 trên miền vành khuyên XY;
  đây là phần tử liên tục 2D, không phải phần tử tấm chịu uốn ngoài mặt.
- Bê tông đẳng hướng đàn hồi, biến dạng nhỏ. Chưa có cốt thép, tính sau nứt,
  độ cứng hình học hoặc dự báo tải phá hoại. Phần kiểm tra TCVN có phạm vi
  giới hạn được mô tả bên dưới; không thay thế kiểm tra TTGH đầy đủ.
- Hình học, chuyển vị cưỡng bức và khe hở tham chiếu trạng thái **đã nén
  trước hữu hiệu và cân bằng**. Không tính tổn hao hay nở Poisson từ quá trình
  tạo dự ứng lực; phản lực hiển thị không bao gồm phản lực của quá trình đó.
- Nén trước dọc nhập số dương, chuyển thành `sigma_z_initial = -prestress`.
  Nó được cộng đúng một lần vào ứng suất và nội lực tổng, không đưa lại như
  tải ép dọc vào hệ gia số. Lực duy trì trạng thái ban đầu được coi là đã có.
- Giữ lực dọc: một ẩn biến dạng dọc đồng đều, với tích phân gia số ứng suất
  dọc trên toàn miền bằng 0 (biến dạng phẳng tổng quát, không có uốn trục ống).
  Không bắt buộc gia số ứng suất dọc bằng 0 tại từng điểm.
- Giữ biến dạng dọc: gia số biến dạng dọc bằng 0; lực dọc có thể thay đổi.

## Nhập tải và liên kết

Góc tính từ +X, dương ngược chiều kim đồng hồ. +r hướng ra ngoài tâm; +t theo
chiều tăng góc. Các dòng tải/gối chồng lên nhau được cộng tải hoặc lấy giao các
giới hạn chuyển vị. Điều kiện mâu thuẫn bị từ chối.

Áp lực dương tác dụng vào bê tông: biên ngoài hướng vào tâm, biên trong hướng
ra ngoài. Cung được chọn theo giữa cạnh lưới. Gối trên cung được chọn theo nút.
Khoảng góc 0 đến 360 là cả vòng; khoảng 330 đến 30 đi qua góc 0.

Giới hạn `upper` là u <= giá trị; `lower` là u >= giá trị; `fixed` là giá trị
cưỡng bức. Ví dụ giới hạn trên bằng 0 theo r cho phép đi vào tâm, chặn đi ra.
Nút được đánh số từ 1; cần kiểm tra lại tải/gối theo số nút sau khi đổi lưới.
Lực tại một nút trên mặt cắt đại diện một lực đường không đổi dọc ống.

Không tự thêm gối để cân bằng tải. Chỉ loại bỏ các chuyển động vật rắn còn
tự do bằng điều kiện chọn nghiệm không sinh phản lực. Khi tải không thể cân
bằng với các chặn, chương trình báo lỗi. Nghiệm chuyển vị của vật tự do có
thể không duy nhất theo chuyển động vật rắn; chương trình chọn nghiệm quy
tâm khi thỏa các liên kết.

## Kết quả và đơn vị

Giao diện: mm, MPa, GPa và kN/m. API/JSON: m, Pa và N.

- Chuyển vị và phản lực: phần **tăng thêm** so với trạng thái ban đầu.
- Ứng suất r, theta và r-theta không có thành phần ban đầu; sigma_z tổng
  bằng delta_sigma_z trừ nén trước hữu hiệu. Kéo dương.
- Nội lực tích phân qua thành tại giữa mỗi dải góc: Ntheta, Nz và Qtheta
  (N/m); Mtheta và Mz (N, tương đương N.m/m). Mômen quanh giữa thành.
  Qtheta ở đây là tích phân tau_rtheta trên mặt cắt pháp tuyến +theta.
  Nztheta và Qz bằng 0 do giả thiết không thay đổi dọc trục, không xoắn/uốn dọc.
- Lực dọc **toàn miền** là tích phân sigma_z dA (N), khác Nz qua thành (N/m).
- Nội lực và diện tích tính trên miền đa giác Q4, không phải đường tròn chính
  xác. Chiều dày tại mặt cắt giữa dải góc là `(R-r)*cos(pi/ntheta)`.
- Màu bản đồ lấy tại tâm phần tử, cực trị tóm tắt lấy tại điểm Gauss. Không
  dùng ứng suất điểm gần lực tập trung hoặc gối điểm để kết luận độ bền.

Tải JSON xuất kèm mô hình, giả thiết, kết quả Gauss, nội lực và sai số cân bằng.
Hai loại CSV xuất các nút/phản lực và nội lực theo góc, với đơn vị trong tiêu đề.
Kết quả cũ không được xuất khi dữ liệu nhập đã thay đổi.

## Kiểm chứng

```powershell
python -m unittest test_tcvn5574_checks test_annular_pipe_fem test_annular_pipe_api test_annular_solid_fem -v
```

Bài toán Lamé kiểm tra chuyển vị, phân bố ứng suất, nội lực vòng và hội tụ
lưới; các bài khác kiểm tra điều kiện dọc, nén trước, đóng/mở chặn, khe hở,
tải không cân bằng và API. Đây là kiểm chứng cho phạm vi đàn hồi nêu trên.

## Kiểm tra theo TCVN 5574:2018

Bật mục 06 trên giao diện. Hiện chỉ hỗ trợ **bê tông nặng**, B15–B100 theo
đúng các cấp có trong danh mục; không đồng nhất B với cường độ mẫu trụ f'c.
Nguồn: [TCVN 5574:2018](https://www.rds.com.vn/TCXD1/TCVN5574-2018.pdf).

- Tra Rb/Rbt từ Bảng 7, Rb,ser/Rbt,ser từ Bảng 6 và Eb tham khảo từ Bảng 10.
  Không chia lại các hệ số độ tin cậy vật liệu vì Bảng 7 đã bao gồm chúng.
- Theo 6.1.2.3, γb1 = 1 hoặc 0,9 theo thời hạn tải, giảm cả Rb và Rbt;
  γb2 = 0,9 giảm riêng Rb cho mô hình không kể cốt thép. Nếu chiều cao mỗi
  lớp đổ đứng lớn hơn 1,5 m, γb3 = 0,85 giảm riêng Rb. Không suy ra điều
  kiện lớp đổ từ chiều dài toàn ống. Không áp dụng hệ số của bê tông tự ứng
  suất chỉ vì kết cấu có dự ứng lực.
- Tải đang nhập là trường hợp sử dụng. TTGH1 được **giải lại** với áp lực
  và lực nút nhân hệ số người dùng nhập. Chuyển vị gối giữ nguyên; hệ số
  nén trước TTGH1 nhập riêng. Hệ số 1 không phải hệ số tổ hợp mặc định
  của TCVN, và chương trình không tự sinh tổ hợp của các loại tải khác nhau.
- So sánh ứng suất chính lớn nhất/nhỏ nhất của tensor đầy đủ (có tau_rtheta
  và sigma_z tổng) với các cường độ đơn trục. Đây là **sàng lọc đàn hồi**,
  không phải tiêu chí sức bền đa trục theo 6.1.4.9, cũng không phải tính
  sức kháng tiết diện phi tuyến theo 7.2.2. Không tăng sức bền do nén đa trục.
- Đánh giá dấu hiệu bắt đầu nứt bằng kéo chính / Rbt,ser. Điểm vượt giới hạn
  đòi hỏi tính sau nứt; chưa dự báo đường nứt hay bề rộng nứt theo 8.2.2.3.
- Mẫu kiểm tra gồm điểm Gauss và góc phần tử (giá trị phía phần tử, không làm
  trơn). Cực trị bản đồ tỷ số là cực trị trên các mẫu này. Chúng có thể khác
  cực trị Gauss ở thẻ tóm tắt; vẫn phải kiểm tra hội tụ và kỳ dị tại gối/lực điểm.
- Giới hạn |Δur| và |ΔD|/D là **yêu cầu riêng của dự án** theo nguyên tắc
  5.5, 8.2.3.1.2 và Phụ lục M. Không tự gán H/250 hay một phần đường kính
  làm giới hạn của TCVN. Để trống là chưa đánh giá.
- ΔD theo phương đường kính được tính bằng tổng ur ở hai điểm đối diện
  trên biên ngoài, nên không bị nhiễu bởi tịnh tiến vật rắn. Lưới số góc lẻ
  sử dụng nội suy tuần hoàn tại điểm đối diện.
- Không báo chuyển vị đạt nếu có dấu hiệu nứt, nén vượt nhánh đàn hồi tham
  khảo 0,6Rb,ser hoặc đang xét tải dài hạn. Chưa tính lịch sử từ biến/co ngót.
- Biến dạng chính hiển thị là biến dạng đàn hồi **quy đổi từ ứng suất tổng**
  bằng E và ν đang dùng. Không phải đo lại tổng biến dạng đã tích lũy trước
  mốc hữu hiệu, và không dùng giãn Poisson để kết luận nứt.

Ứng dụng hiển thị từng giá trị, giới hạn, tỷ số η, vị trí và điều khoản; η ≤ 1
chỉ có nghĩa chưa vượt ngưỡng riêng đang xét. `full_tcvn_verification` luôn
bằng false trong phiên bản này. Các phần sức kháng đa trục, ổn định, nén cục
bộ, bề rộng nứt và biến dạng dài hạn được ghi rõ là chưa đánh giá.

Xuất thêm CSV kiểm tra TCVN và các trường `tcvn_checks` trong JSON. Hai trường
hợp SLS/ULS có tóm tắt và trạng thái tiếp xúc riêng; bảng nội lực chính vẫn
hiển thị SLS. Đổi cấp B không tự thay E; nút “Dùng Eb theo Bảng 10” là lựa
chọn rõ ràng để cập nhật E.

Sau khi sửa Python cần khởi động lại máy chủ. API danh mục là GET
`/api/pipe/tcvn-materials`; POST `/api/pipe/solve` nhận thêm đối tượng `tcvn`:

```json
{"enabled": true, "grade": "B30", "duration": "short",
 "uls_load_factor": 1.4, "uls_prestress_factor": 1.0,
 "vertical_pour_over_1_5m": false,
 "radial_displacement_limit_m": 0.001,
 "diameter_change_limit_ratio": 0.001,
 "limit_basis": "Ví dụ giới hạn do nhiệm vụ thiết kế quy định"}
```

Các số 1.4 và 0.001 trong ví dụ là **dữ liệu minh họa**, không phải hệ số/giới
hạn mặc định của tiêu chuẩn. Không truyền `tcvn`, hoặc đặt `enabled: false`,
thì API giữ nguyên chế độ chỉ giải nội lực.

Tham khảo nội bộ: [Q4 continuum](./Ref/CIMNE/MAT-fem_v1.3/QdStif_v1_3.m),
[ma trận vật liệu](./Ref/CIMNE/MAT-fem_v1.3/constt.m),
[lưới vành khuyên](./annular_plate_fem.py),
[bộ giải tròn xoay hiện có](./annular_solid_fem.py).
