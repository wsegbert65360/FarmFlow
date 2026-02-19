import React, { useState } from 'react';
import { StyleSheet, Text, View, FlatList, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView, useWindowDimensions } from 'react-native';
import { showAlert, showConfirm, showDeleteConfirm } from '../utils/AlertUtility';
import QRCode from 'react-native-qrcode-svg';
import { Theme } from '../constants/Theme';
import { useSpray, Recipe, RecipeItem } from '../hooks/useSpray';
import { usePlanting, SeedVariety } from '../hooks/usePlanting';
import { useLandlords, Landlord } from '../hooks/useLandlords';
import { useGrain } from '../hooks/useGrain';
import { generateReport } from '../utils/ReportUtility';
import { generateDiagnosticReport } from '../utils/DiagnosticUtility';
import { useSettings } from '../hooks/useSettings';
import { lookupEPA, calculateMaxRestrictions } from '../utils/EPAUtility';
import { connector } from '../db/SupabaseConnector';
import { v4 as uuidv4 } from 'uuid';

type VaultTab = 'CHEMICALS' | 'SEEDS' | 'LANDLORDS' | 'REPORTS' | 'SETTINGS';
type VaultItem = Recipe | SeedVariety | Landlord;

export const VaultScreen = ({ initialTab }: { initialTab?: VaultTab }) => {
    const [activeTab, setActiveTab] = useState<VaultTab>(initialTab || 'CHEMICALS');
    const { recipes, addRecipe, updateRecipe, deleteRecipe, sprayLogs, loading: recipesLoading } = useSpray();
    const { seeds, addSeed, updateSeed, deleteSeed, loading: seedsLoading } = usePlanting();
    const { landlords, fieldSplits, loading: landlordsLoading, addLandlord, deleteSplit, deleteLandlord } = useLandlords();
    const { grainLogs, loading: grainLoading } = useGrain();
    const { settings, saveSettings } = useSettings();
    const { width } = useWindowDimensions();

    const isDesktop = width > 768;
    const numColumns = isDesktop ? (width > 1200 ? 3 : 2) : 1;

    const [modalVisible, setModalVisible] = useState(false);
    const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
    const [saving, setSaving] = useState(false);
    const [inviteToken, setInviteToken] = useState<string | null>(null);
    const [generatingInvite, setGeneratingInvite] = useState(false);

    React.useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        }
    }, [initialTab]);

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
    const [recipeItems, setRecipeItems] = useState<Omit<RecipeItem, 'id' | 'recipe_id'>[]>([
        { product_name: '', epa_number: '', rate: 0, unit: 'Gal' }
    ]);

    const reportActions = [
        { id: '1', title: 'EPA Spray Records', type: 'EPA_SPRAY', icon: 'sc-sprayer' },
        { id: '2', title: 'Landlord Harvest Shares', type: 'LANDLORD_HARVEST', icon: 'sc-grain' },
        { id: '3', title: 'Diagnostic System Audit', type: 'DIAGNOSTIC', icon: 'sc-settings' }
    ];

    const openModal = (item?: VaultItem) => {
        if (item) {
            setEditingItem(item);
            if (activeTab === 'CHEMICALS') {
                const recipe = item as Recipe;
                setName(recipe.name);
                setWater(recipe.water_rate_per_acre.toString());
                setPhi(recipe.phi_days?.toString() || '0');
                setRei(recipe.rei_hours?.toString() || '0');
                setRecipeItems(recipe.items?.map(i => ({
                    product_name: i.product_name,
                    epa_number: i.epa_number,
                    rate: i.rate,
                    unit: i.unit
                })) || [{ product_name: '', epa_number: '', rate: 0, unit: 'Gal' }]);
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
            setRecipeItems([{ product_name: '', epa_number: '', rate: 0, unit: 'Gal' }]);
        }
        setModalVisible(true);
    };

    const handleSmartFill = () => {
        const epas = recipeItems.map(i => i.epa_number).filter(e => !!e);
        if (epas.length === 0) {
            showAlert('No EPA Numbers', 'Enter at least one EPA number to auto-fill safety data.');
            return;
        }

        const { phi: suggestedPhi, rei: suggestedRei } = calculateMaxRestrictions(epas);
        setPhi(suggestedPhi.toString());
        setRei(suggestedRei.toString());

        // Help with product names for ALL items that have EPAs but no names
        let namesUpdated = false;
        const newItems = recipeItems.map(item => {
            if (!item.product_name && item.epa_number) {
                const info = lookupEPA(item.epa_number);
                if (info) {
                    namesUpdated = true;
                    return { ...item, product_name: info.productName };
                }
            }
            return item;
        });

        if (namesUpdated) setRecipeItems(newItems);

        const feedback = `Safety data calculated:\nPHI: ${suggestedPhi} Days\nREI: ${suggestedRei} Hours${namesUpdated ? '\n\nProduct names auto-filled.' : ''}`;

        showAlert('Smart Fill Active', feedback);
    };

    const generateInvite = async () => {
        if (!settings?.farm_id) return;
        setGeneratingInvite(true);
        try {
            const token = Math.random().toString(36).substring(2, 11).toUpperCase(); // Simple random token
            const { error } = await connector.client
                .from('invites')
                .insert({
                    id: uuidv4(),
                    farm_id: settings.farm_id,
                    token: token,
                    role: 'WORKER',
                    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
                });

            if (error) throw error;
            setInviteToken(token);
            saveSettings({ farm_join_token: token }); // Save last token to settings too
        } catch (e: any) {
            showAlert('Error', `Failed to generate invite: ${e.message}`);
        } finally {
            setGeneratingInvite(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (activeTab === 'CHEMICALS') {
                const data = {
                    name,
                    water_rate_per_acre: parseFloat(water) || 0,
                    phi_days: parseInt(phi) || 0,
                    rei_hours: parseInt(rei) || 0,
                    items: recipeItems as RecipeItem[]
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
                    const msg = 'Update not implemented for Landlords yet. Delete and re-add.';
                    showAlert('Info', msg);
                } else {
                    await addLandlord(name, product);
                }
            }
            setModalVisible(false);
        } catch (e) {
            const msg = 'Failed to save item';
            showAlert('Error', msg);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => {
        showDeleteConfirm('this item', async () => {
            if (editingItem) {
                // Determine item type and call correct delete
                if ('water_rate_per_acre' in editingItem) await deleteRecipe(editingItem.id);
                else if ('brand' in editingItem) await deleteSeed(editingItem.id);
                else if ('email' in editingItem) await deleteLandlord(editingItem.id); // Fixed: Added landlord delete support
                setModalVisible(false);
            }
        });
    };

    const renderRecipe = ({ item }: { item: Recipe }) => (
        <TouchableOpacity style={[styles.card, isDesktop && { flex: 1 / numColumns - 0.05 }]} onPress={() => openModal(item)}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardSub}>
                {item.items && item.items.length > 0
                    ? `${item.items.length} Products • ${item.water_rate_per_acre} Gal/ac`
                    : `${item.product_name || 'No Products'} • ${item.rate_per_acre || 0} Gal/ac`}
            </Text>
        </TouchableOpacity>
    );

    const renderSeed = ({ item }: { item: SeedVariety }) => (
        <TouchableOpacity style={[styles.card, isDesktop && { flex: 1 / numColumns - 0.05 }]} onPress={() => openModal(item)}>
            <Text style={styles.cardTitle}>{item.brand} {item.variety_name}</Text>
            <Text style={styles.cardSub}>{item.default_population.toLocaleString()} plants/ac</Text>
        </TouchableOpacity>
    );

    const renderLandlord = ({ item }: { item: Landlord }) => (
        <TouchableOpacity style={[styles.card, isDesktop && { flex: 1 / numColumns - 0.05 }]} onPress={() => openModal(item as any)}>
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
                            const lShares = fieldSplits.filter(s => s.landlord_id === l.id);
                            // Simplified: just taking first field share for demo or summing
                            return {
                                fieldName: 'Multiple Fields',
                                totalBushels: grainLogs.reduce((acc: number, g: any) => acc + g.bushels_net, 0),
                                sharePercentage: lShares[0]?.share_percentage || 0,
                                landlordBushels: grainLogs.reduce((acc: number, g: any) => acc + g.bushels_net, 0) * ((lShares[0]?.share_percentage || 0) / 100)
                            };
                        });
                        await generateReport({
                            farmName: settings?.farm_name || 'My Farm',
                            dateRange: `${new Date().getFullYear()} Season`,
                            logs: landlordData,
                            type: 'LANDLORD_HARVEST'
                        });
                    } else {
                        await generateDiagnosticReport();
                    }
                    const msg = 'Report generated and ready to share.';
                    showAlert('Success', msg);
                } catch (e) {
                    showAlert('Error', 'Failed to generate report');
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
                    style={[styles.tab, activeTab === 'SETTINGS' && styles.activeTab, activeTab === 'SETTINGS' && { borderBottomColor: Theme.colors.secondary }]}
                    onPress={() => setActiveTab('SETTINGS')}
                >
                    <Text style={[styles.tabText, activeTab === 'SETTINGS' && styles.activeTabText, activeTab === 'SETTINGS' && { color: Theme.colors.secondary }]}>Sync & Team</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                key={`${activeTab}-${numColumns}`}
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
                                        <View style={[styles.card, isDesktop && { maxWidth: 800 }]}>
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

                                            <Text style={styles.sectionLabel}>Farm ID & Team Access</Text>
                                            <View style={styles.input}>
                                                <Text style={{ fontSize: 12, color: Theme.colors.textSecondary }}>Active Farm ID (Internal):</Text>
                                                <Text style={{ fontWeight: 'bold' }}>{settings?.farm_id}</Text>
                                            </View>

                                            {settings?.farm_id ? (
                                                <View style={styles.qrContainer}>
                                                    <Text style={styles.qrLabel}>Farm Invitation</Text>

                                                    {inviteToken || settings?.farm_join_token ? (
                                                        <>
                                                            <View style={styles.qrWrapper}>
                                                                <QRCode
                                                                    value={JSON.stringify({
                                                                        t: inviteToken || settings?.farm_join_token
                                                                    })}
                                                                    size={200}
                                                                    quietZone={10}
                                                                />
                                                            </View>
                                                            <View style={{ marginTop: 15, alignItems: 'center' }}>
                                                                <Text style={{ fontWeight: 'bold', fontSize: 24, letterSpacing: 2 }}>{inviteToken || settings?.farm_join_token}</Text>
                                                                <Text style={styles.cardSub}>Security Token (Single Use / 7 Days)</Text>
                                                            </View>
                                                        </>
                                                    ) : (
                                                        <View style={{ padding: 40, alignItems: 'center' }}>
                                                            <Text style={styles.emptyText}>No active invitation token.</Text>
                                                        </View>
                                                    )}

                                                    <TouchableOpacity
                                                        style={[styles.addButton, { marginTop: 20, width: '100%', alignItems: 'center' }]}
                                                        onPress={generateInvite}
                                                        disabled={generatingInvite}
                                                    >
                                                        <Text style={styles.addButtonText}>{generatingInvite ? 'Generating...' : 'Generate New Invite Token'}</Text>
                                                    </TouchableOpacity>

                                                    <Text style={[styles.cardSub, { marginTop: 15, textAlign: 'center' }]}>
                                                        Ask a worker to scan this QR or enter the code in their Onboarding screen.
                                                    </Text>
                                                </View>
                                            ) : (
                                                <Text style={styles.cardSub}>Complete onboarding to generate a farm invite.</Text>
                                            )}

                                            <Text style={[styles.cardSub, { marginTop: 20 }]}>These details will auto-fill your spray logs to meet state audit requirements.</Text>
                                        </View>
                                    )) as any
                }
                keyExtractor={item => item.id}
                numColumns={activeTab === 'SETTINGS' ? 1 : numColumns}
                columnWrapperStyle={numColumns > 1 && activeTab !== 'SETTINGS' ? { gap: Theme.spacing.md } : undefined}
                initialNumToRender={10}
                windowSize={5}
                contentContainerStyle={styles.list}
                ListHeaderComponent={
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>
                            {activeTab === 'CHEMICALS' ? 'Spray Recipes' :
                                activeTab === 'SEEDS' ? 'Seed Varieties' :
                                    activeTab === 'LANDLORDS' ? 'Landlords' :
                                        activeTab === 'SETTINGS' ? 'Sync & Team' : 'Compliance Reports'}
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
                                <TextInput style={styles.input} placeholder="Water Rate (Gal/Ac)" value={water} onChangeText={setWater} keyboardType="numeric" />

                                <Text style={styles.sectionLabel}>Chemical Composition</Text>
                                {recipeItems.map((item, index) => (
                                    <View key={index} style={styles.recipeItemRow}>
                                        <View style={{ flex: 2 }}>
                                            <TextInput
                                                style={[styles.input, { marginBottom: 5 }]}
                                                placeholder="Product Name"
                                                value={item.product_name}
                                                onChangeText={(v) => {
                                                    const newItems = [...recipeItems];
                                                    newItems[index].product_name = v;
                                                    setRecipeItems(newItems);
                                                }}
                                            />
                                            <TextInput
                                                style={[styles.input, { fontSize: 12, padding: 8 }]}
                                                placeholder="EPA # (Optional for non-regulated)"
                                                value={item.epa_number}
                                                onChangeText={(v) => {
                                                    const newItems = [...recipeItems];
                                                    newItems[index].epa_number = v;
                                                    setRecipeItems(newItems);
                                                }}
                                            />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Rate"
                                                value={item.rate.toString()}
                                                keyboardType="numeric"
                                                onChangeText={(v) => {
                                                    const newItems = [...recipeItems];
                                                    newItems[index].rate = parseFloat(v) || 0;
                                                    setRecipeItems(newItems);
                                                }}
                                            />
                                            <View style={styles.unitToggle}>
                                                {['oz', 'Gal', 'lbs', 'pt'].map((u) => (
                                                    <TouchableOpacity
                                                        key={u}
                                                        onPress={() => {
                                                            const newItems = [...recipeItems];
                                                            newItems[index].unit = u;
                                                            setRecipeItems(newItems);
                                                        }}
                                                        style={[styles.unitBtn, item.unit === u && styles.unitBtnActive]}
                                                    >
                                                        <Text style={[styles.unitBtnText, item.unit === u && styles.unitBtnTextActive]}>{u}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </View>
                                        {recipeItems.length > 1 && (
                                            <TouchableOpacity
                                                onPress={() => setRecipeItems(recipeItems.filter((_, i) => i !== index))}
                                                style={styles.removeBtn}
                                            >
                                                <Text style={{ color: Theme.colors.danger, fontWeight: 'bold' }}>×</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))}

                                <TouchableOpacity
                                    style={styles.addItemBtn}
                                    onPress={() => setRecipeItems([...recipeItems, { product_name: '', epa_number: '', rate: 0, unit: 'Gal' }])}
                                >
                                    <Text style={{ color: Theme.colors.primary, fontWeight: 'bold' }}>+ ADD PRODUCT</Text>
                                </TouchableOpacity>

                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.sectionLabel}>PHI (Days)</Text>
                                        <TextInput style={styles.input} placeholder="PHI Days" value={phi} onChangeText={setPhi} keyboardType="numeric" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.sectionLabel}>REI (Hours)</Text>
                                        <TextInput style={styles.input} placeholder="REI Hours" value={rei} onChangeText={setRei} keyboardType="numeric" />
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={styles.smartFillBtn}
                                    onPress={handleSmartFill}
                                >
                                    <Text style={styles.smartFillText}>✨ SMART AUTO-FILL SAFETY DATA</Text>
                                </TouchableOpacity>
                                <Text style={{ fontSize: 10, color: Theme.colors.textSecondary, fontStyle: 'italic', textAlign: 'center' }}>
                                    Calculates most restrictive PHI/REI from EPA numbers.
                                </Text>
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
        </View >
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Theme.colors.background },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: Theme.colors.white,
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.border,
    },
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
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: Theme.colors.white, borderRadius: Theme.borderRadius.lg, padding: Theme.spacing.xl, width: '90%', maxWidth: 500 },
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
    qrWrapper: { padding: 10, backgroundColor: 'white', borderRadius: 8 },
    recipeItemRow: { flexDirection: 'row', padding: 10, backgroundColor: Theme.colors.surface, borderRadius: Theme.borderRadius.md, marginBottom: 10, alignItems: 'center' },
    unitToggle: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 5 },
    unitBtn: { padding: 4, borderRadius: 4, borderWidth: 1, borderColor: Theme.colors.border },
    unitBtnActive: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
    unitBtnText: { fontSize: 10, color: Theme.colors.textSecondary },
    unitBtnTextActive: { color: 'white', fontWeight: 'bold' },
    removeBtn: { marginLeft: 10, padding: 5 },
    addItemBtn: { padding: 10, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: Theme.colors.primary, borderRadius: Theme.borderRadius.md, marginBottom: 15 },
    smartFillBtn: { padding: 12, backgroundColor: '#E3F2FD', borderRadius: Theme.borderRadius.md, marginTop: 10, alignItems: 'center', borderWidth: 1, borderColor: '#2196F3' },
    smartFillText: { color: '#1976D2', fontWeight: 'bold', fontSize: 12 }
});
