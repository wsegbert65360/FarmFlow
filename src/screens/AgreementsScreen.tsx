import React, { useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Modal, TextInput, SafeAreaView, ScrollView, useWindowDimensions } from 'react-native';
import { showAlert } from '../utils/AlertUtility';
import { Theme } from '../constants/Theme';
import { useLandlords, Landlord } from '../hooks/useLandlords';
import { useAgreements, RentAgreement } from '../hooks/useAgreements';
import { useFields } from '../hooks/useFields';

export const AgreementsScreen = () => {
    const { landlords, addLandlord, loading: landlordsLoading } = useLandlords();
    const { fields } = useFields();
    const [cropYear, setCropYear] = useState(new Date().getFullYear());
    const { agreements, loading: agreementsLoading, addAgreement, linkFields, getAgreementFields } = useAgreements(cropYear);

    const [landlordModalVisible, setLandlordModalVisible] = useState(false);
    const [agreementModalVisible, setAgreementModalVisible] = useState(false);
    const [fieldModalVisible, setFieldModalVisible] = useState(false);

    const [newLandlord, setNewLandlord] = useState({ name: '', email: '' });
    const [newAgreement, setNewAgreement] = useState<Partial<RentAgreement>>({
        rent_type: 'CASH',
        split_basis: 'BUSHELS',
        crop_year: cropYear
    });

    const [selectedAgreement, setSelectedAgreement] = useState<string | null>(null);
    const [selectedFields, setSelectedFields] = useState<string[]>([]);

    const handleAddLandlord = async () => {
        if (!newLandlord.name) return;
        try {
            await addLandlord(newLandlord.name, newLandlord.email);
            setNewLandlord({ name: '', email: '' });
            setLandlordModalVisible(false);
            showAlert('Success', 'Landlord added.');
        } catch (e) {
            showAlert('Error', 'Failed to add landlord.');
        }
    };

    const handleAddAgreement = async () => {
        if (!newAgreement.landlord_id || !newAgreement.rent_type) return;
        try {
            await addAgreement(newAgreement as any);
            setAgreementModalVisible(false);
            showAlert('Success', 'Agreement created.');
        } catch (e) {
            showAlert('Error', 'Failed to create agreement.');
        }
    };

    const handleLinkFields = async () => {
        if (!selectedAgreement) return;
        try {
            await linkFields(selectedAgreement, selectedFields);
            setFieldModalVisible(false);
            showAlert('Success', 'Fields updated.');
        } catch (e) {
            showAlert('Error', 'Failed to update fields.');
        }
    };

    const openFieldLinker = async (agreementId: string) => {
        setSelectedAgreement(agreementId);
        const linked = await getAgreementFields(agreementId);
        setSelectedFields(linked);
        setFieldModalVisible(true);
    };

    const toggleField = (id: string) => {
        setSelectedFields(prev =>
            prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
        );
    };

    const renderAgreement = ({ item }: { item: RentAgreement }) => {
        const landlord = landlords.find(l => l.id === item.landlord_id);
        return (
            <TouchableOpacity style={styles.card} onPress={() => openFieldLinker(item.id)}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{landlord?.name || 'Unknown Landlord'}</Text>
                    <View style={[styles.badge, { backgroundColor: item.rent_type === 'CASH' ? Theme.colors.primary : Theme.colors.warning }]}>
                        <Text style={styles.badgeText}>{item.rent_type}</Text>
                    </View>
                </View>
                <View style={styles.cardBody}>
                    {item.rent_type === 'CASH' ? (
                        <Text style={styles.cardText}>Rent: ${item.cash_rent_per_acre}/ac | Total: ${item.cash_rent_total || 'N/A'}</Text>
                    ) : (
                        <Text style={styles.cardText}>Share: {(item.landlord_share_pct! * 100).toFixed(0)}% | Basis: {item.split_basis}</Text>
                    )}
                </View>
                <Text style={styles.cardFooter}>Tap to manage linked fields</Text>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>Rent Agreements</Text>
                    <TouchableOpacity onPress={() => {/* Year Picker would go here */ }} style={styles.yearPicker}>
                        <Text style={styles.yearText}>Crop Year: {cropYear} ▾</Text>
                    </TouchableOpacity>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={[styles.smallButton, { marginRight: 8 }]}
                        onPress={() => setLandlordModalVisible(true)}
                    >
                        <Text style={styles.smallButtonText}>+ Landlord</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => setAgreementModalVisible(true)}
                    >
                        <Text style={styles.addButtonText}>+ Agreement</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                data={agreements}
                renderItem={renderAgreement}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No agreements found for {cropYear}.</Text>
                    </View>
                }
            />

            {/* Add Landlord Modal */}
            <Modal visible={landlordModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>New Landlord</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Full Name"
                            value={newLandlord.name}
                            onChangeText={text => setNewLandlord(prev => ({ ...prev, name: text }))}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Email (Optional)"
                            value={newLandlord.email}
                            onChangeText={text => setNewLandlord(prev => ({ ...prev, email: text }))}
                        />
                        <TouchableOpacity style={styles.saveButton} onPress={handleAddLandlord}>
                            <Text style={styles.saveButtonText}>Save Landlord</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setLandlordModalVisible(false)} style={styles.cancelButton}>
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Add Agreement Modal */}
            <Modal visible={agreementModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { height: '80%' }]}>
                        <Text style={styles.modalTitle}>New Agreement</Text>

                        <Text style={styles.label}>Select Landlord</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.landlordSelector}>
                            {landlords.map(l => (
                                <TouchableOpacity
                                    key={l.id}
                                    style={[styles.landlordChip, newAgreement.landlord_id === l.id && styles.landlordChipActive]}
                                    onPress={() => setNewAgreement(prev => ({ ...prev, landlord_id: l.id }))}
                                >
                                    <Text style={[styles.landlordChipText, newAgreement.landlord_id === l.id && styles.landlordChipTextActive]}>{l.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <Text style={styles.label}>Rent Type</Text>
                        <View style={styles.typeSelector}>
                            <TouchableOpacity
                                style={[styles.typeButton, newAgreement.rent_type === 'CASH' && styles.typeButtonActive]}
                                onPress={() => setNewAgreement(prev => ({ ...prev, rent_type: 'CASH', landlord_share_pct: undefined }))}
                            >
                                <Text style={[styles.typeButtonText, newAgreement.rent_type === 'CASH' && styles.typeButtonTextActive]}>CASH</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.typeButton, newAgreement.rent_type === 'SHARE' && styles.typeButtonActive]}
                                onPress={() => setNewAgreement(prev => ({ ...prev, rent_type: 'SHARE', cash_rent_per_acre: undefined }))}
                            >
                                <Text style={[styles.typeButtonText, newAgreement.rent_type === 'SHARE' && styles.typeButtonTextActive]}>SHARE</Text>
                            </TouchableOpacity>
                        </View>

                        {newAgreement.rent_type === 'CASH' ? (
                            <View>
                                <Text style={styles.label}>Rent per Acre ($)</Text>
                                <TextInput
                                    style={styles.input}
                                    keyboardType="numeric"
                                    placeholder="250.00"
                                    onChangeText={text => setNewAgreement(prev => ({ ...prev, cash_rent_per_acre: parseFloat(text) }))}
                                />
                                <Text style={styles.label}>Total Cash Rent (Optional)</Text>
                                <TextInput
                                    style={styles.input}
                                    keyboardType="numeric"
                                    placeholder="Total amount"
                                    onChangeText={text => setNewAgreement(prev => ({ ...prev, cash_rent_total: parseFloat(text) }))}
                                />
                            </View>
                        ) : (
                            <View>
                                <Text style={styles.label}>Landlord Share (%)</Text>
                                <TextInput
                                    style={styles.input}
                                    keyboardType="numeric"
                                    placeholder="50"
                                    onChangeText={text => setNewAgreement(prev => ({ ...prev, landlord_share_pct: parseFloat(text) / 100 }))}
                                />
                                <Text style={styles.label}>Split Basis</Text>
                                <View style={styles.typeSelector}>
                                    <TouchableOpacity
                                        style={[styles.typeButton, newAgreement.split_basis === 'BUSHELS' && styles.typeButtonActive]}
                                        onPress={() => setNewAgreement(prev => ({ ...prev, split_basis: 'BUSHELS' }))}
                                    >
                                        <Text style={[styles.typeButtonText, newAgreement.split_basis === 'BUSHELS' && styles.typeButtonTextActive]}>BUSHELS</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.typeButton, newAgreement.split_basis === 'PROCEEDS' && styles.typeButtonActive]}
                                        onPress={() => setNewAgreement(prev => ({ ...prev, split_basis: 'PROCEEDS' }))}
                                    >
                                        <Text style={[styles.typeButtonText, newAgreement.split_basis === 'PROCEEDS' && styles.typeButtonTextActive]}>PROCEEDS</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        <TouchableOpacity style={styles.saveButton} onPress={handleAddAgreement}>
                            <Text style={styles.saveButtonText}>Create Agreement</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setAgreementModalVisible(false)} style={styles.cancelButton}>
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Field Assignment Modal */}
            <Modal visible={fieldModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { height: '60%' }]}>
                        <Text style={styles.modalTitle}>Assign Fields</Text>
                        <Text style={styles.subtitle}>Select fields covered by this agreement for {cropYear}</Text>
                        <FlatList
                            data={fields}
                            keyExtractor={item => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.fieldRow, selectedFields.includes(item.id) && styles.fieldRowActive]}
                                    onPress={() => toggleField(item.id)}
                                >
                                    <Text style={[styles.fieldRowText, selectedFields.includes(item.id) && styles.fieldRowTextActive]}>
                                        {item.name} ({item.acreage} ac)
                                    </Text>
                                    {selectedFields.includes(item.id) && <Text style={styles.check}>✓</Text>}
                                </TouchableOpacity>
                            )}
                        />
                        <TouchableOpacity style={styles.saveButton} onPress={handleLinkFields}>
                            <Text style={styles.saveButtonText}>Save Assignment</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setFieldModalVisible(false)} style={styles.cancelButton}>
                            <Text style={styles.cancelButtonText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Theme.colors.background },
    header: { padding: Theme.spacing.lg, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { ...Theme.typography.h1 },
    yearPicker: { marginTop: 4 },
    yearText: { ...Theme.typography.body, color: Theme.colors.primary, fontWeight: 'bold' },
    headerActions: { flexDirection: 'row' },
    addButton: { backgroundColor: Theme.colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
    addButtonText: { color: '#FFF', fontWeight: 'bold' },
    smallButton: { backgroundColor: Theme.colors.surface, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Theme.colors.border },
    smallButtonText: { color: Theme.colors.text, fontWeight: '600' },
    list: { padding: Theme.spacing.md },
    card: { backgroundColor: '#FFF', padding: Theme.spacing.lg, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: Theme.colors.border },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    cardTitle: { ...Theme.typography.h2 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    badgeText: { color: '#FFF', fontWeight: 'bold', fontSize: 10 },
    cardBody: { marginBottom: 8 },
    cardText: { ...Theme.typography.body, color: Theme.colors.textSecondary },
    cardFooter: { ...Theme.typography.caption, color: Theme.colors.primary, fontWeight: '600' },
    emptyState: { marginTop: 100, alignItems: 'center' },
    emptyText: { ...Theme.typography.body, color: Theme.colors.textSecondary },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, height: '50%' },
    modalTitle: { ...Theme.typography.h1, marginBottom: 8 },
    subtitle: { ...Theme.typography.body, color: Theme.colors.textSecondary, marginBottom: 16 },
    label: { ...Theme.typography.caption, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
    input: { borderWidth: 1, borderColor: Theme.colors.border, padding: 12, borderRadius: 8, fontSize: 16, marginBottom: 12 },
    saveButton: { backgroundColor: Theme.colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
    saveButtonText: { color: '#FFF', fontWeight: 'bold', fontSize: 18 },
    cancelButton: { marginTop: 16, alignItems: 'center' },
    cancelButtonText: { color: Theme.colors.textSecondary },
    landlordSelector: { flexDirection: 'row', marginBottom: 8 },
    landlordChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Theme.colors.surface, marginRight: 8, borderWidth: 1, borderColor: Theme.colors.border },
    landlordChipActive: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
    landlordChipText: { color: Theme.colors.text },
    landlordChipTextActive: { color: '#FFF', fontWeight: 'bold' },
    typeSelector: { flexDirection: 'row', gap: 8 },
    typeButton: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: Theme.colors.surface, alignItems: 'center', borderWidth: 1, borderColor: Theme.colors.border },
    typeButtonActive: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
    typeButtonText: { fontWeight: 'bold', color: Theme.colors.text },
    typeButtonTextActive: { color: '#FFF' },
    fieldRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderRadius: 12, backgroundColor: Theme.colors.surface, marginBottom: 8, borderWidth: 1, borderColor: Theme.colors.border },
    fieldRowActive: { borderColor: Theme.colors.primary, backgroundColor: '#F0F7FF' },
    fieldRowText: { fontSize: 16, color: Theme.colors.text },
    fieldRowTextActive: { color: Theme.colors.primary, fontWeight: 'bold' },
    check: { color: Theme.colors.primary, fontWeight: 'bold', fontSize: 18 }
});
