"""Arabic reservation-deposit receipt PDF (سند قبض)."""
from __future__ import annotations

import io
from datetime import date, datetime
from pathlib import Path

import arabic_reshaper
from bidi.algorithm import get_display
from num2words import num2words
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

FONTS_DIR = Path(__file__).parent / "fonts"
FONT_REGULAR = "Amiri"
FONT_BOLD = "Amiri-Bold"

_PRIMARY = HexColor("#1E3A5F")   # deep blue header band
_ACCENT = HexColor("#C9A961")    # gold accent
_MUTED = HexColor("#6B6B6B")
_LINE = HexColor("#D0D0D0")

PAYMENT_METHOD_AR = {
    "cash": "نقداً",
    "bank_transfer": "تحويل بنكي",
    "check": "شيك",
}

_FONTS_REGISTERED = False


def _register_fonts() -> None:
    global _FONTS_REGISTERED
    if _FONTS_REGISTERED:
        return
    pdfmetrics.registerFont(TTFont(FONT_REGULAR, str(FONTS_DIR / "Amiri-Regular.ttf")))
    pdfmetrics.registerFont(TTFont(FONT_BOLD, str(FONTS_DIR / "Amiri-Bold.ttf")))
    _FONTS_REGISTERED = True


def _ar(text: str) -> str:
    """Shape + bidi-reorder Arabic so ReportLab renders it correctly."""
    if not text:
        return ""
    return get_display(arabic_reshaper.reshape(str(text)))


def _amount_in_arabic_words(amount: float) -> str:
    """Convert a SAR amount to its Arabic words form."""
    try:
        whole = int(amount)
        words = num2words(whole, lang="ar")
        return f"{words} ريال سعودي فقط لا غير"
    except Exception:
        return ""


def _fmt_money(amount: float | None) -> str:
    if amount is None:
        return "—"
    return f"{amount:,.0f}"


def _fmt_date(value: str | date | datetime | None) -> str:
    if not value:
        return "—"
    if isinstance(value, (date, datetime)):
        return value.strftime("%Y-%m-%d")
    try:
        return str(value)[:10]
    except Exception:
        return "—"


def _draw_right(c: canvas.Canvas, x_right: float, y: float, text: str, *, font: str = FONT_REGULAR, size: int = 10, color=black) -> None:
    """Draw Arabic/mixed text anchored to its right edge."""
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawRightString(x_right, y, _ar(text))


def _draw_left(c: canvas.Canvas, x_left: float, y: float, text: str, *, font: str = FONT_REGULAR, size: int = 10, color=black) -> None:
    c.setFont(font, size)
    c.setFillColor(color)
    c.drawString(x_left, y, _ar(text))


def _draw_kv_row(
    c: canvas.Canvas,
    *,
    x_right: float,
    x_left: float,
    y: float,
    label: str,
    value: str,
    value_bold: bool = False,
) -> None:
    """Right-anchored label + underlined value filling to the left."""
    label_font_size = 10
    value_font_size = 11

    c.setFont(FONT_BOLD, label_font_size)
    c.setFillColor(_MUTED)
    label_shaped = _ar(label + ":")
    c.drawRightString(x_right, y, label_shaped)
    label_w = c.stringWidth(label_shaped, FONT_BOLD, label_font_size)

    value_right = x_right - label_w - 6
    c.setFont(FONT_BOLD if value_bold else FONT_REGULAR, value_font_size)
    c.setFillColor(black)
    c.drawRightString(value_right, y, _ar(value or "—"))

    c.setStrokeColor(_LINE)
    c.setLineWidth(0.5)
    c.line(x_left, y - 3, value_right + 4, y - 3)


FOOTER_TERMS_AR = [
    "١. مدة الحجز أربعة عشر (14) يوماً من تاريخ توقيع هذا السند.",
    "٢. يحق للمؤسسة إلغاء الحجز تلقائياً في حال عدم سداد كامل قيمة الوحدة قبل انتهاء المدة.",
    "٣. السداد النقدي الكامل لقيمة الوحدة قبل انتهاء المدة يُعطى الأولوية على الحجوزات الأخرى.",
    "٤. العربون قابل للرد في حال إلغاء العميل للحجز قبل انتهاء المدة المحددة، وفق سياسة المؤسسة.",
]


def generate_receipt_pdf(
    *,
    reservation: dict,
    unit: dict,
    customer: dict,
    company: dict,
    project: dict | None = None,
    building: dict | None = None,
) -> bytes:
    """Render a one-page Arabic receipt PDF. Returns the PDF as bytes."""
    _register_fonts()

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    page_w, page_h = A4

    margin_x = 40
    right_edge = page_w - margin_x
    left_edge = margin_x

    # ── Header band ──────────────────────────────────────────────────────────
    header_h = 70
    c.setFillColor(_PRIMARY)
    c.rect(0, page_h - header_h, page_w, header_h, stroke=0, fill=1)

    c.setFillColor(white)
    c.setFont(FONT_BOLD, 18)
    company_name = company.get("name_ar") or company.get("name") or "PropManager"
    c.drawRightString(right_edge, page_h - 32, _ar(company_name))
    c.setFont(FONT_REGULAR, 10)
    c.drawRightString(right_edge, page_h - 50, _ar("سجل الحجوزات العقارية"))

    # Serial number (top-left of header)
    c.setFillColor(_ACCENT)
    c.setFont(FONT_BOLD, 14)
    serial = str(reservation.get("id", ""))[:8].upper()
    c.drawString(left_edge, page_h - 32, f"#{serial}")
    c.setFillColor(white)
    c.setFont(FONT_REGULAR, 9)
    c.drawString(left_edge, page_h - 50, _ar("رقم السند"))

    # ── Title ────────────────────────────────────────────────────────────────
    y = page_h - header_h - 30
    c.setFillColor(black)
    c.setFont(FONT_BOLD, 22)
    c.drawCentredString(page_w / 2, y, _ar("سند قبض عربون حجز"))

    # ── Amount box (prominent) ───────────────────────────────────────────────
    y -= 40
    box_h = 42
    c.setFillColor(HexColor("#F8F5EC"))
    c.setStrokeColor(_ACCENT)
    c.setLineWidth(1.2)
    c.rect(left_edge, y - box_h + 10, page_w - 2 * margin_x, box_h, stroke=1, fill=1)

    c.setFillColor(_MUTED)
    c.setFont(FONT_BOLD, 10)
    c.drawRightString(right_edge - 12, y - 4, _ar("المبلغ المستلم"))

    amount_str = f"{_fmt_money(reservation.get('deposit_amount'))} ريال سعودي"
    c.setFillColor(_PRIMARY)
    c.setFont(FONT_BOLD, 18)
    c.drawCentredString(page_w / 2, y - 22, _ar(amount_str))

    # Amount in words (below box)
    y -= box_h + 8
    words = _amount_in_arabic_words(reservation.get("deposit_amount") or 0)
    if words:
        c.setFillColor(_MUTED)
        c.setFont(FONT_REGULAR, 10)
        c.drawRightString(right_edge, y, _ar(f"مبلغاً وقدره: {words}"))

    # ── Customer block ───────────────────────────────────────────────────────
    y -= 28
    c.setFillColor(_PRIMARY)
    c.setFont(FONT_BOLD, 12)
    c.drawRightString(right_edge, y, _ar("بيانات المستلم منه"))
    c.setStrokeColor(_ACCENT)
    c.setLineWidth(1)
    c.line(right_edge - 110, y - 3, right_edge, y - 3)

    y -= 22
    _draw_kv_row(c, x_right=right_edge, x_left=left_edge, y=y,
                 label="الاسم", value=customer.get("full_name", "—"), value_bold=True)
    y -= 22
    _draw_kv_row(c, x_right=right_edge, x_left=(page_w / 2) + 10, y=y,
                 label="رقم الهوية", value=customer.get("id_number", "—"))
    _draw_kv_row(c, x_right=(page_w / 2) - 10, x_left=left_edge, y=y,
                 label="الجوال", value=customer.get("phone", "—"))

    # ── Payment details block ────────────────────────────────────────────────
    y -= 32
    c.setFillColor(_PRIMARY)
    c.setFont(FONT_BOLD, 12)
    c.drawRightString(right_edge, y, _ar("تفاصيل السداد"))
    c.setStrokeColor(_ACCENT)
    c.line(right_edge - 90, y - 3, right_edge, y - 3)

    y -= 22
    method_ar = PAYMENT_METHOD_AR.get(reservation.get("payment_method", ""), "—")
    _draw_kv_row(c, x_right=right_edge, x_left=(page_w / 2) + 10, y=y,
                 label="طريقة السداد", value=method_ar)
    _draw_kv_row(c, x_right=(page_w / 2) - 10, x_left=left_edge, y=y,
                 label="تاريخ السداد", value=_fmt_date(reservation.get("payment_date")))

    y -= 22
    _draw_kv_row(c, x_right=right_edge, x_left=(page_w / 2) + 10, y=y,
                 label="رقم المرجع", value=reservation.get("payment_reference") or "—")
    _draw_kv_row(c, x_right=(page_w / 2) - 10, x_left=left_edge, y=y,
                 label="ينتهي في", value=_fmt_date(reservation.get("expires_at")))

    # ── Unit block ───────────────────────────────────────────────────────────
    y -= 32
    c.setFillColor(_PRIMARY)
    c.setFont(FONT_BOLD, 12)
    c.drawRightString(right_edge, y, _ar("بيانات الوحدة"))
    c.setStrokeColor(_ACCENT)
    c.line(right_edge - 85, y - 3, right_edge, y - 3)

    project_name = (project or {}).get("name_ar") or (project or {}).get("name") or "—"
    building_name = (building or {}).get("name") or (building or {}).get("building_number") or "—"

    y -= 22
    _draw_kv_row(c, x_right=right_edge, x_left=(page_w / 2) + 10, y=y,
                 label="المشروع", value=project_name)
    _draw_kv_row(c, x_right=(page_w / 2) - 10, x_left=left_edge, y=y,
                 label="المبنى", value=building_name)

    y -= 22
    _draw_kv_row(c, x_right=right_edge, x_left=(page_w / 2) + 10, y=y,
                 label="رقم الوحدة", value=str(unit.get("unit_number", "—")))
    _draw_kv_row(c, x_right=(page_w / 2) - 10, x_left=left_edge, y=y,
                 label="الدور", value=str(unit.get("floor", "—")))

    y -= 22
    _draw_kv_row(c, x_right=right_edge, x_left=(page_w / 2) + 10, y=y,
                 label="رقم الصك", value=unit.get("sak_id", "—"))
    _draw_kv_row(c, x_right=(page_w / 2) - 10, x_left=left_edge, y=y,
                 label="سعر الوحدة", value=f"{_fmt_money(unit.get('price'))} ريال", value_bold=True)

    # ── Footer terms ─────────────────────────────────────────────────────────
    y -= 36
    c.setFillColor(_PRIMARY)
    c.setFont(FONT_BOLD, 11)
    c.drawRightString(right_edge, y, _ar("الشروط والأحكام"))
    c.setStrokeColor(_ACCENT)
    c.line(right_edge - 85, y - 3, right_edge, y - 3)

    y -= 16
    c.setFillColor(HexColor("#333333"))
    c.setFont(FONT_REGULAR, 9)
    for term in FOOTER_TERMS_AR:
        c.drawRightString(right_edge, y, _ar(term))
        y -= 13

    # ── Signature row ────────────────────────────────────────────────────────
    y -= 20
    sig_line_len = 140
    # Right signature: reservations manager
    c.setStrokeColor(black)
    c.setLineWidth(0.6)
    c.line(right_edge - sig_line_len, y, right_edge, y)
    c.setFillColor(_MUTED)
    c.setFont(FONT_REGULAR, 9)
    c.drawRightString(right_edge, y - 12, _ar("مدير الحجوزات"))

    # Left signature: executive director
    c.line(left_edge, y, left_edge + sig_line_len, y)
    c.drawString(left_edge, y - 12, _ar("المدير التنفيذي"))

    # Stamp placeholder (centered)
    c.setStrokeColor(_LINE)
    c.setDash(2, 2)
    c.circle(page_w / 2, y - 6, 32, stroke=1, fill=0)
    c.setDash()
    c.setFont(FONT_REGULAR, 8)
    c.setFillColor(_MUTED)
    c.drawCentredString(page_w / 2, y - 8, _ar("الختم"))

    # ── Bottom meta ──────────────────────────────────────────────────────────
    c.setFont(FONT_REGULAR, 8)
    c.setFillColor(_MUTED)
    issued_at = datetime.now().strftime("%Y-%m-%d %H:%M")
    c.drawCentredString(page_w / 2, 28, _ar(f"صدر هذا السند إلكترونياً عبر PropManager في {issued_at}"))

    c.showPage()
    c.save()
    return buf.getvalue()
