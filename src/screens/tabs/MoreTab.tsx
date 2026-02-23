import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Theme } from '../../constants/Theme';
import { ManageTab } from './ManageTab';
import { SettingsTab } from './SettingsTab';

type MoreView = 'MENU' | 'MANAGE' | 'SETTINGS';

export const MoreTab = () => {
    const [view, setView] = useState<MoreView>('MENU');

    const renderHeader = (title: string) => (
        <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => setView('MENU')} style={styles.backButton} testID="more-back-btn">
                <Text style={styles.backText}>‹ More</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{title}</Text>
        </View>
    );

    if (view === 'MANAGE') {
        return (
            <View style={styles.container}>
                {renderHeader('Manage')}
                <ManageTab />
            </View>
        );
    }

    if (view === 'SETTINGS') {
        return (
            <View style={styles.container}>
                {renderHeader('Settings')}
                <SettingsTab />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.title} testID="more-title">More</Text>

            <TouchableOpacity style={styles.menuItem} onPress={() => setView('MANAGE')} testID="more-manage-btn">
                <Text style={styles.menuIcon}>⚙️</Text>
                <View style={styles.menuTextContainer}>
                    <Text style={styles.menuTitle}>Manage Farm</Text>
                    <Text style={styles.menuSubtitle}>Fields, Bins, Reports</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuItem} onPress={() => setView('SETTINGS')} testID="more-settings-btn">
                <Text style={styles.menuIcon}>🔧</Text>
                <View style={styles.menuTextContainer}>
                    <Text style={styles.menuTitle}>Settings</Text>
                    <Text style={styles.menuSubtitle}>App Preferences, Account</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.menuItem, { marginTop: 40, backgroundColor: '#FFF5F5', borderColor: '#FFE0E0', borderWidth: 1 }]}
                onPress={async () => {
                    const { supabase } = require('../../supabase/client');
                    await supabase.auth.signOut();
                    // On web, reload to clear all state. On native, rely on AuthGate.
                    const { Platform } = require('react-native');
                    if (Platform.OS === 'web') window.location.reload();
                }}
                testID="more-signout-btn"
            >
                <Text style={styles.menuIcon}>🚪</Text>
                <View style={styles.menuTextContainer}>
                    <Text style={[styles.menuTitle, { color: Theme.colors.danger }]}>Sign Out</Text>
                    <Text style={styles.menuSubtitle}>End current session</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>

        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Theme.colors.background },
    content: { padding: Theme.spacing.lg },
    title: { ...Theme.typography.h1, marginBottom: Theme.spacing.lg },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Theme.spacing.md,
        backgroundColor: Theme.colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.border
    },
    backButton: { marginRight: Theme.spacing.md, padding: Theme.spacing.sm },
    backText: { color: Theme.colors.primary, fontSize: 16, fontWeight: '600' },
    headerTitle: { ...Theme.typography.h3, fontWeight: 'bold' },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Theme.colors.white,
        padding: Theme.spacing.lg,
        borderRadius: Theme.borderRadius.md,
        marginBottom: Theme.spacing.md,
        ...Theme.shadows.sm
    },
    menuIcon: { fontSize: 24, marginRight: Theme.spacing.md },
    menuTextContainer: { flex: 1 },
    menuTitle: { ...Theme.typography.h3, marginBottom: 2 },
    menuSubtitle: { ...Theme.typography.caption, color: Theme.colors.textSecondary },
    chevron: { fontSize: 24, color: Theme.colors.disabled }
});
