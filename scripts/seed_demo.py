"""
Seed PropManager with realistic Saudi real estate demo data.

Usage:
    python scripts/seed_demo.py          # seed fresh data
    python scripts/seed_demo.py --clean  # delete all demo data first, then seed

Requires: pip install httpx python-dotenv
Uses the service role key from backend/.env to bypass RLS.
"""

import argparse
import json
import sys
import uuid
from datetime import date, timedelta
from pathlib import Path

import httpx
from dotenv import load_dotenv
import os

load_dotenv(Path(__file__).parent.parent / "backend" / ".env", override=True)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SERVICE_KEY = os.environ["SUPABASE_SECRET_KEY"]

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation",
}

client = httpx.Client(base_url=SUPABASE_URL, headers=HEADERS, timeout=30)


def rest_post(table: str, data: dict | list) -> list:
    r = client.post(f"/rest/v1/{table}", json=data)
    if r.status_code >= 400:
        print(f"  ERROR inserting into {table}: {r.status_code} {r.text}")
        sys.exit(1)
    return r.json()


def rest_delete(table: str, query: str):
    r = client.delete(f"/rest/v1/{table}?{query}")
    if r.status_code >= 400 and r.status_code != 404:
        print(f"  WARN deleting from {table}: {r.status_code} {r.text}")


def create_demo_user(email: str, password: str) -> str:
    r = client.post("/auth/v1/admin/users", json={
        "email": email,
        "password": password,
        "email_confirm": True,
    })
    if r.status_code == 422 and "already been registered" in r.text:
        r2 = client.get(f"/auth/v1/admin/users")
        for u in r2.json().get("users", []):
            if u["email"] == email:
                return u["id"]
        print(f"  ERROR: user {email} exists but not found in listing")
        sys.exit(1)
    if r.status_code >= 400:
        print(f"  ERROR creating user: {r.status_code} {r.text}")
        sys.exit(1)
    return r.json()["id"]


def clean(company_id: str):
    print("Cleaning demo data...")
    for table in [
        "sale_participants", "sales", "reservations",
        "customers", "external_realtors", "units",
        "floor_plans", "buildings", "projects",
        "user_profiles", "audit_log",
    ]:
        rest_delete(table, f"company_id=eq.{company_id}")
    rest_delete("companies", f"id=eq.{company_id}")
    print("  Done.\n")


def seed():
    print("=== PropManager Demo Seed ===\n")

    company_id = str(uuid.uuid4())

    # --- Company ---
    print("1. Company...")
    rest_post("companies", {
        "id": company_id,
        "name": "Al-Nukhba Real Estate Development",
        "name_ar": "شركة النخبة للتطوير العقاري",
        "rega_license": "7200045891",
        "plan": "growth",
    })

    # --- Demo users ---
    print("2. Users...")
    demo_email = "demo@propmanager.dev"
    owner_id = create_demo_user(demo_email, "Demo@2026!")

    sm_email = "sales@propmanager.dev"
    sm_id = create_demo_user(sm_email, "Demo@2026!")

    rm_email = "reservations@propmanager.dev"
    rm_id = create_demo_user(rm_email, "Demo@2026!")

    rest_post("user_profiles", [
        {"id": owner_id, "company_id": company_id, "full_name": "عبدالله الغامدي", "role": "owner", "phone": "0501234567"},
        {"id": sm_id, "company_id": company_id, "full_name": "خالد العتيبي", "role": "sales_manager", "phone": "0559876543"},
        {"id": rm_id, "company_id": company_id, "full_name": "نورة الشهري", "role": "reservation_manager", "phone": "0543219876"},
    ])

    # --- Projects ---
    print("3. Projects...")
    projects = rest_post("projects", [
        {
            "id": (p1 := str(uuid.uuid4())),
            "company_id": company_id,
            "name": "Narjis Towers",
            "name_ar": "أبراج النرجس",
            "project_number": "NRJ-01",
            "city": "الرياض",
            "location_notes": "حي النرجس، شمال الرياض",
        },
        {
            "id": (p2 := str(uuid.uuid4())),
            "company_id": company_id,
            "name": "Yasmin Villas",
            "name_ar": "فلل الياسمين",
            "project_number": "YSM-02",
            "city": "جدة",
            "location_notes": "حي الياسمين، شمال جدة",
        },
    ])

    # --- Buildings ---
    print("4. Buildings...")
    b_a = str(uuid.uuid4())
    b_b = str(uuid.uuid4())
    b_1 = str(uuid.uuid4())
    b_2 = str(uuid.uuid4())

    rest_post("buildings", [
        {"id": b_a, "project_id": p1, "company_id": company_id, "name": "برج A", "building_number": "A", "total_floors": 4},
        {"id": b_b, "project_id": p1, "company_id": company_id, "name": "برج B", "building_number": "B", "total_floors": 4},
        {"id": b_1, "project_id": p2, "company_id": company_id, "name": "مجموعة 1", "building_number": "1", "total_floors": 2},
        {"id": b_2, "project_id": p2, "company_id": company_id, "name": "مجموعة 2", "building_number": "2", "total_floors": 2},
    ])

    # --- Units ---
    print("5. Units...")
    units = []
    unit_ids = {}  # key -> uuid for referencing in reservations/sales

    # Building A: 8 apartments (2 per floor, floors 1-4)
    for floor in range(1, 5):
        for unit_num in [1, 2]:
            uid = str(uuid.uuid4())
            key = f"A-{floor}-{unit_num}"
            unit_ids[key] = uid
            is_facade = unit_num == 1
            area = 145.0 if is_facade else 120.0
            price = 850000 + (floor * 25000) + (50000 if is_facade else 0)
            units.append({
                "id": uid,
                "building_id": b_a, "project_id": p1, "company_id": company_id,
                "sak_id": f"3104{floor:02d}{unit_num:02d}00{len(units)+1:04d}",
                "unit_number": f"A-{floor}{unit_num:02d}",
                "floor": floor,
                "area_sqm": area,
                "price": price,
                "unit_type": "facade" if is_facade else "interior",
                "electricity_meter_id": f"SEC-{1000+len(units)}",
                "water_meter_id": f"NWC-{2000+len(units)}",
                "status": "available",
            })

    # Building B: 8 apartments
    for floor in range(1, 5):
        for unit_num in [1, 2]:
            uid = str(uuid.uuid4())
            key = f"B-{floor}-{unit_num}"
            unit_ids[key] = uid
            is_dual = floor >= 3 and unit_num == 1
            area = 160.0 if is_dual else 130.0
            price = 920000 + (floor * 30000) + (80000 if is_dual else 0)
            units.append({
                "id": uid,
                "building_id": b_b, "project_id": p1, "company_id": company_id,
                "sak_id": f"3104{floor:02d}{unit_num:02d}00{len(units)+1:04d}",
                "unit_number": f"B-{floor}{unit_num:02d}",
                "floor": floor,
                "area_sqm": area,
                "price": price,
                "unit_type": "dual_facade" if is_dual else "interior",
                "electricity_meter_id": f"SEC-{1000+len(units)}",
                "water_meter_id": f"NWC-{2000+len(units)}",
                "status": "available",
            })

    # Block 1 & 2: 4 villas each (ground + first floor)
    for block_id, block_num, b_id in [(b_1, "1", "V1"), (b_2, "2", "V2")]:
        for villa_num in range(1, 5):
            uid = str(uuid.uuid4())
            key = f"{b_id}-{villa_num}"
            unit_ids[key] = uid
            area = 280.0 + (villa_num * 15)
            price = 1800000 + (villa_num * 100000)
            units.append({
                "id": uid,
                "building_id": block_id, "project_id": p2, "company_id": company_id,
                "sak_id": f"2108{int(block_num):02d}{villa_num:02d}00{len(units)+1:04d}",
                "unit_number": f"V{block_num}-{villa_num:02d}",
                "floor": 0,
                "area_sqm": area,
                "price": price,
                "unit_type": "facade" if villa_num % 2 == 1 else "dual_facade",
                "electricity_meter_id": f"SEC-{1000+len(units)}",
                "water_meter_id": f"NWC-{2000+len(units)}",
                "status": "available",
            })

    rest_post("units", units)
    print(f"   {len(units)} units created")

    # --- Customers ---
    print("6. Customers...")
    customers = []
    cust_ids = {}

    customer_data = [
        ("محمد بن سعود القحطاني", "1088765432", "0551234567", "instagram", "national_id"),
        ("فهد بن عبدالعزيز الدوسري", "1095678901", "0562345678", "snapchat", "national_id"),
        ("أحمد بن خالد المالكي", "1072345678", "0543456789", "walk_in", "national_id"),
        ("سلطان بن فيصل العنزي", "1081234567", "0534567890", "realtor_referral", "national_id"),
        ("تركي بن ناصر الحربي", "1067890123", "0505678901", "tiktok", "national_id"),
        ("عبدالرحمن بن محمد الشمري", "1054567890", "0576789012", "direct", "national_id"),
        ("يوسف بن إبراهيم البلوي", "1043210987", "0547890123", "instagram", "national_id"),
        ("ماجد بن عادل الزهراني", "1031098765", "0558901234", "walk_in", "national_id"),
        ("نايف بن هاني الغامدي", "1029876543", "0569012345", "snapchat", "national_id"),
        ("بندر بن سامي العمري", "2198765432", "0530123456", "realtor_referral", "iqama"),
        ("وليد بن حمد السبيعي", "1018765432", "0541234567", "direct", "national_id"),
        ("صالح بن راشد المطيري", "1006543210", "0552345678", "instagram", "national_id"),
    ]

    for i, (name, id_num, phone, source, id_type) in enumerate(customer_data):
        cid = str(uuid.uuid4())
        cust_ids[i] = cid
        customers.append({
            "id": cid,
            "company_id": company_id,
            "full_name": name,
            "id_type": id_type,
            "id_number": id_num,
            "phone": phone,
            "lead_source": source,
            "birthdate": f"{1975 + (i % 20)}-{(i % 12) + 1:02d}-{(i % 28) + 1:02d}",
        })

    rest_post("customers", customers)

    # --- External Realtors ---
    print("7. External Realtors...")
    er1 = str(uuid.uuid4())
    er2 = str(uuid.uuid4())
    rest_post("external_realtors", [
        {"id": er1, "company_id": company_id, "name": "ياسر الجهني", "phone": "0501112233", "office_name": "مكتب الأمانة العقاري", "rega_license": "4400012345"},
        {"id": er2, "company_id": company_id, "name": "عمر المولد", "phone": "0502223344", "office_name": "مكتب الثقة للعقارات", "rega_license": None},
    ])

    # --- Set some units to reserved/sold ---
    today = date.today()

    # Units to reserve (4 active reservations)
    reserved_units = ["A-1-1", "A-2-2", "B-1-1", "V1-1"]
    for key in reserved_units:
        client.patch(
            f"/rest/v1/units?id=eq.{unit_ids[key]}",
            json={"status": "reserved"},
        )

    # Units to sell (5 sold)
    sold_units = ["A-3-1", "A-4-2", "B-2-1", "V1-3", "V2-2"]
    for key in sold_units:
        client.patch(
            f"/rest/v1/units?id=eq.{unit_ids[key]}",
            json={"status": "sold"},
        )

    # --- Reservations ---
    print("8. Reservations...")
    reservations = []

    # 4 active reservations
    active_res = [
        ("A-1-1", 0, 10000, "cash", today - timedelta(days=5), today + timedelta(days=9)),
        ("A-2-2", 1, 15000, "bank_transfer", today - timedelta(days=3), today + timedelta(days=11)),
        ("B-1-1", 2, 10000, "check", today - timedelta(days=7), today + timedelta(days=7)),
        ("V1-1", 3, 50000, "bank_transfer", today - timedelta(days=2), today + timedelta(days=12)),
    ]

    RES_DEFAULTS = {
        "payment_reference": None,
        "receipt_file_url": None,
        "deposit_returned": False,
        "deposit_return_date": None,
        "deposit_return_method": None,
        "deposit_return_reference": None,
        "deposit_returned_by": None,
        "refund_amount": None,
        "cancellation_reason": None,
    }

    for unit_key, cust_idx, deposit, method, pay_date, expires in active_res:
        rid = str(uuid.uuid4())
        reservations.append({
            "id": rid,
            "company_id": company_id,
            "unit_id": unit_ids[unit_key],
            "customer_id": cust_ids[cust_idx],
            "created_by": rm_id,
            "deposit_amount": deposit,
            "payment_method": method,
            "payment_date": pay_date.isoformat(),
            "received_by": rm_id,
            "status": "active",
            "expires_at": expires.isoformat(),
            **RES_DEFAULTS,
        })

    # 1 cancelled reservation (unit back to available)
    cancelled_unit = "B-3-2"
    client.patch(f"/rest/v1/units?id=eq.{unit_ids[cancelled_unit]}", json={"status": "available"})
    rid_cancelled = str(uuid.uuid4())
    reservations.append({
        "id": rid_cancelled,
        "company_id": company_id,
        "unit_id": unit_ids[cancelled_unit],
        "customer_id": cust_ids[4],
        "created_by": rm_id,
        "deposit_amount": 10000,
        "payment_method": "cash",
        "payment_reference": None,
        "payment_date": (today - timedelta(days=20)).isoformat(),
        "received_by": rm_id,
        "receipt_file_url": None,
        "status": "cancelled",
        "expires_at": (today - timedelta(days=6)).isoformat(),
        "deposit_returned": True,
        "deposit_return_date": (today - timedelta(days=4)).isoformat(),
        "deposit_return_method": "cash",
        "deposit_return_reference": None,
        "deposit_returned_by": rm_id,
        "refund_amount": 10000,
        "cancellation_reason": "العميل غير رأيه بعد زيارة موقع المشروع",
    })

    # 2 converted reservations (linked to sales below)
    rid_conv1 = str(uuid.uuid4())
    rid_conv2 = str(uuid.uuid4())
    reservations.append({
        "id": rid_conv1,
        "company_id": company_id,
        "unit_id": unit_ids["A-3-1"],
        "customer_id": cust_ids[5],
        "created_by": rm_id,
        "deposit_amount": 15000,
        "payment_method": "bank_transfer",
        "payment_reference": None,
        "payment_date": (today - timedelta(days=30)).isoformat(),
        "received_by": rm_id,
        "receipt_file_url": None,
        "status": "converted",
        "expires_at": (today - timedelta(days=16)).isoformat(),
        "deposit_returned": True,
        "deposit_return_date": (today - timedelta(days=15)).isoformat(),
        "deposit_return_method": "bank_transfer",
        "deposit_return_reference": None,
        "deposit_returned_by": rm_id,
        "refund_amount": 15000,
        "cancellation_reason": None,
    })
    reservations.append({
        "id": rid_conv2,
        "company_id": company_id,
        "unit_id": unit_ids["V1-3"],
        "customer_id": cust_ids[6],
        "created_by": rm_id,
        "deposit_amount": 50000,
        "payment_method": "bank_transfer",
        "payment_reference": None,
        "payment_date": (today - timedelta(days=25)).isoformat(),
        "received_by": rm_id,
        "receipt_file_url": None,
        "status": "converted",
        "expires_at": (today - timedelta(days=11)).isoformat(),
        "deposit_returned": True,
        "deposit_return_date": (today - timedelta(days=10)).isoformat(),
        "deposit_return_method": "bank_transfer",
        "deposit_return_reference": None,
        "deposit_returned_by": rm_id,
        "refund_amount": 50000,
        "cancellation_reason": None,
    })

    rest_post("reservations", reservations)
    print(f"   {len(reservations)} reservations created")

    # --- Sales ---
    print("9. Sales...")
    sales = []
    sale_ids = {}

    SALE_DEFAULTS = {
        "reservation_id": None,
        "payment_reference": None,
        "receipt_file_url": None,
        "commission_finalized_by": None,
        "commission_finalized_at": None,
        "reversal_reason": None,
    }

    # 2 sales from converted reservations
    s1 = str(uuid.uuid4())
    sale_ids["s1"] = s1
    sales.append({**SALE_DEFAULTS,
        "id": s1,
        "company_id": company_id,
        "unit_id": unit_ids["A-3-1"],
        "customer_id": cust_ids[5],
        "reservation_id": rid_conv1,
        "created_by": sm_id,
        "payment_amount": 925000,
        "payment_method": "bank_transfer",
        "payment_reference": "TRF-2026-00451",
        "payment_date": (today - timedelta(days=15)).isoformat(),
        "received_by": sm_id,
        "total_commission_amount": 27750,
        "commission_finalized": True,
        "commission_finalized_by": owner_id,
        "commission_finalized_at": (today - timedelta(days=14)).isoformat() + "T10:00:00Z",
        "status": "completed",
    })

    s2 = str(uuid.uuid4())
    sale_ids["s2"] = s2
    sales.append({**SALE_DEFAULTS,
        "id": s2,
        "company_id": company_id,
        "unit_id": unit_ids["V1-3"],
        "customer_id": cust_ids[6],
        "reservation_id": rid_conv2,
        "created_by": sm_id,
        "payment_amount": 2100000,
        "payment_method": "bank_transfer",
        "payment_reference": "TRF-2026-00478",
        "payment_date": (today - timedelta(days=10)).isoformat(),
        "received_by": sm_id,
        "total_commission_amount": 63000,
        "commission_finalized": True,
        "commission_finalized_by": owner_id,
        "commission_finalized_at": (today - timedelta(days=9)).isoformat() + "T14:00:00Z",
        "status": "completed",
    })

    # 2 direct sales (no reservation)
    s3 = str(uuid.uuid4())
    sale_ids["s3"] = s3
    sales.append({**SALE_DEFAULTS,
        "id": s3,
        "company_id": company_id,
        "unit_id": unit_ids["A-4-2"],
        "customer_id": cust_ids[7],
        "created_by": sm_id,
        "payment_amount": 870000,
        "payment_method": "cash",
        "payment_date": (today - timedelta(days=8)).isoformat(),
        "received_by": sm_id,
        "total_commission_amount": 26100,
        "commission_finalized": False,
        "status": "completed",
    })

    s4 = str(uuid.uuid4())
    sale_ids["s4"] = s4
    sales.append({**SALE_DEFAULTS,
        "id": s4,
        "company_id": company_id,
        "unit_id": unit_ids["B-2-1"],
        "customer_id": cust_ids[8],
        "created_by": sm_id,
        "payment_amount": 980000,
        "payment_method": "bank_transfer",
        "payment_reference": "TRF-2026-00502",
        "payment_date": (today - timedelta(days=5)).isoformat(),
        "received_by": sm_id,
        "total_commission_amount": 29400,
        "commission_finalized": False,
        "status": "completed",
    })

    # 1 direct sale for villa (V2-2)
    s5 = str(uuid.uuid4())
    sale_ids["s5"] = s5
    sales.append({**SALE_DEFAULTS,
        "id": s5,
        "company_id": company_id,
        "unit_id": unit_ids["V2-2"],
        "customer_id": cust_ids[9],
        "created_by": sm_id,
        "payment_amount": 2000000,
        "payment_method": "bank_transfer",
        "payment_reference": "TRF-2026-00510",
        "payment_date": (today - timedelta(days=3)).isoformat(),
        "received_by": sm_id,
        "total_commission_amount": 60000,
        "commission_finalized": True,
        "commission_finalized_by": owner_id,
        "commission_finalized_at": (today - timedelta(days=2)).isoformat() + "T11:00:00Z",
        "status": "completed",
    })

    rest_post("sales", sales)
    print(f"   {len(sales)} sales created")

    # --- Sale Participants (commission splits) ---
    print("10. Commission splits...")
    participants = [
        {"sale_id": s1, "company_id": company_id, "user_id": sm_id, "external_realtor_id": None, "commission_percentage": 60.00, "notes": None},
        {"sale_id": s1, "company_id": company_id, "user_id": None, "external_realtor_id": er1, "commission_percentage": 40.00, "notes": None},
        {"sale_id": s2, "company_id": company_id, "user_id": sm_id, "external_realtor_id": None, "commission_percentage": 50.00, "notes": None},
        {"sale_id": s2, "company_id": company_id, "user_id": None, "external_realtor_id": er2, "commission_percentage": 50.00, "notes": None},
        {"sale_id": s3, "company_id": company_id, "user_id": sm_id, "external_realtor_id": None, "commission_percentage": 100.00, "notes": None},
        {"sale_id": s4, "company_id": company_id, "user_id": sm_id, "external_realtor_id": None, "commission_percentage": 70.00, "notes": None},
        {"sale_id": s4, "company_id": company_id, "user_id": None, "external_realtor_id": er1, "commission_percentage": 30.00, "notes": None},
        {"sale_id": s5, "company_id": company_id, "user_id": sm_id, "external_realtor_id": None, "commission_percentage": 55.00, "notes": None},
        {"sale_id": s5, "company_id": company_id, "user_id": None, "external_realtor_id": er2, "commission_percentage": 45.00, "notes": None},
    ]
    rest_post("sale_participants", participants)

    print(f"\n=== Seed complete! ===")
    print(f"  Company:      شركة النخبة للتطوير العقاري")
    print(f"  Company ID:   {company_id}")
    print(f"  Projects:     2 (أبراج النرجس + فلل الياسمين)")
    print(f"  Buildings:    4")
    print(f"  Units:        {len(units)} ({len([u for u in units if u['status']=='available'])} available, {len(reserved_units)} reserved, {len(sold_units)} sold)")
    print(f"  Customers:    {len(customers)}")
    print(f"  Realtors:     2")
    print(f"  Reservations: {len(reservations)} (4 active, 1 cancelled, 2 converted)")
    print(f"  Sales:        {len(sales)} (2 from reservation, 3 direct)")
    print(f"  Commissions:  {len(participants)} participant entries")
    print(f"\n  Login: {demo_email} / Demo@2026!")
    print(f"  (also: {sm_email}, {rm_email})")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--clean", action="store_true", help="Delete demo data before seeding")
    args = parser.parse_args()

    if args.clean:
        r = client.get('/rest/v1/companies?name=eq.Al-Nukhba Real Estate Development&select=id')
        matches = r.json() if r.status_code == 200 else []
        for m in matches:
            print(f"Cleaning company {m['id']}...")
            clean(m['id'])

    seed()
