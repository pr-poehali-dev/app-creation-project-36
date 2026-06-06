import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import { ordersApi, type OrderFromDB, type OrderCreatePayload } from '@/api/client';
import OrderForm from '@/components/orders/OrderForm';

const STATUS_FLOW = [
  'new', 'check_materials', 'ready', 'in_production', 'produced', 'in_stock', 'shipped'
];

const STATUS_LABELS: Record<string, string> = {
  new: 'Новый',
  check_materials: 'Проверка сырья',
  ready: 'Готов к пр-ву',
  in_production: 'В производстве',
  produced: 'Произведён',
  in_stock: 'На складе',
  shipped: 'Отгружен',
};

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-slate-500/20 text-slate-300',
  check_materials: 'bg-yellow-500/20 text-yellow-300',
  ready: 'bg-cyan-500/20 text-cyan-300',
  in_production: 'bg-violet-500/20 text-violet-300',
  produced: 'bg-emerald-500/20 text-emerald-300',
  in_stock: 'bg-blue-500/20 text-blue-300',
  shipped: 'bg-orange-500/20 text-orange-300',
};

const CAN_FORMATS: Record<string, string> = { '0.33': '0.33 л', '0.45': '0.45 л', '0.5': '0.5 л' };
const PACK_TYPES: Record<string, string> = { sleeve: 'Sleeve', litography: 'Литография' };
const LINE_NAMES: Record<string, string> = { 'line-1': 'Линия №1', 'line-2': 'Линия №2', 'line-3': 'Линия №3' };

// Диалог подтверждения удаления
function DeleteDialog({ order, onConfirm, onCancel, loading }: {
  order: OrderFromDB; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-red-500/30 rounded-xl w-full max-w-sm p-6 animate-slide-up shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
            <Icon name="Trash2" size={18} className="text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Удалить заказ?</h3>
            <p className="text-xs text-muted-foreground">Это действие нельзя отменить</p>
          </div>
        </div>
        <div className="bg-secondary/40 rounded-lg p-3 mb-5">
          <div className="text-sm font-medium text-foreground">{order.client}</div>
          <div className="text-xs text-muted-foreground">{order.number} · {order.sku}</div>
          <div className="text-[11px] text-red-400 mt-1.5 flex items-center gap-1">
            <Icon name="AlertTriangle" size={10} />
            Связанная партия в производстве также будет удалена
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2 rounded-md bg-secondary text-muted-foreground hover:text-foreground text-sm transition-colors">
            Отмена
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-md text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors">
            {loading ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Icon name="Trash2" size={13} />}
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
}

// Детальная карточка заказа
function OrderDetail({ order, onClose, onEdit, onDelete, onStatusChange }: {
  order: OrderFromDB;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: string) => void;
}) {
  const statusIdx = STATUS_FLOW.indexOf(order.status);
  const daysLeft = Math.ceil((new Date(order.planned_shipment_date).getTime() - Date.now()) / 86400000);
  const productionMin = order.line_speed > 0 ? Math.ceil((order.quantity / order.line_speed) * 60) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up shadow-2xl">
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <div className="font-mono-vpk text-xs text-primary mb-1">{order.number}</div>
            <h2 className="text-lg font-bold text-foreground">{order.client}</h2>
            <div className="text-sm text-muted-foreground">{order.drink_name} · {order.sku}</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="w-8 h-8 rounded-md bg-secondary/50 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors">
              <Icon name="Pencil" size={13} />
            </button>
            <button onClick={onDelete} className="w-8 h-8 rounded-md bg-secondary/50 flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors">
              <Icon name="Trash2" size={13} />
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-md bg-secondary/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
              <Icon name="X" size={15} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Progress pipeline */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Прогресс</div>
            <div className="flex items-center gap-0">
              {STATUS_FLOW.map((s, i) => (
                <div key={s} className="flex items-center flex-1 last:flex-none">
                  <button
                    onClick={() => onStatusChange(s)}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all hover:scale-110 ${
                      i < statusIdx ? 'bg-primary text-primary-foreground' :
                      i === statusIdx ? 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-1 ring-offset-card' :
                      'bg-secondary border border-border text-muted-foreground hover:border-primary/40'
                    }`}
                    title={STATUS_LABELS[s]}
                  >
                    {i < statusIdx ? <Icon name="Check" size={10} /> : i + 1}
                  </button>
                  {i < STATUS_FLOW.length - 1 && (
                    <div className={`flex-1 h-px mx-0.5 transition-colors ${i < statusIdx ? 'bg-primary' : 'bg-border'}`} />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1.5">
              {STATUS_FLOW.map((s, i) => (
                <div key={s} className={`text-[9px] text-center leading-tight ${i === statusIdx ? 'text-primary font-semibold' : 'text-muted-foreground'}`}
                  style={{ width: `${100 / STATUS_FLOW.length}%` }}>
                  {STATUS_LABELS[s]}
                </div>
              ))}
            </div>
          </div>

          {/* Параметры */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Объём', value: `${order.quantity.toLocaleString('ru')} шт` },
              { label: 'Формат', value: `${CAN_FORMATS[order.can_format] || order.can_format} · ${PACK_TYPES[order.packaging_type] || order.packaging_type}` },
              { label: 'Линия', value: LINE_NAMES[order.line_id] || order.line_id },
              { label: 'Скорость', value: `${order.line_speed.toLocaleString('ru')} /ч` },
              { label: 'Время пр-ва', value: `${Math.floor(productionMin / 60)}ч ${productionMin % 60}м` },
              { label: 'Мойка', value: `${order.cleaning_time} мин` },
              { label: 'Дата пр-ва', value: new Date(order.planned_production_date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' }) },
              { label: 'Дата отгрузки', value: `${new Date(order.planned_shipment_date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })} (${daysLeft > 0 ? `через ${daysLeft}д` : 'просрочен'})`, highlight: daysLeft <= 3 },
            ].map(({ label, value, highlight }) => (
              <div key={label} className="bg-secondary/40 rounded-md p-2.5">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
                <div className={`text-xs font-medium mt-0.5 ${highlight ? 'text-red-400' : 'text-foreground'}`}>{value}</div>
              </div>
            ))}
          </div>

          {order.manager && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon name="User" size={12} />
              <span>Менеджер: <span className="text-foreground">{order.manager}</span></span>
            </div>
          )}
          {order.comment && (
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-md p-3 text-xs text-yellow-200 flex gap-2">
              <Icon name="MessageSquare" size={13} className="text-yellow-400 shrink-0 mt-0.5" />
              {order.comment}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Orders({ search }: { search: string }) {
  const [orders, setOrders] = useState<OrderFromDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OrderFromDB | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editOrder, setEditOrder] = useState<OrderFromDB | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrderFromDB | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (dateFilter) params.production_date = dateFilter;
      const data = await ordersApi.list(params);
      setOrders(data);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, dateFilter]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (data: OrderCreatePayload) => {
    await ordersApi.create(data);
    await load();
  };

  const handleEdit = async (data: OrderCreatePayload) => {
    if (!editOrder) return;
    await ordersApi.update(editOrder.id, data);
    await load();
    setSelected(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await ordersApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      setSelected(null);
      await load();
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleStatusChange = async (order: OrderFromDB, status: string) => {
    await ordersApi.update(order.id, { status });
    await load();
    if (selected?.id === order.id) {
      setSelected(prev => prev ? { ...prev, status } : null);
    }
  };

  const statuses = ['all', ...STATUS_FLOW];

  const daysLeft = (date: string) => Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);

  return (
    <div className="p-6 animate-fade-in">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex flex-wrap gap-1.5">
          {statuses.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              {s === 'all' ? 'Все' : STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            className="bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
          {dateFilter && (
            <button onClick={() => setDateFilter('')} className="text-muted-foreground hover:text-foreground">
              <Icon name="X" size={14} />
            </button>
          )}
          <button onClick={() => { setEditOrder(null); setShowForm(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:bg-primary/90 transition-colors">
            <Icon name="Plus" size={13} />
            Новый заказ
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-secondary/40 border-b border-border">
              {['Номер', 'Клиент', 'Напиток / SKU', 'Линия', 'Объём', 'Дата пр-ва', 'Отгрузка', 'Статус', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-12 text-muted-foreground text-sm">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  Загрузка...
                </div>
              </td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-muted-foreground text-sm">
                <Icon name="ClipboardList" size={32} className="mx-auto mb-2 opacity-30" />
                <div>Заказов нет</div>
                <button onClick={() => setShowForm(true)} className="mt-3 text-primary text-xs hover:underline">
                  Создать первый заказ →
                </button>
              </td></tr>
            ) : orders.map(o => {
              const dl = daysLeft(o.planned_shipment_date);
              const isUrgent = dl <= 3;
              return (
                <tr key={o.id} onClick={() => setSelected(o)}
                  className="table-row-hover cursor-pointer border-b border-border/40">
                  <td className="px-4 py-3">
                    <div className="font-mono-vpk text-xs text-primary">{o.number}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-foreground">{o.client}</div>
                    {o.manager && <div className="text-[10px] text-muted-foreground">{o.manager}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-foreground">{o.drink_name}</div>
                    <div className="text-[10px] text-muted-foreground">{o.sku} · {CAN_FORMATS[o.can_format] || o.can_format}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-muted-foreground">{LINE_NAMES[o.line_id] || o.line_id}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-mono-vpk text-sm text-foreground">{o.quantity.toLocaleString('ru')}</span>
                    <span className="text-[10px] text-muted-foreground ml-1">шт</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-muted-foreground font-mono-vpk">
                      {new Date(o.planned_production_date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className={`text-xs font-mono-vpk ${isUrgent ? 'text-red-400 font-bold' : 'text-muted-foreground'}`}>
                      {new Date(o.planned_shipment_date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
                    </div>
                    {isUrgent && dl > 0 && <div className="text-[10px] text-red-400">через {dl}д</div>}
                    {dl <= 0 && <div className="text-[10px] text-red-500 font-bold">просрочен</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`status-badge ${STATUS_COLORS[o.status] || 'bg-slate-500/20 text-slate-300'}`}>
                      {STATUS_LABELS[o.status] || o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => { setEditOrder(o); setShowForm(true); }}
                        className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-secondary transition-colors">
                        <Icon name="Pencil" size={12} />
                      </button>
                      <button onClick={() => setDeleteTarget(o)}
                        className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-secondary transition-colors">
                        <Icon name="Trash2" size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!loading && orders.length > 0 && (
        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
          <span>Показано {orders.length} заказов</span>
          <span className="font-mono-vpk">
            Итого: {orders.reduce((s, o) => s + o.quantity, 0).toLocaleString('ru')} шт
          </span>
        </div>
      )}

      {/* Форма создания / редактирования */}
      {showForm && (
        <OrderForm
          mode={editOrder ? 'edit' : 'create'}
          initial={editOrder ? {
            client: editOrder.client,
            drink_name: editOrder.drink_name,
            sku: editOrder.sku,
            can_format: editOrder.can_format,
            packaging_type: editOrder.packaging_type,
            quantity: editOrder.quantity,
            planned_production_date: editOrder.planned_production_date,
            planned_shipment_date: editOrder.planned_shipment_date,
            line_id: editOrder.line_id,
            line_speed: editOrder.line_speed,
            cleaning_time: editOrder.cleaning_time,
            manager: editOrder.manager,
            comment: editOrder.comment,
          } : undefined}
          onClose={() => { setShowForm(false); setEditOrder(null); }}
          onSaved={() => { setShowForm(false); setEditOrder(null); }}
          onSubmit={editOrder ? handleEdit : handleCreate}
        />
      )}

      {/* Детальная карточка */}
      {selected && !showForm && (
        <OrderDetail
          order={selected}
          onClose={() => setSelected(null)}
          onEdit={() => { setEditOrder(selected); setShowForm(true); }}
          onDelete={() => setDeleteTarget(selected)}
          onStatusChange={(status) => handleStatusChange(selected, status)}
        />
      )}

      {/* Диалог удаления */}
      {deleteTarget && (
        <DeleteDialog
          order={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}
