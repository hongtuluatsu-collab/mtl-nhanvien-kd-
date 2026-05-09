"""
agents/hop_dong_agent.py — Minh Tú Law
Xử lý tạo báo giá, hợp đồng dịch vụ pháp lý và xuất Word (.docx)

Phiên bản: v2 — 10/05/2026
Thay đổi so với v1:
  • VAT 10% → 8% (theo Nghị quyết giảm thuế VAT hiện hành)
  • tao_hop_dong: BỎ AI generation, dùng template cứng → Preview = Word 100%
  • Thêm field "pham_vi" vào data_extra để JS render scope đúng
  • Tiết kiệm token AI và nhanh hơn 3-5 giây mỗi lần tạo hợp đồng
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


# ════════════════════════════════════════════════════════
# HELPERS
# ════════════════════════════════════════════════════════
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


# ════════════════════════════════════════════════════════
# AGENT
# ════════════════════════════════════════════════════════
class HopDongAgent:
    """Agent tạo báo giá & hợp đồng dịch vụ pháp lý MTL."""

    # ──────────────────────────────────────────
    # TẠO BÁO GIÁ (vẫn dùng AI vì nội dung tùy biến theo loại vụ)
    # ──────────────────────────────────────────
    def tao_bao_gia(
        self,
        ten_than_chu: str,
        loai_vu: str,
        cach_tinh_phi: str,
        mo_ta_vu: str,
        gia_tri_vu,
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
        phi_vat = round(phi_raw * 0.08)  # ← VAT 8%
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
Thuế VAT (8%): {_fmt(phi_vat)}đ
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
    # TẠO HỢP ĐỒNG (KHÔNG dùng AI — render từ template để Preview = Word)
    # ──────────────────────────────────────────
    def tao_hop_dong(
        self,
        ten_than_chu: str,
        loai_dich_vu: str,
        phi_dich_vu,
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
        Tạo hợp đồng dịch vụ pháp lý 8 điều khoản (đồng bộ với template Word).

        KHÔNG gọi AI — nội dung điều khoản đã chuẩn hoá.
        Preview Streamlit = Word xuất ra (cùng nguồn data).

        Returns:
            {
              "so_hop_dong": str,
              "noi_dung": str,
              "data_extra": dict
            }
        """
        so_hd = so_hop_dong or _gen_ma_hd()
        phi_raw = int(re.sub(r"\D", "", str(phi_dich_vu)) or "0")
        phi_vat = round(phi_raw * 0.08)  # ← VAT 8%
        phi_total = phi_raw + phi_vat

        # Render preview text — khớp 1-1 với template Word (8 Điều)
        noi_dung = self._render_preview_hop_dong(
            so_hd=so_hd,
            ten_than_chu=ten_than_chu,
            cmnd_mst=cmnd_mst,
            dia_chi=dia_chi,
            sdt=sdt,
            email=email,
            loai_dich_vu=loai_dich_vu,
            pham_vi_dich_vu=pham_vi_dich_vu,
            phi_raw=phi_raw,
            phi_vat=phi_vat,
            phi_total=phi_total,
            phuong_thuc_thanh_toan=phuong_thuc_thanh_toan,
            thoi_han_hd=thoi_han_hd,
        )

        data_extra = {
            "so_hop_dong": so_hd,
            "ten_than_chu": ten_than_chu,
            "cmnd": cmnd_mst,
            "dia_chi": dia_chi,
            "sdt": sdt,
            "email": email,
            "loai_vu": loai_dich_vu,
            "loai_dich_vu": loai_dich_vu,
            "pham_vi": pham_vi_dich_vu,             # ← QUAN TRỌNG: JS dùng để render scope
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
    # HELPER: Render preview text cho hợp đồng (8 Điều, khớp template Word)
    # ──────────────────────────────────────────
    def _render_preview_hop_dong(
        self, so_hd, ten_than_chu, cmnd_mst, dia_chi, sdt, email,
        loai_dich_vu, pham_vi_dich_vu, phi_raw, phi_vat, phi_total,
        phuong_thuc_thanh_toan, thoi_han_hd,
    ) -> str:
        # Format scope items thành bullet list
        scope_lines = [l.strip() for l in pham_vi_dich_vu.split("\n") if l.strip()]
        if scope_lines:
            scope_text = "\n".join([f"   – {l}" for l in scope_lines])
        else:
            scope_text = f"   – {loai_dich_vu}"

        return f"""HỢP ĐỒNG DỊCH VỤ PHÁP LÝ
Số: {so_hd}  |  Ngày: {_today()}

═══════════════════════════════════════════════════════════
THÔNG TIN CÁC BÊN
═══════════════════════════════════════════════════════════

BÊN A — BÊN CUNG CẤP DỊCH VỤ
   CÔNG TY LUẬT TNHH MINH TÚ
   GPĐKHĐ: 41.02.4764/TP/ĐKHĐ  |  MST: 0318941023
   Địa chỉ: 4/9 Đường số 3, Cư Xá Đô Thành, P. Bàn Cờ, Q.3, TP.HCM
   ĐT: 1900 0031  |  Email: votu@luatminhtu.vn
   Đại diện: Ông Võ Hồng Tú — Giám đốc / Luật sư điều hành

BÊN B — BÊN SỬ DỤNG DỊCH VỤ
   Tên: {ten_than_chu}
   CCCD/MST: {cmnd_mst or '___________'}
   Địa chỉ: {dia_chi or '___________'}
   SĐT: {sdt or '___________'}  |  Email: {email or '___________'}

═══════════════════════════════════════════════════════════
CĂN CỨ PHÁP LÝ
═══════════════════════════════════════════════════════════
   – Căn cứ Hiến pháp nước CHXHCN Việt Nam năm 2013;
   – Căn cứ Bộ luật Dân sự năm 2015;
   – Căn cứ Luật Luật sư năm 2006, sửa đổi bổ sung năm 2012;
   – Căn cứ nhu cầu và thỏa thuận của các Bên.

Hai Bên thống nhất ký kết Hợp đồng Dịch vụ Pháp lý này với các điều khoản sau:

═══════════════════════════════════════════════════════════
NỘI DUNG HỢP ĐỒNG
═══════════════════════════════════════════════════════════

ĐIỀU 1. ĐỐI TƯỢNG CỦA HỢP ĐỒNG
Bên B đồng ý chọn Bên A là đơn vị tư vấn pháp lý và thực hiện các dịch vụ sau:
{scope_text}

ĐIỀU 2. PHÍ DỊCH VỤ VÀ PHƯƠNG THỨC THANH TOÁN
   Phí dịch vụ (chưa VAT): {_fmt(phi_raw)} đ
   Thuế VAT (8%):          {_fmt(phi_vat)} đ
   ─────────────────────────────────────────
   TỔNG PHÍ DỊCH VỤ:       {_fmt(phi_total)} đ (đã bao gồm VAT)

   Phương thức thanh toán: {phuong_thuc_thanh_toan}

   Tài khoản nhận thanh toán:
      – Tên TK: CTY LUAT TNHH MINH TU
      – STK: 5150056789
      – Ngân hàng: MB Bank (TMCP Quân Đội) — CN Phú Nhuận, TP.HCM
      – Nội dung CK: [Họ tên] — Phí DV — {so_hd}

   Sau 03 ngày làm việc kể từ khi nhận đủ phí, Bên A xuất hóa đơn VAT.

ĐIỀU 3. QUYỀN VÀ NGHĨA VỤ CỦA BÊN A
Nghĩa vụ:
   – Thực hiện công việc đúng chất lượng, khối lượng và thời hạn cam kết;
   – Không chuyển giao công việc cho bên thứ ba khi chưa được Bên B đồng ý;
   – Thông báo và xin ý kiến Bên B trước khi ban hành tài liệu cần phê duyệt;
   – Bảo mật toàn bộ thông tin của Bên B trong và sau khi thực hiện hợp đồng;
   – Bàn giao tài liệu, hồ sơ sau khi hoàn tất công việc;
   – Bồi thường nếu làm mất, hư hỏng tài sản hoặc để lộ thông tin mật của Bên B.
Quyền:
   – Yêu cầu Bên B cung cấp thông tin, tài liệu phục vụ công việc;
   – Nhận đầy đủ thù lao theo thỏa thuận tại Điều 2;
   – Yêu cầu Bên B phối hợp khi cần có mặt hoặc ý kiến trực tiếp;
   – Đơn phương chấm dứt hợp đồng và yêu cầu bồi thường nếu Bên B vi phạm nghiêm trọng.

ĐIỀU 4. QUYỀN VÀ NGHĨA VỤ CỦA BÊN B
Nghĩa vụ:
   – Cung cấp đầy đủ thông tin, tài liệu và phương tiện cần thiết cho Bên A;
   – Thanh toán đầy đủ và đúng hạn phí dịch vụ theo thỏa thuận;
   – Đảm bảo tính chính xác, trung thực của tài liệu cung cấp;
   – Bồi thường thiệt hại nếu đơn phương chấm dứt hợp đồng không có lý do chính đáng.
Quyền:
   – Được Bên A tư vấn pháp lý, soạn thảo văn bản và cập nhật tiến độ;
   – Đơn phương chấm dứt hợp đồng và yêu cầu bồi thường nếu Bên A vi phạm nghiêm trọng;
   – Hưởng các quyền lợi khác theo quy định pháp luật Việt Nam.

ĐIỀU 5. THỜI HẠN
Thời hạn thực hiện hợp đồng: {thoi_han_hd}.
Trong trường hợp kéo dài, hai Bên thỏa thuận bằng phụ lục hợp đồng.

ĐIỀU 6. HIỆU LỰC
Hợp đồng có hiệu lực kể từ ngày các Bên ký tên xác nhận, và kết thúc khi:
   – Đã hết thời hạn tại Điều 5 và các Bên đồng ý chấm dứt;
   – Khi công việc được hoàn thành theo Điều 1;
   – Một trong các Bên đơn phương chấm dứt theo thỏa thuận hoặc theo pháp luật.
Ngoài các trường hợp nêu trên, Hợp đồng không thể hủy ngang.

ĐIỀU 7. GIẢI QUYẾT TRANH CHẤP
Khi phát sinh tranh chấp, các Bên ưu tiên thương lượng, hòa giải.
Nếu hòa giải không thành, một Bên có quyền khởi kiện ra Tòa án nhân dân
có thẩm quyền tại TP. Hồ Chí Minh để giải quyết theo pháp luật Việt Nam.

ĐIỀU 8. CAM KẾT CHUNG
Trước khi ký Hợp đồng này, các Bên đã tìm hiểu kỹ về tư cách, thẩm quyền,
năng lực của nhau. Các Bên ký Hợp đồng trong trạng thái hoàn toàn tự nguyện,
tự do ý chí, không bị ép buộc.

Hợp đồng được lập tại 4/9 Đường số 3, Cư Xá Đô Thành, P. Bàn Cờ, Q.3, TP.HCM,
thành 02 bản chính tiếng Việt có giá trị pháp lý như nhau, mỗi Bên giữ 01 bản.

═══════════════════════════════════════════════════════════
KÝ KẾT
═══════════════════════════════════════════════════════════

ĐẠI DIỆN BÊN A                          ĐẠI DIỆN BÊN B
VÕ HỒNG TÚ                              {ten_than_chu.upper()}
Giám đốc / Luật sư điều hành            Bên sử dụng dịch vụ
"""

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
            noi_dung : Nội dung văn bản
            ten_file : Tên file (không có đuôi .docx)
            loai     : "bao_gia" | "hop_dong"
            data_extra: dict bổ sung

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
