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
