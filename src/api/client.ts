const ORDERS_URL = 'https://functions.poehali.dev/9219b44f-8281-497f-a1ba-dffc09e79a90';
const BATCHES_URL = 'https://functions.poehali.dev/cd44fb15-1abb-46a6-95b3-7bc41c9bd733';
const MATERIALS_URL = 'https://functions.poehali.dev/7c14d9a2-e67f-4257-a70f-5cd1aab59c85';
const REORDER_URL = 'https://functions.poehali.dev/cd57421d-4b23-45e6-8c75-267ca44c0c73';
const CLIENTS_URL = 'https://functions.poehali.dev/82312fbf-ba01-4806-8336-278f71717014';
const UPLOAD_CARD_URL = 'https://functions.poehali.dev/38449307-3585-45a0-91e6-57c61e5ab855';

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

// ─── Client Projects types ───────────────────────────────────────────────────

export interface ClientProject {
  id: string;
  number: string;
  client: string;
  brand: string | null;
  drink_name: string;
  flavor: string | null;
  can_volume: string | null;
  can_format: string | null;
  label_type: string | null;
  sku_count: number;
  batch_volume: number | null;
  contact_person: string | null;
  manager: string | null;
  deadline: string | null;
  comment: string | null;
  stage: string;
  readiness_pct: number;
  is_ready: boolean;
  production_order_id: string | null;
  created_at: string;
  updated_at: string;
  readiness?: ProjectReadiness | null;
}

export interface ProjectReadiness {
  id: string;
  project_id: string;
  recipe_approved: boolean;
  raw_ordered: boolean;
  raw_delivered: boolean;
  design_at_factory: boolean;
  can_shipped: boolean;
  declaration_ready: boolean;
  samples_sent: boolean;
  client_approved: boolean;
  updated_at: string;
}

export interface ProjectRecipeItem {
  id: string;
  project_id: string;
  ingredient: string;
  dosage: number;
  unit: string;
  supplier: string | null;
  price_per_unit: number | null;
  lead_days: number | null;
  order_idx: number;
  created_at: string;
}

export interface ProjectDesign {
  id: string;
  project_id: string;
  version: string;
  file_name: string | null;
  file_url: string | null;
  recognized_text: string | null;
  status: string;
  uploaded_by: string | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectFactorySetup {
  id: string;
  project_id: string;
  factory: string;
  sent_at: string | null;
  responsible: string | null;
  planned_ready: string | null;
  actual_ready: string | null;
  status: string;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectDeclaration {
  id: string;
  project_id: string;
  decl_type: string;
  samples_sent_at: string | null;
  docs_submitted_at: string | null;
  planned_ready: string | null;
  actual_ready: string | null;
  status: string;
  lab: string | null;
  tracking_number: string | null;
  file_url: string | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectPurchase {
  id: string;
  project_id: string;
  ingredient: string;
  needed: number | null;
  in_stock: number;
  reserved: number;
  shortage: number | null;
  unit: string | null;
  supplier: string | null;
  status: string;
  order_date: string | null;
  planned_delivery: string | null;
  actual_delivery: string | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectCan {
  id: string;
  project_id: string;
  factory: string;
  can_format: string | null;
  can_volume: string | null;
  design_sent_at: string | null;
  design_registered_at: string | null;
  can_ordered_at: string | null;
  planned_shipment: string | null;
  actual_shipment: string | null;
  status: string;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectClientCard {
  id: string;
  project_id: string;
  file_name: string | null;
  file_url: string | null;
  legal_name: string | null;
  short_name: string | null;
  location: string | null;
  legal_address: string | null;
  director: string | null;
  email: string | null;
  trademark: string | null;
  ds_type: string | null;
  pallet_scheme: string | null;
  can_label_type: string | null;
  can_color: string | null;
  lid_color: string | null;
  doc_comment: string | null;
  card_status: string;
  skus: SkuRow[] | null;
  parsed_data: Record<string, string> | null;
  uploaded_at: string | null;
  uploaded_by: string | null;
  updated_at: string | null;
}

export interface SkuRow {
  num: string;
  name: string;
  gost: string;
  barcode_unit: string;
  barcode_12x: string;
}

export const clientCardApi = {
  get: (projectId: string) =>
    request<ProjectClientCard | null>(`${UPLOAD_CARD_URL}/${projectId}`),
  upload: (projectId: string, payload: {
    file_name?: string;
    file_b64?: string;
    parsed_data: Record<string, string>;
    skus: SkuRow[];
    uploaded_by?: string;
  }) =>
    request<{ card: ProjectClientCard; card_status: string; file_url: string | null }>(
      `${UPLOAD_CARD_URL}/${projectId}`,
      { method: 'POST', body: JSON.stringify(payload) }
    ),
  remove: (projectId: string) =>
    request<{ deleted: string }>(`${UPLOAD_CARD_URL}/${projectId}`, { method: 'DELETE' }),
};

export const clientProjectsApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<ClientProject[]>(`${CLIENTS_URL}/${qs}`);
  },
  get: (id: string) => request<ClientProject>(`${CLIENTS_URL}/${id}`),
  create: (data: Partial<ClientProject>) =>
    request<ClientProject>(`${CLIENTS_URL}/`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<ClientProject>) =>
    request<ClientProject>(`${CLIENTS_URL}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<{ deleted: string }>(`${CLIENTS_URL}/${id}`, { method: 'DELETE' }),

  // Sub-resources
  getRecipe: (id: string) => request<ProjectRecipeItem[]>(`${CLIENTS_URL}/${id}/recipe`),
  addRecipeItem: (id: string, item: Partial<ProjectRecipeItem>) =>
    request<ProjectRecipeItem>(`${CLIENTS_URL}/${id}/recipe`, { method: 'POST', body: JSON.stringify(item) }),
  deleteRecipeItem: (id: string, itemId: string) =>
    request<{ deleted: string }>(`${CLIENTS_URL}/${id}/recipe`, {
      method: 'DELETE', body: JSON.stringify({ item_id: itemId }),
    }),

  getDesigns: (id: string) => request<ProjectDesign[]>(`${CLIENTS_URL}/${id}/design`),
  createDesign: (id: string, data: Partial<ProjectDesign>) =>
    request<ProjectDesign>(`${CLIENTS_URL}/${id}/design`, { method: 'POST', body: JSON.stringify(data) }),
  updateDesign: (id: string, data: Partial<ProjectDesign> & { design_id: string }) =>
    request<ProjectDesign>(`${CLIENTS_URL}/${id}/design`, { method: 'PUT', body: JSON.stringify(data) }),

  getFactorySetup: (id: string) => request<ProjectFactorySetup>(`${CLIENTS_URL}/${id}/factory-setup`),
  saveFactorySetup: (id: string, data: Partial<ProjectFactorySetup>) =>
    request<ProjectFactorySetup>(`${CLIENTS_URL}/${id}/factory-setup`, { method: 'POST', body: JSON.stringify(data) }),

  getDeclaration: (id: string) => request<ProjectDeclaration>(`${CLIENTS_URL}/${id}/declaration`),
  saveDeclaration: (id: string, data: Partial<ProjectDeclaration>) =>
    request<ProjectDeclaration>(`${CLIENTS_URL}/${id}/declaration`, { method: 'POST', body: JSON.stringify(data) }),

  getPurchases: (id: string) => request<ProjectPurchase[]>(`${CLIENTS_URL}/${id}/purchases`),
  savePurchase: (id: string, data: Partial<ProjectPurchase>) =>
    request<ProjectPurchase>(`${CLIENTS_URL}/${id}/purchases`, { method: 'POST', body: JSON.stringify(data) }),

  getCan: (id: string) => request<ProjectCan>(`${CLIENTS_URL}/${id}/can`),
  saveCan: (id: string, data: Partial<ProjectCan>) =>
    request<ProjectCan>(`${CLIENTS_URL}/${id}/can`, { method: 'POST', body: JSON.stringify(data) }),

  getReadiness: (id: string) => request<ProjectReadiness>(`${CLIENTS_URL}/${id}/readiness`),
  updateReadiness: (id: string, data: Partial<ProjectReadiness>) =>
    request<ProjectReadiness>(`${CLIENTS_URL}/${id}/readiness`, { method: 'PUT', body: JSON.stringify(data) }),

  sendToProduction: (id: string, data: { line_id: string; line_speed: number; cleaning_time: number; planned_production_date?: string; planned_shipment_date?: string }) =>
    request<{ order_id: string; batch_id: string; order_number: string }>(`${CLIENTS_URL}/${id}/send-to-production`, {
      method: 'POST', body: JSON.stringify(data),
    }),
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