import { useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Dashboard from '@/components/sections/Dashboard';
import Orders from '@/components/sections/Orders';
import Production from '@/components/sections/Production';
import Materials from '@/components/sections/Materials';
import Warehouse from '@/components/sections/Warehouse';
import Quality from '@/components/sections/Quality';
import Shipments from '@/components/sections/Shipments';
import type { AppSection } from '@/types/erp';

export default function Index() {
  const [section, setSection] = useState<AppSection>('dashboard');
  const [search, setSearch] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const renderSection = () => {
    switch (section) {
      case 'dashboard': return <Dashboard />;
      case 'orders': return <Orders search={search} />;
      case 'production': return <Production search={search} />;
      case 'materials': return <Materials search={search} />;
      case 'warehouse': return <Warehouse search={search} />;
      case 'quality': return <Quality search={search} />;
      case 'shipments': return <Shipments search={search} />;
      default: return <Dashboard />;
    }
  };

  const handleSectionChange = (s: AppSection) => {
    setSection(s);
    setSearch('');
    setSidebarOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-background font-golos">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed lg:static inset-y-0 left-0 z-40 lg:z-auto transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <Sidebar active={section} onChange={handleSectionChange} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div className="flex lg:hidden items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-8 h-8 flex items-center justify-center rounded-md bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <path d="M1.5 3h12M1.5 7.5h12M1.5 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </div>
            <span className="text-sm font-bold text-foreground">ВПК</span>
          </div>
        </div>

        <Header section={section} search={search} onSearch={setSearch} />

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden w-full min-w-0">
          {renderSection()}
        </main>
      </div>
    </div>
  );
}