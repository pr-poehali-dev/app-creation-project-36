"""
Загрузка карточки клиента (Excel) в S3 и сохранение распознанных данных.
POST /upload-card/{project_id}
  body: { file_name, file_b64 (base64), parsed_data, skus }
GET  /upload-card/{project_id}
  — возвращает текущую карточку проекта
"""
import json
import os
import uuid
import base64
from datetime import datetime, timezone, timedelta
from urllib.parse import unquote, urlparse
import psycopg2
import boto3

SCHEMA = "t_p55602185_app_creation_project"
TZ_MSK = timezone(timedelta(hours=3))

CLIENT_CARD_COLS = [
    "id", "project_id", "file_name", "file_url",
    "legal_name", "short_name", "location", "legal_address",
    "director", "email", "trademark", "ds_type", "pallet_scheme",
    "can_label_type", "can_color", "lid_color", "doc_comment",
    "card_status", "skus", "parsed_data",
    "uploaded_at", "uploaded_by", "updated_at"
]


def get_conn():
    url = urlparse(os.environ["DATABASE_URL"])
    return psycopg2.connect(
        host=url.hostname, port=url.port or 5432,
        dbname=unquote(url.path.lstrip("/")),
        user=unquote(url.username),
        password=unquote(url.password),
    )


def s3_client():
    return boto3.client(
        "s3",
        endpoint_url="https://bucket.poehali.dev",
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )


def cors():
    return {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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


def determine_card_status(data: dict, skus: list) -> str:
    required = [
        data.get("legal_name"),
        data.get("email"),
        data.get("trademark"),
        data.get("ds_type"),
        data.get("can_label_type"),
        data.get("lid_color"),
    ]
    has_skus = bool(skus and len(skus) > 0)
    if all(required) and has_skus:
        return "filled"
    if any(required) or has_skus:
        return "needs_clarification"
    return "empty"


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": cors(), "body": ""}

    method = event.get("httpMethod", "GET")
    path = event.get("path", "/")
    path_parts = [p for p in path.strip("/").split("/") if p]
    project_id = path_parts[1] if len(path_parts) >= 2 else None

    if not project_id:
        return resp(400, {"error": "project_id обязателен в URL"})

    body = {}
    if event.get("body"):
        body = json.loads(event["body"])

    now = now_str()
    conn = get_conn()
    cur = conn.cursor()

    try:
        # ─── GET — получить карточку ───
        if method == "GET":
            cur.execute(
                f"SELECT {', '.join(CLIENT_CARD_COLS)} "
                f"FROM {SCHEMA}.project_client_cards "
                f"WHERE project_id = {esc(project_id)} "
                f"ORDER BY uploaded_at DESC LIMIT 1"
            )
            row = cur.fetchone()
            if not row:
                return resp(200, None)
            d = row_to_dict(row, CLIENT_CARD_COLS)
            # JSONB поля psycopg2 отдаёт как dict/list уже
            return resp(200, d)

        # ─── POST — загрузить/обновить ───
        if method == "POST":
            file_name = body.get("file_name", "")
            file_b64 = body.get("file_b64")  # base64-строка
            parsed = body.get("parsed_data") or {}
            skus = body.get("skus") or []

            file_url = None

            # Загружаем файл в S3 если передан base64
            if file_b64 and file_name:
                try:
                    s3 = s3_client()
                    key = f"client-cards/{project_id}/{uuid.uuid4()}_{file_name}"
                    file_bytes = base64.b64decode(file_b64)
                    s3.put_object(
                        Bucket="files",
                        Key=key,
                        Body=file_bytes,
                        ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    )
                    access_key = os.environ["AWS_ACCESS_KEY_ID"]
                    file_url = f"https://cdn.poehali.dev/projects/{access_key}/bucket/{key}"
                except Exception as e:
                    # S3 ошибка некритична — продолжаем без файла
                    file_url = None

            card_status = determine_card_status(parsed, skus)

            # Upsert — проверяем существующую запись
            cur.execute(
                f"SELECT id FROM {SCHEMA}.project_client_cards "
                f"WHERE project_id = {esc(project_id)} LIMIT 1"
            )
            existing = cur.fetchone()

            def esc_json(v):
                if v is None:
                    return "NULL"
                return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'"

            fields = [
                "legal_name", "short_name", "location", "legal_address",
                "director", "email", "trademark", "ds_type", "pallet_scheme",
                "can_label_type", "can_color", "lid_color", "doc_comment",
            ]

            if existing:
                cid = existing[0]
                sets = []
                for f in fields:
                    sets.append(f"{f} = {esc(parsed.get(f))}")
                sets.append(f"card_status = {esc(card_status)}")
                sets.append(f"skus = {esc_json(skus)}")
                sets.append(f"parsed_data = {esc_json(parsed)}")
                sets.append(f"updated_at = {esc(now)}")
                sets.append(f"uploaded_at = {esc(now)}")
                if file_name:
                    sets.append(f"file_name = {esc(file_name)}")
                if file_url:
                    sets.append(f"file_url = {esc(file_url)}")
                cur.execute(
                    f"UPDATE {SCHEMA}.project_client_cards SET {', '.join(sets)} "
                    f"WHERE id = {esc(cid)}"
                )
            else:
                cid = str(uuid.uuid4())
                vals_fields = ["id", "project_id", "file_name", "file_url"] + fields + [
                    "card_status", "skus", "parsed_data", "uploaded_at", "uploaded_by", "updated_at"
                ]
                vals = [
                    esc(cid), esc(project_id), esc(file_name), esc(file_url),
                ] + [esc(parsed.get(f)) for f in fields] + [
                    esc(card_status),
                    esc_json(skus),
                    esc_json(parsed),
                    esc(now),
                    esc(body.get("uploaded_by", "Менеджер")),
                    esc(now),
                ]
                cur.execute(
                    f"INSERT INTO {SCHEMA}.project_client_cards ({', '.join(vals_fields)}) "
                    f"VALUES ({', '.join(vals)})"
                )

            # Обновляем основной проект — подтягиваем торговую марку / имя клиента
            proj_sets = [f"updated_at = {esc(now)}"]
            if parsed.get("trademark"):
                proj_sets.append(f"brand = {esc(parsed['trademark'])}")
            if parsed.get("legal_name") or parsed.get("short_name"):
                client_name = parsed.get("short_name") or parsed.get("legal_name")
                proj_sets.append(f"client = {esc(client_name)}")
            if parsed.get("email"):
                proj_sets.append(f"contact_person = {esc(parsed.get('director') or parsed.get('email'))}")
            cur.execute(
                f"UPDATE {SCHEMA}.client_projects SET {', '.join(proj_sets)} "
                f"WHERE id = {esc(project_id)}"
            )

            conn.commit()

            cur.execute(
                f"SELECT {', '.join(CLIENT_CARD_COLS)} FROM {SCHEMA}.project_client_cards WHERE id = {esc(cid)}"
            )
            row = cur.fetchone()
            return resp(200, {
                "card": row_to_dict(row, CLIENT_CARD_COLS),
                "card_status": card_status,
                "file_url": file_url,
            })

        # ─── DELETE — удалить карточку ───
        if method == "DELETE":
            cur.execute(
                f"DELETE FROM {SCHEMA}.project_client_cards WHERE project_id = {esc(project_id)}"
            )
            conn.commit()
            return resp(200, {"deleted": project_id})

        return resp(405, {"error": "Метод не поддерживается"})

    except Exception as e:
        conn.rollback()
        return resp(500, {"error": str(e)})
    finally:
        cur.close()
        conn.close()
