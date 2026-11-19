# Cơ sở Tính toán & Kiểm chứng Độc lập — Module Xếp cọc PHC (Mốc M1: `BT00 – BT02`)

## 1. Hệ đơn vị SI thống nhất và phân tách dữ liệu
Toàn bộ lõi tính toán (`src/core/` và `src/modules/xep-coc/`) tuân thủ nghiêm ngặt hệ đơn vị **SI cơ sở (`m, kg, s`)** và các đơn vị dẫn xuất **`N, Pa, N·m, N/m`**. Việc chuyển đổi sang `mm, cm², cm⁴, MPa, kN, kN·m` chỉ thực hiện tại biên giao diện (`src/core/units.js`).

Mỗi bản ghi cọc được tách thành 3 nhóm độc lập (`Object.freeze`):
1. `reference`: Thông tin bản vẽ và các trị số công bố (`Mcr, Mu`, tải thi công, ghi chú `N2, ØGC, L2`) — hoàn toàn cô lập, không đi vào bộ giải.
2. `input`: Hình học (`Do, Dp, Di`), chiều dài `L > 0` do người dùng nhập, cấp bê tông theo **TCVN 5574:2018**, thép dự ứng lực (`N1, ØPC`) và phân vùng đai xoắn dọc trục.
3. `computed`: Kết quả tự tính chỉ đọc từ `input`.

---

## 2. Cơ sở tính toán Bài toán `BT00` (Đặc trưng tiết diện & Vật liệu TCVN 5574:2018)

### 2.1. Đặc trưng hình học và tiết diện quy đổi (Bỏ thép dọc gia cường đầu cọc `N2, ØGC, L2`)
Với đường kính ngoài $D_o$, đường kính trong $D_i$, đường kính vòng bố trí thép dự ứng lực $D_p$ và $N_1$ thanh thép dự ứng lực đường kính $d_{\text{pc}}$:
- Chiều dày thành cọc tự tính:
  $$t = \frac{D_o - D_i}{2}, \quad r_o = \frac{D_o}{2}, \quad r_i = \frac{D_i}{2}, \quad r_p = \frac{D_p}{2}$$
- Diện tích hình học vành khăn ($A_g$), diện tích thép dự ứng lực ($A_p$) và diện tích bê tông thuần ($A_b$):
  $$A_g = \frac{\pi}{4}(D_o^2 - D_i^2), \quad A_p = N_1 \frac{\pi}{4} d_{\text{pc}}^2, \quad A_b = A_g - A_p$$
- Mômen quán tính hình học ($I_g$) và mômen quán tính vòng thép DƯL ($I_{p,\text{ring}}$ với $N_1 \ge 3$ thanh bố trí đều trên vòng bán kính $r_p$):
  $$I_g = \frac{\pi}{64}(D_o^4 - D_i^4), \quad I_{p,\text{ring}} = \sum_{k=1}^{N_1} A_{p1} z_k^2 = \frac{1}{2} A_p r_p^2$$
- Hệ số quy đổi đàn hồi $\alpha = E_p / E_b$, diện tích quy đổi ($A_{\text{red}}$), mômen quán tính quy đổi ($I_{\text{red}}$) và môđun chống uốn quy đổi ($W_{\text{red}}$):
  $$A_{\text{red}} = A_g + (\alpha - 1) A_p, \quad I_{\text{red}} = I_g + (\alpha - 1) I_{p,\text{ring}}, \quad W_{\text{red}} = \frac{2 I_{\text{red}}}{D_o}$$
- Khối lượng dài và tự trọng phân bố đều (với $g = 9,80665\text{ m/s}^2$):
  $$m_l = \rho A_g \ (\text{kg/m}), \quad q = \rho g A_g \ (\text{N/m})$$

### 2.2. Hàm phân vùng cốt đai xoắn dọc trục `section(x)`
Chiều dài vùng đầu cọc mỗi đầu là $L_{\text{end}} = \min(L/2, 2 D_o)$:
- Khi $x \in [0, L_{\text{end}}] \cup [L - L_{\text{end}}, L]$: vùng đầu cọc (`zone = "end"`, thường bố trí 2 dây đai xoắn bước $50\text{ mm}$).
- Khi $x \in (L_{\text{end}}, L - L_{\text{end}})$: vùng thân giữa (`zone = "mid"`, thường bố trí 1 dây đai xoắn bước $100\text{ mm}$).

---

## 3. Cơ sở tính toán Bài toán `BT01` & `BT02` (FEM vs. Nghiệm giải tích Macaulay)

### 3.1. Phần tử hữu hạn dầm Euler–Bernoulli (`src/core/fem_solver.js`)
Sử dụng phần tử dầm Hermite bậc 3 gồm 2 nút, mỗi nút 2 bậc tự do $(w_i, \theta_i = dw/dx|_i)$ với ma trận độ cứng phần tử chuẩn xác và vector tải nút tương đương của tải phân bố đều $q$. Các điểm đặt gối $x_1, x_2$, các điểm đặt tải tập trung $x_{P1}, x_{P2}$ và ranh giới phân vùng $L_{\text{end}}, L - L_{\text{end}}$ luôn được chèn làm nút chính xác trên lưới.

### 3.2. Nghiệm giải tích đóng bằng hàm kỳ dị Macaulay (`solveAnalyticalBeamTwoSupports`)
Với cọc dài $L$, độ cứng uốn $EI$, đặt trên hai gối điểm lý tưởng tại $0 \le x_1 < x_2 \le L$, chịu tải tự trọng đều $q$ và các tải tập trung $\{(x_{pk}, P_k)\}$:
- Phản lực gối từ phương trình cân bằng tĩnh học:
  $$R_2 = \frac{q L (L/2 - x_1) + \sum_k P_k (x_{pk} - x_1)}{x_2 - x_1}, \quad R_1 = q L + \sum_k P_k - R_2$$
- Nội lực tại tọa độ $x$ (với $\langle u \rangle_+ = \max(0, u)$):
  $$M(x) = -\frac{1}{2} q x^2 + R_1 \langle x - x_1 \rangle_+ + R_2 \langle x - x_2 \rangle_+ - \sum_k P_k \langle x - x_{pk} \rangle_+$$
- Độ võng giải tích $w(x)$ từ tích phân phương trình vi phân $EI w''(x) = M(x)$ với điều kiện biên $w(x_1) = 0, w(x_2) = 0$:
  $$g(x) = \frac{1}{24} q x^4 - \frac{1}{6} R_1 \langle x - x_1 \rangle_+^3 - \frac{1}{6} R_2 \langle x - x_2 \rangle_+^3 + \frac{1}{6} \sum_k P_k \langle x - x_{pk} \rangle_+^3$$
  $$C_1 = -\frac{g(x_2) - g(x_1)}{x_2 - x_1}, \quad C_0 = -g(x_1) - C_1 x_1, \quad w(x) = -\frac{g(x) + C_1 x + C_0}{EI}$$

Khi tải tập trung đặt đúng tại gối ($x_{p1} = x_1, x_{p2} = x_2$), các số hạng $\langle x - x_1 \rangle_+$ của $P_1$ và $\Delta R_1 = P_1$ triệt tiêu nhau hoàn toàn, chứng minh giải tích và số học rằng tải tầng trên đặt đúng gối lý tưởng chỉ làm tăng phản lực gối mà không sinh thêm mômen uốn hay độ võng trên cọc.

---

## 4. Cơ sở các kiểm tra BT03–BT12 (hiệu chỉnh v1.1.0)

Toàn bộ hệ số tiêu chuẩn được tập trung tại `src/modules/xep-coc/standards/tcvn5574_factors.js` kèm điều khoản truy vết.

### 4.1. Hệ số và vật liệu
- Tải bản thân: lực truyền giữa các bộ phận là giá trị tiêu chuẩn; kiểm tra TTGH I nhân $\gamma_f = 1{,}1$ (TCVN 2737), kiểm tra nứt dùng giá trị tiêu chuẩn.
- Lưu kho là tải dài hạn: $R_b, R_{bt}$ nhân $\gamma_{b1} = 0{,}9$ (TCVN 5574:2018 Mục 6.1.2). Có thể chọn "ngắn hạn" ($\gamma_{b1} = 1{,}0$) khi có cơ sở.
- Biến dạng giới hạn $\varepsilon_{b0} = 0{,}002$, $\varepsilon_{b2} = 0{,}0035$ chỉ áp dụng cho $B \le B60$. Với cấp cao hơn, app báo "ngoài miền hiệu lực" và không xuất kết luận đạt cho tới khi bổ sung bảng hiệu chỉnh.

### 4.2. Dự ứng lực (Mục 9.1)
- Phân loại thép quyết định giới hạn và công thức chùng ứng suất:
  - Thép thanh nhiệt luyện / cán nóng: $\sigma_{sp0} \le 0{,}9R_{s,n}$, $\Delta\sigma_{sp1} = 0{,}1\sigma_{sp0} - 20$ MPa.
  - Thép sợi kéo nguội / cáp: $\sigma_{sp0} \le 0{,}8R_{s,n}$, $\Delta\sigma_{sp1} = (0{,}22\sigma_{sp0}/R_{s,n} - 0{,}1)\sigma_{sp0}$.
- $\sigma_{sp0}$, $L_{cang}$ và giả thiết khi $\Delta T = 0$ bắt buộc khai báo; không có giá trị mặc định ngầm.
- Tổng tổn hao: $\Delta\sigma_{sp} = \max\left(\sum_{i=1}^{6}\Delta\sigma_{sp,i};\ 100\text{ MPa}\right)$.
- Ứng suất nén trước: $\sigma_{pc} = P_{eff}/A_{red}$. Trong kiểm tra nứt, uốn TTGH I và cắt, dự ứng lực nhân $\gamma_{sp} = 0{,}9$ (có lợi).
- Kiểm tra lúc truyền lực tách khỏi kết luận lưu kho:
  - Cấp bê tông lúc truyền lực do người dùng khai báo, yêu cầu $\ge \max(15\text{ MPa};\ 0{,}5B)$.
  - Giới hạn sơ bộ $1{,}1\sigma_{bp} \le 0{,}9R_{b,n}$ (cần đối chiếu điều khoản trước khi kết luận).

### 4.3. Uốn và nứt dọc cọc
- Mômen nứt: mô hình biến dạng phi tuyến, thớ kéo đạt $\varepsilon_{bt2}$. Đối chứng cận dưới đàn hồi: $M_{crc,el} = (0{,}9\sigma_{pc} + R_{bt,ser})W_{red}$.
- Sức kháng uốn: thép DƯL theo biểu đồ 3 đoạn thẳng có giới hạn chảy quy ước.
  - Các điểm đặc trưng: $\sigma_{s1} = 0{,}9R_s$; $\varepsilon_{s0} = R_s/E_s + 0{,}002$.
  - Trạng thái giới hạn là trạng thái đến trước giữa hai điều kiện: bê tông đạt $\varepsilon_{b2}$, hoặc thanh chịu kéo lớn nhất đạt $\varepsilon_{s2} = 0{,}015$.

### 4.4. Cắt (Mục 8.1.3)
Tiết diện vành khăn quy về $b = 2t$, $h_0 = 0{,}9D_o$ (giả thiết công bố). Sức kháng cắt:
$$Q_{Rd} = \min\left(0{,}3R_b b h_0;\ \min_{c\in[h_0;\,3h_0]}\left[\operatorname{clamp}\!\left(\frac{\varphi_{b2}\varphi_n R_{bt} b h_0^2}{c},\ 0{,}5R_{bt}bh_0,\ 2{,}5R_{bt}bh_0\right) + 0{,}75\,q_{sw}\min(c, 2h_0)\right]\right)$$
- Cốt đai xoắn chỉ được kể khi $q_{sw} \ge 0{,}25R_{bt}b$.
- Đai tính 1 nhánh trên mỗi bước, thiên an toàn.

### 4.5. Nén cục bộ (Mục 8.1.5)
$$N_c = \gamma_f N \le \psi\,\varphi_b R_b A_{loc}, \qquad \varphi_b = 0{,}8\sqrt{A_{max}/A_{loc}} \in [1; 2{,}5], \qquad A_{max} = (b_x + 2t)\cdot\min(D_o,\ b_c + 2t)$$
- Tiếp xúc cọc–kê: $b_c = \max(\text{dây cung theo góc ôm } \theta_c \text{ khai báo};\ b_{Hertz})$.
- Tiếp xúc cọc–cọc: $b_c$ lấy theo bề rộng Hertz đàn hồi với $R_{eff} = D_o/4$, $E^* = E_b/[2(1-\nu^2)]$.

### 4.6. Uốn vòng thành cọc (BT05)
Bộ giải vòng kín đàn hồi theo phương pháp lực, với 3 ẩn dư $(M_0, F_{x0}, F_{y0})$ và chỉ xét biến dạng uốn:
- Vòng chịu các lực hướng kính điểm bất kỳ.
- Phần hợp lực $\mathbf{G}$ không tự cân bằng truyền vào thân cọc bằng dòng cắt tiếp tuyến $q(\theta) = \mathbf{G}\cdot\mathbf{t}(\theta)/(\pi R)$.
- Kiểm chứng:
  - Hai lực đối tâm: trùng nghiệm Roark, $M(0) = PR/\pi$, $M(\pi/2) = -PR(1/2 - 1/\pi)$, sai số ~$10^{-15}$.
  - Lực điểm cân bằng bằng dòng cắt: $M = 3PR/(4\pi)$.

Sức kháng vòng:
- Nứt: $M_{crc} = R_{bt,ser}W_{pl} - N\,W/A$ với $W_{pl} = 1{,}3W$ (tiết diện chữ nhật). Thớ trong nhân thêm hệ số độ cong $1 + t/(3r_m)$.
- TTGH I: lấy $\max\left(R_{bt}W_{pl} - \gamma_f N W/A;\ M_{RC}\right)$ với tải nhân $\gamma_f$.
  - $M_{RC}$ chỉ tính khi đai xoắn nằm ở nửa thành phía thớ chịu kéo.
  - Đai quấn ngoài thép DƯL tại $r_{sw} = r_p + d_{pc}/2 + d_{sw}/2$, nên chỉ góp phần khi thớ ngoài chịu kéo.

Hệ lực hướng kính:
- S2: phản lực kê tại 180°, cộng tải kê trên tại 0° nếu nằm trong dải $b_{eff} = b_x + 4t$.
- S1 hàng đáy: phản lực kê, tiếp xúc cọc trên ±30° trong dải $b_{eff}$. Cọc biên có thêm tiếp xúc cạnh tại 90° và lực chèn biên tại 270°.
- Các hàng có tiếp xúc dọc thân: tải đường (dải 1 m) ở ±30° và 180° ± 30°.

**Miền hiệu lực:** mô hình vòng phẳng trên dải $b_{eff}$ là sàng lọc thiên an toàn, vì bỏ qua làm việc vỏ trụ theo phương dọc. Khi uốn vòng là cơ chế chi phối, phải hiệu chỉnh $b_{eff}$ bằng mô hình vỏ/khối hoặc thí nghiệm.

### 4.7. Hệ xếp S1/S3
- Lực đẩy ngang hàng đáy cộng dồn qua các tiếp xúc cạnh (chỉ chịu nén):
  - Cân bằng: $S_j = R_{trái} + \sum_{i\le j} H_i \ge 0$, chọn $R_{trái} = \max\left(0, -\min_j \sum_{i\le j} H_i\right)$.
  - Cọc biên chịu tải ngang phân bố $R_{biên}/L$, giữ tại $x_1, x_2$.
- Kiểm tra mọi hàng cọc. Nội lực dọc theo cột đại diện có tiếp xúc một phía, được chuẩn hóa về cọc đáy chịu lực đứng lớn nhất.
- Độ nhạy độ cứng tiếp xúc: tự giải lại với $k_c \times 0{,}1$ và $\times 10$, cảnh báo khi $\Delta M_{max} > 5\%$.
- S3:
  - Thanh kê trung gian đặt tải khối trên lên hàng đỉnh khối dưới, chia đều cho các cọc hàng đỉnh.
  - Tải truyền xuống qua tiếp xúc dọc thân và gây lực đẩy ngang trong khối dưới.
  - Tổng tải mỗi tuyến kê dưới khối lấy từ cân bằng tĩnh học của cả khối.
