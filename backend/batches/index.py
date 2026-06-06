"""
API для получения партий производства по линиям.
"""
import json
import os
import psycopg2

SCHEMA = "t_p55602185_app_creation_project"

BATCH_COLS = [
    "id", "order_id", "name", "client", "sku", "quantity", "speed",
    "cleaning_time", "line_id", "color", "status", "start_time", "end_time",
    "order_index", "created_at", "updated_at"
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


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors_headers(), "body": ""}

    method = event.get("httpMethod", "GET")
    params = event.get("queryStringParameters") or {}

    conn = get_conn()
    cur = conn.cursor()
    try:
        if method == "GET":
            where_parts = ["1=1"]
            if params.get("line_id"):
                where_parts.append(f"line_id = {escape(params['line_id'])}")
            where = " AND ".join(where_parts)
            cur.execute(f"SELECT {', '.join(BATCH_COLS)} FROM {SCHEMA}.batches WHERE {where} ORDER BY start_time ASC NULLS LAST")
            rows = cur.fetchall()
            return resp(200, [dict(zip(BATCH_COLS, r)) for r in rows])

        return resp(405, {"error": "Метод не поддерживается"})

    finally:
        cur.close()
        conn.close()