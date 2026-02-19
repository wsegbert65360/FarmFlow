import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ActivityIndicator, Platform, TextInput, ScrollView } from 'react-native';
import { showAlert } from '../utils/AlertUtility';
import { Theme } from '../constants/Theme';
import { useSpray, Recipe } from '../hooks/useSpray';
import { usePlanting, SeedVariety } from '../hooks/usePlanting';
import { useGrain, Bin } from '../hooks/useGrain';
import { useFields, Field } from '../hooks/useFields';
import { useContracts, Contract } from '../hooks/useContracts';
import { fetchCurrentWeather, WeatherData } from '../utils/WeatherUtility';
import { useLandlords } from '../hooks/useLandlords';
import { useSettings } from '../hooks/useSettings';

export type LogType = 'SPRAY' | 'PLANTING' | 'HARVEST' | 'DELIVERY';

interface LogSessionProps {
    type: LogType;
    fixedId: string;
    fixedName: string;
    fixedAcreage?: number;
    fixedType: 'FIELD' | 'BIN';
    onClose: () => void;
}

type ListItem = Recipe | SeedVariety | Bin | Contract | Field;

export const LogSessionScreen = ({ type, fixedId, fixedName, fixedAcreage, fixedType, onClose }: LogSessionProps) => {
    const { recipes, loading: sprayLoading, addSprayLog } = useSpray();
    const { seeds, loading: plantingLoading, addPlantingLog } = usePlanting();
    const { bins, loading: grainLoading, addGrainLog } = useGrain();
    const { contracts, loading: contractsLoading } = useContracts();
    const { fields, loading: fieldsLoading } = useFields();
    const { settings } = useSettings();
    const { landlords } = useLandlords();

    const [loading, setLoading] = useState(true);
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [loadingWeather, setLoadingWeather] = useState(false);
    const [weather, setWeather] = useState<WeatherData | null>(null);

    // Inputs
    const [bushels, setBushels] = useState('');
    const [moisture, setMoisture] = useState('15.0');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    // Weather / Spray Info
    const [temp, setTemp] = useState('75');
    const [wind, setWind] = useState('5');
    const [windDir, setWindDir] = useState('NW');
    const [humidity, setHumidity] = useState('45');

    // Audit Fields for Spray
    const [targetCrop, setTargetCrop] = useState('');
    const [targetPest, setTargetPest] = useState('');
    const [applicatorName, setApplicatorName] = useState(settings?.default_applicator_name || '');
    const [applicatorCert, setApplicatorCert] = useState(settings?.default_applicator_cert || '');

    // Planting specific
    const [population, setPopulation] = useState('');
    const [depth, setDepth] = useState('1.5');

    useEffect(() => {
        // Initial setup for spray
        if (type === 'SPRAY') {
            loadWeather();
            if (settings) {
                setApplicatorName(settings.default_applicator_name || '');
                setApplicatorCert(settings.default_applicator_cert || '');
            }
        }

        // Mock loading delay to ensure hooks have data
        const timer = setTimeout(() => {
            setLoading(false);

            // Smart suggestions
            if (type === 'PLANTING' && seeds.length > 0) {
                setSelectedItemId(seeds[0].id);
                setPopulation(seeds[0].default_population.toString());
            } else if (type === 'SPRAY' && recipes.length > 0) {
                setSelectedItemId(recipes[0].id);
            } else if (type === 'DELIVERY' && contracts.length > 0) {
                setSelectedItemId(contracts[0].id);
            } else if (type === 'HARVEST' && bins.length > 0) {
                if (fixedType === 'FIELD') {
                    setSelectedItemId(bins[0].id);
                }
            }
        }, 800);
        return () => clearTimeout(timer);
    }, [type, seeds, recipes, contracts, bins, fixedType, settings]);

    const loadWeather = async () => {
        setLoadingWeather(true);
        const data = await fetchCurrentWeather();
        if (data) {
            setWeather(data);
            setTemp(data.temperature.toString());
            setWind(data.windSpeed.toString());
            setWindDir(data.windDirection);
            setHumidity(data.humidity.toString());
        }
        setLoadingWeather(false);
    };

    const getItems = (): ListItem[] => {
        switch (type) {
            case 'SPRAY': return recipes;
            case 'PLANTING': return seeds;
            case 'HARVEST':
                return fixedType === 'FIELD' ? bins : fields;
            case 'DELIVERY': return contracts;
            default: return [];
        }
    };

    const [showSuccess, setShowSuccess] = useState(false);

    useEffect(() => {
        if (showSuccess) {
            const timer = setTimeout(() => {
                onClose();
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [showSuccess]);

    const handleLog = async () => {
        if (!selectedItemId && type !== 'DELIVERY' && type !== 'HARVEST') {
            showAlert('Selection Required', 'Please select an item to continue.');
            return;
        }

        setSaving(true);
        try {
            if (type === 'SPRAY') {
                if (!fixedAcreage) throw new Error('Acreage required');
                const selectedRecipe = recipes.find(r => r.id === selectedItemId);

                // Calculate total chemical volume (sum of all items)
                const totalChemicalVolume = selectedRecipe?.items?.reduce((acc, i) => acc + i.rate, 0) || (selectedRecipe?.rate_per_acre || 0);

                await addSprayLog({
                    fieldId: fixedId,
                    recipeId: selectedItemId!,
                    totalGallons: (selectedRecipe?.water_rate_per_acre || 0) * fixedAcreage,
                    totalProduct: totalChemicalVolume * fixedAcreage,
                    weather: {
                        temp: parseFloat(temp),
                        windSpeed: parseFloat(wind),
                        windDir: windDir,
                        humidity: parseFloat(humidity)
                    },
                    targetCrop,
                    targetPest,
                    applicatorName,
                    applicatorCert,
                    acresTreated: fixedAcreage,
                    phi_days: selectedRecipe?.phi_days,
                    rei_hours: selectedRecipe?.rei_hours,
                    notes: notes
                });
            } else if (type === 'PLANTING') {
                await addPlantingLog({
                    fieldId: fixedId,
                    seedId: selectedItemId!,
                    population: parseFloat(population),
                    depth: parseFloat(depth),
                    notes: notes
                });
            } else if (type === 'HARVEST') {
                const fieldId = fixedType === 'FIELD' ? fixedId : null;
                const binId = fixedType === 'BIN' ? fixedId : selectedItemId!;

                await addGrainLog({
                    type: 'HARVEST',
                    field_id: fieldId,
                    bin_id: binId,
                    destination_type: 'BIN',
                    destination_name: 'On-Farm Storage',
                    bushels_net: parseFloat(bushels) || 0,
                    moisture: parseFloat(moisture) || 15.0,
                    notes: notes,
                    end_time: new Date().toISOString()
                });
            } else if (type === 'DELIVERY') {
                const contract = contracts.find(c => (c as Contract).id === selectedItemId) as Contract;
                await addGrainLog({
                    type: 'DELIVERY',
                    field_id: null,
                    bin_id: fixedId,
                    destination_type: 'ELEVATOR',
                    destination_name: contract?.destination_name || 'Direct Sale',
                    contract_id: contract?.id,
                    bushels_net: parseFloat(bushels) || 0,
                    moisture: parseFloat(moisture) || 15.0,
                    notes: notes,
                    end_time: new Date().toISOString()
                });
            }

            // SUCCESS FLOW
            console.log('Log saved successfully, showing SAVED screen...');
            setSaving(false);
            setShowSuccess(true);

            showAlert('Success', 'Log entry saved successfully! Returning to dashboard.');
        } catch (error: any) {
            setSaving(false);
            const errMsg = error?.message || 'Unknown error';
            console.error('SAVE ERROR:', error);
            showAlert('Error', 'Failed to save log entry: ' + errMsg);
        }
    };

    if (showSuccess) {
        return (
            <View style={[styles.centered, { backgroundColor: Theme.colors.success }]}>
                <Text style={{ fontSize: 60, color: '#fff', fontWeight: 'bold' }}>✓</Text>
                <Text style={{ fontSize: 32, color: '#fff', fontWeight: 'bold', marginTop: 20 }}>SAVED!</Text>
                <Text style={{ fontSize: 18, color: '#fff', marginTop: 10 }}>Syncing to cloud...</Text>
                <TouchableOpacity
                    onPress={onClose}
                    style={{ marginTop: 40, padding: 15, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 10 }}
                >
                    <Text style={{ color: '#fff', fontWeight: 'bold' }}>TAP TO RETURN NOW</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={Theme.colors.primary} />
                <Text style={{ marginTop: 15, color: Theme.colors.textSecondary, fontWeight: 'bold' }}>Syncing farm data...</Text>
            </View>
        );
    }

    const items = getItems();

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onClose}>
                    <Text style={styles.closeText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{type.replace('_', ' ')} Log</Text>
                <View style={{ width: 50 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.fieldInfo}>
                    <Text style={styles.fieldName}>{fixedName}</Text>
                    {fixedAcreage ? <Text style={styles.fieldAcreage}>{fixedAcreage} Acres</Text> : <Text style={styles.fieldAcreage}>{fixedType}</Text>}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        {type === 'SPRAY' ? 'Select Recipe' :
                            type === 'PLANTING' ? 'Select Seed' :
                                type === 'HARVEST' ? (fixedType === 'FIELD' ? 'Target Bin' : 'Source Field') :
                                    'Select Contract/Elevator'}
                    </Text>
                    <View style={styles.itemGrid}>
                        {items.map((item) => {
                            const id = (item as any).id;
                            let label = '';
                            let distanceLabel = '';
                            if (type === 'SPRAY') label = (item as Recipe).name;
                            else if (type === 'PLANTING') label = `${(item as SeedVariety).brand} ${(item as SeedVariety).variety_name}`;
                            else if (type === 'HARVEST') {
                                if (fixedType === 'FIELD') {
                                    label = (item as Bin).name;
                                } else {
                                    label = (item as Field).name;
                                    const dist = (item as Field).distance;
                                    if (dist !== undefined && dist !== Infinity) {
                                        distanceLabel = `${dist.toFixed(1)} mi`;
                                    }
                                }
                            }
                            else if (type === 'DELIVERY') label = (item as Contract).destination_name;

                            return (
                                <TouchableOpacity
                                    key={id}
                                    style={[
                                        styles.itemCard,
                                        selectedItemId === id && styles.itemCardActive
                                    ]}
                                    onPress={() => setSelectedItemId(id)}
                                >
                                    <View style={{ alignItems: 'center' }}>
                                        <Text style={[styles.itemText, selectedItemId === id && styles.itemTextActive]}>
                                            {label}
                                        </Text>
                                        {type === 'SPRAY' && (item as Recipe).items && (
                                            <Text style={{ fontSize: 9, color: Theme.colors.textSecondary }}>{(item as Recipe).items?.length} chemicals</Text>
                                        )}
                                    </View>
                                    {distanceLabel && (
                                        <Text style={{ fontSize: 10, color: Theme.colors.textSecondary }}>
                                            {distanceLabel}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {type === 'SPRAY' && selectedItemId && (
                        <View style={styles.recipeSummary}>
                            <Text style={styles.summaryLabel}>Planned Loads / Composition ({fixedAcreage} ac)</Text>
                            {recipes.find(r => r.id === selectedItemId)?.items?.map((item, idx) => (
                                <View key={idx} style={styles.summaryRow}>
                                    <Text style={styles.summaryProduct}>{item.product_name}</Text>
                                    <Text style={styles.summaryValue}>
                                        {(item.rate * (fixedType === 'FIELD' ? fixedAcreage || 0 : 0)).toFixed(1)} {item.unit} total
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )}
                </View>

                {(type === 'HARVEST' || type === 'DELIVERY') && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Quantities</Text>
                        <View style={styles.inputForm}>
                            <View style={styles.inputRow}>
                                <Text style={styles.label}>Net Bushels</Text>
                                <TextInput
                                    style={styles.formInput}
                                    keyboardType="numeric"
                                    value={bushels}
                                    onChangeText={setBushels}
                                    placeholder="0"
                                />
                            </View>
                            <View style={styles.inputRow}>
                                <Text style={styles.label}>Moisture %</Text>
                                <TextInput
                                    style={styles.formInput}
                                    keyboardType="numeric"
                                    value={moisture}
                                    onChangeText={setMoisture}
                                    placeholder="15.0"
                                />
                            </View>
                        </View>

                        {/* ─── Landlord Split Card ─── */}
                        {(() => {
                            // For HARVEST: bin is selectedItemId (target bin) when fixedType is FIELD, or fixedId when fixedType is BIN
                            // For DELIVERY: bin is fixedId (source bin)
                            const binId = type === 'DELIVERY' ? fixedId : (fixedType === 'BIN' ? fixedId : selectedItemId);
                            const bin = bins.find(b => b.id === binId);
                            const landlord = bin?.landlord_id ? landlords.find(l => l.id === bin.landlord_id) : null;
                            const sharePct = bin?.landlord_share_pct || 0;
                            const totalBu = parseFloat(bushels) || 0;
                            const landlordBu = totalBu * (sharePct / 100);
                            const tenantBu = totalBu - landlordBu;

                            if (sharePct > 0 && landlord) {
                                return (
                                    <View style={styles.splitCard}>
                                        <Text style={styles.splitTitle}>🤝 LANDLORD SPLIT</Text>
                                        <View style={styles.splitRow}>
                                            <Text style={styles.splitLabel}>Landlord</Text>
                                            <Text style={styles.splitValue}>{landlord.name} ({sharePct}%)</Text>
                                        </View>
                                        <View style={styles.splitRow}>
                                            <Text style={styles.splitLabel}>Landlord Bushels</Text>
                                            <Text style={[styles.splitValue, { color: Theme.colors.warning }]}>{landlordBu.toFixed(2)}</Text>
                                        </View>
                                        <View style={styles.splitRow}>
                                            <Text style={styles.splitLabel}>Your Bushels</Text>
                                            <Text style={[styles.splitValue, { color: Theme.colors.success }]}>{tenantBu.toFixed(2)}</Text>
                                        </View>
                                        <View style={[styles.splitRow, { borderTopWidth: 1, borderTopColor: Theme.colors.border, paddingTop: 8, marginTop: 4 }]}>
                                            <Text style={[styles.splitLabel, { fontWeight: 'bold' }]}>Total Net</Text>
                                            <Text style={[styles.splitValue, { fontWeight: 'bold' }]}>{totalBu.toFixed(2)}</Text>
                                        </View>
                                    </View>
                                );
                            } else if (bin) {
                                return (
                                    <View style={[styles.splitCard, { borderLeftColor: Theme.colors.border }]}>
                                        <Text style={{ color: Theme.colors.textSecondary, fontSize: 13 }}>No landlord split configured for this bin.</Text>
                                    </View>
                                );
                            }
                            return null;
                        })()}
                    </View>
                )}

                {type === 'SPRAY' && (
                    <>
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Audit Header Details</Text>
                            <View style={styles.inputForm}>
                                <TextInput
                                    style={styles.formInputFull}
                                    placeholder="Target Crop (e.g. CornIE3)"
                                    value={targetCrop}
                                    onChangeText={setTargetCrop}
                                />
                                <TextInput
                                    style={styles.formInputFull}
                                    placeholder="Target Pest (e.g. Grass/Broadleaf)"
                                    value={targetPest}
                                    onChangeText={setTargetPest}
                                />
                                <TextInput
                                    style={styles.formInputFull}
                                    placeholder="Applicator Name"
                                    value={applicatorName}
                                    onChangeText={setApplicatorName}
                                />
                                <TextInput
                                    style={styles.formInputFull}
                                    placeholder="Cert #"
                                    value={applicatorCert}
                                    onChangeText={setApplicatorCert}
                                />
                            </View>
                        </View>

                        <View style={styles.section}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={styles.sectionTitle}>Live Weather</Text>
                                <TouchableOpacity onPress={loadWeather}>
                                    <Text style={{ color: Theme.colors.primary, fontSize: 12 }}>REFRESH</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={styles.weatherCard}>
                                {loadingWeather ? (
                                    <ActivityIndicator color={Theme.colors.primary} />
                                ) : weather ? (
                                    <View style={styles.weatherGrid}>
                                        <View style={styles.weatherItem}>
                                            <Text style={styles.weatherValue}>{weather.temperature}°F</Text>
                                            <Text style={styles.weatherLabel}>Temp</Text>
                                        </View>
                                        <View style={styles.weatherItem}>
                                            <Text style={styles.weatherValue}>{weather.windSpeed} mph</Text>
                                            <Text style={styles.weatherLabel}>Wind</Text>
                                        </View>
                                        <View style={styles.weatherItem}>
                                            <Text style={styles.weatherValue}>{weather.windDirection}</Text>
                                            <Text style={styles.weatherLabel}>Dir</Text>
                                        </View>
                                    </View>
                                ) : (
                                    <Text style={{ color: Theme.colors.textSecondary, fontStyle: 'italic' }}>Weather data unavailable. Tap to refresh.</Text>
                                )}
                            </View>
                        </View>
                    </>
                )}

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Notes</Text>
                    <TextInput
                        style={styles.notesInput}
                        multiline
                        placeholder="Condition, wind gusts, etc."
                        value={notes}
                        onChangeText={setNotes}
                    />
                </View>

                <TouchableOpacity
                    style={[styles.actionButton, saving && styles.disabledButton]}
                    disabled={saving}
                    onPress={handleLog}
                >
                    <Text style={styles.actionButtonText}>{saving ? 'Saving...' : 'SAVE LOG'}</Text>
                </TouchableOpacity>

                <View style={{ alignItems: 'center', marginTop: 20, marginBottom: 20 }}>
                    <Text style={{ fontSize: 10, color: '#ccc' }}>FarmFlow v4.14-STABLE</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Theme.colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { paddingBottom: 40 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: Theme.spacing.lg,
    },
    closeText: { color: Theme.colors.danger, fontSize: 16, fontWeight: 'bold' },
    headerTitle: { ...Theme.typography.h2 },
    fieldInfo: {
        padding: Theme.spacing.lg,
        backgroundColor: Theme.colors.surface,
        alignItems: 'center',
        marginBottom: Theme.spacing.md,
    },
    fieldName: { ...Theme.typography.h1, color: Theme.colors.primary },
    fieldAcreage: { ...Theme.typography.body, color: Theme.colors.textSecondary },
    section: { paddingHorizontal: Theme.spacing.lg, marginBottom: Theme.spacing.xl },
    sectionTitle: {
        ...Theme.typography.caption,
        fontWeight: 'bold',
        marginBottom: Theme.spacing.sm,
        textTransform: 'uppercase',
    },
    itemGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Theme.spacing.md,
    },
    itemCard: {
        width: '47%',
        padding: Theme.spacing.md,
        borderRadius: Theme.borderRadius.md,
        borderWidth: 2,
        borderColor: Theme.colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 60,
        backgroundColor: Theme.colors.white
    },
    itemCardActive: { borderColor: Theme.colors.primary, backgroundColor: '#F1F8E9' },
    itemText: { textAlign: 'center', fontWeight: 'bold', fontSize: 14 },
    itemTextActive: { color: Theme.colors.primary },
    inputForm: { backgroundColor: Theme.colors.white, padding: Theme.spacing.md, borderRadius: Theme.borderRadius.md, ...Theme.shadows.sm },
    inputRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.sm },
    label: { ...Theme.typography.body, fontWeight: 'bold' },
    formInput: {
        width: 100,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        padding: Theme.spacing.sm,
        borderRadius: Theme.borderRadius.sm,
        fontSize: 16,
        textAlign: 'center',
    },
    formInputFull: {
        borderWidth: 1,
        borderColor: Theme.colors.border,
        padding: Theme.spacing.md,
        borderRadius: Theme.borderRadius.sm,
        fontSize: 16,
        marginBottom: Theme.spacing.sm,
    },
    weatherCard: {
        backgroundColor: Theme.colors.white,
        padding: Theme.spacing.md,
        borderRadius: Theme.borderRadius.md,
        ...Theme.shadows.sm,
        minHeight: 80,
        justifyContent: 'center'
    },
    weatherGrid: { flexDirection: 'row', justifyContent: 'space-around' },
    weatherItem: { alignItems: 'center' },
    weatherValue: { fontSize: 20, fontWeight: 'bold', color: Theme.colors.primary },
    weatherLabel: { ...Theme.typography.caption, color: Theme.colors.textSecondary },
    notesInput: {
        backgroundColor: Theme.colors.white,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        padding: Theme.spacing.md,
        borderRadius: Theme.borderRadius.md,
        height: 80,
        textAlignVertical: 'top'
    },
    actionButton: {
        backgroundColor: Theme.colors.primary,
        padding: Theme.spacing.lg,
        borderRadius: Theme.borderRadius.md,
        alignItems: 'center',
        marginHorizontal: Theme.spacing.lg,
        marginTop: Theme.spacing.md,
    },
    disabledButton: { backgroundColor: Theme.colors.border },
    actionButtonText: { color: Theme.colors.white, fontSize: 18, fontWeight: 'bold' },
    splitCard: {
        marginTop: Theme.spacing.md,
        padding: Theme.spacing.md,
        backgroundColor: '#FFFBE6',
        borderRadius: Theme.borderRadius.md,
        borderLeftWidth: 4,
        borderLeftColor: Theme.colors.warning,
    },
    splitTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: Theme.colors.textSecondary,
        textTransform: 'uppercase',
        marginBottom: Theme.spacing.sm,
    },
    splitRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    splitLabel: {
        fontSize: 14,
        color: Theme.colors.text,
    },
    splitValue: {
        fontSize: 14,
        fontWeight: '600',
        color: Theme.colors.text,
    },
    recipeSummary: { marginTop: Theme.spacing.md, padding: Theme.spacing.md, backgroundColor: '#F9F9F9', borderRadius: Theme.borderRadius.md, borderLeftWidth: 4, borderLeftColor: Theme.colors.primary },
    summaryLabel: { fontSize: 10, fontWeight: 'bold', color: Theme.colors.textSecondary, marginBottom: 5, textTransform: 'uppercase' },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
    summaryProduct: { fontSize: 13, color: Theme.colors.text },
    summaryValue: { fontSize: 13, fontWeight: 'bold', color: Theme.colors.primary }
});
