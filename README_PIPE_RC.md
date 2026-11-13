# Bài toán riêng: cọc có thép đai và thép dọc

Chạy `python app.py --no-browser`, mở **http://127.0.0.1:8080/pipe_rc.html**.
[Bài toán không kể thép](./README_PIPE.md) vẫn ở `/pipe.html` để đối chiếu.

Nếu cổng 8080 vẫn có máy chủ cũ chưa nạp API mới, có thể chạy riêng:

```powershell
$env:FEM_PORT='8082'
python app.py --no-browser
```

Khi đó mở **http://127.0.0.1:8082/pipe_rc.html**.

## Bộ minh họa, cần thay bằng dữ liệu thực tế

Giữ D600, thành 100 mm, bê tông B60, tải hướng tâm 20 kN/m tại 60° và 120°,
nền và hai cọc bên quy đổi thành ba chặn một chiều như bài toán trước.

Thép mẫu **không phải cấu tạo được khuyến nghị hoặc thiết kế đã kiểm tra**:

- Một lồng gồm 12 thanh dọc đường kính 12 mm, CB400-V, phân bố đều.
- Đai tròn kín đường kính 6 mm, bước 100 mm dọc cọc, CB240-T.
- Lớp bảo vệ 30 mm, đo tới mép ngoài đai; Es = 200 GPa.
- Bán kính tâm đai: `R - cover - dh/2`.
- Bán kính tâm thanh dọc: `R - cover - dh - dl/2`.
- Có thể đặt số thanh dọc = 0 hoặc đường kính đai = 0 để tắt từng thành phần.

Các ô cho phép đổi số thanh, đường kính, bước, cấp thép, Es, lớp bảo vệ và góc
thanh đầu tiên. Kiểm tra hình học từ chối lớp thép ngoài thành hoặc thanh dọc
chồng lấn. Chưa kiểm tra đầy đủ cấu tạo, neo, lớp bảo vệ tối thiểu hay hàm lượng
thép tối thiểu theo tiêu chuẩn.

## Làm việc đồng thời

Bê tông vẫn là Q4 liên tục 2D. Đai là đường thép một trục nhúng trong phần tử:
biến dạng dọc đường thép được tính từ chuyển vị của Q4, với bám dính hoàn toàn.
Diện tích đai quy đổi cho một mét dọc cọc là `Ah/pitch`. Tích phân đóng góp
`Es*(Ah/pitch)*Bsteel.T*Bsteel*ds` vào ma trận độ cứng trước khi giải tiếp xúc.
Đai kín không phải đai xoắn có góc nghiêng; không mô hình sức kháng cắt của đai.

Thép dọc có cùng gia số biến dạng dọc đồng đều với bê tông. Trong chế độ giữ
lực dọc toàn hệ:

```
delta_P_concrete + delta_P_longitudinal_steel = 0
delta_sigma_longitudinal_steel = Es * delta_epsilon_z
```

Nếu giữ biến dạng dọc, `delta_epsilon_z = 0`: thép dọc không phát sinh gia số
ứng suất. Đây là hệ quả của mô hình bất biến dọc cọc, không phải thiếu bước
lắp ráp. Chưa có uốn dọc, trượt bám dính, biến dạng cục bộ theo chiều dài,
chảy thép hay phân phối lại nội lực sau nứt.

Thép được cộng vào miền bê tông toàn phần theo phép xấp xỉ cốt thép nhúng;
chưa trừ phần bê tông bị thép chiếm chỗ. Không tự tăng cường độ bê tông do đai
bó. Cần phân tích khác nếu biến dạng lớn, nứt hoặc cơ chế bó ngang chi phối.

## Trạng thái nén trước

Nén trước hữu hiệu trong bê tông vẫn là trạng thái ban đầu đã cân bằng, không
đưa lại như tải nén mới. Ứng suất thép dọc ban đầu nhập **riêng**, dương khi kéo,
âm khi nén. Giá trị 0 mặc định chỉ là giả thiết minh họa của trạng thái tham
chiếu; không được suy ra rằng thép thường thực tế có ứng suất bằng 0 khi bê
tông đã nén trước 5 MPa.

Ứng suất đai ban đầu bằng 0. Tương thích áp dụng cho **gia số** biến dạng từ
mốc này; chương trình không tái tạo quá trình truyền ứng suất, từ biến hoặc
tổn hao. Tổng lực dọc ban đầu gồm cả bê tông và thép; lực duy trì trạng thái đó
được coi là đã có. Chưa hỗ trợ cáp không bám dính hoặc tự tính lực căng cáp.

Hệ số nén trước TTGH1 áp dụng đồng thời lên nén trước bê tông và ứng suất thép
dọc ban đầu. Hệ số tải không nhân lại ứng suất ban đầu.

## Kết quả

- Ứng suất và gia số biến dạng của đai tại điểm tích phân.
- Ứng suất ban đầu, gia số, tổng và lực của từng thanh dọc.
- Phân chia tổng lực dọc, năng lượng biến dạng giữa bê tông và thép.
- Nội lực qua thành gồm đóng góp của thép; các trường `_concrete` và `_steel`
  trong JSON tách riêng từng thành phần.
- Nz/Mz thép dọc xuất theo diện tích thép quy đổi đều trên chu vi đa giác mặt
  trung bình. Tổng lực dọc toàn tiết diện được tính trực tiếp bằng tổng lực
  từng thanh; không nhầm với Nz theo đơn vị chiều dài chu vi.
- Có thể giải thêm cùng tải/gối nhưng không kể thép để so sánh chuyển vị.
- CSV riêng cho ứng suất/lực thép; JSON chung có cả cấu hình và kết quả.

Kiểm tra vật liệu dựa trên [TCVN 5574:2018](https://www.rds.com.vn/TCXD1/TCVN5574-2018.pdf):
Bảng 12/13 cho ứng suất dọc thanh. Rsw trong Bảng 14 không thay Rs khi kiểm tra
lực vòng trực tiếp. Bê tông có xét thép dùng γb2 = 1 trong bộ kiểm tra này;
điều kiện cấu tạo để phân loại bê tông cốt thép vẫn phải kiểm tra riêng.
Các hàng kiểm tra là sàng lọc ứng suất đàn hồi, không phải xác nhận đầy đủ
sức kháng tiết diện, bề rộng nứt hoặc điều kiện không nứt bắt buộc.

## Kiểm chứng

```
python -m unittest test_annular_pipe_rc test_annular_pipe_fem test_tcvn5574_checks test_annular_pipe_api test_annular_solid_fem -v
```

Các bài độc lập gồm: nghiệm Lamé với thép dọc và điều kiện lực dọc toàn hệ;
nghiệm Lamé hai miền có đường đai tại mặt phân cách; độ giãn hình học của
đường đai; giới hạn thép bằng 0; cân bằng cọc D600; và hồi quy bộ giải cũ.

Tham khảo nguyên lý cốt thép nhúng:
[DIANA](https://manuals.dianafea.com/d1010/en/1353862-1354159-embedded-reinforcements.html),
[Abaqus](https://docs.software.vt.edu/abaqusv2026/English/SIMACAEMODRefMap/simamod-c-rebarlayer.htm).

## So sánh khi tăng tải theo cấp

Chạy `python compare_pipe_load_steps.py --check-fine` để tăng đồng thời hai lực của bộ D600
từ 0 đến 200 kN/m cho mỗi lực, giải lại tiếp xúc ở từng cấp. Bài tính giữ nguyên nén trước
hữu hiệu 5 MPa minh họa và cấu hình thép nêu trên; dùng `--prestress-mpa` để thay giá trị.

Xem [báo cáo và biểu đồ](./results/load_steps_d600/report.html),
[ảnh PNG](./results/load_steps_d600/load_displacement.png),
[bảng CSV](./results/load_steps_d600/load_steps.csv) và
[dữ liệu/cấu hình JSON](./results/load_steps_d600/results.json).
Tệp HTML nhúng biểu đồ SVG nên có thể mở độc lập. `--loads`, `--nr`, `--ntheta` và `--output`
cho phép đổi cấp tải, lưới và nơi xuất kết quả; ntheta cần chia hết cho 12 để khớp góc tải/gối.

Các mốc chạm `Rbt,ser` được tìm rồi giải lại tại đúng tải đó. Phần đường vượt ngưỡng kéo
được vẽ nét đứt: đây là **ngoại suy đàn hồi, chưa phải đáp ứng sau nứt hay tải phá hoại**.
Chương trình kiểm tra cân bằng, trạng thái tiếp xúc và tính tỷ lệ chuyển vị/năng lượng của
bộ D600. Kết quả đỉnh ứng suất với lực/gối điểm phụ thuộc lưới; mốc sàng lọc không thay thế
kiểm tra không nứt đầy đủ theo TCVN hoặc mô hình tiếp xúc trên cung hữu hạn.

## So sánh đường kính và chiều dày

Chạy `python compare_pipe_thickness.py` để tính D600 và D800 với các chiều dày
80, 100, 120 và 150 mm cho cả hai đường kính. Mỗi hình học được giải cả có và không kể thép,
ở 9 cấp tải ngang từ 0 đến 200 kN/m cho mỗi lực và tại các mốc chạm ngưỡng kéo.
Giữ B60, nén trước hữu hiệu 5 MPa minh họa, cấu hình thép và các chặn như bài D600.
Đường kính trong được tính lại theo D − 2t; số nút tải/gối được tạo lại theo từng lưới.

Lưới chính 12 × 192; đối chiếu 18 × 288 cho cả 8 hình học. Xem
[báo cáo](./results/thickness_d600_d800/report.html),
[biểu đồ chiều dày](./results/thickness_d600_d800/thickness_comparison.png),
[biểu đồ ảnh hưởng thép và đường kính](./results/thickness_d600_d800/steel_and_diameter_effect.png),
[CSV tổng hợp](./results/thickness_d600_d800/summary.csv) và
[dữ liệu JSON](./results/thickness_d600_d800/results.json).

Kết quả chuyển vị cho thấy xu hướng giảm rõ khi tăng chiều dày, trong khi tải chạm ngưỡng kéo
cục bộ có thể nhạy mạnh với lưới do gối/lực điểm. Báo cáo thể hiện cả hai lưới; không dùng các
mốc sàng lọc làm tải không nứt đã được xác nhận hoặc tải phá hoại. Cùng ứng suất trước nhưng
diện tích bê tông khác nhau đồng nghĩa lực nén trước ban đầu khác nhau. Hàm lượng thép cũng
thay đổi vì giữ cùng cấu hình thép, không giữ cùng tỷ lệ thép.
