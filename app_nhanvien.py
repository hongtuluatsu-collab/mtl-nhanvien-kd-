"""
app_nhanvien.py — Minh Tú Law | Nhân Viên Kinh Doanh
5 chức năng: Tạo Báo Giá · Tạo Hợp Đồng · CRM · Đề Nghị Thanh Toán · Phiếu Thu
Bảo mật: Tài khoản riêng · Tự động đăng xuất 5 phút · Log hoạt động
Google Drive: tự động sync CRM + tất cả file docx
"""
import streamlit as st
import os, json, re, csv, io, subprocess
from datetime import datetime, timedelta
from pathlib import Path
import anthropic
from dotenv import load_dotenv
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload
from google.oauth2 import service_account

load_dotenv()

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
st.set_page_config(
    page_title="MTL — Nhân Viên Kinh Doanh",
    page_icon="⚖️",
    layout="wide",
    initial_sidebar_state="collapsed",
)

API_KEY         = os.getenv("ANTHROPIC_API_KEY", "")
HOPDONG_DIR     = Path("data/hop_dong")
MAU_DIR         = Path("data/mau")
DRIVE_FOLDER_ID = "1jdKtlmQScB8hbpLYfGgvArbzfy8kxO4A"
CRM_FILENAME    = "crm.json"
LOG_FILENAME    = "activity_log.json"
NAVY            = "#1B4A7A"
GOLD            = "#B8973A"
TIMEOUT_MINUTES = 5

# Danh sách tài khoản — đọc từ Railway Variables NV_ACCOUNTS
# Format: NV_ACCOUNTS = {"admin":"matkhau_admin","nv1":"matkhau_nv1",...}
_default_accounts = {
    "admin":     os.getenv("NV_PASSWORD_ADMIN", "MinhTuAdmin@2026"),
    "nhanvien1": os.getenv("NV_PASSWORD_1",     "MTL_NV1@2026"),
    "nhanvien2": os.getenv("NV_PASSWORD_2",     "MTL_NV2@2026"),
    "nhanvien3": os.getenv("NV_PASSWORD_3",     "MTL_NV3@2026"),
}
try:
    _env_accounts = json.loads(os.getenv("NV_ACCOUNTS", "{}"))
    NV_ACCOUNTS = _env_accounts if _env_accounts else _default_accounts
except Exception:
    NV_ACCOUNTS = _default_accounts

# ─────────────────────────────────────────────
# CSS THƯƠNG HIỆU MTL
# ─────────────────────────────────────────────
st.markdown(f"""
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap');

  /* Nền toàn app */
  .stApp {{ background-color: #F8F5F0 !important; }}

  /* Ẩn header/footer Streamlit */
  #MainMenu, footer, header {{ visibility: hidden; }}
  .block-container {{ padding: 1rem 2rem; max-width: 1200px; }}

  /* ── NÚT PRIMARY → NAVY ── */
  .stButton > button {{
    border-radius: 6px !important;
    font-weight: 600 !important;
  }}
  .stButton > button[kind="primary"],
  button[data-testid="baseButton-primary"] {{
    background-color: {NAVY} !important;
    border: none !important;
    color: white !important;
  }}
  .stButton > button[kind="primary"]:hover,
  button[data-testid="baseButton-primary"]:hover {{
    background-color: {GOLD} !important;
    color: white !important;
  }}

  /* ── INPUT FIELDS ── */
  .stTextInput > div > div > input {{
    border: 1px solid #c5d5e8 !important;
    border-radius: 6px !important;
    background: white !important;
  }}
  .stTextInput > div > div > input:focus {{
    border-color: {NAVY} !important;
    box-shadow: 0 0 0 2px rgba(27,74,122,0.15) !important;
  }}

  /* ── TOPBAR ── */
  .mtl-topbar {{
    background: {NAVY}; padding: 14px 24px;
    border-bottom: 3px solid {GOLD};
    display: flex; align-items: center; gap: 14px;
    margin: -1rem -1rem 1.5rem -1rem;
  }}
  .mtl-logo {{ display: flex; gap: 4px; }}
  .mtl-logo span {{
    width: 30px; height: 30px; border-radius: 4px;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Playfair Display', serif; font-weight: 700;
    font-size: 15px; color: white;
  }}
  .logo-m, .logo-l {{ background: #2a6ab0; }}
  .logo-t {{ background: {GOLD}; }}
  .mtl-title {{ color: white; font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 600; }}
  .mtl-sub {{ color: rgba(255,255,255,0.65); font-size: 12px; margin-left: auto; }}

  /* ── LOGIN ── */
  .login-wrap {{
    max-width: 420px; margin: 60px auto;
    background: white; border-radius: 12px;
    padding: 40px; box-shadow: 0 4px 24px rgba(27,74,122,0.12);
    border-top: 4px solid {NAVY};
    text-align: center;
  }}
  .login-title {{
    font-family: 'Playfair Display', serif; font-size: 26px;
    color: {NAVY}; margin-bottom: 4px; font-weight: 700;
  }}
  .login-sub {{ color: #6b5e4e; font-size: 13px; margin-bottom: 28px; }}
  .login-logo {{
    display: flex; justify-content: center; gap: 8px; margin-bottom: 20px;
  }}
  .login-logo span {{
    width: 42px; height: 42px; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-family: 'Playfair Display', serif; font-weight: 700;
    font-size: 20px; color: white;
  }}

  /* ── TABS ── */
  .stTabs [data-baseweb="tab-list"] {{
    background: #0f2d4d; border-radius: 0; padding: 0 8px;
    border-bottom: 2px solid {GOLD};
  }}
  .stTabs [data-baseweb="tab"] {{
    color: rgba(255,255,255,0.55) !important; font-size: 13px;
    padding: 10px 20px; border: none !important;
  }}
  .stTabs [aria-selected="true"] {{
    color: {GOLD} !important; border-bottom: 2px solid {GOLD} !important;
    background: transparent !important;
  }}
  .stTabs [data-baseweb="tab-panel"] {{ padding-top: 1.5rem; }}

  /* ── STAT BOXES ── */
  .stat-row {{ display: flex; gap: 12px; margin-bottom: 20px; }}
  .stat-box {{
    flex: 1; background: white; border: 1px solid #e2d9c8;
    border-radius: 8px; padding: 14px 16px; text-align: center;
    box-shadow: 0 1px 4px rgba(0,0,0,0.05);
  }}
  .stat-val {{ font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 700; color: {NAVY}; }}
  .stat-lbl {{ font-size: 11px; color: #6b5e4e; margin-top: 2px; }}

  /* ── BADGES ── */
  .badge-gold  {{ background:#f5edd6; color:#7a5c0a; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:600; }}
  .badge-green {{ background:#e6f4ec; color:#2d7a4f; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:600; }}
  .badge-navy  {{ background:#e8eef5; color:{NAVY};  padding:3px 10px; border-radius:12px; font-size:11px; font-weight:600; }}
  .badge-gray  {{ background:#f0ede8; color:#6b5e4e; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:600; }}

  /* ── RESULT BOX ── */
  .result-box {{
    background: white; border: 1px solid #c5d5e8; border-radius: 6px;
    padding: 16px; white-space: pre-wrap; font-size: 13px; line-height: 1.8;
    max-height: 500px; overflow-y: auto; font-family: 'Times New Roman', serif;
  }}

  /* ── GOLD DIVIDER ── */
  .gold-div {{ height: 2px; background: linear-gradient(90deg, {GOLD}, transparent); margin: 16px 0; border: none; }}

  /* ── SIDEBAR ── */
  [data-testid="stSidebar"] {{ background: {NAVY} !important; }}
  [data-testid="stSidebar"] * {{ color: white !important; }}
  [data-testid="stSidebar"] .stButton > button {{
    background: rgba(255,255,255,0.15) !important;
    border: 1px solid rgba(255,255,255,0.3) !important;
    color: white !important;
  }}
  [data-testid="stSidebar"] .stButton > button:hover {{
    background: {GOLD} !important;
  }}
</style>
""", unsafe_allow_html=True)


# ─────────────────────────────────────────────
# GOOGLE DRIVE HELPERS
# ─────────────────────────────────────────────
def _get_drive_service():
    creds_json = os.getenv("GOOGLE_CREDENTIALS", "")
    if not creds_json:
        return None
    try:
        creds_info = json.loads(creds_json)
        creds = service_account.Credentials.from_service_account_info(
            creds_info, scopes=["https://www.googleapis.com/auth/drive"],
        )
        return build("drive", "v3", credentials=creds, cache_discovery=False)
    except Exception:
        return None

def _find_file_id(service, filename: str):
    try:
        result = service.files().list(
            q=f"name='{filename}' and '{DRIVE_FOLDER_ID}' in parents and trashed=false",
            fields="files(id)", pageSize=1,
        ).execute()
        files = result.get("files", [])
        return files[0]["id"] if files else None
    except Exception:
        return None

def _upload_to_drive(content_bytes: bytes, filename: str, mimetype: str):
    service = _get_drive_service()
    if not service:
        return
    try:
        media = MediaIoBaseUpload(io.BytesIO(content_bytes), mimetype=mimetype, resumable=False)
        file_id = _find_file_id(service, filename)
        if file_id:
            service.files().update(fileId=file_id, media_body=media).execute()
        else:
            service.files().create(
                body={"name": filename, "parents": [DRIVE_FOLDER_ID]},
                media_body=media, fields="id",
            ).execute()
    except Exception:
        pass


# ─────────────────────────────────────────────
# LOG HOẠT ĐỘNG
# ─────────────────────────────────────────────
def _load_log() -> list:
    try:
        f = Path("data/activity_log.json")
        f.parent.mkdir(parents=True, exist_ok=True)
        if f.exists():
            return json.loads(f.read_text(encoding="utf-8"))
    except Exception:
        pass
    return []

def _save_log(logs: list):
    try:
        f = Path("data/activity_log.json")
        f.parent.mkdir(parents=True, exist_ok=True)
        logs = logs[-500:]
        f.write_text(json.dumps(logs, ensure_ascii=False, indent=2), encoding="utf-8")
        _upload_to_drive(
            json.dumps(logs, ensure_ascii=False, indent=2).encode("utf-8"),
            LOG_FILENAME, "application/json"
        )
    except Exception:
        pass

def write_log(username: str, action: str, detail: str = ""):
    logs = _load_log()
    entry = {
        "time":   datetime.now().strftime("%d/%m/%Y %H:%M:%S"),
        "user":   username,
        "action": action,
        "detail": detail,
        "ip":     st.context.headers.get("X-Forwarded-For", "unknown") if hasattr(st, "context") else "unknown",
    }
    logs.append(entry)
    _save_log(logs)


# ─────────────────────────────────────────────
# AUTO LOGOUT
# ─────────────────────────────────────────────
def check_timeout():
    if "last_active" not in st.session_state:
        st.session_state.last_active = datetime.now()
        return False
    elapsed = (datetime.now() - st.session_state.last_active).total_seconds()
    return elapsed > TIMEOUT_MINUTES * 60

def update_activity():
    st.session_state.last_active = datetime.now()

def get_remaining_seconds() -> int:
    if "last_active" not in st.session_state:
        return TIMEOUT_MINUTES * 60
    elapsed = (datetime.now() - st.session_state.last_active).total_seconds()
    return max(0, int(TIMEOUT_MINUTES * 60 - elapsed))


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────
def gen_ma_bg() -> str:
    return f"BG-{datetime.now().year}-{datetime.now().strftime('%m%d%H%M')}"

def gen_ma_hd() -> str:
    return f"HD-{datetime.now().year}-{datetime.now().strftime('%m%d%H%M')}"

def fmt_currency(val) -> str:
    try:
        return f"{int(str(val).replace(',','').replace('.','').replace('đ','')):,}".replace(",", ".")
    except:
        return str(val)

def today_str() -> str:
    return datetime.now().strftime("%d/%m/%Y")

def load_crm() -> list:
    service = _get_drive_service()
    if service:
        try:
            file_id = _find_file_id(service, CRM_FILENAME)
            if file_id:
                buf = io.BytesIO()
                downloader = MediaIoBaseDownload(buf, service.files().get_media(fileId=file_id))
                done = False
                while not done:
                    _, done = downloader.next_chunk()
                buf.seek(0)
                return json.loads(buf.read().decode("utf-8"))
        except Exception:
            pass
    try:
        f = Path("data/crm.json")
        f.parent.mkdir(parents=True, exist_ok=True)
        if f.exists():
            return json.loads(f.read_text(encoding="utf-8"))
    except Exception:
        pass
    return []

def save_crm(data: list):
    content = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
    try:
        f = Path("data/crm.json")
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_bytes(content)
    except Exception:
        pass
    _upload_to_drive(content, CRM_FILENAME, "application/json")

def status_label(s: str) -> str:
    m = {"hopdong": "✅ Hợp đồng", "baogia": "📋 Báo giá", "tiemnang": "🔵 Tiềm năng"}
    return m.get(s, "—")

def call_claude(prompt: str, max_tokens: int = 2000) -> str:
    client = anthropic.Anthropic(api_key=API_KEY)
    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=max_tokens,
        system=(
            "Bạn là trợ lý pháp lý chuyên nghiệp của Công ty Luật TNHH Minh Tú (MTL), TP.HCM.\n"
            "Địa chỉ: 4/9 Đường số 3, Cư Xá Đô Thành, P. Bàn Cờ, TP.HCM.\n"
            "Chi nhánh Đà Nẵng: 81 Xô Viết Nghệ Tĩnh, P. Cẩm Lệ, TP. Đà Nẵng.\n"
            "GPĐKHĐ: 41.02.4764/TP/ĐKHĐ | MST: 0318941023 | Hotline: 1900 0031.\n"
            "LS. Võ Hồng Tú — Giám đốc / Luật sư điều hành.\n"
            "Viết bằng tiếng Việt, văn phong pháp lý trang trọng, chuyên nghiệp."
        ),
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text

def xuat_word(noi_dung: str, ten_file: str, loai: str = "bao_gia", data_extra: dict = None) -> str:
    HOPDONG_DIR.mkdir(parents=True, exist_ok=True)
    payload = {"noi_dung": noi_dung, "ten_file": ten_file, "ngay_lap": today_str()}
    if data_extra:
        payload.update(data_extra)
    json_path = str(HOPDONG_DIR / f"{ten_file}_input.json")
    docx_path = str(HOPDONG_DIR / f"{ten_file}.docx")
    Path(json_path).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    JS_MAP = {
        "hop_dong":   "agents/word_hop_dong.js",
        "bao_gia":    "agents/word_bao_gia.js",
        "de_nghi_tt": "agents/word_de_nghi_tt.js",
        "phieu_thu":  "agents/word_phieu_thu.js",
    }
    js_file = JS_MAP.get(loai, "agents/word_bao_gia.js")
    try:
        result = subprocess.run(
            ["node", js_file, json_path, docx_path],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode == 0 and "OK" in result.stdout:
            try: os.remove(json_path)
            except: pass
            try:
                with open(docx_path, "rb") as f:
                    _upload_to_drive(f.read(), f"{ten_file}.docx",
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
            except Exception:
                pass
            return docx_path
        else:
            return f"LOI:{result.stderr[:300]}"
    except FileNotFoundError:
        return "LOI:Node.js chưa được cài hoặc file JS không tồn tại"
    except subprocess.TimeoutExpired:
        return "LOI:Timeout — Node.js mất quá 30 giây"
    except Exception as e:
        return f"LOI:{e}"

def tao_de_nghi_tt(ten_than_chu, so_hop_dong="", items=None, tong_phi_raw=0,
                   han_thanh_toan="03 ngày làm việc kể từ ngày nhận đề nghị",
                   dia_chi="", sdt="", ghi_chu="") -> dict:
    ym = datetime.now().strftime("%Y%m")
    HOPDONG_DIR.mkdir(parents=True, exist_ok=True)
    pattern = re.compile(rf"^DNTT-{ym}-(\d+)")
    max_n = 0
    for fname in HOPDONG_DIR.iterdir():
        m = pattern.match(fname.name)
        if m: max_n = max(max_n, int(m.group(1)))
    ma_de_nghi = f"DNTT-{ym}-{max_n+1:03d}"
    if not items:
        items = [{"stt":1, "noi_dung": f"Phí dịch vụ pháp lý theo HĐ {so_hop_dong}" if so_hop_dong else "Phí dịch vụ pháp lý", "so_tien_raw": tong_phi_raw, "dot_tt": "Đợt 1"}]
    for i, item in enumerate(items): item.setdefault("stt", i+1)
    if not tong_phi_raw:
        tong_phi_raw = sum(int(re.sub(r"\D","",str(it.get("so_tien_raw",0))) or "0") for it in items)
    data_extra = {"ma_de_nghi": ma_de_nghi, "ten_than_chu": ten_than_chu, "dia_chi": dia_chi,
                  "sdt": sdt, "so_hop_dong": so_hop_dong, "han_thanh_toan": han_thanh_toan,
                  "items": items, "tong_phi_raw": tong_phi_raw, "ngay_lap": today_str(), "ghi_chu": ghi_chu}
    return {"ma_de_nghi": ma_de_nghi, "data_extra": data_extra}

def tao_phieu_thu(nguoi_nop, so_tien_raw, noi_dung_thu="", hinh_thuc_tt="Chuyển khoản",
                  so_hop_dong="", ma_de_nghi="", dia_chi="", sdt="",
                  nguoi_thu="Võ Hồng Tú", nguoi_lap="Trần Thị Thương",
                  thu_quy="Trần Thị Hồng", ngay_thu="", ghi_chu="") -> dict:
    ym = datetime.now().strftime("%Y%m")
    HOPDONG_DIR.mkdir(parents=True, exist_ok=True)
    pattern = re.compile(rf"^PT-{ym}-(\d+)")
    max_n = 0
    for fname in HOPDONG_DIR.iterdir():
        m = pattern.match(fname.name)
        if m: max_n = max(max_n, int(m.group(1)))
    ma_phieu_thu = f"PT-{ym}-{max_n+1:03d}"
    if not ngay_thu: ngay_thu = today_str()
    if not noi_dung_thu:
        noi_dung_thu = f"Phí dịch vụ pháp lý theo HĐ {so_hop_dong}" if so_hop_dong else "Phí dịch vụ pháp lý"
    data_extra = {"ma_phieu_thu": ma_phieu_thu, "so_phieu": ma_phieu_thu,
                  "nguoi_nop": nguoi_nop, "ten_than_chu": nguoi_nop,
                  "dia_chi": dia_chi, "sdt": sdt, "so_hop_dong": so_hop_dong,
                  "ma_de_nghi": ma_de_nghi, "noi_dung_thu": noi_dung_thu,
                  "so_tien_raw": so_tien_raw, "hinh_thuc_tt": hinh_thuc_tt,
                  "nguoi_thu": nguoi_thu, "nguoi_lap": nguoi_lap, "thu_quy": thu_quy,
                  "ngay_thu": ngay_thu, "ngay_lap": today_str(), "ghi_chu": ghi_chu}
    return {"ma_phieu_thu": ma_phieu_thu, "data_extra": data_extra}


# ─────────────────────────────────────────────
# SESSION STATE
# ─────────────────────────────────────────────
if "authenticated" not in st.session_state:
    st.session_state.authenticated = False
if "username" not in st.session_state:
    st.session_state.username = ""
if "last_active" not in st.session_state:
    st.session_state.last_active = datetime.now()


# ─────────────────────────────────────────────
# KIỂM TRA TIMEOUT
# ─────────────────────────────────────────────
if st.session_state.authenticated and check_timeout():
    write_log(st.session_state.username, "AUTO_LOGOUT", "Tự động đăng xuất sau 5 phút không hoạt động")
    st.session_state.authenticated = False
    st.session_state.username = ""
    st.warning("⏱ Phiên làm việc hết hạn sau 5 phút không hoạt động. Vui lòng đăng nhập lại.")
    st.rerun()


# ─────────────────────────────────────────────
# LOGIN
# ─────────────────────────────────────────────
if not st.session_state.authenticated:
    st.markdown(f"""
    <div class="login-wrap">
      <div class="login-logo">
        <span style="background:#2a6ab0">M</span>
        <span style="background:{GOLD}">T</span>
        <span style="background:#2a6ab0">L</span>
      </div>
      <div class="login-title">Minh Tú Law</div>
      <div class="login-sub">Cổng dành cho nhân viên kinh doanh</div>
    </div>
    """, unsafe_allow_html=True)

    col_l, col_c, col_r = st.columns([1, 1.2, 1])
    with col_c:
        username_input = st.text_input("Tên đăng nhập", placeholder="Nhập tên đăng nhập...")
        pw_input       = st.text_input("Mật khẩu", type="password", placeholder="Nhập mật khẩu...")
        st.markdown("<br>", unsafe_allow_html=True)
        if st.button("Đăng nhập", use_container_width=True, type="primary"):
            uname = username_input.strip().lower()
            if uname in NV_ACCOUNTS and NV_ACCOUNTS[uname] == pw_input:
                st.session_state.authenticated = True
                st.session_state.username = uname
                st.session_state.last_active = datetime.now()
                write_log(uname, "LOGIN", "Đăng nhập thành công")
                st.rerun()
            else:
                write_log(username_input.strip(), "LOGIN_FAIL", "Đăng nhập thất bại")
                st.error("❌ Tên đăng nhập hoặc mật khẩu không đúng.")
        st.markdown(f"""
        <div style="text-align:center;margin-top:24px;color:#6b5e4e;font-size:12px;">
          Hotline: 1900 0031 &nbsp;|&nbsp; luatminhtu.vn
        </div>
        """, unsafe_allow_html=True)
    st.stop()


# ─────────────────────────────────────────────
# ĐÃ ĐĂNG NHẬP
# ─────────────────────────────────────────────
update_activity()
current_user = st.session_state.username
remaining    = get_remaining_seconds()
remaining_m  = remaining // 60
remaining_s  = remaining % 60

st.markdown(f"""
<div class="mtl-topbar">
  <div class="mtl-logo">
    <span class="logo-m">M</span><span class="logo-t">T</span><span class="logo-l">L</span>
  </div>
  <div class="mtl-title">Minh Tú Law — Nhân Viên Kinh Doanh</div>
  <div class="mtl-sub">⚖️ {today_str()} &nbsp;|&nbsp; 👤 {current_user} &nbsp;|&nbsp; ⏱ {remaining_m:02d}:{remaining_s:02d}</div>
</div>
""", unsafe_allow_html=True)

if "crm" not in st.session_state:
    st.session_state.crm = load_crm()
if "bg_result" not in st.session_state:
    st.session_state.bg_result = None
if "hd_result" not in st.session_state:
    st.session_state.hd_result = None

# Sidebar
st.sidebar.markdown(f"### ⚖️ Minh Tú Law")
st.sidebar.caption(f"👤 {current_user}")
st.sidebar.caption(f"⏱ Còn {remaining_m:02d}:{remaining_s:02d}")
st.sidebar.divider()
if st.sidebar.button("🚪 Đăng xuất", use_container_width=True):
    write_log(current_user, "LOGOUT", "Đăng xuất thủ công")
    st.session_state.authenticated = False
    st.session_state.username = ""
    st.rerun()
st.sidebar.caption("Hotline: 1900 0031")
st.sidebar.caption("votu@luatminhtu.vn")


# ─────────────────────────────────────────────
# PHÂN QUYỀN
# ─────────────────────────────────────────────
# Tài khoản được xem tab CRM
CRM_ALLOWED = {"admin", "hong", "hoa", "thuong"}
can_see_crm = current_user in CRM_ALLOWED

# ─────────────────────────────────────────────
# TABS
# ─────────────────────────────────────────────
if current_user == "admin":
    tab_bg, tab_hd, tab_crm, tab_dntt, tab_pt, tab_log = st.tabs([
        "📋 Tạo Báo Giá", "📝 Tạo Hợp Đồng", "👥 CRM Khách Hàng",
        "💳 Đề Nghị Thanh Toán", "🧾 Phiếu Thu", "🔐 Log Hoạt Động",
    ])
elif can_see_crm:
    tab_bg, tab_hd, tab_crm, tab_dntt, tab_pt = st.tabs([
        "📋 Tạo Báo Giá", "📝 Tạo Hợp Đồng", "👥 CRM Khách Hàng",
        "💳 Đề Nghị Thanh Toán", "🧾 Phiếu Thu",
    ])
    tab_log = None
else:
    tab_bg, tab_hd, tab_dntt, tab_pt = st.tabs([
        "📋 Tạo Báo Giá", "📝 Tạo Hợp Đồng",
        "💳 Đề Nghị Thanh Toán", "🧾 Phiếu Thu",
    ])
    tab_crm = None
    tab_log = None


# ══════════════════════════════════════════════
# TAB 1 — TẠO BÁO GIÁ
# ══════════════════════════════════════════════
with tab_bg:
    st.markdown("### Thư Báo Phí Dịch Vụ Pháp Lý")
    st.caption("AI tự động soạn nội dung chuyên nghiệp · Chuẩn định dạng MTL")
    st.divider()

    with st.form("form_baogia", clear_on_submit=False):
        c1, c2 = st.columns(2)
        with c1:
            bg_ten    = st.text_input("Tên khách hàng / Doanh nghiệp *", placeholder="Ông Nguyễn Văn A / Công ty XYZ")
            bg_email  = st.text_input("Email", placeholder="email@example.com")
            bg_loai   = st.selectbox("Loại vụ việc pháp lý *", [
                "— Chọn loại —", "Tranh chấp đất đai / Bất động sản",
                "Hôn nhân & Gia đình (ly hôn, giám hộ)", "Hình sự (bào chữa / bị hại)",
                "Tranh chấp hợp đồng thương mại", "Thành lập / Giải thể doanh nghiệp",
                "Sở hữu trí tuệ (nhãn hiệu, bản quyền)", "Lao động (sa thải, tranh chấp lương)",
                "Tư vấn pháp luật theo tháng", "Soạn thảo hợp đồng", "Khác",
            ])
            bg_phi    = st.text_input("Tổng phí dự kiến (VNĐ) *", placeholder="vd: 30000000")
        with c2:
            bg_sdt    = st.text_input("Số điện thoại", placeholder="09xx.xxx.xxx")
            bg_diachi = st.text_input("Địa chỉ", placeholder="Số nhà, đường, phường, quận, tỉnh/TP")
            bg_cach   = st.selectbox("Cách tính phí", ["Trọn gói", "Theo giờ", "Theo tháng", "Theo vụ (% giá trị)"])
            bg_duan   = st.text_input("Tên dự án / Vụ việc", placeholder="vd: Vụ tranh chấp đất số 12 Lê Lợi")
        bg_mota = st.text_area("Mô tả vụ việc *",
            placeholder="Tóm tắt nội dung vụ việc, yêu cầu của khách, phạm vi công việc...", height=120)
        submitted_bg = st.form_submit_button("✦ AI Tạo Báo Giá", type="primary", use_container_width=True)

    if submitted_bg:
        errors = []
        if not bg_ten.strip(): errors.append("Tên khách hàng")
        if bg_loai == "— Chọn loại —": errors.append("Loại vụ việc")
        if not bg_phi.strip(): errors.append("Phí dự kiến")
        if not bg_mota.strip(): errors.append("Mô tả vụ việc")
        if errors:
            st.error(f"Vui lòng nhập đầy đủ: **{', '.join(errors)}**")
        else:
            ma_bg=gen_ma_bg(); phi_raw=int(re.sub(r"\D","",bg_phi) or "0")
            phi_vat=round(phi_raw*0.1); phi_total=phi_raw+phi_vat
            prompt = f"""Soạn THƯ BÁO PHÍ DỊCH VỤ PHÁP LÝ:
Mã: {ma_bg} | Ngày: {today_str()} | KH: {bg_ten} | SĐT: {bg_sdt or '—'} | Email: {bg_email or '—'}
Địa chỉ: {bg_diachi or '—'} | Loại vụ: {bg_loai} | Vụ việc: {bg_duan or bg_loai} | Cách tính: {bg_cach}
Mô tả: {bg_mota}

CẤU TRÚC BẮT BUỘC:
I. PHẠM VI DỊCH VỤ — 5-6 hạng mục, mỗi hạng mục:
01. [Tên hạng mục]
   [Mô tả 1–2 câu]

II. BẢNG PHÍ DỊCH VỤ
Phí dịch vụ (chưa VAT): {fmt_currency(phi_raw)}đ
Thuế VAT (10%): {fmt_currency(phi_vat)}đ
Tổng phí phải thanh toán: {fmt_currency(phi_total)}đ
(bằng chữ: [viết bằng chữ])

III. ĐIỀU KIỆN & LƯU Ý — 4 điểm

IV. THANH TOÁN
Tên TK: CTY LUAT TNHH MINH TU | STK: 5150056789 — MB Bank CN Phú Nhuận
Nội dung CK: [Tên KH] thanh toán {ma_bg}
Văn phong pháp lý trang trọng. Không dùng markdown, #, *, **.
"""
            with st.spinner("AI đang soạn thư báo phí..."):
                try:
                    noi_dung = call_claude(prompt, max_tokens=2000)
                    data_extra = {
                        "ma_bao_gia": ma_bg, "ten_than_chu": bg_ten, "dia_chi": bg_diachi,
                        "sdt": bg_sdt, "email": bg_email, "loai_vu": bg_loai,
                        "ten_du_an": bg_duan or bg_loai, "loai_dich_vu": bg_cach,
                        "mo_ta_ngan": bg_mota[:200], "tong_phi_raw": phi_total,
                        "tong_phi_fmt": fmt_currency(phi_total), "ngay_lap": today_str(), "noi_dung": noi_dung,
                    }
                    st.session_state.bg_result = {
                        "ma": ma_bg, "noi_dung": noi_dung, "data_extra": data_extra,
                        "raw": {"ten": bg_ten, "sdt": bg_sdt, "email": bg_email,
                                "diachi": bg_diachi, "loai": bg_loai, "phi": str(phi_raw),
                                "duan": bg_duan, "mota": bg_mota},
                    }
                    write_log(current_user, "TAO_BAO_GIA", f"KH: {bg_ten} | Mã: {ma_bg} | Phí: {fmt_currency(phi_total)}đ")
                except Exception as e:
                    st.error(f"Lỗi AI: {e}")

    if st.session_state.bg_result:
        r = st.session_state.bg_result
        st.markdown('<hr class="gold-div">', unsafe_allow_html=True)
        st.markdown(f"**📄 Thư Báo Phí** — `{r['ma']}`")
        st.markdown(f'<div class="result-box">{r["noi_dung"]}</div>', unsafe_allow_html=True)
        st.markdown("#### Xuất & Lưu")
        ca, cb, cc, cd = st.columns(4)
        with ca:
            if st.button("⬇ Xuất Word (.docx)", key="btn_export_bg", use_container_width=True):
                ten_file = f"BaoGia_{r['ma']}"
                with st.spinner("Đang tạo file Word..."):
                    docx_path = xuat_word(r["noi_dung"], ten_file, loai="bao_gia", data_extra=r["data_extra"])
                if docx_path.startswith("LOI:"):
                    st.error(f"Lỗi: {docx_path}")
                elif Path(docx_path).exists():
                    write_log(current_user, "XUAT_WORD_BG", f"File: {ten_file}.docx")
                    with open(docx_path, "rb") as f:
                        st.download_button("📥 Tải về .docx", data=f.read(),
                            file_name=f"BaoGia_{r['ma']}.docx",
                            mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        with cb:
            st.download_button("📄 Xuất TXT", data=r["noi_dung"].encode("utf-8"),
                file_name=f"BaoGia_{r['ma']}.txt", mime="text/plain", use_container_width=True)
        with cc:
            if st.button("💾 Lưu vào CRM", key="btn_save_crm_bg", use_container_width=True):
                raw = r["raw"]; crm = st.session_state.crm
                existing = next((i for i,k in enumerate(crm) if k["ten"]==raw["ten"] and k["sdt"]==raw["sdt"]), -1)
                kh = {"id": str(int(datetime.now().timestamp()*1000)), "ten": raw["ten"], "sdt": raw["sdt"],
                      "email": raw["email"], "diachi": raw["diachi"], "loai": raw["loai"], "phi": raw["phi"],
                      "duan": raw["duan"], "ghichu": raw["mota"], "ma_bg": r["ma"], "ngay_bg": today_str(),
                      "trang_thai": "baogia", "hop_dong": None, "created_at": datetime.now().isoformat()}
                if existing >= 0:
                    crm[existing].update({k: v for k,v in kh.items() if k != "id"})
                    st.success("Đã cập nhật khách hàng trong CRM!")
                else:
                    crm.insert(0, kh); st.success("Đã lưu khách hàng vào CRM!")
                st.session_state.crm = crm; save_crm(crm)
                write_log(current_user, "LUU_CRM", f"KH: {raw['ten']}")
        with cd:
            if st.button("→ Tạo Hợp Đồng", key="btn_bg_to_hd", use_container_width=True, type="primary"):
                st.session_state["_prefill_hd"] = r["raw"]
                st.info("Chuyển sang tab **Tạo Hợp Đồng** để tiếp tục.")


# ══════════════════════════════════════════════
# TAB 2 — TẠO HỢP ĐỒNG
# ══════════════════════════════════════════════
with tab_hd:
    st.markdown("### Hợp Đồng Dịch Vụ Pháp Lý")
    st.caption("10 điều khoản chuẩn pháp lý Việt Nam · Tự điền từ CRM hoặc báo giá đã duyệt")
    st.divider()

    prefill = st.session_state.pop("_prefill_hd", {})
    crm_options_hd = {k["id"]: f"{k['ten']} — {k['sdt'] or k['email'] or ''}" for k in st.session_state.crm}
    crm_choice_hd  = st.selectbox("Chọn khách hàng từ CRM (tự điền form)",
        options=["— Chọn từ danh sách —"] + list(crm_options_hd.values()), key="hd_crm_sel")
    selected_kh_hd = None
    if crm_choice_hd != "— Chọn từ danh sách —":
        selected_kh_hd = next((k for k in st.session_state.crm
            if f"{k['ten']} — {k['sdt'] or k['email'] or ''}" == crm_choice_hd), None)
    st.divider()

    def _val(field, default=""):
        if selected_kh_hd: return selected_kh_hd.get(field, default) or default
        return prefill.get(field, default) or default

    with st.form("form_hopdong", clear_on_submit=False):
        c1, c2 = st.columns(2)
        with c1:
            hd_so=st.text_input("Số hợp đồng", value=gen_ma_hd())
            hd_ten=st.text_input("Tên khách hàng / Doanh nghiệp *", value=_val("ten"))
            hd_cmnd=st.text_input("CMND/CCCD hoặc MST")
            hd_diachi=st.text_input("Địa chỉ", value=_val("diachi"))
        with c2:
            hd_sdt=st.text_input("Số điện thoại", value=_val("sdt"))
            hd_email=st.text_input("Email", value=_val("email"))
            hd_loai=st.selectbox("Loại dịch vụ pháp lý *", [
                "— Chọn —","Tranh chấp đất đai / Bất động sản","Hôn nhân & Gia đình","Hình sự",
                "Tranh chấp hợp đồng thương mại","Thành lập / Giải thể doanh nghiệp",
                "Sở hữu trí tuệ","Lao động","Tư vấn pháp luật theo tháng","Soạn thảo hợp đồng"], index=0)
            hd_phi=st.text_input("Tổng phí (VNĐ, chưa VAT) *", value=_val("phi"))
        c3, c4 = st.columns(2)
        with c3:
            hd_tt=st.selectbox("Phương thức thanh toán", [
                "50% khi ký — 50% khi hoàn thành","100% khi ký hợp đồng",
                "Thanh toán theo từng giai đoạn","Hàng tháng (đầu tháng)"])
        with c4:
            hd_thoihan=st.selectbox("Thời hạn hợp đồng", [
                "Đến khi hoàn thành vụ việc","3 tháng","6 tháng","12 tháng","24 tháng"])
        hd_scope=st.text_area("Phạm vi dịch vụ / Công việc cụ thể *",
            value=_val("mota") or _val("ghichu"), height=120)
        submitted_hd = st.form_submit_button("✦ AI Soạn Hợp Đồng", type="primary", use_container_width=True)

    if submitted_hd:
        errors = []
        if not hd_ten.strip(): errors.append("Tên khách hàng")
        if hd_loai == "— Chọn —": errors.append("Loại dịch vụ")
        if not hd_phi.strip(): errors.append("Phí dịch vụ")
        if not hd_scope.strip(): errors.append("Phạm vi dịch vụ")
        if errors:
            st.error(f"Vui lòng nhập đầy đủ: **{', '.join(errors)}**")
        else:
            phi_raw=int(re.sub(r"\D","",hd_phi) or "0"); phi_vat=round(phi_raw*0.1); phi_total=phi_raw+phi_vat
            prompt = f"""Soạn HỢP ĐỒNG DỊCH VỤ PHÁP LÝ chuẩn pháp lý Việt Nam:
Số HĐ: {hd_so} | Ngày: {today_str()}
BÊN A: CÔNG TY LUẬT TNHH MINH TÚ | GPĐKHĐ: 41.02.4764/TP/ĐKHĐ | MST: 0318941023
  LS. Võ Hồng Tú — Giám đốc | Trụ sở: 4/9 Đường số 3, CX Đô Thành, P.Bàn Cờ, TP.HCM
  CN Đà Nẵng: 81 Xô Viết Nghệ Tĩnh, P.Cẩm Lệ, TP.Đà Nẵng | Hotline: 1900 0031
BÊN B: {hd_ten} | CMND/MST: {hd_cmnd or '___'} | Địa chỉ: {hd_diachi or '___'}
  SĐT: {hd_sdt or '___'} | Email: {hd_email or '___'}
Dịch vụ: {hd_loai} | Phạm vi: {hd_scope}
Phí chưa VAT: {fmt_currency(phi_raw)}đ | VAT 10%: {fmt_currency(phi_vat)}đ | Tổng: {fmt_currency(phi_total)}đ
Thanh toán: {hd_tt} | Thời hạn: {hd_thoihan}
TK: CTY LUAT TNHH MINH TU | STK: 5150056789 | MB Bank CN Phú Nhuận
Soạn đủ 10 điều khoản. Không dùng markdown, #, *, **.
"""
            with st.spinner("AI đang soạn hợp đồng..."):
                try:
                    noi_dung = call_claude(prompt, max_tokens=3000)
                    data_extra = {
                        "so_hop_dong": hd_so, "ten_than_chu": hd_ten, "cmnd": hd_cmnd,
                        "dia_chi": hd_diachi, "sdt": hd_sdt, "email": hd_email,
                        "loai_vu": hd_loai, "loai_dich_vu": hd_loai,
                        "tong_phi_raw": phi_total, "tong_phi_fmt": fmt_currency(phi_total),
                        "phuong_thuc_tt": hd_tt, "thoi_han": hd_thoihan,
                        "ngay_lap": today_str(), "noi_dung": noi_dung,
                    }
                    st.session_state.hd_result = {
                        "so_hd": hd_so, "noi_dung": noi_dung, "data_extra": data_extra,
                        "raw": {"ten": hd_ten, "sdt": hd_sdt, "email": hd_email,
                                "diachi": hd_diachi, "loai": hd_loai, "phi": str(phi_raw)},
                    }
                    write_log(current_user, "TAO_HOP_DONG", f"KH: {hd_ten} | Số HĐ: {hd_so}")
                except Exception as e:
                    st.error(f"Lỗi AI: {e}")

    if st.session_state.hd_result:
        r = st.session_state.hd_result
        st.markdown('<hr class="gold-div">', unsafe_allow_html=True)
        st.markdown(f"**📜 Hợp Đồng** — `{r['so_hd']}`")
        st.markdown(f'<div class="result-box">{r["noi_dung"]}</div>', unsafe_allow_html=True)
        ca, cb, cc = st.columns(3)
        with ca:
            if st.button("⬇ Xuất Word (.docx)", key="btn_export_hd", use_container_width=True):
                ten_file = f"HopDong_{r['so_hd'].replace('/','_')}"
                with st.spinner("Đang tạo file Word..."):
                    docx_path = xuat_word(r["noi_dung"], ten_file, loai="hop_dong", data_extra=r["data_extra"])
                if docx_path.startswith("LOI:"):
                    st.error(f"Lỗi: {docx_path}")
                elif Path(docx_path).exists():
                    write_log(current_user, "XUAT_WORD_HD", f"File: {ten_file}.docx")
                    with open(docx_path, "rb") as f:
                        st.download_button("📥 Tải về .docx", data=f.read(),
                            file_name=f"HopDong_{r['so_hd']}.docx",
                            mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        with cb:
            st.download_button("📄 Xuất TXT", data=r["noi_dung"].encode("utf-8"),
                file_name=f"HopDong_{r['so_hd']}.txt", mime="text/plain", use_container_width=True)
        with cc:
            if st.button("💾 Cập nhật CRM", key="btn_save_hd_crm", use_container_width=True, type="primary"):
                raw=r["raw"]; crm=st.session_state.crm
                hd_info={"so_hd":r["so_hd"],"ngay_hd":today_str(),"phi":raw["phi"],"loai":raw["loai"]}
                idx=next((i for i,k in enumerate(crm) if k["ten"]==raw["ten"]),-1)
                if idx>=0:
                    crm[idx]["hop_dong"]=hd_info; crm[idx]["trang_thai"]="hopdong"
                    st.success("Đã cập nhật hợp đồng trong CRM!")
                else:
                    crm.insert(0,{"id":str(int(datetime.now().timestamp()*1000)),
                        "ten":raw["ten"],"sdt":raw["sdt"],"email":raw["email"],"diachi":raw["diachi"],
                        "loai":raw["loai"],"phi":raw["phi"],"duan":"","ghichu":"","ma_bg":"",
                        "ngay_bg":today_str(),"trang_thai":"hopdong","hop_dong":hd_info,
                        "created_at":datetime.now().isoformat()})
                    st.success("Đã thêm khách hàng vào CRM!")
                st.session_state.crm=crm; save_crm(crm)
                write_log(current_user,"LUU_CRM_HD",f"KH: {raw['ten']} | HĐ: {r['so_hd']}")


# ══════════════════════════════════════════════
# TAB 3 — CRM
# ══════════════════════════════════════════════
if can_see_crm and tab_crm is not None:
    with tab_crm:
        st.markdown("### CRM Khách Hàng")
        st.caption("Lưu trữ & quản lý hồ sơ · Đồng bộ Google Drive")
        st.divider()

        crm=st.session_state.crm
        total=len(crm); with_hd=sum(1 for k in crm if k.get("trang_thai")=="hopdong")
        revenue=sum(int(k.get("phi") or 0) for k in crm)
        st.markdown(f"""
        <div class="stat-row">
          <div class="stat-box"><div class="stat-val">{total}</div><div class="stat-lbl">Tổng khách hàng</div></div>
          <div class="stat-box"><div class="stat-val">{with_hd}</div><div class="stat-lbl">Đã ký hợp đồng</div></div>
          <div class="stat-box"><div class="stat-val">{revenue//1_000_000}</div><div class="stat-lbl">Doanh thu (tr.đ)</div></div>
        </div>
        """, unsafe_allow_html=True)

        sc1,sc2,sc3,sc4=st.columns([3,1,1,1])
        with sc1: search_q=st.text_input("🔍 Tìm kiếm",placeholder="Tên, SĐT, email...",label_visibility="collapsed")
        with sc2: flt=st.selectbox("Lọc",["Tất cả","Tiềm năng","Báo giá","Hợp đồng"],label_visibility="collapsed")
        with sc3: show_add=st.button("＋ Thêm KH",use_container_width=True)
        with sc4:
            if crm:
                csv_buf=io.StringIO(); writer=csv.writer(csv_buf)
                writer.writerow(["Tên","SĐT","Email","Địa chỉ","Dịch vụ","Phí","Mã BG","Ngày BG","Số HĐ","Trạng thái"])
                for k in crm:
                    hd=k.get("hop_dong") or {}
                    writer.writerow([k.get("ten",""),k.get("sdt",""),k.get("email",""),k.get("diachi",""),
                                      k.get("loai",""),k.get("phi",""),k.get("ma_bg",""),k.get("ngay_bg",""),
                                      hd.get("so_hd",""),k.get("trang_thai","")])
                st.download_button("↓ CSV",csv_buf.getvalue().encode("utf-8-sig"),"CRM_MinhTuLaw.csv","text/csv",use_container_width=True)

        if show_add: st.session_state["show_add_form"]=True
        if st.session_state.get("show_add_form"):
            with st.expander("➕ Thêm khách hàng mới",expanded=True):
                with st.form("form_add_crm"):
                    a1,a2=st.columns(2)
                    with a1: add_ten=st.text_input("Họ tên *"); add_email=st.text_input("Email"); add_loai=st.text_input("Loại dịch vụ")
                    with a2: add_sdt=st.text_input("Điện thoại"); add_diachi=st.text_input("Địa chỉ"); add_phi=st.text_input("Phí dự kiến (VNĐ)")
                    add_ghichu=st.text_area("Ghi chú",height=70)
                    add_ts=st.selectbox("Trạng thái",["tiemnang","baogia","hopdong"])
                    if st.form_submit_button("Lưu",type="primary"):
                        if not add_ten.strip(): st.error("Vui lòng nhập tên khách hàng.")
                        else:
                            new_kh={"id":str(int(datetime.now().timestamp()*1000)),"ten":add_ten,"sdt":add_sdt,
                                    "email":add_email,"diachi":add_diachi,"loai":add_loai,
                                    "phi":re.sub(r"\D","",add_phi),"duan":"","ghichu":add_ghichu,
                                    "ma_bg":"","ngay_bg":today_str(),"trang_thai":add_ts,"hop_dong":None,
                                    "created_at":datetime.now().isoformat()}
                            crm.insert(0,new_kh); st.session_state.crm=crm; save_crm(crm)
                            write_log(current_user,"THEM_KH_CRM",f"KH mới: {add_ten}")
                            st.session_state["show_add_form"]=False; st.success("Đã thêm khách hàng!"); st.rerun()

        flt_map={"Tất cả":"all","Tiềm năng":"tiemnang","Báo giá":"baogia","Hợp đồng":"hopdong"}
        flt_key=flt_map[flt]; filtered=crm
        if search_q:
            q=search_q.lower()
            filtered=[k for k in filtered if q in k.get("ten","").lower() or q in k.get("sdt","").lower()
                      or q in k.get("email","").lower() or q in k.get("loai","").lower()]
        if flt_key!="all": filtered=[k for k in filtered if k.get("trang_thai")==flt_key]

        if not filtered: st.info("Không có khách hàng nào." if not crm else "Không tìm thấy kết quả.")
        else:
            h1,h2,h3,h4,h5,h6,h7=st.columns([3,2,2,2,2,2,1])
            for col,label in zip([h1,h2,h3,h4,h5,h6,h7],["Khách hàng","Liên hệ","Dịch vụ","Phí (VNĐ)","Hợp đồng","Trạng thái","#"]):
                col.markdown(f"**{label}**")
            st.divider()
            for kh in filtered:
                hd=kh.get("hop_dong") or {}
                phi_disp=f"{int(kh.get('phi') or 0):,}".replace(",",".")
                ts=kh.get("trang_thai","")
                badge={"hopdong":"badge-green","baogia":"badge-gold","tiemnang":"badge-navy"}.get(ts,"badge-gray")
                c1,c2,c3,c4,c5,c6,c7=st.columns([3,2,2,2,2,2,1])
                with c1: st.markdown(f"**{kh['ten']}**"); st.caption(kh.get("ma_bg",""))
                with c2: st.markdown(kh.get("sdt","—")); st.caption(kh.get("email",""))
                with c3: st.markdown(f"_{kh.get('loai','—')[:30]}_")
                with c4: st.markdown(f"**{phi_disp}**")
                with c5:
                    if hd: st.markdown(f"`{hd.get('so_hd','')}`"); st.caption(hd.get("ngay_hd",""))
                    else: st.markdown("—")
                with c6: st.markdown(f'<span class="{badge}">{status_label(ts)}</span>',unsafe_allow_html=True)
                with c7:
                    with st.popover("•••"):
                        st.markdown(f"**{kh['ten']}**")
                        st.caption(f"SĐT: {kh.get('sdt','—')} | Email: {kh.get('email','—')}")
                        st.caption(f"Địa chỉ: {kh.get('diachi','—')}")
                        st.caption(f"Phí: {phi_disp}đ | Loại: {kh.get('loai','—')}")
                        if kh.get("ghichu"): st.caption(f"Ghi chú: {kh['ghichu'][:200]}")
                        st.divider()
                        new_ts=st.selectbox("Đổi trạng thái",["tiemnang","baogia","hopdong"],
                            index=["tiemnang","baogia","hopdong"].index(ts) if ts in ["tiemnang","baogia","hopdong"] else 0,
                            key=f"ts_{kh['id']}")
                        if st.button("Cập nhật",key=f"upd_{kh['id']}"):
                            idx=next(i for i,k in enumerate(crm) if k["id"]==kh["id"])
                            crm[idx]["trang_thai"]=new_ts; st.session_state.crm=crm; save_crm(crm)
                            write_log(current_user,"CAP_NHAT_KH",f"KH: {kh['ten']} → {new_ts}"); st.rerun()
                        if st.button("Tạo HĐ từ KH này",key=f"hd_{kh['id']}",type="primary"):
                            st.session_state["_prefill_hd"]={"ten":kh.get("ten",""),"sdt":kh.get("sdt",""),
                                "email":kh.get("email",""),"diachi":kh.get("diachi",""),
                                "loai":kh.get("loai",""),"phi":kh.get("phi",""),"mota":kh.get("ghichu","")}
                            st.info("Chuyển sang tab **Tạo Hợp Đồng**")
                        if st.button("💳 Tạo ĐNTT",key=f"dntt_{kh['id']}"):
                            st.session_state["_prefill_dntt"]=kh; st.info("Chuyển sang tab **Đề Nghị Thanh Toán**")
                        if st.button("🧾 Tạo Phiếu Thu",key=f"pt_{kh['id']}"):
                            st.session_state["_prefill_pt"]=kh; st.info("Chuyển sang tab **Phiếu Thu**")
                        if st.button("🗑 Xóa",key=f"del_{kh['id']}",type="secondary"):
                            crm[:]=[k for k in crm if k["id"]!=kh["id"]]
                            st.session_state.crm=crm; save_crm(crm)
                            write_log(current_user,"XOA_KH",f"KH: {kh['ten']}"); st.rerun()
                st.divider()


# ══════════════════════════════════════════════
# TAB 4 — ĐỀ NGHỊ THANH TOÁN
# ══════════════════════════════════════════════
with tab_dntt:
    st.markdown("### 💳 Tạo Đề Nghị Thanh Toán")
    st.caption("Đề nghị khách hàng thanh toán · Tự động lưu Google Drive")
    st.divider()

    prefill_dntt=st.session_state.pop("_prefill_dntt",None)
    crm_opts_dntt={k["id"]:f"{k['ten']} — {k['sdt'] or k['email'] or ''}" for k in st.session_state.crm}
    crm_choice_dntt=st.selectbox("Chọn khách hàng từ CRM (tự điền form)",
        options=["— Chọn từ danh sách —"]+list(crm_opts_dntt.values()),key="dntt_crm_sel")
    selected_dntt=None
    if crm_choice_dntt!="— Chọn từ danh sách —":
        selected_dntt=next((k for k in st.session_state.crm
            if f"{k['ten']} — {k['sdt'] or k['email'] or ''}"==crm_choice_dntt),None)
    kh_dntt=prefill_dntt or selected_dntt
    def _dval(field,default=""): return (kh_dntt.get(field,default) or default) if kh_dntt else default
    so_hd_default=""
    if kh_dntt and kh_dntt.get("hop_dong"): so_hd_default=kh_dntt["hop_dong"].get("so_hd","")
    st.divider()

    with st.form("form_dntt",clear_on_submit=False):
        c1,c2=st.columns(2)
        with c1:
            dntt_ten=st.text_input("Tên khách hàng / Tổ chức *",value=_dval("ten"),placeholder="Ông/Bà Nguyễn Văn A")
            dntt_sdt=st.text_input("Số điện thoại",value=_dval("sdt"))
            dntt_dc=st.text_input("Địa chỉ",value=_dval("diachi"))
            dntt_so_hd=st.text_input("Số Hợp Đồng",value=so_hd_default,placeholder="HD-202506-001")
        with c2:
            dntt_han=st.text_input("Hạn thanh toán",value="03 ngày làm việc kể từ ngày nhận đề nghị")
            dntt_ghi_chu=st.text_area("Ghi chú",height=68)
            dntt_ten_file=st.text_input("Tên file",
                value=f"DNTT_{_dval('ten').replace(' ','_')[:25]}" if kh_dntt else "",
                placeholder="de_nghi_tt_nguyen_van_a")
        st.markdown("**Danh sách khoản thanh toán**")
        n_items=st.number_input("Số dòng",min_value=1,max_value=10,value=1,step=1)
        items_data=[]; phi_goi_y=int(_dval("phi") or 0)
        for i in range(int(n_items)):
            with st.expander(f"Khoản {i+1}",expanded=(i==0)):
                ci1,ci2,ci3=st.columns([4,2,2])
                nd_i=ci1.text_input("Nội dung",key=f"dntt_nd_{i}",
                    value=f"Phí dịch vụ pháp lý theo HĐ {so_hd_default}" if (i==0 and so_hd_default) else "",
                    placeholder="Phí tư vấn đợt 1...")
                dt_i=ci2.text_input("Đợt TT",key=f"dntt_dt_{i}",value=f"Đợt {i+1}")
                phi_i=ci3.number_input("Số tiền (VNĐ)",key=f"dntt_phi_{i}",
                    min_value=0,step=500000,value=phi_goi_y if i==0 else 0,format="%d")
                items_data.append({"stt":i+1,"noi_dung":nd_i,"dot_tt":dt_i,"so_tien_raw":int(phi_i)})
        sub_dntt=st.form_submit_button("💳 Tạo Đề Nghị Thanh Toán",type="primary",use_container_width=True)

    if sub_dntt:
        if not dntt_ten.strip(): st.warning("⚠️ Vui lòng nhập tên khách hàng.")
        else:
            tong_phi=sum(it["so_tien_raw"] for it in items_data)
            if tong_phi==0: st.warning("⚠️ Vui lòng nhập số tiền ít nhất một khoản.")
            else:
                with st.spinner("Đang tạo Đề Nghị Thanh Toán..."):
                    try:
                        valid_items=[it for it in items_data if it["noi_dung"].strip()]
                        result=tao_de_nghi_tt(ten_than_chu=dntt_ten.strip(),so_hop_dong=dntt_so_hd.strip(),
                            items=valid_items,tong_phi_raw=tong_phi,han_thanh_toan=dntt_han.strip(),
                            dia_chi=dntt_dc.strip(),sdt=dntt_sdt.strip(),ghi_chu=dntt_ghi_chu.strip())
                        ma_dntt=result["ma_de_nghi"]; data_extra=result["data_extra"]
                        ten_file=dntt_ten_file.strip() or f"DNTT_{dntt_ten.strip().replace(' ','_')[:30]}"
                        docx_path=xuat_word("",ten_file,loai="de_nghi_tt",data_extra=data_extra)
                        if docx_path.startswith("LOI:"): st.error(f"❌ {docx_path}")
                        else:
                            write_log(current_user,"TAO_DNTT",f"KH: {dntt_ten.strip()} | Mã: {ma_dntt} | Tổng: {tong_phi:,}đ")
                            st.success(f"✅ Đã tạo **{ma_dntt}** · Đã lưu Google Drive")
                            st.metric("Tổng tiền đề nghị",f"{tong_phi:,}".replace(",",".")+" đ")
                            with open(docx_path,"rb") as f:
                                st.download_button("📥 Tải về .docx",data=f.read(),file_name=f"{ten_file}.docx",
                                    mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",type="primary")
                    except Exception as e: st.error(f"❌ Lỗi: {e}")


# ══════════════════════════════════════════════
# TAB 5 — PHIẾU THU
# ══════════════════════════════════════════════
with tab_pt:
    st.markdown("### 🧾 Tạo Phiếu Thu")
    st.caption("Xác nhận đã thu tiền · Chuẩn Mẫu 01-TT · 2 liên · Tự động lưu Google Drive")
    st.divider()

    prefill_pt=st.session_state.pop("_prefill_pt",None)
    crm_opts_pt={k["id"]:f"{k['ten']} — {k['sdt'] or k['email'] or ''}" for k in st.session_state.crm}
    crm_choice_pt=st.selectbox("Chọn khách hàng từ CRM (tự điền form)",
        options=["— Chọn từ danh sách —"]+list(crm_opts_pt.values()),key="pt_crm_sel")
    selected_pt=None
    if crm_choice_pt!="— Chọn từ danh sách —":
        selected_pt=next((k for k in st.session_state.crm
            if f"{k['ten']} — {k['sdt'] or k['email'] or ''}"==crm_choice_pt),None)
    kh_pt=prefill_pt or selected_pt
    def _pval(field,default=""): return (kh_pt.get(field,default) or default) if kh_pt else default
    so_hd_pt_default=""
    if kh_pt and kh_pt.get("hop_dong"): so_hd_pt_default=kh_pt["hop_dong"].get("so_hd","")
    st.divider()

    with st.form("form_pt",clear_on_submit=False):
        c1,c2=st.columns(2)
        with c1:
            pt_nguoi_nop=st.text_input("Người nộp tiền *",value=_pval("ten"),placeholder="Ông/Bà Nguyễn Văn A")
            pt_sdt=st.text_input("Số điện thoại",value=_pval("sdt"))
            pt_dc=st.text_input("Địa chỉ",value=_pval("diachi"))
            pt_so_tien=st.number_input("Số tiền đã thu (VNĐ) *",min_value=0,step=500000,value=int(_pval("phi") or 0),format="%d")
        with c2:
            pt_noi_dung=st.text_input("Nội dung thu",
                value=f"Phí dịch vụ pháp lý theo HĐ {so_hd_pt_default}" if so_hd_pt_default else "",
                placeholder="Phí dịch vụ pháp lý đợt 1...")
            pt_so_hd=st.text_input("Số HĐ / Mã ĐNTT",value=so_hd_pt_default)
            pt_hinh_thuc=st.radio("Hình thức thanh toán",["Chuyển khoản","Tiền mặt"],horizontal=True)
            pt_ngay_thu=st.text_input("Ngày thu",value=datetime.now().strftime("%d/%m/%Y"),placeholder="dd/mm/yyyy")
            pt_nguoi_thu=st.text_input("Người thu tiền",value="Võ Hồng Tú")
        pt_ghi_chu=st.text_area("Ghi chú",height=60)
        pt_ten_file=st.text_input("Tên file",
            value=f"PT_{_pval('ten').replace(' ','_')[:25]}" if kh_pt else "",
            placeholder="phieu_thu_nguyen_van_a")
        sub_pt=st.form_submit_button("🧾 Tạo Phiếu Thu",type="primary",use_container_width=True)

    if sub_pt:
        if not pt_nguoi_nop.strip(): st.warning("⚠️ Vui lòng nhập tên người nộp tiền.")
        elif int(pt_so_tien)==0: st.warning("⚠️ Vui lòng nhập số tiền đã thu.")
        else:
            with st.spinner("Đang tạo Phiếu Thu..."):
                try:
                    so_hd_clean=pt_so_hd.strip().split("/")[0].strip()
                    ma_dntt_clean=pt_so_hd.strip().split("/")[1].strip() if "/" in pt_so_hd else ""
                    result=tao_phieu_thu(nguoi_nop=pt_nguoi_nop.strip(),so_tien_raw=int(pt_so_tien),
                        noi_dung_thu=pt_noi_dung.strip(),hinh_thuc_tt=pt_hinh_thuc,
                        so_hop_dong=so_hd_clean,ma_de_nghi=ma_dntt_clean,
                        dia_chi=pt_dc.strip(),sdt=pt_sdt.strip(),nguoi_thu=pt_nguoi_thu.strip(),
                        ngay_thu=pt_ngay_thu.strip(),ghi_chu=pt_ghi_chu.strip())
                    ma_pt=result["ma_phieu_thu"]; data_extra=result["data_extra"]
                    ten_file=pt_ten_file.strip() or f"PT_{pt_nguoi_nop.strip().replace(' ','_')[:30]}"
                    docx_path=xuat_word("",ten_file,loai="phieu_thu",data_extra=data_extra)
                    if docx_path.startswith("LOI:"): st.error(f"❌ {docx_path}")
                    else:
                        write_log(current_user,"TAO_PHIEU_THU",f"KH: {pt_nguoi_nop.strip()} | Mã: {ma_pt} | Số tiền: {int(pt_so_tien):,}đ")
                        st.success(f"✅ Đã tạo **{ma_pt}** · Đã lưu Google Drive")
                        col1,col2=st.columns(2)
                        col1.metric("Số tiền đã thu",f"{int(pt_so_tien):,}".replace(",",".")+" đ")
                        col2.metric("Hình thức",pt_hinh_thuc)
                        with open(docx_path,"rb") as f:
                            st.download_button("📥 Tải về .docx",data=f.read(),file_name=f"{ten_file}.docx",
                                mime="application/vnd.openxmlformats-officedocument.wordprocessingml.document",type="primary")
                except Exception as e: st.error(f"❌ Lỗi: {e}")


# ══════════════════════════════════════════════
# TAB 6 — LOG HOẠT ĐỘNG (chỉ admin)
# ══════════════════════════════════════════════
if tab_log is not None:
    with tab_log:
        st.markdown("### 🔐 Log Hoạt Động Nhân Viên")
        st.caption("Toàn bộ thao tác đăng nhập, tạo tài liệu, CRM đều được ghi lại")
        st.divider()
        logs=_load_log()
        if not logs: st.info("Chưa có log nào.")
        else:
            fl1,fl2,fl3=st.columns([2,2,1])
            with fl1:
                users_in_log=["Tất cả"]+sorted(set(l.get("user","") for l in logs))
                filter_user=st.selectbox("Lọc theo nhân viên",users_in_log)
            with fl2:
                actions_in_log=["Tất cả"]+sorted(set(l.get("action","") for l in logs))
                filter_action=st.selectbox("Lọc theo hành động",actions_in_log)
            with fl3:
                st.markdown("<br>",unsafe_allow_html=True)
                log_csv=io.StringIO(); lw=csv.writer(log_csv)
                lw.writerow(["Thời gian","Nhân viên","Hành động","Chi tiết","IP"])
                for l in logs: lw.writerow([l.get("time",""),l.get("user",""),l.get("action",""),l.get("detail",""),l.get("ip","")])
                st.download_button("↓ Export CSV",log_csv.getvalue().encode("utf-8-sig"),"log_hoatdong.csv","text/csv",use_container_width=True)

            filtered_logs=logs
            if filter_user!="Tất cả": filtered_logs=[l for l in filtered_logs if l.get("user")==filter_user]
            if filter_action!="Tất cả": filtered_logs=[l for l in filtered_logs if l.get("action")==filter_action]
            filtered_logs=list(reversed(filtered_logs))

            st.markdown(f"**{len(filtered_logs)} bản ghi**")
            st.divider()
            h1,h2,h3,h4,h5=st.columns([2,2,2,4,2])
            for col,label in zip([h1,h2,h3,h4,h5],["Thời gian","Nhân viên","Hành động","Chi tiết","IP"]):
                col.markdown(f"**{label}**")
            st.divider()
            action_icons={"LOGIN":"🟢","LOGIN_FAIL":"🔴","AUTO_LOGOUT":"🟡","LOGOUT":"⚪",
                "TAO_BAO_GIA":"📄","TAO_HOP_DONG":"📝","TAO_DNTT":"💳","TAO_PHIEU_THU":"🧾",
                "XUAT_WORD_BG":"⬇️","XUAT_WORD_HD":"⬇️","LUU_CRM":"💾","LUU_CRM_HD":"💾",
                "THEM_KH_CRM":"➕","CAP_NHAT_KH":"✏️","XOA_KH":"🗑"}
            for l in filtered_logs[:100]:
                icon=action_icons.get(l.get("action",""),"•")
                c1,c2,c3,c4,c5=st.columns([2,2,2,4,2])
                c1.caption(l.get("time","")); c2.markdown(f"**{l.get('user','')}**")
                c3.markdown(f"{icon} `{l.get('action','')}`"); c4.caption(l.get("detail","")); c5.caption(l.get("ip",""))
            if len(filtered_logs)>100:
                st.caption(f"_(Hiển thị 100/{len(filtered_logs)} bản ghi — export CSV để xem tất cả)_")
