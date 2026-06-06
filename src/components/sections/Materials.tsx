import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import { materialsApi, type MaterialFromDB } from '@/api/client';

const CATEGORY_LABELS: Record<string, string> = {
  tara: 'Тара',
  raw: 'Сырьё',
  packaging: 'Упаковка',
  marking: 'Маркировка',
  other: 'Прочее',
};

const CATEGORY_COLORS: Record<string, string> = {
  tara: 'bg-blue-500/15 text-blue-300',
  raw: 'bg-amber-500/15 text-amber-300',
  packaging: 'bg-violet-500/15 text-violet-300',
  marking: 'bg-cyan-500/15 text-cyan-300',
  other: 'bg-slate-500/15 text-slate-300',
};

const CATEGORY_ICONS: Record<string, string> = {
  tara: 'Package',
  raw: 'FlaskConical',
  packaging: 'Layers',
  marking: 'Tag',
  other: 'Box',
};

interface EditStockForm {
  id: string;
  stock: string;
  min_stock: string;
}

function EditStockModal({ material, onClose, onSaved }: {
  material: MaterialFromDB;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [stock, setStock] = useState(String(material.stock));
  const [minStock, setMinStock] = useState(String(material.min_stock));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setLoading(true);
    setError('');
    try {
      await materialsApi.update(material.id, {
        stock: Number(stock),
        min_stock: Number(minStock),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-xl w-full max-w-sm p-5 animate-slide-up shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-foreground">Обновить остаток</h3>
          <button onClick={onClose} className="w-7 h-7 rounded bg-secondary/50 flex items-center justify-center text-muted-foreground hover:text-foreground">
            <Icon name="X" size={13} />
          </button>
        </div>
        <div className="mb-3">
          <div className="text-xs font-medium text-foreground mb-0.5">{material.name}</div>
          <div className="text-[11px] text-muted-foreground">{CATEGORY_LABELS[material.category] || material.category} · {material.unit}</div>
        </div>
        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Текущий остаток ({material.unit})</label>
            <input type="number" className={inputCls} value={stock} min={0}
              onChange={e => setStock(e.target.value)} />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Минимальный остаток ({material.unit})</label>
            <input type="number" className={inputCls} value={minStock} min={0}
              onChange={e => setMinStock(e.target.value)} />
          </div>
        </div>
        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2 mb-3">{error}</div>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-3 py-2 bg-secondary rounded-md text-xs text-muted-foreground hover:text-foreground transition-colors">
            Отмена
          </button>
          <button onClick={handleSave} disabled={loading}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all">
            {loading ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Icon name="Save" size={11} />}
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Materials({ search }: { search: string }) {
  const [materials, setMaterials] = useState<MaterialFromDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editing, setEditing] = useState<MaterialFromDB | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await materialsApi.list();
      setMaterials(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = materials.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.name.toLowerCase().includes(q) || m.category.toLowerCase().includes(q);
    const matchCat = categoryFilter === 'all' || m.category === categoryFilter;
    const free = Number(m.stock) - Number(m.reserved);
    const isCritical = free < Number(m.min_stock);
    const matchStatus = statusFilter === 'all'
      || (statusFilter === 'critical' && isCritical)
      || (statusFilter === 'ok' && !isCritical);
    return matchSearch && matchCat && matchStatus;
  });

  const categories = ['all', ...Array.from(new Set(materials.map(m => m.category)))];
  const critical = materials.filter(m => (Number(m.stock) - Number(m.reserved)) < Number(m.min_stock)).length;
  const reserved = materials.filter(m => Number(m.reserved) > 0).length;
  const ok = materials.filter(m => (Number(m.stock) - Number(m.reserved)) >= Number(m.min_stock)).length;

  return (
    <div className="p-6 animate-fade-in">
      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Позиций сырья', value: materials.length, icon: 'Package', color: 'bg-cyan-500/15 text-cyan-400' },
          { label: 'Критично', value: critical, icon: 'AlertTriangle', color: 'bg-red-500/15 text-red-400' },
          { label: 'В резерве', value: reserved, icon: 'Lock', color: 'bg-orange-500/15 text-orange-400' },
          { label: 'В норме', value: ok, icon: 'CheckCircle', color: 'bg-emerald-500/15 text-emerald-400' },
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

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex flex-wrap gap-1.5">
          {categories.map(c => (
            <button key={c} onClick={() => setCategoryFilter(c)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${categoryFilter === c ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              {c === 'all' ? 'Все' : CATEGORY_LABELS[c] || c}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 ml-2 border-l border-border pl-2">
          {[
            { key: 'all', label: 'Все статусы' },
            { key: 'critical', label: '🔴 Критично' },
            { key: 'ok', label: '🟢 Норма' },
          ].map(s => (
            <button key={s.key} onClick={() => setStatusFilter(s.key)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${statusFilter === s.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              {s.label}
            </button>
          ))}
        </div>
        <button onClick={load}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-muted-foreground hover:text-foreground rounded-md text-xs transition-colors">
          <Icon name="RefreshCw" size={12} />
          Обновить
        </button>
      </div>

      {/* Table */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Остатки сырья и материалов</h2>
        <span className="text-xs text-muted-foreground">{filtered.length} позиций</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <div className="flex flex-col items-center gap-3">
            <div className="w-7 h-7 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span className="text-sm">Загрузка...</span>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-secondary/40 border-b border-border">
                {['Наименование', 'Категория', 'Остаток', 'Резерв', 'Доступно', 'Минимум', 'Статус', 'Поставщик', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground text-sm">
                  <Icon name="Package" size={32} className="mx-auto mb-2 opacity-20" />
                  Ничего не найдено
                </td></tr>
              ) : filtered.map(m => {
                const free = Number(m.stock) - Number(m.reserved);
                const isCritical = free < Number(m.min_stock);
                const pct = Number(m.min_stock) > 0 ? Math.min(100, (free / Number(m.min_stock)) * 100) : 100;

                return (
                  <tr key={m.id} className="table-row-hover border-b border-border/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-8 rounded-full shrink-0 ${isCritical ? 'bg-red-500' : 'bg-emerald-500/60'}`} />
                        <div className="text-sm text-foreground">{m.name}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Icon name={CATEGORY_ICONS[m.category] || 'Box'} size={12} className="text-muted-foreground" fallback="Box" />
                        <span className={`status-badge text-[10px] ${CATEGORY_COLORS[m.category] || 'bg-slate-500/15 text-slate-300'}`}>
                          {CATEGORY_LABELS[m.category] || m.category}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono-vpk text-sm text-foreground">{Number(m.stock).toLocaleString('ru')}</span>
                      <span className="text-[10px] text-muted-foreground ml-1">{m.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-mono-vpk text-sm ${Number(m.reserved) > 0 ? 'text-orange-400' : 'text-muted-foreground'}`}>
                        {Number(m.reserved).toLocaleString('ru')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-mono-vpk text-sm font-semibold ${isCritical ? 'text-red-400' : 'text-emerald-400'}`}>
                        {free.toLocaleString('ru')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono-vpk text-xs text-muted-foreground">{Number(m.min_stock).toLocaleString('ru')}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <div className="w-14 h-1.5 bg-border rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${isCritical ? 'bg-red-500' : pct > 150 ? 'bg-emerald-500' : 'bg-yellow-500'}`}
                            style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                        <span className={`text-[10px] font-semibold whitespace-nowrap ${isCritical ? 'text-red-400' : 'text-emerald-400'}`}>
                          {isCritical ? '⚠ Критично' : '✓ Норма'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-muted-foreground">{m.supplier || '—'}</div>
                      {m.next_delivery_date && (
                        <div className="text-[10px] text-cyan-400 font-mono-vpk mt-0.5">
                          ↓ {new Date(m.next_delivery_date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setEditing(m)}
                        className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-secondary transition-colors"
                        title="Обновить остаток"
                      >
                        <Icon name="Pencil" size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Алерт критических позиций */}
      {!loading && critical > 0 && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="AlertTriangle" size={14} className="text-red-400" />
            <span className="text-sm font-semibold text-red-300">{critical} позиций ниже минимального остатка</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {materials
              .filter(m => (Number(m.stock) - Number(m.reserved)) < Number(m.min_stock))
              .map(m => (
                <div key={m.id} className="bg-red-500/10 rounded-md px-3 py-2">
                  <div className="text-xs font-medium text-red-200 truncate">{m.name}</div>
                  <div className="text-[11px] text-red-400 font-mono-vpk mt-0.5">
                    {(Number(m.stock) - Number(m.reserved)).toLocaleString('ru')} / мин {Number(m.min_stock).toLocaleString('ru')} {m.unit}
                  </div>
                  {m.next_delivery_date && (
                    <div className="text-[10px] text-cyan-400 mt-0.5">
                      Поступление: {new Date(m.next_delivery_date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {editing && (
        <EditStockModal
          material={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}
