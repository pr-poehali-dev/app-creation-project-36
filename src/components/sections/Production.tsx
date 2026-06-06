import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { MOCK_BATCHES, MOCK_LINES, STATUS_LABELS, STATUS_COLORS } from '@/data/mockData';
import type { Batch, BatchStatus } from '@/types/erp';

function calcSchedule(batches: Batch[], lineId: string, lineStart: string) {
  const lineBatches = batches.filter(b => b.lineId === lineId);
  let cursor = new Date(lineStart).getTime();
  return lineBatches.map(b => {
    const productionMin = (b.quantity / b.speed) * 60;
    const downtimesMin = b.downtimes.reduce((s, d) => s + d.minutes, 0);
    const totalMin = productionMin + b.cleaningTime + downtimesMin;
    const start = cursor;
    const end = cursor + totalMin * 60000;
    cursor = end;
    return { batch: b, start, end, productionMin, totalMin };
  });
}

function timeStr(ts: number) {
  return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function BatchCard({ entry, onSelect }: {
  entry: ReturnType<typeof calcSchedule>[0];
  onSelect: () => void;
}) {
  const { batch: b, start, end, productionMin, totalMin } = entry;
  const now = Date.now();
  const isActive = now >= start && now <= end;
  const isDone = now > end;
  const progress = isActive ? Math.min(100, ((now - start) / (end - start)) * 100) : isDone ? 100 : 0;
  const made = Math.round(b.quantity * progress / 100);

  const checkCount = Object.values(b.checklist).filter(Boolean).length;
  const checkTotal = Object.values(b.checklist).length;

  return (
    <div
      onClick={onSelect}
      className={`relative rounded-lg border p-3 cursor-pointer transition-all duration-200 hover:border-primary/40 ${isActive ? 'border-primary/50 bg-primary/5 glow-primary' : 'border-border bg-secondary/30 hover:bg-secondary/50'}`}
    >
      {isActive && (
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-glow" />
          <span className="text-[10px] text-primary font-semibold">В РАБОТЕ</span>
        </div>
      )}

      <div className="flex items-start gap-2 mb-2 pr-16">
        <div className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0" style={{ background: b.color }} />
        <div>
          <div className="text-sm font-semibold text-foreground leading-tight">{b.name}</div>
          <div className="text-[11px] text-muted-foreground">{b.client}</div>
        </div>
      </div>

      {isActive && (
        <div className="mb-2">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>{made.toLocaleString('ru')} / {b.quantity.toLocaleString('ru')}</span>
            <span className="font-mono-vpk">{progress.toFixed(0)}%</span>
          </div>
          <div className="h-1 bg-border rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${progress}%`, background: b.color }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-[10px] font-mono-vpk mb-2">
        <div className="text-center">
          <div className="text-muted-foreground">Старт</div>
          <div className="text-foreground">{timeStr(start)}</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">Конец</div>
          <div className="text-foreground">{timeStr(end)}</div>
        </div>
        <div className="text-center">
          <div className="text-muted-foreground">Мин</div>
          <div className="text-foreground">{Math.round(totalMin)}</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className={`status-badge ${STATUS_COLORS[b.status]}`}>{STATUS_LABELS[b.status]}</span>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
          <Icon name="CheckSquare" size={10} />
          <span className={checkCount === checkTotal ? 'text-emerald-400' : 'text-yellow-400'}>
            {checkCount}/{checkTotal}
          </span>
        </div>
        {b.downtimes.length > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-orange-400">
            <Icon name="Pause" size={10} />
            {b.downtimes.reduce((s, d) => s + d.minutes, 0)}м
          </div>
        )}
        {b.comments.length > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Icon name="MessageSquare" size={10} />
            {b.comments.length}
          </div>
        )}
      </div>
    </div>
  );
}

function BatchDetail({ batch, onClose }: { batch: Batch; onClose: () => void }) {
  const CHECKLIST_LABELS: Record<string, string> = {
    ds: 'Дозировочная станция (ДС)',
    rc: 'Рецептурная карта (РЦ)',
    ukladka: 'Укладка / палетирование',
    shk: 'ШК / Честный знак',
    lab: 'Лаборатория допустила',
    declaration: 'Декларация готова',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full" style={{ background: batch.color }} />
              <h2 className="text-base font-bold text-foreground">{batch.name}</h2>
            </div>
            <div className="text-sm text-muted-foreground">{batch.client} · {batch.sku}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground">
            <Icon name="X" size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Parameters */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Объём', value: batch.quantity.toLocaleString('ru'), unit: 'шт' },
              { label: 'Скорость', value: batch.speed.toLocaleString('ru'), unit: '/ч' },
              { label: 'Мойка', value: batch.cleaningTime, unit: 'мин' },
            ].map(({ label, value, unit }) => (
              <div key={label} className="bg-secondary/50 rounded-lg p-3 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
                <div className="text-base font-bold font-mono-vpk text-foreground mt-1">{value}</div>
                <div className="text-[10px] text-muted-foreground">{unit}</div>
              </div>
            ))}
          </div>

          {/* Checklist */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Чеклист готовности</div>
            <div className="space-y-1.5">
              {Object.entries(batch.checklist).map(([key, val]) => (
                <div key={key} className={`flex items-center gap-2.5 rounded-md px-3 py-2 ${val ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-secondary/40 border border-border/50'}`}>
                  <div className={`w-4 h-4 rounded flex items-center justify-center ${val ? 'bg-emerald-500' : 'bg-border'}`}>
                    {val && <Icon name="Check" size={10} className="text-white" />}
                  </div>
                  <span className={`text-xs ${val ? 'text-emerald-300' : 'text-muted-foreground'}`}>
                    {CHECKLIST_LABELS[key]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Downtimes */}
          {batch.downtimes.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Простои</div>
              <div className="space-y-1.5">
                {batch.downtimes.map(d => (
                  <div key={d.id} className="flex items-center justify-between bg-orange-500/10 border border-orange-500/20 rounded-md px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Icon name="Pause" size={12} className="text-orange-400" />
                      <span className="text-xs text-foreground">{d.reason}</span>
                    </div>
                    <span className="text-xs font-mono-vpk text-orange-400">{d.minutes} мин</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comments */}
          {batch.comments.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Комментарии</div>
              <div className="space-y-2">
                {batch.comments.map(c => (
                  <div key={c.id} className="bg-secondary/40 rounded-lg p-3 border border-border/50">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-primary">{c.author}</span>
                      <span className="text-[10px] text-muted-foreground font-mono-vpk">
                        {new Date(c.createdAt).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-foreground">{c.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Production({ search }: { search: string }) {
  const [selected, setSelected] = useState<Batch | null>(null);
  const [lineFilter, setLineFilter] = useState<string>('all');
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 10000);
    return () => clearInterval(t);
  }, []);

  const lines = MOCK_LINES;

  return (
    <div className="p-6 animate-fade-in">
      {/* Line filter */}
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => setLineFilter('all')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${lineFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
          Все линии
        </button>
        {lines.map(l => (
          <button key={l.id} onClick={() => setLineFilter(l.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${lineFilter === l.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
            {l.name}
          </button>
        ))}
        <div className="ml-auto">
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 border border-primary/30 text-primary rounded-md text-xs font-medium hover:bg-primary/25 transition-colors">
            <Icon name="Plus" size={12} />
            Добавить партию
          </button>
        </div>
      </div>

      {/* Lines grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {lines.filter(l => lineFilter === 'all' || l.id === lineFilter).map(line => {
          const schedule = calcSchedule(MOCK_BATCHES, line.id, line.startTime);
          const filtered = search
            ? schedule.filter(e => e.batch.name.toLowerCase().includes(search.toLowerCase()) || e.batch.client.toLowerCase().includes(search.toLowerCase()))
            : schedule;

          const lineLoad = schedule.reduce((s, e) => s + e.totalMin, 0);
          const loadPct = Math.min(100, (lineLoad / (24 * 60)) * 100);

          return (
            <div key={line.id} className="rounded-xl border border-border bg-card overflow-hidden">
              {/* Line header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
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
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground/50 text-xs">
                    <Icon name="Plus" size={24} className="mb-2 opacity-30" />
                    Нет партий
                  </div>
                ) : (
                  filtered.map(entry => (
                    <BatchCard key={entry.batch.id} entry={entry} onSelect={() => setSelected(entry.batch)} />
                  ))
                )}
              </div>

              {/* Line footer */}
              <div className="px-4 py-2.5 border-t border-border bg-secondary/20 flex justify-between text-[10px] text-muted-foreground font-mono-vpk">
                <span>Партий: {schedule.length}</span>
                <span>{Math.round(lineLoad / 60)}ч {Math.round(lineLoad % 60)}м</span>
              </div>
            </div>
          );
        })}
      </div>

      {selected && <BatchDetail batch={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
