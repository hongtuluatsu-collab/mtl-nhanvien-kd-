"""
agents/hop_dong_agent.py — Minh Tú Law
Xử lý tạo báo giá, hợp đồng dịch vụ pháp lý và xuất Word (.docx)
"""

import os, json, re, subprocess
from datetime import datetime
from pathlib import Path
import anthropic


SYSTEM_PROMPT = """Bạn là trợ lý pháp lý chuyên nghiệp của Công ty Luật TNHH Minh Tú (MTL), TP.HCM.
Địa chỉ trụ sở: 4/9 Đường số 3, Cư Xá Đô Thành, P. Bàn Cờ, Q.3, TP.HCM.
Chi nhánh Đà Nẵng: 81 Xô Viết Nghệ Tĩnh, P. Cẩm Lệ, TP. Đà Nẵng.
GPĐKHĐ: 41.02.4764/TP/ĐKHĐ | MST: 0318941023 | Hotline: 1900 0031.
LS. Võ Hồng Tú — Giám đốc / Luật sư điều hành.
Ngân hàng: CTY LUAT TNHH MINH TU | STK: 5150056789 | MB Bank (TMCP Quân Đội) — CN Phú Nhuận.
Viết bằng tiếng Việt, văn phong pháp lý trang trọng, chuyên nghiệp. Không dùng markdown, #, *, **."""

LOAI_VU_OPTIONS = [
    "Tranh chấp đất đai / Bất động sản",
    "Hôn nhân & Gia đình (ly hôn, giám hộ)",
    "Hình sự (bào chữa / bị hại)",
    "Tranh chấp hợp đồng thương mại",
    "Thành lập / Giải thể doanh nghiệp",
    "Sở hữu trí tuệ (nhãn hiệu, bản quyền)",
    "Lao động (sa thải, tranh chấp lương)",
    "Tư vấn pháp luật theo tháng",
    "Soạn thảo hợp đồng",
    "Khác",
]


def _fmt(val) -> str:
    """Format số nguyên thành chuỗi tiền tệ kiểu VN: 30.000.000"""
    try:
        return f"{int(str(val).replace(',','').replace('.','').replace('đ','')):,}".replace(",", ".")
    except:
        return str(val)

def _today() -> str:
    return datetime.now().strftime("%d/%m/%Y")

def _gen_ma_bg() -> str:
    return f"BG-{datetime.now().year}-{datetime.now().strftime('%m%d%H%M')}"

def _gen_ma_hd() -> str:
    return f"HD-{datetime.now().year}-{datetime.now().strftime('%m%d%H%M')}"

def _call_claude(prompt: str, max_tokens: int = 2000) -> str:
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    client = anthropic.Anthropic(api_key=api_key)
    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=max_tokens,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text


class HopDongAgent:
    """Agent tạo báo giá & hợp đồng dịch vụ pháp lý MTL."""

    # ──────────────────────────────────────────
    # TẠO BÁO GIÁ
    # ──────────────────────────────────────────
    def tao_bao_gia(
        self,
        ten_than_chu: str,
        loai_vu: str,
        cach_tinh_phi: str,
        mo_ta_vu: str,
        gia_tri_vu: int | str,
        sdt: str = "",
        email: str = "",
        dia_chi: str = "",
        ten_du_an: str = "",
    ) -> dict:
        """
        Tạo thư báo phí dịch vụ pháp lý.

        Returns:
            {
              "ma_bao_gia": str,
              "noi_dung": str,
              "data_extra": dict  ← dùng cho xuat_word()
            }
        """
        ma_bg = _gen_ma_bg()
        phi_raw = int(re.sub(r"\D", "", str(gia_tri_vu)) or "0")
        phi_vat = round(phi_raw * 0.1)
        phi_total = phi_raw + phi_vat

        prompt = f"""Soạn THƯ BÁO PHÍ DỊCH VỤ PHÁP LÝ với thông tin:

Mã báo giá: {ma_bg} | Ngày: {_today()}
Khách hàng: {ten_than_chu}
SĐT: {sdt or '—'} | Email: {email or '—'}
Địa chỉ: {dia_chi or '—'}
Loại vụ: {loai_vu}
Tên vụ/dự án: {ten_du_an or loai_vu}
Cách tính phí: {cach_tinh_phi}
Mô tả: {mo_ta_vu}

CẤU TRÚC BẮT BUỘC (không dùng bảng ASCII):

I. PHẠM VI DỊCH VỤ
01. [Tên hạng mục]
   [Mô tả 1–2 câu]
(5–6 hạng mục, đánh số 01 đến 05 hoặc 06)

II. BẢNG PHÍ DỊCH VỤ
Phí dịch vụ (chưa VAT): {_fmt(phi_raw)}đ
Thuế VAT (10%): {_fmt(phi_vat)}đ
Tổng phí phải thanh toán: {_fmt(phi_total)}đ
(Bằng chữ: [viết tổng phí bằng chữ tiếng Việt])

III. ĐIỀU KIỆN & LƯU Ý
(4 điểm quan trọng về phạm vi, bảo mật, cam kết)

IV. THANH TOÁN
Tên TK: CTY LUAT TNHH MINH TU
STK: 5150056789 — MB Bank (TMCP Quân Đội), CN Phú Nhuận
Nội dung CK: {ten_than_chu} thanh toán {ma_bg}

Văn phong pháp lý trang trọng. Không dùng markdown, *, #, **.
"""
        noi_dung = _call_claude(prompt, max_tokens=2000)

        data_extra = {
            "ma_bao_gia": ma_bg,
            "ten_than_chu": ten_than_chu,
            "dia_chi": dia_chi,
            "sdt": sdt,
            "email": email,
            "loai_vu": loai_vu,
            "ten_du_an": ten_du_an or loai_vu,
            "loai_dich_vu": cach_tinh_phi,
            "mo_ta_ngan": mo_ta_vu[:200],
            "tong_phi_raw": phi_total,
            "tong_phi_fmt": _fmt(phi_total),
            "ngay_lap": _today(),
            "noi_dung": noi_dung,
        }
        return {
            "ma_bao_gia": ma_bg,
            "noi_dung": noi_dung,
            "data_extra": data_extra,
        }

    # ──────────────────────────────────────────
    # TẠO HỢP ĐỒNG
    # ──────────────────────────────────────────
    def tao_hop_dong(
        self,
        ten_than_chu: str,
        loai_dich_vu: str,
        phi_dich_vu: int | str,
        pham_vi_dich_vu: str,
        phuong_thuc_thanh_toan: str = "50% khi ký — 50% khi hoàn thành",
        thoi_han_hd: str = "Đến khi hoàn thành vụ việc",
        sdt: str = "",
        email: str = "",
        dia_chi: str = "",
        cmnd_mst: str = "",
        so_hop_dong: str = "",
    ) -> dict:
        """
        Tạo hợp đồng dịch vụ pháp lý 10 điều khoản.

        Returns:
            {
              "so_hop_dong": str,
              "noi_dung": str,
              "data_extra": dict  ← dùng cho xuat_word()
            }
        """
        so_hd = so_hop_dong or _gen_ma_hd()
        phi_raw = int(re.sub(r"\D", "", str(phi_dich_vu)) or "0")
        phi_vat = round(phi_raw * 0.1)
        phi_total = phi_raw + phi_vat

        prompt = f"""Soạn HỢP ĐỒNG DỊCH VỤ PHÁP LÝ đầy đủ 10 điều khoản chuẩn pháp lý Việt Nam:

Số HĐ: {so_hd} | Ngày ký: {_today()}

BÊN A — BÊN CUNG CẤP DỊCH VỤ:
  Tên: CÔNG TY LUẬT TNHH MINH TÚ
  GPĐKHĐ: 41.02.4764/TP/ĐKHĐ | MST: 0318941023
  Đại diện: LS. VÕ HỒNG TÚ — Giám đốc / Luật sư điều hành
  Địa chỉ: 4/9 Đường số 3, Cư Xá Đô Thành, P. Bàn Cờ, Q.3, TP.HCM
  Hotline: 1900 0031 | Email: votu@luatminhtu.vn

BÊN B — BÊN SỬ DỤNG DỊCH VỤ:
  Tên: {ten_than_chu}
  CMND/CCCD/MST: {cmnd_mst or '___________'}
  Địa chỉ: {dia_chi or '___________'}
  Điện thoại: {sdt or '___________'} | Email: {email or '___________'}

THÔNG TIN DỊCH VỤ:
  Loại dịch vụ: {loai_dich_vu}
  Phạm vi: {pham_vi_dich_vu}
  Phí (chưa VAT): {_fmt(phi_raw)}đ | VAT 10%: {_fmt(phi_vat)}đ | Tổng: {_fmt(phi_total)}đ
  Thanh toán: {phuong_thuc_thanh_toan}
  Thời hạn: {thoi_han_hd}
  TK thanh toán: CTY LUAT TNHH MINH TU | STK: 5150056789 | MB Bank CN Phú Nhuận

SOẠN ĐẦY ĐỦ 10 ĐIỀU KHOẢN:
  Điều 1: Đối tượng hợp đồng (phạm vi dịch vụ cụ thể)
  Điều 2: Phí dịch vụ và phương thức thanh toán (bảng phí + thông tin ngân hàng)
  Điều 3: Quyền và nghĩa vụ của Bên A (≥5 điểm)
  Điều 4: Quyền và nghĩa vụ của Bên B (≥5 điểm)
  Điều 5: Thời hạn hợp đồng và tiến độ thực hiện
  Điều 6: Tạm ngừng và chấm dứt hợp đồng trước hạn
  Điều 7: Hiệu lực hợp đồng
  Điều 8: Giải quyết tranh chấp (TAND có thẩm quyền tại TP.HCM)
  Điều 9: Miễn trừ trách nhiệm và bảo mật thông tin
  Điều 10: Cam kết chung (các bên đã đọc, hiểu và đồng ý toàn bộ)

Cuối HĐ: ô ký tên 2 bên (BÊN A trái — BÊN B phải).
Văn phong pháp lý, trang trọng, căn đều. Không dùng markdown, *, #, **.
"""
        noi_dung = _call_claude(prompt, max_tokens=3000)

        data_extra = {
            "so_hop_dong": so_hd,
            "ten_than_chu": ten_than_chu,
            "cmnd": cmnd_mst,
            "dia_chi": dia_chi,
            "sdt": sdt,
            "email": email,
            "loai_vu": loai_dich_vu,
            "loai_dich_vu": loai_dich_vu,
            "tong_phi_raw": phi_total,
            "tong_phi_fmt": _fmt(phi_total),
            "phuong_thuc_tt": phuong_thuc_thanh_toan,
            "thoi_han": thoi_han_hd,
            "ngay_lap": _today(),
            "noi_dung": noi_dung,
        }
        return {
            "so_hop_dong": so_hd,
            "noi_dung": noi_dung,
            "data_extra": data_extra,
        }

    # ──────────────────────────────────────────
    # XUẤT WORD
    # ──────────────────────────────────────────
    def xuat_word(
        self,
        noi_dung: str,
        ten_file: str,
        loai: str = "bao_gia",
        data_extra: dict = None,
    ) -> str:
        """
        Gọi Node.js tạo file .docx theo template MTL.

        Args:
            noi_dung : Nội dung văn bản (từ AI)
            ten_file : Tên file (không có đuôi .docx)
            loai     : "bao_gia" | "hop_dong"
            data_extra: dict bổ sung (ma_bao_gia, ten_than_chu, tong_phi_raw, ...)

        Returns:
            str: đường dẫn .docx nếu thành công, "LOI:..." nếu lỗi
        """
        out_dir = Path("data/hop_dong")
        out_dir.mkdir(parents=True, exist_ok=True)

        payload = {
            "noi_dung": noi_dung,
            "ten_file": ten_file,
            "ngay_lap": _today(),
        }
        if data_extra:
            payload.update(data_extra)

        json_path = str(out_dir / f"{ten_file}_input.json")
        docx_path = str(out_dir / f"{ten_file}.docx")

        Path(json_path).write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

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
                try:
                    os.remove(json_path)
                except:
                    pass
                return docx_path
            else:
                err = result.stderr[:300] or result.stdout[:300]
                return f"LOI:{err}"
        except FileNotFoundError:
            return "LOI:Node.js chưa được cài hoặc file JS không tồn tại"
        except subprocess.TimeoutExpired:
            return "LOI:Timeout — Node.js mất quá 30 giây"
        except Exception as e:
            return f"LOI:{e}"
