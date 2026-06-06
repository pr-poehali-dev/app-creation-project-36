import Icon from '@/components/ui/icon';
import { MOCK_LAB } from '@/data/mockData';
import type { LabResult } from '@/types/erp';

const TASTE_LABELS: Record<string, string> = { good: 'Отличный', acceptable: 'Допустим', bad: 'Брак' };
const TASTE_COLORS: Record<string, string> = {
  good: 'text-emerald-400',
  acceptable: 'text-yellow-400',
  bad: 'text-red-400',
};

const NORMS = { brix: [9.5, 12.0], acidity: [3.0, 4.5], co2: [5.5, 7.0] };

function NormBar({ value, min, max, unit }: { value: number; min: number; max: number; unit: string }) {
  if (value === 0) return <span className="text-xs text-muted-foreground font-mono-vpk">—</span>;
  const inNorm = value >= min && value <= max;
  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm font-bold font-mono-vpk ${inNorm ? 'text-emerald-400' : 'text-red-400'}`}>
        {value}
      </span>
      <span className="text-[10px] text-muted-foreground">{unit}</span>
      <span className={`text-[10px] ${inNorm ? 'text-emerald-500' : 'text-red-500'}`}>
        ({min}–{max})
      </span>
    </div>
  );
}

function LabCard({ r }: { r: LabResult }) {
  const isApproved = r.status === 'approved';
  const isPending = r.status === 'pending';

  return (
    <div className={`rounded-xl border p-4 transition-all hover:border-primary/30 ${isApproved ? 'border-emerald-500/30 bg-emerald-500/5' : isPending ? 'border-border bg-card' : 'border-red-500/30 bg-red-500/5'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-sm font-semibold text-foreground">{r.batchName}</div>
          <div className="text-xs text-muted-foreground mt-0.5 font-mono-vpk">
            {new Date(r.date).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            {r.analyst !== '—' && ` · ${r.analyst}`}
          </div>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
          isApproved ? 'bg-emerald-500/15 text-emerald-400' :
          isPending ? 'bg-slate-500/15 text-slate-400' :
          'bg-red-500/15 text-red-400'
        }`}>
          <Icon name={isApproved ? 'CheckCircle' : isPending ? 'Clock' : 'XCircle'} size={12} />
          {isApproved ? 'Допущен' : isPending ? 'Ожидание' : 'Отклонён'}
        </div>
      </div>

      {!isPending ? (
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div className="bg-secondary/50 rounded-lg p-2.5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">BRIX</div>
            <NormBar value={r.brix} min={NORMS.brix[0]} max={NORMS.brix[1]} unit="°Bx" />
          </div>
          <div className="bg-secondary/50 rounded-lg p-2.5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Кислотность</div>
            <NormBar value={r.acidity} min={NORMS.acidity[0]} max={NORMS.acidity[1]} unit="г/л" />
          </div>
          <div className="bg-secondary/50 rounded-lg p-2.5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">CO₂</div>
            <NormBar value={r.co2} min={NORMS.co2[0]} max={NORMS.co2[1]} unit="г/л" />
          </div>
        </div>
      ) : (
        <div className="bg-secondary/30 rounded-lg p-3 mb-3 text-center text-xs text-muted-foreground">
          Анализ не проведён — ожидание образца
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon name="Beaker" size={12} className="text-muted-foreground" fallback="FlaskConical" />
          <span className="text-xs text-muted-foreground">Дегустация:</span>
          <span className={`text-xs font-medium ${r.value === 0 ? 'text-muted-foreground' : TASTE_COLORS[r.taste]}`}>
            {r.value === 0 ? '—' : TASTE_LABELS[r.taste]}
          </span>
        </div>
        {r.notes && (
          <span className="text-[11px] text-muted-foreground italic truncate max-w-[200px]">{r.notes}</span>
        )}
      </div>
    </div>
  );
}

export default function Quality({ search }: { search: string }) {
  const filtered = MOCK_LAB.filter(r => {
    const q = search.toLowerCase();
    return !q || r.batchName.toLowerCase().includes(q) || r.analyst.toLowerCase().includes(q);
  });

  const approved = MOCK_LAB.filter(r => r.status === 'approved').length;
  const pending = MOCK_LAB.filter(r => r.status === 'pending').length;
  const rejected = MOCK_LAB.filter(r => r.status === 'rejected').length;

  return (
    <div className="p-6 animate-fade-in">
      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { label: 'Допущено партий', value: approved, icon: 'CheckCircle', color: 'bg-emerald-500/15 text-emerald-400' },
          { label: 'Ожидает анализа', value: pending, icon: 'Clock', color: 'bg-slate-500/15 text-slate-400' },
          { label: 'Отклонено', value: rejected, icon: 'XCircle', color: 'bg-red-500/15 text-red-400' },
          { label: '% прохождения', value: `${Math.round((approved / (approved + rejected || 1)) * 100)}%`, icon: 'TrendingUp', color: 'bg-cyan-500/15 text-cyan-400' },
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

      {/* Norms reference */}
      <div className="bg-secondary/30 border border-border rounded-lg p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="BookOpen" size={14} className="text-primary" />
          <span className="text-xs font-semibold text-foreground">Нормы качества</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'BRIX', range: '9.5 – 12.0 °Bx', icon: '🍬' },
            { label: 'Кислотность', range: '3.0 – 4.5 г/л', icon: '⚗️' },
            { label: 'CO₂', range: '5.5 – 7.0 г/л', icon: '💨' },
          ].map(n => (
            <div key={n.label} className="text-center">
              <div className="text-base mb-0.5">{n.icon}</div>
              <div className="text-xs font-semibold text-foreground">{n.label}</div>
              <div className="text-[11px] text-primary font-mono-vpk">{n.range}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Results grid */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Результаты анализов</h2>
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 border border-primary/30 text-primary rounded-md text-xs font-medium hover:bg-primary/25 transition-colors">
          <Icon name="Plus" size={12} />
          Внести анализ
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {filtered.map(r => <LabCard key={r.id} r={r} />)}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <Icon name="FlaskConical" size={32} className="mx-auto mb-2 opacity-30" />
          Ничего не найдено
        </div>
      )}
    </div>
  );
}
