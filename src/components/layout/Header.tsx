import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import type { AppSection } from '@/types/erp';

const SECTION_TITLES: Record<AppSection, { title: string; subtitle: string }> = {
  dashboard: { title: 'Обзор производства', subtitle: 'Ключевые показатели и текущий статус' },
  orders: { title: 'Заказы клиентов', subtitle: 'Управление заказами и клиентами' },
  production: { title: 'План производства', subtitle: 'Расписание линий и партии розлива' },
  materials: { title: 'Сырьё и материалы', subtitle: 'Остатки, нормы расхода, закупки' },
  warehouse: { title: 'Склад', subtitle: 'Остатки, поступления, движения' },
  quality: { title: 'Качество / Лаборатория', subtitle: 'Анализы, допуски, сертификаты' },
  shipments: { title: 'Отгрузки', subtitle: 'Планирование и документы' },
};

interface HeaderProps {
  section: AppSection;
  search: string;
  onSearch: (v: string) => void;
}

export default function Header({ section, search, onSearch }: HeaderProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const { title, subtitle } = SECTION_TITLES[section];

  const fmt = (d: Date) =>
    d.toLocaleString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/60 backdrop-blur-sm sticky top-0 z-20">
      <div>
        <h1 className="text-lg font-bold text-foreground">{title}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
      </div>

      <div className="flex items-center gap-4">
        {/* Search */}
        <div className="relative">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Поиск..."
            className="w-48 bg-secondary/50 border border-border rounded-md pl-8 pr-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all"
          />
        </div>

        {/* Clock */}
        <div className="flex items-center gap-2 bg-secondary/50 border border-border rounded-md px-3 py-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-primary pulse-glow" />
          <span className="text-xs font-mono-vpk text-foreground tabular-nums">{fmt(now)}</span>
        </div>

        {/* Notifications */}
        <button className="relative w-8 h-8 flex items-center justify-center rounded-md bg-secondary/50 border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <Icon name="Bell" size={15} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />
        </button>
      </div>
    </header>
  );
}
