"""
API для управления сырьём и материалами: остатки, резервы, проверка по заказу.
"""
import json
import os
import uuid
from datetime import datetime, timezone
from urllib.parse import unquote, urlparse
import psycopg2

SCHEMA = "t_p55602185_app_creation_project"

# Норма расхода материалов на 1 банку (по формату банки)
# Ключ: (can_format, packaging_type)
MATERIAL_NORMS = {
    "can": {
        "0.33": "mat-can-033",
        "0.45": "mat-can-045",
        "0.5":  "mat-can-05",
    },
    "lid":       "mat-lid",
    "hz":        "mat-hz",       # Честный знак — 1 на банку
    "sticker":   "mat-sticker",  # Групповой стикер — 1 на 6 банок (блок)
    "cardboard": "mat-cardboard",# Межрядный картон — 1 на 120 банок (слой)
    "pallet":    "mat-pallet",   # Поддон — 1 на 3000 банок
    "sleeve_mat":"mat-sleeve",   # Sleeve — 1 на банку (только sleeve-упаковка)
}

MAT_COLS = [
    "id", "name", "category", "unit", "stock", "reserved",
    "min_stock", "supplier", "next_delivery_date", "price_per_unit",
    "created_at", "updated_at"
]

RES_COLS = [
    "id", "order_id", "material_id", "needed", "reserved", "shortage", "status",
    "created_at", "updated_at"
]


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


def row_dict(row, cols):
    return dict(zip(cols, row))


def calc_needs(quantity: int, can_format: str, packaging_type: str) -> dict:
    """Рассчитывает потребность в материалах для партии."""
    needs = {}
    # Банка
    can_id = MATERIAL_NORMS["can"].get(can_format, "mat-can-033")
    needs[can_id] = quantity
    # Крышка
    needs[MATERIAL_NORMS["lid"]] = quantity
    # Честный знак
    needs[MATERIAL_NORMS["hz"]] = quantity
    # Sleeve только для sleeve-упаковки
    if packaging_type == "sleeve":
        needs[MATERIAL_NORMS["sleeve_mat"]] = quantity
    # Групповой стикер: 1 на 6 банок
    needs[MATERIAL_NORMS["sticker"]] = max(1, quantity // 6)
    # Межрядный картон: 1 лист на 120 банок
    needs[MATERIAL_NORMS["cardboard"]] = max(1, quantity // 120)
    # Поддон: 1 на 3000 банок
    needs[MATERIAL_NORMS["pallet"]] = max(1, quantity // 3000)
    return needs


def do_check_and_reserve(conn, cur, order_id: str, quantity: int,
                          can_format: str, packaging_type: str,
                          release_old: bool = False) -> dict:
    """
    Проверяет сырьё для заказа, резервирует доступное,
    фиксирует нехватки. Возвращает итог проверки.
    """
    now = datetime.now(tz=timezone.utc).isoformat()

    # Снимаем старые резервы если пересчёт
    if release_old:
        cur.execute(
            f"SELECT material_id, reserved FROM {SCHEMA}.material_reservations WHERE order_id = {esc(order_id)}"
        )
        old = cur.fetchall()
        for mat_id, old_reserved in old:
            if old_reserved and float(old_reserved) > 0:
                cur.execute(
                    f"UPDATE {SCHEMA}.materials SET reserved = GREATEST(0, reserved - {float(old_reserved)}), "
                    f"updated_at = {esc(now)} WHERE id = {esc(mat_id)}"
                )
        cur.execute(f"DELETE FROM {SCHEMA}.material_reservations WHERE order_id = {esc(order_id)}")
        cur.execute(f"DELETE FROM {SCHEMA}.material_check_results WHERE order_id = {esc(order_id)}")

    needs = calc_needs(quantity, can_format, packaging_type)
    shortage_count = 0
    results = []

    for mat_id, needed in needs.items():
        # Берём текущие остатки
        cur.execute(
            f"SELECT id, stock, reserved FROM {SCHEMA}.materials WHERE id = {esc(mat_id)}"
        )
        mat_row = cur.fetchone()
        if not mat_row:
            continue

        _, stock, mat_reserved = mat_row
        available = float(stock) - float(mat_reserved)
        can_reserve = min(float(needed), max(0, available))
        shortage = max(0, float(needed) - available)
        status = "ok" if shortage == 0 else "shortage"

        if shortage > 0:
            shortage_count += 1

        # Резервируем
        if can_reserve > 0:
            cur.execute(
                f"UPDATE {SCHEMA}.materials SET reserved = reserved + {can_reserve}, "
                f"updated_at = {esc(now)} WHERE id = {esc(mat_id)}"
            )

        # Сохраняем результат резерва
        rid = str(uuid.uuid4())
        cur.execute(
            f"""INSERT INTO {SCHEMA}.material_reservations
                (id, order_id, material_id, needed, reserved, shortage, status, created_at, updated_at)
                VALUES ({esc(rid)}, {esc(order_id)}, {esc(mat_id)},
                        {float(needed)}, {can_reserve}, {shortage},
                        {esc(status)}, {esc(now)}, {esc(now)})"""
        )
        results.append({
            "material_id": mat_id,
            "needed": float(needed),
            "reserved": can_reserve,
            "shortage": shortage,
            "status": status,
        })

    all_ok = shortage_count == 0
    new_order_status = "ready" if all_ok else "check_materials"

    # Сохраняем результат проверки
    cid = str(uuid.uuid4())
    cur.execute(
        f"""INSERT INTO {SCHEMA}.material_check_results
            (id, order_id, status, checked_at, all_available, shortage_count)
            VALUES ({esc(cid)}, {esc(order_id)}, {esc('ok' if all_ok else 'shortage')},
                    {esc(now)}, {'TRUE' if all_ok else 'FALSE'}, {shortage_count})"""
    )

    # Обновляем статус заказа
    cur.execute(
        f"UPDATE {SCHEMA}.orders SET status = {esc(new_order_status)}, updated_at = {esc(now)} "
        f"WHERE id = {esc(order_id)}"
    )

    return {
        "all_available": all_ok,
        "shortage_count": shortage_count,
        "order_status": new_order_status,
        "items": results,
    }


def release_reservations(conn, cur, order_id: str):
    """Освобождает резервы при удалении/отмене заказа."""
    now = datetime.now(tz=timezone.utc).isoformat()
    cur.execute(
        f"SELECT material_id, reserved FROM {SCHEMA}.material_reservations WHERE order_id = {esc(order_id)}"
    )
    rows = cur.fetchall()
    for mat_id, reserved_qty in rows:
        if reserved_qty and float(reserved_qty) > 0:
            cur.execute(
                f"UPDATE {SCHEMA}.materials SET reserved = GREATEST(0, reserved - {float(reserved_qty)}), "
                f"updated_at = {esc(now)} WHERE id = {esc(mat_id)}"
            )
    cur.execute(f"DELETE FROM {SCHEMA}.material_reservations WHERE order_id = {esc(order_id)}")
    cur.execute(f"DELETE FROM {SCHEMA}.material_check_results WHERE order_id = {esc(order_id)}")


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors(), "body": ""}

    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")
    params = event.get("queryStringParameters") or {}

    path_parts = [p for p in path.strip("/").split("/") if p]
    sub = path_parts[1] if len(path_parts) >= 2 else None   # e.g. "check", "release", mat-id

    conn = get_conn()
    cur = conn.cursor()
    try:

        # GET /materials — список материалов
        if method == "GET" and not sub:
            cur.execute(
                f"SELECT {', '.join(MAT_COLS)} FROM {SCHEMA}.materials ORDER BY category, name"
            )
            rows = cur.fetchall()
            items = []
            for r in rows:
                d = row_dict(r, MAT_COLS)
                d["available"] = float(d["stock"]) - float(d["reserved"])
                items.append(d)
            return resp(200, items)

        # GET /materials/check?order_id=...  — результаты проверки по заказу
        if method == "GET" and sub == "check":
            order_id = params.get("order_id")
            if not order_id:
                return resp(400, {"error": "order_id required"})

            # Берём результаты резервирования
            cur.execute(
                f"""SELECT mr.material_id, mr.needed, mr.reserved, mr.shortage, mr.status,
                           m.name, m.unit, m.stock, m.reserved as mat_reserved
                    FROM {SCHEMA}.material_reservations mr
                    JOIN {SCHEMA}.materials m ON m.id = mr.material_id
                    WHERE mr.order_id = {esc(order_id)}
                    ORDER BY mr.status DESC, m.name"""
            )
            rows = cur.fetchall()
            cols = ["material_id", "needed", "reserved", "shortage", "status",
                    "name", "unit", "stock", "mat_reserved"]
            items = [row_dict(r, cols) for r in rows]

            cur.execute(
                f"SELECT all_available, shortage_count, checked_at FROM {SCHEMA}.material_check_results "
                f"WHERE order_id = {esc(order_id)} ORDER BY checked_at DESC LIMIT 1"
            )
            meta = cur.fetchone()

            return resp(200, {
                "order_id": order_id,
                "all_available": meta[0] if meta else None,
                "shortage_count": meta[1] if meta else 0,
                "checked_at": meta[2] if meta else None,
                "items": items,
            })

        # POST /materials/check — выполнить проверку/пересчёт сырья
        if method == "POST" and sub == "check":
            body = json.loads(event.get("body") or "{}")
            order_id = body.get("order_id")
            quantity = int(body.get("quantity", 0))
            can_format = body.get("can_format", "0.33")
            packaging_type = body.get("packaging_type", "sleeve")

            if not order_id or quantity <= 0:
                return resp(400, {"error": "order_id и quantity обязательны"})

            result = do_check_and_reserve(
                conn, cur, order_id, quantity, can_format, packaging_type,
                release_old=True
            )
            conn.commit()
            return resp(200, result)

        # POST /materials/release — освободить резервы
        if method == "POST" and sub == "release":
            body = json.loads(event.get("body") or "{}")
            order_id = body.get("order_id")
            if not order_id:
                return resp(400, {"error": "order_id required"})
            release_reservations(conn, cur, order_id)
            conn.commit()
            return resp(200, {"released": order_id})

        # PUT /materials/{id} — обновить остаток вручную
        if method == "PUT" and sub and sub not in ("check", "release"):
            body = json.loads(event.get("body") or "{}")
            now = datetime.now(tz=timezone.utc).isoformat()
            allowed = ["stock", "min_stock", "supplier", "next_delivery_date", "price_per_unit"]
            parts = []
            for f in allowed:
                if f in body:
                    val = body[f]
                    parts.append(f"{f} = {esc(val)}" if isinstance(val, str) else f"{f} = {val}")
            if not parts:
                return resp(400, {"error": "Нет полей"})
            parts.append(f"updated_at = {esc(now)}")
            cur.execute(
                f"UPDATE {SCHEMA}.materials SET {', '.join(parts)} WHERE id = {esc(sub)}"
            )
            conn.commit()
            cur.execute(
                f"SELECT {', '.join(MAT_COLS)} FROM {SCHEMA}.materials WHERE id = {esc(sub)}"
            )
            row = cur.fetchone()
            if not row:
                return resp(404, {"error": "Материал не найден"})
            d = row_dict(row, MAT_COLS)
            d["available"] = float(d["stock"]) - float(d["reserved"])
            return resp(200, d)

        return resp(405, {"error": "Метод не поддерживается"})

    finally:
        cur.close()
        conn.close()
