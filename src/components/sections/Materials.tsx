import Icon from '@/components/ui/icon';
import { MOCK_MATERIALS } from '@/data/mockData';

export default function Materials({ search }: { search: string }) {
  const filtered = MOCK_MATERIALS.filter(m => {
    const q = search.toLowerCase();
    return !q || m.name.toLowerCase().includes(q);
  });

  return (
    <div className="p-6 animate-fade-in">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Позиций сырья', value: MOCK_MATERIALS.length, icon: 'Package', color: 'bg-cyan-500/15 text-cyan-400' },
          { label: 'Критично', value: MOCK_MATERIALS.filter(m => m.stock - m.reserved < m.minStock).length, icon: 'AlertTriangle', color: 'bg-red-500/15 text-red-400' },
          { label: 'В резерве', value: MOCK_MATERIALS.filter(m => m.reserved > 0).length, icon: 'Lock', color: 'bg-violet-500/15 text-violet-400' },
          { label: 'В норме', value: MOCK_MATERIALS.filter(m => m.stock - m.reserved >= m.minStock).length, icon: 'CheckCircle', color: 'bg-emerald-500/15 text-emerald-400' },
        ].map(c => (
          <div key={c.label} className="metric-card">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${c.color}`}>
              <Icon name={c.icon} size={17} />
            </div>
            <div className="text-2xl font-bold font-mono-vpk text-foreground">{c.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{c.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Остатки сырья и материалов</h2>
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 border border-primary/30 text-primary rounded-md text-xs font-medium hover:bg-primary/25 transition-colors">
          <Icon name="Plus" size={12} />
          Добавить позицию
        </button>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-secondary/40 border-b border-border">
              {['Наименование', 'Ед.', 'Остаток', 'Резерв', 'Свободно', 'Минимум', 'Статус', ''].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => {
              const free = m.stock - m.reserved;
              const isCritical = free < m.minStock;
              const pct = Math.min(100, (free / m.minStock) * 100);

              return (
                <tr key={m.id} className="table-row-hover border-b border-border/40">
                  <td className="px-4 py-3">
                    <div className="text-sm text-foreground">{m.name}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono-vpk">{m.unit}</td>
                  <td className="px-4 py-3 text-right font-mono-vpk text-sm text-foreground">
                    {m.stock.toLocaleString('ru')}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-vpk text-sm text-orange-400">
                    {m.reserved.toLocaleString('ru')}
                  </td>
                  <td className="px-4 py-3 text-right font-mono-vpk text-sm">
                    <span className={isCritical ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                      {free.toLocaleString('ru')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono-vpk text-xs text-muted-foreground">
                    {m.minStock.toLocaleString('ru')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-border rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${isCritical ? 'bg-red-500' : pct > 50 ? 'bg-emerald-500' : 'bg-yellow-500'}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                      <span className={`text-[11px] font-mono-vpk ${isCritical ? 'text-red-400' : 'text-emerald-400'}`}>
                        {isCritical ? 'Критично' : 'Норма'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isCritical && (
                      <button className="flex items-center gap-1 px-2 py-1 bg-red-500/15 text-red-400 rounded text-[10px] font-medium hover:bg-red-500/25 transition-colors">
                        <Icon name="ShoppingCart" size={10} />
                        Заказать
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
