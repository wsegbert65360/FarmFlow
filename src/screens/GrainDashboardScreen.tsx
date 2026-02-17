import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View, FlatList, SafeAreaView, ScrollView, TouchableOpacity, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { Theme } from '../constants/Theme';
import { useGrain, Bin } from '../hooks/useGrain';
import { useContracts, Contract } from '../hooks/useContracts';

interface GrainDashboardProps {
    onSelectAction: (id: string, name: string, type: 'HARVEST' | 'DELIVERY') => void;
}

export const GrainDashboardScreen = ({ onSelectAction }: GrainDashboardProps) => {
    const { bins, loading: grainLoading, addBin: createBin, updateBin, deleteBin } = useGrain();
    const { contracts, loading: contractLoading, addContract: createContract, updateContract, deleteContract } = useContracts();

    // UI State
    const [binModalVisible, setBinModalVisible] = useState(false);
    const [contractModalVisible, setContractModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null); // Bin or Contract
    const [saving, setSaving] = useState(false);

    // Alert Logic
    const alerts = useMemo(() => {
        const items: { id: string; type: 'CRITICAL' | 'WARNING'; message: string }[] = [];
        const now = new Date();
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(now.getDate() + 7);

        contracts.forEach(c => {
            const delivered = c.delivered_bushels || 0;
            const deadlineDate = c.delivery_deadline ? new Date(c.delivery_deadline) : null;

            // 1. Delivery Deadlines
            if (deadlineDate) {
                if (deadlineDate < now && delivered < c.total_bushels) {
                    items.push({ id: `deadline-crit-${c.id}`, type: 'CRITICAL', message: `Deadline passed for ${c.destination_name}!` });
                } else if (deadlineDate < sevenDaysFromNow && delivered < c.total_bushels) {
                    items.push({ id: `deadline-warn-${c.id}`, type: 'WARNING', message: `Delivery for ${c.destination_name} due soon.` });
                }
            }

            // 2. Fulfillment Logic
            if (delivered > c.total_bushels) {
                items.push({ id: `over-${c.id}`, type: 'CRITICAL', message: `Over-delivered to ${c.destination_name} (+${(delivered - c.total_bushels).toLocaleString()} bu)` });
            } else if (delivered > c.total_bushels * 0.9 && delivered < c.total_bushels) {
                items.push({ id: `near-${c.id}`, type: 'WARNING', message: `Contract with ${c.destination_name} is 90% full.` });
            }
        });

        return items;
    }, [contracts]);

    // Form State - Bin
    const [name, setName] = useState('');
    const [capacity, setCapacity] = useState('');
    const [cropType, setCropType] = useState('Corn');

    // Form State - Contract
    const [destination, setDestination] = useState('');
    const [commodity, setCommodity] = useState('Corn');
    const [totalBushels, setTotalBushels] = useState('');
    const [price, setPrice] = useState('');
    const [deadline, setDeadline] = useState('');

    const openBinModal = useCallback((bin?: Bin) => {
        if (bin) {
            setEditingItem(bin);
            setName(bin.name);
            setCapacity(bin.capacity?.toString() || '');
            setCropType(bin.crop_type || 'Corn');
        } else {
            setEditingItem(null);
            setName('');
            setCapacity('');
            setCropType('Corn');
        }
        setBinModalVisible(true);
    }, []);

    const saveBin = async () => {
        if (!name) return Alert.alert('Error', 'Name is required');
        Keyboard.dismiss();
        setSaving(true);
        console.log('SaveBin clicked', { name, capacity, cropType, editing: !!editingItem });
        try {
            if (editingItem) {
                await updateBin(editingItem.id, name, parseFloat(capacity) || 0, cropType);
            } else {
                await createBin(name, parseFloat(capacity) || 0, cropType);
            }
            console.log('SaveBin success');
            setBinModalVisible(false);
        } catch (e: any) {
            console.error('SaveBin failed', e);
            Alert.alert('Error', `Failed to save bin: ${e?.message || 'Unknown error'}`);
        } finally {
            setSaving(false);
        }
    };

    const deleteCurrentBin = async () => {
        if (!editingItem) return;
        Alert.alert('Delete Bin', 'Are you sure? This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    setSaving(true);
                    await deleteBin(editingItem.id);
                    setSaving(false);
                    setBinModalVisible(false);
                }
            }
        ]);
    };

    const openContractModal = useCallback((c?: Contract) => {
        if (c) {
            setEditingItem(c);
            setDestination(c.destination_name);
            setCommodity(c.commodity);
            setTotalBushels(c.total_bushels?.toString() || '');
            setPrice(c.price_per_bushel?.toString() || '');
            setDeadline(c.delivery_deadline || '');
        } else {
            setEditingItem(null);
            setDestination('');
            setCommodity('Corn');
            setTotalBushels('');
            setPrice('');
            setDeadline('');
        }
        setContractModalVisible(true);
    }, []);

    const saveContract = async () => {
        if (!destination || !totalBushels) return Alert.alert('Error', 'Destination and Total Bushels are required');
        Keyboard.dismiss();
        setSaving(true);
        console.log('SaveContract clicked', { destination, commodity, totalBushels, editing: !!editingItem });
        try {
            const contractData = {
                destination_name: destination,
                commodity,
                total_bushels: parseFloat(totalBushels),
                price_per_bushel: parseFloat(price) || 0,
                delivery_deadline: deadline
            };

            if (editingItem) {
                await updateContract(editingItem.id, contractData);
            } else {
                await createContract(contractData as any);
            }
            console.log('SaveContract success');
            setContractModalVisible(false);
        } catch (e: any) {
            console.error('SaveContract failed', e);
            Alert.alert('Error', `Failed to save contract: ${e?.message || 'Unknown error'}`);
        } finally {
            setSaving(false);
        }
    };

    const deleteCurrentContract = async () => {
        if (!editingItem) return;
        Alert.alert('Delete Contract', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    setSaving(true);
                    await deleteContract(editingItem.id);
                    setSaving(false);
                    setContractModalVisible(false);
                }
            }
        ]);
    };

    const renderBin = useCallback(({ item }: { item: Bin }) => {
        const fullness = item.capacity ? (item.current_level || 0) / item.capacity : 0;

        return (
            <TouchableOpacity onPress={() => openBinModal(item)} style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{item.name}</Text>
                    <Text style={styles.cardSubtitle}>{item.crop_type}</Text>
                </View>

                <View style={styles.progressContainer}>
                    <View style={[styles.progressBar, { width: `${Math.min(fullness * 100, 100)}%` }]} />
                </View>

                <View style={styles.statsRow}>
                    <Text style={styles.statLabel}>Current: <Text style={styles.statValue}>{item.current_level?.toLocaleString()} bu</Text></Text>
                    <Text style={styles.statLabel}>Capacity: <Text style={styles.statValue}>{item.capacity?.toLocaleString()} bu</Text></Text>
                </View>

                <View style={styles.cardActions}>
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: Theme.colors.success }]}
                        onPress={() => onSelectAction(item.id, item.name, 'HARVEST')}
                    >
                        <Text style={styles.actionButtonText}>Log Harvest</Text>
                    </TouchableOpacity>
                    <View style={{ width: Theme.spacing.md }} />
                    <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => onSelectAction(item.id, item.name, 'DELIVERY')}
                    >
                        <Text style={styles.actionButtonText}>Log Delivery</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    }, [openBinModal, onSelectAction]);

    const renderContract = useCallback(({ item }: { item: Contract }) => {
        const progress = (item.delivered_bushels || 0) / item.total_bushels;

        return (
            <TouchableOpacity onPress={() => openContractModal(item)} style={[styles.card, styles.contractCard]}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{item.destination_name}</Text>
                    <Text style={styles.cardSubtitle}>{item.commodity}</Text>
                </View>

                <View style={styles.progressContainer}>
                    <View style={[styles.progressBar, styles.contractProgress, { width: `${Math.min(progress * 100, 100)}%` }]} />
                </View>

                <View style={styles.statsRow}>
                    <Text style={styles.statLabel}>Delivered: <Text style={styles.statValue}>{item.delivered_bushels?.toLocaleString()} bu</Text></Text>
                    <Text style={styles.statLabel}>Total: <Text style={styles.statValue}>{item.total_bushels?.toLocaleString()} bu</Text></Text>
                </View>
            </TouchableOpacity>
        );
    }, [openContractModal]);

    const stats = useMemo(() => {
        const totalCapacity = bins.reduce((acc, b) => acc + (b.capacity || 0), 0);
        const totalLevel = bins.reduce((acc, b) => acc + (b.current_level || 0), 0);
        const storagePercent = totalCapacity ? (totalLevel / totalCapacity) * 100 : 0;

        const totalContracted = contracts.reduce((acc, c) => acc + (c.total_bushels || 0), 0);
        const totalDelivered = contracts.reduce((acc, c) => acc + (c.delivered_bushels || 0), 0);
        const contractPercent = totalContracted ? (totalDelivered / totalContracted) * 100 : 0;

        return { totalCapacity, totalLevel, storagePercent, totalContracted, totalDelivered, contractPercent };
    }, [bins, contracts]);

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* Tactical Alerts */}
                {alerts.length > 0 && (
                    <View style={styles.alertsContainer}>
                        {alerts.map(alert => (
                            <View key={alert.id} style={[styles.alertBar, alert.type === 'CRITICAL' ? styles.alertCritical : styles.alertWarning]}>
                                <Text style={styles.alertText}>{alert.message}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Farm-Wide Summary */}
                <View style={styles.summaryContainer}>
                    <View style={styles.summaryBox}>
                        <Text style={styles.summaryLabel}>Total Storage</Text>
                        <Text style={styles.summaryValue}>{stats.storagePercent.toFixed(0)}%</Text>
                        <Text style={styles.summarySub}>{stats.totalLevel.toLocaleString()} bu</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryBox}>
                        <Text style={styles.summaryLabel}>Sales Progress</Text>
                        <Text style={styles.summaryValue}>{stats.contractPercent.toFixed(0)}%</Text>
                        <Text style={styles.summarySub}>{stats.totalDelivered.toLocaleString()} / {stats.totalContracted.toLocaleString()}</Text>
                    </View>
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Virtual Bins</Text>
                    <TouchableOpacity onPress={() => openBinModal()} style={styles.addButton}>
                        <Text style={styles.addButtonText}>+</Text>
                    </TouchableOpacity>
                </View>
                <FlatList
                    data={bins}
                    renderItem={renderBin}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                    ListEmptyComponent={grainLoading ? <Text>Loading...</Text> : <Text style={styles.emptyText}>No bins configured.</Text>}
                />

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Active Contracts</Text>
                    <TouchableOpacity onPress={() => openContractModal()} style={styles.addButton}>
                        <Text style={styles.addButtonText}>+</Text>
                    </TouchableOpacity>
                </View>
                <FlatList
                    data={contracts}
                    renderItem={renderContract}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                    ListEmptyComponent={contractLoading ? <Text>Loading...</Text> : <Text style={styles.emptyText}>No active contracts.</Text>}
                />
            </ScrollView>

            {/* Bin Modal */}
            <Modal visible={binModalVisible} animationType="slide" transparent>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{editingItem ? 'Edit Bin' : 'New Bin'}</Text>
                        <TextInput style={styles.input} placeholder="Bin Name (e.g. Bin 1)" value={name} onChangeText={setName} />
                        <TextInput style={styles.input} placeholder="Capacity (Bushels)" value={capacity} onChangeText={setCapacity} keyboardType="numeric" />
                        <TextInput style={styles.input} placeholder="Crop Type (Corn/Soy)" value={cropType} onChangeText={setCropType} />

                        <View style={styles.modalActions}>
                            {editingItem && (
                                <TouchableOpacity onPress={deleteCurrentBin} disabled={saving} style={[styles.modalButton, styles.deleteButton, saving && { opacity: 0.5 }]}>
                                    <Text style={styles.buttonText}>Delete</Text>
                                </TouchableOpacity>
                            )}
                            <View style={{ flex: 1 }} />
                            <TouchableOpacity onPress={() => setBinModalVisible(false)} disabled={saving} style={[styles.modalButton, styles.cancelButton]}>
                                <Text style={[styles.buttonText, { color: '#333' }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={saveBin} disabled={saving} style={[styles.modalButton, styles.saveButton, saving && { opacity: 0.5 }]}>
                                <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Contract Modal */}
            <Modal visible={contractModalVisible} animationType="slide" transparent>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{editingItem ? 'Edit Contract' : 'New Contract'}</Text>
                        <TextInput style={styles.input} placeholder="Destination (e.g. ADM)" value={destination} onChangeText={setDestination} />
                        <TextInput style={styles.input} placeholder="Commodity" value={commodity} onChangeText={setCommodity} />
                        <TextInput style={styles.input} placeholder="Total Bushels" value={totalBushels} onChangeText={setTotalBushels} keyboardType="numeric" />
                        <TextInput style={styles.input} placeholder="Price ($/bu)" value={price} onChangeText={setPrice} keyboardType="numeric" />
                        <TextInput style={styles.input} placeholder="Deadline (YYYY-MM-DD)" value={deadline} onChangeText={setDeadline} />

                        <View style={styles.modalActions}>
                            {editingItem && (
                                <TouchableOpacity onPress={deleteCurrentContract} disabled={saving} style={[styles.modalButton, styles.deleteButton, saving && { opacity: 0.5 }]}>
                                    <Text style={styles.buttonText}>Delete</Text>
                                </TouchableOpacity>
                            )}
                            <View style={{ flex: 1 }} />
                            <TouchableOpacity onPress={() => setContractModalVisible(false)} disabled={saving} style={[styles.modalButton, styles.cancelButton]}>
                                <Text style={[styles.buttonText, { color: '#333' }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={saveContract} disabled={saving} style={[styles.modalButton, styles.saveButton, saving && { opacity: 0.5 }]}>
                                <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Theme.colors.background },
    scrollContent: { padding: Theme.spacing.lg },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Theme.spacing.lg, marginBottom: Theme.spacing.md },
    sectionTitle: { ...Theme.typography.h2, color: Theme.colors.textSecondary },
    addButton: { backgroundColor: Theme.colors.primary, width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
    addButtonText: { color: Theme.colors.white, fontSize: 20, fontWeight: 'bold' },
    summaryContainer: {
        flexDirection: 'row',
        backgroundColor: Theme.colors.primary,
        borderRadius: Theme.borderRadius.md,
        padding: Theme.spacing.xl,
        marginBottom: Theme.spacing.lg,
        alignItems: 'center',
    },
    summaryBox: { flex: 1, alignItems: 'center' },
    summaryLabel: { ...Theme.typography.caption, color: Theme.colors.whiteMuted, fontWeight: 'bold' },
    summaryValue: { fontSize: 32, fontWeight: 'bold', color: Theme.colors.white, marginVertical: Theme.spacing.xs },
    summarySub: { ...Theme.typography.caption, color: Theme.colors.whiteMuted },
    summaryDivider: { width: 1, height: '60%', backgroundColor: 'rgba(255,255,255,0.3)', marginHorizontal: Theme.spacing.lg },
    card: {
        backgroundColor: Theme.colors.white,
        padding: Theme.spacing.lg,
        borderRadius: Theme.borderRadius.md,
        marginBottom: Theme.spacing.md,
        borderWidth: 1,
        borderColor: Theme.colors.border,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.md },
    cardTitle: { ...Theme.typography.h2 },
    cardSubtitle: { ...Theme.typography.caption, color: Theme.colors.textSecondary },
    progressContainer: {
        height: 20,
        backgroundColor: Theme.colors.surface,
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: Theme.spacing.md,
    },
    progressBar: {
        height: '100%',
        backgroundColor: Theme.colors.primary,
    },
    contractCard: { borderColor: Theme.colors.primary },
    contractProgress: { backgroundColor: Theme.colors.success },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    statLabel: { ...Theme.typography.caption, color: Theme.colors.textSecondary },
    statValue: { fontWeight: 'bold', color: Theme.colors.text },
    emptyText: { fontStyle: 'italic', color: Theme.colors.textSecondary, marginBottom: 20 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: Theme.colors.white,
        borderTopLeftRadius: Theme.borderRadius.lg,
        borderTopRightRadius: Theme.borderRadius.lg,
        padding: Theme.spacing.xl,
    },
    modalTitle: { ...Theme.typography.h2, marginBottom: Theme.spacing.lg },
    input: {
        borderWidth: 1,
        borderColor: Theme.colors.border,
        padding: Theme.spacing.md,
        borderRadius: Theme.borderRadius.sm,
        fontSize: 16,
        marginBottom: Theme.spacing.md,
    },
    modalActions: { flexDirection: 'row', marginTop: Theme.spacing.lg },
    modalButton: { padding: Theme.spacing.md, borderRadius: Theme.borderRadius.sm, alignItems: 'center' },
    saveButton: { backgroundColor: Theme.colors.primary, minWidth: 100 },
    cancelButton: { backgroundColor: Theme.colors.surface, marginRight: Theme.spacing.md },
    deleteButton: { backgroundColor: Theme.colors.danger, marginRight: Theme.spacing.md },
    buttonText: { color: Theme.colors.white, fontWeight: 'bold', fontSize: 16 },

    cardActions: {
        flexDirection: 'row',
        marginTop: Theme.spacing.md,
    },
    actionButton: {
        flex: 1,
        backgroundColor: Theme.colors.primary,
        padding: Theme.spacing.sm,
        borderRadius: Theme.borderRadius.sm,
        alignItems: 'center',
    },
    actionButtonText: { color: Theme.colors.white, fontSize: 14, fontWeight: 'bold' },

    // Alerts Styles
    alertsContainer: { marginBottom: Theme.spacing.lg },
    alertBar: {
        padding: Theme.spacing.md,
        borderRadius: Theme.borderRadius.sm,
        marginBottom: Theme.spacing.xs,
        borderLeftWidth: 5,
    },
    alertCritical: {
        backgroundColor: '#FEE2E2',
        borderLeftColor: Theme.colors.danger,
    },
    alertWarning: {
        backgroundColor: '#FEF3C7',
        borderLeftColor: '#F59E0B',
    },
    alertText: { ...Theme.typography.caption, fontWeight: 'bold', color: '#1F2937' },
});
