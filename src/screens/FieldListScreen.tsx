import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, SafeAreaView, Modal, TextInput, useWindowDimensions, Platform } from 'react-native';
import { showAlert } from '../utils/AlertUtility';
import { Theme } from '../constants/Theme';
import { useFields, Field } from '../hooks/useFields';
import { parseNumericInput } from '../utils/NumberUtility';

import { useLandlords } from '../hooks/useLandlords';
import { useDatabase } from '../hooks/useDatabase';
import { db } from '../db/powersync';
import { fetchFieldSeasonalData } from '../hooks/useFieldReport';
import { generateReport } from '../utils/ReportUtility';
import { useAgreements } from '../hooks/useAgreements';
import { LoadingState, EmptyState } from '../components/common/UniversalStates';

interface FieldListProps {
    onSelectAction: (field: Field, type: 'SPRAY' | 'PLANTING' | 'HARVEST' | 'DELIVERY', replacesLogId?: string) => void;
    mode?: 'MANAGE' | 'SELECT';
}

export const FieldListScreen = ({ onSelectAction, mode = 'MANAGE' }: FieldListProps) => {
    const [search, setSearch] = useState('');
    const { fields, loading: fieldsLoading, addField } = useFields();
    const { farmId } = useDatabase();
    const { width } = useWindowDimensions();

    const isDesktop = width > 768;
    const numColumns = isDesktop ? (width > 1200 ? 3 : 2) : 1;

    const loading = fieldsLoading;
    const [modalVisible, setModalVisible] = useState(false);
    const [actionPickerVisible, setActionPickerVisible] = useState(false);
    const [selectedField, setSelectedField] = useState<Field | null>(null);
    const { landlords, addFieldSplit, fieldSplits: shares, loading: landlordsLoading } = useLandlords();
    const [splitsModalVisible, setSplitsModalVisible] = useState(false);
    const [selectedLandlordId, setSelectedLandlordId] = useState<string>('');
    const [splitPercentage, setSplitPercentage] = useState<string>('50');

    const [newName, setNewName] = useState('');
    const [newAcreage, setNewAcreage] = useState('');

    // Phase 1: Agreements
    const { agreements } = useAgreements(new Date().getFullYear());
    const [fieldAgreement, setFieldAgreement] = useState<any>(null);

    // History items
    const [historyModalVisible, setHistoryModalVisible] = useState(false);
    const [historyLogs, setHistoryLogs] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    const fetchFieldAgreement = async (fieldId: string) => {
        if (!farmId) return;

        // Optimize: Join to find the agreement for this specific field directly
        const result = await db.getAll(
            `SELECT ra.*
             FROM rent_agreements ra
             JOIN agreement_fields af ON ra.id = af.agreement_id
             WHERE af.field_id = ?
             AND ra.crop_year = ?
             AND ra.farm_id = ?`,
            [fieldId, new Date().getFullYear(), farmId]
        );

        if (result && result.length > 0) {
            setFieldAgreement(result[0]);
        } else {
            setFieldAgreement(null);
        }
    };

    const handleAddField = async () => {
        if (!newName || !newAcreage) return;
        try {
            await addField(newName, parseNumericInput(newAcreage));
            setNewName('');
            setNewAcreage('');
            setModalVisible(false);
        } catch (error) {
            showAlert('Error', 'Failed to add field.');
        }
    };

    const handleFieldPress = async (field: Field) => {
        setSelectedField(field);
        await fetchFieldAgreement(field.id);
        setActionPickerVisible(true);
    };

    const handleViewHistory = async () => {
        if (!selectedField || !farmId) return;
        setActionPickerVisible(false);
        setHistoryModalVisible(true);
        setLoadingHistory(true);
        try {
            const { sprayLogs, plantingLogs, grainLogs } = await fetchFieldSeasonalData(selectedField.id, farmId);
            const allLogs = [
                ...sprayLogs.map((l: any) => ({ ...l, type: 'SPRAY', date: l.sprayed_at || l.start_time })),
                ...plantingLogs.map((l: any) => ({ ...l, type: 'PLANTING', date: l.start_time })),
                ...grainLogs.map((l: any) => ({ ...l, type: 'HARVEST', date: l.end_time || l.start_time }))
            ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setHistoryLogs(allLogs);
        } catch (e) {
            showAlert('Error', 'Failed to load history');
        } finally {
            setLoadingHistory(false);
        }
    };

    const renderField = ({ item }: { item: Field }) => (
        <TouchableOpacity
            style={styles.fieldCard}
            onPress={() => handleFieldPress(item)}
            testID={`field-item-${item.id}`}
        >
            <View style={{ flex: 1 }}>
                <Text style={styles.fieldName}>{item.name}</Text>
                <Text style={styles.fieldAcreage}>{item.acreage} Acres</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
                <View style={styles.logBadgeGhost}>
                    <Text style={styles.logBadgeTextGhost}>Log +</Text>
                </View>
                {item.distance !== undefined && item.distance !== Infinity && (
                    <Text style={styles.distanceText}>{item.distance.toFixed(1)} mi</Text>
                )}
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>{mode === 'SELECT' ? 'Select Field' : 'Your Fields'}</Text>
                {mode === 'MANAGE' && (
                    <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
                        <Text style={styles.addButtonText}>+ Field</Text>
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                key={`${numColumns}`}
                data={fields}
                renderItem={renderField}
                keyExtractor={(item) => item.id}
                numColumns={numColumns}
                contentContainerStyle={[
                    styles.list,
                    fields.length === 0 && { flex: 1, justifyContent: 'center' },
                    isDesktop && { paddingHorizontal: Theme.spacing.xl }
                ]}
                columnWrapperStyle={numColumns > 1 ? { gap: Theme.spacing.md } : undefined}
                refreshing={loading}
                onRefresh={() => { /* Handled by hooks */ }}
                ListEmptyComponent={
                    loading ? (
                        <LoadingState message="Syncing fields..." />
                    ) : (
                        <EmptyState
                            title="No Fields Yet"
                            message="Add your first field to start tracking activities."
                            actionLabel="+ Add Field"
                            onAction={() => setModalVisible(true)}
                        />
                    )
                }
            />

            {/* Action Picker Modal */}
            <Modal visible={actionPickerVisible} transparent animationType="fade">
                <TouchableOpacity
                    style={styles.modalOverlay}
                    onPress={() => setActionPickerVisible(false)}
                >
                    <View style={styles.actionSheet}>
                        <View style={styles.actionSheetHeader}>
                            <Text style={styles.actionSheetTitle}>{selectedField?.name}</Text>
                            {fieldAgreement && (
                                <View style={styles.agreementInfo}>
                                    <Text style={styles.agreementLabel}>
                                        {fieldAgreement.rent_type} AGREEMENT ({fieldAgreement.crop_year})
                                    </Text>
                                    <Text style={styles.agreementValue}>
                                        {fieldAgreement.rent_type === 'CASH'
                                            ? `$${fieldAgreement.cash_rent_per_acre}/ac`
                                            : `${(fieldAgreement.landlord_share_pct * 100).toFixed(0)}% Share`
                                        }
                                    </Text>
                                </View>
                            )}
                        </View>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => {
                                setActionPickerVisible(false);
                                if (selectedField) onSelectAction(selectedField, 'SPRAY');
                            }}
                            testID="action-start-spraying"
                        >
                            <Text style={styles.actionButtonText}>Start Spraying</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => {
                                setActionPickerVisible(false);
                                if (selectedField) onSelectAction(selectedField, 'PLANTING');
                            }}
                        >
                            <Text style={styles.actionButtonText}>Start Planting</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => {
                                setActionPickerVisible(false);
                                if (selectedField) onSelectAction(selectedField, 'HARVEST');
                            }}
                        >
                            <Text style={styles.actionButtonText}>Start Harvesting</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionButton, { marginTop: 10, borderTopWidth: 1, borderTopColor: Theme.colors.border }]}
                            onPress={handleViewHistory}
                        >
                            <Text style={[styles.actionButtonText, { color: Theme.colors.textSecondary }]}>🕒 View History / Audit</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.actionButton, { marginTop: 5 }]}
                            onPress={() => setActionPickerVisible(false)}
                        >
                            <Text style={[styles.actionButtonText, { color: Theme.colors.danger }]}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionButton, { backgroundColor: Theme.colors.primary }]}
                            onPress={async () => {
                                if (!selectedField || !farmId) return;
                                setActionPickerVisible(false);
                                try {
                                    showAlert('Generating...', 'Collating seasonal data and audit trails...');

                                    const { sprayLogs, plantingLogs, grainLogs, auditLogs } = await fetchFieldSeasonalData(selectedField.id, farmId);

                                    const aggregatedData = [
                                        ...plantingLogs.map((l: any) => ({ ...l, reportType: 'PLANTING' })),
                                        ...sprayLogs.map((l: any) => ({ ...l, reportType: 'SPRAYING', product_name: l.recipe_name })),
                                        ...grainLogs.map((l: any) => ({ ...l, reportType: 'HARVEST', fieldName: selectedField.name, totalBushels: l.bushels_net })),
                                        ...auditLogs.map((l: any) => ({ ...l, reportType: 'AUDIT' }))
                                    ];

                                    await generateReport({
                                        farmName: 'FarmFlow Packet',
                                        dateRange: `${selectedField.name} - ${new Date().getFullYear()}`,
                                        logs: aggregatedData,
                                        type: 'SEASON_PACKET'
                                    });
                                    showAlert('Success', 'Season Packet generated.');
                                } catch (error) {
                                    console.error('Failed to generate packet', error);
                                    showAlert('Error', 'Failed to generate season packet.');
                                }
                            }}
                        >
                            <Text style={[styles.actionButtonText, { color: Theme.colors.white }]}>Generate Season Packet</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => {
                                setActionPickerVisible(false);
                                setSplitsModalVisible(true);
                            }}
                        >
                            <Text style={[styles.actionButtonText, { color: Theme.colors.warning }]}>Manage splits</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* History Modal */}
            <Modal visible={historyModalVisible} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={styles.historyContainer}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => setHistoryModalVisible(false)}>
                            <Text style={styles.closeText}>Close</Text>
                        </TouchableOpacity>
                        <Text style={styles.actionSheetTitle}>{selectedField?.name} History</Text>
                        <View style={{ width: 50 }} />
                    </View>
                    <FlatList
                        data={historyLogs}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={{ padding: Theme.spacing.md }}
                        refreshing={loadingHistory}
                        onRefresh={handleViewHistory}
                        renderItem={({ item }) => (
                            <View style={[styles.logCard, item.voided_at && { opacity: 0.6, backgroundColor: '#f0f0f0' }]}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <View>
                                        <Text style={styles.logType}>{item.type} {item.voided_at ? '(VOIDED)' : ''}</Text>
                                        <Text style={styles.logDate}>{new Date(item.date).toLocaleDateString()} {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                        {item.type === 'SPRAY' && (
                                            <Text style={styles.logDetail}>{item.recipe_name || 'Custom Mix'} - {item.acres_treated} ac</Text>
                                        )}
                                        {item.type === 'PLANTING' && (
                                            <Text style={styles.logDetail}>{item.brand} {item.variety_name}</Text>
                                        )}
                                        {item.type === 'HARVEST' && (
                                            <Text style={styles.logDetail}>{item.bushels_net} bu {"->"} {item.bin_name || 'Elevator'}</Text>
                                        )}
                                        {item.voided_at && (
                                            <Text style={{ color: Theme.colors.danger, fontSize: 10, marginTop: 4 }}>Reason: {item.void_reason}</Text>
                                        )}
                                    </View>
                                    <View style={{ justifyContent: 'center' }}>
                                        {item.type === 'SPRAY' && !item.voided_at && (
                                            <TouchableOpacity
                                                style={styles.correctButton}
                                                onPress={() => {
                                                    setHistoryModalVisible(false);
                                                    if (selectedField) onSelectAction(selectedField, 'SPRAY', item.id);
                                                }}
                                            >
                                                <Text style={styles.correctButtonText}>Correct</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>
                            </View>
                        )}
                        ListEmptyComponent={
                            loadingHistory ? (
                                <LoadingState message="Loading history..." />
                            ) : (
                                <EmptyState
                                    title="No History"
                                    message="No logs found for this field yet."
                                />
                            )
                        }
                    />
                </SafeAreaView>
            </Modal>

            {/* Add Field Modal */}
            <Modal visible={modalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { height: '50%' }]}>
                        <Text style={styles.modalTitle}>New Field</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Field Name"
                            value={newName}
                            onChangeText={setNewName}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Acreage"
                            keyboardType="numeric"
                            value={newAcreage}
                            onChangeText={setNewAcreage}
                        />
                        <TouchableOpacity style={styles.saveButton} onPress={handleAddField}>
                            <Text style={styles.saveButtonText}>Save Field</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setModalVisible(false)} style={{ marginTop: 20 }}>
                            <Text style={{ textAlign: 'center', color: Theme.colors.danger }}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Manage Splits Modal */}
            <Modal visible={splitsModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { height: '70%' }]}>
                        <Text style={styles.modalTitle}>Splits: {selectedField?.name}</Text>

                        <View style={styles.splitList}>
                            {shares.filter(s => s.field_id === selectedField?.id).map(share => {
                                const landlord = landlords.find(l => l.id === share.landlord_id);
                                return (
                                    <View key={share.id} style={styles.splitRow}>
                                        <Text style={{ flex: 1 }}>{landlord?.name || 'Unknown'}</Text>
                                        <Text style={{ fontWeight: 'bold' }}>{(share.share_percentage * 100).toFixed(0)}%</Text>
                                    </View>
                                );
                            })}
                        </View>

                        <Text style={styles.sectionLabel}>Add New Split</Text>
                        <View style={styles.splitForm}>
                            <View style={{ flex: 1, marginRight: Theme.spacing.md }}>
                                <Text style={styles.label}>Landlord</Text>
                                <View style={styles.pickerPlaceholder}>
                                    {landlords.map(l => (
                                        <TouchableOpacity
                                            key={l.id}
                                            onPress={() => setSelectedLandlordId(l.id)}
                                            style={[styles.miniCard, selectedLandlordId === l.id && styles.miniCardActive]}
                                        >
                                            <Text style={selectedLandlordId === l.id && { color: Theme.colors.white }}>{l.name}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                            <View style={{ width: 80 }}>
                                <Text style={styles.label}>Share %</Text>
                                <TextInput
                                    style={styles.miniInput}
                                    keyboardType="numeric"
                                    value={splitPercentage}
                                    onChangeText={setSplitPercentage}
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.saveButton, { marginTop: Theme.spacing.lg }]}
                            onPress={async () => {
                                if (!selectedField || !selectedLandlordId) return;
                                // Convention: share_percentage is stored as a decimal (e.g., 0.5 for 50%)
                                await addFieldSplit(selectedField.id, selectedLandlordId, parseNumericInput(splitPercentage) / 100);
                                setSplitPercentage('50');
                                setSelectedLandlordId('');
                                showAlert('Saved', 'Landlord share updated.');
                            }}
                        >
                            <Text style={styles.saveButtonText}>Add/Update Share</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => setSplitsModalVisible(false)} style={{ marginTop: 20 }}>
                            <Text style={{ textAlign: 'center', color: Theme.colors.textSecondary }}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView >
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Theme.colors.background },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Theme.spacing.lg,
    },
    title: { ...Theme.typography.h1 },
    addButton: {
        backgroundColor: Theme.colors.primary,
        paddingHorizontal: Theme.spacing.md,
        paddingVertical: Theme.spacing.sm,
        borderRadius: Theme.borderRadius.sm,
    },
    addButtonText: { color: '#FFF', fontWeight: 'bold' },
    list: { padding: Theme.spacing.md },
    fieldCard: {
        backgroundColor: '#FFF',
        padding: Theme.spacing.lg,
        borderRadius: Theme.borderRadius.md,
        marginBottom: Theme.spacing.md,
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: Theme.colors.border,
        ...Platform.select({
            web: {
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                cursor: 'pointer',
            },
        } as any),
    },
    fieldName: { ...Theme.typography.h2 },
    fieldAcreage: { ...Theme.typography.body, color: Theme.colors.textSecondary },
    logBadge: {
        backgroundColor: Theme.colors.primary,
        paddingHorizontal: Theme.spacing.md,
        paddingVertical: Theme.spacing.xs,
        borderRadius: Theme.borderRadius.sm,
        marginBottom: 4,
    },
    logBadgeText: { color: '#FFF', fontWeight: 'bold', fontSize: 12 },
    logBadgeGhost: {
        borderWidth: 1,
        borderColor: Theme.colors.primary,
        backgroundColor: 'transparent',
        paddingHorizontal: Theme.spacing.md,
        paddingVertical: Theme.spacing.xs,
        borderRadius: Theme.borderRadius.sm,
        marginBottom: 4,
    },
    logBadgeTextGhost: { color: Theme.colors.primary, fontWeight: 'bold', fontSize: 12 },
    distanceText: { ...Theme.typography.caption, color: Theme.colors.textSecondary },
    emptyState: { marginTop: 50, alignItems: 'center' },
    emptyText: { color: Theme.colors.textSecondary },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: '#FFF',
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
        fontSize: 18,
        marginBottom: Theme.spacing.md,
    },
    saveButton: { backgroundColor: Theme.colors.primary, padding: Theme.spacing.lg, borderRadius: Theme.borderRadius.md, alignItems: 'center' },
    saveButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 18 },
    actionSheet: {
        backgroundColor: '#FFF',
        padding: Theme.spacing.xl,
        borderTopLeftRadius: Theme.borderRadius.lg,
        borderTopRightRadius: Theme.borderRadius.lg,
    },
    actionSheetHeader: { marginBottom: Theme.spacing.lg, alignItems: 'center' },
    actionSheetTitle: { ...Theme.typography.h2, textAlign: 'center' },
    agreementInfo: { marginTop: 8, padding: 8, backgroundColor: Theme.colors.surface, borderRadius: 8, borderWidth: 1, borderColor: Theme.colors.border, width: '100%', alignItems: 'center' },
    agreementLabel: { fontSize: 10, fontWeight: 'bold', color: Theme.colors.textSecondary },
    agreementValue: { fontSize: 14, fontWeight: 'bold', color: Theme.colors.primary, marginTop: 2 },
    actionButton: {
        backgroundColor: Theme.colors.surface,
        padding: Theme.spacing.lg,
        borderRadius: Theme.borderRadius.md,
        marginBottom: Theme.spacing.md,
        alignItems: 'center',
    },
    actionButtonText: { ...Theme.typography.h2, color: Theme.colors.primary },
    sectionLabel: { ...Theme.typography.caption, fontWeight: 'bold', marginTop: Theme.spacing.lg, marginBottom: Theme.spacing.sm },
    splitList: { maxHeight: '30%', marginBottom: Theme.spacing.md },
    splitRow: { flexDirection: 'row', justifyContent: 'space-between', padding: Theme.spacing.md, backgroundColor: Theme.colors.surface, borderRadius: Theme.borderRadius.sm, marginBottom: Theme.spacing.xs },
    splitForm: { flexDirection: 'row', alignItems: 'flex-end' },
    label: { ...Theme.typography.caption, marginBottom: 4 },
    miniInput: { borderWidth: 1, borderColor: Theme.colors.border, padding: 8, borderRadius: Theme.borderRadius.sm, textAlign: 'center' },
    pickerPlaceholder: { maxHeight: 100, overflow: 'scroll' },
    miniCard: { padding: 8, backgroundColor: Theme.colors.surface, marginBottom: 4, borderRadius: Theme.borderRadius.sm },
    miniCardActive: { backgroundColor: Theme.colors.primary },
    closeText: { color: Theme.colors.danger, fontSize: 16, fontWeight: 'bold' },
    historyContainer: { flex: 1, backgroundColor: Theme.colors.background },
    logCard: { backgroundColor: Theme.colors.white, padding: Theme.spacing.md, borderRadius: Theme.borderRadius.md, marginBottom: Theme.spacing.sm, ...Theme.shadows.sm },
    logType: { fontWeight: 'bold', fontSize: 12, color: Theme.colors.textSecondary },
    logDate: { fontSize: 14, fontWeight: 'bold', marginTop: 2 },
    logDetail: { fontSize: 14, marginTop: 2, color: Theme.colors.text },
    correctButton: { backgroundColor: '#FFF3E0', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, borderWidth: 1, borderColor: Theme.colors.warning },
    correctButtonText: { color: Theme.colors.warning, fontSize: 12, fontWeight: 'bold' }
});
