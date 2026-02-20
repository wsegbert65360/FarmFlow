import React, { useState, useEffect, useContext } from 'react';
import { StyleSheet, Text, View, SafeAreaView, StatusBar, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import { Theme } from '../constants/Theme';
import { useSettings } from '../hooks/useSettings';
import { SyncStatusPill } from './SyncStatusPill';
import { ResponsiveLayout } from './ResponsiveLayout';
import { StatusOverlay } from './StatusOverlay';

import { LogTab } from '../screens/tabs/LogTab';
import { HistoryTab } from '../screens/tabs/HistoryTab';
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

export const AppShell = () => {
    const { settings } = useSettings();

    // New Tabs
    const [activeTab, setActiveTab] = useState<TabType>('MANAGE');

    // Farm Switcher
    const [showFarmSwitcher, setShowFarmSwitcher] = useState(false);
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
            case 'LOG': return 'Log Activity';
            case 'HISTORY': return 'History';
            case 'DASHBOARD': return 'Dashboard';
            case 'MANAGE': return 'Manage';
            case 'SETTINGS': return 'Settings';
            case 'MORE': return 'More';
            default: return 'FarmFlow';
        }
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'LOG':
                return <LogTab onLogAction={setActiveLog} />;
            case 'HISTORY':
                return <HistoryTab />;
            case 'DASHBOARD':
                return <DashboardTab />;
            case 'MANAGE':
                return <ManageTab onLogAction={setActiveLog} />;
            case 'SETTINGS':
                return <SettingsTab />;
            case 'MORE':
                return <MoreTab />;
            default:
                return <LogTab onLogAction={setActiveLog} />;
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" />



            {!isDesktop && (
                <View style={styles.header}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Image
                            source={require('../../assets/icon.png')}
                            style={{ width: 40, height: 40, marginRight: 12, borderRadius: 8 }}
                        />
                        <View>
                            <TouchableOpacity onPress={() => setShowFarmSwitcher(true)}>
                                <Text style={styles.headerTitle}>{getTabTitle(activeTab)} ▾</Text>
                            </TouchableOpacity>
                            <HeaderHelper activeTab={activeTab} />
                        </View>
                    </View>
                    <SyncStatusPill />
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
                        {renderContent()}
                    </View>
                </ErrorBoundary>
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
