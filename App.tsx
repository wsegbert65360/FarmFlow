import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, StatusBar, ActivityIndicator, TouchableOpacity, Platform, Alert, Modal, Image } from 'react-native';
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

export default function App() {
  const { settings, loading } = useSettings();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [activeTab, setActiveTab] = useState<'FIELDS' | 'GRAIN' | 'REPORTS' | 'VAULTS'>('FIELDS');
  const [activeLog, setActiveLog] = useState<{
    type: LogType;
    source: { id: string, name: string, acreage?: number, type: 'FIELD' | 'BIN' };
  } | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const { saveSettings } = useSettings();

  useEffect(() => {
    if (!loading) {
      setShowOnboarding(!settings?.onboarding_completed);
    }
  }, [loading, settings]);

  useEffect(() => {
    // Initial status
    setIsConnected(Platform.OS === 'web' || !!(db as any).status?.connected);

    // Listen for changes
    const unsubscribe = db.registerListener({
      statusChanged: (status) => {
        setIsConnected(Platform.OS === 'web' || !!status.connected);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={styles.loadingText}>Loading FarmFlow...</Text>
      </View>
    );
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
            if (!isConnected && Platform.OS !== 'web') {
              const { status } = await requestPermission();
              if (status === 'granted') setShowScanner(true);
              else Alert.alert('Camera Permission Required', 'Please enable camera to scan the sync QR.');
            }
          }}
        >
          <View style={[styles.syncDot, { backgroundColor: isConnected ? Theme.colors.success : Theme.colors.secondary }]} />
          <Text style={styles.syncText}>
            {Platform.OS === 'web' ? 'LOCAL ONLY' : (isConnected ? 'SYNCED' : 'OFFLINE')}
          </Text>
          {Platform.OS !== 'web' && !isConnected && <Text style={[styles.syncText, { marginLeft: 4, opacity: 0.7 }]}>tap to scan</Text>}
        </TouchableOpacity>
      </View>

      {showScanner && (
        <Modal visible={showScanner} animationType="slide">
          <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
            <View style={{ flex: 1 }}>
              <CameraView
                style={StyleSheet.absoluteFill}
                onBarcodeScanned={(result) => {
                  try {
                    const data = JSON.parse(result.data);
                    if (data.k || data.t || data.f) {
                      saveSettings({
                        supabase_anon_key: data.k || '',
                        farm_join_token: data.t || '',
                        farm_id: data.f || '',
                        farm_name: data.n || undefined
                      });
                      setShowScanner(false);
                      Alert.alert('Connected', 'Farm credentials imported! FarmFlow is now online.');
                    }
                  } catch (e) {
                    console.error('Invalid QR', e);
                  }
                }}
              />
              <View style={styles.scannerOverlay}>
                <Text style={styles.scannerText}>Scan the Sync QR from your computer screen</Text>
                <TouchableOpacity style={styles.closeScanner} onPress={() => setShowScanner(false)}>
                  <Text style={styles.closeScannerText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </Modal>
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
          <VaultScreen />
        )}
      </View>

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
  syncText: { ...Theme.typography.caption, color: Theme.colors.white, fontWeight: 'bold' },
  scannerOverlay: { flex: 1, justifyContent: 'space-between', alignItems: 'center', padding: 40 },
  scannerText: { color: 'white', backgroundColor: 'rgba(0,0,0,0.6)', padding: 12, borderRadius: 20, textAlign: 'center', fontWeight: 'bold' },
  closeScanner: { backgroundColor: Theme.colors.secondary, padding: 15, borderRadius: 30, width: 200, alignItems: 'center' },
  closeScannerText: { color: 'white', fontWeight: 'bold' }
});
