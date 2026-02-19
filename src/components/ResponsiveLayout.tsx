import React, { ReactNode } from 'react';
import { View, StyleSheet, useWindowDimensions, TouchableOpacity, Text, Image } from 'react-native';
import { Theme } from '../constants/Theme';
import { StatusOverlay } from './StatusOverlay';

interface ResponsiveLayoutProps {
    children: ReactNode;
    activeTab: string;
    setActiveTab: (tab: any) => void;
    onSyncPress?: () => void;
    farmName: string;
    isConnected: boolean;
    isSyncing?: boolean;
}

export const ResponsiveLayout = ({ children, activeTab, setActiveTab, onSyncPress, farmName, isConnected, isSyncing = false }: ResponsiveLayoutProps) => {
    const { width } = useWindowDimensions();
    const isDesktop = width > 768;

    if (!isDesktop) {
        return <View style={styles.mobileContainer}>{children}</View>;
    }

    return (
        <View style={styles.desktopContainer}>
            <View style={styles.sidebar}>
                <View style={styles.sidebarHeader}>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Image
                                source={require('../../assets/icon.png')}
                                style={styles.logo}
                            />
                            <Text style={styles.sidebarTitle}>{farmName}</Text>
                        </View>
                        <StatusOverlay isConnected={isConnected} isSyncing={isSyncing} onRetry={onSyncPress} variant="sidebar" />
                    </View>
                </View>

                <View style={styles.navGroup}>
                    <TouchableOpacity
                        style={[styles.navItem, activeTab === 'FIELDS' && styles.navItemActive]}
                        onPress={() => setActiveTab('FIELDS')}
                    >
                        <Text style={[styles.navText, activeTab === 'FIELDS' && styles.navTextActive]}>Fields</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.navItem, activeTab === 'GRAIN' && styles.navItemActive]}
                        onPress={() => setActiveTab('GRAIN')}
                    >
                        <Text style={[styles.navText, activeTab === 'GRAIN' && styles.navTextActive]}>Grain Position</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.navItem, activeTab === 'REPORTS' && styles.navItemActive]}
                        onPress={() => setActiveTab('REPORTS')}
                    >
                        <Text style={[styles.navText, activeTab === 'REPORTS' && styles.navTextActive]}>Reports & Compliance</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.navItem, activeTab === 'VAULTS' && styles.navItemActive]}
                        onPress={() => setActiveTab('VAULTS')}
                    >
                        <Text style={[styles.navText, activeTab === 'VAULTS' && styles.navTextActive]}>Vault & Sync</Text>
                    </TouchableOpacity>

                    <View style={{ flex: 1 }} />

                    <TouchableOpacity
                        style={[styles.syncButton]}
                        onPress={onSyncPress || (() => setActiveTab('VAULTS'))}
                    >
                        <Text style={styles.syncButtonText}>📲 Sync Phone</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.sidebarFooter}>
                    <Text style={styles.versionText}>FarmFlow v4.14-STABLE</Text>
                </View>
            </View>
            <View style={styles.mainContent}>
                {children}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    mobileContainer: {
        flex: 1,
    },
    desktopContainer: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: '#F0F2F5',
    },
    sidebar: {
        width: 280,
        backgroundColor: Theme.colors.white,
        borderRightWidth: 1,
        borderRightColor: Theme.colors.border,
        padding: Theme.spacing.lg,
        ...Theme.shadows.sm,
    },
    sidebarHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Theme.spacing.xl,
        paddingHorizontal: Theme.spacing.sm,
    },
    logo: {
        width: 32,
        height: 32,
        borderRadius: 6,
        marginRight: 12,
    },
    sidebarTitle: {
        ...Theme.typography.h2,
        color: Theme.colors.primary,
    },
    navGroup: {
        flex: 1,
    },
    navItem: {
        paddingVertical: Theme.spacing.md,
        paddingHorizontal: Theme.spacing.md,
        borderRadius: Theme.borderRadius.md,
        marginBottom: Theme.spacing.xs,
    },
    navItemActive: {
        backgroundColor: 'rgba(46, 125, 50, 0.08)',
    },
    navText: {
        ...Theme.typography.body,
        fontWeight: '500',
        color: Theme.colors.textSecondary,
    },
    navTextActive: {
        color: Theme.colors.primary,
        fontWeight: 'bold',
    },
    mainContent: {
        flex: 1,
        maxWidth: 1400,
        marginHorizontal: 'auto',
    },
    sidebarFooter: {
        paddingTop: Theme.spacing.lg,
        borderTopWidth: 1,
        borderTopColor: Theme.colors.border,
    },
    versionText: {
        ...Theme.typography.caption,
        color: Theme.colors.textSecondary,
        textAlign: 'center',
    },
    syncButton: {
        backgroundColor: Theme.colors.secondary,
        padding: Theme.spacing.md,
        borderRadius: Theme.borderRadius.md,
        alignItems: 'center',
        marginTop: Theme.spacing.xl,
        marginHorizontal: Theme.spacing.sm,
    },
    syncButtonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 14,
    }
});
