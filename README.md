# ⚖️ MTL — Nhân Viên Kinh Doanh

**Công ty Luật TNHH Minh Tú** · Ứng dụng nội bộ dành cho nhân viên kinh doanh

---

## Tính Năng

| Tab | Mô tả |
|-----|-------|
| 📋 Tạo Báo Giá | AI soạn Thư Báo Phí · Xuất Word logo MTL · Lưu CRM |
| 📝 Tạo Hợp Đồng | 10 điều khoản chuẩn pháp lý VN · Tự điền từ CRM |
| 👥 CRM Khách Hàng | Quản lý hồ sơ · Tìm kiếm · Lọc · Xuất CSV |

---

## Cấu Trúc Thư Mục

```
MTL-NhanVienKD\
├── app_nhanvien.py          ← App chính (Streamlit)
├── startup.py               ← Kiểm tra môi trường
├── requirements.txt
├── package.json             ← Node.js docx
├── Dockerfile               ← Railway builder
├── railway.json
├── .env.example             ← Mẫu biến môi trường
├── .gitignore
├── agents\
│   ├── __init__.py
│   ├── hop_dong_agent.py    ← Class HopDongAgent (AI + Word export)
│   ├── crm_manager.py       ← CRM API module
│   ├── word_bao_gia.js      ← Template Thư Báo Phí MTL Navy-Gold
│   └── word_hop_dong.js     ← Template Hợp Đồng 10 điều khoản
└── data\
    ├── mau\
    │   ├── LOGO.jpg          ← Logo MTL (copy thủ công — xem bên dưới)
    │   └── QR_CTY_LMT.jpg   ← QR MB Bank (copy thủ công)
    ├── hop_dong\             ← File .docx xuất ra (tự tạo)
    └── crm\                  ← Backup CRM (tự tạo)
```

---

## Cài Đặt Local (Windows)

### Yêu cầu
- Python 3.11+
- Node.js 20+
- Git (tùy chọn)

### Bước 1 — Tạo môi trường Python

```bash
cd D:\MTL-Nhân viên KD
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### Bước 2 — Cài Node.js dependencies

```bash
npm install
```

### Bước 3 — Tạo file .env

```bash
copy .env.example .env
```

Mở `.env` và điền:
```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NV_PASSWORD=MinhTu@2026
```

### Bước 4 — Copy ảnh logo và QR (từ dự án chính)

```bash
copy D:\tro-ly-phap-ly-1\data\mau\LOGO.jpg          data\mau\LOGO.jpg
copy D:\tro-ly-phap-ly-1\data\mau\QR_CTY_LMT.jpg    data\mau\QR_CTY_LMT.jpg
```

### Bước 5 — Chạy ứng dụng

```bash
python startup.py
streamlit run app_nhanvien.py --server.port 8502
```

Truy cập: **http://localhost:8502**
Mật khẩu: `MinhTu@2026`

---

## Deploy Railway

### Bước 1 — Tạo Git repo

```bash
cd "D:\MTL-Nhân viên KD"
git init
git add .
git commit -m "init: MTL Nhân Viên KD"
```

### Bước 2 — Push lên GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/mtl-nhanvien-kd.git
git push -u origin main
```

### Bước 3 — Tạo project Railway mới

1. Vào [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Chọn repo `mtl-nhanvien-kd`
3. Railway tự detect `Dockerfile` và build

### Bước 4 — Set biến môi trường trên Railway

Vào **Settings → Variables → Add Variable**:

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | `sk-ant-...` (lấy từ console.anthropic.com) |
| `NV_PASSWORD` | `MinhTu@2026` (hoặc mật khẩu tùy chỉnh) |

### Bước 5 — Generate domain

**Settings → Networking → Generate Domain** → URL dạng:
`https://mtl-nhanvien-kd.up.railway.app`

---

## Xuất Word — Yêu cầu

Tính năng xuất `.docx` hoạt động khi:
- ✅ Node.js đã cài (`node --version` ≥ 18)
- ✅ `npm install` đã chạy (có thư mục `node_modules/`)
- ✅ `agents/word_bao_gia.js` và `agents/word_hop_dong.js` tồn tại
- ✅ (Tùy chọn) `data/mau/LOGO.jpg` và `data/mau/QR_CTY_LMT.jpg` để hiện logo/QR

Nếu Node.js chưa có → app vẫn chạy, chỉ nút "Xuất Word" báo lỗi.
Nút **Xuất TXT** luôn hoạt động như phương án dự phòng.

---

## CRM — Lưu Trữ Dữ Liệu

Dữ liệu CRM lưu tại `data/crm.json` — **không upload lên Git** (đã có trong `.gitignore`).

Trên Railway: dữ liệu mất khi redeploy (do ephemeral filesystem).
**Giải pháp bền vững cho Railway:**
1. Dùng Railway Volume (mount tại `/app/data`)
2. Hoặc kết nối PostgreSQL/MongoDB (liên hệ dev để nâng cấp)

Để backup thủ công: dùng nút **↓ CSV** trong tab CRM.

---

## Thương Hiệu MTL

| Thông tin | Giá trị |
|-----------|---------|
| Navy | `#1B4A7A` |
| Gold | `#B8973A` |
| Font | Times New Roman |
| GPĐKHĐ | 41.02.4764/TP/ĐKHĐ |
| MST | 0318941023 |
| TK MB Bank | 5150056789 |
| Hotline | 1900 0031 |

---

## Liên Hệ

- **LS. Võ Hồng Tú** — votu@luatminhtu.vn — 0967.837.868
- **Hotline**: 1900 0031
- **Web**: [luatminhtu.vn](https://luatminhtu.vn)
- **HCM**: 4/9 Đường số 3, Cư Xá Đô Thành, P. Bàn Cờ, Q.3
- **ĐN**: 81 Xô Viết Nghệ Tĩnh, P. Cẩm Lệ, TP. Đà Nẵng
