import { useMemo } from 'react';
import Icon from '@/components/ui/icon';
import { MOCK_BATCHES, MOCK_ORDERS, MOCK_MATERIALS, STATUS_LABELS, STATUS_COLORS } from '@/data/mockData';

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
  const activeNow = useMemo(() => {
    const now = new Date();
    return MOCK_BATCHES.filter(b => {
      if (b.status !== 'in_progress') return false;
      return true;
    });
  }, []);

  const totalOrders = MOCK_ORDERS.length;
  const activeOrders = MOCK_ORDERS.filter(o => o.status === 'in_production').length;
  const lowStock = MOCK_MATERIALS.filter(m => m.stock - m.reserved < m.minStock).length;
  const totalBanks = MOCK_ORDERS.reduce((s, o) => s + o.volume, 0);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Активных заказов" value={activeOrders} icon="ClipboardList"
          color="bg-cyan-500/15 text-cyan-400" sub={`из ${totalOrders} всего`} />
        <MetricCard label="Партий в работе" value={activeNow.length} icon="Factory"
          color="bg-violet-500/15 text-violet-400" sub="прямо сейчас" />
        <MetricCard label="Банок в плане" value={(totalBanks / 1000).toFixed(0)} unit="тыс."
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
          </div>
          <div className="space-y-3">
            {MOCK_BATCHES.filter(b => b.status === 'in_progress').map(b => {
              const progress = 62;
              const made = Math.round(b.quantity * progress / 100);
              return (
                <div key={b.id} className="rounded-lg bg-secondary/40 p-3 border border-border/50">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-sm font-medium text-foreground">{b.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{b.client} · {b.sku}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ background: b.color }} />
                      <span className="text-xs text-muted-foreground font-mono-vpk">Линия №1</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex-1 bg-border rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${progress}%`, background: b.color }} />
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
            {MOCK_BATCHES.filter(b => b.status === 'in_progress').length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">Нет активных партий</div>
            )}
          </div>
        </div>

        {/* Orders status */}
        <div className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold text-foreground mb-4">Статус заказов</h2>
          <div className="space-y-2">
            {MOCK_ORDERS.map(o => (
              <div key={o.id} className="flex items-center gap-2.5 py-2 border-b border-border/40 last:border-0">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">{o.client}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{o.number}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`status-badge ${STATUS_COLORS[o.status]}`}>
                    {STATUS_LABELS[o.status]}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono-vpk">
                    {(o.volume / 1000).toFixed(0)}к банок
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Low stock alert */}
      {lowStock > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="AlertTriangle" size={15} className="text-red-400" />
            <span className="text-sm font-semibold text-red-300">Критический уровень остатков</span>
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
