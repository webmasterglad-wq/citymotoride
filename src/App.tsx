import React, { useState } from 'react';
import { Star } from 'lucide-react';
import { ConnectionStatusBanner } from './components/ConnectionStatusBanner';
import { PassengerApp } from './components/PassengerApp';
import { CaptainApp } from './components/CaptainApp';
import { AdminDashboard } from './components/AdminDashboard';
import { SqlSetupModal } from './components/SqlSetupModal';
import { AuthScreen } from './components/AuthScreen';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { PricingProvider } from './context/PricingContext';
import { AuthProvider, useAuth } from './context/AuthContext';

function AppContent() {
  const [activeView, setActiveView] = useState<'passenger' | 'captain' | 'admin'>('passenger');
  const [isSqlModalOpen, setIsSqlModalOpen] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const { isLight } = useTheme();
  const { isAuthenticated, getUserForRole } = useAuth();

  const handleRefreshAll = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const passengerUser = getUserForRole('passenger');
  const captainUser = getUserForRole('captain');
  const isPassengerAuthed = isAuthenticated('passenger');
  const isCaptainAuthed = isAuthenticated('captain');
  const isAdminAuthed = isAuthenticated('admin');

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

      {/* Main App Container - Only Show App Features After Sign In */}
      <main className="flex-1 w-full flex flex-col justify-center" key={refreshKey}>
        {/* ================= ADMIN VIEW ================= */}
        {activeView === 'admin' && (
          !isAdminAuthed ? (
            <div className="py-8 px-4 my-auto">
              <AuthScreen
                role="admin"
                onOpenSqlModal={() => setIsSqlModalOpen(true)}
              />
            </div>
          ) : (
            <AdminDashboard onOpenSqlModal={() => setIsSqlModalOpen(true)} />
          )
        )}

        {/* ================= PASSENGER VIEW ================= */}
        {activeView === 'passenger' && (
          !isPassengerAuthed ? (
            <div className="py-8 px-4 my-auto">
              <AuthScreen
                role="passenger"
                onOpenSqlModal={() => setIsSqlModalOpen(true)}
              />
            </div>
          ) : (
            <div className="py-6 px-4">
              <PassengerApp
                passengerUser={passengerUser || undefined}
                onOpenSqlModal={() => setIsSqlModalOpen(true)}
              />
            </div>
          )
        )}

        {/* ================= CAPTAIN VIEW ================= */}
        {activeView === 'captain' && (
          !isCaptainAuthed ? (
            <div className="py-8 px-4 my-auto">
              <AuthScreen
                role="captain"
                onOpenSqlModal={() => setIsSqlModalOpen(true)}
              />
            </div>
          ) : (
            <div className="py-6 px-4">
              <CaptainApp
                captainUser={
                  captainUser || {
                    id: 'b82ac71b-39dd-4172-b567-0e02b2c3d981',
                    name: 'Captain Alex Rivera',
                    phone: '+1 (555) 749-3021',
                    role: 'captain',
                    rating: 4.96,
                    vehicle_details: 'Yamaha MT-07 · Stealth Black #7492',
                  }
                }
                titleSuffix={captainUser?.name?.split(' ')[1] || 'Alex'}
                onOpenSqlModal={() => setIsSqlModalOpen(true)}
              />
            </div>
          )
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
          <span className="font-medium">MotoRide Real-Time Dispatch System · Supabase Realtime & Auth Engine</span>
        </div>
      </footer>

      {/* SQL Setup Modal */}
      <SqlSetupModal
        isOpen={isSqlModalOpen}
        onClose={() => setIsSqlModalOpen(false)}
      />

      {/* Admin Panel Star Icon in last right corner bottom of main page */}
      <button
        type="button"
        id="admin-panel-star-btn"
        onClick={() => setActiveView(activeView === 'admin' ? 'passenger' : 'admin')}
        title="Admin Panel"
        aria-label="Admin Panel"
        className={`fixed bottom-4 right-4 z-50 p-2.5 sm:p-3 rounded-full border shadow-xl transition-all duration-200 cursor-pointer flex items-center justify-center hover:scale-110 active:scale-95 ${
          activeView === 'admin'
            ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-amber-400/30 ring-2 ring-amber-400/50'
            : isLight
            ? 'bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-800 border-slate-200 shadow-slate-900/10'
            : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-400 border-slate-800 shadow-black/40'
        }`}
      >
        <Star
          className={`w-5 h-5 transition-transform ${
            activeView === 'admin'
              ? 'fill-slate-950 text-slate-950 scale-110'
              : 'fill-amber-400 text-amber-500 hover:scale-110'
          }`}
        />
      </button>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <PricingProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </PricingProvider>
    </ThemeProvider>
  );
}
