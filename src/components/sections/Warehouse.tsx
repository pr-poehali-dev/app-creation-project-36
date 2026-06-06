import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { MOCK_STOCK, MOCK_MOVEMENTS } from '@/data/mockData';

const TYPE_LABELS: Record<string, string> = {
  raw: 'Сырьё',
  finished: 'Готовая продукция',
  packaging: 'Тара/упаковка',
};

const TYPE_COLORS: Record<string, string> = {
  raw: 'bg-blue-500/15 text-blue-300',
  finished: 'bg-emerald-500/15 text-emerald-300',
  packaging: 'bg-violet-500/15 text-violet-300',
};

const MOVEMENT_COLORS: Record<string, string> = {
  in: 'text-emerald-400',
  out: 'text-red-400',
  reserve: 'text-orange-400',
};

const MOVEMENT_LABELS: Record<string, string> = {
  in: '+ Поступление',
  out: '− Списание',
  reserve: '⊘ Резерв',
};

export default function Warehouse({ search }: { search: string }) {
  const [tab, setTab] = useState<'stock' | 'movements'>('stock');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const filteredStock = MOCK_STOCK.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.name.toLowerCase().includes(q);
    const matchType = typeFilter === 'all' || s.type === typeFilter;
    return matchSearch && matchType;
  });

  const filteredMoves = MOCK_MOVEMENTS.filter(m => {
    const q = search.toLowerCase();
    return !q || m.itemName.toLowerCase().includes(q) || m.reason.toLowerCase().includes(q);
  });

  const finishedQty = MOCK_STOCK.filter(s => s.type === 'finished').reduce((sum, s) => sum + s.quantity, 0);

  return (
    <div className="p-6 animate-fade-in">
      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Позиций на складе', value: MOCK_STOCK.length, icon: 'Warehouse', color: 'bg-cyan-500/15 text-cyan-400' },
          { label: 'Готовой продукции', value: `${(finishedQty / 1000).toFixed(0)}к`, icon: 'BoxSelect', color: 'bg-emerald-500/15 text-emerald-400', unit: 'шт' },
          { label: 'Движений сегодня', value: MOCK_MOVEMENTS.length, icon: 'ArrowLeftRight', color: 'bg-violet-500/15 text-violet-400' },
          { label: 'Тара в наличии', value: MOCK_STOCK.filter(s => s.type === 'packaging').length, icon: 'Package', color: 'bg-orange-500/15 text-orange-400', unit: 'поз.' },
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

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 border-b border-border">
        {(['stock', 'movements'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t === 'stock' ? 'Остатки' : 'Движения'}
          </button>
        ))}

        {tab === 'stock' && (
          <div className="ml-auto flex items-center gap-1.5 pb-2">
            {['all', 'raw', 'finished', 'packaging'].map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`px-2.5 py-1 rounded text-xs transition-all ${typeFilter === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
                {t === 'all' ? 'Все' : TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'stock' && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-secondary/40 border-b border-border">
                {['Наименование', 'Тип', 'Количество', 'Ед.', 'Ячейка', 'Обновлено'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredStock.map(s => (
                <tr key={s.id} className="table-row-hover border-b border-border/40">
                  <td className="px-4 py-3 text-sm text-foreground">{s.name}</td>
                  <td className="px-4 py-3">
                    <span className={`status-badge ${TYPE_COLORS[s.type]}`}>{TYPE_LABELS[s.type]}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono-vpk text-sm text-foreground font-semibold">
                    {s.quantity.toLocaleString('ru')}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono-vpk">{s.unit}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{s.location || '—'}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono-vpk">
                    {new Date(s.lastUpdated).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'movements' && (
        <div className="space-y-2">
          {filteredMoves.map(m => (
            <div key={m.id} className="flex items-center gap-4 bg-card border border-border rounded-lg px-4 py-3 table-row-hover">
              <div className={`w-20 text-xs font-bold font-mono-vpk ${MOVEMENT_COLORS[m.type]}`}>
                {MOVEMENT_LABELS[m.type]}
              </div>
              <div className="flex-1">
                <div className="text-sm text-foreground">{m.itemName}</div>
                <div className="text-xs text-muted-foreground">{m.reason}</div>
              </div>
              <div className={`text-sm font-bold font-mono-vpk ${MOVEMENT_COLORS[m.type]}`}>
                {m.type === 'in' ? '+' : m.type === 'out' ? '-' : '⊘'}{m.quantity.toLocaleString('ru')}
              </div>
              <div className="text-[11px] text-muted-foreground font-mono-vpk text-right w-28">
                <div>{m.operator}</div>
                <div>{new Date(m.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
