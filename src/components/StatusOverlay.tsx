import React from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { Theme } from '../constants/Theme';
import { connector } from '../db/SupabaseConnector';

const getStatusLabel = (connected: boolean) => {
    if (connected) return Platform.OS === 'web' ? 'SYNCED' : 'LIVE';
    return 'OFFLINE';
};

export const StatusOverlay = ({ isConnected, variant = 'floating' }: { isConnected: boolean, variant?: 'floating' | 'sidebar' }) => {
    const { width } = useWindowDimensions();
    const isDesktop = width > 768;
    // Safe access to user email from Supabase session
    const session = (connector.client as any).auth?.session?.() || (connector.client.auth as any).session;
    const userEmail = session?.user?.email || 'User';

    if (variant === 'sidebar') {
        return (
            <View style={styles.sidebarContainer}>
                <View style={styles.badge}>
                    <View style={[styles.dot, { backgroundColor: isConnected ? Theme.colors.success : Theme.colors.secondary }]} />
                    <Text style={styles.text}>{getStatusLabel(isConnected)}</Text>
                </View>
                <View style={styles.userBadge}>
                    <Text style={styles.userText}>{userEmail.split('@')[0]}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, isDesktop ? styles.desktopPos : styles.mobilePos]}>
            <View style={styles.badge}>
                <View style={[styles.dot, { backgroundColor: isConnected ? Theme.colors.success : Theme.colors.secondary }]} />
                <Text style={styles.text}>{getStatusLabel(isConnected)}</Text>
            </View>

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
});
