import React from 'react';
import { AuthProvider } from './src/context/AuthProvider';
import { AuthGate } from './src/components/AuthGate';
import { FarmGate } from './src/components/FarmGate';
import { AppShell } from './src/components/AppShell';
import { db } from './src/db/powersync';
import './src/styles.css'; // Keep global styles if needed

export default function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <FarmGate>
          <AppShell />
        </FarmGate>
      </AuthGate>
    </AuthProvider>
  );
}
