import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, StatusBar, ActivityIndicator, TouchableOpacity, Platform, Modal, Image } from 'react-native';
import './src/styles.css';
import { Theme } from './src/constants/Theme';
import { useSettings } from './src/hooks/useSettings';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { FieldListScreen } from './src/screens/FieldListScreen';
import { LogSessionScreen, LogType } from './src/screens/LogSessionScreen';
import { GrainDashboardScreen } from './src/screens/GrainDashboardScreen';
import { ReportsScreen } from './src/screens/ReportsScreen';
import { VaultScreen } from './src/screens/VaultScreen';
import { Field } from './src/hooks/useFields';
import { db } from './src/db/powersync';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LoginScreen } from './src/screens/LoginScreen';
import { connector } from './src/db/SupabaseConnector';
import { Session } from '@supabase/supabase-js';
import { ResponsiveLayout } from './src/components/ResponsiveLayout';
import { StatusOverlay } from './src/components/StatusOverlay';
import { useWindowDimensions } from 'react-native';

export default function App() {
  const { settings, loading, saveSettings } = useSettings();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState<'FIELDS' | 'GRAIN' | 'REPORTS' | 'VAULTS'>('FIELDS');
  const [vaultSubTab, setVaultSubTab] = useState<'CHEMICALS' | 'SEEDS' | 'LANDLORDS' | 'REPORTS' | 'SETTINGS'>('CHEMICALS');
  const [activeLog, setActiveLog] = useState<{
    type: LogType;
    source: { id: string, name: string, acreage?: number, type: 'FIELD' | 'BIN' };
  } | null>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;

  useEffect(() => {
    // 1. Get initial session
    connector.client.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = connector.client.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 3. Auto-sync on login: push local data to cloud, then pull updates
  useEffect(() => {
    if (session?.user && !authLoading) {
      const { SyncUtility } = require('./src/utils/SyncUtility');
      if (!SyncUtility.isNativeStreamingAvailable()) {
        setBootstrapping(true);
        // Wait for PowerSync to load data from IndexedDB before pushing
        setTimeout(async () => {
          try {
            await SyncUtility.pushAllLocalData();
            await SyncUtility.bootstrapDevice(session.user.id);
            setIsConnected(true); // Mark as synced
          } catch (e) {
            console.error('[AutoSync]', e);
          } finally {
            setBootstrapping(false);
          }
        }, 2000);
      }
    }
  }, [session?.user?.id, authLoading]);

  useEffect(() => {
    if (!loading && !bootstrapping) {
      setShowOnboarding(!settings?.onboarding_completed);
    }
  }, [loading, bootstrapping, settings]);

  useEffect(() => {
    // On web, start as not-connected; will be set to true after auto-sync completes
    const isWeb = Platform.OS === 'web';
    if (!isWeb) setIsConnected(!!(db as any).status?.connected);

    // Listen for changes (only relevant for native)
    const unsubscribe = db.registerListener({
      statusChanged: (status) => {
        setIsConnected(!isWeb && !!status.connected);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading || authLoading || bootstrapping) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={styles.loadingText}>{bootstrapping ? 'Syncing your farm data...' : 'Loading FarmFlow...'}</Text>
      </View>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  if (showOnboarding) {
    return <OnboardingScreen onComplete={() => setShowOnboarding(false)} />;
  }

  if (activeLog) {
    return (
      <LogSessionScreen
        type={activeLog.type}
        fixedId={activeLog.source.id}
        fixedName={activeLog.source.name}
        fixedAcreage={activeLog.source.acreage}
        fixedType={activeLog.source.type}
        onClose={() => setActiveLog(null)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      {!isDesktop && (
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Image
              source={require('./assets/icon.png')}
              style={{ width: 40, height: 40, marginRight: 12, borderRadius: 8 }}
            />
            <View>
              <Text style={styles.headerTitle}>{settings?.farm_name || 'FarmFlow'}</Text>
              <Text style={styles.headerSubtitle}>{settings?.state || 'The Anti-ERP'}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.syncContainer}
            onPress={async () => {
              const { SyncUtility } = require('./src/utils/SyncUtility');
              const { showAlert } = require('./src/utils/AlertUtility');
              if (session?.user && !SyncUtility.isNativeStreamingAvailable()) {
                setBootstrapping(true);
                try {
                  const result = await SyncUtility.pushAllLocalData();
                  await SyncUtility.bootstrapDevice(session.user.id);
                  setIsConnected(true);
                  showAlert('Sync Complete', `Pushed ${result.pushed} rows to cloud.`);
                } catch (err: any) {
                  showAlert('Sync Failed', String(err?.message || err));
                } finally {
                  setBootstrapping(false);
                }
              }
            }}
          >
            <View style={[styles.syncDot, { backgroundColor: isConnected ? Theme.colors.success : Theme.colors.secondary }]} />
            <Text style={styles.syncText}>🔄 SYNC</Text>
          </TouchableOpacity>
        </View>
      )}

      <ResponsiveLayout
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onSyncPress={async () => {
          const { SyncUtility } = require('./src/utils/SyncUtility');
          const { showAlert } = require('./src/utils/AlertUtility');

          if (!session?.user || SyncUtility.isNativeStreamingAvailable()) return;

          try {
            setBootstrapping(true);
            // Push local data to cloud, then pull any new data back
            const result = await SyncUtility.pushAllLocalData();
            await SyncUtility.bootstrapDevice(session.user.id);
            setIsConnected(true);
            showAlert('Sync Complete', `Pushed ${result.pushed} rows to cloud.\nYour farm data is now available on all devices.`);
          } catch (err: any) {
            showAlert('Sync Error', err.message);
          } finally {
            setBootstrapping(false);
          }
        }}
        farmName={settings?.farm_name || 'FarmFlow'}
        isConnected={isConnected}
        isSyncing={bootstrapping}
      >
        {width <= 768 && (
          <StatusOverlay
            isConnected={isConnected}
            isSyncing={bootstrapping}
            onRetry={() => {
              // Direct retry logic for mobile overlay
              const { SyncUtility } = require('./src/utils/SyncUtility');
              if (session?.user && !SyncUtility.isNativeStreamingAvailable()) {
                setBootstrapping(true);
                SyncUtility.pushAllLocalData()
                  .then(() => SyncUtility.bootstrapDevice(session.user.id))
                  .then(() => setIsConnected(true))
                  .finally(() => setBootstrapping(false));
              }
            }}
          />
        )}

        <View style={styles.content}>
          {activeTab === 'FIELDS' ? (
            <FieldListScreen
              onSelectAction={(field, type) => setActiveLog({
                type,
                source: { id: field.id, name: field.name, acreage: field.acreage, type: 'FIELD' }
              })}
            />
          ) : activeTab === 'GRAIN' ? (
            <GrainDashboardScreen
              onSelectAction={(id, name, type) => setActiveLog({
                type,
                source: { id, name, type: 'BIN' }
              })}
            />
          ) : activeTab === 'REPORTS' ? (
            <ReportsScreen />
          ) : (
            <VaultScreen initialTab={vaultSubTab} />
          )}
        </View>
      </ResponsiveLayout>

      {!isDesktop && (
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'FIELDS' && styles.activeTab]}
            onPress={() => setActiveTab('FIELDS')}
          >
            <Text style={[styles.tabText, activeTab === 'FIELDS' && styles.activeTabText]}>Fields</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'GRAIN' && styles.activeTab]}
            onPress={() => setActiveTab('GRAIN')}
          >
            <Text style={[styles.tabText, activeTab === 'GRAIN' && styles.activeTabText]}>Grain</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'VAULTS' && styles.activeTab]}
            onPress={() => setActiveTab('VAULTS')}
          >
            <Text style={[styles.tabText, activeTab === 'VAULTS' && styles.activeTabText]}>Vaults</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'REPORTS' && styles.activeTab]}
            onPress={() => setActiveTab('REPORTS')}
          >
            <Text style={[styles.tabText, activeTab === 'REPORTS' && styles.activeTabText]}>Reports</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Theme.colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Theme.colors.background },
  loadingText: { marginTop: Theme.spacing.md, ...Theme.typography.body, color: Theme.colors.textSecondary },
  header: {
    padding: Theme.spacing.lg,
    backgroundColor: Theme.colors.primary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: { ...Theme.typography.h1, color: Theme.colors.white },
  headerSubtitle: { ...Theme.typography.caption, color: Theme.colors.whiteMuted },
  content: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: Theme.colors.white,
    borderTopWidth: 1,
    borderTopColor: Theme.colors.border,
  },
  tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  activeTab: { borderTopWidth: 3, borderTopColor: Theme.colors.primary },
  tabText: { ...Theme.typography.caption, fontWeight: 'bold' },
  activeTabText: { color: Theme.colors.primary },
  syncContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  syncDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  syncText: { ...Theme.typography.caption, color: Theme.colors.white, fontWeight: 'bold' }
});
