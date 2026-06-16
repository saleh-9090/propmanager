#!/usr/bin/env python3
"""Generate a branded PropManager features PDF with Arabic support."""
from __future__ import annotations

import io
import sys
from datetime import datetime
from pathlib import Path

import arabic_reshaper
from bidi.algorithm import get_display
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

FONTS_DIR = Path(__file__).resolve().parent.parent / "backend" / "app" / "pdf" / "fonts"

FONT_REG = "Amiri"
FONT_BOLD = "Amiri-Bold"

PRIMARY = HexColor("#1E3A5F")
ACCENT = HexColor("#C9A961")
MUTED = HexColor("#6B6B6B")
LIGHT_BG = HexColor("#F8F5EC")
SECTION_BG = HexColor("#EDF2F7")
WHITE = white
BLACK = black


def _register_fonts():
    pdfmetrics.registerFont(TTFont(FONT_REG, str(FONTS_DIR / "Amiri-Regular.ttf")))
    pdfmetrics.registerFont(TTFont(FONT_BOLD, str(FONTS_DIR / "Amiri-Bold.ttf")))


def ar(text: str) -> str:
    if not text:
        return ""
    return get_display(arabic_reshaper.reshape(str(text)))


class FeaturesPDF:
    def __init__(self):
        self.buf = io.BytesIO()
        self.c = canvas.Canvas(self.buf, pagesize=A4)
        self.w, self.h = A4
        self.margin = 50
        self.y = self.h - self.margin
        self.page_num = 0
        self.right = self.w - self.margin
        self.left = self.margin
        self.content_width = self.right - self.left

    def _new_page(self):
        if self.page_num > 0:
            self._draw_footer()
            self.c.showPage()
        self.page_num += 1
        self.y = self.h - self.margin

    def _check_space(self, needed: float):
        if self.y - needed < 80:
            self._draw_footer()
            self.c.showPage()
            self.page_num += 1
            self.y = self.h - self.margin
            self._draw_page_header()

    def _draw_footer(self):
        c = self.c
        c.setStrokeColor(ACCENT)
        c.setLineWidth(0.5)
        c.line(self.left, 45, self.right, 45)
        c.setFont(FONT_REG, 8)
        c.setFillColor(MUTED)
        c.drawCentredString(self.w / 2, 30, f"PropManager Features — Page {self.page_num}")
        c.drawString(self.left, 30, "propmanager.dev")
        c.drawRightString(self.right, 30, ar("وثيقة سرية"))

    def _draw_page_header(self):
        c = self.c
        bar_h = 6
        c.setFillColor(PRIMARY)
        c.rect(0, self.h - bar_h, self.w, bar_h, stroke=0, fill=1)
        c.setFillColor(ACCENT)
        c.rect(0, self.h - bar_h - 2, self.w, 2, stroke=0, fill=1)
        self.y = self.h - bar_h - 20

    def draw_cover(self):
        self._new_page()
        c = self.c

        # Full header band
        header_h = 200
        c.setFillColor(PRIMARY)
        c.rect(0, self.h - header_h, self.w, header_h, stroke=0, fill=1)

        # Gold accent line
        c.setFillColor(ACCENT)
        c.rect(0, self.h - header_h, self.w, 4, stroke=0, fill=1)

        # Product name
        c.setFillColor(WHITE)
        c.setFont(FONT_BOLD, 42)
        c.drawCentredString(self.w / 2, self.h - 80, "PropManager")

        # Arabic tagline
        c.setFont(FONT_BOLD, 18)
        c.drawCentredString(self.w / 2, self.h - 115, ar("نظام إدارة مبيعات العقارات"))

        # Subtitle
        c.setFont(FONT_REG, 13)
        c.setFillColor(ACCENT)
        c.drawCentredString(self.w / 2, self.h - 145, "B2B Sales Management Platform for Saudi Real Estate")

        # Version / date
        c.setFillColor(HexColor("#A0B4CC"))
        c.setFont(FONT_REG, 10)
        c.drawCentredString(self.w / 2, self.h - 175, f"v1.0 — {datetime.now().strftime('%B %Y')}")

        self.y = self.h - header_h - 60

        # Identity box
        box_w = 300
        box_h = 90
        box_x = (self.w - box_w) / 2
        c.setFillColor(LIGHT_BG)
        c.setStrokeColor(ACCENT)
        c.setLineWidth(1)
        c.roundRect(box_x, self.y - box_h, box_w, box_h, 8, stroke=1, fill=1)

        c.setFillColor(PRIMARY)
        c.setFont(FONT_BOLD, 14)
        c.drawCentredString(self.w / 2, self.y - 25, "Saleh M.")
        c.setFont(FONT_REG, 11)
        c.setFillColor(MUTED)
        c.drawCentredString(self.w / 2, self.y - 45, "Product Owner & Developer")
        c.setFont(FONT_REG, 10)
        c.drawCentredString(self.w / 2, self.y - 65, "m.conan166@gmail.com")

        self.y -= box_h + 50

        # Feature summary box
        c.setFillColor(BLACK)
        c.setFont(FONT_REG, 11)
        summary_lines = [
            "One Arabic-first dashboard for the whole office —",
            "units, reservations, sales, commissions, and PDF contracts.",
        ]
        for line in summary_lines:
            c.drawCentredString(self.w / 2, self.y, line)
            self.y -= 18

        self.y -= 30

        # Key stats row
        stats = [("11", "Core Features"), ("5", "User Roles"), ("3", "PDF Documents")]
        stat_w = self.content_width / len(stats)
        for i, (num, label) in enumerate(stats):
            cx = self.left + stat_w * i + stat_w / 2
            c.setFillColor(PRIMARY)
            c.setFont(FONT_BOLD, 28)
            c.drawCentredString(cx, self.y, num)
            c.setFillColor(MUTED)
            c.setFont(FONT_REG, 10)
            c.drawCentredString(cx, self.y - 20, label)

    def draw_section_header(self, number: str, title_ar: str, title_en: str):
        self._check_space(50)
        c = self.c

        # Section band
        band_h = 32
        c.setFillColor(PRIMARY)
        c.roundRect(self.left, self.y - band_h + 5, self.content_width, band_h, 4, stroke=0, fill=1)

        c.setFillColor(WHITE)
        c.setFont(FONT_BOLD, 14)
        c.drawRightString(self.right - 12, self.y - 16, ar(title_ar))

        c.setFillColor(ACCENT)
        c.setFont(FONT_BOLD, 12)
        c.drawString(self.left + 12, self.y - 16, f"{number}. {title_en}")

        self.y -= band_h + 12

    def draw_bullet(self, text: str, indent: int = 0):
        self._check_space(18)
        c = self.c
        x = self.right - 15 - indent * 15

        c.setFillColor(ACCENT)
        c.setFont(FONT_REG, 8)
        c.drawRightString(x, self.y, "●")

        c.setFillColor(BLACK)
        c.setFont(FONT_REG, 10)

        # Handle long lines — wrap if needed
        shaped = ar(text)
        max_w = self.content_width - 30 - indent * 15
        text_w = c.stringWidth(shaped, FONT_REG, 10)
        if text_w > max_w and len(text) > 50:
            mid = len(text) // 2
            space = text.rfind(' ', 0, mid)
            if space == -1:
                space = text.find(' ', mid)
            if space != -1:
                c.drawRightString(x - 12, self.y, ar(text[:space]))
                self.y -= 16
                self._check_space(16)
                c.setFont(FONT_REG, 10)
                c.setFillColor(BLACK)
                c.drawRightString(x - 12, self.y, ar(text[space + 1:]))
            else:
                c.drawRightString(x - 12, self.y, shaped)
        else:
            c.drawRightString(x - 12, self.y, shaped)
        self.y -= 16

    def draw_table(self, headers: list[str], rows: list[list[str]]):
        col_count = len(headers)
        col_w = self.content_width / col_count
        row_h = 24
        total_h = row_h * (len(rows) + 1) + 10
        self._check_space(total_h)
        c = self.c

        # Header row
        c.setFillColor(PRIMARY)
        c.rect(self.left, self.y - row_h + 5, self.content_width, row_h, stroke=0, fill=1)
        c.setFillColor(WHITE)
        c.setFont(FONT_BOLD, 10)
        for i, h in enumerate(headers):
            cx = self.right - col_w * i - col_w / 2
            c.drawCentredString(cx, self.y - 12, ar(h))
        self.y -= row_h

        # Data rows
        for ri, row in enumerate(rows):
            if ri % 2 == 0:
                c.setFillColor(LIGHT_BG)
                c.rect(self.left, self.y - row_h + 5, self.content_width, row_h, stroke=0, fill=1)
            c.setFillColor(BLACK)
            c.setFont(FONT_REG, 10)
            for i, cell in enumerate(row):
                cx = self.right - col_w * i - col_w / 2
                c.drawCentredString(cx, self.y - 12, ar(cell))
            self.y -= row_h
        self.y -= 10

    def draw_heading(self, text: str, size: int = 14):
        self._check_space(30)
        c = self.c
        c.setFillColor(PRIMARY)
        c.setFont(FONT_BOLD, size)
        c.drawRightString(self.right, self.y, ar(text))
        c.setStrokeColor(ACCENT)
        c.setLineWidth(1)
        c.line(self.left, self.y - 5, self.right, self.y - 5)
        self.y -= 24

    def build(self) -> bytes:
        _register_fonts()

        # ── Cover ──
        self.draw_cover()

        # ── Page 2+: Features ──
        self._draw_footer()
        self.c.showPage()
        self.page_num += 1
        self.y = self.h - self.margin
        self._draw_page_header()

        # 1. Multi-Tenant Company System
        self.draw_section_header("1", "نظام الشركات متعدد المستأجرين", "Multi-Tenant Company System")
        for b in [
            "تسجيل الشركة مع ترخيص هيئة العقار (REGA)",
            "5 أدوار: مالك، مدير مالي، مدير مبيعات، مدير حجوزات، محاسب",
            "صلاحيات على مستوى قاعدة البيانات (RLS)",
            "دعوة أعضاء الفريق عبر البريد الإلكتروني",
        ]:
            self.draw_bullet(b)
        self.y -= 8

        # 2. Project & Building Management
        self.draw_section_header("2", "إدارة المشاريع والمباني", "Project & Building Management")
        for b in [
            "إنشاء مشاريع عقارية متعددة (أبراج، مجمعات، فلل)",
            "تنظيم المباني تحت كل مشروع",
            "واجهة عرض مقسمة: شجرة المشاريع يمين، الوحدات يسار",
        ]:
            self.draw_bullet(b)
        self.y -= 8

        # 3. Unit Inventory
        self.draw_section_header("3", "مخزون الوحدات", "Unit Inventory")
        for b in [
            "بيانات كاملة: رقم الوحدة، الطابق، المساحة (م²)، السعر (ر.س)، رقم الصك",
            "تصنيف الوحدة: واجهة / داخلية / واجهتين",
            "تتبع عدادات الكهرباء والماء",
            "تتبع الحالة: متاحة / محجوزة / مباعة",
            "استيراد CSV دفعة واحدة للمشاريع الكبيرة",
            "رقم صك فريد عالمياً لمنع البيع المزدوج",
        ]:
            self.draw_bullet(b)
        self.y -= 8

        # 4. Unit Availability Board
        self.draw_section_header("4", "لوحة توفر الوحدات", "Unit Availability Board")
        for b in [
            "شبكة بطاقات بصرية لجميع الوحدات عبر المشاريع",
            "تصفية حسب المشروع والمبنى والحالة",
            "إحصائيات فورية: متاح / محجوز / مباع",
            "إجراء حجز سريع من أي وحدة متاحة",
        ]:
            self.draw_bullet(b)
        self.y -= 8

        # 5. Customer Management
        self.draw_section_header("5", "إدارة العملاء", "Customer Management")
        for b in [
            "ملفات العملاء: الاسم، رقم الهوية (وطنية/إقامة/جواز)، الجوال، البريد",
            "تتبع مصدر العميل: انستقرام، سناب، تيك توك، وسيط، زيارة مباشرة",
            "بحث شامل بالاسم ورقم الهوية والجوال",
            "إجراءات سريعة: حجز وحدة، تعديل، حذف",
        ]:
            self.draw_bullet(b)
        self.y -= 8

        # 6. Reservation Flow
        self.draw_section_header("6", "سير عمل الحجز", "Reservation Flow")
        for b in [
            "إنشاء حجز بمبلغ العربون وطريقة الدفع وتاريخه",
            "قفل الوحدة تلقائياً عند إنشاء الحجز",
            "تتبع تاريخ الانتهاء مع تنبيهات للحجوزات المنتهية",
            "إلغاء مع السبب — الوحدة تعود متاحة",
            "تتبع استرداد العربون (المبلغ، التاريخ، الطريقة)",
            "سند قبض عربون PDF عربي",
        ]:
            self.draw_bullet(b)
        self.y -= 8

        # 7. Sale Flow
        self.draw_section_header("7", "سير عمل البيع", "Sale Flow")
        for b in [
            "مساران: بيع مباشر (بدون عربون) أو تحويل من حجز",
            "تسجيل الدفع الكامل: المبلغ، الطريقة، المرجع، التاريخ",
            "تحديث حالة الوحدة تلقائياً إلى مباعة",
            "تحويل الحجز إلى بيع مع تتبع استرداد العربون",
            "عكس البيع (المالك فقط) مع سبب إلزامي",
        ]:
            self.draw_bullet(b)
        self.y -= 8

        # 8. Commission Management
        self.draw_section_header("8", "إدارة العمولات", "Commission Management")
        for b in [
            "تحديد إجمالي العمولة لكل عملية بيع",
            "تقسيم العمولات بين الموظفين والوسطاء الخارجيين",
            "توزيع بالنسبة المئوية (يجب أن يساوي 100%)",
            "شريط تقدم يوضح حالة التوزيع",
            "اعتماد نهائي من المالك فقط — يقفل مبالغ العمولة",
            "سجل الوسطاء الخارجيين مع اسم المكتب وترخيص REGA",
        ]:
            self.draw_bullet(b)
        self.y -= 8

        # 9. PDF Document Generation
        self.draw_section_header("9", "إنشاء مستندات PDF", "PDF Document Generation")
        for b in [
            "سند قبض عربون حجز عربي احترافي",
            "ترويسة الشركة، المبلغ كتابةً (عربي)، بيانات العميل والوحدة",
            "خانات توقيع ثنائية، مكان للختم الرسمي",
            "فتح في تبويب جديد عبر تحميل مصادق",
        ]:
            self.draw_bullet(b)
        self.y -= 8

        # 10. Dashboard
        self.draw_section_header("10", "لوحة المعلومات", "Dashboard")
        for b in [
            "بطاقات KPI: وحدات متاحة، حجوزات نشطة، مبيعات مكتملة، إجمالي الإيرادات",
            "توزيع الوحدات بأشرطة التقدم",
            "قائمة آخر المبيعات بروابط مباشرة",
            "تنبيهات الحجوزات المنتهية خلال 7 أيام",
        ]:
            self.draw_bullet(b)
        self.y -= 8

        # 11. Mobile Responsive
        self.draw_section_header("11", "متجاوب مع الجوال", "Mobile Responsive")
        for b in [
            "شريط جانبي قابل للطي مع قائمة هامبرجر على الجوال",
            "جداول قابلة للتمرير أفقياً",
            "تنقل متوافق مع اللمس",
        ]:
            self.draw_bullet(b)
        self.y -= 16

        # ── Technical Highlights ──
        self.draw_heading("المميزات التقنية — Technical Highlights")
        for b in [
            "واجهة عربية RTL مبنية من اليوم الأول",
            "أمان على مستوى الصف — عزل البيانات لكل شركة في قاعدة البيانات",
            "توفر الوحدات الفوري — لا يمكن الحجز المزدوج",
            "يعمل على أي جهاز عبر المتصفح (كمبيوتر، تابلت، جوال)",
        ]:
            self.draw_bullet(b)
        self.y -= 16

        # ── Tech Stack ──
        self.draw_heading("البنية التقنية — Tech Stack")
        self.draw_table(
            ["المكون", "التقنية"],
            [
                ["الواجهة الأمامية", "Next.js 14 + Tailwind CSS"],
                ["الخادم الخلفي", "FastAPI (Python)"],
                ["قاعدة البيانات", "Supabase (PostgreSQL + RLS)"],
                ["المصادقة", "Supabase Auth (JWT)"],
                ["PDF", "ReportLab + خط Amiri"],
                ["الاستضافة", "Vercel + Supabase Cloud"],
            ],
        )
        self.y -= 8

        # ── Roadmap ──
        self.draw_heading("الميزات القادمة — Roadmap")
        for b in [
            "اتفاقية ما بعد البيع PDF",
            "سجل المراجعة (من فعل ماذا ومتى)",
            "تقارير: سرعة المبيعات، الإيرادات لكل مشروع، قيمة خط الأنابيب",
            "بوت تيليجرام للمالك (ملخص يومي واستعلامات بالعربي)",
            "فوترة SaaS عبر مويسر (دعم مدى)",
            "ترقيم الصفحات للمخزونات الكبيرة (+5000 وحدة)",
        ]:
            self.draw_bullet(b)
        self.y -= 16

        # ── Pricing ──
        self.draw_heading("خطط الأسعار — Pricing")
        self.draw_table(
            ["الخطة", "السعر", "الوحدات", "المستخدمين"],
            [
                ["Starter", "299 ر.س/شهر", "حتى 50", "3"],
                ["Growth", "599 ر.س/شهر", "حتى 150", "8"],
                ["Enterprise", "1,200 ر.س/شهر", "غير محدود", "غير محدود"],
            ],
        )
        self.y -= 8

        # ── Demo Access ──
        self.draw_heading("حسابات العرض التجريبي — Demo Access")
        self.draw_table(
            ["الدور", "البريد الإلكتروني", "كلمة المرور"],
            [
                ["مالك", "demo@propmanager.dev", "Demo@2026!"],
                ["مدير مبيعات", "sales@propmanager.dev", "Demo@2026!"],
                ["مدير حجوزات", "reservations@propmanager.dev", "Demo@2026!"],
            ],
        )

        # Final footer + save
        self._draw_footer()
        self.c.showPage()
        self.c.save()
        return self.buf.getvalue()


if __name__ == "__main__":
    out_path = Path(__file__).resolve().parent.parent / "docs" / "PropManager-Features.pdf"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    pdf_bytes = FeaturesPDF().build()
    out_path.write_bytes(pdf_bytes)
    print(f"PDF generated: {out_path} ({len(pdf_bytes):,} bytes)")
