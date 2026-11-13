# Web riêng cho cọc bê tông rỗng

Chạy `python pile_app.py --no-browser`, mở **http://127.0.0.1:8083/**.
Đổi cổng bằng `python pile_app.py --port 8084` nếu cổng đang được sử dụng.
Không cần Node, CDN hoặc cài thêm thư viện ngoài NumPy/SciPy đã dùng trong dự án.

- Trang chọn mô hình: `/` hoặc `/piles.html`.
- Cọc hữu hạn với phần tử khối 3D: `/pile3d.html`.
- Mặt cắt ngang không kể thép: `/pipe.html`.
- Mặt cắt có thép: `/pipe_rc.html`.

Máy chủ và trang Mindlin cũ vẫn khởi động riêng bằng `python app.py`.
Bộ giải khối tròn xoay cũ không dùng để thay thế bài toán cọc chịu ép ngang.

## Bộ mặc định 3D

D ngoài 600 mm, thành 100 mm, L = 12 m. Bê tông B60, E = 39,5 GPa, ν = 0,2.
Ứng suất trước hữu hiệu đều theo z = −5 MPa là giá trị minh họa, sau tổn hao.
Hai lực đường hướng tâm tại 60° và 120°, mỗi lực 20 kN/m, không đổi dọc toàn bộ L.
Tổng thành phần đứng là −2 × 20 × sin(60°) × 12 = −415,692 kN.

Tâm gối A tại z = 0,2L = 2,4 m; tâm gối B tại z = 0,8L = 9,6 m.
Bề rộng dọc cọc 0,3 m; vùng tìm tiếp xúc quanh đáy rộng 30°. Không thêm nền liên tục.
Tự trọng và hai chặn bên mặc định tắt. Có thể bật trên giao diện.

Gối mặc định là mặt phẳng ở y = −R. Với mỗi nút ứng viên ngoài cọc, khe hở hình học
là g = y + R; điều kiện uy ≥ −g, phản lực chỉ theo y và không chịu kéo. Có thể nhấc,
trượt ngang và trượt dọc. Không đồng nhất cả cung tìm tiếp xúc thành cung đã tì.
Tùy chọn gối yên ôm cung dùng ur ≤ 0 và phản lực pháp tuyến xuyên tâm, không ma sát.
Gối có bề rộng hữu hạn nên hợp lực có thể lệch tâm; xuất cả z tâm và z hợp lực.

## Phần tử và mô hình

[HeStif3D_v1_2.m](./Ref/CIMNE/MAT-fem3D_v1.2/HeStif3D_v1_2.m) và
[HeStrs3D_v1_2.m](./Ref/CIMNE/MAT-fem3D_v1.2/HeStrs3D_v1_2.m) cung cấp dạng hàm nội suy
hexahedron 8 nút và tích phân 2 × 2 × 2. Mỗi nút có ba chuyển vị, không có bậc tự do quay.

Mặc định H8_EAS bổ sung 13 trường biến dạng nội bộ và khử tĩnh tại mức phần tử:
9 mode gradient và 4 mode thể tích. Trường bổ sung dùng Jacobian tại tâm và tỷ số
detJ(0)/detJ(ξ), trực giao với trường ứng suất không đổi. Có H8_FULL để đối chiếu hiện tượng
quá cứng khi uốn. Không sử dụng tích phân một điểm không kiểm soát hourglass.
Tham khảo [Abaqus: incompatible modes](https://docs.software.vt.edu/abaqusv2026/English/SIMACAETHERefMap/simathe-c-incompatible.htm),
[Bower, mục 8.6](https://solidmechanics.org/Text/Chapter8_6/Chapter8_6.htm).

Tải đường phân bổ nhất quán về hai nút đầu mỗi đoạn z, trọng số qΔz/2.
Lưới chèn đúng tâm/mép gối và góc đặt lực. Bộ giải kiểm tra tiếp xúc một chiều bằng
active set; sáu chuyển động vật rắn còn tự do được loại bằng điều kiện chọn nghiệm
không sinh phản lực, không tự thêm gối neo. Tự trọng, nếu bật, tích phân theo thể tích.

Giới hạn 16.000 nút, 12.000 phần tử để tránh bài tính vượt tài nguyên máy cục bộ.
Cấu hình mặc định tạo 6.480 nút và 4.224 phần tử. Lưới thay đổi khi góc, gối hoặc L đổi.

## Kết quả và đơn vị

Giao diện dùng mm, MPa, kN và kN·m; API/JSON/CSV ghi đơn vị SI trong tiêu đề.

- Hình khối xoay/thu phóng; mặt cắt có thể chọn theo z. Hệ số phóng đại chỉ áp dụng hình vẽ.
- Màu ứng suất ở tâm phần tử. Cực trị và sàng lọc lấy ở 8 điểm Gauss, có tọa độ bất lợi.
- Chuyển vị trục cọc là trung bình diện tích trên mặt cắt, không phải chuyển vị một nút đơn lẻ.
- Trên tiết diện pháp tuyến +z: N = ∫σz dA; Vx = ∫τxz dA; Vy = ∫τyz dA;
  Mx = ∫yσz dA; My = −∫xσz dA; T = ∫(xτyz−yτxz) dA. Chiều mô men theo bàn tay phải.
- Nội lực vòng tích phân qua thành tại từng dải góc, có Nθ, Mθ, Qθ, Nz, Mz, Nθz.
  Các lực này có đơn vị N/m, mô men N·m/m; khác nội lực toàn tiết diện ở trên.
- Xuất nút, nội lực dọc và nội lực vòng tại lát cắt thành CSV; JSON gồm mô hình và kết quả.
  Khi sửa đầu vào, kết quả cũ được đánh dấu và khóa xuất. Có thể nạp lại đầu vào JSON.

## Ứng suất trước và phạm vi kiểm tra

Ứng suất trước là trạng thái tham chiếu đã cân bằng. Không đưa lại nén trước như một
tải mới; khi không có tải tăng thêm, chuyển vị tăng thêm và phản lực tăng thêm bằng 0.
σz tổng = Δσz − p0. Nén trước không bị nhân theo tải ép ngang. Chưa khôi phục quá trình
truyền ứng suất hoặc lực duy trì trạng thái ban đầu.

Chưa có cốt thép trong mô hình khối, từ biến, nứt, chảy vật liệu, biến dạng lớn hoặc độ cứng
hình học P–Δ. Chưa đánh giá ổn định dọc. Sàng lọc dùng ứng suất chính thật của tensor 3D,
kể cả τxz và τyz, so với cường độ bê tông nặng trong TCVN 5574:2018; đây không phải
xác nhận đầy đủ TTGH1/TTGH2. Khi vượt ngưỡng kéo hoặc nén đàn hồi, chuyển vị vẫn là
kết quả với độ cứng ban đầu. Cần mô hình phi tuyến để kết luận sau nứt.

Tải đường và tiếp xúc gối cứng có thể gây đỉnh ứng suất phụ thuộc lưới. Cần kiểm tra
độ nhạy theo lưới và xác định bề mặt gối thực tế trước khi dùng ứng suất cục bộ để thiết kế.
Mặt cắt 2D có gối liên tục và cọc 3D có hai gối không có cùng điều kiện biên.

## Kiểm chứng

`python -m unittest test_pile_solid3d test_annular_pipe_fem test_annular_pipe_api test_annular_pipe_rc test_tcvn5574_checks test_annular_solid_fem -v`

Các bài độc lập: patch test affine trên khối méo; đúng sáu mode vật rắn, không có hourglass;
uốn thuần với ứng suất và năng lượng giải tích; nghiệm Lamé 3D đầu tự do và kiểm tra hội tụ;
đối chiếu nội lực/chuyển vị dầm dài hai đầu thừa với nghiệm đàn hồi có biến dạng cắt; phản lực/cân bằng
hai gối và điều kiện một chiều; tải hướng lên không tự sinh gối chịu kéo; nén trước không
tạo lại chuyển vị; tự trọng; giới hạn lưới; kiểm tra HTTP và các trang mặt cắt cũ.
