"""
Reorder API: пересчёт расписания линий после Drag & Drop.
Поддерживает:
  POST /reorder/batches  — переупорядочивание партий (Production)
  POST /reorder/orders   — переупорядочивание заказов (Orders)
"""
import json
import os
import uuid
from datetime import datetime, timezone, timedelta
from urllib.parse import unquote, urlparse
import psycopg2

SCHEMA = "t_p55602185_app_creation_project"

LINE_DEFAULT_START_HOUR = 6
TZ_MSK = timezone(timedelta(hours=3))

BATCH_COLS = [
    "id", "order_id", "name", "client", "sku", "quantity", "speed",
    "cleaning_time", "line_id", "color", "status", "start_time", "end_time",
    "order_index", "created_at", "updated_at"
]

ORDER_COLS = [
    "id", "number", "client", "drink_name", "sku", "can_format",
    "packaging_type", "quantity", "planned_production_date", "planned_shipment_date",
    "line_id", "line_speed", "cleaning_time", "manager", "comment",
    "status", "order_index", "created_at", "updated_at"
]

LINE_COLORS = {
    "line-1": "#0ea5e9",
    "line-2": "#f97316",
    "line-3": "#8b5cf6",
}

BLOCKED_STATUSES = {"shipped", "cancelled"}
PRODUCIBLE_STATUSES = {"ready", "check_materials", "new"}


def get_conn():
    url = urlparse(os.environ["DATABASE_URL"])
    return psycopg2.connect(
        host=url.hostname,
        port=url.port or 5432,
        dbname=unquote(url.path.lstrip("/")),
        user=unquote(url.username),
        password=unquote(url.password),
    )


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
    return "'" + str(val).replace("'", "''") + "'"


def now_str():
    return datetime.now(TZ_MSK).isoformat()


def get_line_start(cur, line_id):
    cur.execute(f"SELECT start_time FROM {SCHEMA}.lines WHERE id = {escape(line_id)}")
    row = cur.fetchone()
    if row and row[0]:
        val = row[0]
        if hasattr(val, "tzinfo") and val.tzinfo is None:
            val = val.replace(tzinfo=TZ_MSK)
        return val
    return datetime.now(TZ_MSK).replace(hour=LINE_DEFAULT_START_HOUR, minute=0, second=0, microsecond=0)


def recalculate_line_schedule(cur, line_id, now_ts):
    cur.execute(
        f"SELECT {', '.join(BATCH_COLS)} FROM {SCHEMA}.batches "
        f"WHERE line_id = {escape(line_id)} "
        f"ORDER BY order_index ASC, start_time ASC NULLS LAST"
    )
    batches = [dict(zip(BATCH_COLS, r)) for r in cur.fetchall()]

    if not batches:
        return []

    current_time = get_line_start(cur, line_id)

    updated = []
    for b in batches:
        start = current_time
        quantity = b["quantity"]
        speed = b["speed"] or 9100
        cleaning_time = b["cleaning_time"] or 0

        production_minutes = (quantity / speed) * 60
        total_minutes = production_minutes + cleaning_time
        end = start + timedelta(minutes=total_minutes)

        cur.execute(
            f"UPDATE {SCHEMA}.batches SET "
            f"start_time = {escape(start.isoformat())}, "
            f"end_time = {escape(end.isoformat())}, "
            f"updated_at = {escape(now_ts)} "
            f"WHERE id = {escape(b['id'])}"
        )
        b["start_time"] = start.isoformat()
        b["end_time"] = end.isoformat()
        updated.append(b)
        current_time = end

    return updated


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers(), "body": ""}

    method = event.get("httpMethod", "POST")
    path = event.get("path", "/")
    path_parts = [p for p in path.strip("/").split("/") if p]
    params = event.get("queryStringParameters") or {}

    if method != "POST":
        return resp(405, {"error": "Метод не поддерживается"})

    body = json.loads(event.get("body") or "{}")
    # action может прийти как query param или из тела
    action = params.get("action") or body.get("_action") or (path_parts[1] if len(path_parts) >= 2 else "")
    conn = get_conn()
    cur = conn.cursor()
    now = now_str()

    try:
        # ─── POST /reorder/orders ───
        # body: { ordered_ids: [id, ...] }
        if action == "orders":
            ordered_ids = body.get("ordered_ids", [])
            if not ordered_ids:
                return resp(400, {"error": "ordered_ids обязателен"})

            for idx, oid in enumerate(ordered_ids):
                cur.execute(
                    f"UPDATE {SCHEMA}.orders SET order_index = {idx}, updated_at = {escape(now)} "
                    f"WHERE id = {escape(oid)}"
                )

            conn.commit()
            return resp(200, {"updated": len(ordered_ids)})

        # ─── POST /reorder/batches ───
        # body: {
        #   batch_id: str,          — перемещаемая партия
        #   new_line_id: str,       — целевая линия
        #   ordered_ids: [id, ...], — новый порядок батчей на целевой линии
        #   old_line_id: str|null   — исходная линия (если другая)
        # }
        if action == "batches":
            batch_id = body.get("batch_id")
            new_line_id = body.get("new_line_id")
            ordered_ids = body.get("ordered_ids", [])
            old_line_id = body.get("old_line_id")

            if not batch_id or not new_line_id:
                return resp(400, {"error": "batch_id и new_line_id обязательны"})

            # Обновляем line_id партии
            cur.execute(
                f"UPDATE {SCHEMA}.batches SET line_id = {escape(new_line_id)}, "
                f"color = {escape(LINE_COLORS.get(new_line_id, '#0ea5e9'))}, "
                f"updated_at = {escape(now)} "
                f"WHERE id = {escape(batch_id)}"
            )

            # Обновляем order_index на новой линии
            for idx, bid in enumerate(ordered_ids):
                cur.execute(
                    f"UPDATE {SCHEMA}.batches SET order_index = {idx}, updated_at = {escape(now)} "
                    f"WHERE id = {escape(bid)}"
                )

            # Пересчитываем расписание новой линии
            updated_new = recalculate_line_schedule(cur, new_line_id, now)

            # Если партия переехала с другой линии — пересчитываем и её
            updated_old = []
            if old_line_id and old_line_id != new_line_id:
                # Переупорядочиваем оставшиеся партии старой линии
                cur.execute(
                    f"SELECT id FROM {SCHEMA}.batches "
                    f"WHERE line_id = {escape(old_line_id)} "
                    f"ORDER BY order_index ASC, start_time ASC NULLS LAST"
                )
                old_ids = [r[0] for r in cur.fetchall()]
                for idx, bid in enumerate(old_ids):
                    cur.execute(
                        f"UPDATE {SCHEMA}.batches SET order_index = {idx}, updated_at = {escape(now)} "
                        f"WHERE id = {escape(bid)}"
                    )
                updated_old = recalculate_line_schedule(cur, old_line_id, now)

                # Обновляем line_id у заказа
                cur.execute(
                    f"SELECT order_id FROM {SCHEMA}.batches WHERE id = {escape(batch_id)}"
                )
                row = cur.fetchone()
                if row and row[0]:
                    cur.execute(
                        f"UPDATE {SCHEMA}.orders SET line_id = {escape(new_line_id)}, "
                        f"updated_at = {escape(now)} WHERE id = {escape(row[0])}"
                    )

            conn.commit()
            return resp(200, {
                "updated_new_line": updated_new,
                "updated_old_line": updated_old,
            })

        # ─── POST /reorder/move-to-production ───
        # body: { order_id, line_id, position (optional) }
        if action == "move-to-production":
            order_id = body.get("order_id")
            line_id = body.get("line_id")
            position = body.get("position")  # None = конец

            if not order_id or not line_id:
                return resp(400, {"error": "order_id и line_id обязательны"})

            cur.execute(
                f"SELECT {', '.join(ORDER_COLS)} FROM {SCHEMA}.orders WHERE id = {escape(order_id)}"
            )
            row = cur.fetchone()
            if not row:
                return resp(404, {"error": "Заказ не найден"})
            order = dict(zip(ORDER_COLS, row))

            # Проверяем ограничения
            if order["status"] in BLOCKED_STATUSES:
                return resp(400, {"error": "Заказ нельзя поставить в производство: статус не позволяет"})

            # Проверяем сырьё
            cur.execute(
                f"SELECT all_available FROM {SCHEMA}.material_check_results "
                f"WHERE order_id = {escape(order_id)} ORDER BY checked_at DESC LIMIT 1"
            )
            mat_row = cur.fetchone()
            if mat_row and mat_row[0] is False:
                return resp(400, {
                    "error": "Заказ нельзя поставить в производство: не выполнены условия запуска",
                    "reason": "shortage"
                })

            # Проверяем — есть ли уже партия
            cur.execute(
                f"SELECT id FROM {SCHEMA}.batches WHERE order_id = {escape(order_id)} LIMIT 1"
            )
            existing_batch = cur.fetchone()

            if existing_batch:
                # Обновляем line_id существующей партии
                cur.execute(
                    f"UPDATE {SCHEMA}.batches SET line_id = {escape(line_id)}, "
                    f"color = {escape(LINE_COLORS.get(line_id, '#0ea5e9'))}, "
                    f"updated_at = {escape(now)} WHERE id = {escape(existing_batch[0])}"
                )
                batch_id = existing_batch[0]
            else:
                # Создаём новую партию
                batch_id = str(uuid.uuid4())
                cur.execute(
                    f"INSERT INTO {SCHEMA}.batches "
                    f"(id, order_id, name, client, sku, quantity, speed, cleaning_time, "
                    f"line_id, color, status, order_index, created_at, updated_at) VALUES "
                    f"({escape(batch_id)}, {escape(order_id)}, "
                    f"{escape(order['drink_name'])}, {escape(order['client'])}, {escape(order['sku'])}, "
                    f"{order['quantity']}, {order['line_speed']}, {order['cleaning_time']}, "
                    f"{escape(line_id)}, {escape(LINE_COLORS.get(line_id, '#0ea5e9'))}, "
                    f"'ready', 9999, {escape(now)}, {escape(now)})"
                )

            # Устанавливаем позицию
            if position is not None:
                cur.execute(
                    f"UPDATE {SCHEMA}.batches SET order_index = {int(position)}, "
                    f"updated_at = {escape(now)} WHERE id = {escape(batch_id)}"
                )
                # Сдвигаем остальные
                cur.execute(
                    f"UPDATE {SCHEMA}.batches SET order_index = order_index + 1, "
                    f"updated_at = {escape(now)} "
                    f"WHERE line_id = {escape(line_id)} AND id != {escape(batch_id)} "
                    f"AND order_index >= {int(position)}"
                )
            else:
                # Добавляем в конец
                cur.execute(
                    f"SELECT COALESCE(MAX(order_index), -1) + 1 FROM {SCHEMA}.batches "
                    f"WHERE line_id = {escape(line_id)} AND id != {escape(batch_id)}"
                )
                max_idx = cur.fetchone()[0]
                cur.execute(
                    f"UPDATE {SCHEMA}.batches SET order_index = {max_idx}, "
                    f"updated_at = {escape(now)} WHERE id = {escape(batch_id)}"
                )

            # Обновляем статус заказа
            cur.execute(
                f"UPDATE {SCHEMA}.orders SET status = 'ready', line_id = {escape(line_id)}, "
                f"updated_at = {escape(now)} WHERE id = {escape(order_id)}"
            )

            # Пересчитываем расписание линии
            updated = recalculate_line_schedule(cur, line_id, now)
            conn.commit()
            return resp(200, {"batch_id": batch_id, "updated_line": updated})

        # ─── POST /reorder/remove-from-production ───
        # body: { batch_id }
        if action == "remove-from-production":
            batch_id = body.get("batch_id")
            if not batch_id:
                return resp(400, {"error": "batch_id обязателен"})

            cur.execute(
                f"SELECT order_id, line_id FROM {SCHEMA}.batches WHERE id = {escape(batch_id)}"
            )
            row = cur.fetchone()
            if not row:
                return resp(404, {"error": "Партия не найдена"})

            order_id, line_id = row

            # Удаляем партию
            cur.execute(f"DELETE FROM {SCHEMA}.batches WHERE id = {escape(batch_id)}")

            # Возвращаем статус заказа
            if order_id:
                cur.execute(
                    f"UPDATE {SCHEMA}.orders SET status = 'new', "
                    f"updated_at = {escape(now)} WHERE id = {escape(order_id)}"
                )

            # Переупорядочиваем оставшиеся
            cur.execute(
                f"SELECT id FROM {SCHEMA}.batches WHERE line_id = {escape(line_id)} "
                f"ORDER BY order_index ASC, start_time ASC NULLS LAST"
            )
            remaining = [r[0] for r in cur.fetchall()]
            for idx, bid in enumerate(remaining):
                cur.execute(
                    f"UPDATE {SCHEMA}.batches SET order_index = {idx}, updated_at = {escape(now)} "
                    f"WHERE id = {escape(bid)}"
                )

            updated = recalculate_line_schedule(cur, line_id, now)
            conn.commit()
            return resp(200, {"removed": batch_id, "updated_line": updated})

        return resp(404, {"error": f"Неизвестный action: {action}"})

    except Exception as e:
        conn.rollback()
        return resp(500, {"error": str(e)})
    finally:
        cur.close()
        conn.close()