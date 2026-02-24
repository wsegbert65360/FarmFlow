import React, { useState, useEffect, useContext } from 'react';
import { StyleSheet, Text, View, SafeAreaView, StatusBar, TouchableOpacity, Image, useWindowDimensions, Modal } from 'react-native';
import { Theme } from '../constants/Theme';
import { useSettings } from '../hooks/useSettings';
import { SyncStatusPill } from './SyncStatusPill';
import { ResponsiveLayout } from './ResponsiveLayout';
import { StatusOverlay } from './StatusOverlay';

// Unused tabs removed to prevent potential circular dependencies
import { DashboardTab } from '../screens/tabs/DashboardTab';
import { ManageTab } from '../screens/tabs/ManageTab';
import { SettingsTab } from '../screens/tabs/SettingsTab';
import { MoreTab } from '../screens/tabs/MoreTab';
import { LogSessionScreen, LogType } from '../screens/LogSessionScreen';
import { HeaderHelper } from './HeaderHelper';
import { db } from '../db/powersync';
import { useAuth } from '../hooks/useAuth';
import { AuthContext } from '../context/AuthProvider';
import { FarmSwitcherModal } from './modals/FarmSwitcherModal';
import { TabBar, TabType } from './navigation/TabBar';
import { ErrorBoundary } from './common/ErrorBoundary';
import { WeatherWidget } from './WeatherWidget';
import { FloatingActionButton } from './common/FloatingActionButton';
import { FieldListScreen } from '../screens/FieldListScreen';

const MenuButton = ({ title, icon, onPress }: { title: string, icon: string, onPress: () => void }) => (
    <TouchableOpacity
        style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#f9fafb',
            padding: 20,
            borderRadius: 16,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: '#f3f4f6'
        }}
        onPress={onPress}
    >
        <Text style={{ fontSize: 24, marginRight: 16 }}>{icon}</Text>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111827' }}>{title}</Text>
    </TouchableOpacity>
);

export const AppShell = () => {
    const { settings } = useSettings();

    // New Tabs
    const [activeTab, setActiveTab] = useState<TabType>('MANAGE');

    // Farm Switcher
    const [showFarmSwitcher, setShowFarmSwitcher] = useState(false);
    const [showActivityMenu, setShowActivityMenu] = useState(false);
    const [myFarms, setMyFarms] = useState<{ id: string, name: string }[]>([]);
    const { switchFarm } = useContext(AuthContext);
    const { user } = useAuth();

    useEffect(() => {
        if (showFarmSwitcher) {
            // Load farms when switcher opens
            db.getAll("SELECT f.id, f.name FROM farms f JOIN farm_members fm ON f.id = fm.farm_id WHERE fm.user_id = ?", [user?.id])
                .then((res: any[]) => setMyFarms(res));
        }
    }, [showFarmSwitcher, user]);

    const handleSwitchFarm = async (farmId: string) => {
        setShowFarmSwitcher(false);
        if (farmId === settings?.farm_id) return;
        await switchFarm(farmId);
        alert("Switched farm. (Reloading...)");
    };

    // Log Session Overlay managed here
    const [activeLog, setActiveLog] = useState<{
        type: LogType;
        source: { id: string, name: string, acreage?: number, type: 'FIELD' | 'BIN' };
        replacesLogId?: string;
    } | null>(null);

    const { width } = useWindowDimensions();
    const isDesktop = width > 768;
    const isE2E = typeof globalThis !== 'undefined' && !!(globalThis as any).E2E_TESTING;

    if (activeLog) {
        return (
            <LogSessionScreen
                type={activeLog.type}
                fixedId={activeLog.source.id}
                fixedName={activeLog.source.name}
                fixedAcreage={activeLog.source.acreage}
                fixedType={activeLog.source.type}
                replacesLogId={activeLog.replacesLogId}
                onClose={() => setActiveLog(null)}
            />
        );
    }

    const getTabTitle = (tab: TabType) => {
        switch (tab) {
            case 'MANAGE': return 'Fields';
            case 'DASHBOARD': return 'Grain';
            case 'MORE': return 'More';
            default: return 'FarmFlow';
        }
    };

    const renderContent = () => {
        const timestamp = new Date().toISOString();
        console.log(`[AppShell:${timestamp}] Rendering activeTab: ${activeTab}`);

        try {
            switch (activeTab) {
                case 'MANAGE':
                    console.log(`[AppShell:${timestamp}] Loading FieldListScreen...`);
                    return <FieldListScreen />;
                case 'DASHBOARD':
                    console.log(`[AppShell:${timestamp}] Loading DashboardTab...`);
                    return <DashboardTab />;
                case 'MORE':
                    console.log(`[AppShell:${timestamp}] Loading MoreTab...`);
                    return <MoreTab />;
                default:
                    console.log(`[AppShell:${timestamp}] Loading fallback FieldListScreen...`);
                    return <FieldListScreen />;
            }
        } catch (error) {
            console.error(`[AppShell:${timestamp}] CRITICAL RENDER ERROR:`, error);
            return (
                <View style={{ padding: 40, alignItems: 'center' }}>
                    <Text style={{ color: 'red', fontWeight: 'bold' }}>Render Error</Text>
                    <Text>{String(error)}</Text>
                </View>
            );
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" />



            {!isDesktop && (
                <View
                    className="flex-row justify-between items-center px-6 py-4 bg-white border-b border-gray-100"
                    style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', height: 72 }}
                >
                    <View className="flex-row items-center" style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Image
                            source={require('../../assets/icon.png')}
                            className="w-10 h-10 mr-3 rounded-xl"
                            style={{ width: 40, height: 40, marginRight: 12, borderRadius: 12 }}
                        />
                        <TouchableOpacity
                            onPress={() => setShowFarmSwitcher(true)}
                            testID="header-farm-name"
                        >
                            <Text className="text-2xl font-bold text-gray-900" style={{ fontSize: 24, fontWeight: 'bold' }}>FarmFlow</Text>
                        </TouchableOpacity>
                    </View>

                    <View className="flex-row items-center" style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View
                            className="flex-row items-center bg-green-50 px-3 py-1 rounded-full mr-3 border border-green-100"
                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999, marginRight: 12, borderWidth: 1, borderColor: '#DCFCE7' }}
                        >
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E', marginRight: 8 }} />
                            <Text style={{ color: '#15803D', fontSize: 10, fontWeight: 'bold' }}>ONLINE</Text>
                        </View>
                        <Image
                            source={
                                isE2E
                                    ? require('../../assets/icon.png')
                                    : { uri: 'https://i.pravatar.cc/100?u=' + (user?.id || 'default') }
                            }
                            className="w-10 h-10 rounded-full border-2 border-white shadow-sm"
                            style={{ width: 40, height: 40, borderRadius: 20 }}
                            testID="header-avatar"
                        />
                    </View>
                </View>
            )}

            <ResponsiveLayout
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                onSyncPress={() => { }}
                farmName={settings?.farm_name || 'FarmFlow'}
                isConnected={true}
                isSyncing={false}
            >
                {width <= 768 && (
                    <StatusOverlay
                        isConnected={true}
                        isSyncing={false}
                        onRetry={() => { }}
                    />
                )}

                <ErrorBoundary>
                    <View style={styles.mainContent}>
                        {activeTab === 'MANAGE' && <WeatherWidget />}
                        {renderContent()}
                    </View>
                </ErrorBoundary>

                {!isDesktop && (
                    <FloatingActionButton
                        onPress={() => setShowActivityMenu(true)}
                    />
                )}
            </ResponsiveLayout>

            {!isDesktop && (
                <TabBar activeTab={activeTab} setActiveTab={setActiveTab} />
            )}

            <FarmSwitcherModal
                visible={showFarmSwitcher}
                onClose={() => setShowFarmSwitcher(false)}
                myFarms={myFarms}
                currentFarmId={settings?.farm_id}
                onSwitchFarm={handleSwitchFarm}
            />

            {showActivityMenu && (
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 2000 }}>
                    <TouchableOpacity
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                        onPress={() => setShowActivityMenu(false)}
                    />
                    <View style={{ backgroundColor: 'white', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 32, paddingBottom: 48 }}>
                        <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 24 }}>New Activity</Text>

                        <MenuButton
                            title="Planting"
                            icon="🌱"
                            onPress={() => {
                                setShowActivityMenu(false);
                                setActiveLog({ type: 'PLANTING', source: { id: '', name: 'Select Field', type: 'FIELD' } });
                            }}
                        />
                        <MenuButton
                            title="Spraying"
                            icon="🚿"
                            onPress={() => {
                                setShowActivityMenu(false);
                                setActiveLog({ type: 'SPRAY', source: { id: '', name: 'Select Field', type: 'FIELD' } });
                            }}
                        />
                        <MenuButton
                            title="Harvest"
                            icon="🚜"
                            onPress={() => {
                                setShowActivityMenu(false);
                                setActiveLog({ type: 'HARVEST_TO_TOWN', source: { id: '', name: 'Select Field', type: 'FIELD' } });
                            }}
                        />

                        <TouchableOpacity
                            onPress={() => setShowActivityMenu(false)}
                            style={{ marginTop: 16, padding: 16 }}
                        >
                            <Text style={{ textAlign: 'center', color: '#ef4444', fontWeight: 'bold' }}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
};


const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Theme.colors.background },
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
    mainContent: { flex: 1 },
});
