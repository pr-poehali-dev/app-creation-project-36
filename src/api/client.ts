const ORDERS_URL = 'https://functions.poehali.dev/9219b44f-8281-497f-a1ba-dffc09e79a90';
const BATCHES_URL = 'https://functions.poehali.dev/cd44fb15-1abb-46a6-95b3-7bc41c9bd733';

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
  created_at: string;
  updated_at: string;
}

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
    request<{ order: OrderFromDB; batch: BatchFromDB }>(`${ORDERS_URL}/`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  update: (id: string, data: Partial<OrderCreatePayload> & { status?: string }) =>
    request<OrderFromDB>(`${ORDERS_URL}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  delete: (id: string) =>
    request<{ deleted: string }>(`${ORDERS_URL}/${id}`, { method: 'DELETE' }),
};

export const batchesApi = {
  list: (lineId?: string) => {
    const qs = lineId ? `?line_id=${lineId}` : '';
    return request<BatchFromDB[]>(`${BATCHES_URL}/${qs}`);
  },
};
