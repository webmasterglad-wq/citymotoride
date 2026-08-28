import React, { useState } from 'react';
import { ConnectionStatusBanner } from './components/ConnectionStatusBanner';
import { PassengerApp } from './components/PassengerApp';
import { CaptainApp } from './components/CaptainApp';
import { DualViewSimulator } from './components/DualViewSimulator';
import { AdminDashboard } from './components/AdminDashboard';
import { SqlSetupModal } from './components/SqlSetupModal';

export default function App() {
  const [activeView, setActiveView] = useState<'dual' | 'passenger' | 'captain' | 'admin'>('dual');
  const [isSqlModalOpen, setIsSqlModalOpen] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  const handleRefreshAll = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Realtime Navigation & Connection Header */}
      <ConnectionStatusBanner
        onOpenSqlModal={() => setIsSqlModalOpen(true)}
        onRefreshAll={handleRefreshAll}
        activeView={activeView}
        onChangeView={setActiveView}
      />

      {/* Main App Container */}
      <main className="flex-1 w-full" key={refreshKey}>
        {activeView === 'dual' && (
          <DualViewSimulator onOpenSqlModal={() => setIsSqlModalOpen(true)} />
        )}

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
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>MotoRide Real-Time Dispatch System · Supabase Realtime Engine</span>
          <span>Passenger: <code className="text-slate-400">motoride-passenger.vercel.app</code> · Captain: <code className="text-slate-400">motoride-captain.vercel.app</code></span>
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
