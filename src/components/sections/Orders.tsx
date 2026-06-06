import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { MOCK_ORDERS, STATUS_LABELS, STATUS_COLORS } from '@/data/mockData';
import type { Order, OrderStatus } from '@/types/erp';

const STATUS_FLOW: OrderStatus[] = ['new', 'confirmed', 'in_production', 'produced', 'shipped'];

function OrderRow({ order, onSelect }: { order: Order; onSelect: () => void }) {
  const daysLeft = Math.ceil((new Date(order.deadline).getTime() - Date.now()) / 86400000);
  const isUrgent = daysLeft <= 3;

  return (
    <tr className="table-row-hover cursor-pointer border-b border-border/40" onClick={onSelect}>
      <td className="px-4 py-3">
        <div className="font-mono-vpk text-xs text-primary">{order.number}</div>
      </td>
      <td className="px-4 py-3">
        <div className="text-sm font-medium text-foreground">{order.client}</div>
      </td>
      <td className="px-4 py-3">
        <div className="text-xs text-muted-foreground">{order.sku}</div>
      </td>
      <td className="px-4 py-3 text-right">
        <span className="font-mono-vpk text-sm text-foreground">{order.volume.toLocaleString('ru')}</span>
        <span className="text-xs text-muted-foreground ml-1">шт</span>
      </td>
      <td className="px-4 py-3 text-center">
        <div className={`text-xs font-mono-vpk ${isUrgent ? 'text-red-400 font-bold' : 'text-muted-foreground'}`}>
          {new Date(order.deadline).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
        </div>
        {isUrgent && <div className="text-[10px] text-red-400">через {daysLeft}д</div>}
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`status-badge ${STATUS_COLORS[order.status]}`}>
          {STATUS_LABELS[order.status]}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <button className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors mx-auto">
          <Icon name="ChevronRight" size={14} />
        </button>
      </td>
    </tr>
  );
}

function OrderDetail({ order, onClose }: { order: Order; onClose: () => void }) {
  const statusIdx = STATUS_FLOW.indexOf(order.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg p-6 animate-slide-up">
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="font-mono-vpk text-xs text-primary mb-1">{order.number}</div>
            <h2 className="text-lg font-bold text-foreground">{order.client}</h2>
            <div className="text-sm text-muted-foreground">{order.sku}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground">
            <Icon name="X" size={15} />
          </button>
        </div>

        {/* Progress steps */}
        <div className="mb-5">
          <div className="flex items-center gap-0">
            {STATUS_FLOW.map((s, i) => (
              <div key={s} className="flex items-center flex-1 last:flex-none">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${i <= statusIdx ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                  {i < statusIdx ? <Icon name="Check" size={10} /> : i + 1}
                </div>
                {i < STATUS_FLOW.length - 1 && (
                  <div className={`flex-1 h-px mx-1 ${i < statusIdx ? 'bg-primary' : 'bg-border'}`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1.5">
            {STATUS_FLOW.map(s => (
              <div key={s} className="text-[9px] text-muted-foreground text-center" style={{ width: `${100 / STATUS_FLOW.length}%` }}>
                {STATUS_LABELS[s]}
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: 'Объём', value: `${order.volume.toLocaleString('ru')} шт` },
            { label: 'Срок', value: new Date(order.deadline).toLocaleDateString('ru-RU') },
            { label: 'Создан', value: new Date(order.createdAt).toLocaleDateString('ru-RU') },
            { label: 'Статус', value: STATUS_LABELS[order.status] },
          ].map(({ label, value }) => (
            <div key={label} className="bg-secondary/40 rounded-md p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</div>
              <div className="text-sm font-medium text-foreground">{value}</div>
            </div>
          ))}
        </div>

        {order.notes && (
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-md p-3 text-xs text-yellow-200">
            <Icon name="Info" size={12} className="inline mr-1.5 text-yellow-400" />
            {order.notes}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Orders({ search }: { search: string }) {
  const [selected, setSelected] = useState<Order | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = MOCK_ORDERS.filter(o => {
    const q = search.toLowerCase();
    const matchSearch = !q || o.client.toLowerCase().includes(q) || o.number.toLowerCase().includes(q) || o.sku.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statuses = ['all', 'new', 'confirmed', 'in_production', 'produced', 'shipped'];

  return (
    <div className="p-6 animate-fade-in">
      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {statuses.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${statusFilter === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
          >
            {s === 'all' ? 'Все' : STATUS_LABELS[s]}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 border border-primary/30 text-primary rounded-md text-xs font-medium hover:bg-primary/25 transition-colors">
            <Icon name="Plus" size={12} />
            Новый заказ
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-secondary/40 border-b border-border">
              {['Номер', 'Клиент', 'SKU', 'Объём', 'Срок', 'Статус', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(o => (
              <OrderRow key={o.id} order={o} onSelect={() => setSelected(o)} />
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <Icon name="Search" size={32} className="mx-auto mb-2 opacity-30" />
            Ничего не найдено
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
        <span>Показано {filtered.length} из {MOCK_ORDERS.length} заказов</span>
        <span className="font-mono-vpk">
          Итого: {filtered.reduce((s, o) => s + o.volume, 0).toLocaleString('ru')} шт
        </span>
      </div>

      {selected && <OrderDetail order={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
