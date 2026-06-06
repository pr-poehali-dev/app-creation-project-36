import { useState } from 'react';
import Icon from '@/components/ui/icon';
import type { OrderCreatePayload } from '@/api/client';

const LINES = [
  { id: 'line-1', name: 'Элеваторная', speed: 9100 },
  { id: 'line-2', name: 'Линия №2', speed: 1800 },
  { id: 'line-3', name: 'Линия №3', speed: 2400 },
];

const STATUS_STEPS = [
  'Новый', 'Проверка сырья', 'Готов к пр-ву',
  'В производстве', 'Произведён', 'На складе', 'Отгружен',
];

interface Props {
  onClose: () => void;
  onSaved: () => void;
  initial?: Partial<OrderCreatePayload>;
  orderId?: string;
  mode?: 'create' | 'edit';
  onSubmit: (data: OrderCreatePayload) => Promise<void>;
}

function Field({ label, required, children, error }: {
  label: string; required?: boolean; children: React.ReactNode; error?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-red-400 mt-1">{error}</p>}
    </div>
  );
}

const inputCls = "w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all";
const selectCls = `${inputCls} cursor-pointer`;

export default function OrderForm({ onClose, onSaved, initial, mode = 'create', onSubmit }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState<OrderCreatePayload>({
    client: initial?.client ?? '',
    drink_name: initial?.drink_name ?? '',
    sku: initial?.sku ?? '',
    can_format: initial?.can_format ?? '0.33',
    packaging_type: initial?.packaging_type ?? 'sleeve',
    quantity: initial?.quantity ?? 10000,
    planned_production_date: initial?.planned_production_date ?? today,
    planned_shipment_date: initial?.planned_shipment_date ?? today,
    line_id: initial?.line_id ?? 'line-1',
    line_speed: initial?.line_speed ?? 2000,
    cleaning_time: initial?.cleaning_time ?? 30,
    manager: initial?.manager ?? '',
    comment: initial?.comment ?? '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof OrderCreatePayload, string>>>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const set = <K extends keyof OrderCreatePayload>(k: K, v: OrderCreatePayload[K]) => {
    setForm(p => ({ ...p, [k]: v }));
    setErrors(e => ({ ...e, [k]: '' }));
  };

  // Автоматическое формирование SKU
  const buildSku = () => {
    if (form.drink_name && form.can_format) {
      set('sku', `${form.drink_name} ${form.can_format}л`);
    }
  };

  // Автозаполнение скорости при смене линии
  const handleLineChange = (lineId: string) => {
    const line = LINES.find(l => l.id === lineId);
    set('line_id', lineId);
    if (line) set('line_speed', line.speed);
  };

  // Расчёт времени производства
  const productionMinutes = form.quantity > 0 && form.line_speed > 0
    ? Math.ceil((form.quantity / form.line_speed) * 60 + form.cleaning_time)
    : 0;
  const productionHours = Math.floor(productionMinutes / 60);
  const productionMins = productionMinutes % 60;

  const validate = () => {
    const e: Partial<Record<keyof OrderCreatePayload, string>> = {};
    if (!form.client.trim()) e.client = 'Укажите клиента';
    if (!form.drink_name.trim()) e.drink_name = 'Укажите напиток';
    if (!form.sku.trim()) e.sku = 'Укажите SKU';
    if (!form.quantity || form.quantity <= 0) e.quantity = 'Укажите количество > 0';
    if (!form.planned_production_date) e.planned_production_date = 'Укажите дату';
    if (!form.planned_shipment_date) e.planned_shipment_date = 'Укажите дату';
    if (!form.manager.trim()) e.manager = 'Укажите менеджера';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setApiError('');
    try {
      await onSubmit(form);
      onSaved();
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Ошибка сервера');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col animate-slide-up shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
              <Icon name="ClipboardList" size={17} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {mode === 'create' ? 'Новый заказ' : 'Редактировать заказ'}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {mode === 'create' ? 'Заполните форму — партия создастся автоматически' : 'Изменения пересчитают производство'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md bg-secondary/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
            <Icon name="X" size={15} />
          </button>
        </div>

        {/* Статусы */}
        {mode === 'create' && (
          <div className="px-6 py-3 bg-secondary/20 border-b border-border shrink-0">
            <div className="flex items-center gap-0">
              {STATUS_STEPS.map((s, i) => (
                <div key={s} className="flex items-center flex-1 last:flex-none">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${i === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary border border-border text-muted-foreground'}`}>
                    {i + 1}
                  </div>
                  {i < STATUS_STEPS.length - 1 && (
                    <div className="flex-1 h-px mx-0.5 bg-border" />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1">
              {STATUS_STEPS.map((s, i) => (
                <div key={s} className={`text-[9px] text-center ${i === 0 ? 'text-primary font-semibold' : 'text-muted-foreground'}`} style={{ width: `${100 / STATUS_STEPS.length}%` }}>
                  {s}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Form body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">
            {/* Клиент и менеджер */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Клиент" required error={errors.client}>
                <input className={inputCls} placeholder="X5 Retail Group" value={form.client}
                  onChange={e => set('client', e.target.value)} />
              </Field>
              <Field label="Ответственный менеджер" required error={errors.manager}>
                <input className={inputCls} placeholder="Иванов И.И." value={form.manager}
                  onChange={e => set('manager', e.target.value)} />
              </Field>
            </div>

            {/* Напиток */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Название напитка" required error={errors.drink_name}>
                <input className={inputCls} placeholder="Лимонад Классик" value={form.drink_name}
                  onChange={e => set('drink_name', e.target.value)}
                  onBlur={buildSku} />
              </Field>
              <Field label="SKU" required error={errors.sku}>
                <input className={inputCls} placeholder="Лимонад Классик 0.33л" value={form.sku}
                  onChange={e => set('sku', e.target.value)} />
              </Field>
            </div>

            {/* Формат и упаковка */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Формат банки">
                <select className={selectCls} value={form.can_format}
                  onChange={e => { set('can_format', e.target.value); buildSku(); }}>
                  <option value="0.33">0.33 л</option>
                  <option value="0.45">0.45 л</option>
                  <option value="0.5">0.5 л</option>
                </select>
              </Field>
              <Field label="Тип упаковки">
                <select className={selectCls} value={form.packaging_type}
                  onChange={e => set('packaging_type', e.target.value)}>
                  <option value="sleeve">Sleeve (термоусадка)</option>
                  <option value="litography">Литография</option>
                </select>
              </Field>
            </div>

            {/* Количество */}
            <Field label="Количество банок" required error={errors.quantity}>
              <div className="flex items-center gap-2">
                <input type="number" className={inputCls} placeholder="48000" min={1}
                  value={form.quantity}
                  onChange={e => set('quantity', Number(e.target.value))} />
                {productionMinutes > 0 && (
                  <div className="shrink-0 bg-primary/10 border border-primary/20 rounded-md px-3 py-2 text-[11px] font-mono-vpk text-primary whitespace-nowrap">
                    ≈ {productionHours}ч {productionMins}м
                  </div>
                )}
              </div>
            </Field>

            {/* Линия */}
            <div className="grid grid-cols-3 gap-4">
              <Field label="Линия производства">
                <select className={selectCls} value={form.line_id}
                  onChange={e => handleLineChange(e.target.value)}>
                  {LINES.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Скорость (банок/ч)">
                <input type="number" className={inputCls} min={100} value={form.line_speed}
                  onChange={e => set('line_speed', Number(e.target.value))} />
              </Field>
              <Field label="Время мойки (мин)">
                <input type="number" className={inputCls} min={0} value={form.cleaning_time}
                  onChange={e => set('cleaning_time', Number(e.target.value))} />
              </Field>
            </div>

            {/* Даты */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Плановая дата производства" required error={errors.planned_production_date}>
                <input type="date" className={inputCls} value={form.planned_production_date}
                  onChange={e => set('planned_production_date', e.target.value)} />
              </Field>
              <Field label="Желаемая дата отгрузки" required error={errors.planned_shipment_date}>
                <input type="date" className={inputCls} value={form.planned_shipment_date}
                  onChange={e => set('planned_shipment_date', e.target.value)} />
              </Field>
            </div>

            {/* Комментарий */}
            <Field label="Комментарий">
              <textarea className={`${inputCls} resize-none`} rows={2}
                placeholder="Приоритетный заказ, срок критичный..."
                value={form.comment}
                onChange={e => set('comment', e.target.value)} />
            </Field>

            {/* Превью расчёта */}
            {productionMinutes > 0 && (
              <div className="bg-secondary/30 border border-border rounded-lg p-3">
                <div className="text-[11px] text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Icon name="Calculator" size={11} />
                  Расчёт производства
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <div className="text-xs font-bold font-mono-vpk text-foreground">{Math.ceil((form.quantity / form.line_speed) * 60)} мин</div>
                    <div className="text-[10px] text-muted-foreground">производство</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold font-mono-vpk text-foreground">{form.cleaning_time} мин</div>
                    <div className="text-[10px] text-muted-foreground">мойка</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold font-mono-vpk text-primary">{productionHours}ч {productionMins}м</div>
                    <div className="text-[10px] text-muted-foreground">итого</div>
                  </div>
                </div>
              </div>
            )}

            {apiError && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-md px-4 py-3 text-sm text-red-300 flex items-center gap-2">
                <Icon name="AlertCircle" size={14} className="text-red-400 shrink-0" />
                {apiError}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border bg-secondary/20 shrink-0 flex items-center justify-between gap-3">
            <button type="button" onClick={onClose}
              className="px-4 py-2 rounded-md bg-secondary text-muted-foreground hover:text-foreground text-sm transition-colors">
              Отмена
            </button>
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Icon name={mode === 'create' ? 'Plus' : 'Save'} size={14} />
                  {mode === 'create' ? 'Создать заказ' : 'Сохранить изменения'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}