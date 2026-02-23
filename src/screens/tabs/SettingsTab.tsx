import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Theme } from '../../constants/Theme';
import { useAuth } from '../../hooks/useAuth';
import { useSettings } from '../../hooks/useSettings';
import { useSyncController } from '../../sync/useSyncController';

export const SettingsTab = () => {
    const { signOut, user } = useAuth();
    const { settings } = useSettings();
    const { sync, lastSyncedAt } = useSyncController();

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Settings</Text>

            <View style={styles.section}>
                <Text style={styles.label}>Farm Name</Text>
                <Text style={styles.value}>{settings?.farm_name}</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.label}>User</Text>
                <Text style={styles.value}>{user?.email}</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.label}>Last Synced</Text>
                <Text style={styles.value}>
                    {lastSyncedAt ? (typeof lastSyncedAt === 'object' && lastSyncedAt.toLocaleString ? lastSyncedAt.toLocaleString() : String(lastSyncedAt)) : 'Never'}
                </Text>
                <TouchableOpacity onPress={sync} style={styles.button}>
                    <Text style={styles.buttonText}>Force Sync</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={signOut} style={[styles.button, styles.logout]}>
                <Text style={[styles.buttonText, { color: Theme.colors.white }]}>Sign Out</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: Theme.spacing.lg, backgroundColor: Theme.colors.background },
    header: { ...Theme.typography.h1, marginBottom: Theme.spacing.lg },
    section: { marginBottom: Theme.spacing.xl },
    label: { ...Theme.typography.caption, color: Theme.colors.textSecondary },
    value: { ...Theme.typography.h2, marginBottom: Theme.spacing.sm },
    button: { padding: Theme.spacing.md, backgroundColor: '#E0E0E0', borderRadius: Theme.borderRadius.sm, alignItems: 'center', marginTop: Theme.spacing.sm },
    logout: { backgroundColor: Theme.colors.danger },
    buttonText: { fontWeight: 'bold' }
});
