import { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import Icon from '@/components/ui/icon';
import {
  clientCardApi,
  type ClientProject,
  type ProjectClientCard,
  type SkuRow,
} from '@/api/client';

// ─── Маппинг полей листа «Информация» ───────────────────────────────────────
// Ключ = подстрока названия строки в Excel (регистронезависимо)
// Значение = ключ в parsed_data

const FIELD_MAP: { keys: string[]; field: string; label: string; required?: boolean }[] = [
  { keys: ['полное наименование юридического'],  field: 'legal_name',     label: 'Полное юридическое наименование', required: true },
  { keys: ['сокращенное наименование', 'краткое наименование'], field: 'short_name', label: 'Сокращённое наименование' },
  { keys: ['место нахождения'],                  field: 'location',       label: 'Место нахождения' },
  { keys: ['юридический', 'почтовый адрес'],     field: 'legal_address',  label: 'Юридический / почтовый адрес' },
  { keys: ['генеральный директор', 'директор'],  field: 'director',       label: 'Генеральный директор' },
  { keys: ['e-mail', 'email', 'почта'],          field: 'email',          label: 'Email', required: true },
  { keys: ['торговая марка', 'торговый знак'],   field: 'trademark',      label: 'Торговая марка / знак', required: true },
  { keys: ['кто оформляет дс', 'оформление дс', 'дс:'], field: 'ds_type', label: 'Кто оформляет ДС', required: true },
  { keys: ['схема укладки'],                     field: 'pallet_scheme',  label: 'Схема укладки на паллет' },
  { keys: ['тип оформления', 'сливер', 'литография', 'тип банки'], field: 'can_label_type', label: 'Тип оформления банки', required: true },
  { keys: ['цвет обезличенной', 'цвет банки'],   field: 'can_color',      label: 'Цвет обезличенной банки' },
  { keys: ['цвет крышки'],                       field: 'lid_color',      label: 'Цвет крышки', required: true },
  { keys: ['комментарий по документам', 'комментарий клиента'], field: 'doc_comment', label: 'Комментарий по документам' },
];

const REQUIRED_FIELDS = FIELD_MAP.filter(f => f.required).map(f => f.field);

const CARD_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  empty:              { label: 'Не заполнена',        color: 'text-muted-foreground' },
  needs_clarification:{ label: 'Требует уточнения',   color: 'text-yellow-400' },
  filled:             { label: 'Заполнена',            color: 'text-emerald-400' },
};

// ─── Утилиты парсинга ────────────────────────────────────────────────────────

function cellStr(cell: XLSX.CellObject | undefined): string {
  if (!cell) return '';
  return String(cell.v ?? '').trim();
}

/** Ищем значение по подстроке лейбла в первой колонке, берём из второй */
function extractFields(sheet: XLSX.WorkSheet): Record<string, string> {
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z100');
  const result: Record<string, string> = {};

  for (let R = range.s.r; R <= range.e.r; R++) {
    const labelCell = sheet[XLSX.utils.encode_cell({ r: R, c: 0 })]
      || sheet[XLSX.utils.encode_cell({ r: R, c: 1 })];
    if (!labelCell) continue;
    const labelText = cellStr(labelCell).toLowerCase();

    for (const { keys, field } of FIELD_MAP) {
      if (result[field]) continue; // уже нашли
      if (keys.some(k => labelText.includes(k))) {
        // Берём значение из следующих колонок (c=1,2,3…)
        for (let C = 1; C <= Math.min(range.e.c, 5); C++) {
          const valCell = sheet[XLSX.utils.encode_cell({ r: R, c: C })];
          const val = cellStr(valCell);
          if (val && val.toLowerCase() !== labelText) {
            result[field] = val;
            break;
          }
        }
      }
    }
  }
  return result;
}

/** Читаем лист «Рецептуры» — ищем строки с данными напитков */
function extractSkus(sheet: XLSX.WorkSheet): SkuRow[] {
  const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' }) as string[][];
  const skus: SkuRow[] = [];

  // Ищем строку-заголовок с «наименование» или «напиток»
  let headerRow = -1;
  let colNum = -1, colName = -1, colGost = -1, colBarcode = -1, colBarcode12 = -1;

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowStr = row.map(c => String(c).toLowerCase());
    if (
      rowStr.some(c => c.includes('наименование') || c.includes('напиток')) &&
      rowStr.some(c => c.includes('номер') || c.includes('№') || c.includes('шк') || c.includes('гост'))
    ) {
      headerRow = i;
      rowStr.forEach((cell, idx) => {
        if (cell.includes('№') || cell === 'номер' || cell === '#') colNum = idx;
        if (cell.includes('наименование') && !cell.includes('шк')) colName = idx;
        if (cell.includes('гост')) colGost = idx;
        if (cell.includes('шк') && !cell.includes('12')) colBarcode = idx;
        if (cell.includes('шк') && cell.includes('12')) colBarcode12 = idx;
        if (cell.includes('шк на ед')) colBarcode = idx;
        if (cell.includes('спайк')) colBarcode12 = idx;
      });
      break;
    }
  }

  if (headerRow === -1) {
    // Нет заголовка — пробуем читать как простой список напитков с 1-й строки
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const name = String(row[1] || row[0] || '').trim();
      if (name && name.length > 2 && !/наименование|напиток|гост|шк/i.test(name)) {
        skus.push({
          num: String(row[0] || i + 1),
          name,
          gost: String(row[2] || ''),
          barcode_unit: String(row[3] || ''),
          barcode_12x: String(row[4] || ''),
        });
      }
    }
    return skus.slice(0, 50);
  }

  for (let i = headerRow + 1; i < data.length; i++) {
    const row = data[i];
    const nameVal = colName >= 0 ? String(row[colName] || '') : String(row[1] || row[0] || '');
    if (!nameVal.trim() || nameVal.length < 2) continue;

    skus.push({
      num: colNum >= 0 ? String(row[colNum] || i - headerRow) : String(i - headerRow),
      name: nameVal.trim(),
      gost: colGost >= 0 ? String(row[colGost] || '') : '',
      barcode_unit: colBarcode >= 0 ? String(row[colBarcode] || '') : '',
      barcode_12x: colBarcode12 >= 0 ? String(row[colBarcode12] || '') : '',
    });
  }

  return skus.slice(0, 50);
}

// ─── Компонент поля карточки ──────────────────────────────────────────────────

function CardField({
  label,
  field,
  value,
  required,
  onChange,
}: {
  label: string;
  field: string;
  value: string;
  required?: boolean;
  onChange: (field: string, val: string) => void;
}) {
  const missing = required && !value.trim();
  return (
    <div>
      <label className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1">
        {label}
        {required && <span className="text-red-400">*</span>}
        {missing && (
          <span className="ml-auto text-[10px] text-yellow-400 flex items-center gap-0.5">
            <Icon name="AlertCircle" size={9} />требует заполнения
          </span>
        )}
      </label>
      <input
        value={value}
        onChange={e => onChange(field, e.target.value)}
        className={`w-full bg-secondary/50 border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 transition-colors ${
          missing
            ? 'border-yellow-500/60 bg-yellow-500/5 focus:ring-yellow-500/40'
            : 'border-border focus:ring-primary/50'
        }`}
      />
    </div>
  );
}

// ─── Главная вкладка ──────────────────────────────────────────────────────────

export default function TabClientCard({ project }: { project: ClientProject }) {
  const [card, setCard] = useState<ProjectClientCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Редактируемые поля
  const [fields, setFields] = useState<Record<string, string>>({});
  const [skus, setSkus] = useState<SkuRow[]>([]);
  const [fileName, setFileName] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    clientCardApi.get(project.id)
      .then(c => {
        if (c) {
          setCard(c);
          initFromCard(c);
        }
      })
      .finally(() => setLoading(false));
  }, [project.id]);

  const initFromCard = (c: ProjectClientCard) => {
    const f: Record<string, string> = {};
    FIELD_MAP.forEach(({ field }) => {
      f[field] = (c as unknown as Record<string, string>)[field] || '';
    });
    setFields(f);
    setSkus(c.skus || []);
    setFileName(c.file_name || '');
  };

  const showToast = (type: 'ok' | 'err', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  // ─ Парсинг Excel в браузере ─
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: 'array' });

      // Ищем лист «Информация» (или первый лист)
      const infoSheetName =
        wb.SheetNames.find(n => n.toLowerCase().includes('информ')) ||
        wb.SheetNames[0];
      const infoSheet = wb.Sheets[infoSheetName];
      const parsed = infoSheet ? extractFields(infoSheet) : {};

      // Ищем лист «Рецептуры» (или второй лист)
      const recipSheetName =
        wb.SheetNames.find(n =>
          n.toLowerCase().includes('рецептур') ||
          n.toLowerCase().includes('напиток') ||
          n.toLowerCase().includes('sku')
        ) || wb.SheetNames[1];
      const recipSheet = recipSheetName ? wb.Sheets[recipSheetName] : null;
      const parsedSkus = recipSheet ? extractSkus(recipSheet) : [];

      // Заполняем поля
      const newFields: Record<string, string> = {};
      FIELD_MAP.forEach(({ field }) => {
        newFields[field] = parsed[field] || '';
      });
      setFields(newFields);
      setSkus(parsedSkus);
      setFileName(file.name);

      // Конвертируем в base64 для отправки на бэк
      const b64 = btoa(
        new Uint8Array(ab).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      // Отправляем на сервер
      const result = await clientCardApi.upload(project.id, {
        file_name: file.name,
        file_b64: b64,
        parsed_data: parsed,
        skus: parsedSkus,
      });
      setCard(result.card);

      showToast(
        'ok',
        `Карточка клиента загружена. Данные перенесены в проект. Распознано полей: ${Object.values(parsed).filter(Boolean).length}, напитков: ${parsedSkus.length}.`
      );
    } catch (err) {
      showToast('err', 'Ошибка чтения файла. Проверьте формат Excel.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ─ Ручное сохранение полей ─
  const handleSave = async () => {
    setSaving(true);
    try {
      const result = await clientCardApi.upload(project.id, {
        file_name: fileName,
        parsed_data: fields,
        skus,
      });
      setCard(result.card);
      showToast('ok', 'Данные сохранены.');
    } finally {
      setSaving(false);
    }
  };

  const setField = (field: string, val: string) =>
    setFields(prev => ({ ...prev, [field]: val }));

  // Подсчёт заполненности
  const filledRequired = REQUIRED_FIELDS.filter(f => fields[f]?.trim()).length;
  const totalRequired = REQUIRED_FIELDS.length + 1; // +1 за SKU
  const hasSkus = skus.length > 0;
  const allDone = filledRequired === REQUIRED_FIELDS.length && hasSkus;
  const pct = Math.round(((filledRequired + (hasSkus ? 1 : 0)) / totalRequired) * 100);

  const statusInfo = CARD_STATUS_LABELS[card?.card_status || 'empty'];

  if (loading) {
    return <div className="py-12 text-center text-muted-foreground text-sm">Загрузка...</div>;
  }

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className={`flex items-start gap-2 px-4 py-3 rounded-lg text-sm ${
          toast.type === 'ok'
            ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
            : 'bg-red-500/10 border border-red-500/30 text-red-300'
        }`}>
          <Icon name={toast.type === 'ok' ? 'CheckCircle2' : 'AlertCircle'} size={16} className="shrink-0 mt-0.5" />
          <span>{toast.text}</span>
        </div>
      )}

      {/* Шапка: статус + загрузка */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${allDone ? 'bg-emerald-400' : 'bg-yellow-400'}`} />
          <span className={`text-sm font-semibold ${statusInfo.color}`}>{statusInfo.label}</span>
          <span className="text-xs text-muted-foreground font-mono-vpk">({pct}%)</span>
        </div>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {card?.file_url && (
            <a
              href={card.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-muted-foreground hover:text-foreground rounded-md text-xs transition-colors"
            >
              <Icon name="Download" size={12} />
              {card.file_name || 'Скачать файл'}
            </a>
          )}

          <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
            uploading
              ? 'bg-primary/40 text-primary-foreground cursor-wait'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}>
            {uploading ? (
              <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Читаю файл...</>
            ) : (
              <><Icon name="Upload" size={12} />{card ? 'Заменить файл' : 'Загрузить карточку клиента'}</>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {/* Прогресс-бар заполненности */}
      <div>
        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
          <span>Обязательные поля</span>
          <span className="font-mono-vpk">{filledRequired + (hasSkus ? 1 : 0)} / {totalRequired}</span>
        </div>
        <div className="h-1.5 bg-border rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: allDone ? '#10b981' : '#f59e0b' }}
          />
        </div>
      </div>

      {/* Подсказка если нет файла */}
      {!card && (
        <div className="border border-dashed border-border rounded-xl p-6 text-center text-muted-foreground">
          <Icon name="FileSpreadsheet" size={36} className="mx-auto mb-3 opacity-30" />
          <div className="text-sm font-medium mb-1">Загрузите «Бланк для заполнения клиентом.xlsx»</div>
          <div className="text-xs opacity-60 mb-4">
            Система считает лист «Информация» и лист «Рецептуры» автоматически
          </div>
          <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground/70">
            <span className="flex items-center gap-1"><Icon name="CheckCircle2" size={11} className="text-primary" />Лист «Информация» → поля карточки</span>
            <span className="flex items-center gap-1"><Icon name="CheckCircle2" size={11} className="text-primary" />Лист «Рецептуры» → список напитков</span>
            <span className="flex items-center gap-1"><Icon name="CheckCircle2" size={11} className="text-primary" />Исходный файл сохраняется</span>
          </div>
        </div>
      )}

      {/* Поля карточки — отображаются всегда */}
      <>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Icon name="Building2" size={14} className="text-primary" />
              <span className="text-sm font-bold text-foreground">Юридические данные</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FIELD_MAP.slice(0, 6).map(({ field, label, required }) => (
                <CardField
                  key={field}
                  label={label}
                  field={field}
                  value={fields[field] || ''}
                  required={required}
                  onChange={setField}
                />
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Icon name="Package" size={14} className="text-primary" />
              <span className="text-sm font-bold text-foreground">Параметры продукта</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {FIELD_MAP.slice(6).map(({ field, label, required }) => (
                <CardField
                  key={field}
                  label={label}
                  field={field}
                  value={fields[field] || ''}
                  required={required}
                  onChange={setField}
                />
              ))}
            </div>
          </div>

          {/* SKU / Напитки */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon name="FlaskConical" size={14} className="text-primary" />
                <span className="text-sm font-bold text-foreground">Напитки / SKU</span>
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono-vpk ${
                  skus.length > 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-yellow-500/15 text-yellow-400'
                }`}>
                  {skus.length > 0 ? `${skus.length} напитков` : 'не заполнено*'}
                </span>
              </div>
              <button
                onClick={() => setSkus(prev => [...prev, { num: String(prev.length + 1), name: '', gost: '', barcode_unit: '', barcode_12x: '' }])}
                className="flex items-center gap-1 px-2.5 py-1 bg-secondary text-muted-foreground hover:text-foreground rounded text-xs transition-colors"
              >
                <Icon name="Plus" size={11} />Добавить
              </button>
            </div>

            {skus.length === 0 ? (
              <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-lg p-4 text-center text-sm text-yellow-300">
                <Icon name="AlertCircle" size={16} className="mx-auto mb-1 opacity-70" />
                Минимум 1 напиток обязателен — загрузите Excel или добавьте вручную
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-x-auto">
                <table className="w-full min-w-[560px]">
                  <thead>
                    <tr className="bg-secondary/40 border-b border-border text-[11px] text-muted-foreground uppercase">
                      <th className="px-2 py-2 text-center w-10">№</th>
                      <th className="px-3 py-2 text-left">Наименование напитка</th>
                      <th className="px-3 py-2 text-left w-24">ГОСТ</th>
                      <th className="px-3 py-2 text-left w-32">ШК на ед.</th>
                      <th className="px-3 py-2 text-left w-32">ШК 12×</th>
                      <th className="px-2 py-2 w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {skus.map((sku, idx) => (
                      <tr key={idx} className="border-b border-border/40">
                        <td className="px-2 py-1.5 text-center text-xs text-muted-foreground font-mono-vpk">{idx + 1}</td>
                        {(['name', 'gost', 'barcode_unit', 'barcode_12x'] as (keyof SkuRow)[]).map(col => (
                          <td key={col} className="px-1 py-1">
                            <input
                              value={sku[col]}
                              onChange={e => setSkus(prev => prev.map((s, i) => i === idx ? { ...s, [col]: e.target.value } : s))}
                              className={`w-full bg-transparent border border-transparent hover:border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:border-primary/50 focus:bg-secondary/50 transition-colors ${
                                col === 'name' && !sku.name ? 'border-yellow-500/40 bg-yellow-500/5' : ''
                              }`}
                              placeholder={col === 'name' ? 'Название напитка *' : '—'}
                            />
                          </td>
                        ))}
                        <td className="px-1 py-1.5">
                          <button
                            onClick={() => setSkus(prev => prev.filter((_, i) => i !== idx))}
                            className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-red-400 transition-colors"
                          >
                            <Icon name="X" size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Кнопка сохранения */}
          <div className="flex items-center gap-3 pt-2 border-t border-border">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <Icon name="Save" size={14} />}
              Сохранить изменения
            </button>

            {allDone && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <Icon name="CheckCircle2" size={13} />
                Карточка заполнена — этап «Карточка клиента» готов
              </span>
            )}
          </div>
      </>
    </div>
  );
}