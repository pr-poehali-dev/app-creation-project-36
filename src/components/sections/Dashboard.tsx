import { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';
import { ordersApi, batchesApi, type OrderFromDB, type BatchFromDB } from '@/api/client';
import { MOCK_MATERIALS } from '@/data/mockData';

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

function isActive(b: BatchFromDB) {
  if (!b.start_time || !b.end_time) return false;
  const now = Date.now();
  return now >= new Date(b.start_time).getTime() && now <= new Date(b.end_time).getTime();
}

function calcProgress(b: BatchFromDB) {
  if (!b.start_time || !b.end_time) return 0;
  const now = Date.now();
  const start = new Date(b.start_time).getTime();
  const end = new Date(b.end_time).getTime();
  if (now < start) return 0;
  if (now > end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

function MetricCard({ label, value, unit, icon, color, sub }: {
  label: string; value: string | number; unit?: string;
  icon: string; color: string; sub?: string;
}) {
  return (
    <div className="metric-card animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon name={icon} size={17} />
        </div>
      </div>
      <div className="flex items-end gap-1">
        <span className="text-2xl font-bold text-foreground font-mono-vpk tabular-nums">{value}</span>
        {unit && <span className="text-sm text-muted-foreground mb-0.5">{unit}</span>}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
      {sub && <div className="text-[11px] text-primary mt-1">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [orders, setOrders] = useState<OrderFromDB[]>([]);
  const [batches, setBatches] = useState<BatchFromDB[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([ordersApi.list(), batchesApi.list()])
      .then(([o, b]) => { setOrders(o); setBatches(b); })
      .finally(() => setLoading(false));
  }, []);

  const activeBatches = batches.filter(isActive);
  const activeOrders = orders.filter(o => o.status === 'in_production').length;
  const totalBanks = orders.reduce((s, o) => s + o.quantity, 0);
  const lowStock = MOCK_MATERIALS.filter(m => m.stock - m.reserved < m.minStock).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-sm">Загрузка данных...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Заказов в производстве" value={activeOrders} icon="ClipboardList"
          color="bg-cyan-500/15 text-cyan-400" sub={`из ${orders.length} всего`} />
        <MetricCard label="Партий в работе сейчас" value={activeBatches.length} icon="Factory"
          color="bg-violet-500/15 text-violet-400" sub="прямо сейчас" />
        <MetricCard label="Банок в плане" value={totalBanks > 0 ? (totalBanks / 1000).toFixed(0) : 0} unit="тыс."
          icon="Package" color="bg-emerald-500/15 text-emerald-400" />
        <MetricCard label="Критично по сырью" value={lowStock} unit="поз."
          icon="AlertTriangle" color="bg-red-500/15 text-red-400" sub="ниже минимума" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Active batches */}
        <div className="lg:col-span-2 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-primary pulse-glow" />
            <h2 className="text-sm font-semibold text-foreground">Сейчас в производстве</h2>
            <span className="ml-auto text-xs text-muted-foreground font-mono-vpk">{activeBatches.length} партий</span>
          </div>

          {activeBatches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm opacity-60">
              <Icon name="Factory" size={32} className="mx-auto mb-2 opacity-30" />
              Нет активных партий
            </div>
          ) : (
            <div className="space-y-3">
              {activeBatches.map(b => {
                const progress = calcProgress(b);
                const made = Math.round(b.quantity * progress / 100);
                const lineNames: Record<string, string> = { 'line-1': 'Элеваторная', 'line-2': 'Ленина', 'line-3': 'Линия №3' };
                return (
                  <div key={b.id} className="rounded-lg bg-secondary/40 p-3 border border-border/50">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-sm font-medium text-foreground">{b.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{b.client} · {b.sku}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: b.color || '#0ea5e9' }} />
                        <span className="text-xs text-muted-foreground font-mono-vpk">{lineNames[b.line_id] || b.line_id}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex-1 bg-border rounded-full h-1.5 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${progress}%`, background: b.color || '#0ea5e9' }} />
                      </div>
                      <span className="text-xs font-mono-vpk text-foreground tabular-nums">{progress}%</span>
                    </div>
                    <div className="flex gap-4 text-[11px] text-muted-foreground font-mono-vpk">
                      <span>Произведено: <span className="text-foreground">{made.toLocaleString('ru')}</span></span>
                      <span>Осталось: <span className="text-foreground">{(b.quantity - made).toLocaleString('ru')}</span></span>
                      <span>Скорость: <span className="text-foreground">{b.speed}/ч</span></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Orders status */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            Статус заказов
            {orders.length > 0 && <span className="ml-2 text-xs text-muted-foreground font-normal">({orders.length})</span>}
          </h2>

          {orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs opacity-60">Заказов нет</div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {orders.slice(0, 10).map(o => (
                <div key={o.id} className="flex items-center gap-2.5 py-2 border-b border-border/40 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">{o.client}</div>
                    <div className="text-[10px] text-muted-foreground truncate font-mono-vpk">{o.number}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`status-badge text-[10px] ${STATUS_COLORS[o.status] || 'bg-slate-500/20 text-slate-300'}`}>
                      {STATUS_LABELS[o.status] || o.status}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono-vpk">
                      {(o.quantity / 1000).toFixed(0)}к шт
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Low stock alert */}
      {lowStock > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="AlertTriangle" size={15} className="text-red-400" />
            <span className="text-sm font-semibold text-red-300">Критический уровень остатков сырья</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {MOCK_MATERIALS.filter(m => m.stock - m.reserved < m.minStock).map(m => (
              <div key={m.id} className="bg-red-500/10 rounded-md p-2.5">
                <div className="text-xs font-medium text-red-200 truncate">{m.name}</div>
                <div className="text-[11px] text-red-400 font-mono-vpk mt-0.5">
                  {(m.stock - m.reserved).toLocaleString('ru')} {m.unit} / мин {m.minStock.toLocaleString('ru')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}