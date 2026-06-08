export type OrderStatus =
  | 'new'
  | 'confirmed'
  | 'in_production'
  | 'produced'
  | 'shipped';

export type BatchStatus =
  | 'new'
  | 'raw_ordered'
  | 'raw_in_stock'
  | 'ready'
  | 'in_progress'
  | 'produced'
  | 'shipped';

export type QualityStatus = 'pending' | 'approved' | 'rejected' | 'in_lab';

export interface Client {
  id: string;
  name: string;
  contact?: string;
  phone?: string;
}

export interface SKU {
  id: string;
  name: string;
  volume: number;
  type: string;
}

export interface Order {
  id: string;
  number: string;
  client: string;
  sku: string;
  volume: number;
  deadline: string;
  status: OrderStatus;
  notes?: string;
  createdAt: string;
}

export interface Downtime {
  id: string;
  reason: string;
  minutes: number;
  color?: string;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface Checklist {
  ds: boolean;
  rc: boolean;
  ukladka: boolean;
  shk: boolean;
  lab: boolean;
  declaration: boolean;
}

export interface Line {
  id: string;
  name: string;
  startTime: string;
  speed: number;
}

export interface Batch {
  id: string;
  name: string;
  client: string;
  sku: string;
  quantity: number;
  speed: number;
  cleaningTime: number;
  lineId: string;
  color?: string;
  status: BatchStatus;
  downtimes: Downtime[];
  checklist: Checklist;
  comments: Comment[];
  orderId?: string;
}

export interface RawMaterial {
  id: string;
  name: string;
  unit: string;
  stock: number;
  reserved: number;
  minStock: number;
  pricePerUnit: number;
}

export interface StockItem {
  id: string;
  name: string;
  type: 'raw' | 'finished' | 'packaging';
  quantity: number;
  unit: string;
  location?: string;
  lastUpdated: string;
}

export interface StockMovement {
  id: string;
  itemId: string;
  itemName: string;
  type: 'in' | 'out' | 'reserve';
  quantity: number;
  date: string;
  reason: string;
  operator: string;
}

export interface LabResult {
  id: string;
  batchId: string;
  batchName: string;
  date: string;
  brix: number;
  acidity: number;
  co2: number;
  taste: 'good' | 'acceptable' | 'bad';
  status: QualityStatus;
  analyst: string;
  notes?: string;
}

export interface Shipment {
  id: string;
  orderId: string;
  client: string;
  date: string;
  quantity: number;
  pallets: number;
  transport: string;
  driver?: string;
  status: 'planned' | 'loading' | 'shipped' | 'delivered';
  documents: {
    invoice: boolean;
    waybill: boolean;
    certificate: boolean;
  };
}

export type AppSection =
  | 'dashboard'
  | 'orders'
  | 'production'
  | 'materials'
  | 'warehouse'
  | 'quality'
  | 'shipments'
  | 'clients';