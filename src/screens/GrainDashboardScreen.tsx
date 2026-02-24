import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View, FlatList, SafeAreaView, ScrollView, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, Keyboard, useWindowDimensions } from 'react-native';
import { showAlert, showConfirm, showDeleteConfirm } from '../utils/AlertUtility';
import { Theme } from '../constants/Theme';
import { useGrain, Bin } from '../hooks/useGrain';
import { useContracts, Contract } from '../hooks/useContracts';
import { parseNumericInput } from '../utils/NumberUtility';
import { useLandlords, Landlord } from '../hooks/useLandlords';

interface GrainDashboardProps {
    onSelectAction: (id: string, name: string, type: 'HARVEST' | 'DELIVERY') => void;
    mode?: 'MANAGE' | 'SELECT_BIN' | 'SELECT_CONTRACT';
}

export const GrainDashboardScreen = ({ onSelectAction, mode = 'MANAGE' }: GrainDashboardProps) => {
    const { bins, loading: grainLoading, addBin: createBin, updateBin, deleteBin, addGrainLog } = useGrain();
    const { contracts, loading: contractLoading, addContract: createContract, updateContract, deleteContract } = useContracts();
    const { landlords } = useLandlords();
    const { width } = useWindowDimensions();

    const isDesktop = width > 768;
    const numColumns = isDesktop ? (width > 1200 ? 3 : 2) : 1;

    // UI State
    const [binModalVisible, setBinModalVisible] = useState(false);
    const [contractModalVisible, setContractModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<any>(null); // Bin or Contract
    const [saving, setSaving] = useState(false);
    const [quickEditBinId, setQuickEditBinId] = useState<string | null>(null);
    const [quickEditValue, setQuickEditValue] = useState('');

    // Alert Logic
    const alerts = useMemo(() => {
        const items: { id: string; type: 'CRITICAL' | 'WARNING'; message: string }[] = [];
        const now = new Date();
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(now.getDate() + 7);

        contracts.forEach(c => {
            const delivered = c.delivered_bushels || 0;
            const deadlineDate = c.delivery_deadline ? new Date(c.delivery_deadline) : null;

            if (deadlineDate) {
                if (deadlineDate < now && delivered < c.total_bushels) {
                    items.push({ id: `deadline-crit-${c.id}`, type: 'CRITICAL', message: `Deadline passed for ${c.destination_name}!` });
                } else if (deadlineDate < sevenDaysFromNow && delivered < c.total_bushels) {
                    items.push({ id: `deadline-warn-${c.id}`, type: 'WARNING', message: `Delivery for ${c.destination_name} due soon.` });
                }
            }

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
    const [selectedLandlordId, setSelectedLandlordId] = useState<string | null>(null);
    const [sharePct, setSharePct] = useState('');

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
            setSelectedLandlordId(bin.landlord_id || null);
            setSharePct(bin.landlord_share_pct ? bin.landlord_share_pct.toString() : '');
        } else {
            setEditingItem(null);
            setName('');
            setCapacity('');
            setCropType('Corn');
            setSelectedLandlordId(null);
            setSharePct('');
        }
        setBinModalVisible(true);
    }, []);

    const saveBin = async () => {
        if (!name) return showAlert('Error', 'Name is required');
        Keyboard.dismiss();
        setSaving(true);
        try {
            if (editingItem) {
                await updateBin(editingItem.id, name, parseNumericInput(capacity) || 0, cropType, selectedLandlordId, parseNumericInput(sharePct) || null);
            } else {
                await createBin(name, parseNumericInput(capacity) || 0, cropType, selectedLandlordId, parseNumericInput(sharePct) || null);
            }
            setBinModalVisible(false);
        } catch (e: any) {
            showAlert('Error', `Failed to save bin: ${e?.message || 'Unknown error'}`);
        } finally {
            setSaving(false);
        }
    };

    const deleteCurrentBin = async () => {
        if (!editingItem) return;
        showDeleteConfirm('this grain bin', async () => {
            const activeBin = editingItem as Bin;
            if (activeBin) {
                setSaving(true);
                await deleteBin(activeBin.id);
                setSaving(false);
                setBinModalVisible(false);
            }
        });
    };

    const saveQuickEdit = async (bin: Bin) => {
        const newVal = parseFloat(quickEditValue);
        if (isNaN(newVal)) {
            setQuickEditBinId(null);
            return;
        }

        const currentVal = bin.current_level || 0;
        const diff = newVal - currentVal;

        if (Math.abs(diff) < 0.1) {
            setQuickEditBinId(null);
            return;
        }

        try {
            // Add an adjustment log to modify the level
            await addGrainLog({
                bin_id: bin.id,
                field_id: 'MANUAL_ADJUST',
                bushels_net: diff,
                moisture: 15.0,
                end_time: new Date().toISOString(),
                type: 'ADJUSTMENT',
                destination_type: 'BIN',
                destination_name: bin.name
            });
            setQuickEditBinId(null);
        } catch (e) {
            showAlert('Error', 'Failed to update bin level.');
        }
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
        if (!destination || !totalBushels) return showAlert('Error', 'Required fields missing');
        Keyboard.dismiss();
        setSaving(true);
        try {
            const bushels = parseNumericInput(totalBushels);
            const p = parseNumericInput(price);

            const contractData = {
                destination_name: destination,
                commodity,
                total_bushels: bushels,
                price_per_bushel: p || 0,
                delivery_deadline: deadline
            };

            if (editingItem) {
                await updateContract(editingItem.id, contractData);
            } else {
                await createContract(contractData as any); // Cast to any because contractData is Omit<Contract, "id">
            }
            setContractModalVisible(false);
        } catch (e: any) {
            showAlert('Error', `Failed to save contract`);
        } finally {
            setSaving(false);
        }
    };

    const deleteCurrentContract = async () => {
        if (!editingItem) return;
        showDeleteConfirm('this contract', async () => {
            const activeContract = editingItem as Contract;
            if (activeContract) {
                setSaving(true);
                await deleteContract(activeContract.id);
                setSaving(false);
                setContractModalVisible(false);
            }
        });
    };

    const renderBin = useCallback(({ item }: { item: Bin }) => {
        const fullness = item.capacity ? (item.current_level || 0) / item.capacity : 0;
        const isQuickEditing = quickEditBinId === item.id;

        let statusColor = Theme.colors.success;
        if (fullness >= 0.95) statusColor = Theme.colors.danger; // Critical
        else if (fullness >= 0.80) statusColor = Theme.colors.warning; // Warning

        return (
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => !isQuickEditing && openBinModal(item)}
                style={[styles.card, isDesktop && { flex: 1 / numColumns - 0.05 }]}
            >
                <View style={styles.cardHeader}>
                    <View>
                        <Text style={styles.cardTitle}>{item.name}</Text>
                        <Text style={styles.cardSubtitle}>{item.crop_type}</Text>
                    </View>
                    <View style={[styles.statusBadge, { borderColor: statusColor, backgroundColor: statusColor + '20' }]}>
                        <Text style={[styles.statusBadgeText, { color: statusColor }]}>{(fullness * 100).toFixed(0)}%</Text>
                    </View>
                </View>

                <View style={styles.progressContainer}>
                    <View style={[styles.progressBar, { width: `${Math.min(fullness * 100, 100)}%`, backgroundColor: statusColor }]} />
                </View>

                <View style={styles.statsRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.statLabel}>Current Level</Text>
                        {isQuickEditing ? (
                            <TextInput
                                style={styles.quickInput}
                                value={quickEditValue}
                                onChangeText={setQuickEditValue}
                                keyboardType="numeric"
                                autoFocus
                                onBlur={() => saveQuickEdit(item)}
                                onSubmitEditing={() => saveQuickEdit(item)}
                            />
                        ) : (
                            <TouchableOpacity
                                onPress={(e) => {
                                    e.stopPropagation();
                                    setQuickEditBinId(item.id);
                                    setQuickEditValue(item.current_level?.toString() || '0');
                                }}
                            >
                                <Text style={[styles.statValue, { fontSize: 18, color: Theme.colors.primary }]}>
                                    {item.current_level?.toLocaleString()} bu ✎
                                </Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.statLabel}>Capacity</Text>
                        <Text style={styles.statValue}>{item.capacity?.toLocaleString()} bu</Text>
                    </View>
                </View>

                <View style={styles.cardActions}>
                    <TouchableOpacity
                        style={[styles.actionButton, { backgroundColor: Theme.colors.success, borderColor: Theme.colors.success }]}
                        onPress={() => onSelectAction(item.id, item.name, 'HARVEST')}
                    >
                        <Text style={[styles.actionButtonText, { color: 'white' }]}>Log Harvest</Text>
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
    }, [openBinModal, onSelectAction, quickEditBinId, quickEditValue, isDesktop, numColumns]);

    const renderContract = useCallback(({ item }: { item: Contract }) => {
        const progress = (item.delivered_bushels || 0) / item.total_bushels;

        return (
            <TouchableOpacity
                onPress={() => openContractModal(item)}
                style={[styles.card, styles.contractCard, isDesktop && { flex: 1 / numColumns - 0.05 }]}
            >
                <View style={styles.cardHeader}>
                    <View>
                        <Text style={styles.cardTitle}>{item.destination_name}</Text>
                        <Text style={styles.cardSubtitle}>{item.commodity}</Text>
                    </View>
                </View>

                <View style={styles.progressContainer}>
                    <View style={[styles.progressBar, styles.contractProgress, { width: `${Math.min(progress * 100, 100)}%` }]} />
                </View>

                <View style={styles.statsRow}>
                    <View>
                        <Text style={styles.statLabel}>Delivered</Text>
                        <Text style={styles.statValue}>{item.delivered_bushels?.toLocaleString()} bu</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.statLabel}>Contract Total</Text>
                        <Text style={styles.statValue}>{item.total_bushels?.toLocaleString()} bu</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    }, [openContractModal, isDesktop, numColumns]);

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
                {alerts.length > 0 && (
                    <View style={styles.alertsContainer}>
                        {alerts.map(alert => (
                            <View key={alert.id} style={[styles.alertBar, alert.type === 'CRITICAL' ? styles.alertCritical : styles.alertWarning]}>
                                <Text style={styles.alertText}>{alert.message}</Text>
                            </View>
                        ))}
                    </View>
                )}

                <View style={styles.summaryContainer}>
                    <View style={styles.summaryBox}>
                        <Text style={styles.summaryLabel}>On Hand</Text>
                        <Text style={styles.summaryValue}>{stats.totalLevel.toLocaleString()}</Text>
                        <Text style={styles.summarySub}>Total Bushels in Bins</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryBox}>
                        <Text style={styles.summaryLabel}>Contracted</Text>
                        <Text style={styles.summaryValue}>{stats.totalContracted.toLocaleString()}</Text>
                        <Text style={styles.summarySub}>{stats.totalDelivered.toLocaleString()} Delivered</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryBox}>
                        <Text style={styles.summaryLabel}>Position</Text>
                        <Text style={[styles.summaryValue, { color: (stats.totalLevel - (stats.totalContracted - stats.totalDelivered)) < 0 ? '#FF5252' : '#8BC34A' }]}>
                            {(stats.totalLevel - (stats.totalContracted - stats.totalDelivered)).toLocaleString()}
                        </Text>
                        <Text style={styles.summarySub}>Available to Sell</Text>
                    </View>
                </View>

                {/* Quick Glance Widget */}
                <View style={styles.quickGlanceContainer}>
                    <View style={styles.rowBetween}>
                        <Text style={styles.quickGlanceTitle}>Total Storage Utilization</Text>
                        <Text style={styles.quickGlanceValue}>{stats.storagePercent.toFixed(1)}%</Text>
                    </View>
                    <View style={styles.quickGlanceTrack}>
                        <View style={[styles.quickGlanceBar, { width: `${Math.min(stats.storagePercent, 100)}%` }]} />
                    </View>
                    <Text style={styles.quickGlanceSub}>{stats.totalLevel.toLocaleString()} / {stats.totalCapacity.toLocaleString()} bushels</Text>
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Virtual Bins</Text>
                    <TouchableOpacity onPress={() => openBinModal()} style={styles.addButton}>
                        <Text style={styles.addButtonText}>+</Text>
                    </TouchableOpacity>
                </View>
                <FlatList
                    key={`bins-${numColumns}`}
                    data={bins}
                    renderItem={renderBin}
                    keyExtractor={(item) => item.id}
                    numColumns={numColumns}
                    scrollEnabled={false}
                    columnWrapperStyle={numColumns > 1 ? { gap: Theme.spacing.md } : undefined}
                    ListEmptyComponent={grainLoading ? <Text>...</Text> : <Text style={styles.emptyText}>No bins.</Text>}
                />

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Active Contracts</Text>
                    <TouchableOpacity onPress={() => openContractModal()} style={styles.addButton}>
                        <Text style={styles.addButtonText}>+</Text>
                    </TouchableOpacity>
                </View>
                <FlatList
                    key={`contracts-${numColumns}`}
                    data={contracts}
                    renderItem={renderContract}
                    keyExtractor={(item) => item.id}
                    numColumns={numColumns}
                    scrollEnabled={false}
                    columnWrapperStyle={numColumns > 1 ? { gap: Theme.spacing.md } : undefined}
                    ListEmptyComponent={contractLoading ? <Text>...</Text> : <Text style={styles.emptyText}>No contracts.</Text>}
                />
            </ScrollView>

            {/* Modals remain mostly the same but could be centered on desktop if needed */}
            <Modal visible={binModalVisible} animationType="fade" transparent>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                    <View style={[styles.modalContent, isDesktop && styles.desktopModal]}>
                        <Text style={styles.modalTitle}>{editingItem ? 'Edit Bin' : 'New Bin'}</Text>
                        <TextInput style={styles.input} placeholder="Name" value={name} onChangeText={setName} />
                        <TextInput style={styles.input} placeholder="Capacity" value={capacity} onChangeText={setCapacity} keyboardType="numeric" />
                        <TextInput style={styles.input} placeholder="Crop" value={cropType} onChangeText={setCropType} />

                        {/* Landlord Selection */}
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#888', marginTop: 8, marginBottom: 4, textTransform: 'uppercase' }}>Landlord Split (Optional)</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                            <TouchableOpacity
                                onPress={() => { setSelectedLandlordId(null); setSharePct(''); }}
                                style={[styles.input, { flex: 1, minWidth: 80, justifyContent: 'center', backgroundColor: !selectedLandlordId ? '#E8F5E9' : '#fff', borderColor: !selectedLandlordId ? Theme.colors.primary : Theme.colors.border }]}
                            >
                                <Text style={{ textAlign: 'center', fontWeight: !selectedLandlordId ? 'bold' : 'normal' }}>No Split</Text>
                            </TouchableOpacity>
                            {landlords.map(l => (
                                <TouchableOpacity
                                    key={l.id}
                                    onPress={() => setSelectedLandlordId(l.id)}
                                    style={[styles.input, { flex: 1, minWidth: 80, justifyContent: 'center', backgroundColor: selectedLandlordId === l.id ? '#FFF8E1' : '#fff', borderColor: selectedLandlordId === l.id ? Theme.colors.warning : Theme.colors.border }]}
                                >
                                    <Text style={{ textAlign: 'center', fontWeight: selectedLandlordId === l.id ? 'bold' : 'normal' }}>{l.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        {selectedLandlordId && (
                            <TextInput
                                style={styles.input}
                                placeholder="Landlord Share % (e.g. 33)"
                                value={sharePct}
                                onChangeText={setSharePct}
                                keyboardType="numeric"
                            />
                        )}
                        <View style={styles.modalActions}>
                            {editingItem && (
                                <TouchableOpacity onPress={deleteCurrentBin} style={[styles.modalButton, styles.deleteButton]}>
                                    <Text style={styles.buttonText}>Delete</Text>
                                </TouchableOpacity>
                            )}
                            <View style={{ flex: 1 }} />
                            <TouchableOpacity onPress={() => setBinModalVisible(false)} style={[styles.modalButton, styles.cancelButton]}>
                                <Text style={[styles.buttonText, { color: '#333' }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={saveBin} style={[styles.modalButton, styles.saveButton]}>
                                <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <Modal visible={contractModalVisible} animationType="fade" transparent>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                    <View style={[styles.modalContent, isDesktop && styles.desktopModal]}>
                        <Text style={styles.modalTitle}>{editingItem ? 'Edit Contract' : 'New Contract'}</Text>
                        <TextInput style={styles.input} placeholder="Destination" value={destination} onChangeText={setDestination} />
                        <TextInput style={styles.input} placeholder="Commodity" value={commodity} onChangeText={setCommodity} />
                        <TextInput style={styles.input} placeholder="Total Bushels" value={totalBushels} onChangeText={setTotalBushels} keyboardType="numeric" />
                        <TextInput style={styles.input} placeholder="Price" value={price} onChangeText={setPrice} keyboardType="numeric" />
                        <TextInput style={styles.input} placeholder="Deadline" value={deadline} onChangeText={setDeadline} />
                        <View style={styles.modalActions}>
                            {editingItem && (
                                <TouchableOpacity onPress={deleteCurrentContract} style={[styles.modalButton, styles.deleteButton]}>
                                    <Text style={styles.buttonText}>Delete</Text>
                                </TouchableOpacity>
                            )}
                            <View style={{ flex: 1 }} />
                            <TouchableOpacity onPress={() => setContractModalVisible(false)} style={[styles.modalButton, styles.cancelButton]}>
                                <Text style={[styles.buttonText, { color: '#333' }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={saveContract} style={[styles.modalButton, styles.saveButton]}>
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
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Theme.spacing.lg, marginBottom: Theme.spacing.md },
    sectionTitle: { ...Theme.typography.h2, color: Theme.colors.textSecondary },
    addButton: { backgroundColor: Theme.colors.primary, width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
    addButtonText: { color: Theme.colors.white, fontSize: 20, fontWeight: 'bold' },
    summaryContainer: {
        flexDirection: 'row',
        backgroundColor: Theme.colors.primary,
        borderRadius: Theme.borderRadius.md,
        paddingVertical: Theme.spacing.lg,
        paddingHorizontal: Theme.spacing.md,
        marginBottom: Theme.spacing.lg,
        alignItems: 'center',
    },
    summaryBox: { flex: 1, alignItems: 'center' },
    summaryLabel: { ...Theme.typography.caption, color: Theme.colors.whiteMuted, fontWeight: 'bold' },
    summaryValue: { fontSize: 24, fontWeight: 'bold', color: Theme.colors.white, marginVertical: 2 },
    summarySub: { fontSize: 10, color: Theme.colors.whiteMuted, textAlign: 'center' },
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
        height: 12,
        backgroundColor: Theme.colors.surface,
        borderRadius: 6,
        overflow: 'hidden',
        marginBottom: Theme.spacing.md,
    },
    progressBar: {
        height: '100%',
        backgroundColor: Theme.colors.primary,
    },
    contractCard: { borderColor: Theme.colors.primary },
    contractProgress: { backgroundColor: '#388E3C' },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    statLabel: { ...Theme.typography.caption, color: Theme.colors.textSecondary, marginBottom: 2 },
    statValue: { fontWeight: 'bold', color: Theme.colors.text },
    emptyText: { fontStyle: 'italic', color: Theme.colors.textSecondary, marginBottom: 20 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
    modalContent: {
        backgroundColor: Theme.colors.white,
        borderRadius: Theme.borderRadius.lg,
        padding: Theme.spacing.xl,
        width: '90%',
        maxWidth: 500,
    },
    desktopModal: {
        width: 500,
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
    modalButton: { padding: Theme.spacing.md, borderRadius: Theme.borderRadius.sm, alignItems: 'center', minWidth: 80 },
    saveButton: { backgroundColor: Theme.colors.primary },
    cancelButton: { backgroundColor: Theme.colors.surface, marginRight: Theme.spacing.md },
    deleteButton: { backgroundColor: Theme.colors.danger, marginRight: Theme.spacing.md },
    buttonText: { color: Theme.colors.white, fontWeight: 'bold', fontSize: 14 },
    cardActions: {
        flexDirection: 'row',
        marginTop: Theme.spacing.md,
        borderTopWidth: 1,
        borderTopColor: Theme.colors.border,
        paddingTop: Theme.spacing.md,
    },
    actionButton: {
        flex: 1,
        padding: Theme.spacing.sm,
        borderRadius: Theme.borderRadius.sm,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Theme.colors.primary,
    },
    actionButtonText: { color: Theme.colors.primary, fontSize: 12, fontWeight: 'bold' },
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
    quickGlanceContainer: {
        backgroundColor: Theme.colors.white,
        padding: Theme.spacing.lg,
        borderRadius: Theme.borderRadius.md,
        marginBottom: Theme.spacing.lg,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    quickGlanceTitle: { fontSize: 14, fontWeight: 'bold', color: Theme.colors.textSecondary },
    quickGlanceValue: { fontSize: 16, fontWeight: 'bold', color: Theme.colors.primary },
    quickGlanceTrack: {
        height: 16,
        backgroundColor: Theme.colors.surface,
        borderRadius: 8,
        marginVertical: Theme.spacing.sm,
        overflow: 'hidden',
    },
    quickGlanceBar: {
        height: '100%',
        backgroundColor: Theme.colors.primary,
    },
    quickGlanceSub: { ...Theme.typography.caption, color: Theme.colors.textSecondary },
    statusBadge: {
        backgroundColor: Theme.colors.surface,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Theme.colors.border,
    },
    statusBadgeText: {
        ...Theme.typography.caption,
        fontWeight: 'bold',
        color: Theme.colors.primary,
    },
    quickInput: {
        borderWidth: 1,
        borderColor: Theme.colors.primary,
        borderRadius: 4,
        padding: 4,
        fontSize: 16,
        fontWeight: 'bold',
        color: Theme.colors.primary,
        width: 140,
        backgroundColor: '#FFF',
    },
});
