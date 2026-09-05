import React, { useState, useEffect } from 'react';
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

  // Automatically keep view synced with authenticated role:
  // When passenger signs in, ensure view is not captain.
  // When captain signs in, ensure view is not passenger.
  useEffect(() => {
    if (isPassengerAuthed && activeView === 'captain') {
      setActiveView('passenger');
    } else if (isCaptainAuthed && activeView === 'passenger') {
      setActiveView('captain');
    }
  }, [isPassengerAuthed, isCaptainAuthed, activeView]);

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

        {/* ================= PASSENGER VIEW (Hidden if captain is signed in) ================= */}
        {activeView === 'passenger' && !isCaptainAuthed && (
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
                passengerUser={
                  passengerUser
                    ? {
                        id: passengerUser.id,
                        name: passengerUser.name,
                        email: passengerUser.email,
                        phone: passengerUser.phone,
                        role: 'passenger',
                        rating: passengerUser.rating || 5.0,
                        avatar_url: passengerUser.avatar_url,
                      }
                    : undefined
                }
                onOpenSqlModal={() => setIsSqlModalOpen(true)}
              />
            </div>
          )
        )}

        {/* ================= CAPTAIN VIEW (Hidden if passenger is signed in) ================= */}
        {activeView === 'captain' && !isPassengerAuthed && (
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
                  captainUser
                    ? {
                        id: captainUser.id,
                        name: captainUser.name,
                        email: captainUser.email,
                        phone: captainUser.phone,
                        role: 'captain',
                        rating: captainUser.rating || 5.0,
                        vehicle_details: captainUser.vehicle_details || '',
                        avatar_url: captainUser.avatar_url,
                      }
                    : undefined
                }
                titleSuffix={captainUser?.name ? captainUser.name.split(' ')[0] : ''}
                onOpenSqlModal={() => setIsSqlModalOpen(true)}
              />
            </div>
          )
        )}
      </main>

      {/* Footer System Status - Only shown on main page when both passenger and captain account are signed out */}
      {!isPassengerAuthed && !isCaptainAuthed && (
        <footer
          className={`border-t py-4 px-6 text-center text-xs transition-colors duration-200 ${
            isLight
              ? 'border-slate-200 bg-slate-50/90 text-slate-600'
              : 'border-slate-900 bg-slate-950/80 text-slate-500'
          }`}
        >
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-1.5">
            <span className="font-medium">MotoRide Real-Time Dispatch System · Supabase Realtime &amp;</span>
            <button
              type="button"
              id="admin-dashboard-auth-engine-link"
              onClick={() => setActiveView('admin')}
              title="Open Admin Dashboard"
              className={`font-semibold underline underline-offset-4 decoration-amber-500/60 hover:decoration-amber-500 transition-colors cursor-pointer inline-flex items-center gap-1 ${
                activeView === 'admin'
                  ? 'text-amber-500 font-bold decoration-amber-500'
                  : isLight
                  ? 'text-slate-700 hover:text-amber-600'
                  : 'text-slate-400 hover:text-amber-400'
              }`}
            >
              Auth Engine
            </button>
          </div>
        </footer>
      )}

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
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </PricingProvider>
    </ThemeProvider>
  );
}
