"""
API для управления заказами: CRUD + автосоздание партий в производстве.
"""
import json
import os
import uuid
from datetime import datetime, timezone, timedelta
import psycopg2
import psycopg2.extras

SCHEMA = "t_p55602185_app_creation_project"

LINE_COLORS = {
    "line-1": "#0ea5e9",
    "line-2": "#f97316",
    "line-3": "#8b5cf6",
}

ORDER_COLS = [
    "id", "number", "client", "drink_name", "sku", "can_format",
    "packaging_type", "quantity", "planned_production_date", "planned_shipment_date",
    "line_id", "line_speed", "cleaning_time", "manager", "comment",
    "status", "created_at", "updated_at"
]

BATCH_COLS = [
    "id", "order_id", "name", "client", "sku", "quantity", "speed",
    "cleaning_time", "line_id", "color", "status", "start_time", "end_time",
    "created_at", "updated_at"
]


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def cors_headers():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-User-Id",
    }


def resp(status, body):
    return {
        "statusCode": status,
        "headers": {**cors_headers(), "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False, default=str),
    }


def escape(val):
    if val is None:
        return "NULL"
    s = str(val).replace("'", "''")
    return f"'{s}'"


def calc_end_time(start_ts, quantity, speed, cleaning_time):
    production_minutes = (quantity / speed) * 60
    total_minutes = production_minutes + cleaning_time
    if isinstance(start_ts, str):
        start_ts = datetime.fromisoformat(start_ts.replace("Z", "+00:00"))
    if hasattr(start_ts, "tzinfo") and start_ts.tzinfo is None:
        start_ts = start_ts.replace(tzinfo=timezone.utc)
    return start_ts + timedelta(minutes=total_minutes)


def get_line_next_start(cur, line_id, production_date_str):
    cur.execute(f"SELECT end_time FROM {SCHEMA}.batches WHERE line_id = '{line_id}' ORDER BY end_time DESC NULLS LAST LIMIT 1")
    row = cur.fetchone()
    if row and row[0]:
        val = row[0]
        if hasattr(val, "tzinfo") and val.tzinfo is None:
            val = val.replace(tzinfo=timezone(timedelta(hours=3)))
        return val
    dt = datetime.strptime(production_date_str, "%Y-%m-%d")
    return dt.replace(hour=6, minute=0, second=0, tzinfo=timezone(timedelta(hours=3)))


def generate_order_number():
    now = datetime.now()
    uid = str(uuid.uuid4())[:5].upper()
    return f"ZKZ-{now.year}-{uid}"


def row_to_dict(row, cols):
    return dict(zip(cols, row))


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers(), "body": ""}

    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")
    params = event.get("queryStringParameters") or {}

    path_parts = [p for p in path.strip("/").split("/") if p]
    order_id = path_parts[1] if len(path_parts) >= 2 else None

    conn = get_conn()
    cur = conn.cursor()
    try:
        # GET /orders
        if method == "GET" and not order_id:
            where_parts = ["1=1"]
            if params.get("status"):
                where_parts.append(f"status = {escape(params['status'])}")
            if params.get("search"):
                q = escape(f"%{params['search']}%")
                where_parts.append(f"(client ILIKE {q} OR sku ILIKE {q} OR number ILIKE {q} OR drink_name ILIKE {q})")
            if params.get("production_date"):
                where_parts.append(f"planned_production_date = {escape(params['production_date'])}")
            where = " AND ".join(where_parts)
            cur.execute(f"SELECT {', '.join(ORDER_COLS)} FROM {SCHEMA}.orders WHERE {where} ORDER BY created_at DESC")
            rows = cur.fetchall()
            return resp(200, [row_to_dict(r, ORDER_COLS) for r in rows])

        # GET /orders/{id}
        if method == "GET" and order_id:
            cur.execute(f"SELECT {', '.join(ORDER_COLS)} FROM {SCHEMA}.orders WHERE id = {escape(order_id)}")
            row = cur.fetchone()
            if not row:
                return resp(404, {"error": "Заказ не найден"})
            return resp(200, row_to_dict(row, ORDER_COLS))

        # POST /orders
        if method == "POST":
            body = json.loads(event.get("body") or "{}")
            oid = str(uuid.uuid4())
            number = generate_order_number()
            now = datetime.now(tz=timezone.utc).isoformat()

            cur.execute(f"""
                INSERT INTO {SCHEMA}.orders
                (id, number, client, drink_name, sku, can_format, packaging_type,
                 quantity, planned_production_date, planned_shipment_date,
                 line_id, line_speed, cleaning_time, manager, comment, status,
                 created_at, updated_at)
                VALUES (
                    {escape(oid)}, {escape(number)},
                    {escape(body['client'])}, {escape(body['drink_name'])}, {escape(body['sku'])},
                    {escape(body.get('can_format','0.33'))}, {escape(body.get('packaging_type','sleeve'))},
                    {int(body['quantity'])},
                    {escape(body['planned_production_date'])}, {escape(body['planned_shipment_date'])},
                    {escape(body.get('line_id','line-1'))}, {int(body.get('line_speed',2000))},
                    {int(body.get('cleaning_time',30))},
                    {escape(body.get('manager',''))}, {escape(body.get('comment',''))},
                    'new', {escape(now)}, {escape(now)}
                )
            """)
            conn.commit()

            cur.execute(f"SELECT {', '.join(ORDER_COLS)} FROM {SCHEMA}.orders WHERE id = {escape(oid)}")
            order = row_to_dict(cur.fetchone(), ORDER_COLS)

            # Автосоздание партии
            line_id = body.get("line_id", "line-1")
            start_ts = get_line_next_start(cur, line_id, body["planned_production_date"])
            speed = int(body.get("line_speed", 2000))
            cleaning = int(body.get("cleaning_time", 30))
            end_ts = calc_end_time(start_ts, int(body["quantity"]), speed, cleaning)

            bid = str(uuid.uuid4())
            batch_name = f"{body['drink_name']} — {body['client']}"
            color = LINE_COLORS.get(line_id, "#0ea5e9")

            cur.execute(f"""
                INSERT INTO {SCHEMA}.batches
                (id, order_id, name, client, sku, quantity, speed, cleaning_time,
                 line_id, color, status, start_time, end_time, created_at, updated_at)
                VALUES (
                    {escape(bid)}, {escape(oid)}, {escape(batch_name)},
                    {escape(body['client'])}, {escape(body['sku'])},
                    {int(body['quantity'])}, {speed}, {cleaning},
                    {escape(line_id)}, {escape(color)}, 'new',
                    {escape(start_ts.isoformat())}, {escape(end_ts.isoformat())},
                    {escape(now)}, {escape(now)}
                )
            """)
            conn.commit()

            cur.execute(f"SELECT {', '.join(BATCH_COLS)} FROM {SCHEMA}.batches WHERE id = {escape(bid)}")
            batch = row_to_dict(cur.fetchone(), BATCH_COLS)

            return resp(201, {"order": order, "batch": batch})

        # PUT /orders/{id}
        if method == "PUT" and order_id:
            body = json.loads(event.get("body") or "{}")
            now = datetime.now(tz=timezone.utc).isoformat()

            allowed = [
                "client", "drink_name", "sku", "can_format", "packaging_type",
                "quantity", "planned_production_date", "planned_shipment_date",
                "line_id", "line_speed", "cleaning_time", "manager", "comment", "status"
            ]
            set_parts = []
            for f in allowed:
                if f in body:
                    if f in ("quantity", "line_speed", "cleaning_time"):
                        set_parts.append(f"{f} = {int(body[f])}")
                    else:
                        set_parts.append(f"{f} = {escape(body[f])}")

            if not set_parts:
                return resp(400, {"error": "Нет полей"})

            set_parts.append(f"updated_at = {escape(now)}")
            cur.execute(f"UPDATE {SCHEMA}.orders SET {', '.join(set_parts)} WHERE id = {escape(order_id)}")
            conn.commit()

            # Пересчёт партии
            if any(f in body for f in ["quantity", "line_speed", "cleaning_time"]):
                cur.execute(f"SELECT {', '.join(BATCH_COLS)} FROM {SCHEMA}.batches WHERE order_id = {escape(order_id)} LIMIT 1")
                b_row = cur.fetchone()
                if b_row:
                    b = row_to_dict(b_row, BATCH_COLS)
                    new_speed = int(body.get("line_speed", b["speed"]))
                    new_qty = int(body.get("quantity", b["quantity"]))
                    new_clean = int(body.get("cleaning_time", b["cleaning_time"]))
                    new_end = calc_end_time(b["start_time"], new_qty, new_speed, new_clean)
                    cur.execute(f"""
                        UPDATE {SCHEMA}.batches SET
                        quantity={new_qty}, speed={new_speed}, cleaning_time={new_clean},
                        end_time={escape(new_end.isoformat())}, updated_at={escape(now)}
                        WHERE order_id={escape(order_id)}
                    """)
                    conn.commit()

            cur.execute(f"SELECT {', '.join(ORDER_COLS)} FROM {SCHEMA}.orders WHERE id = {escape(order_id)}")
            row = cur.fetchone()
            if not row:
                return resp(404, {"error": "Заказ не найден"})
            return resp(200, row_to_dict(row, ORDER_COLS))

        # DELETE /orders/{id}
        if method == "DELETE" and order_id:
            cur.execute(f"DELETE FROM {SCHEMA}.batches WHERE order_id = {escape(order_id)}")
            cur.execute(f"DELETE FROM {SCHEMA}.orders WHERE id = {escape(order_id)}")
            conn.commit()
            return resp(200, {"deleted": order_id})

        return resp(405, {"error": "Метод не поддерживается"})

    finally:
        cur.close()
        conn.close()
