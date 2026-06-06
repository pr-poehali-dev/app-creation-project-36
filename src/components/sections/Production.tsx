import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import { batchesApi, type BatchFromDB } from '@/api/client';

const LINES = [
  { id: 'line-1', name: 'Линия №1', speed: 2000 },
  { id: 'line-2', name: 'Линия №2', speed: 1800 },
  { id: 'line-3', name: 'Линия №3', speed: 2400 },
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

function timeStr(ts: string | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function dateFmt(ts: string | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
}

function calcProgress(batch: BatchFromDB): number {
  if (!batch.start_time || !batch.end_time) return 0;
  const now = Date.now();
  const start = new Date(batch.start_time).getTime();
  const end = new Date(batch.end_time).getTime();
  if (now < start) return 0;
  if (now > end) return 100;
  return Math.round(((now - start) / (end - start)) * 100);
}

function isActive(batch: BatchFromDB): boolean {
  if (!batch.start_time || !batch.end_time) return false;
  const now = Date.now();
  return now >= new Date(batch.start_time).getTime() && now <= new Date(batch.end_time).getTime();
}

function totalMinutes(batch: BatchFromDB): number {
  if (!batch.start_time || !batch.end_time) return 0;
  return Math.round((new Date(batch.end_time).getTime() - new Date(batch.start_time).getTime()) / 60000);
}

function BatchCard({ batch, onSelect }: { batch: BatchFromDB; onSelect: () => void }) {
  const active = isActive(batch);
  const progress = calcProgress(batch);
  const made = Math.round(batch.quantity * progress / 100);
  const mins = totalMinutes(batch);

  return (
    <div onClick={onSelect}
      className={`relative rounded-lg border p-3 cursor-pointer transition-all duration-200 hover:border-primary/40 ${
        active
          ? 'border-primary/50 bg-primary/5 glow-primary'
          : 'border-border bg-secondary/30 hover:bg-secondary/50'
      }`}>
      {active && (
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-glow" />
          <span className="text-[10px] text-primary font-semibold">В РАБОТЕ</span>
        </div>
      )}

      <div className="flex items-start gap-2 mb-2 pr-16">
        <div className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0" style={{ background: batch.color || '#0ea5e9' }} />
        <div>
          <div className="text-sm font-semibold text-foreground leading-tight">{batch.name}</div>
          <div className="text-[11px] text-muted-foreground">{batch.client}</div>
        </div>
      </div>

      {active && (
        <div className="mb-2">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>{made.toLocaleString('ru')} / {batch.quantity.toLocaleString('ru')}</span>
            <span className="font-mono-vpk">{progress}%</span>
          </div>
          <div className="h-1 bg-border rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${progress}%`, background: batch.color || '#0ea5e9' }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-[10px] font-mono-vpk mb-2">
        <div className="text-center">
          <div className="text-muted-foreground">Старт</div>
          <div className="text-foreground">{timeStr(batch.start_time)}</div>
          <div className="text-muted-foreground/60">{dateFmt(batch.start_time)}</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">Конец</div>
          <div className="text-foreground">{timeStr(batch.end_time)}</div>
          <div className="text-muted-foreground/60">{dateFmt(batch.end_time)}</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">Итого</div>
          <div className="text-foreground">{Math.floor(mins / 60)}ч{mins % 60}м</div>
          <div className="text-muted-foreground/60">{batch.speed}/ч</div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className={`status-badge text-[10px] ${STATUS_COLORS[batch.status] || 'bg-slate-500/20 text-slate-300'}`}>
          {STATUS_LABELS[batch.status] || batch.status}
        </span>
        <span className="text-[10px] text-muted-foreground font-mono-vpk ml-auto">
          {batch.quantity.toLocaleString('ru')} шт
        </span>
      </div>
    </div>
  );
}

function BatchDetail({ batch, onClose }: { batch: BatchFromDB; onClose: () => void }) {
  const progress = calcProgress(batch);
  const made = Math.round(batch.quantity * progress / 100);
  const mins = totalMinutes(batch);
  const productionMin = Math.ceil((batch.quantity / batch.speed) * 60);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up shadow-2xl">
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full" style={{ background: batch.color || '#0ea5e9' }} />
              <h2 className="text-base font-bold text-foreground">{batch.name}</h2>
            </div>
            <div className="text-sm text-muted-foreground">{batch.client} · {batch.sku}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground">
            <Icon name="X" size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Прогресс */}
          {isActive(batch) && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-primary font-semibold flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-glow" />
                  В РАБОТЕ
                </span>
                <span className="font-mono-vpk text-foreground">{progress}%</span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden mb-2">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${progress}%`, background: batch.color || '#0ea5e9' }} />
              </div>
              <div className="flex gap-4 text-[11px] text-muted-foreground font-mono-vpk">
                <span>Произведено: <span className="text-foreground">{made.toLocaleString('ru')}</span></span>
                <span>Осталось: <span className="text-foreground">{(batch.quantity - made).toLocaleString('ru')}</span></span>
              </div>
            </div>
          )}

          {/* Параметры */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Объём', value: batch.quantity.toLocaleString('ru'), unit: 'шт' },
              { label: 'Скорость', value: batch.speed.toLocaleString('ru'), unit: '/ч' },
              { label: 'Мойка', value: batch.cleaning_time, unit: 'мин' },
              { label: 'Пр-во', value: `${Math.floor(productionMin / 60)}ч${productionMin % 60}м`, unit: '' },
              { label: 'Итого', value: `${Math.floor(mins / 60)}ч${mins % 60}м`, unit: '' },
              { label: 'Статус', value: STATUS_LABELS[batch.status] || batch.status, unit: '' },
            ].map(({ label, value, unit }) => (
              <div key={label} className="bg-secondary/50 rounded-lg p-3 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
                <div className="text-sm font-bold font-mono-vpk text-foreground mt-1">{value}</div>
                {unit && <div className="text-[10px] text-muted-foreground">{unit}</div>}
              </div>
            ))}
          </div>

          {/* Расписание */}
          <div className="bg-secondary/30 rounded-lg p-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Расписание</div>
            <div className="space-y-1.5 text-xs font-mono-vpk">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Начало:</span>
                <span className="text-foreground">{batch.start_time ? new Date(batch.start_time).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Окончание:</span>
                <span className="text-foreground">{batch.end_time ? new Date(batch.end_time).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Production({ search }: { search: string }) {
  const [batches, setBatches] = useState<BatchFromDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BatchFromDB | null>(null);
  const [lineFilter, setLineFilter] = useState<string>('all');
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const data = await batchesApi.list();
      setBatches(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Обновляем прогресс каждые 30 сек
  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const getBatchesForLine = (lineId: string) => {
    return batches
      .filter(b => b.line_id === lineId)
      .filter(b => {
        if (!search) return true;
        const q = search.toLowerCase();
        return b.name.toLowerCase().includes(q) || b.client.toLowerCase().includes(q) || b.sku.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        if (!a.start_time) return 1;
        if (!b.start_time) return -1;
        return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
      });
  };

  const visibleLines = LINES.filter(l => lineFilter === 'all' || l.id === lineFilter);

  return (
    <div className="p-6 animate-fade-in">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <button onClick={() => setLineFilter('all')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${lineFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
          Все линии
        </button>
        {LINES.map(l => (
          <button key={l.id} onClick={() => setLineFilter(l.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${lineFilter === l.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
            {l.name}
          </button>
        ))}
        <button onClick={load}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-muted-foreground hover:text-foreground rounded-md text-xs transition-colors">
          <Icon name="RefreshCw" size={12} />
          Обновить
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span className="text-sm">Загрузка расписания...</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {visibleLines.map(line => {
            const lineBatches = getBatchesForLine(line.id);
            const totalMins = lineBatches.reduce((s, b) => s + totalMinutes(b), 0);
            const loadPct = Math.min(100, (totalMins / (24 * 60)) * 100);
            const activeBatch = lineBatches.find(b => isActive(b));

            return (
              <div key={line.id} className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Line header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${activeBatch ? 'bg-primary pulse-glow' : 'bg-border'}`} />
                    <span className="text-sm font-semibold text-foreground">{line.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-[10px] text-muted-foreground font-mono-vpk">
                      {line.speed.toLocaleString('ru')}/ч
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <div className="w-16 h-1 bg-border rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${loadPct}%` }} />
                      </div>
                      <span className="text-muted-foreground font-mono-vpk">{loadPct.toFixed(0)}%</span>
                    </div>
                  </div>
                </div>

                {/* Batches */}
                <div className="p-3 space-y-2.5 min-h-[200px]">
                  {lineBatches.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground/40 text-xs">
                      <Icon name="Calendar" size={24} className="mb-2 opacity-30" />
                      Нет запланированных партий
                    </div>
                  ) : (
                    lineBatches.map(batch => (
                      <BatchCard key={batch.id} batch={batch} onSelect={() => setSelected(batch)} />
                    ))
                  )}
                </div>

                {/* Line footer */}
                <div className="px-4 py-2.5 border-t border-border bg-secondary/20 flex justify-between text-[10px] text-muted-foreground font-mono-vpk">
                  <span>Партий: {lineBatches.length}</span>
                  <span>{Math.floor(totalMins / 60)}ч {totalMins % 60}м</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && batches.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Icon name="Factory" size={48} className="mx-auto mb-3 opacity-20" />
          <div className="text-sm mb-1">Нет партий в производстве</div>
          <div className="text-xs opacity-60">Создайте заказ — партия появится автоматически</div>
        </div>
      )}

      {selected && (
        <BatchDetail batch={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
