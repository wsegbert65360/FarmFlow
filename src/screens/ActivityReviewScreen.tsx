import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, SafeAreaView } from 'react-native';
import { Theme } from '../constants/Theme';
import { usePlanting } from '../hooks/usePlanting';
import { useSpray } from '../hooks/useSpray';
import { useGrain } from '../hooks/useGrain';
import { showDeleteConfirm, showAlert } from '../utils/AlertUtility';
import { syncController } from '../sync/SyncController';

type Tab = 'PLANTING' | 'SPRAYING' | 'GRAIN';

export const ActivityReviewScreen = () => {
    const [tab, setTab] = useState<Tab>('PLANTING');

    const { plantingLogs, deletePlantingLog } = usePlanting();
    const { sprayLogs, deleteSprayLog } = useSpray();
    const { bins, deleteGrainLog } = useGrain();

    const [selected, setSelected] = useState<Record<string, boolean>>({});

    const toggle = (id: string) => setSelected(prev => ({ ...prev, [id]: !prev[id] }));

    const clearSelection = () => setSelected({});

    const deleteSelected = () => {
        const ids = Object.keys(selected).filter(k => selected[k]);
        if (!ids.length) return showAlert('No selection', 'Please select items to delete.');

        showDeleteConfirm(`${ids.length} selected items`, async () => {
            try {
                for (const id of ids) {
                    if (tab === 'PLANTING') await deletePlantingLog(id);
                    if (tab === 'SPRAYING') await deleteSprayLog(id);
                    if (tab === 'GRAIN') await deleteGrainLog(id);
                }

                // Trigger a sync in non-E2E runs to push deletes upstream
                try { await syncController.sync(); } catch { /* best-effort */ }

                clearSelection();
                showAlert('Deleted', 'Selected items were deleted.');
            } catch (e: any) {
                console.error('Bulk delete failed', e);
                showAlert('Error', 'Failed to delete selected items: ' + (e?.message || 'unknown'));
            }
        });
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View style={styles.tabRow}>
                    <TouchableOpacity onPress={() => setTab('PLANTING')} style={[styles.tab, tab === 'PLANTING' && styles.tabActive]}>
                        <Text style={[styles.tabText, tab === 'PLANTING' && styles.tabTextActive]}>Planting</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setTab('SPRAYING')} style={[styles.tab, tab === 'SPRAYING' && styles.tabActive]}>
                        <Text style={[styles.tabText, tab === 'SPRAYING' && styles.tabTextActive]}>Spraying</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setTab('GRAIN')} style={[styles.tab, tab === 'GRAIN' && styles.tabActive]}>
                        <Text style={[styles.tabText, tab === 'GRAIN' && styles.tabTextActive]}>Grain</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.actionsRow}>
                    <TouchableOpacity onPress={deleteSelected} style={styles.deleteBtn} testID="delete-selected-btn">
                        <Text style={styles.deleteBtnText}>Delete Selected</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.listContainer}>
                {tab === 'PLANTING' && (
                    <FlatList data={plantingLogs} keyExtractor={(i) => i.id} renderItem={({ item }) => (
                        <TouchableOpacity onPress={() => toggle(item.id)} style={styles.row} accessibilityRole="checkbox" accessibilityState={{ checked: !!selected[item.id] }}>
                            <Text style={styles.checkbox}>{selected[item.id] ? '☑' : '☐'}</Text>
                            <View>
                                <Text style={styles.rowTitle}>{item.field_id} — {item.population} pop</Text>
                                <Text style={styles.rowSub}>{item.planted_at}</Text>
                            </View>
                        </TouchableOpacity>
                    )} />
                )}

                {tab === 'SPRAYING' && (
                    <FlatList data={sprayLogs} keyExtractor={(i) => i.id} renderItem={({ item }) => (
                        <TouchableOpacity onPress={() => toggle(item.id)} style={styles.row} accessibilityRole="checkbox" accessibilityState={{ checked: !!selected[item.id] }}>
                            <Text style={styles.checkbox}>{selected[item.id] ? '☑' : '☐'}</Text>
                            <View>
                                <Text style={styles.rowTitle}>{item.field_id} — {item.recipe_id}</Text>
                                <Text style={styles.rowSub}>Temp: {item.weather_temp}°F · Wind: {item.weather_wind_speed} mph {item.weather_wind_dir}</Text>
                            </View>
                        </TouchableOpacity>
                    )} />
                )}

                {tab === 'GRAIN' && (
                    <FlatList data={bins} keyExtractor={(i) => i.id} renderItem={({ item }) => (
                        <TouchableOpacity onPress={() => toggle(item.id)} style={styles.row} accessibilityRole="checkbox" accessibilityState={{ checked: !!selected[item.id] }}>
                            <Text style={styles.checkbox}>{selected[item.id] ? '☑' : '☐'}</Text>
                            <View>
                                <Text style={styles.rowTitle}>{item.name}</Text>
                                <Text style={styles.rowSub}>On Hand: {item.current_level ?? 0} bu</Text>
                            </View>
                        </TouchableOpacity>
                    )} />
                )}
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Theme.colors.background },
    header: { padding: Theme.spacing.md, borderBottomWidth: 1, borderBottomColor: Theme.colors.border, backgroundColor: Theme.colors.white },
    tabRow: { flexDirection: 'row' },
    tab: { padding: 10, marginRight: 8, borderRadius: 8, backgroundColor: Theme.colors.surface },
    tabActive: { backgroundColor: Theme.colors.primary },
    tabText: { fontWeight: 'bold', color: Theme.colors.textSecondary },
    tabTextActive: { color: '#fff' },
    actionsRow: { marginTop: 8, flexDirection: 'row', justifyContent: 'flex-end' },
    deleteBtn: { backgroundColor: Theme.colors.danger, padding: 8, borderRadius: 8 },
    deleteBtnText: { color: '#fff', fontWeight: 'bold' },
    listContainer: { flex: 1, padding: Theme.spacing.md },
    row: { flexDirection: 'row', alignItems: 'center', padding: Theme.spacing.md, backgroundColor: '#fff', borderRadius: 8, marginBottom: Theme.spacing.sm, borderWidth: 1, borderColor: Theme.colors.border },
    checkbox: { marginRight: 12, fontSize: 20 },
    rowTitle: { fontWeight: 'bold' },
    rowSub: { color: Theme.colors.textSecondary, fontSize: 12 }
});
