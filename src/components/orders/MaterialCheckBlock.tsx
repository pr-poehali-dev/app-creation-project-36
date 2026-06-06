import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { materialsApi, type MaterialCheckResult, type OrderFromDB } from '@/api/client';

function StatusDot({ status }: { status: 'ok' | 'shortage' | 'pending' | null }) {
  if (status === 'ok') return <div className="w-2 h-2 rounded-full bg-emerald-500" />;
  if (status === 'shortage') return <div className="w-2 h-2 rounded-full bg-red-500" />;
  return <div className="w-2 h-2 rounded-full bg-yellow-500" />;
}

interface Props {
  order: OrderFromDB;
  onStatusChange?: () => void;
}

export default function MaterialCheckBlock({ order, onStatusChange }: Props) {
  const [result, setResult] = useState<MaterialCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [rechecking, setRechecking] = useState(false);

  const load = async () => {
    try {
      const data = await materialsApi.check(order.id);
      setResult(data);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [order.id]);

  const handleRecheck = async () => {
    setRechecking(true);
    try {
      await materialsApi.recheck(order.id, order.quantity, order.can_format, order.packaging_type);
      await load();
      onStatusChange?.();
    } finally {
      setRechecking(false);
    }
  };

  const overallStatus: 'ok' | 'shortage' | 'pending' =
    result?.all_available === true ? 'ok' :
    result?.all_available === false ? 'shortage' : 'pending';

  const CATEGORY_LABELS: Record<string, string> = {
    tara: 'Тара',
    raw: 'Сырьё',
    packaging: 'Упаковка',
    marking: 'Маркировка',
  };

  return (
    <div className={`rounded-xl border overflow-hidden ${
      overallStatus === 'ok'
        ? 'border-emerald-500/30 bg-emerald-500/5'
        : overallStatus === 'shortage'
        ? 'border-red-500/30 bg-red-500/5'
        : 'border-yellow-500/30 bg-yellow-500/5'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <Icon name="FlaskConical" size={15} className={
            overallStatus === 'ok' ? 'text-emerald-400' :
            overallStatus === 'shortage' ? 'text-red-400' : 'text-yellow-400'
          } />
          <span className="text-sm font-semibold text-foreground">Проверка сырья</span>
          {result?.checked_at && (
            <span className="text-[10px] text-muted-foreground font-mono-vpk">
              {new Date(result.checked_at).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Общий статус */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
            overallStatus === 'ok' ? 'bg-emerald-500/15 text-emerald-400' :
            overallStatus === 'shortage' ? 'bg-red-500/15 text-red-400' :
            'bg-yellow-500/15 text-yellow-400'
          }`}>
            <StatusDot status={overallStatus} />
            {overallStatus === 'ok' ? 'Всё в наличии' :
             overallStatus === 'shortage' ? `Нехватка: ${result?.shortage_count} поз.` :
             'Не проверено'}
          </div>
          <button
            onClick={handleRecheck}
            disabled={rechecking}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary/60 border border-border rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-all disabled:opacity-50"
          >
            <Icon name="RefreshCw" size={11} className={rechecking ? 'animate-spin' : ''} />
            {rechecking ? 'Проверяю...' : 'Повторить'}
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground text-xs gap-2">
          <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          Загрузка данных...
        </div>
      ) : !result || result.items.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-xs">
          <Icon name="Package" size={24} className="mx-auto mb-2 opacity-30" />
          Данных о сырье нет — нажмите «Повторить»
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {result.items.map((item) => {
            const available = Number(item.stock) - Number(item.mat_reserved);
            const pct = item.needed > 0 ? Math.min(100, (available / item.needed) * 100) : 100;
            const isShortage = item.status === 'shortage';

            return (
              <div key={item.material_id} className="flex items-center gap-3 px-4 py-2.5">
                {/* Индикатор */}
                <StatusDot status={item.status} />

                {/* Название */}
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground truncate">{item.name}</div>
                  <div className="text-[10px] text-muted-foreground">{item.unit}</div>
                </div>

                {/* Прогресс-бар */}
                <div className="hidden sm:flex items-center gap-2 w-24">
                  <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isShortage ? 'bg-red-500' : 'bg-emerald-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Цифры */}
                <div className="grid grid-cols-4 gap-3 text-right text-[11px] font-mono-vpk">
                  <div>
                    <div className="text-[9px] text-muted-foreground">нужно</div>
                    <div className="text-foreground">{Number(item.needed).toLocaleString('ru')}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-muted-foreground">доступно</div>
                    <div className={isShortage ? 'text-red-400' : 'text-emerald-400'}>
                      {available.toLocaleString('ru')}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-muted-foreground">резерв</div>
                    <div className="text-orange-400">{Number(item.reserved).toLocaleString('ru')}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-muted-foreground">нехватка</div>
                    <div className={item.shortage > 0 ? 'text-red-400 font-bold' : 'text-muted-foreground'}>
                      {item.shortage > 0 ? `−${Number(item.shortage).toLocaleString('ru')}` : '—'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer с итогом нехватки */}
      {result && overallStatus === 'shortage' && (
        <div className="px-4 py-3 bg-red-500/10 border-t border-red-500/20">
          <div className="flex items-start gap-2 text-xs text-red-300">
            <Icon name="AlertTriangle" size={13} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Заказ не может быть запущен</span> — не хватает{' '}
              {result.shortage_count} позиций сырья. После поступления материалов нажмите «Повторить»,
              статус обновится автоматически.
            </div>
          </div>
        </div>
      )}

      {result && overallStatus === 'ok' && (
        <div className="px-4 py-2.5 bg-emerald-500/10 border-t border-emerald-500/20">
          <div className="flex items-center gap-2 text-xs text-emerald-300">
            <Icon name="CheckCircle" size={12} className="text-emerald-400" />
            Всё сырьё зарезервировано — заказ готов к запуску в производство
          </div>
        </div>
      )}
    </div>
  );
}
