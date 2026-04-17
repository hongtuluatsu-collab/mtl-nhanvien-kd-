"""
startup.py — MTL Nhân Viên KD
Kiểm tra môi trường khi khởi động Railway
"""
import os, sys
from pathlib import Path

def check():
    errors = []
    warns  = []

    # Bắt buộc
    if not os.getenv("ANTHROPIC_API_KEY"):
        errors.append("ANTHROPIC_API_KEY chưa được set")
    if not os.getenv("NV_PASSWORD"):
        warns.append("NV_PASSWORD chưa set — dùng mật khẩu mặc định MinhTu@2026")

    # Thư mục data
    for d in ["data/hop_dong", "data/crm", "data/mau"]:
        Path(d).mkdir(parents=True, exist_ok=True)

    # Agents JS
    for f in ["agents/word_bao_gia.js", "agents/word_hop_dong.js"]:
        if not Path(f).exists():
            warns.append(f"{f} không tồn tại — xuất Word sẽ không hoạt động")

    if errors:
        print("❌ LỖI NGHIÊM TRỌNG:")
        for e in errors: print(f"   • {e}")
        sys.exit(1)

    if warns:
        print("⚠️  Cảnh báo:")
        for w in warns: print(f"   • {w}")

    print("✅ MTL Nhân Viên KD — Khởi động thành công")

if __name__ == "__main__":
    check()
