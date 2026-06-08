import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import {
  clientProjectsApi,
  type ClientProject,
  type ProjectRecipeItem,
  type ProjectDesign,
  type ProjectFactorySetup,
  type ProjectDeclaration,
  type ProjectPurchase,
  type ProjectCan,
  type ProjectReadiness,
} from '@/api/client';
import TabClientCard from '@/components/clients/TabClientCard';

// ─── Константы ───────────────────────────────────────────────────────────────

const STAGES: { id: string; label: string; icon: string }[] = [
  { id: 'negotiations',  label: 'Переговоры',     icon: 'MessageSquare' },
  { id: 'client_card',   label: 'Карточка',        icon: 'User' },
  { id: 'recipe',        label: 'Рецептура',       icon: 'FlaskConical' },
  { id: 'design',        label: 'Дизайн',          icon: 'Palette' },
  { id: 'factory_setup', label: 'Завод банки',     icon: 'Building2' },
  { id: 'declaration',   label: 'Декларация',      icon: 'FileCheck' },
  { id: 'raw_purchase',  label: 'Закупка сырья',   icon: 'Package' },
  { id: 'can_order',     label: 'Банка',           icon: 'Cylinder' },
  { id: 'ready',         label: 'Готов',           icon: 'CheckCircle2' },
];

const STAGE_COLORS: Record<string, string> = {
  negotiations:  'bg-slate-500/20 text-slate-300',
  client_card:   'bg-blue-500/20 text-blue-300',
  recipe:        'bg-violet-500/20 text-violet-300',
  design:        'bg-pink-500/20 text-pink-300',
  factory_setup: 'bg-orange-500/20 text-orange-300',
  declaration:   'bg-yellow-500/20 text-yellow-300',
  raw_purchase:  'bg-cyan-500/20 text-cyan-300',
  can_order:     'bg-emerald-500/20 text-emerald-300',
  ready:         'bg-primary/20 text-primary',
};

const DESIGN_STATUSES: Record<string, string> = {
  in_progress:       'В работе',
  review:            'На проверке',
  approved:          'Утверждён',
  sent_to_factory:   'Отправлен',
  registered:        'Заведён',
};

const DECL_STATUSES: Record<string, string> = {
  samples_not_sent:  'Образцы не отправлены',
  samples_sent:      'Образцы отправлены',
  docs_submitted:    'Документы поданы',
  in_progress:       'В работе',
  ready:             'Готова',
  overdue:           'Просрочена',
};

const PURCHASE_STATUSES: Record<string, string> = {
  not_ordered:       'Не заказано',
  ordered:           'Заказано',
  in_transit:        'В пути',
  partial:           'Частично',
  delivered:         'Доставлено',
  overdue:           'Просрочено',
};

const CAN_STATUSES: Record<string, string> = {
  design_not_ready:  'Дизайн не готов',
  design_sent:       'Дизайн отправлен',
  design_registered: 'Дизайн заведён',
  can_ordered:       'Банка заказана',
  in_production:     'В производстве',
  ready_to_ship:     'Готова к отгрузке',
  shipped:           'Отгружена',
  received:          'Получена',
};

const READINESS_LABELS: { key: keyof ProjectReadiness; label: string }[] = [
  { key: 'recipe_approved',   label: 'Рецептура утверждена' },
  { key: 'raw_ordered',       label: 'Сырьё заказано' },
  { key: 'raw_delivered',     label: 'Сырьё доставлено' },
  { key: 'design_at_factory', label: 'Дизайн заведён на заводе' },
  { key: 'can_shipped',       label: 'Банка отгружена' },
  { key: 'declaration_ready', label: 'Декларация готова' },
  { key: 'samples_sent',      label: 'Образцы отправлены' },
  { key: 'client_approved',   label: 'Клиент подтвердил запуск' },
];

function daysLeft(date: string | null): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
}

function fmtDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Мини-компоненты ─────────────────────────────────────────────────────────

function StatusBadge({ status, map }: { status: string; map: Record<string, string> }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-secondary/60 text-muted-foreground">
      {map[status] || status}
    </span>
  );
}

function Field({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="bg-secondary/40 rounded-lg p-2.5">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">{label}</div>
      <div className={`text-xs font-medium ${highlight ? 'text-red-400' : 'text-foreground'}`}>{value || '—'}</div>
    </div>
  );
}

function SectionTitle({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon name={icon} size={16} className="text-primary" />
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
    </div>
  );
}

// ─── Форма проекта ────────────────────────────────────────────────────────────

function ProjectForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: Partial<ClientProject>;
  onSave: (data: Partial<ClientProject>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<ClientProject>>({
    client: '', brand: '', drink_name: '', flavor: '',
    can_volume: '0.45', can_format: '0.45', label_type: 'sleeve',
    sku_count: 1, batch_volume: undefined, contact_person: '',
    manager: '', deadline: '', comment: '',
    ...initial,
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof ClientProject, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl">
        <div className="flex sm:hidden justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">
            {initial?.id ? 'Редактировать проект' : 'Новый проект'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground">
            <Icon name="X" size={15} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {([
              ['client', 'Клиент *', 'text', true],
              ['brand', 'Бренд', 'text', false],
              ['drink_name', 'Название напитка *', 'text', true],
              ['flavor', 'Вкус', 'text', false],
              ['contact_person', 'Контактное лицо', 'text', false],
              ['manager', 'Менеджер', 'text', false],
              ['deadline', 'Дедлайн', 'date', false],
              ['batch_volume', 'Объём партии (шт)', 'number', false],
            ] as [keyof ClientProject, string, string, boolean][]).map(([k, label, type, req]) => (
              <div key={k}>
                <label className="block text-xs text-muted-foreground mb-1">{label}</label>
                <input
                  type={type}
                  required={req}
                  value={(form[k] as string | number) || ''}
                  onChange={e => set(k, type === 'number' ? (e.target.value ? Number(e.target.value) : undefined) : e.target.value)}
                  className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Объём банки</label>
              <select value={form.can_volume || '0.45'} onChange={e => set('can_volume', e.target.value)}
                className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                {['0.33', '0.45', '0.5'].map(v => <option key={v} value={v}>{v} л</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Тип этикетки</label>
              <select value={form.label_type || 'sleeve'} onChange={e => set('label_type', e.target.value)}
                className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                <option value="sleeve">Sleeve</option>
                <option value="litography">Литография</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Кол-во SKU</label>
              <input type="number" min={1} value={form.sku_count || 1} onChange={e => set('sku_count', Number(e.target.value))}
                className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1">Комментарий</label>
            <textarea rows={2} value={form.comment || ''} onChange={e => set('comment', e.target.value)}
              className="w-full bg-secondary/50 border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-md bg-secondary text-muted-foreground hover:text-foreground text-sm transition-colors">
              Отмена
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Icon name="Save" size={14} />}
              Сохранить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Вкладка: Рецептура ───────────────────────────────────────────────────────

function TabRecipe({ project }: { project: ClientProject }) {
  const [items, setItems] = useState<ProjectRecipeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newItem, setNewItem] = useState({ ingredient: '', dosage: '', unit: 'г', supplier: '' });

  const totalVolumeLiters = ((project.batch_volume || 0) * parseFloat(project.can_volume || '0.45'));

  useEffect(() => {
    clientProjectsApi.getRecipe(project.id).then(setItems).finally(() => setLoading(false));
  }, [project.id]);

  const handleAdd = async () => {
    if (!newItem.ingredient || !newItem.dosage) return;
    const item = await clientProjectsApi.addRecipeItem(project.id, {
      ingredient: newItem.ingredient,
      dosage: parseFloat(newItem.dosage),
      unit: newItem.unit,
      supplier: newItem.supplier || undefined,
    });
    setItems(prev => [...prev, item]);
    setNewItem({ ingredient: '', dosage: '', unit: 'г', supplier: '' });
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    await clientProjectsApi.deleteRecipeItem(project.id, id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  if (loading) return <div className="py-8 text-center text-muted-foreground text-sm">Загрузка...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <SectionTitle title="Рецептура" icon="FlaskConical" />
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 text-primary rounded-md text-xs hover:bg-primary/25 transition-colors">
          <Icon name="Plus" size={12} />Добавить ингредиент
        </button>
      </div>

      {totalVolumeLiters > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-4 text-xs text-muted-foreground">
          Расчёт на объём <span className="text-foreground font-medium">{totalVolumeLiters.toLocaleString('ru')} л</span>
          {' '}({(project.batch_volume || 0).toLocaleString('ru')} банок × {project.can_volume} л)
        </div>
      )}

      {items.length === 0 && !adding ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          <Icon name="FlaskConical" size={32} className="mx-auto mb-2 opacity-20" />
          Рецептура не заполнена
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto mb-4">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="bg-secondary/40 border-b border-border text-[11px] text-muted-foreground uppercase">
                <th className="px-3 py-2 text-left">Ингредиент</th>
                <th className="px-3 py-2 text-right">Дозировка / л</th>
                <th className="px-3 py-2 text-left">Ед.</th>
                {totalVolumeLiters > 0 && <th className="px-3 py-2 text-right">На партию</th>}
                <th className="px-3 py-2 text-left">Поставщик</th>
                <th className="px-3 py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const need = totalVolumeLiters > 0 ? item.dosage * totalVolumeLiters : null;
                return (
                  <tr key={item.id} className="border-b border-border/40 hover:bg-secondary/20">
                    <td className="px-3 py-2 text-sm text-foreground">{item.ingredient}</td>
                    <td className="px-3 py-2 text-right font-mono-vpk text-sm text-foreground">{item.dosage}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{item.unit}</td>
                    {totalVolumeLiters > 0 && (
                      <td className="px-3 py-2 text-right font-mono-vpk text-sm text-primary font-semibold">
                        {need?.toLocaleString('ru', { maximumFractionDigits: 2 })} {item.unit}
                      </td>
                    )}
                    <td className="px-3 py-2 text-xs text-muted-foreground">{item.supplier || '—'}</td>
                    <td className="px-3 py-2">
                      <button onClick={() => handleDelete(item.id)}
                        className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors">
                        <Icon name="Trash2" size={11} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <div className="bg-secondary/30 rounded-lg p-4 border border-border">
          <div className="text-xs font-semibold text-muted-foreground mb-3">Новый ингредиент</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <input placeholder="Ингредиент *" value={newItem.ingredient}
              onChange={e => setNewItem(p => ({ ...p, ingredient: e.target.value }))}
              className="col-span-2 bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
            <input placeholder="Дозировка *" type="number" step="0.0001" value={newItem.dosage}
              onChange={e => setNewItem(p => ({ ...p, dosage: e.target.value }))}
              className="bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
            <select value={newItem.unit} onChange={e => setNewItem(p => ({ ...p, unit: e.target.value }))}
              className="bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
              {['г', 'кг', 'мл', 'л', 'шт', '%'].map(u => <option key={u}>{u}</option>)}
            </select>
            <input placeholder="Поставщик" value={newItem.supplier} className="col-span-2 bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              onChange={e => setNewItem(p => ({ ...p, supplier: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:bg-primary/90 transition-colors">
              Добавить
            </button>
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 bg-secondary text-muted-foreground rounded-md text-xs hover:text-foreground transition-colors">
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Вкладка: Дизайн ─────────────────────────────────────────────────────────

function TabDesign({ project }: { project: ClientProject }) {
  const [designs, setDesigns] = useState<ProjectDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ version: 'v1', comment: '', status: 'in_progress' });

  useEffect(() => {
    clientProjectsApi.getDesigns(project.id).then(setDesigns).finally(() => setLoading(false));
  }, [project.id]);

  const handleAdd = async () => {
    const d = await clientProjectsApi.createDesign(project.id, { ...form, uploaded_by: 'Менеджер' });
    setDesigns(prev => [d, ...prev]);
    setAdding(false);
  };

  const handleStatusChange = async (d: ProjectDesign, status: string) => {
    const updated = await clientProjectsApi.updateDesign(project.id, { design_id: d.id, status });
    setDesigns(prev => prev.map(x => x.id === d.id ? updated : x));
  };

  if (loading) return <div className="py-8 text-center text-muted-foreground text-sm">Загрузка...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <SectionTitle title="Дизайн банки" icon="Palette" />
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/15 text-primary rounded-md text-xs hover:bg-primary/25 transition-colors">
          <Icon name="Plus" size={12} />Добавить версию
        </button>
      </div>

      {designs.length === 0 && !adding ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          <Icon name="Palette" size={32} className="mx-auto mb-2 opacity-20" />
          Дизайны не загружены
        </div>
      ) : (
        <div className="space-y-3 mb-4">
          {designs.map(d => {
            const dl = daysLeft(d.updated_at);
            return (
              <div key={d.id} className="rounded-lg border border-border bg-secondary/20 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-foreground">Версия {d.version}</span>
                      <StatusBadge status={d.status} map={DESIGN_STATUSES} />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {d.uploaded_by && `Загружено: ${d.uploaded_by} · `}
                      {new Date(d.created_at).toLocaleDateString('ru-RU')}
                    </div>
                  </div>
                  <select
                    value={d.status}
                    onChange={e => handleStatusChange(d, e.target.value)}
                    className="bg-secondary border border-border rounded-md px-2 py-1 text-xs text-foreground focus:outline-none shrink-0"
                  >
                    {Object.entries(DESIGN_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                {d.comment && (
                  <div className="text-xs text-muted-foreground bg-secondary/40 rounded-md p-2">{d.comment}</div>
                )}
                {d.recognized_text && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Текст на макете: </span>
                    {d.recognized_text}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <div className="bg-secondary/30 rounded-lg p-4 border border-border">
          <div className="text-xs font-semibold text-muted-foreground mb-3">Новая версия дизайна</div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Версия</label>
              <input value={form.version} onChange={e => setForm(p => ({ ...p, version: e.target.value }))}
                className="w-full bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Статус</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                className="w-full bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                {Object.entries(DESIGN_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <textarea placeholder="Комментарий" rows={2} value={form.comment}
            onChange={e => setForm(p => ({ ...p, comment: e.target.value }))}
            className="w-full bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none mb-3" />
          <div className="flex gap-2">
            <button onClick={handleAdd} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:bg-primary/90">Добавить</button>
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 bg-secondary text-muted-foreground rounded-md text-xs hover:text-foreground">Отмена</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Вкладка: Завод банки ─────────────────────────────────────────────────────

function TabFactorySetup({ project }: { project: ClientProject }) {
  const [setup, setSetup] = useState<ProjectFactorySetup | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ factory: 'canpack', sent_at: '', responsible: '', status: 'pending', comment: '' });

  useEffect(() => {
    clientProjectsApi.getFactorySetup(project.id)
      .then(d => { if (d && 'id' in d) setSetup(d); })
      .finally(() => setLoading(false));
  }, [project.id]);

  const handleSave = async () => {
    const d = await clientProjectsApi.saveFactorySetup(project.id, form);
    setSetup(d);
  };

  useEffect(() => {
    if (setup) setForm({ factory: setup.factory, sent_at: setup.sent_at || '', responsible: setup.responsible || '', status: setup.status, comment: setup.comment || '' });
  }, [setup]);

  if (loading) return <div className="py-8 text-center text-muted-foreground text-sm">Загрузка...</div>;

  const dl = setup?.planned_ready ? daysLeft(setup.planned_ready) : null;
  const overdue = dl !== null && dl < 0;

  return (
    <div>
      <SectionTitle title="Заведение дизайна на заводе" icon="Building2" />

      {setup && (
        <div className={`rounded-lg border p-4 mb-4 ${overdue ? 'border-red-500/30 bg-red-500/5' : 'border-primary/20 bg-primary/5'}`}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <Field label="Завод" value={setup.factory === 'canpack' ? 'Canpack' : 'Арнест'} />
            <Field label="Дата отправки" value={fmtDate(setup.sent_at)} />
            <Field label="Плановая готовность" value={fmtDate(setup.planned_ready)} highlight={overdue} />
            <Field label="Осталось дней" value={dl !== null ? (overdue ? `Просрочено на ${Math.abs(dl)}д` : `${dl} дн.`) : '—'} highlight={overdue} />
          </div>
          {setup.responsible && <div className="mt-2 text-xs text-muted-foreground">Ответственный: <span className="text-foreground">{setup.responsible}</span></div>}
        </div>
      )}

      <div className="bg-secondary/30 rounded-lg p-4 border border-border">
        <div className="text-xs font-semibold text-muted-foreground mb-3">{setup ? 'Обновить данные' : 'Заполнить данные'}</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Завод</label>
            <select value={form.factory} onChange={e => setForm(p => ({ ...p, factory: e.target.value }))}
              className="w-full bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
              <option value="canpack">Canpack</option>
              <option value="arnest">Арнест</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Дата отправки</label>
            <input type="date" value={form.sent_at} onChange={e => setForm(p => ({ ...p, sent_at: e.target.value }))}
              className="w-full bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Ответственный</label>
            <input value={form.responsible} onChange={e => setForm(p => ({ ...p, responsible: e.target.value }))}
              className="w-full bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Статус</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
              className="w-full bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
              <option value="pending">Ожидание</option>
              <option value="sent">Отправлено</option>
              <option value="registered">Заведено</option>
            </select>
          </div>
        </div>
        <button onClick={handleSave} className="px-4 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:bg-primary/90 transition-colors">
          Сохранить
        </button>
      </div>

      {form.sent_at && (
        <div className="mt-3 text-xs text-muted-foreground bg-secondary/30 rounded-lg p-3">
          <Icon name="Info" size={12} className="inline mr-1 text-primary" />
          Плановая готовность = дата отправки + 10 календарных дней
        </div>
      )}
    </div>
  );
}

// ─── Вкладка: Декларация ──────────────────────────────────────────────────────

function TabDeclaration({ project }: { project: ClientProject }) {
  const [decl, setDecl] = useState<ProjectDeclaration | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    decl_type: '3d', samples_sent_at: '', docs_submitted_at: '',
    status: 'samples_not_sent', lab: '', tracking_number: '', comment: '',
  });

  useEffect(() => {
    clientProjectsApi.getDeclaration(project.id)
      .then(d => { if (d && 'id' in d) setDecl(d); })
      .finally(() => setLoading(false));
  }, [project.id]);

  useEffect(() => {
    if (decl) setForm({
      decl_type: decl.decl_type,
      samples_sent_at: decl.samples_sent_at || '',
      docs_submitted_at: decl.docs_submitted_at || '',
      status: decl.status,
      lab: decl.lab || '',
      tracking_number: decl.tracking_number || '',
      comment: decl.comment || '',
    });
  }, [decl]);

  const handleSave = async () => {
    const d = await clientProjectsApi.saveDeclaration(project.id, form);
    setDecl(d);
  };

  if (loading) return <div className="py-8 text-center text-muted-foreground text-sm">Загрузка...</div>;

  const dl = decl?.planned_ready ? daysLeft(decl.planned_ready) : null;
  const overdue = dl !== null && dl < 0;

  return (
    <div>
      <SectionTitle title="Декларация соответствия" icon="FileCheck" />

      {decl && (
        <div className={`rounded-lg border p-4 mb-4 ${overdue ? 'border-red-500/30 bg-red-500/5' : 'border-border bg-secondary/20'}`}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
            <Field label="Тип" value={decl.decl_type === '3d' ? '3Д (14 дн.)' : '1Д (3 дн.)'} />
            <Field label="Образцы отправлены" value={fmtDate(decl.samples_sent_at)} />
            <Field label="Документы поданы" value={fmtDate(decl.docs_submitted_at)} />
            <Field label="Плановая готовность" value={fmtDate(decl.planned_ready)} highlight={overdue} />
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={decl.status} map={DECL_STATUSES} />
            {dl !== null && (
              <span className={`text-xs font-mono-vpk ${overdue ? 'text-red-400' : 'text-muted-foreground'}`}>
                {overdue ? `Просрочено на ${Math.abs(dl)} дн.` : `Осталось ${dl} дн.`}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="bg-secondary/30 rounded-lg p-4 border border-border">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Тип декларации</label>
            <select value={form.decl_type} onChange={e => setForm(p => ({ ...p, decl_type: e.target.value }))}
              className="w-full bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
              <option value="3d">3Д — 14 дней</option>
              <option value="1d">1Д — 3 дня</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Статус</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
              className="w-full bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
              {Object.entries(DECL_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Дата отправки образцов</label>
            <input type="date" value={form.samples_sent_at} onChange={e => setForm(p => ({ ...p, samples_sent_at: e.target.value }))}
              className="w-full bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Дата подачи документов</label>
            <input type="date" value={form.docs_submitted_at} onChange={e => setForm(p => ({ ...p, docs_submitted_at: e.target.value }))}
              className="w-full bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Лаборатория</label>
            <input value={form.lab} onChange={e => setForm(p => ({ ...p, lab: e.target.value }))}
              className="w-full bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Трек-номер</label>
            <input value={form.tracking_number} onChange={e => setForm(p => ({ ...p, tracking_number: e.target.value }))}
              className="w-full bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
          </div>
        </div>
        <button onClick={handleSave} className="px-4 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:bg-primary/90 transition-colors">
          Сохранить
        </button>
      </div>
    </div>
  );
}

// ─── Вкладка: Закупка ─────────────────────────────────────────────────────────

function TabPurchases({ project }: { project: ClientProject }) {
  const [items, setItems] = useState<ProjectPurchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    clientProjectsApi.getPurchases(project.id).then(setItems).finally(() => setLoading(false));
  }, [project.id]);

  const handleStatusChange = async (item: ProjectPurchase, status: string) => {
    const updated = await clientProjectsApi.savePurchase(project.id, { id: item.id, status });
    setItems(prev => prev.map(x => x.id === item.id ? updated : x));
  };

  if (loading) return <div className="py-8 text-center text-muted-foreground text-sm">Загрузка...</div>;

  return (
    <div>
      <SectionTitle title="Закупка сырья" icon="Package" />

      {items.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-sm">
          <Icon name="Package" size={32} className="mx-auto mb-2 opacity-20" />
          Заполните рецептуру — позиции закупки появятся автоматически
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="bg-secondary/40 border-b border-border text-[11px] text-muted-foreground uppercase">
                <th className="px-3 py-2 text-left">Ингредиент</th>
                <th className="px-3 py-2 text-right">Нужно</th>
                <th className="px-3 py-2 text-right">На складе</th>
                <th className="px-3 py-2 text-right">Дефицит</th>
                <th className="px-3 py-2 text-left">Поставщик</th>
                <th className="px-3 py-2 text-left">Статус</th>
                <th className="px-3 py-2 text-left">Плановая поставка</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const shortage = (item.shortage || 0) > 0;
                return (
                  <tr key={item.id} className="border-b border-border/40 hover:bg-secondary/20">
                    <td className="px-3 py-2 text-sm text-foreground">{item.ingredient}</td>
                    <td className="px-3 py-2 text-right font-mono-vpk text-sm text-foreground">
                      {item.needed?.toLocaleString('ru', { maximumFractionDigits: 2 }) || '—'} {item.unit}
                    </td>
                    <td className="px-3 py-2 text-right font-mono-vpk text-sm text-foreground">
                      {item.in_stock?.toLocaleString('ru', { maximumFractionDigits: 2 }) || '0'}
                    </td>
                    <td className={`px-3 py-2 text-right font-mono-vpk text-sm font-semibold ${shortage ? 'text-red-400' : 'text-emerald-400'}`}>
                      {shortage ? `-${item.shortage?.toLocaleString('ru', { maximumFractionDigits: 2 })}` : '✓'}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{item.supplier || '—'}</td>
                    <td className="px-3 py-2">
                      <select value={item.status} onChange={e => handleStatusChange(item, e.target.value)}
                        className="bg-secondary border border-border rounded px-2 py-0.5 text-xs text-foreground focus:outline-none">
                        {Object.entries(PURCHASE_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(item.planned_delivery)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Вкладка: Банка ───────────────────────────────────────────────────────────

function TabCan({ project }: { project: ClientProject }) {
  const [can, setCan] = useState<ProjectCan | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    factory: 'canpack', can_format: '', can_volume: '',
    design_sent_at: '', design_registered_at: '',
    can_ordered_at: '', planned_shipment: '', actual_shipment: '',
    status: 'design_not_ready', comment: '',
  });

  useEffect(() => {
    clientProjectsApi.getCan(project.id)
      .then(d => { if (d && 'id' in d) setCan(d); })
      .finally(() => setLoading(false));
  }, [project.id]);

  useEffect(() => {
    if (can) setForm({
      factory: can.factory,
      can_format: can.can_format || '',
      can_volume: can.can_volume || '',
      design_sent_at: can.design_sent_at || '',
      design_registered_at: can.design_registered_at || '',
      can_ordered_at: can.can_ordered_at || '',
      planned_shipment: can.planned_shipment || '',
      actual_shipment: can.actual_shipment || '',
      status: can.status,
      comment: can.comment || '',
    });
  }, [can]);

  const handleSave = async () => {
    const d = await clientProjectsApi.saveCan(project.id, form);
    setCan(d);
  };

  if (loading) return <div className="py-8 text-center text-muted-foreground text-sm">Загрузка...</div>;

  return (
    <div>
      <SectionTitle title="Банка и крышка" icon="Cylinder" />

      {can && (
        <div className="rounded-lg border border-border bg-secondary/20 p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-sm font-semibold text-foreground">{can.factory === 'canpack' ? 'Canpack' : 'Арнест'}</span>
            <StatusBadge status={can.status} map={CAN_STATUSES} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Field label="Дизайн отправлен" value={fmtDate(can.design_sent_at)} />
            <Field label="Дизайн заведён" value={fmtDate(can.design_registered_at)} />
            <Field label="Банка заказана" value={fmtDate(can.can_ordered_at)} />
            <Field label="Плановая отгрузка" value={fmtDate(can.planned_shipment)} />
          </div>
        </div>
      )}

      <div className="bg-secondary/30 rounded-lg p-4 border border-border">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Завод</label>
            <select value={form.factory} onChange={e => setForm(p => ({ ...p, factory: e.target.value }))}
              className="w-full bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
              <option value="canpack">Canpack</option>
              <option value="arnest">Арнест</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Статус</label>
            <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
              className="w-full bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
              {Object.entries(CAN_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {[
            ['design_sent_at', 'Дата отправки дизайна'],
            ['design_registered_at', 'Дата заведения дизайна'],
            ['can_ordered_at', 'Дата заказа банки'],
            ['planned_shipment', 'Плановая дата отгрузки'],
            ['actual_shipment', 'Фактическая дата отгрузки'],
          ].map(([k, label]) => (
            <div key={k}>
              <label className="text-xs text-muted-foreground block mb-1">{label}</label>
              <input type="date" value={(form as Record<string, string>)[k]}
                onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))}
                className="w-full bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
          ))}
        </div>
        <button onClick={handleSave} className="px-4 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:bg-primary/90 transition-colors">
          Сохранить
        </button>
      </div>
    </div>
  );
}

// ─── Вкладка: Готовность ──────────────────────────────────────────────────────

function TabReadiness({ project, onUpdated }: { project: ClientProject; onUpdated: (p: ClientProject) => void }) {
  const [readiness, setReadiness] = useState<ProjectReadiness | null>(project.readiness || null);
  const [saving, setSaving] = useState(false);
  const [sendForm, setSendForm] = useState({ line_id: 'line-1', line_speed: 9100, cleaning_time: 60, planned_production_date: '', planned_shipment_date: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(!!project.production_order_id);

  const allReady = readiness ? READINESS_LABELS.every(({ key }) => readiness[key as keyof ProjectReadiness]) : false;

  const toggle = async (key: keyof ProjectReadiness) => {
    if (!readiness) return;
    const updated = { ...readiness, [key]: !readiness[key] };
    setSaving(true);
    try {
      const res = await clientProjectsApi.updateReadiness(project.id, { [key]: !readiness[key] });
      setReadiness(res);
    } finally { setSaving(false); }
  };

  const handleSendToProduction = async () => {
    setSending(true);
    try {
      const res = await clientProjectsApi.sendToProduction(project.id, {
        line_id: sendForm.line_id,
        line_speed: sendForm.line_speed,
        cleaning_time: sendForm.cleaning_time,
        planned_production_date: sendForm.planned_production_date || undefined,
        planned_shipment_date: sendForm.planned_shipment_date || undefined,
      });
      setSent(true);
      onUpdated({ ...project, stage: 'ready', production_order_id: res.order_id });
    } finally { setSending(false); }
  };

  return (
    <div>
      <SectionTitle title="Готовность к производству" icon="CheckCircle2" />

      {/* Прогресс */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">Готовность</span>
          <span className="font-mono-vpk text-sm text-primary font-bold">{project.readiness_pct}%</span>
        </div>
        <div className="h-2 bg-border rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${project.readiness_pct}%` }} />
        </div>
      </div>

      {/* Чеклист */}
      <div className="space-y-2 mb-6">
        {READINESS_LABELS.map(({ key, label }) => {
          const checked = readiness?.[key as keyof ProjectReadiness] as boolean ?? false;
          return (
            <button
              key={key}
              onClick={() => toggle(key as keyof ProjectReadiness)}
              disabled={saving}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all ${
                checked ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border bg-secondary/20 hover:border-primary/30'
              }`}
            >
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                checked ? 'border-emerald-500 bg-emerald-500' : 'border-border'
              }`}>
                {checked && <Icon name="Check" size={10} className="text-white" />}
              </div>
              <span className={`text-sm ${checked ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
              {checked && <Icon name="CheckCircle2" size={14} className="text-emerald-500 ml-auto" />}
            </button>
          );
        })}
      </div>

      {/* Блок отправки в производство */}
      {allReady && !sent && (
        <div className="bg-primary/5 border border-primary/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-primary pulse-glow" />
            <span className="text-sm font-bold text-primary">Готов к планированию производства!</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Линия</label>
              <select value={sendForm.line_id} onChange={e => setSendForm(p => ({ ...p, line_id: e.target.value }))}
                className="w-full bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                <option value="line-1">Элеваторная</option>
                <option value="line-2">Ленина</option>
                <option value="line-3">Линия №3</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Скорость (шт/ч)</label>
              <input type="number" value={sendForm.line_speed}
                onChange={e => setSendForm(p => ({ ...p, line_speed: Number(e.target.value) }))}
                className="w-full bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Дата производства</label>
              <input type="date" value={sendForm.planned_production_date}
                onChange={e => setSendForm(p => ({ ...p, planned_production_date: e.target.value }))}
                className="w-full bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Дата отгрузки</label>
              <input type="date" value={sendForm.planned_shipment_date}
                onChange={e => setSendForm(p => ({ ...p, planned_shipment_date: e.target.value }))}
                className="w-full bg-secondary/50 border border-border rounded-md px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
            </div>
          </div>
          <button onClick={handleSendToProduction} disabled={sending}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {sending ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Icon name="Factory" size={16} />}
            Передать в производство
          </button>
        </div>
      )}

      {sent && (
        <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-xl p-5 flex items-center gap-3">
          <Icon name="CheckCircle2" size={20} className="text-emerald-400 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-emerald-400">Передан в производство</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Заказ {project.production_order_id ? `#${project.production_order_id.slice(0, 8)}` : ''} создан в разделе «Производство»
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Карточка проекта ─────────────────────────────────────────────────────────

const TABS = [
  { id: 'info',     label: 'Обзор',       icon: 'LayoutList' },
  { id: 'client_card', label: 'Карточка', icon: 'FileSpreadsheet' },
  { id: 'recipe',   label: 'Рецептура',   icon: 'FlaskConical' },
  { id: 'design',   label: 'Дизайн',      icon: 'Palette' },
  { id: 'factory',  label: 'Завод банки', icon: 'Building2' },
  { id: 'decl',     label: 'Декларация',  icon: 'FileCheck' },
  { id: 'purchase', label: 'Закупка',     icon: 'Package' },
  { id: 'can',      label: 'Банка',       icon: 'Cylinder' },
  { id: 'ready',    label: 'Готовность',  icon: 'CheckCircle2' },
];

function ProjectCard({
  project: initialProject,
  initialTab,
  onClose,
  onUpdated,
  onDeleted,
}: {
  project: ClientProject;
  initialTab?: string;
  onClose: () => void;
  onUpdated: (p: ClientProject) => void;
  onDeleted: (id: string) => void;
}) {
  const [project, setProject] = useState(initialProject);
  const [tab, setTab] = useState(initialTab || 'info');
  const [editing, setEditing] = useState(false);

  const stageIdx = STAGES.findIndex(s => s.id === project.stage);
  const deadline = project.deadline ? daysLeft(project.deadline) : null;
  const overdue = deadline !== null && deadline < 0;

  const handleUpdate = async (data: Partial<ClientProject>) => {
    const updated = await clientProjectsApi.update(project.id, data);
    setProject(updated);
    onUpdated(updated);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Удалить проект "${project.client} — ${project.drink_name}"?`)) return;
    await clientProjectsApi.delete(project.id);
    onDeleted(project.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-t-2xl md:rounded-xl w-full max-w-4xl max-h-[96vh] flex flex-col shadow-2xl">
        {/* Мобильный handle */}
        <div className="flex md:hidden justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header карточки */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="min-w-0 flex-1 mr-3">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-mono-vpk text-xs text-primary">{project.number}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STAGE_COLORS[project.stage] || 'bg-secondary text-muted-foreground'}`}>
                {STAGES.find(s => s.id === project.stage)?.label || project.stage}
              </span>
              {overdue && <span className="flex items-center gap-1 text-[10px] text-red-400"><Icon name="AlertTriangle" size={10} />Просрочен</span>}
            </div>
            <h2 className="text-base font-bold text-foreground leading-tight">{project.client}</h2>
            <div className="text-sm text-muted-foreground truncate">{project.drink_name}{project.flavor ? ` · ${project.flavor}` : ''}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => setEditing(true)} className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center text-muted-foreground hover:text-primary">
              <Icon name="Pencil" size={13} />
            </button>
            <button onClick={handleDelete} className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center text-muted-foreground hover:text-red-400">
              <Icon name="Trash2" size={13} />
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground">
              <Icon name="X" size={15} />
            </button>
          </div>
        </div>

        {/* Pipeline этапов */}
        <div className="px-5 py-3 border-b border-border bg-secondary/20 shrink-0">
          <div className="flex items-center gap-0 overflow-x-auto pb-1">
            {STAGES.map((s, i) => (
              <div key={s.id} className="flex items-center shrink-0">
                <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
                  i < stageIdx ? 'text-primary' :
                  i === stageIdx ? 'bg-primary/15 text-primary' :
                  'text-muted-foreground/40'
                }`}>
                  <Icon name={s.icon} size={11} />
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < STAGES.length - 1 && (
                  <div className={`w-3 h-px mx-0.5 shrink-0 ${i < stageIdx ? 'bg-primary' : 'bg-border'}`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Вкладки */}
        <div className="flex gap-0 px-5 border-b border-border bg-secondary/20 overflow-x-auto shrink-0">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-all border-b-2 ${
                tab === t.id ? 'text-primary border-primary' : 'text-muted-foreground border-transparent hover:text-foreground'
              }`}>
              <Icon name={t.icon} size={12} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Контент вкладки */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'info' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Field label="Клиент" value={project.client} />
                <Field label="Бренд" value={project.brand} />
                <Field label="Напиток" value={project.drink_name} />
                <Field label="Вкус" value={project.flavor} />
                <Field label="Объём банки" value={project.can_volume ? `${project.can_volume} л` : null} />
                <Field label="Тип этикетки" value={project.label_type === 'sleeve' ? 'Sleeve' : project.label_type === 'litography' ? 'Литография' : project.label_type} />
                <Field label="Объём партии" value={project.batch_volume ? `${project.batch_volume.toLocaleString('ru')} шт` : null} />
                <Field label="Кол-во SKU" value={project.sku_count} />
                <Field label="Менеджер" value={project.manager} />
                <Field label="Контакт" value={project.contact_person} />
                <Field label="Дедлайн" value={project.deadline ? fmtDate(project.deadline) : null} highlight={overdue} />
                <Field label="Готовность" value={`${project.readiness_pct}%`} />
              </div>
              {project.comment && (
                <div className="bg-secondary/30 rounded-lg p-3 text-sm text-muted-foreground">{project.comment}</div>
              )}
              {/* Алерты */}
              <div className="space-y-2">
                {!project.readiness?.declaration_ready && project.stage !== 'negotiations' && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-xs text-yellow-300">
                    <Icon name="AlertTriangle" size={12} />Декларация не готова
                  </div>
                )}
                {!project.readiness?.raw_delivered && project.stage !== 'negotiations' && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-lg text-xs text-orange-300">
                    <Icon name="AlertTriangle" size={12} />Сырьё не доставлено
                  </div>
                )}
                {overdue && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-300">
                    <Icon name="AlertTriangle" size={12} />Дедлайн просрочен на {Math.abs(deadline!)} дней
                  </div>
                )}
              </div>
            </div>
          )}
          {tab === 'client_card' && <TabClientCard project={project} />}
          {tab === 'recipe'   && <TabRecipe project={project} />}
          {tab === 'design'   && <TabDesign project={project} />}
          {tab === 'factory'  && <TabFactorySetup project={project} />}
          {tab === 'decl'     && <TabDeclaration project={project} />}
          {tab === 'purchase' && <TabPurchases project={project} />}
          {tab === 'can'      && <TabCan project={project} />}
          {tab === 'ready'    && <TabReadiness project={project} onUpdated={p => { setProject(p); onUpdated(p); }} />}
        </div>
      </div>

      {editing && (
        <ProjectForm initial={project} onSave={handleUpdate} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}

// ─── Главный список ───────────────────────────────────────────────────────────

export default function ClientProjects({ search }: { search: string }) {
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ClientProject | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [stageFilter, setStageFilter] = useState('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (stageFilter !== 'all') params.stage = stageFilter;
      const data = await clientProjectsApi.list(params);
      setProjects(data);
    } finally { setLoading(false); }
  }, [search, stageFilter]);

  useEffect(() => { load(); }, [load]);

  const [openOnTab, setOpenOnTab] = useState<string | undefined>(undefined);

  const handleCreate = async (data: Partial<ClientProject>) => {
    const p = await clientProjectsApi.create(data);
    setProjects(prev => [p, ...prev]);
    setShowForm(false);
    setOpenOnTab('client_card');
    setSelected(p);
  };

  const handleUpdated = (p: ClientProject) => {
    setProjects(prev => prev.map(x => x.id === p.id ? p : x));
    if (selected?.id === p.id) setSelected(p);
  };

  const handleDeleted = (id: string) => {
    setProjects(prev => prev.filter(x => x.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  const stats = {
    total: projects.length,
    ready: projects.filter(p => p.is_ready).length,
    overdue: projects.filter(p => p.deadline && daysLeft(p.deadline)! < 0).length,
  };

  return (
    <div className="px-4 md:px-6 py-4 md:py-6 w-full min-w-0 animate-fade-in">
      {/* Статистика */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Всего проектов', value: stats.total, icon: 'Briefcase', color: 'text-primary' },
          { label: 'Готовы к пр-ву', value: stats.ready, icon: 'CheckCircle2', color: 'text-emerald-400' },
          { label: 'Просрочены', value: stats.overdue, icon: 'AlertTriangle', color: 'text-red-400' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon name={s.icon} size={14} className={s.color} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <div className={`text-2xl font-bold font-mono-vpk ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex flex-wrap gap-1.5 min-w-0">
          <button onClick={() => setStageFilter('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all shrink-0 ${stageFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
            Все
          </button>
          {STAGES.map(s => (
            <button key={s.id} onClick={() => setStageFilter(s.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all shrink-0 ${stageFilter === s.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              {s.label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-semibold hover:bg-primary/90 ml-auto shrink-0">
          <Icon name="Plus" size={13} />Новый проект
        </button>
      </div>

      {/* Список */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span className="text-sm">Загрузка...</span>
          </div>
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Icon name="Handshake" size={48} className="mx-auto mb-3 opacity-20" />
          <div className="text-sm mb-1">Проектов нет</div>
          <button onClick={() => setShowForm(true)} className="text-primary text-xs hover:underline mt-2">
            Создать первый проект →
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map(p => {
            const dl = p.deadline ? daysLeft(p.deadline) : null;
            const overdue = dl !== null && dl < 0;
            const stage = STAGES.find(s => s.id === p.stage);
            return (
              <div
                key={p.id}
                onClick={() => setSelected(p)}
                className={`bg-card rounded-xl border p-4 cursor-pointer transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 ${
                  p.is_ready ? 'border-emerald-500/30' : overdue ? 'border-red-500/20' : 'border-border'
                }`}
              >
                {/* Верхняя строка */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono-vpk text-[10px] text-primary">{p.number}</span>
                      {p.is_ready && (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-semibold">
                          <Icon name="CheckCircle2" size={10} />Готов к пр-ву
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-foreground leading-tight truncate">{p.client}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.drink_name}{p.flavor ? ` · ${p.flavor}` : ''}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium shrink-0 ${STAGE_COLORS[p.stage] || 'bg-secondary text-muted-foreground'}`}>
                    {stage?.label || p.stage}
                  </span>
                </div>

                {/* Прогресс-бар */}
                <div className="mb-3">
                  <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                    <span>Готовность</span>
                    <span className="font-mono-vpk text-primary">{p.readiness_pct}%</span>
                  </div>
                  <div className="h-1 bg-border rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${p.readiness_pct}%`, background: p.is_ready ? '#10b981' : 'hsl(var(--primary))' }} />
                  </div>
                </div>

                {/* Нижняя строка */}
                <div className="flex items-center gap-3 flex-wrap text-[10px]">
                  {p.batch_volume && (
                    <span className="text-muted-foreground font-mono-vpk">
                      {p.batch_volume.toLocaleString('ru')} шт
                    </span>
                  )}
                  {p.manager && (
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Icon name="User" size={9} />{p.manager}
                    </span>
                  )}
                  {dl !== null && (
                    <span className={`ml-auto flex items-center gap-1 font-mono-vpk ${overdue ? 'text-red-400' : dl <= 7 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                      {overdue ? <Icon name="AlertTriangle" size={9} /> : <Icon name="Calendar" size={9} />}
                      {overdue ? `просрочен ${Math.abs(dl)}д` : `${dl} дн.`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Форма создания */}
      {showForm && <ProjectForm onSave={handleCreate} onClose={() => setShowForm(false)} />}

      {/* Карточка проекта */}
      {selected && (
        <ProjectCard
          project={selected}
          initialTab={openOnTab}
          onClose={() => { setSelected(null); setOpenOnTab(undefined); }}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}