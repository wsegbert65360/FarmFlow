import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Theme } from '../../constants/Theme';
import { showAlert } from '../../utils/AlertUtility';
import { FieldListScreen } from '../FieldListScreen';
import { GrainDashboardScreen } from '../GrainDashboardScreen';
import { Field } from '../../hooks/useFields';

interface LogTabProps {
    onLogAction: (action: { type: 'SPRAY' | 'PLANTING' | 'HARVEST' | 'DELIVERY' | 'ADJUSTMENT', source: any, replacesLogId?: string }) => void;
}

type SubView = 'MENU' | 'SELECT_FIELD_SPRAY' | 'SELECT_FIELD_PLANT' | 'SELECT_FIELD_HARVEST' | 'SELECT_BIN_DELIVERY' | 'SELECT_CONTRACT';

export const LogTab = ({ onLogAction }: LogTabProps) => {
    const [subView, setSubView] = useState<SubView>('MENU');

    const handleFieldSelect = (field: Field, type: 'SPRAY' | 'PLANTING' | 'HARVEST' | 'DELIVERY' | 'ADJUSTMENT', replacesLogId?: string) => {
        onLogAction({
            type,
            source: { id: field.id, name: field.name, acreage: field.acreage, type: 'FIELD' },
            replacesLogId
        });
        setSubView('MENU'); // Reset after selection (though AppShell will likely overlay LogSession)
    };

    const handleBinSelect = (id: string, name: string, type: 'HARVEST' | 'DELIVERY') => {
        onLogAction({
            type,
            source: { id, name, type: 'BIN' }
        });
        setSubView('MENU');
    };

    if (subView === 'SELECT_FIELD_SPRAY') {
        return (
            <View style={{ flex: 1 }}>
                <BackButton onPress={() => setSubView('MENU')} title="Select Field for Spraying" />
                <FieldListScreen
                    mode="SELECT"
                    onSelectAction={(f) => handleFieldSelect(f, 'SPRAY')}
                />
            </View>
        );
    }
    if (subView === 'SELECT_FIELD_PLANT') {
        return (
            <View style={{ flex: 1 }}>
                <BackButton onPress={() => setSubView('MENU')} title="Select Field for Planting" />
                <FieldListScreen
                    mode="SELECT"
                    onSelectAction={(f) => handleFieldSelect(f, 'PLANTING')}
                />
            </View>
        );
    }
    if (subView === 'SELECT_FIELD_HARVEST') {
        return (
            <View style={{ flex: 1 }}>
                <BackButton onPress={() => setSubView('MENU')} title="Select Field to Harvest" />
                <FieldListScreen
                    mode="SELECT"
                    onSelectAction={(f) => handleFieldSelect(f, 'HARVEST')}
                />
            </View>
        );
    }
    if (subView === 'SELECT_BIN_DELIVERY') {
        return (
            <View style={{ flex: 1 }}>
                <BackButton onPress={() => setSubView('MENU')} title="Select Bin to Deliver From" />
                <GrainDashboardScreen
                    mode="SELECT_BIN"
                    onSelectAction={(id, name) => handleBinSelect(id, name, 'DELIVERY')}
                />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.header}>New Log Entry</Text>
            <View style={styles.grid}>
                <ActionButton
                    title="Spray"
                    icon="🚿"
                    color="#0288D1"
                    onPress={() => setSubView('SELECT_FIELD_SPRAY')}
                    testID="log-action-spray"
                />
                <ActionButton
                    title="Planting"
                    icon="🌱"
                    color="#2E7D32"
                    onPress={() => setSubView('SELECT_FIELD_PLANT')}
                    testID="log-action-planting"
                />
                <ActionButton
                    title="Harvest / Load"
                    icon="🚜"
                    color="#F57C00"
                    onPress={() => setSubView('SELECT_FIELD_HARVEST')}
                    testID="log-action-harvest"
                />
                <ActionButton
                    title="Bin → Town"
                    icon="🚛"
                    color="#7B1FA2"
                    onPress={() => setSubView('SELECT_BIN_DELIVERY')}
                    testID="log-action-delivery"
                />
                <ActionButton
                    title="Settlement"
                    icon="💰"
                    color="#455A64"
                    onPress={() => showAlert('Coming Soon', 'Settlement and Financial logging is coming in the next update!')}
                    testID="log-action-settlement"
                />
            </View>

            <View style={styles.recentActivity}>
                <Text style={styles.recentHeader}>Recent Activity</Text>
                {/* Placeholders for recent logs if needed, or link to History */}
                <Text style={{ color: Theme.colors.textSecondary, fontStyle: 'italic' }}>Check History tab for past logs.</Text>
            </View>
        </ScrollView>
    );
};

const ActionButton = ({ title, icon, color, onPress, testID }: { title: string, icon: string, color: string, onPress: () => void, testID?: string }) => (
    <TouchableOpacity style={[styles.button, { backgroundColor: color }]} onPress={onPress} testID={testID}>
        <Text style={styles.buttonIcon}>{icon}</Text>
        <Text style={styles.buttonText}>{title}</Text>
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
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Theme.spacing.md },
    button: {
        width: '48%',
        aspectRatio: 1.2,
        borderRadius: Theme.borderRadius.lg,
        justifyContent: 'center',
        alignItems: 'center',
        ...Theme.shadows.md,
    },
    buttonIcon: { fontSize: 40, marginBottom: Theme.spacing.sm },
    buttonText: { color: Theme.colors.white, fontWeight: 'bold', fontSize: 18, textAlign: 'center' },
    recentActivity: { marginTop: Theme.spacing.xl },
    recentHeader: { ...Theme.typography.h2, marginBottom: Theme.spacing.md },
    backHeader: { flexDirection: 'row', alignItems: 'center', padding: Theme.spacing.md, backgroundColor: Theme.colors.surface, borderBottomWidth: 1, borderBottomColor: Theme.colors.border },
    backButton: { marginRight: Theme.spacing.md },
    backButtonText: { color: Theme.colors.primary, fontWeight: 'bold', fontSize: 16 },
    backTitle: { ...Theme.typography.h2, flex: 1 },
});
