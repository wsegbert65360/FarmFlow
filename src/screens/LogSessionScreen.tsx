import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, TextInput, ScrollView } from 'react-native';
import { Theme } from '../constants/Theme';
import { useSpray, Recipe } from '../hooks/useSpray';
import { usePlanting, SeedVariety } from '../hooks/usePlanting';
import { useGrain, Bin } from '../hooks/useGrain';
import { useContracts, Contract } from '../hooks/useContracts';
import { fetchCurrentWeather, WeatherData } from '../utils/WeatherUtility';
import { useFields, Field } from '../hooks/useFields';
import { mockScanTicket } from '../utils/OCRUtility';
import { useSettings } from '../hooks/useSettings';

export type LogType = 'SPRAY' | 'PLANTING' | 'HARVEST' | 'DELIVERY';

interface LogSessionProps {
    type: LogType;
    fixedId: string; // The ID of the item the user clicked from (Field or Bin)
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
    const { friends, loading: friendsLoading } = { friends: [], loading: false }; // Placeholder if needed
    const { fields, loading: fieldsLoading } = useFields();
    const { settings } = useSettings();

    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
    const [loadingWeather, setLoadingWeather] = useState(false);
    const [weather, setWeather] = useState<WeatherData | null>(null);

    // Inputs
    const [bushels, setBushels] = useState('');
    const [moisture, setMoisture] = useState('15.0');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [scanning, setScanning] = useState(false);

    // Audit Fields for Spray
    const [targetCrop, setTargetCrop] = useState('');
    const [targetPest, setTargetPest] = useState('');
    const [applicatorName, setApplicatorName] = useState(settings?.default_applicator_name || '');
    const [applicatorCert, setApplicatorCert] = useState(settings?.default_applicator_cert || '');

    const loading = sprayLoading || plantingLoading || grainLoading || contractsLoading || fieldsLoading;

    useEffect(() => {
        if (type === 'SPRAY') {
            loadWeather();
        }
        if (settings && type === 'SPRAY') {
            if (!applicatorName) setApplicatorName(settings.default_applicator_name || '');
            if (!applicatorCert) setApplicatorCert(settings.default_applicator_cert || '');
        }
    }, [settings, type]);

    // Smart Suggestion Logic
    useEffect(() => {
        if (!loading && !selectedItemId) {
            if (type === 'HARVEST') {
                if (fixedType === 'BIN' && fields.length > 0) {
                    // At a bin? Suggest the field you are currently standing in (closest)
                    setSelectedItemId(fields[0].id);
                } else if (fixedType === 'FIELD' && bins.length > 0) {
                    // At a field? Suggest the first bin for now (could be 'last used' in future)
                    setSelectedItemId(bins[0].id);
                }
            } else if (type === 'SPRAY' && recipes.length > 0) {
                setSelectedItemId(recipes[0].id);
            } else if (type === 'PLANTING' && seeds.length > 0) {
                setSelectedItemId(seeds[0].id);
            } else if (type === 'DELIVERY' && contracts.length > 0) {
                setSelectedItemId(contracts[0].id);
            }
        }
    }, [loading, type, fixedType, fields, bins, recipes, seeds, contracts, selectedItemId]);

    const loadWeather = async () => {
        setLoadingWeather(true);
        const data = await fetchCurrentWeather();
        if (data) setWeather(data);
        setLoadingWeather(false);
    };

    const getItems = (): ListItem[] => {
        switch (type) {
            case 'SPRAY': return recipes;
            case 'PLANTING': return seeds;
            case 'HARVEST':
                // If we're coming from a field, we need to pick a bin
                if (fixedType === 'FIELD') return bins;
                // If we're coming from a bin, we need to pick a field
                return fields;
            case 'DELIVERY': return contracts;
            default: return [];
        }
    };

    const handleLog = async () => {
        if (!selectedItemId && type !== 'DELIVERY') {
            Alert.alert('Selection Required', 'Please select an item to continue.');
            return;
        }

        setSaving(true);
        try {
            if (type === 'SPRAY') {
                if (!fixedAcreage) throw new Error('Acreage required');
                const selectedRecipe = recipes.find(r => r.id === selectedItemId);
                await addSprayLog({
                    fieldId: fixedId,
                    recipeId: selectedItemId!,
                    totalGallons: (selectedRecipe?.water_rate_per_acre || 0) * fixedAcreage,
                    totalProduct: (selectedRecipe?.rate_per_acre || 0) * fixedAcreage,
                    weather: weather ? {
                        temp: weather.temperature,
                        windSpeed: weather.windSpeed,
                        windDir: weather.windDirection,
                        humidity: weather.humidity
                    } : null,
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
                const selectedSeed = seeds.find(s => s.id === selectedItemId);
                await addPlantingLog({
                    fieldId: fixedId,
                    seedId: selectedItemId!,
                    population: selectedSeed?.default_population || 32000,
                    depth: 2.0,
                    notes: notes
                });
            } else if (type === 'HARVEST') {
                // Figure out which is which
                const fieldId = fixedType === 'FIELD' ? fixedId : selectedItemId!;
                const binId = fixedType === 'BIN' ? fixedId : selectedItemId!;

                await addGrainLog({
                    type: 'HARVEST',
                    field_id: fieldId,
                    bin_id: binId,
                    destination_type: 'BIN',
                    bushels_net: parseFloat(bushels) || 0,
                    moisture: parseFloat(moisture) || 15.0,
                    notes: notes
                });
            } else if (type === 'DELIVERY') {
                const contract = contracts.find(c => (c as Contract).id === selectedItemId) as Contract;
                await addGrainLog({
                    type: 'DELIVERY',
                    bin_id: fixedId,
                    destination_type: 'ELEVATOR',
                    destination_name: contract?.destination_name || 'Direct Sale',
                    contract_id: contract?.id,
                    bushels_net: parseFloat(bushels) || 0,
                    moisture: parseFloat(moisture) || 15.0,
                    notes: notes
                });
            }
            onClose();
        } catch (error) {
            Alert.alert('Error', 'Failed to save log entry.');
            console.error(error);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color={Theme.colors.primary} />
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
                                    <Text style={[styles.itemText, selectedItemId === id && styles.itemTextActive]}>
                                        {label}
                                    </Text>
                                    {distanceLabel && (
                                        <Text style={{ fontSize: 10, color: Theme.colors.textSecondary }}>
                                            {distanceLabel}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {(type === 'HARVEST' || type === 'DELIVERY') && (
                    <View style={styles.section}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Theme.spacing.sm }}>
                            <Text style={styles.sectionTitle}>Quantities</Text>
                            <TouchableOpacity
                                style={styles.scanButton}
                                onPress={async () => {
                                    setScanning(true);
                                    try {
                                        const result = await mockScanTicket();
                                        setBushels(result.bushels.toString());
                                        setMoisture(result.moisture.toString());
                                        if (result.ticketNumber) setNotes(n => n ? `${n}\nTicket ${result.ticketNumber}` : `Ticket ${result.ticketNumber}`);
                                        Alert.alert('Scan Successful', 'Scale ticket data imported and validated via Zod.');
                                    } catch (e) {
                                        Alert.alert('Scan Failed', 'Could not parse ticket data.');
                                    } finally {
                                        setScanning(false);
                                    }
                                }}
                                disabled={scanning}
                            >
                                <Text style={styles.scanButtonText}>{scanning ? 'SCANNING...' : '📷 SCAN TICKET'}</Text>
                            </TouchableOpacity>
                        </View>
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
    scanButton: {
        backgroundColor: Theme.colors.success,
        paddingHorizontal: Theme.spacing.sm,
        paddingVertical: 4,
        borderRadius: Theme.borderRadius.sm,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    scanButtonText: {
        color: Theme.colors.white,
        fontSize: 12,
        fontWeight: 'bold',
    },
});
