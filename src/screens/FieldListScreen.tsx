import React, { useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Modal, TextInput, SafeAreaView, ScrollView, useWindowDimensions, Platform } from 'react-native';
import { showAlert } from '../utils/AlertUtility';
import { Theme } from '../constants/Theme';
import { useFields, Field } from '../hooks/useFields';
import { useInventory } from '../hooks/useInventory';
import { useLandlords } from '../hooks/useLandlords';

interface FieldListProps {
    onSelectAction: (field: Field, type: 'SPRAY' | 'PLANTING' | 'HARVEST' | 'DELIVERY') => void;
}

export const FieldListScreen = ({ onSelectAction }: FieldListProps) => {
    const { fields, loading: fieldsLoading, addField } = useFields();
    const { atRiskCount, loading: inventoryLoading } = useInventory();
    const { width } = useWindowDimensions();

    const isDesktop = width > 768;
    const numColumns = isDesktop ? (width > 1200 ? 3 : 2) : 1;

    const loading = fieldsLoading || inventoryLoading;
    const [modalVisible, setModalVisible] = useState(false);
    const [actionPickerVisible, setActionPickerVisible] = useState(false);
    const [selectedField, setSelectedField] = useState<Field | null>(null);
    const { landlords, addFieldSplit, fieldSplits: shares, loading: landlordsLoading } = useLandlords();
    const [splitsModalVisible, setSplitsModalVisible] = useState(false);
    const [selectedLandlordId, setSelectedLandlordId] = useState<string>('');
    const [splitPercentage, setSplitPercentage] = useState<string>('50');

    const [newName, setNewName] = useState('');
    const [newAcreage, setNewAcreage] = useState('');

    const handleAddField = async () => {
        if (!newName || !newAcreage) return;
        try {
            await addField(newName, parseFloat(newAcreage));
            setNewName('');
            setNewAcreage('');
            setModalVisible(false);
        } catch (error) {
            showAlert('Error', 'Failed to add field.');
        }
    };

    const handleFieldPress = (field: Field) => {
        setSelectedField(field);
        setActionPickerVisible(true);
    };

    const renderField = ({ item }: { item: Field }) => (
        <TouchableOpacity style={styles.fieldCard} onPress={() => handleFieldPress(item)}>
            <View style={{ flex: 1 }}>
                <Text style={styles.fieldName}>{item.name}</Text>
                <Text style={styles.fieldAcreage}>{item.acreage} Acres</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
                <View style={styles.logBadge}>
                    <Text style={styles.logBadgeText}>Log</Text>
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
                <Text style={styles.title}>Your Fields</Text>
                <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
                    <Text style={styles.addButtonText}>+ Field</Text>
                </TouchableOpacity>
            </View>
            {atRiskCount > 0 && (
                <View style={styles.alertBanner}>
                    <Text style={styles.alertText}>⚠️ {atRiskCount} Products in Negative Balance (Ghost Inventory)</Text>
                </View>
            )}

            <FlatList
                key={`${numColumns}`}
                data={fields}
                renderItem={renderField}
                keyExtractor={(item) => item.id}
                numColumns={numColumns}
                contentContainerStyle={[styles.list, isDesktop && { paddingHorizontal: Theme.spacing.xl }]}
                columnWrapperStyle={numColumns > 1 ? { gap: Theme.spacing.md } : undefined}
                refreshing={loading}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No fields added yet.</Text>
                    </View>
                }
            />

            {/* Action Picker Modal */}
            <Modal visible={actionPickerVisible} transparent animationType="fade">
                <TouchableOpacity
                    style={styles.modalOverlay}
                    onPress={() => setActionPickerVisible(false)}
                >
                    <View style={styles.actionSheet}>
                        <Text style={styles.actionSheetTitle}>{selectedField?.name}</Text>
                        <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => {
                                setActionPickerVisible(false);
                                if (selectedField) onSelectAction(selectedField, 'SPRAY');
                            }}
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
                                await addFieldSplit(selectedField.id, selectedLandlordId, parseFloat(splitPercentage) / 100);
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
        </SafeAreaView>
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
    alertBanner: {
        backgroundColor: Theme.colors.danger,
        padding: Theme.spacing.md,
        marginHorizontal: Theme.spacing.md,
        borderRadius: Theme.borderRadius.sm,
        marginBottom: Theme.spacing.sm,
    },
    alertText: {
        color: '#FFF',
        fontWeight: 'bold',
        textAlign: 'center',
        fontSize: 14,
    },
    actionSheet: {
        backgroundColor: '#FFF',
        padding: Theme.spacing.xl,
        borderTopLeftRadius: Theme.borderRadius.lg,
        borderTopRightRadius: Theme.borderRadius.lg,
    },
    actionSheetTitle: { ...Theme.typography.h2, textAlign: 'center', marginBottom: Theme.spacing.lg },
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
});
