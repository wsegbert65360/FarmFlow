import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Theme } from '../../constants/Theme';
import { FieldListScreen } from '../FieldListScreen';
import { GrainDashboardScreen } from '../GrainDashboardScreen';
import { ReportsScreen } from '../ReportsScreen';
import { VaultScreen } from '../VaultScreen';

type ManageView = 'MENU' | 'FIELDS' | 'BINS_CONTRACTS' | 'REPORTS' | 'VAULT';

interface ManageTabProps {
    onLogAction?: (action: { type: any, source: any, replacesLogId?: string }) => void;
}

export const ManageTab = ({ onLogAction }: ManageTabProps) => {
    const [view, setView] = useState<ManageView>('MENU');

    if (view === 'FIELDS') {
        return (
            <View style={{ flex: 1 }}>
                <BackButton onPress={() => setView('MENU')} title="Manage Fields" />
                <FieldListScreen
                    mode="MANAGE"
                />
            </View>
        );
    }
    if (view === 'BINS_CONTRACTS') {
        return (
            <View style={{ flex: 1 }}>
                <BackButton onPress={() => setView('MENU')} title="Manage Bins & Contracts" />
                <GrainDashboardScreen onSelectAction={() => { }} mode="MANAGE" />
            </View>
        );
    }
    if (view === 'REPORTS') {
        return (
            <View style={{ flex: 1 }}>
                <BackButton onPress={() => setView('MENU')} title="Reports" />
                <ReportsScreen />
            </View>
        );
    }
    if (view === 'VAULT') {
        return (
            <View style={{ flex: 1 }}>
                <BackButton onPress={() => setView('MENU')} title="Vault" />
                <VaultScreen initialTab="CHEMICALS" />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.header}>Manage Farm</Text>

            <MenuButton title="Fields" icon="🚜" onPress={() => setView('FIELDS')} subtitle="Add, Edit, Splits" testID="manage-fields-btn" />
            <MenuButton title="Bins & Contracts" icon="🏭" onPress={() => setView('BINS_CONTRACTS')} subtitle="Inventory, Sales" testID="manage-bins-btn" />
            <MenuButton title="Vault" icon="🧪" onPress={() => setView('VAULT')} subtitle="Chemicals, Seeds, Landlords" testID="manage-vault-btn" />
            <MenuButton title="Reports" icon="📊" onPress={() => setView('REPORTS')} subtitle="Cost Analysis, Packets" testID="manage-reports-btn" />
            <MenuButton title="Agreements" icon="🤝" onPress={() => { }} subtitle="Coming Soon" disabled />

        </ScrollView>
    );
};

const MenuButton = ({ title, icon, onPress, subtitle, disabled, testID }: { title: string, icon: string, onPress: () => void, subtitle: string, disabled?: boolean, testID?: string }) => (
    <TouchableOpacity
        style={[styles.menuButton, disabled && { opacity: 0.6 }]}
        onPress={onPress}
        disabled={disabled}
        testID={testID}
    >
        <Text style={styles.icon}>{icon}</Text>
        <View>
            <Text style={styles.menuTitle}>{title}</Text>
            <Text style={styles.menuSubtitle}>{subtitle}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
);

const BackButton = ({ onPress, title }: { onPress: () => void, title: string }) => (
    <View style={styles.backHeader}>
        <TouchableOpacity onPress={onPress} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.backTitle}>{title}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Theme.colors.background },
    content: { padding: Theme.spacing.lg },
    header: { ...Theme.typography.h1, marginBottom: Theme.spacing.lg },
    menuButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Theme.colors.white,
        padding: Theme.spacing.lg,
        borderRadius: Theme.borderRadius.md,
        marginBottom: Theme.spacing.md,
        ...Theme.shadows.sm
    },
    icon: { fontSize: 24, marginRight: Theme.spacing.md },
    menuTitle: { ...Theme.typography.h2 },
    menuSubtitle: { ...Theme.typography.caption, color: Theme.colors.textSecondary },
    chevron: { fontSize: 24, color: Theme.colors.textSecondary, marginLeft: 'auto' },
    backHeader: { flexDirection: 'row', alignItems: 'center', padding: Theme.spacing.md, backgroundColor: Theme.colors.surface, borderBottomWidth: 1, borderBottomColor: Theme.colors.border },
    backButton: { marginRight: Theme.spacing.md },
    backButtonText: { color: Theme.colors.primary, fontWeight: 'bold', fontSize: 16 },
    backTitle: { ...Theme.typography.h2, flex: 1 },
});
