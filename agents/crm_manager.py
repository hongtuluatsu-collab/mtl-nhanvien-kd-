"""
agents/crm_manager.py — Minh Tú Law
Quản lý CRM: đọc/ghi/tìm kiếm khách hàng từ data/crm.json
"""

import json, re
from datetime import datetime
from pathlib import Path
from typing import Optional

CRM_FILE = Path("data/crm.json")


def _load() -> list[dict]:
    try:
        CRM_FILE.parent.mkdir(parents=True, exist_ok=True)
        if CRM_FILE.exists():
            return json.loads(CRM_FILE.read_text(encoding="utf-8"))
    except Exception:
        pass
    return []


def _save(data: list[dict]) -> None:
    CRM_FILE.parent.mkdir(parents=True, exist_ok=True)
    CRM_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def _now_id() -> str:
    return str(int(datetime.now().timestamp() * 1000))


def _today() -> str:
    return datetime.now().strftime("%d/%m/%Y")


# ─────────────────────────────────────────────
# PUBLIC API
# ─────────────────────────────────────────────

def them_khach_hang(
    ten: str,
    sdt: str = "",
    email: str = "",
    dia_chi: str = "",
    loai_dich_vu: str = "",
    phi: str | int = "",
    ten_du_an: str = "",
    ghichu: str = "",
    ma_bao_gia: str = "",
    trang_thai: str = "tiemnang",   # tiemnang | baogia | hopdong
) -> dict:
    """
    Thêm hoặc cập nhật khách hàng trong CRM.
    Nếu đã tồn tại (cùng tên + sdt) → cập nhật.
    Trả về record đã lưu.
    """
    crm = _load()
    phi_str = re.sub(r"\D", "", str(phi))
    idx = next(
        (i for i, k in enumerate(crm)
         if k["ten"] == ten and (not sdt or k.get("sdt") == sdt)),
        -1,
    )
    kh = {
        "id": _now_id(),
        "ten": ten,
        "sdt": sdt,
        "email": email,
        "dia_chi": dia_chi,
        "loai": loai_dich_vu,
        "phi": phi_str,
        "duan": ten_du_an,
        "ghichu": ghichu,
        "ma_bg": ma_bao_gia,
        "ngay_bg": _today(),
        "trang_thai": trang_thai,
        "hop_dong": None,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
    }
    if idx >= 0:
        kh["id"] = crm[idx]["id"]
        kh["created_at"] = crm[idx].get("created_at", kh["created_at"])
        kh["hop_dong"] = crm[idx].get("hop_dong")
        crm[idx] = kh
    else:
        crm.insert(0, kh)
    _save(crm)
    return kh


def cap_nhat_hop_dong(
    ten_khach_hang: str,
    so_hop_dong: str,
    phi: str | int = "",
    loai_dich_vu: str = "",
) -> Optional[dict]:
    """
    Gắn thông tin hợp đồng vào hồ sơ khách hàng.
    Trả về record đã cập nhật hoặc None nếu không tìm thấy.
    """
    crm = _load()
    idx = next(
        (i for i, k in enumerate(crm) if k["ten"] == ten_khach_hang), -1
    )
    if idx < 0:
        return None
    crm[idx]["hop_dong"] = {
        "so_hd": so_hop_dong,
        "ngay_hd": _today(),
        "phi": re.sub(r"\D", "", str(phi)),
        "loai": loai_dich_vu,
    }
    crm[idx]["trang_thai"] = "hopdong"
    crm[idx]["updated_at"] = datetime.now().isoformat()
    _save(crm)
    return crm[idx]


def tim_khach_hang(
    query: str = "",
    trang_thai: str = "",   # "" = tất cả
) -> list[dict]:
    """
    Tìm kiếm khách hàng theo tên / SĐT / email / loại dịch vụ.
    Lọc thêm theo trạng thái nếu cần.
    """
    crm = _load()
    q = query.lower().strip()
    result = crm
    if q:
        result = [
            k for k in result
            if q in (k.get("ten") or "").lower()
            or q in (k.get("sdt") or "").lower()
            or q in (k.get("email") or "").lower()
            or q in (k.get("loai") or "").lower()
        ]
    if trang_thai:
        result = [k for k in result if k.get("trang_thai") == trang_thai]
    return result


def lay_khach_hang(kh_id: str) -> Optional[dict]:
    """Lấy một khách hàng theo ID."""
    crm = _load()
    return next((k for k in crm if k["id"] == kh_id), None)


def xoa_khach_hang(kh_id: str) -> bool:
    """Xóa khách hàng theo ID. Trả về True nếu thành công."""
    crm = _load()
    new_crm = [k for k in crm if k["id"] != kh_id]
    if len(new_crm) == len(crm):
        return False
    _save(new_crm)
    return True


def doi_trang_thai(kh_id: str, trang_thai: str) -> Optional[dict]:
    """Đổi trạng thái khách hàng."""
    crm = _load()
    idx = next((i for i, k in enumerate(crm) if k["id"] == kh_id), -1)
    if idx < 0:
        return None
    crm[idx]["trang_thai"] = trang_thai
    crm[idx]["updated_at"] = datetime.now().isoformat()
    _save(crm)
    return crm[idx]


def thong_ke() -> dict:
    """Trả về thống kê tổng quan CRM."""
    crm = _load()
    return {
        "tong_kh": len(crm),
        "tiem_nang": sum(1 for k in crm if k.get("trang_thai") == "tiemnang"),
        "bao_gia": sum(1 for k in crm if k.get("trang_thai") == "baogia"),
        "hop_dong": sum(1 for k in crm if k.get("trang_thai") == "hopdong"),
        "tong_doanh_thu": sum(int(k.get("phi") or 0) for k in crm),
    }


def xuat_csv() -> str:
    """Xuất toàn bộ CRM ra chuỗi CSV (UTF-8 BOM)."""
    import csv, io
    crm = _load()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([
        "Tên", "SĐT", "Email", "Địa chỉ",
        "Dịch vụ", "Phí (VNĐ)", "Mã BG", "Ngày BG",
        "Số HĐ", "Ngày HĐ", "Trạng thái", "Ghi chú",
    ])
    for k in crm:
        hd = k.get("hop_dong") or {}
        w.writerow([
            k.get("ten",""), k.get("sdt",""), k.get("email",""),
            k.get("dia_chi",""), k.get("loai",""), k.get("phi",""),
            k.get("ma_bg",""), k.get("ngay_bg",""),
            hd.get("so_hd",""), hd.get("ngay_hd",""),
            k.get("trang_thai",""), k.get("ghichu",""),
        ])
    return "\ufeff" + buf.getvalue()   # BOM cho Excel mở đúng tiếng Việt
