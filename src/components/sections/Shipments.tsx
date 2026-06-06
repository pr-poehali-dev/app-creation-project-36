import Icon from '@/components/ui/icon';
import { MOCK_SHIPMENTS, STATUS_LABELS, STATUS_COLORS } from '@/data/mockData';

const DOC_LABELS = { invoice: 'Счёт', waybill: 'ТН', certificate: 'Сертификат' };

export default function Shipments({ search }: { search: string }) {
  const filtered = MOCK_SHIPMENTS.filter(s => {
    const q = search.toLowerCase();
    return !q || s.client.toLowerCase().includes(q) || s.transport.toLowerCase().includes(q);
  });

  const planned = MOCK_SHIPMENTS.filter(s => s.status === 'planned').length;
  const totalPallets = MOCK_SHIPMENTS.reduce((sum, s) => sum + s.pallets, 0);
  const totalQty = MOCK_SHIPMENTS.reduce((sum, s) => sum + s.quantity, 0);

  return (
    <div className="p-6 animate-fade-in">
      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Запланировано отгрузок', value: planned, icon: 'Calendar', color: 'bg-cyan-500/15 text-cyan-400' },
          { label: 'Банок к отгрузке', value: `${(totalQty / 1000).toFixed(0)}к`, icon: 'Package', color: 'bg-emerald-500/15 text-emerald-400' },
          { label: 'Паллет итого', value: totalPallets, icon: 'Layers', color: 'bg-violet-500/15 text-violet-400' },
          { label: 'Транспортных средств', value: MOCK_SHIPMENTS.length, icon: 'Truck', color: 'bg-orange-500/15 text-orange-400' },
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

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Планы отгрузок</h2>
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 border border-primary/30 text-primary rounded-md text-xs font-medium hover:bg-primary/25 transition-colors">
          <Icon name="Plus" size={12} />
          Добавить отгрузку
        </button>
      </div>

      {/* Cards */}
      <div className="space-y-3">
        {filtered.map(s => {
          const docsReady = Object.values(s.documents).filter(Boolean).length;
          const docsTotal = Object.values(s.documents).length;
          const allDocs = docsReady === docsTotal;

          return (
            <div key={s.id} className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 transition-all">
              <div className="flex items-start gap-4 p-4">
                {/* Icon */}
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon name="Truck" size={18} className="text-primary" />
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{s.client}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {s.transport}
                        {s.driver && ` · ${s.driver}`}
                      </div>
                    </div>
                    <span className={`status-badge ${STATUS_COLORS[s.status]} shrink-0`}>
                      {STATUS_LABELS[s.status]}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-3 text-[11px] font-mono-vpk">
                    <div className="bg-secondary/50 rounded-md px-2.5 py-1.5 text-center">
                      <div className="text-muted-foreground">Дата</div>
                      <div className="text-foreground font-semibold">
                        {new Date(s.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
                      </div>
                    </div>
                    <div className="bg-secondary/50 rounded-md px-2.5 py-1.5 text-center">
                      <div className="text-muted-foreground">Банок</div>
                      <div className="text-foreground font-semibold">{s.quantity.toLocaleString('ru')}</div>
                    </div>
                    <div className="bg-secondary/50 rounded-md px-2.5 py-1.5 text-center">
                      <div className="text-muted-foreground">Паллет</div>
                      <div className="text-foreground font-semibold">{s.pallets}</div>
                    </div>
                  </div>

                  {/* Documents */}
                  <div className="flex items-center gap-1.5">
                    <Icon name="FileText" size={11} className="text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">Документы:</span>
                    {Object.entries(s.documents).map(([key, ready]) => (
                      <span key={key} className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium ${ready ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {ready ? <Icon name="Check" size={8} /> : <Icon name="X" size={8} />}
                        {DOC_LABELS[key as keyof typeof DOC_LABELS]}
                      </span>
                    ))}
                    {!allDocs && (
                      <span className="ml-auto text-[10px] text-red-400 flex items-center gap-0.5">
                        <Icon name="AlertTriangle" size={10} />
                        {docsTotal - docsReady} не готово
                      </span>
                    )}
                    {allDocs && (
                      <span className="ml-auto text-[10px] text-emerald-400 flex items-center gap-0.5">
                        <Icon name="CheckCircle" size={10} />
                        Все готовы
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <Icon name="Truck" size={32} className="mx-auto mb-2 opacity-30" />
            Отгрузок не найдено
          </div>
        )}
      </div>
    </div>
  );
}
