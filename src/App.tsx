import React, { useState } from 'react';
import { ConnectionStatusBanner } from './components/ConnectionStatusBanner';
import { PassengerApp } from './components/PassengerApp';
import { CaptainApp } from './components/CaptainApp';
import { AdminDashboard } from './components/AdminDashboard';
import { SqlSetupModal } from './components/SqlSetupModal';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { PricingProvider } from './context/PricingContext';

function AppContent() {
  const [activeView, setActiveView] = useState<'passenger' | 'captain' | 'admin'>('passenger');
  const [isSqlModalOpen, setIsSqlModalOpen] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const { isLight } = useTheme();

  const handleRefreshAll = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div
      className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
        isLight
          ? 'bg-white text-slate-900 selection:bg-amber-400 selection:text-slate-950'
          : 'bg-slate-950 text-slate-100 selection:bg-amber-500 selection:text-slate-950'
      }`}
    >
      {/* Realtime Navigation & Connection Header */}
      <ConnectionStatusBanner
        onOpenSqlModal={() => setIsSqlModalOpen(true)}
        onRefreshAll={handleRefreshAll}
        activeView={activeView}
        onChangeView={setActiveView}
      />

      {/* Main App Container */}
      <main className="flex-1 w-full" key={refreshKey}>
        {activeView === 'admin' && (
          <AdminDashboard onOpenSqlModal={() => setIsSqlModalOpen(true)} />
        )}

        {activeView === 'passenger' && (
          <div className="py-6 px-4">
            <PassengerApp onOpenSqlModal={() => setIsSqlModalOpen(true)} />
          </div>
        )}

        {activeView === 'captain' && (
          <div className="py-6 px-4">
            <CaptainApp
              captainUser={{
                id: 'b82ac71b-39dd-4172-b567-0e02b2c3d981',
                name: 'Captain Alex Rivera',
                phone: '+1 (555) 749-3021',
                role: 'captain',
                rating: 4.96,
                vehicle_details: 'Yamaha MT-07 · Stealth Black #7492',
              }}
              titleSuffix="Alex"
              onOpenSqlModal={() => setIsSqlModalOpen(true)}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer
        className={`border-t py-4 px-6 text-center text-xs transition-colors duration-200 ${
          isLight
            ? 'border-slate-200 bg-slate-50/90 text-slate-600'
            : 'border-slate-900 bg-slate-950/80 text-slate-500'
        }`}
      >
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-2">
          <span className="font-medium">MotoRide Real-Time Dispatch System · Supabase Realtime Engine</span>
        </div>
      </footer>

      {/* SQL Setup Modal */}
      <SqlSetupModal
        isOpen={isSqlModalOpen}
        onClose={() => setIsSqlModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <PricingProvider>
        <AppContent />
      </PricingProvider>
    </ThemeProvider>
  );
}
