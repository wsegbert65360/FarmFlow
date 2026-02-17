import React, { useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Theme } from '../constants/Theme';
import { useSpray, Recipe } from '../hooks/useSpray';
import { usePlanting, SeedVariety } from '../hooks/usePlanting';
import { useLandlords, Landlord } from '../hooks/useLandlords';
import { useGrain } from '../hooks/useGrain';
import { generateReport } from '../utils/ReportUtility';
import { generateDiagnosticReport } from '../utils/DiagnosticUtility';
import { useSettings } from '../hooks/useSettings';

type VaultTab = 'CHEMICALS' | 'SEEDS' | 'LANDLORDS' | 'REPORTS' | 'SETTINGS';
type VaultItem = Recipe | SeedVariety | Landlord;

export const VaultScreen = () => {
    const [activeTab, setActiveTab] = useState<VaultTab>('CHEMICALS');
    const { recipes, addRecipe, updateRecipe, deleteRecipe, loading: recipesLoading } = useSpray();
    const { seeds, addSeed, updateSeed, deleteSeed, loading: seedsLoading } = usePlanting();
    const { landlords, addLandlord, removeLandlord, shares, loading: landlordsLoading } = useLandlords();
    const { sprayLogs, loading: sprayLoading } = useSpray();
    const { grainLogs, loading: grainLoading } = useGrain();
    const { settings, saveSettings } = useSettings();

    const [modalVisible, setModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
    const [saving, setSaving] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [product, setProduct] = useState('');
    const [epa, setEpa] = useState('');
    const [rate, setRate] = useState('');
    const [water, setWater] = useState('');
    const [brand, setBrand] = useState('');
    const [population, setPopulation] = useState('');
    const [phi, setPhi] = useState('0');
    const [rei, setRei] = useState('0');

    const openModal = (item?: VaultItem) => {
        if (item) {
            setEditingItem(item);
            if (activeTab === 'CHEMICALS') {
                const recipe = item as Recipe;
                setName(recipe.name);
                setProduct(recipe.product_name);
                setEpa(recipe.epa_number);
                setRate(recipe.rate_per_acre.toString());
                setWater(recipe.water_rate_per_acre.toString());
                setPhi(recipe.phi_days?.toString() || '0');
                setRei(recipe.rei_hours?.toString() || '0');
            } else if (activeTab === 'SEEDS') {
                const seed = item as SeedVariety;
                setBrand(seed.brand);
                setName(seed.variety_name);
                setPopulation(seed.default_population.toString());
            } else {
                const landlord = item as Landlord;
                setName(landlord.name);
                setProduct(landlord.email || '');
            }
        } else {
            setEditingItem(null);
            setName('');
            setProduct('');
            setEpa('');
            setRate('');
            setWater('');
            setBrand('');
            setPopulation('');
            setPhi('0');
            setRei('0');
        }
        setModalVisible(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (activeTab === 'CHEMICALS') {
                const data = {
                    name,
                    product_name: product,
                    epa_number: epa,
                    rate_per_acre: parseFloat(rate) || 0,
                    water_rate_per_acre: parseFloat(water) || 0,
                    phi_days: parseInt(phi) || 0,
                    rei_hours: parseInt(rei) || 0,
                };
                if (editingItem) await updateRecipe(editingItem.id, data);
                else await addRecipe(data);
            } else if (activeTab === 'SEEDS') {
                const data = {
                    brand,
                    variety_name: name,
                    type: 'Seed',
                    default_population: parseInt(population) || 32000,
                };
                if (editingItem) await updateSeed(editingItem.id, data);
                else await addSeed(data);
            } else {
                if (editingItem) {
                    Alert.alert('Info', 'Update not implemented for Landlords yet. Delete and re-add.');
                } else {
                    await addLandlord(name, product);
                }
            }
            setModalVisible(false);
        } catch (e) {
            Alert.alert('Error', 'Failed to save item');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => {
        Alert.alert('Delete', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    if (!editingItem) return;
                    if (activeTab === 'CHEMICALS') await deleteRecipe(editingItem.id);
                    else if (activeTab === 'SEEDS') await deleteSeed(editingItem.id);
                    else await removeLandlord(editingItem.id);
                    setModalVisible(false);
                }
            }
        ]);
    };

    const renderRecipe = ({ item }: { item: Recipe }) => (
        <TouchableOpacity style={styles.card} onPress={() => openModal(item)}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardSub}>{item.product_name} • {item.rate_per_acre} Gal/ac</Text>
        </TouchableOpacity>
    );

    const renderSeed = ({ item }: { item: SeedVariety }) => (
        <TouchableOpacity style={styles.card} onPress={() => openModal(item)}>
            <Text style={styles.cardTitle}>{item.brand} {item.variety_name}</Text>
            <Text style={styles.cardSub}>{item.default_population.toLocaleString()} plants/ac</Text>
        </TouchableOpacity>
    );

    const renderLandlord = ({ item }: { item: Landlord }) => (
        <TouchableOpacity style={styles.card} onPress={() => openModal(item as any)}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardSub}>{item.email || 'No email'}</Text>
        </TouchableOpacity>
    );

    const renderReportAction = ({ item }: { item: { title: string; type: string; description: string } }) => (
        <TouchableOpacity
            style={[styles.card, { borderLeftWidth: 4, borderLeftColor: Theme.colors.secondary }]}
            onPress={async () => {
                setSaving(true);
                try {
                    if (item.type === 'EPA_SPRAY') {
                        await generateReport({
                            farmName: settings?.farm_name || 'My Farm',
                            dateRange: 'All Time',
                            logs: sprayLogs,
                            type: 'EPA_SPRAY'
                        });
                    } else if (item.type === 'LANDLORD_HARVEST') {
                        // Prepare landlord data
                        const landlordData = landlords.map(l => {
                            const lShares = shares.filter(s => s.landlord_id === l.id);
                            // Simplified: just taking first field share for demo or summing
                            return {
                                fieldName: 'Multiple Fields',
                                totalBushels: grainLogs.reduce((s: number, g: any) => s + g.bushels_net, 0),
                                sharePercentage: lShares[0]?.share_percentage || 0,
                                landlordBushels: grainLogs.reduce((s: number, g: any) => s + g.bushels_net, 0) * (lShares[0]?.share_percentage || 0)
                            };
                        });
                        await generateReport({
                            farmName: settings?.farm_name || 'My Farm',
                            dateRange: '2024 Season',
                            logs: landlordData,
                            type: 'LANDLORD_HARVEST'
                        });
                    } else {
                        await generateDiagnosticReport();
                    }
                    Alert.alert('Success', 'Report generated and ready to share.');
                } catch (e) {
                    Alert.alert('Error', 'Failed to generate report.');
                } finally {
                    setSaving(false);
                }
            }}
        >
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSub}>{item.description}</Text>
            <Text style={[styles.cardSub, { color: Theme.colors.secondary, fontWeight: 'bold', marginTop: 8 }]}>PDF EXPORT 📄</Text>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'CHEMICALS' && styles.activeTab, activeTab === 'CHEMICALS' && { borderBottomColor: Theme.colors.primary }]}
                    onPress={() => setActiveTab('CHEMICALS')}
                >
                    <Text style={[styles.tabText, activeTab === 'CHEMICALS' && styles.activeTabText, activeTab === 'CHEMICALS' && { color: Theme.colors.primary }]}>Chemicals</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'SEEDS' && styles.activeTab, activeTab === 'SEEDS' && { borderBottomColor: Theme.colors.success }]}
                    onPress={() => setActiveTab('SEEDS')}
                >
                    <Text style={[styles.tabText, activeTab === 'SEEDS' && styles.activeTabText, activeTab === 'SEEDS' && { color: Theme.colors.success }]}>Seeds</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'LANDLORDS' && styles.activeTab, activeTab === 'LANDLORDS' && { borderBottomColor: Theme.colors.warning }]}
                    onPress={() => setActiveTab('LANDLORDS')}
                >
                    <Text style={[styles.tabText, activeTab === 'LANDLORDS' && styles.activeTabText, activeTab === 'LANDLORDS' && { color: Theme.colors.warning }]}>Landlords</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'SETTINGS' && styles.activeTab, activeTab === 'SETTINGS' && { borderBottomColor: Theme.colors.textSecondary }]}
                    onPress={() => setActiveTab('SETTINGS')}
                >
                    <Text style={[styles.tabText, activeTab === 'SETTINGS' && styles.activeTabText, activeTab === 'SETTINGS' && { color: Theme.colors.textSecondary }]}>Settings</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={(
                    activeTab === 'CHEMICALS' ? recipes :
                        activeTab === 'SEEDS' ? seeds :
                            activeTab === 'LANDLORDS' ? landlords :
                                activeTab === 'REPORTS' ? [
                                    { id: '1', title: 'EPA Spray Application Log', type: 'EPA_SPRAY', description: 'State-compliant record of all chemical applications.' },
                                    { id: '2', title: 'Landlord Crop Settlement', type: 'LANDLORD_HARVEST', description: 'Detailed breakdown of shares and net bushels by entity.' }
                                ] :
                                    [{ id: 'settings', type: 'SETTINGS' }]
                ) as any[]}
                renderItem={
                    activeTab === 'CHEMICALS' ? (renderRecipe as any) :
                        activeTab === 'SEEDS' ? (renderSeed as any) :
                            activeTab === 'LANDLORDS' ? (renderLandlord as any) :
                                activeTab === 'REPORTS' ? (renderReportAction as any) :
                                    (() => (
                                        <View style={styles.card}>
                                            <Text style={styles.sectionLabel}>Applicator Default Information</Text>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Name"
                                                value={settings?.default_applicator_name}
                                                onChangeText={(v) => saveSettings({ default_applicator_name: v })}
                                            />
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Cert #"
                                                value={settings?.default_applicator_cert}
                                                onChangeText={(v) => saveSettings({ default_applicator_cert: v })}
                                            />

                                            <Text style={styles.sectionLabel}>Supabase Sync Key (Cloud Bridge)</Text>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Paste Supabase Anon Key here"
                                                secureTextEntry
                                                value={settings?.supabase_anon_key}
                                                onChangeText={(v) => saveSettings({ supabase_anon_key: v })}
                                            />

                                            {settings?.supabase_anon_key ? (
                                                <View style={styles.qrContainer}>
                                                    <Text style={styles.qrLabel}>Cloud Sync QR (Scan on Mobile)</Text>
                                                    <View style={styles.qrWrapper}>
                                                        <QRCode
                                                            value={JSON.stringify({
                                                                k: settings.supabase_anon_key
                                                            })}
                                                            size={160}
                                                        />
                                                    </View>
                                                </View>
                                            ) : (
                                                <Text style={styles.cardSub}>Paste your Supabase 'anon' key here to generate a sync QR for your mobile device.</Text>
                                            )}

                                            <Text style={styles.cardSub}>These details will auto-fill your spray logs to meet state audit requirements.</Text>
                                        </View>
                                    )) as any
                }
                keyExtractor={item => item.id}
                initialNumToRender={10}
                windowSize={5}
                contentContainerStyle={styles.list}
                ListHeaderComponent={
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>
                            {activeTab === 'CHEMICALS' ? 'Spray Recipes' :
                                activeTab === 'SEEDS' ? 'Seed Varieties' :
                                    activeTab === 'LANDLORDS' ? 'Landlords' :
                                        activeTab === 'SETTINGS' ? 'Farm Settings' : 'Compliance Reports'}
                        </Text>
                        {activeTab !== 'REPORTS' && activeTab !== 'SETTINGS' && (
                            <TouchableOpacity
                                style={[styles.addButton, {
                                    backgroundColor: activeTab === 'CHEMICALS' ? Theme.colors.primary :
                                        activeTab === 'SEEDS' ? Theme.colors.success : Theme.colors.warning
                                }]}
                                onPress={() => openModal()}
                            >
                                <Text style={styles.addButtonText}>+ New</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyText}>No {activeTab.toLowerCase()} added yet.</Text>
                    </View>
                }
            />

            <Modal visible={modalVisible} animationType="slide" transparent>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
                    <ScrollView contentContainerStyle={styles.modalContent}>
                        <Text style={styles.modalTitle}>{editingItem ? 'Edit' : 'New'} {activeTab === 'CHEMICALS' ? 'Recipe' : 'Seed'}</Text>

                        {activeTab === 'CHEMICALS' ? (
                            <>
                                <TextInput style={styles.input} placeholder="Recipe Name (e.g. Early Post)" value={name} onChangeText={setName} />
                                <TextInput style={styles.input} placeholder="Product Name" value={product} onChangeText={setProduct} />
                                <TextInput style={styles.input} placeholder="EPA Number" value={epa} onChangeText={setEpa} />
                                <TextInput style={styles.input} placeholder="Product Rate (Gal/Ac)" value={rate} onChangeText={setRate} keyboardType="numeric" />
                                <TextInput style={styles.input} placeholder="Water Rate (Gal/Ac)" value={water} onChangeText={setWater} keyboardType="numeric" />
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.sectionLabel}>PHI (Days)</Text>
                                        <TextInput style={styles.input} placeholder="PHI Days" value={phi} onChangeText={setPhi} keyboardType="numeric" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.sectionLabel}>REI (Hours)</Text>
                                        <TextInput style={styles.input} placeholder="REI Hours" value={rei} onChangeText={setRei} keyboardType="numeric" />
                                    </View>
                                </View>
                            </>
                        ) : activeTab === 'SEEDS' ? (
                            <>
                                <TextInput style={styles.input} placeholder="Brand (e.g. Pioneer)" value={brand} onChangeText={setBrand} />
                                <TextInput style={styles.input} placeholder="Variety Name" value={name} onChangeText={setName} />
                                <TextInput style={styles.input} placeholder="Default Population" value={population} onChangeText={setPopulation} keyboardType="numeric" />
                            </>
                        ) : (
                            <>
                                <TextInput style={styles.input} placeholder="Full Name" value={name} onChangeText={setName} />
                                <TextInput style={styles.input} placeholder="Email (Optional)" value={product} onChangeText={setProduct} />
                            </>
                        )}


                        <View style={styles.modalActions}>
                            {editingItem && (
                                <TouchableOpacity onPress={handleDelete} style={[styles.modalButton, styles.deleteButton]}>
                                    <Text style={styles.buttonText}>Delete</Text>
                                </TouchableOpacity>
                            )}
                            <View style={{ flex: 1 }} />
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={[styles.modalButton, styles.cancelButton]}>
                                <Text style={[styles.buttonText, { color: Theme.colors.textSecondary }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSave} style={[styles.modalButton, styles.saveButton, {
                                backgroundColor: activeTab === 'CHEMICALS' ? Theme.colors.primary :
                                    activeTab === 'SEEDS' ? Theme.colors.success : Theme.colors.warning
                            }]}>
                                <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save'}</Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Theme.colors.background },
    tabContainer: { flexDirection: 'row', backgroundColor: Theme.colors.white, borderBottomWidth: 1, borderBottomColor: Theme.colors.border },
    tab: { flex: 1, padding: Theme.spacing.md, alignItems: 'center' },
    activeTab: { borderBottomWidth: 3, borderBottomColor: Theme.colors.primary },
    tabText: { ...Theme.typography.body, color: Theme.colors.textSecondary },
    activeTabText: { color: Theme.colors.primary, fontWeight: 'bold' },
    list: { padding: Theme.spacing.lg, paddingBottom: 100 },
    emptyState: { padding: Theme.spacing.xl, alignItems: 'center', marginTop: 40 },
    emptyText: { ...Theme.typography.body, color: Theme.colors.textSecondary, fontStyle: 'italic' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.lg },
    headerTitle: { ...Theme.typography.h2 },
    addButton: { backgroundColor: Theme.colors.primary, paddingHorizontal: Theme.spacing.md, paddingVertical: Theme.spacing.sm, borderRadius: Theme.borderRadius.sm },
    addButtonText: { color: Theme.colors.white, fontWeight: 'bold' },
    card: { backgroundColor: Theme.colors.white, padding: Theme.spacing.lg, borderRadius: Theme.borderRadius.md, marginBottom: Theme.spacing.md, ...Theme.shadows.sm },
    cardTitle: { ...Theme.typography.body, fontWeight: 'bold' },
    cardSub: { ...Theme.typography.caption, color: Theme.colors.textSecondary, marginTop: 4 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: Theme.colors.white, borderTopLeftRadius: Theme.borderRadius.lg, borderTopRightRadius: Theme.borderRadius.lg, padding: Theme.spacing.xl },
    modalTitle: { ...Theme.typography.h2, marginBottom: Theme.spacing.lg },
    input: { borderWidth: 1, borderColor: Theme.colors.border, padding: Theme.spacing.md, borderRadius: Theme.borderRadius.sm, fontSize: 16, marginBottom: Theme.spacing.md },
    modalActions: { flexDirection: 'row', marginTop: Theme.spacing.lg },
    modalButton: { padding: Theme.spacing.md, borderRadius: Theme.borderRadius.sm, alignItems: 'center', minWidth: 80 },
    saveButton: { backgroundColor: Theme.colors.primary },
    cancelButton: { backgroundColor: Theme.colors.surface, marginRight: Theme.spacing.md },
    deleteButton: { backgroundColor: Theme.colors.danger, marginRight: Theme.spacing.md },
    buttonText: { color: Theme.colors.white, fontWeight: 'bold' },
    sectionLabel: { ...Theme.typography.caption, fontWeight: 'bold', marginTop: Theme.spacing.md, marginBottom: Theme.spacing.xs, color: Theme.colors.textSecondary, textTransform: 'uppercase' },
    qrContainer: { alignItems: 'center', marginTop: Theme.spacing.lg, padding: Theme.spacing.md, backgroundColor: Theme.colors.surface, borderRadius: Theme.borderRadius.md },
    qrLabel: { ...Theme.typography.caption, fontWeight: 'bold', marginBottom: Theme.spacing.md, color: Theme.colors.primary },
    qrWrapper: { padding: 10, backgroundColor: 'white', borderRadius: 8 }
});
