import type {
  Order, Batch, Line, RawMaterial, StockItem, StockMovement, LabResult, Shipment
} from '@/types/erp';

export const MOCK_LINES: Line[] = [
  { id: 'line-1', name: 'Линия №1', startTime: '2026-06-06T06:00:00', speed: 2000 },
  { id: 'line-2', name: 'Линия №2', startTime: '2026-06-06T07:00:00', speed: 1800 },
  { id: 'line-3', name: 'Линия №3', startTime: '2026-06-06T08:00:00', speed: 2400 },
];

export const MOCK_ORDERS: Order[] = [
  {
    id: 'ord-001', number: 'ЗКЗ-2026-081',
    client: 'X5 Retail Group', sku: 'Лимонад Классик 0.33л',
    volume: 48000, deadline: '2026-06-10', status: 'in_production',
    createdAt: '2026-06-01', notes: 'Приоритетный заказ'
  },
  {
    id: 'ord-002', number: 'ЗКЗ-2026-082',
    client: 'Магнит', sku: 'Газировка Апельсин 0.5л',
    volume: 72000, deadline: '2026-06-15', status: 'confirmed',
    createdAt: '2026-06-02'
  },
  {
    id: 'ord-003', number: 'ЗКЗ-2026-083',
    client: 'Лента', sku: 'Тоник Классик 0.33л',
    volume: 36000, deadline: '2026-06-18', status: 'new',
    createdAt: '2026-06-03'
  },
  {
    id: 'ord-004', number: 'ЗКЗ-2026-084',
    client: 'Ашан', sku: 'Энергетик Citrus 0.5л',
    volume: 24000, deadline: '2026-06-20', status: 'produced',
    createdAt: '2026-05-30'
  },
  {
    id: 'ord-005', number: 'ЗКЗ-2026-085',
    client: 'ВкусВилл', sku: 'Морс Клюква 0.5л',
    volume: 18000, deadline: '2026-06-25', status: 'new',
    createdAt: '2026-06-04'
  },
];

export const MOCK_BATCHES: Batch[] = [
  {
    id: 'b-001', name: 'Лимонад Классик — X5',
    client: 'X5 Retail Group', sku: 'Лимонад Классик 0.33л',
    quantity: 48000, speed: 2000, cleaningTime: 30,
    lineId: 'line-1', color: '#0ea5e9', status: 'in_progress',
    downtimes: [{ id: 'd1', reason: 'Замена крышки', minutes: 15, color: '#f59e0b' }],
    checklist: { ds: true, rc: true, ukladka: true, shk: false, lab: true, declaration: false },
    comments: [
      { id: 'c1', author: 'Петров А.', text: 'Сырьё завезено, можем стартовать', createdAt: '2026-06-06T07:30:00' },
      { id: 'c2', author: 'Технолог Смирнова', text: 'РЦ согласована, добро на запуск', createdAt: '2026-06-06T08:00:00' }
    ],
    orderId: 'ord-001'
  },
  {
    id: 'b-002', name: 'Газировка Апельсин — Магнит',
    client: 'Магнит', sku: 'Газировка Апельсин 0.5л',
    quantity: 72000, speed: 1800, cleaningTime: 45,
    lineId: 'line-2', color: '#f97316', status: 'ready',
    downtimes: [],
    checklist: { ds: true, rc: true, ukladka: false, shk: false, lab: false, declaration: false },
    comments: [{ id: 'c3', author: 'Менеджер Иванов', text: 'Срок критичный — нужен запуск 07.06', createdAt: '2026-06-05T16:00:00' }],
    orderId: 'ord-002'
  },
  {
    id: 'b-003', name: 'Тоник Классик — Лента',
    client: 'Лента', sku: 'Тоник Классик 0.33л',
    quantity: 36000, speed: 2400, cleaningTime: 30,
    lineId: 'line-3', color: '#8b5cf6', status: 'raw_in_stock',
    downtimes: [],
    checklist: { ds: false, rc: false, ukladka: false, shk: false, lab: false, declaration: false },
    comments: [],
    orderId: 'ord-003'
  },
  {
    id: 'b-004', name: 'Энергетик Citrus — Ашан',
    client: 'Ашан', sku: 'Энергетик Citrus 0.5л',
    quantity: 24000, speed: 2000, cleaningTime: 60,
    lineId: 'line-1', color: '#22c55e', status: 'produced',
    downtimes: [{ id: 'd2', reason: 'Технический сбой', minutes: 45, color: '#ef4444' }],
    checklist: { ds: true, rc: true, ukladka: true, shk: true, lab: true, declaration: true },
    comments: [],
    orderId: 'ord-004'
  },
];

export const MOCK_MATERIALS: RawMaterial[] = [
  { id: 'm-001', name: 'Банка алюминиевая 0.33л', unit: 'шт', stock: 250000, reserved: 48000, minStock: 50000, pricePerUnit: 4.2 },
  { id: 'm-002', name: 'Банка алюминиевая 0.5л', unit: 'шт', stock: 180000, reserved: 72000, minStock: 50000, pricePerUnit: 5.8 },
  { id: 'm-003', name: 'Крышка Pull-tab', unit: 'шт', stock: 430000, reserved: 120000, minStock: 100000, pricePerUnit: 1.1 },
  { id: 'm-004', name: 'Сахар-песок', unit: 'кг', stock: 8500, reserved: 1200, minStock: 2000, pricePerUnit: 52 },
  { id: 'm-005', name: 'Лимонная кислота', unit: 'кг', stock: 320, reserved: 80, minStock: 100, pricePerUnit: 185 },
  { id: 'm-006', name: 'Ароматизатор «Апельсин»', unit: 'кг', stock: 45, reserved: 18, minStock: 10, pricePerUnit: 2400 },
  { id: 'm-007', name: 'CO₂ газ', unit: 'кг', stock: 1200, reserved: 300, minStock: 200, pricePerUnit: 38 },
  { id: 'm-008', name: 'Сливер термоусадочный', unit: 'рул', stock: 180, reserved: 40, minStock: 30, pricePerUnit: 1850 },
  { id: 'm-009', name: 'Вода артезианская', unit: 'м³', stock: 900, reserved: 120, minStock: 100, pricePerUnit: 12 },
  { id: 'm-010', name: 'Ароматизатор «Лимон»', unit: 'кг', stock: 8, reserved: 24, minStock: 10, pricePerUnit: 2600 },
];

export const MOCK_STOCK: StockItem[] = [
  { id: 's-001', name: 'Лимонад Классик 0.33л (готовая)', type: 'finished', quantity: 24000, unit: 'шт', location: 'Склад А, ряд 3', lastUpdated: '2026-06-06T10:00:00' },
  { id: 's-002', name: 'Энергетик Citrus 0.5л (готовая)', type: 'finished', quantity: 24000, unit: 'шт', location: 'Склад А, ряд 5', lastUpdated: '2026-06-05T18:00:00' },
  { id: 's-003', name: 'Банка 0.33л', type: 'packaging', quantity: 250000, unit: 'шт', location: 'Склад Б, ряд 1', lastUpdated: '2026-06-04T09:00:00' },
  { id: 's-004', name: 'Банка 0.5л', type: 'packaging', quantity: 180000, unit: 'шт', location: 'Склад Б, ряд 2', lastUpdated: '2026-06-04T09:00:00' },
  { id: 's-005', name: 'Сахар-песок', type: 'raw', quantity: 8500, unit: 'кг', location: 'Склад В', lastUpdated: '2026-06-03T11:00:00' },
];

export const MOCK_MOVEMENTS: StockMovement[] = [
  { id: 'mv-001', itemId: 's-001', itemName: 'Лимонад Классик 0.33л', type: 'in', quantity: 24000, date: '2026-06-06T10:00:00', reason: 'Производство партии b-001', operator: 'Петров А.' },
  { id: 'mv-002', itemId: 's-003', itemName: 'Банка 0.33л', type: 'out', quantity: 48000, date: '2026-06-06T06:30:00', reason: 'Запуск линии №1', operator: 'Оператор Козлов' },
  { id: 'mv-003', itemId: 's-004', itemName: 'Банка 0.5л', type: 'reserve', quantity: 72000, date: '2026-06-05T15:00:00', reason: 'Резерв под заказ ЗКЗ-2026-082', operator: 'Логист Орлова' },
  { id: 'mv-004', itemId: 's-005', itemName: 'Сахар-песок', type: 'in', quantity: 2000, date: '2026-06-04T09:00:00', reason: 'Поступление от поставщика', operator: 'Склад' },
];

export const MOCK_LAB: LabResult[] = [
  { id: 'lab-001', batchId: 'b-001', batchName: 'Лимонад Классик — X5', date: '2026-06-06T09:00:00', brix: 10.2, acidity: 3.8, co2: 6.1, taste: 'good', status: 'approved', analyst: 'Смирнова Е.', notes: 'Все параметры в норме' },
  { id: 'lab-002', batchId: 'b-002', batchName: 'Газировка Апельсин — Магнит', date: '2026-06-05T14:00:00', brix: 11.5, acidity: 4.1, co2: 5.8, taste: 'acceptable', status: 'approved', analyst: 'Смирнова Е.' },
  { id: 'lab-003', batchId: 'b-003', batchName: 'Тоник Классик — Лента', date: '2026-06-06T11:00:00', brix: 0, acidity: 0, co2: 0, taste: 'good', status: 'pending', analyst: '—' },
  { id: 'lab-004', batchId: 'b-004', batchName: 'Энергетик Citrus — Ашан', date: '2026-06-05T10:00:00', brix: 9.8, acidity: 3.5, co2: 6.5, taste: 'good', status: 'approved', analyst: 'Новикова М.' },
];

export const MOCK_SHIPMENTS: Shipment[] = [
  {
    id: 'sh-001', orderId: 'ord-004', client: 'Ашан',
    date: '2026-06-07', quantity: 24000, pallets: 8,
    transport: 'КАМАЗ А123ВС77', driver: 'Иванов П.П.',
    status: 'planned',
    documents: { invoice: true, waybill: false, certificate: true }
  },
  {
    id: 'sh-002', orderId: 'ord-001', client: 'X5 Retail Group',
    date: '2026-06-10', quantity: 48000, pallets: 16,
    transport: 'Газель М456НО77', driver: 'Сидоров К.В.',
    status: 'planned',
    documents: { invoice: false, waybill: false, certificate: false }
  },
];

export const STATUS_LABELS: Record<string, string> = {
  new: 'Новый',
  confirmed: 'Подтверждён',
  in_production: 'В производстве',
  produced: 'Произведён',
  shipped: 'Отгружен',
  raw_ordered: 'Сырьё заказано',
  raw_in_stock: 'Сырьё на складе',
  ready: 'Готов к пр-ву',
  in_progress: 'В работе',
  pending: 'Ожидание',
  approved: 'Допущен',
  rejected: 'Отклонён',
  in_lab: 'В лаборатории',
  planned: 'Запланировано',
  loading: 'Погрузка',
  delivered: 'Доставлен',
};

export const STATUS_COLORS: Record<string, string> = {
  new: 'bg-slate-500/20 text-slate-300',
  confirmed: 'bg-blue-500/20 text-blue-300',
  in_production: 'bg-purple-500/20 text-purple-300',
  produced: 'bg-emerald-500/20 text-emerald-300',
  shipped: 'bg-orange-500/20 text-orange-300',
  raw_ordered: 'bg-yellow-500/20 text-yellow-300',
  raw_in_stock: 'bg-teal-500/20 text-teal-300',
  ready: 'bg-cyan-500/20 text-cyan-300',
  in_progress: 'bg-violet-500/20 text-violet-300',
  pending: 'bg-slate-500/20 text-slate-300',
  approved: 'bg-emerald-500/20 text-emerald-300',
  rejected: 'bg-red-500/20 text-red-300',
  in_lab: 'bg-blue-500/20 text-blue-300',
  planned: 'bg-cyan-500/20 text-cyan-300',
  loading: 'bg-orange-500/20 text-orange-300',
  delivered: 'bg-emerald-500/20 text-emerald-300',
};
