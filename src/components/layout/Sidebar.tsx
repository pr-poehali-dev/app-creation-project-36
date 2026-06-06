import Icon from '@/components/ui/icon';
import type { AppSection } from '@/types/erp';

interface NavItem {
  id: AppSection;
  label: string;
  icon: string;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Обзор', icon: 'LayoutDashboard' },
  { id: 'orders', label: 'Заказы', icon: 'ClipboardList', badge: 3 },
  { id: 'production', label: 'Производство', icon: 'Factory' },
  { id: 'materials', label: 'Сырьё', icon: 'Package' },
  { id: 'warehouse', label: 'Склад', icon: 'Warehouse' },
  { id: 'quality', label: 'Качество', icon: 'FlaskConical' },
  { id: 'shipments', label: 'Отгрузки', icon: 'Truck' },
];

interface SidebarProps {
  active: AppSection;
  onChange: (s: AppSection) => void;
}

export default function Sidebar({ active, onChange }: SidebarProps) {
  return (
    <aside className="flex flex-col w-56 min-h-screen bg-[hsl(var(--sidebar-background))] border-r border-border shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-border">
        <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center glow-primary">
          <Icon name="Zap" size={16} className="text-primary" />
        </div>
        <div>
          <div className="text-sm font-bold tracking-wide text-foreground">ВПК</div>
          <div className="text-[10px] text-muted-foreground font-mono-vpk uppercase tracking-widest">MES System</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        <div className="px-2 mb-3">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Навигация</span>
        </div>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={`nav-item w-full text-left ${active === item.id ? 'active' : 'text-muted-foreground'}`}
          >
            <Icon name={item.icon} size={16} />
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <span className="bg-primary/20 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full font-mono-vpk">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
            <Icon name="User" size={12} className="text-primary" />
          </div>
          <div>
            <div className="text-xs font-medium text-foreground">Администратор</div>
            <div className="text-[10px] text-muted-foreground">Иванов И.И.</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
