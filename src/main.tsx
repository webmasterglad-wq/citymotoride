import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initGlobalStorageSafety } from './utils/safeStorage';
import './index.css';

// Initialize safe localStorage in case private browsing or sandbox blocks it
initGlobalStorageSafety();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

