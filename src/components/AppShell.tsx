import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, StatusBar, TouchableOpacity, Image, useWindowDimensions } from 'react-native';
import { Theme } from '../constants/Theme';
import { useSettings } from '../hooks/useSettings';
import { SyncIndicator } from './SyncIndicator';
import { ResponsiveLayout } from './ResponsiveLayout';
import { StatusOverlay } from './StatusOverlay';

import { LogTab } from '../screens/tabs/LogTab';
import { HistoryTab } from '../screens/tabs/HistoryTab';
import { DashboardTab } from '../screens/tabs/DashboardTab';
import { ManageTab } from '../screens/tabs/ManageTab';
import { SettingsTab } from '../screens/tabs/SettingsTab';
import { LogSessionScreen, LogType } from '../screens/LogSessionScreen';
import { Modal, FlatList } from 'react-native';
import { db } from '../db/powersync';
import { useAuth } from '../hooks/useAuth';
import { AuthContext } from '../context/AuthProvider';

export const AppShell = () => {
    const { settings } = useSettings();

    // New Tabs
    const [activeTab, setActiveTab] = useState<'LOG' | 'HISTORY' | 'DASHBOARD' | 'MANAGE' | 'SETTINGS'>('LOG');

    // Farm Switcher
    const [showFarmSwitcher, setShowFarmSwitcher] = useState(false);
    const [myFarms, setMyFarms] = useState<{ id: string, name: string }[]>([]);
    const { switchFarm } = useContext(AuthContext); // We need to import AuthContext
    const { user } = useAuth(); // or from useAuth

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
        // Ideally trigger a context reload here.
        // For MVP:
        alert("Switched farm. (Reloading...)");
        // Force reload or navigation reset would happen here.
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

    const renderContent = () => {
        switch (activeTab) {
            case 'LOG':
                return <LogTab onLogAction={setActiveLog} />;
            case 'HISTORY':
                return <HistoryTab />;
            case 'DASHBOARD':
                return <DashboardTab />;
            case 'MANAGE':
                return <ManageTab />;
            case 'SETTINGS':
                return <SettingsTab />;
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
                                <Text style={styles.headerTitle}>{settings?.farm_name || 'FarmFlow'} ▾</Text>
                            </TouchableOpacity>
                            <Text style={styles.headerSubtitle}>{activeTab}</Text>
                        </View>
                    </View>
                    <SyncIndicator />
                </View>
            )}

            <ResponsiveLayout
                activeTab={activeTab}
                setActiveTab={setActiveTab} // Note: Types might mismatch if ResponsiveLayout expects old tabs. I need to update ResponsiveLayout too or ignore typescript for now.
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

                <View style={styles.content}>
                    {renderContent()}
                </View>
            </ResponsiveLayout>

            {!isDesktop && (
                <View style={styles.tabBar}>
                    <TouchableOpacity
                        style={[styles.tabItem, activeTab === 'LOG' && styles.activeTab]}
                        onPress={() => setActiveTab('LOG')}
                    >
                        <Text style={[styles.tabIcon, activeTab === 'LOG' && styles.activeTabText]}>➕</Text>
                        <Text style={[styles.tabText, activeTab === 'LOG' && styles.activeTabText]}>Log</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabItem, activeTab === 'HISTORY' && styles.activeTab]}
                        onPress={() => setActiveTab('HISTORY')}
                    >
                        <Text style={[styles.tabIcon, activeTab === 'HISTORY' && styles.activeTabText]}>🕒</Text>
                        <Text style={[styles.tabText, activeTab === 'HISTORY' && styles.activeTabText]}>History</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabItem, activeTab === 'DASHBOARD' && styles.activeTab]}
                        onPress={() => setActiveTab('DASHBOARD')}
                    >
                        <Text style={[styles.tabIcon, activeTab === 'DASHBOARD' && styles.activeTabText]}>📊</Text>
                        <Text style={[styles.tabText, activeTab === 'DASHBOARD' && styles.activeTabText]}>Dash</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabItem, activeTab === 'MANAGE' && styles.activeTab]}
                        onPress={() => setActiveTab('MANAGE')}
                    >
                        <Text style={[styles.tabIcon, activeTab === 'MANAGE' && styles.activeTabText]}>⚙️</Text>
                        <Text style={[styles.tabText, activeTab === 'MANAGE' && styles.activeTabText]}>Manage</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tabItem, activeTab === 'SETTINGS' && styles.activeTab]}
                        onPress={() => setActiveTab('SETTINGS')}
                    >
                        <Text style={[styles.tabIcon, activeTab === 'SETTINGS' && styles.activeTabText]}>👤</Text>
                        <Text style={[styles.tabText, activeTab === 'SETTINGS' && styles.activeTabText]}>Profile</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    )
}

<Modal
    visible={showFarmSwitcher}
    transparent={true}
    animationType="fade"
    onRequestClose={() => setShowFarmSwitcher(false)}
>
    <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowFarmSwitcher(false)}
    >
        <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Switch Farm</Text>
            <FlatList
                data={myFarms}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={[styles.farmItem, item.id === settings?.farm_id && styles.activeFarmItem]}
                        onPress={() => handleSwitchFarm(item.id)}
                    >
                        <Text style={[styles.farmName, item.id === settings?.farm_id && styles.activeFarmName]}>{item.name}</Text>
                        {item.id === settings?.farm_id && <Text style={styles.activeCheck}>✓</Text>}
                    </TouchableOpacity>
                )}
            />
            <TouchableOpacity style={styles.closeButton} onPress={() => setShowFarmSwitcher(false)}>
                <Text style={styles.closeButtonText}>Cancel</Text>
            </TouchableOpacity>
        </View>
    </TouchableOpacity>
</Modal>
        </SafeAreaView >
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
    tabBar: {
        flexDirection: 'row',
        height: 65,
        backgroundColor: Theme.colors.white,
        borderTopWidth: 1,
        borderTopColor: Theme.colors.border,
        paddingBottom: 5,
    },
    tabItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    activeTab: { borderTopWidth: 3, borderTopColor: Theme.colors.primary },
    tabIcon: { fontSize: 20, marginBottom: 2 },
    tabText: { ...Theme.typography.caption, fontWeight: 'bold' },
    activeTabText: { color: Theme.colors.primary },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: Theme.spacing.lg
    },
    modalContent: {
        backgroundColor: Theme.colors.background,
        borderRadius: 12,
        padding: Theme.spacing.lg,
        maxHeight: '60%'
    },
    modalTitle: { ...Theme.typography.h2, marginBottom: Theme.spacing.md },
    farmItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: Theme.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.border
    },
    activeFarmItem: { backgroundColor: Theme.colors.surface },
    farmName: { ...Theme.typography.body },
    activeFarmName: { fontWeight: 'bold', color: Theme.colors.primary },
    activeCheck: { color: Theme.colors.primary, fontWeight: 'bold' },
    closeButton: {
        marginTop: Theme.spacing.md,
        alignItems: 'center',
        padding: Theme.spacing.md
    },
    closeButtonText: { color: Theme.colors.textSecondary }
});
