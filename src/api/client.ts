const ORDERS_URL = 'https://functions.poehali.dev/9219b44f-8281-497f-a1ba-dffc09e79a90';
const BATCHES_URL = 'https://functions.poehali.dev/cd44fb15-1abb-46a6-95b3-7bc41c9bd733';
const MATERIALS_URL = 'https://functions.poehali.dev/7c14d9a2-e67f-4257-a70f-5cd1aab59c85';
const REORDER_URL = 'https://functions.poehali.dev/cd57421d-4b23-45e6-8c75-267ca44c0c73';

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface OrderFromDB {
  id: string;
  number: string;
  client: string;
  drink_name: string;
  sku: string;
  can_format: string;
  packaging_type: string;
  quantity: number;
  planned_production_date: string;
  planned_shipment_date: string;
  line_id: string;
  line_speed: number;
  cleaning_time: number;
  manager: string;
  comment: string;
  status: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface BatchFromDB {
  id: string;
  order_id: string;
  name: string;
  client: string;
  sku: string;
  quantity: number;
  speed: number;
  cleaning_time: number;
  line_id: string;
  color: string;
  status: string;
  start_time: string;
  end_time: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}


export interface MaterialFromDB {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  reserved: number;
  available: number;
  min_stock: number;
  supplier: string;
  next_delivery_date: string | null;
  price_per_unit: number;
  created_at: string;
  updated_at: string;
}

export interface MaterialCheckItem {
  material_id: string;
  name: string;
  unit: string;
  needed: number;
  reserved: number;
  shortage: number;
  status: 'ok' | 'shortage';
  stock: number;
  mat_reserved: number;
}

export interface MaterialCheckResult {
  order_id: string;
  all_available: boolean | null;
  shortage_count: number;
  checked_at: string | null;
  items: MaterialCheckItem[];
}

export interface ReorderBatchesPayload {
  batch_id: string;
  new_line_id: string;
  ordered_ids: string[];
  old_line_id?: string;
}

export interface ReorderResult {
  updated_new_line: BatchFromDB[];
  updated_old_line: BatchFromDB[];
}

export const reorderApi = {
  batches: (payload: ReorderBatchesPayload) =>
    request<ReorderResult>(`${REORDER_URL}/?action=batches`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  orders: (orderedIds: string[]) =>
    request<{ updated: number }>(`${REORDER_URL}/?action=orders`, {
      method: 'POST',
      body: JSON.stringify({ ordered_ids: orderedIds }),
    }),
  moveToProduction: (orderId: string, lineId: string, position?: number) =>
    request<{ batch_id: string; updated_line: BatchFromDB[] }>(`${REORDER_URL}/?action=move-to-production`, {
      method: 'POST',
      body: JSON.stringify({ order_id: orderId, line_id: lineId, position }),
    }),
  removeFromProduction: (batchId: string) =>
    request<{ removed: string; updated_line: BatchFromDB[] }>(`${REORDER_URL}/?action=remove-from-production`, {
      method: 'POST',
      body: JSON.stringify({ batch_id: batchId }),
    }),
};

export interface OrderCreatePayload {
  client: string;
  drink_name: string;
  sku: string;
  can_format: string;
  packaging_type: string;
  quantity: number;
  planned_production_date: string;
  planned_shipment_date: string;
  line_id: string;
  line_speed: number;
  cleaning_time: number;
  manager: string;
  comment: string;
}

export const ordersApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<OrderFromDB[]>(`${ORDERS_URL}/${qs}`);
  },
  get: (id: string) => request<OrderFromDB>(`${ORDERS_URL}/${id}`),
  create: (data: OrderCreatePayload) =>
    request<{ order: OrderFromDB; batch: BatchFromDB; materials: { all_available: boolean; shortage_count: number; status: string } }>(
      `${ORDERS_URL}/`, { method: 'POST', body: JSON.stringify(data) }
    ),
  update: (id: string, data: Partial<OrderCreatePayload> & { status?: string }) =>
    request<OrderFromDB>(`${ORDERS_URL}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ deleted: string }>(`${ORDERS_URL}/${id}`, { method: 'DELETE' }),
};

export const batchesApi = {
  list: (lineId?: string) => {
    const qs = lineId ? `?line_id=${lineId}` : '';
    return request<BatchFromDB[]>(`${BATCHES_URL}/${qs}`);
  },
};

export const materialsApi = {
  list: () => request<MaterialFromDB[]>(`${MATERIALS_URL}/`),
  check: (orderId: string) =>
    request<MaterialCheckResult>(`${MATERIALS_URL}/check?order_id=${orderId}`),
  recheck: (orderId: string, quantity: number, canFormat: string, packagingType: string) =>
    request<{ all_available: boolean; shortage_count: number; order_status: string; items: MaterialCheckItem[] }>(
      `${MATERIALS_URL}/check`, {
        method: 'POST',
        body: JSON.stringify({ order_id: orderId, quantity, can_format: canFormat, packaging_type: packagingType }),
      }
    ),
  update: (id: string, data: Partial<{ stock: number; min_stock: number; supplier: string; next_delivery_date: string }>) =>
    request<MaterialFromDB>(`${MATERIALS_URL}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};