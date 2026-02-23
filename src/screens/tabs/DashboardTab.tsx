import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Theme } from '../../constants/Theme';
import { useGrain } from '../../hooks/useGrain';
import { useContracts } from '../../hooks/useContracts';

export const DashboardTab = () => {
    const { bins } = useGrain();
    const { contracts } = useContracts();

    const totalCapacity = (bins || []).reduce((acc, b) => acc + (b.capacity || 0), 0);
    const totalLevel = (bins || []).reduce((acc, b) => acc + (b.current_level || 0), 0);
    const percentFull = totalCapacity ? (totalLevel / totalCapacity) * 100 : 0;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.header}>Dashboard</Text>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Grain Storage</Text>
                <View style={styles.gaugeContainer}>
                    <View style={[styles.gaugeFill, { width: `${Math.min(percentFull, 100)}%` }]} />
                </View>
                <View style={styles.row}>
                    <Text style={styles.stat}>{totalLevel.toLocaleString()} bu On Hand</Text>
                    <Text style={styles.stat}>{percentFull.toFixed(0)}% Full</Text>
                </View>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Contracts</Text>
                <Text style={styles.stat}>{contracts.length} Active Contracts</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>Alerts</Text>
                <Text style={{ color: Theme.colors.textSecondary, fontStyle: 'italic' }}>No active alerts.</Text>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Theme.colors.background },
    content: { padding: Theme.spacing.lg },
    header: { ...Theme.typography.h1, marginBottom: Theme.spacing.lg },
    card: {
        backgroundColor: Theme.colors.white,
        padding: Theme.spacing.lg,
        borderRadius: Theme.borderRadius.md,
        marginBottom: Theme.spacing.md,
        ...Theme.shadows.sm
    },
    cardTitle: { ...Theme.typography.h2, marginBottom: Theme.spacing.md },
    gaugeContainer: {
        height: 20,
        backgroundColor: Theme.colors.surface,
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: Theme.spacing.sm
    },
    gaugeFill: {
        height: '100%',
        backgroundColor: Theme.colors.primary // Or dynamic color
    },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    stat: { ...Theme.typography.body, fontWeight: 'bold' }
});
