import React from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions, TouchableOpacity } from 'react-native';
import { Theme } from '../constants/Theme';
import { connector } from '../db/SupabaseConnector';

const getStatusConfig = (isConnected: boolean, isSyncing: boolean) => {
    if (isSyncing) return { label: 'SYNCING', color: Theme.colors.warning };
    if (isConnected) return { label: Platform.OS === 'web' ? 'SYNCED' : 'LIVE', color: Theme.colors.success };
    return { label: 'OFFLINE', color: Theme.colors.danger };
};

export const StatusOverlay = ({ isConnected, isSyncing = false, variant = 'floating', onRetry }: { isConnected: boolean, isSyncing?: boolean, variant?: 'floating' | 'sidebar', onRetry?: () => void }) => {
    const { width } = useWindowDimensions();
    const isDesktop = width > 768;
    const { label, color } = getStatusConfig(isConnected, isSyncing);

    // Safe access to user email from Supabase session
    const session = (connector.client as any).auth?.session?.() || (connector.client.auth as any).session;
    const userEmail = session?.user?.email || 'User';

    const handleExport = async () => {
        const { generateDiagnosticReport } = require('../utils/DiagnosticUtility');
        const { showAlert } = require('../utils/AlertUtility');
        try {
            await generateDiagnosticReport();
            showAlert('Diagnostics Exported', 'System audit report is ready to share.');
        } catch (e) {
            showAlert('Export Failed', 'Could not generate diagnostic report.');
        }
    };

    if (variant === 'sidebar') {
        return (
            <View style={styles.sidebarContainer}>
                <View style={styles.badge}>
                    <View style={[styles.dot, { backgroundColor: color }]} />
                    <Text style={styles.text}>{label}</Text>
                </View>
                {!isConnected && !isSyncing && onRetry && (
                    <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
                        <Text style={styles.retryText}>RETRY</Text>
                    </TouchableOpacity>
                )}
                <View style={styles.userBadge}>
                    <Text style={styles.userText}>{userEmail.split('@')[0]}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, isDesktop ? styles.desktopPos : styles.mobilePos]}>
            <TouchableOpacity style={styles.badge} onPress={handleExport} activeOpacity={0.7}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text style={styles.text}>{label}</Text>
            </TouchableOpacity>

            {!isConnected && !isSyncing && onRetry && (
                <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
                    <Text style={styles.retryText}>RETRY</Text>
                </TouchableOpacity>
            )}

            {isDesktop && (
                <View style={styles.userBadge}>
                    <Text style={styles.userText}>{userEmail.split('@')[0]}</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    sidebarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.sm,
        marginTop: Theme.spacing.md,
    },
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Theme.spacing.sm,
        zIndex: 1000,
    },
    desktopPos: {
        position: 'absolute',
        top: Theme.spacing.md,
        right: Theme.spacing.xl,
    },
    mobilePos: {
        // Mobile pos is handled by the header if needed, but we can put it top-right of content
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        ...Theme.shadows.sm,
        borderWidth: 1,
        borderColor: Theme.colors.border,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    text: {
        ...Theme.typography.caption,
        fontWeight: 'bold',
        color: Theme.colors.text,
    },
    userBadge: {
        backgroundColor: Theme.colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        ...Theme.shadows.sm,
    },
    userText: {
        ...Theme.typography.caption,
        fontWeight: 'bold',
        color: '#FFF',
        textTransform: 'capitalize',
    },
    retryBtn: {
        backgroundColor: Theme.colors.danger,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        ...Theme.shadows.sm,
    },
    retryText: {
        ...Theme.typography.caption,
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 10,
    },
});
