import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Icon from '@/components/ui/icon';
import { batchesApi, reorderApi, type BatchFromDB } from '@/api/client';

const LINES = [
  { id: 'line-1', name: 'Элеваторная', speed: 9100 },
  { id: 'line-2', name: 'Ленина', speed: 9100 },
  { id: 'line-3', name: 'Линия №3', speed: 2400 },
];

const LINE_MAP: Record<string, string> = {
  'line-1': 'Элеваторная',
  'line-2': 'Ленина',
  'line-3': 'Линия №3',
};

const LINE_COLORS_CSS: Record<string, string> = {
  'line-1': '#0ea5e9',
  'line-2': '#f97316',
  'line-3': '#8b5cf6',
};

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

function fmtDT(ts: string | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

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

// ─── Drag Overlay Card (ghost while dragging) ───
function DragCard({ batch }: { batch: BatchFromDB }) {
  return (
    <div className="rounded-lg border-2 border-primary/60 bg-card/95 p-3 shadow-2xl w-56 max-w-[90vw] rotate-2 opacity-90">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: batch.color || '#0ea5e9' }} />
        <div className="text-sm font-semibold text-foreground truncate">{batch.name}</div>
      </div>
      <div className="text-[11px] text-muted-foreground truncate">{batch.client}</div>
      <div className="text-[11px] font-mono-vpk text-muted-foreground mt-1">
        {batch.quantity.toLocaleString('ru')} шт · {batch.speed.toLocaleString('ru')}/ч
      </div>
    </div>
  );
}

// ─── Sortable Batch Card (board view) ───
function SortableBatchCard({
  batch,
  onSelect,
  isDragging,
}: {
  batch: BatchFromDB;
  onSelect: () => void;
  isDragging: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: selfDragging } = useSortable({
    id: batch.id,
    data: { type: 'batch', batch, lineId: batch.line_id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: selfDragging ? 0.3 : 1,
  };

  const active = isActive(batch);
  const progress = calcProgress(batch);
  const mins = totalMinutes(batch);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`relative rounded-lg border p-3 transition-all duration-150 w-full min-w-0 overflow-hidden ${
        selfDragging ? 'border-primary/30 bg-secondary/20' :
        active ? 'border-primary/50 bg-primary/5' :
        'border-border bg-secondary/30 hover:border-primary/30 hover:bg-secondary/50'
      } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        className="absolute top-2 right-2 p-1 rounded text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing"
        onClick={e => e.stopPropagation()}
      >
        <Icon name="GripVertical" size={13} />
      </div>

      {active && (
        <div className="absolute top-2 left-2 flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-glow" />
          <span className="text-[9px] text-primary font-semibold">В РАБОТЕ</span>
        </div>
      )}

      <div
        onClick={onSelect}
        className="flex items-start gap-2 mb-2 pr-8 pt-1 cursor-pointer min-w-0"
      >
        <div className="w-2.5 h-2.5 rounded-full mt-0.5 shrink-0" style={{ background: batch.color || '#0ea5e9' }} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground leading-tight break-words">{batch.name}</div>
          <div className="text-[11px] text-muted-foreground truncate">{batch.client}</div>
        </div>
      </div>

      {active && (
        <div className="mb-2" onClick={onSelect}>
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>{Math.round(batch.quantity * progress / 100).toLocaleString('ru')} / {batch.quantity.toLocaleString('ru')}</span>
            <span className="font-mono-vpk">{progress}%</span>
          </div>
          <div className="h-1 bg-border rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-1000"
              style={{ width: `${progress}%`, background: batch.color || '#0ea5e9' }} />
          </div>
        </div>
      )}

      <div onClick={onSelect} className="grid grid-cols-3 gap-1 text-[10px] font-mono-vpk mb-2 cursor-pointer">
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

      <div onClick={onSelect} className="flex items-center gap-2 flex-wrap cursor-pointer">
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

// ─── Drop zone column ───
function DroppableColumn({
  line,
  batches,
  onSelect,
  isDraggingOver,
  isDragging,
}: {
  line: typeof LINES[0];
  batches: BatchFromDB[];
  onSelect: (b: BatchFromDB) => void;
  isDraggingOver: boolean;
  isDragging: boolean;
}) {
  const totalMins = batches.reduce((s, b) => s + totalMinutes(b), 0);
  const activeBatch = batches.find(b => isActive(b));

  return (
    <div className={`rounded-xl border transition-all duration-200 overflow-hidden w-full min-w-0 ${
      isDraggingOver
        ? 'border-primary/60 bg-primary/5 shadow-lg shadow-primary/10'
        : 'border-border bg-card'
    }`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b transition-colors ${
        isDraggingOver ? 'border-primary/30 bg-primary/8' : 'border-border bg-secondary/30'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full transition-all ${
            isDraggingOver ? 'bg-primary scale-125' :
            activeBatch ? 'bg-primary pulse-glow' : 'bg-border'
          }`} />
          <span className="text-sm font-semibold text-foreground">{line.name}</span>
          {isDraggingOver && (
            <span className="text-[10px] text-primary font-medium animate-pulse">Отпустите здесь</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[10px] text-muted-foreground font-mono-vpk">{line.speed.toLocaleString('ru')}/ч</div>
          <span className="text-[10px] text-muted-foreground font-mono-vpk bg-secondary px-1.5 py-0.5 rounded">
            {batches.length}
          </span>
        </div>
      </div>

      {/* Sortable list */}
      <SortableContext items={batches.map(b => b.id)} strategy={verticalListSortingStrategy}>
        <div className={`p-3 space-y-2.5 min-h-[120px] transition-colors ${
          isDraggingOver ? 'bg-primary/3' : ''
        }`}>
          {batches.length === 0 ? (
            <div className={`flex flex-col items-center justify-center h-24 rounded-lg border-2 border-dashed transition-colors ${
              isDraggingOver ? 'border-primary/50 text-primary' : 'border-border/40 text-muted-foreground/30'
            } text-xs`}>
              <Icon name="Plus" size={20} className="mb-1 opacity-50" />
              {isDraggingOver ? 'Добавить сюда' : 'Нет партий'}
            </div>
          ) : batches.map(batch => (
            <SortableBatchCard
              key={batch.id}
              batch={batch}
              onSelect={() => onSelect(batch)}
              isDragging={isDragging}
            />
          ))}
        </div>
      </SortableContext>

      <div className="px-4 py-2.5 border-t border-border bg-secondary/20 flex justify-between text-[10px] text-muted-foreground font-mono-vpk">
        <span>Партий: {batches.length}</span>
        <span>{Math.floor(totalMins / 60)}ч {totalMins % 60}м</span>
      </div>
    </div>
  );
}

// ─── Таблица с DnD ───
function SortableTableRow({
  batch,
  index,
  onSelect,
}: {
  batch: BatchFromDB;
  index: number;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: batch.id,
    data: { type: 'batch', batch, lineId: batch.line_id },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const active = isActive(batch);
  const progress = calcProgress(batch);

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`border-b border-border/40 transition-colors ${
        active ? 'bg-primary/5' : 'hover:bg-secondary/30'
      } ${isDragging ? 'opacity-30' : ''}`}
    >
      <td className="px-3 py-2.5">
        <div
          {...attributes}
          {...listeners}
          className="flex items-center gap-1.5 cursor-grab active:cursor-grabbing"
        >
          <Icon name="GripVertical" size={13} className="text-muted-foreground/40" />
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: batch.color || '#0ea5e9' }} />
          <span className="text-xs text-muted-foreground font-mono-vpk">{index + 1}</span>
        </div>
      </td>
      <td className="px-3 py-2.5 max-w-xs" onClick={onSelect}>
        <div className="flex items-center gap-2 cursor-pointer">
          <div>
            <div className="text-sm font-medium text-foreground leading-tight">{batch.name}</div>
            <div className="text-[10px] text-muted-foreground">{batch.client}</div>
          </div>
          {active && <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-glow shrink-0" />}
        </div>
        {active && (
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[10px] font-mono-vpk text-primary shrink-0">{progress}%</span>
          </div>
        )}
      </td>
      <td className="px-3 py-2.5" onClick={onSelect}>
        <span className="text-xs px-2 py-0.5 rounded font-medium cursor-pointer"
          style={{ background: `${LINE_COLORS_CSS[batch.line_id]}20`, color: LINE_COLORS_CSS[batch.line_id] }}>
          {LINE_MAP[batch.line_id] || batch.line_id}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right" onClick={onSelect}>
        <span className="font-mono-vpk text-sm text-foreground font-semibold cursor-pointer">
          {batch.quantity.toLocaleString('ru')}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right" onClick={onSelect}>
        <span className="font-mono-vpk text-sm text-foreground cursor-pointer">{batch.speed.toLocaleString('ru')}</span>
      </td>
      <td className="px-3 py-2.5 text-right" onClick={onSelect}>
        <span className="font-mono-vpk text-sm text-foreground cursor-pointer">{batch.cleaning_time}</span>
      </td>
      <td className="px-3 py-2.5" onClick={onSelect}>
        <div className="text-xs font-mono-vpk text-foreground cursor-pointer whitespace-nowrap">
          {batch.start_time ? new Date(batch.start_time).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
        </div>
        <div className="text-[10px] text-muted-foreground font-mono-vpk">{timeStr(batch.start_time)}</div>
      </td>
      <td className="px-3 py-2.5" onClick={onSelect}>
        <div className="text-xs font-mono-vpk text-foreground cursor-pointer whitespace-nowrap">
          {batch.end_time ? new Date(batch.end_time).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
        </div>
        <div className="text-[10px] text-muted-foreground font-mono-vpk">{timeStr(batch.end_time)}</div>
      </td>
      <td className="px-3 py-2.5 text-center" onClick={onSelect}>
        <span className={`status-badge text-[10px] cursor-pointer ${STATUS_COLORS[batch.status] || 'bg-slate-500/20 text-slate-300'}`}>
          {STATUS_LABELS[batch.status] || batch.status}
        </span>
      </td>
    </tr>
  );
}

function TableView({
  batches,
  onSelect,
  onBatchesReorder,
}: {
  batches: BatchFromDB[];
  onSelect: (b: BatchFromDB) => void;
  onBatchesReorder: (updated: BatchFromDB[]) => void;
}) {
  const [showDone, setShowDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const filtered = batches
    .filter(b => showDone || b.status !== 'produced')
    .sort((a, b) => a.order_index - b.order_index || new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const [activeItem, setActiveItem] = useState<BatchFromDB | null>(null);

  const handleDragStart = (e: DragStartEvent) => {
    const b = filtered.find(x => x.id === e.active.id);
    if (b) setActiveItem(b);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveItem(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = filtered.findIndex(b => b.id === active.id);
    const newIndex = filtered.findIndex(b => b.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(filtered, oldIndex, newIndex).map((b, i) => ({ ...b, order_index: i }));
    onBatchesReorder(reordered);

    setSaving(true);
    try {
      const dragged = filtered[oldIndex];
      await reorderApi.batches({
        batch_id: dragged.id,
        new_line_id: dragged.line_id,
        ordered_ids: reordered.map(b => b.id),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full min-w-0 max-w-full overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-muted-foreground shrink-0">{filtered.length} партий</span>
          {saving && (
            <span className="flex items-center gap-1 text-[10px] text-primary shrink-0">
              <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
              <span className="hidden sm:inline">Сохраняю...</span>
            </span>
          )}
        </div>
        <button onClick={() => setShowDone(p => !p)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all shrink-0 ${showDone ? 'bg-primary/15 border border-primary/30 text-primary' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
          <Icon name={showDone ? 'EyeOff' : 'Eye'} size={12} />
          <span className="hidden sm:inline">{showDone ? 'Скрыть выполненные' : 'Показать выполненные'}</span>
          <span className="sm:hidden">{showDone ? 'Скрыть' : 'Выполненные'}</span>
        </button>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="bg-secondary/40 border-b border-border">
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide w-12">#</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Название</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Линия</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Кол-во (шт)</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Скорость</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Пауза</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Старт</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Окончание</th>
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Статус</th>
              </tr>
            </thead>
            <SortableContext items={filtered.map(b => b.id)} strategy={verticalListSortingStrategy}>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-10 text-muted-foreground text-sm">
                    <Icon name="Factory" size={28} className="mx-auto mb-2 opacity-20" />Нет партий
                  </td></tr>
                ) : filtered.map((b, idx) => (
                  <SortableTableRow key={b.id} batch={b} index={idx} onSelect={() => onSelect(b)} />
                ))}
              </tbody>
            </SortableContext>
          </table>
        </div>
        <DragOverlay>
          {activeItem && <DragCard batch={activeItem} />}
        </DragOverlay>
      </DndContext>

      {filtered.length > 0 && (
        <div className="flex items-center justify-between mt-3 px-1 text-xs text-muted-foreground font-mono-vpk">
          <span>Партий: {filtered.length}</span>
          <span>
            Итого: {filtered.reduce((s, b) => s + b.quantity, 0).toLocaleString('ru')} шт ·{' '}
            {Math.round(filtered.reduce((s, b) => s + totalMinutes(b), 0) / 60)}ч
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Detail modal ───
function BatchDetail({ batch, onClose }: { batch: BatchFromDB; onClose: () => void }) {
  const progress = calcProgress(batch);
  const made = Math.round(batch.quantity * progress / 100);
  const mins = totalMinutes(batch);
  const productionMin = Math.ceil((batch.quantity / batch.speed) * 60);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-t-2xl sm:rounded-xl w-full max-w-lg max-h-[92vh] overflow-y-auto animate-slide-up shadow-2xl">
        {/* Мобильный handle */}
        <div className="flex sm:hidden justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="flex items-start justify-between px-4 sm:px-5 py-3 sm:py-5 border-b border-border">
          <div className="min-w-0 flex-1 mr-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-3 h-3 rounded-full shrink-0" style={{ background: batch.color || '#0ea5e9' }} />
              <h2 className="text-base font-bold text-foreground leading-tight break-words">{batch.name}</h2>
            </div>
            <div className="text-sm text-muted-foreground truncate">
              {batch.client} · {LINE_MAP[batch.line_id] || batch.line_id}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0">
            <Icon name="X" size={15} />
          </button>
        </div>

        <div className="px-4 sm:px-5 py-4 sm:py-5 space-y-4">
          {isActive(batch) && (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-primary font-semibold flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-glow" />В РАБОТЕ
                </span>
                <span className="font-mono-vpk text-foreground">{progress}%</span>
              </div>
              <div className="h-2 bg-border rounded-full overflow-hidden mb-2">
                <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: batch.color || '#0ea5e9' }} />
              </div>
              <div className="flex gap-4 text-[11px] text-muted-foreground font-mono-vpk">
                <span>Произведено: <span className="text-foreground">{made.toLocaleString('ru')}</span></span>
                <span>Осталось: <span className="text-foreground">{(batch.quantity - made).toLocaleString('ru')}</span></span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: 'Объём', value: batch.quantity.toLocaleString('ru'), unit: 'шт' },
              { label: 'Скорость', value: batch.speed.toLocaleString('ru'), unit: '/ч' },
              { label: 'Мойка', value: batch.cleaning_time, unit: 'мин' },
              { label: 'Пр-во', value: `${Math.floor(productionMin / 60)}ч${productionMin % 60}м`, unit: '' },
              { label: 'Всего', value: `${Math.floor(mins / 60)}ч${mins % 60}м`, unit: '' },
              { label: 'Линия', value: LINE_MAP[batch.line_id] || batch.line_id, unit: '' },
            ].map(({ label, value, unit }) => (
              <div key={label} className="bg-secondary/50 rounded-lg p-3 text-center">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
                <div className="text-sm font-bold font-mono-vpk text-foreground mt-1">{value}</div>
                {unit && <div className="text-[10px] text-muted-foreground">{unit}</div>}
              </div>
            ))}
          </div>

          <div className="bg-secondary/30 rounded-lg p-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Расписание</div>
            <div className="space-y-1.5 text-xs font-mono-vpk">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Начало:</span>
                <span className="text-foreground">{fmtDT(batch.start_time)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Окончание:</span>
                <span className="text-foreground">{fmtDT(batch.end_time)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Главный компонент ───
export default function Production({ search }: { search: string }) {
  const [batches, setBatches] = useState<BatchFromDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BatchFromDB | null>(null);
  const [lineFilter, setLineFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'board'>('board');
  const [, setTick] = useState(0);
  const [saving, setSaving] = useState(false);
  const [overId, setOverId] = useState<string | null>(null); // line_id куда перетаскивают
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const load = useCallback(async () => {
    try {
      const data = await batchesApi.list();
      setBatches(data.sort((a, b) => a.order_index - b.order_index));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => setTick(p => p + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const getBatchesForLine = useCallback((lineId: string) => {
    return batches
      .filter(b => b.line_id === lineId)
      .filter(b => {
        if (!search) return true;
        const q = search.toLowerCase();
        return b.name.toLowerCase().includes(q) || b.client.toLowerCase().includes(q);
      })
      .sort((a, b) => a.order_index - b.order_index);
  }, [batches, search]);

  // ─ DnD Board handlers ─
  const [activeDrag, setActiveDrag] = useState<BatchFromDB | null>(null);

  const handleDragStart = (e: DragStartEvent) => {
    const b = batches.find(x => x.id === e.active.id);
    if (b) setActiveDrag(b);
  };

  const handleDragOver = (e: DragOverEvent) => {
    const { over } = e;
    if (!over) { setOverId(null); return; }

    // over может быть id батча или id линии (дроп-зона)
    const overBatch = batches.find(b => b.id === over.id);
    if (overBatch) {
      setOverId(overBatch.line_id);
    } else {
      // over.id — это id линии
      const lineExists = LINES.find(l => l.id === over.id);
      if (lineExists) setOverId(lineExists.id);
    }
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveDrag(null);
    setOverId(null);
    const { active, over } = e;
    if (!over) return;

    const draggedBatch = batches.find(b => b.id === active.id);
    if (!draggedBatch) return;

    const overBatch = batches.find(b => b.id === over.id);
    const targetLineId = overBatch ? overBatch.line_id : (LINES.find(l => l.id === over.id)?.id ?? draggedBatch.line_id);
    const oldLineId = draggedBatch.line_id;

    // Собираем новый порядок на целевой линии
    const targetBatches = batches.filter(b => b.line_id === targetLineId);

    let reordered: BatchFromDB[];
    if (oldLineId === targetLineId) {
      const oldIdx = targetBatches.findIndex(b => b.id === active.id);
      const newIdx = overBatch ? targetBatches.findIndex(b => b.id === over.id) : targetBatches.length - 1;
      if (oldIdx === newIdx) return;
      reordered = arrayMove(targetBatches, oldIdx, newIdx).map((b, i) => ({ ...b, order_index: i }));
    } else {
      // Перенос между линиями
      const insertIdx = overBatch ? targetBatches.findIndex(b => b.id === over.id) : targetBatches.length;
      const withoutDragged = targetBatches.filter(b => b.id !== draggedBatch.id);
      const moved = { ...draggedBatch, line_id: targetLineId };
      withoutDragged.splice(insertIdx, 0, moved);
      reordered = withoutDragged.map((b, i) => ({ ...b, order_index: i }));
    }

    // Оптимистичное обновление
    setBatches(prev => {
      const kept = prev.filter(b => b.line_id !== targetLineId && b.id !== draggedBatch.id);
      const oldLineUpdated = oldLineId !== targetLineId
        ? prev.filter(b => b.line_id === oldLineId && b.id !== draggedBatch.id)
            .map((b, i) => ({ ...b, order_index: i }))
        : [];
      return [...kept, ...oldLineUpdated, ...reordered];
    });

    // Сохраняем
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      setSaving(true);
      try {
        await reorderApi.batches({
          batch_id: draggedBatch.id,
          new_line_id: targetLineId,
          ordered_ids: reordered.map(b => b.id),
          old_line_id: oldLineId !== targetLineId ? oldLineId : undefined,
        });
        // Перезагружаем для актуальных start/end времён
        const fresh = await batchesApi.list();
        setBatches(fresh.sort((a, b) => a.order_index - b.order_index));
      } catch {
        // Откат при ошибке
        load();
      } finally {
        setSaving(false);
      }
    }, 300);
  };

  const visibleLines = LINES.filter(l => lineFilter === 'all' || l.id === lineFilter);
  const visibleBatches = lineFilter === 'all'
    ? batches.filter(b => {
        if (!search) return true;
        const q = search.toLowerCase();
        return b.name.toLowerCase().includes(q) || b.client.toLowerCase().includes(q);
      })
    : getBatchesForLine(lineFilter);

  return (
    <div className="px-4 md:px-6 py-4 md:py-6 animate-fade-in w-full min-w-0 max-w-full overflow-hidden">
      {/* Toolbar — строка 1: фильтр линий */}
      <div className="flex flex-wrap gap-1.5 mb-3 min-w-0">
        <button onClick={() => setLineFilter('all')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all shrink-0 ${lineFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
          Все
        </button>
        {LINES.map(l => (
          <button key={l.id} onClick={() => setLineFilter(l.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all shrink-0 ${lineFilter === l.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
            {l.name}
          </button>
        ))}
      </div>

      {/* Toolbar — строка 2: переключатель вида + кнопки */}
      <div className="flex flex-wrap items-center gap-2 mb-5 min-w-0">
        <div className="flex items-center bg-secondary rounded-md p-0.5 shrink-0">
          <button onClick={() => setViewMode('board')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all ${viewMode === 'board' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Icon name="Columns" size={12} />
            <span className="hidden sm:inline">Колонки</span>
          </button>
          <button onClick={() => setViewMode('table')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all ${viewMode === 'table' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            <Icon name="Table" size={12} />
            <span className="hidden sm:inline">Таблица</span>
          </button>
        </div>

        <button onClick={load}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary text-muted-foreground hover:text-foreground rounded-md text-xs transition-colors shrink-0">
          <Icon name="RefreshCw" size={12} />
          <span className="hidden sm:inline">Обновить</span>
        </button>

        {saving && (
          <span className="flex items-center gap-1.5 text-xs text-primary ml-auto">
            <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span className="hidden sm:inline">Пересчёт...</span>
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span className="text-sm">Загрузка...</span>
          </div>
        </div>
      ) : viewMode === 'table' ? (
        <TableView batches={visibleBatches} onSelect={setSelected} onBatchesReorder={setBatches} />
      ) : (
        /* Board view with global DnD */
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 w-full min-w-0">
            {visibleLines.map(line => (
              <DroppableColumn
                key={line.id}
                line={line}
                batches={getBatchesForLine(line.id)}
                onSelect={setSelected}
                isDraggingOver={overId === line.id && activeDrag?.line_id !== line.id}
                isDragging={!!activeDrag}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {activeDrag && <DragCard batch={activeDrag} />}
          </DragOverlay>
        </DndContext>
      )}

      {!loading && batches.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <Icon name="Factory" size={48} className="mx-auto mb-3 opacity-20" />
          <div className="text-sm mb-1">Нет партий в производстве</div>
          <div className="text-xs opacity-60">Создайте заказ — партия появится автоматически</div>
        </div>
      )}

      {selected && <BatchDetail batch={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}