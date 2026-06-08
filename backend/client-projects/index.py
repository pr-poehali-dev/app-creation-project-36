"""
API для раздела «Работа с клиентами»: проекты, этапы, рецептура, дизайн, декларация, закупки, банки.
"""
import json
import os
import uuid
from datetime import datetime, timezone, timedelta, date
from urllib.parse import unquote, urlparse
import psycopg2

SCHEMA = "t_p55602185_app_creation_project"
TZ_MSK = timezone(timedelta(hours=3))

PROJECT_COLS = [
    "id", "number", "client", "brand", "drink_name", "flavor",
    "can_volume", "can_format", "label_type", "sku_count", "batch_volume",
    "contact_person", "manager", "deadline", "comment",
    "stage", "readiness_pct", "is_ready", "production_order_id",
    "created_at", "updated_at"
]

RECIPE_COLS = [
    "id", "project_id", "ingredient", "dosage", "unit",
    "supplier", "price_per_unit", "lead_days", "order_idx", "created_at"
]

DESIGN_COLS = [
    "id", "project_id", "version", "file_name", "file_url",
    "recognized_text", "status", "uploaded_by", "comment",
    "created_at", "updated_at"
]

SETUP_COLS = [
    "id", "project_id", "factory", "sent_at", "responsible",
    "planned_ready", "actual_ready", "status", "comment",
    "created_at", "updated_at"
]

DECL_COLS = [
    "id", "project_id", "decl_type", "samples_sent_at", "docs_submitted_at",
    "planned_ready", "actual_ready", "status", "lab", "tracking_number",
    "file_url", "comment", "created_at", "updated_at"
]

PURCHASE_COLS = [
    "id", "project_id", "ingredient", "needed", "in_stock", "reserved",
    "shortage", "unit", "supplier", "status", "order_date",
    "planned_delivery", "actual_delivery", "comment", "created_at", "updated_at"
]

CAN_COLS = [
    "id", "project_id", "factory", "can_format", "can_volume",
    "design_sent_at", "design_registered_at", "can_ordered_at",
    "planned_shipment", "actual_shipment", "status", "comment",
    "created_at", "updated_at"
]

READINESS_COLS = [
    "id", "project_id", "recipe_approved", "raw_ordered", "raw_delivered",
    "design_at_factory", "can_shipped", "declaration_ready",
    "samples_sent", "client_approved", "updated_at"
]

STAGE_ORDER = [
    "negotiations", "client_card", "recipe", "design",
    "factory_setup", "declaration", "raw_purchase", "can_order", "ready"
]

LINE_COLORS = {
    "line-1": "#0ea5e9",
    "line-2": "#f97316",
    "line-3": "#8b5cf6",
}


def get_conn():
    url = urlparse(os.environ["DATABASE_URL"])
    return psycopg2.connect(
        host=url.hostname,
        port=url.port or 5432,
        dbname=unquote(url.path.lstrip("/")),
        user=unquote(url.username),
        password=unquote(url.password),
    )


def cors():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-User-Id",
    }


def resp(status, body):
    return {
        "statusCode": status,
        "headers": {**cors(), "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False, default=str),
    }


def esc(val):
    if val is None:
        return "NULL"
    return "'" + str(val).replace("'", "''") + "'"


def now_str():
    return datetime.now(TZ_MSK).isoformat()


def row_to_dict(row, cols):
    return dict(zip(cols, row))


def gen_project_number():
    uid = str(uuid.uuid4())[:6].upper()
    return f"CLP-{datetime.now().year}-{uid}"


def calc_readiness(cur, project_id):
    cur.execute(
        f"SELECT recipe_approved, raw_ordered, raw_delivered, design_at_factory, "
        f"can_shipped, declaration_ready, samples_sent, client_approved "
        f"FROM {SCHEMA}.project_readiness WHERE project_id = {esc(project_id)}"
    )
    row = cur.fetchone()
    if not row:
        return 0, False
    flags = list(row)
    done = sum(1 for f in flags if f)
    pct = round(done / len(flags) * 100)
    is_ready = all(flags)
    return pct, is_ready


def recalc_and_update_project(cur, project_id, now):
    pct, is_ready = calc_readiness(cur, project_id)
    cur.execute(
        f"UPDATE {SCHEMA}.client_projects SET readiness_pct = {pct}, "
        f"is_ready = {'TRUE' if is_ready else 'FALSE'}, updated_at = {esc(now)} "
        f"WHERE id = {esc(project_id)}"
    )
    return pct, is_ready


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors(), "body": ""}

    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")
    params = event.get("queryStringParameters") or {}
    path_parts = [p for p in path.strip("/").split("/") if p]

    # Структура URL: /client-projects/{project_id}/{sub}
    project_id = path_parts[1] if len(path_parts) >= 2 else None
    sub = path_parts[2] if len(path_parts) >= 3 else None

    body = {}
    if event.get("body"):
        body = json.loads(event["body"])

    now = now_str()
    conn = get_conn()
    cur = conn.cursor()

    try:
        # ═══════════════════════════════════════════════
        # SUB-RESOURCES (recipe, design, declaration…)
        # ═══════════════════════════════════════════════

        if project_id and sub:

            # ─── GET /project_id/recipe ───
            if method == "GET" and sub == "recipe":
                cur.execute(
                    f"SELECT {', '.join(RECIPE_COLS)} FROM {SCHEMA}.project_recipe_items "
                    f"WHERE project_id = {esc(project_id)} ORDER BY order_idx ASC"
                )
                return resp(200, [row_to_dict(r, RECIPE_COLS) for r in cur.fetchall()])

            # ─── POST /project_id/recipe ─── add item
            if method == "POST" and sub == "recipe":
                rid = str(uuid.uuid4())
                cur.execute(
                    f"INSERT INTO {SCHEMA}.project_recipe_items "
                    f"(id, project_id, ingredient, dosage, unit, supplier, price_per_unit, lead_days, order_idx, created_at) "
                    f"VALUES ({esc(rid)}, {esc(project_id)}, {esc(body.get('ingredient',''))}, "
                    f"{float(body.get('dosage', 0))}, {esc(body.get('unit','г'))}, "
                    f"{esc(body.get('supplier'))}, "
                    f"{'NULL' if body.get('price_per_unit') is None else float(body['price_per_unit'])}, "
                    f"{'NULL' if body.get('lead_days') is None else int(body['lead_days'])}, "
                    f"{int(body.get('order_idx', 0))}, {esc(now)})"
                )
                conn.commit()
                cur.execute(
                    f"SELECT {', '.join(RECIPE_COLS)} FROM {SCHEMA}.project_recipe_items WHERE id = {esc(rid)}"
                )
                return resp(201, row_to_dict(cur.fetchone(), RECIPE_COLS))

            # ─── DELETE /project_id/recipe/item_id ─── (sub=recipe, item_id in body or query)
            if method == "DELETE" and sub == "recipe":
                item_id = body.get("item_id") or params.get("item_id")
                if not item_id:
                    return resp(400, {"error": "item_id обязателен"})
                cur.execute(
                    f"DELETE FROM {SCHEMA}.project_recipe_items WHERE id = {esc(item_id)} AND project_id = {esc(project_id)}"
                )
                conn.commit()
                return resp(200, {"deleted": item_id})

            # ─── GET /project_id/design ───
            if method == "GET" and sub == "design":
                cur.execute(
                    f"SELECT {', '.join(DESIGN_COLS)} FROM {SCHEMA}.project_designs "
                    f"WHERE project_id = {esc(project_id)} ORDER BY created_at DESC"
                )
                return resp(200, [row_to_dict(r, DESIGN_COLS) for r in cur.fetchall()])

            # ─── POST /project_id/design ─── create/update version
            if method == "POST" and sub == "design":
                did = str(uuid.uuid4())
                cur.execute(
                    f"INSERT INTO {SCHEMA}.project_designs "
                    f"(id, project_id, version, file_name, file_url, recognized_text, status, uploaded_by, comment, created_at, updated_at) "
                    f"VALUES ({esc(did)}, {esc(project_id)}, {esc(body.get('version','v1'))}, "
                    f"{esc(body.get('file_name'))}, {esc(body.get('file_url'))}, "
                    f"{esc(body.get('recognized_text'))}, {esc(body.get('status','in_progress'))}, "
                    f"{esc(body.get('uploaded_by'))}, {esc(body.get('comment'))}, {esc(now)}, {esc(now)})"
                )
                conn.commit()
                cur.execute(f"SELECT {', '.join(DESIGN_COLS)} FROM {SCHEMA}.project_designs WHERE id = {esc(did)}")
                return resp(201, row_to_dict(cur.fetchone(), DESIGN_COLS))

            # ─── PUT /project_id/design ─── update status/comment by design_id in body
            if method == "PUT" and sub == "design":
                did = body.get("design_id")
                if not did:
                    return resp(400, {"error": "design_id обязателен"})
                sets = []
                for f in ["status", "comment", "recognized_text", "file_url"]:
                    if f in body:
                        sets.append(f"{f} = {esc(body[f])}")
                sets.append(f"updated_at = {esc(now)}")
                cur.execute(
                    f"UPDATE {SCHEMA}.project_designs SET {', '.join(sets)} "
                    f"WHERE id = {esc(did)} AND project_id = {esc(project_id)}"
                )
                conn.commit()
                cur.execute(f"SELECT {', '.join(DESIGN_COLS)} FROM {SCHEMA}.project_designs WHERE id = {esc(did)}")
                row = cur.fetchone()
                return resp(200, row_to_dict(row, DESIGN_COLS) if row else {})

            # ─── GET /project_id/factory-setup ───
            if method == "GET" and sub == "factory-setup":
                cur.execute(
                    f"SELECT {', '.join(SETUP_COLS)} FROM {SCHEMA}.project_factory_setups "
                    f"WHERE project_id = {esc(project_id)} ORDER BY created_at DESC LIMIT 1"
                )
                row = cur.fetchone()
                return resp(200, row_to_dict(row, SETUP_COLS) if row else {})

            # ─── POST/PUT /project_id/factory-setup ───
            if method in ("POST", "PUT") and sub == "factory-setup":
                cur.execute(
                    f"SELECT id FROM {SCHEMA}.project_factory_setups WHERE project_id = {esc(project_id)} LIMIT 1"
                )
                existing = cur.fetchone()
                if existing:
                    sid = existing[0]
                    sets = []
                    for f in ["factory", "sent_at", "responsible", "actual_ready", "status", "comment"]:
                        if f in body:
                            sets.append(f"{f} = {esc(body[f])}")
                    # Auto-calculate planned_ready = sent_at + 10 days
                    if "sent_at" in body and body["sent_at"]:
                        sent = date.fromisoformat(body["sent_at"])
                        planned = (sent + timedelta(days=10)).isoformat()
                        sets.append(f"planned_ready = {esc(planned)}")
                    sets.append(f"updated_at = {esc(now)}")
                    cur.execute(
                        f"UPDATE {SCHEMA}.project_factory_setups SET {', '.join(sets)} WHERE id = {esc(sid)}"
                    )
                else:
                    sid = str(uuid.uuid4())
                    sent_at = body.get("sent_at")
                    planned_ready = None
                    if sent_at:
                        planned_ready = (date.fromisoformat(sent_at) + timedelta(days=10)).isoformat()
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.project_factory_setups "
                        f"(id, project_id, factory, sent_at, responsible, planned_ready, actual_ready, status, comment, created_at, updated_at) "
                        f"VALUES ({esc(sid)}, {esc(project_id)}, {esc(body.get('factory','canpack'))}, "
                        f"{esc(sent_at)}, {esc(body.get('responsible'))}, {esc(planned_ready)}, "
                        f"{esc(body.get('actual_ready'))}, {esc(body.get('status','pending'))}, "
                        f"{esc(body.get('comment'))}, {esc(now)}, {esc(now)})"
                    )
                conn.commit()
                cur.execute(
                    f"SELECT {', '.join(SETUP_COLS)} FROM {SCHEMA}.project_factory_setups WHERE id = {esc(sid)}"
                )
                return resp(200, row_to_dict(cur.fetchone(), SETUP_COLS))

            # ─── GET /project_id/declaration ───
            if method == "GET" and sub == "declaration":
                cur.execute(
                    f"SELECT {', '.join(DECL_COLS)} FROM {SCHEMA}.project_declarations "
                    f"WHERE project_id = {esc(project_id)} ORDER BY created_at DESC LIMIT 1"
                )
                row = cur.fetchone()
                return resp(200, row_to_dict(row, DECL_COLS) if row else {})

            # ─── POST/PUT /project_id/declaration ───
            if method in ("POST", "PUT") and sub == "declaration":
                cur.execute(
                    f"SELECT id FROM {SCHEMA}.project_declarations WHERE project_id = {esc(project_id)} LIMIT 1"
                )
                existing = cur.fetchone()
                decl_type = body.get("decl_type", "3d")
                days = 14 if decl_type == "3d" else 3
                docs_submitted = body.get("docs_submitted_at")
                planned_ready = None
                if docs_submitted:
                    planned_ready = (date.fromisoformat(docs_submitted) + timedelta(days=days)).isoformat()

                if existing:
                    did = existing[0]
                    sets = []
                    for f in ["decl_type", "samples_sent_at", "docs_submitted_at",
                               "actual_ready", "status", "lab", "tracking_number", "file_url", "comment"]:
                        if f in body:
                            sets.append(f"{f} = {esc(body[f])}")
                    if planned_ready:
                        sets.append(f"planned_ready = {esc(planned_ready)}")
                    sets.append(f"updated_at = {esc(now)}")
                    cur.execute(
                        f"UPDATE {SCHEMA}.project_declarations SET {', '.join(sets)} WHERE id = {esc(did)}"
                    )
                else:
                    did = str(uuid.uuid4())
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.project_declarations "
                        f"(id, project_id, decl_type, samples_sent_at, docs_submitted_at, planned_ready, "
                        f"actual_ready, status, lab, tracking_number, file_url, comment, created_at, updated_at) "
                        f"VALUES ({esc(did)}, {esc(project_id)}, {esc(decl_type)}, "
                        f"{esc(body.get('samples_sent_at'))}, {esc(docs_submitted)}, {esc(planned_ready)}, "
                        f"{esc(body.get('actual_ready'))}, {esc(body.get('status','samples_not_sent'))}, "
                        f"{esc(body.get('lab'))}, {esc(body.get('tracking_number'))}, "
                        f"{esc(body.get('file_url'))}, {esc(body.get('comment'))}, {esc(now)}, {esc(now)})"
                    )
                conn.commit()
                cur.execute(f"SELECT {', '.join(DECL_COLS)} FROM {SCHEMA}.project_declarations WHERE id = {esc(did)}")
                return resp(200, row_to_dict(cur.fetchone(), DECL_COLS))

            # ─── GET /project_id/purchases ───
            if method == "GET" and sub == "purchases":
                cur.execute(
                    f"SELECT {', '.join(PURCHASE_COLS)} FROM {SCHEMA}.project_raw_purchases "
                    f"WHERE project_id = {esc(project_id)} ORDER BY created_at ASC"
                )
                return resp(200, [row_to_dict(r, PURCHASE_COLS) for r in cur.fetchall()])

            # ─── POST /project_id/purchases ─── create/upsert purchase item
            if method == "POST" and sub == "purchases":
                pid = body.get("id") or str(uuid.uuid4())
                cur.execute(f"SELECT id FROM {SCHEMA}.project_raw_purchases WHERE id = {esc(pid)}")
                if cur.fetchone():
                    sets = []
                    for f in ["ingredient", "needed", "in_stock", "reserved", "shortage",
                               "unit", "supplier", "status", "order_date",
                               "planned_delivery", "actual_delivery", "comment"]:
                        if f in body:
                            v = body[f]
                            if f in ("needed", "in_stock", "reserved", "shortage") and v is not None:
                                sets.append(f"{f} = {float(v)}")
                            else:
                                sets.append(f"{f} = {esc(v)}")
                    sets.append(f"updated_at = {esc(now)}")
                    cur.execute(
                        f"UPDATE {SCHEMA}.project_raw_purchases SET {', '.join(sets)} WHERE id = {esc(pid)}"
                    )
                else:
                    needed = float(body.get("needed", 0)) if body.get("needed") is not None else None
                    in_stock = float(body.get("in_stock", 0))
                    reserved = float(body.get("reserved", 0))
                    shortage = (needed - in_stock + reserved) if needed is not None else None
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.project_raw_purchases "
                        f"(id, project_id, ingredient, needed, in_stock, reserved, shortage, unit, supplier, "
                        f"status, order_date, planned_delivery, actual_delivery, comment, created_at, updated_at) "
                        f"VALUES ({esc(pid)}, {esc(project_id)}, {esc(body.get('ingredient',''))}, "
                        f"{'NULL' if needed is None else needed}, {in_stock}, {reserved}, "
                        f"{'NULL' if shortage is None else shortage}, "
                        f"{esc(body.get('unit'))}, {esc(body.get('supplier'))}, "
                        f"{esc(body.get('status','not_ordered'))}, {esc(body.get('order_date'))}, "
                        f"{esc(body.get('planned_delivery'))}, {esc(body.get('actual_delivery'))}, "
                        f"{esc(body.get('comment'))}, {esc(now)}, {esc(now)})"
                    )
                conn.commit()
                cur.execute(f"SELECT {', '.join(PURCHASE_COLS)} FROM {SCHEMA}.project_raw_purchases WHERE id = {esc(pid)}")
                return resp(200, row_to_dict(cur.fetchone(), PURCHASE_COLS))

            # ─── GET /project_id/can ───
            if method == "GET" and sub == "can":
                cur.execute(
                    f"SELECT {', '.join(CAN_COLS)} FROM {SCHEMA}.project_cans "
                    f"WHERE project_id = {esc(project_id)} ORDER BY created_at DESC LIMIT 1"
                )
                row = cur.fetchone()
                return resp(200, row_to_dict(row, CAN_COLS) if row else {})

            # ─── POST/PUT /project_id/can ───
            if method in ("POST", "PUT") and sub == "can":
                cur.execute(
                    f"SELECT id FROM {SCHEMA}.project_cans WHERE project_id = {esc(project_id)} LIMIT 1"
                )
                existing = cur.fetchone()
                if existing:
                    cid = existing[0]
                    sets = []
                    for f in ["factory", "can_format", "can_volume", "design_sent_at",
                               "design_registered_at", "can_ordered_at", "planned_shipment",
                               "actual_shipment", "status", "comment"]:
                        if f in body:
                            sets.append(f"{f} = {esc(body[f])}")
                    sets.append(f"updated_at = {esc(now)}")
                    cur.execute(f"UPDATE {SCHEMA}.project_cans SET {', '.join(sets)} WHERE id = {esc(cid)}")
                else:
                    cid = str(uuid.uuid4())
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.project_cans "
                        f"(id, project_id, factory, can_format, can_volume, design_sent_at, "
                        f"design_registered_at, can_ordered_at, planned_shipment, actual_shipment, "
                        f"status, comment, created_at, updated_at) "
                        f"VALUES ({esc(cid)}, {esc(project_id)}, {esc(body.get('factory','canpack'))}, "
                        f"{esc(body.get('can_format'))}, {esc(body.get('can_volume'))}, "
                        f"{esc(body.get('design_sent_at'))}, {esc(body.get('design_registered_at'))}, "
                        f"{esc(body.get('can_ordered_at'))}, {esc(body.get('planned_shipment'))}, "
                        f"{esc(body.get('actual_shipment'))}, {esc(body.get('status','design_not_ready'))}, "
                        f"{esc(body.get('comment'))}, {esc(now)}, {esc(now)})"
                    )
                conn.commit()
                cur.execute(f"SELECT {', '.join(CAN_COLS)} FROM {SCHEMA}.project_cans WHERE id = {esc(cid)}")
                return resp(200, row_to_dict(cur.fetchone(), CAN_COLS))

            # ─── GET /project_id/readiness ───
            if method == "GET" and sub == "readiness":
                cur.execute(
                    f"SELECT {', '.join(READINESS_COLS)} FROM {SCHEMA}.project_readiness "
                    f"WHERE project_id = {esc(project_id)}"
                )
                row = cur.fetchone()
                return resp(200, row_to_dict(row, READINESS_COLS) if row else {})

            # ─── PUT /project_id/readiness ───
            if method == "PUT" and sub == "readiness":
                cur.execute(
                    f"SELECT id FROM {SCHEMA}.project_readiness WHERE project_id = {esc(project_id)}"
                )
                existing = cur.fetchone()
                flags = ["recipe_approved", "raw_ordered", "raw_delivered", "design_at_factory",
                         "can_shipped", "declaration_ready", "samples_sent", "client_approved"]
                if existing:
                    sets = []
                    for f in flags:
                        if f in body:
                            sets.append(f"{f} = {'TRUE' if body[f] else 'FALSE'}")
                    sets.append(f"updated_at = {esc(now)}")
                    cur.execute(
                        f"UPDATE {SCHEMA}.project_readiness SET {', '.join(sets)} "
                        f"WHERE project_id = {esc(project_id)}"
                    )
                else:
                    rid = str(uuid.uuid4())
                    vals = ", ".join("TRUE" if body.get(f) else "FALSE" for f in flags)
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.project_readiness "
                        f"(id, project_id, {', '.join(flags)}, updated_at) "
                        f"VALUES ({esc(rid)}, {esc(project_id)}, {vals}, {esc(now)})"
                    )
                recalc_and_update_project(cur, project_id, now)
                conn.commit()
                cur.execute(
                    f"SELECT {', '.join(READINESS_COLS)} FROM {SCHEMA}.project_readiness "
                    f"WHERE project_id = {esc(project_id)}"
                )
                row = cur.fetchone()
                return resp(200, row_to_dict(row, READINESS_COLS) if row else {})

            # ─── POST /project_id/send-to-production ───
            if method == "POST" and sub == "send-to-production":
                # Проверяем готовность
                cur.execute(
                    f"SELECT recipe_approved, raw_delivered, design_at_factory, "
                    f"can_shipped, declaration_ready "
                    f"FROM {SCHEMA}.project_readiness WHERE project_id = {esc(project_id)}"
                )
                rrow = cur.fetchone()
                if not rrow or not all(rrow):
                    return resp(400, {
                        "error": "Проект не готов к производству: не выполнены все условия"
                    })

                cur.execute(
                    f"SELECT {', '.join(PROJECT_COLS)} FROM {SCHEMA}.client_projects WHERE id = {esc(project_id)}"
                )
                prow = cur.fetchone()
                if not prow:
                    return resp(404, {"error": "Проект не найден"})
                proj = row_to_dict(prow, PROJECT_COLS)

                line_id = body.get("line_id", "line-1")
                line_speed = int(body.get("line_speed", 9100))
                cleaning_time = int(body.get("cleaning_time", 60))

                oid = str(uuid.uuid4())
                uid = str(uuid.uuid4())[:5].upper()
                order_number = f"ZKZ-{datetime.now().year}-{uid}"
                bid = str(uuid.uuid4())

                # Создаём заказ
                cur.execute(
                    f"INSERT INTO {SCHEMA}.orders "
                    f"(id, number, client, drink_name, sku, can_format, packaging_type, quantity, "
                    f"planned_production_date, planned_shipment_date, line_id, line_speed, "
                    f"cleaning_time, manager, comment, status, order_index, created_at, updated_at) "
                    f"VALUES ({esc(oid)}, {esc(order_number)}, {esc(proj['client'])}, "
                    f"{esc(proj['drink_name'])}, {esc(proj['drink_name'])}, "
                    f"{esc(proj.get('can_format') or '0.45')}, "
                    f"{esc(proj.get('label_type') or 'sleeve')}, "
                    f"{int(proj.get('batch_volume') or 0)}, "
                    f"{esc(body.get('planned_production_date') or datetime.now(TZ_MSK).strftime('%Y-%m-%d'))}, "
                    f"{esc(body.get('planned_shipment_date') or datetime.now(TZ_MSK).strftime('%Y-%m-%d'))}, "
                    f"{esc(line_id)}, {line_speed}, {cleaning_time}, "
                    f"{esc(proj.get('manager'))}, {esc(proj.get('comment'))}, "
                    f"'ready', 9999, {esc(now)}, {esc(now)})"
                )

                # Создаём партию
                from_time_q = (
                    f"SELECT COALESCE(MAX(end_time), NOW()) FROM {SCHEMA}.batches WHERE line_id = {esc(line_id)}"
                )
                cur.execute(from_time_q)
                start_row = cur.fetchone()
                start_time = start_row[0] if start_row and start_row[0] else datetime.now(TZ_MSK)
                if hasattr(start_time, 'tzinfo') and start_time.tzinfo is None:
                    start_time = start_time.replace(tzinfo=TZ_MSK)
                qty = int(proj.get("batch_volume") or 0)
                prod_min = (qty / line_speed * 60) if line_speed > 0 else 0
                end_time = start_time + timedelta(minutes=prod_min + cleaning_time)

                cur.execute(
                    f"INSERT INTO {SCHEMA}.batches "
                    f"(id, order_id, name, client, sku, quantity, speed, cleaning_time, "
                    f"line_id, color, status, order_index, start_time, end_time, created_at, updated_at) "
                    f"VALUES ({esc(bid)}, {esc(oid)}, {esc(proj['drink_name'])}, {esc(proj['client'])}, "
                    f"{esc(proj['drink_name'])}, {qty}, {line_speed}, {cleaning_time}, "
                    f"{esc(line_id)}, {esc(LINE_COLORS.get(line_id,'#0ea5e9'))}, 'ready', 9999, "
                    f"{esc(start_time.isoformat())}, {esc(end_time.isoformat())}, {esc(now)}, {esc(now)})"
                )

                # Обновляем проект
                cur.execute(
                    f"UPDATE {SCHEMA}.client_projects SET stage = 'ready', "
                    f"production_order_id = {esc(oid)}, updated_at = {esc(now)} "
                    f"WHERE id = {esc(project_id)}"
                )
                conn.commit()
                return resp(200, {"order_id": oid, "batch_id": bid, "order_number": order_number})

            return resp(404, {"error": f"Неизвестный sub-resource: {sub}"})

        # ═══════════════════════════════════════════════
        # PROJECTS CRUD
        # ═══════════════════════════════════════════════

        # GET /client-projects — список
        if method == "GET" and not project_id:
            where = ["1=1"]
            if params.get("search"):
                q = esc(f"%{params['search']}%")
                where.append(f"(client ILIKE {q} OR brand ILIKE {q} OR drink_name ILIKE {q})")
            if params.get("stage"):
                where.append(f"stage = {esc(params['stage'])}")
            w = " AND ".join(where)
            cur.execute(
                f"SELECT {', '.join(PROJECT_COLS)} FROM {SCHEMA}.client_projects "
                f"WHERE {w} ORDER BY created_at DESC"
            )
            return resp(200, [row_to_dict(r, PROJECT_COLS) for r in cur.fetchall()])

        # GET /client-projects/{id} — детали
        if method == "GET" and project_id:
            cur.execute(
                f"SELECT {', '.join(PROJECT_COLS)} FROM {SCHEMA}.client_projects WHERE id = {esc(project_id)}"
            )
            row = cur.fetchone()
            if not row:
                return resp(404, {"error": "Проект не найден"})
            proj = row_to_dict(row, PROJECT_COLS)

            # Загружаем все связанные данные
            cur.execute(
                f"SELECT {', '.join(READINESS_COLS)} FROM {SCHEMA}.project_readiness "
                f"WHERE project_id = {esc(project_id)}"
            )
            rrow = cur.fetchone()
            proj["readiness"] = row_to_dict(rrow, READINESS_COLS) if rrow else None
            return resp(200, proj)

        # POST /client-projects — создать
        if method == "POST" and not project_id:
            pid = str(uuid.uuid4())
            number = gen_project_number()
            cur.execute(
                f"INSERT INTO {SCHEMA}.client_projects "
                f"(id, number, client, brand, drink_name, flavor, can_volume, can_format, "
                f"label_type, sku_count, batch_volume, contact_person, manager, deadline, "
                f"comment, stage, readiness_pct, is_ready, production_order_id, created_at, updated_at) "
                f"VALUES ({esc(pid)}, {esc(number)}, {esc(body.get('client',''))}, "
                f"{esc(body.get('brand'))}, {esc(body.get('drink_name',''))}, "
                f"{esc(body.get('flavor'))}, {esc(body.get('can_volume'))}, "
                f"{esc(body.get('can_format'))}, {esc(body.get('label_type'))}, "
                f"{int(body.get('sku_count',1))}, "
                f"{'NULL' if body.get('batch_volume') is None else int(body['batch_volume'])}, "
                f"{esc(body.get('contact_person'))}, {esc(body.get('manager'))}, "
                f"{esc(body.get('deadline'))}, {esc(body.get('comment'))}, "
                f"{esc(body.get('stage','negotiations'))}, 0, FALSE, NULL, {esc(now)}, {esc(now)})"
            )
            # Создаём запись readiness
            rid = str(uuid.uuid4())
            cur.execute(
                f"INSERT INTO {SCHEMA}.project_readiness "
                f"(id, project_id, recipe_approved, raw_ordered, raw_delivered, "
                f"design_at_factory, can_shipped, declaration_ready, samples_sent, "
                f"client_approved, updated_at) "
                f"VALUES ({esc(rid)}, {esc(pid)}, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, {esc(now)})"
            )
            conn.commit()
            cur.execute(
                f"SELECT {', '.join(PROJECT_COLS)} FROM {SCHEMA}.client_projects WHERE id = {esc(pid)}"
            )
            return resp(201, row_to_dict(cur.fetchone(), PROJECT_COLS))

        # PUT /client-projects/{id} — обновить
        if method == "PUT" and project_id:
            sets = []
            for f in ["client", "brand", "drink_name", "flavor", "can_volume", "can_format",
                       "label_type", "sku_count", "batch_volume", "contact_person",
                       "manager", "deadline", "comment", "stage"]:
                if f in body:
                    v = body[f]
                    if f in ("sku_count", "batch_volume") and v is not None:
                        sets.append(f"{f} = {int(v)}")
                    else:
                        sets.append(f"{f} = {esc(v)}")
            sets.append(f"updated_at = {esc(now)}")
            cur.execute(
                f"UPDATE {SCHEMA}.client_projects SET {', '.join(sets)} WHERE id = {esc(project_id)}"
            )
            conn.commit()
            cur.execute(
                f"SELECT {', '.join(PROJECT_COLS)} FROM {SCHEMA}.client_projects WHERE id = {esc(project_id)}"
            )
            return resp(200, row_to_dict(cur.fetchone(), PROJECT_COLS))

        # DELETE /client-projects/{id}
        if method == "DELETE" and project_id:
            for tbl in ["project_recipe_items", "project_designs", "project_factory_setups",
                        "project_declarations", "project_raw_purchases", "project_cans",
                        "project_readiness", "project_client_cards"]:
                cur.execute(f"DELETE FROM {SCHEMA}.{tbl} WHERE project_id = {esc(project_id)}")
            cur.execute(f"DELETE FROM {SCHEMA}.client_projects WHERE id = {esc(project_id)}")
            conn.commit()
            return resp(200, {"deleted": project_id})

        return resp(405, {"error": "Метод не поддерживается"})

    except Exception as e:
        conn.rollback()
        return resp(500, {"error": str(e)})
    finally:
        cur.close()
        conn.close()
