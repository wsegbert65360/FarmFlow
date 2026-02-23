import React from 'react';
import { AuthProvider } from './src/context/AuthProvider';
import { AuthGate } from './src/components/AuthGate';
import { FarmGate } from './src/components/FarmGate';
import { AppShell } from './src/components/AppShell';
import { db } from './src/db/powersync';
import './src/global.css';
import './src/styles.css'; // Keep global styles if needed

import { ErrorBoundary } from './src/components/common/ErrorBoundary';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AuthGate>
          <FarmGate>
            <AppShell />
          </FarmGate>
        </AuthGate>
      </AuthProvider>
    </ErrorBoundary>
  );
}
