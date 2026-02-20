import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ActivityIndicator, Platform, TextInput, ScrollView, Switch, Alert } from 'react-native';
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
import DateTimePicker from '@react-native-community/datetimepicker';

export type LogType = 'SPRAY' | 'PLANTING' | 'HARVEST' | 'DELIVERY' | 'ADJUSTMENT';

interface LogSessionProps {
    type: LogType;
    fixedId: string;
    fixedName: string;
    fixedAcreage?: number;
    fixedType: 'FIELD' | 'BIN';
    replacesLogId?: string;
    onClose: () => void;
}

type ListItem = Recipe | SeedVariety | Bin | Contract | Field;

export const LogSessionScreen = ({ type, fixedId, fixedName, fixedAcreage, fixedType, replacesLogId, onClose }: LogSessionProps) => {
    const { recipes, sprayLogs, loading: sprayLoading, addSprayLog } = useSpray();
    const { seeds, plantingLogs, loading: plantingLoading, addPlantingLog, getLastPopulation } = usePlanting();
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

    // TIME Control
    const [sprayedAt, setSprayedAt] = useState(new Date());
    const [showTimePicker, setShowTimePicker] = useState(false);

    // Weather / Spray Info
    const [temp, setTemp] = useState('75');
    const [wind, setWind] = useState('5');
    const [windDir, setWindDir] = useState('NW');
    const [humidity, setHumidity] = useState('45');
    const [weatherSource, setWeatherSource] = useState<'AUTO' | 'MANUAL'>('AUTO');
    const [expandedWeather, setExpandedWeather] = useState(false);

    // Audit Fields for Spray
    const [targetCrop, setTargetCrop] = useState('');
    const [targetPest, setTargetPest] = useState('');
    const [applicatorName, setApplicatorName] = useState(settings?.default_applicator_name || '');
    const [applicatorCert, setApplicatorCert] = useState(settings?.default_applicator_cert || '');
    const [voidReason, setVoidReason] = useState('');

    // Acreage Override
    const [inputAcreage, setInputAcreage] = useState(fixedAcreage?.toString() || '');

    // Planting specific
    const [population, setPopulation] = useState('');
    const [depth, setDepth] = useState('1.5');

    // Guardrail State
    const [windWarning, setWindWarning] = useState(false);
    const [acreageWarning, setAcreageWarning] = useState(false);

    useEffect(() => {
        // Initial setup for spray
        if (type === 'SPRAY') {
            loadWeather();
            if (settings) {
                setApplicatorName(settings.default_applicator_name || '');
                setApplicatorCert(settings.default_applicator_cert || '');
            }
            if (fixedAcreage) {
                setInputAcreage(fixedAcreage.toString());
            }

            // Pre-fill for correction
            if (replacesLogId && sprayLogs.length > 0) {
                const oldLog = sprayLogs.find(l => l.id === replacesLogId);
                if (oldLog) {
                    setSelectedItemId(oldLog.recipe_id);
                    setTargetCrop(oldLog.target_crop || '');
                    setTargetPest(oldLog.target_pest || '');
                    setApplicatorName(oldLog.applicator_name || applicatorName);
                    setApplicatorCert(oldLog.applicator_cert || applicatorCert);
                    setNotes(oldLog.notes || '');
                    setVoidReason('Correction of previous record');
                    if (oldLog.acres_treated) setInputAcreage(oldLog.acres_treated.toString());
                    if (oldLog.sprayed_at) setSprayedAt(new Date(oldLog.sprayed_at));
                    if (oldLog.weather_temp) setTemp(oldLog.weather_temp.toString());
                    if (oldLog.weather_wind_speed) setWind(oldLog.weather_wind_speed.toString());
                    if (oldLog.weather_wind_dir) setWindDir(oldLog.weather_wind_dir);
                    if (oldLog.weather_humidity) setHumidity(oldLog.weather_humidity.toString());
                    // If correcting, assume manual/verified weather if changed, but we default source to MANUAL to be safe if they touch it
                    setWeatherSource('MANUAL');
                }
            }
        }

        // Mock loading delay to ensure hooks have data
        const timer = setTimeout(async () => {
            setLoading(false);

            // Smart suggestions
            if (type === 'PLANTING' && seeds.length > 0) {
                // Default to first seed
                const initialSeed = seeds[0];
                setSelectedItemId(initialSeed.id);

                // Try to get last population for this field+seed
                const lastPop = await getLastPopulation(fixedId, initialSeed.id);
                setPopulation(lastPop ? lastPop.toString() : initialSeed.default_population.toString());

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

    // Guardrail Checks
    useEffect(() => {
        if (type !== 'SPRAY') return;

        // Wind Check
        const w = parseFloat(wind);
        if (isNaN(w) || w <= 0) {
            setWindWarning(true);
        } else {
            setWindWarning(false);
        }

        // Acreage Check
        const ac = parseFloat(inputAcreage);
        if (fixedAcreage && !isNaN(ac)) {
            const diff = Math.abs(ac - fixedAcreage);
            const pct = diff / fixedAcreage;
            if (pct > 0.2) { // > 20% variance
                setAcreageWarning(true);
            } else {
                setAcreageWarning(false);
            }
        }
    }, [wind, inputAcreage, type, fixedAcreage]);


    const loadWeather = async () => {
        setLoadingWeather(true);
        const data = await fetchCurrentWeather();
        if (data) {
            setWeather(data);
            setTemp(data.temperature.toString());
            setWind(data.windSpeed.toString());
            setWindDir(data.windDirection);
            setHumidity(data.humidity.toString());
            setWeatherSource('AUTO');
        }
        setLoadingWeather(false);
    };

    const handleWeatherChange = (field: string, val: string) => {
        setWeatherSource('MANUAL');
        if (field === 'temp') setTemp(val);
        if (field === 'wind') setWind(val);
        if (field === 'dir') setWindDir(val);
        if (field === 'hum') setHumidity(val);
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
            }, 1000); // Faster close
            return () => clearTimeout(timer);
        }
    }, [showSuccess]);

    const handleLog = async () => {
        if (!selectedItemId && type !== 'DELIVERY' && type !== 'HARVEST') {
            showAlert('Selection Required', 'Please select an item to continue.');
            return;
        }

        // CONFIRMATION for Guardrails (Non-blocking but explicit)
        if (type === 'SPRAY' && (windWarning || acreageWarning)) {
            // In a real native app, we might show a native Alert.alert with "Proceed" option.
            // For now, we will trust the visual warning is enough, OR we could do a simple confirm check:
            // But requirement says "No blocking modals unless user tries to export".
            // So we proceed, but maybe log the warning in notes? (Optional improvement)
        }

        setSaving(true);
        try {
            if (type === 'SPRAY') {
                const finalAcres = parseFloat(inputAcreage);
                if (isNaN(finalAcres) || finalAcres <= 0) throw new Error('Valid acreage required');

                const selectedRecipe = recipes.find(r => r.id === selectedItemId);

                // Calculate total chemical volume (sum of all items)
                const totalChemicalVolume = selectedRecipe?.items?.reduce((acc, i) => acc + i.rate, 0) || (selectedRecipe?.rate_per_acre || 0);

                await addSprayLog({
                    fieldId: fixedId,
                    recipeId: selectedItemId!,
                    totalGallons: (selectedRecipe?.water_rate_per_acre || 0) * finalAcres,
                    totalProduct: totalChemicalVolume * finalAcres,
                    weather: {
                        temp: parseFloat(temp),
                        windSpeed: parseFloat(wind),
                        windDir: windDir,
                        humidity: parseFloat(humidity)
                    },
                    weatherSource: weatherSource,
                    targetCrop,
                    targetPest,
                    applicatorName,
                    applicatorCert,
                    acresTreated: finalAcres,
                    phi_days: selectedRecipe?.phi_days,
                    rei_hours: selectedRecipe?.rei_hours,
                    notes: notes,
                    sprayedAt: sprayedAt.toISOString(),
                    sprayedAt: sprayedAt.toISOString(),
                    // Safety: Void & Replace
                    // If replacesLogId is set, backend/hook logic must handle the voiding of the old record.
                    // We pass the new ID reference and reason.
                    replacesLogId: replacesLogId || undefined,
                    voidReason: replacesLogId ? voidReason : undefined
                });
            } else if (type === 'PLANTING') {
                await addPlantingLog({
                    fieldId: fixedId,
                    seedId: selectedItemId!,
                    population: parseFloat(population),
                    depth: parseFloat(depth),
                    notes: notes,
                    plantedAt: sprayedAt.toISOString(),
                    replacesLogId: replacesLogId || undefined,
                    voidReason: replacesLogId ? voidReason : undefined
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
            setSaving(false);
            setShowSuccess(true);
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
                <Text style={{ fontSize: 32, color: '#fff', fontWeight: 'bold', marginTop: 20 }}>SAVED</Text>
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
                <TouchableOpacity onPress={handleLog} disabled={saving}>
                    <Text style={[styles.saveHeaderText, saving && { color: Theme.colors.textSecondary }]}>
                        {saving ? 'Saving' : 'SAVE'}
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* 1. TOP CARD: Context (Field, Date, Weather) - COMPACT */}
                <View style={styles.topCard}>
                    <View style={styles.rowBetween}>
                        <View>
                            <Text style={styles.fieldName}>{fixedName}</Text>
                            {replacesLogId && <Text style={{ color: Theme.colors.warning, fontWeight: 'bold', fontSize: 10 }}>CORRECTING RECORD</Text>}
                        </View>
                        {/* Compact Time Control */}
                        <TouchableOpacity style={styles.compactControl} onPress={() => setShowTimePicker(true)}>
                            <Text style={styles.compactLabel}>TIME</Text>
                            <Text style={styles.compactValue}>
                                {sprayedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Compact Weather Control */}
                    <View style={{ marginTop: 12 }}>
                        <TouchableOpacity
                            style={[styles.rowBetween, { paddingVertical: 4 }]}
                            onPress={() => setExpandedWeather(!expandedWeather)}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={[styles.compactLabel, { marginRight: 8 }]}>WEATHER {weatherSource === 'MANUAL' ? '(Edited)' : '(Auto)'}</Text>
                            </View>
                            <View style={{ flexDirection: 'row' }}>
                                <Text style={styles.compactValue}>{temp}°F  {wind} mph {windDir}</Text>
                                <Text style={{ marginLeft: 6, color: Theme.colors.primary, fontSize: 12 }}>{expandedWeather ? '▲' : '▼'}</Text>
                            </View>
                        </TouchableOpacity>

                        {/* Expandable Weather Edit */}
                        {expandedWeather && (
                            <View style={styles.weatherEditContainer}>
                                <View style={styles.weatherInputRow}>
                                    <View style={styles.weatherInputGroup}>
                                        <Text style={styles.inputLabelSmall}>Temp</Text>
                                        <TextInput style={styles.weatherInput} value={temp} onChangeText={t => handleWeatherChange('temp', t)} keyboardType="numeric" />
                                    </View>
                                    <View style={styles.weatherInputGroup}>
                                        <Text style={styles.inputLabelSmall}>Wind</Text>
                                        <TextInput style={[styles.weatherInput, windWarning && { borderColor: Theme.colors.danger, borderWidth: 2 }]} value={wind} onChangeText={t => handleWeatherChange('wind', t)} keyboardType="numeric" />
                                    </View>
                                    <View style={styles.weatherInputGroup}>
                                        <Text style={styles.inputLabelSmall}>Dir</Text>
                                        <TextInput style={styles.weatherInput} value={windDir} onChangeText={t => handleWeatherChange('dir', t)} />
                                    </View>
                                    <View style={styles.weatherInputGroup}>
                                        <Text style={styles.inputLabelSmall}>Hum %</Text>
                                        <TextInput style={styles.weatherInput} value={humidity} onChangeText={t => handleWeatherChange('hum', t)} keyboardType="numeric" />
                                    </View>
                                </View>
                                {windWarning && <Text style={styles.warningText}>⚠️ Please confirm wind speed (required)</Text>}
                            </View>
                        )}
                    </View>

                    {/* Date Picker Modal (Platform specific logic usually needed, simplifying for demo) */}
                    {showTimePicker && (
                        <DateTimePicker
                            value={sprayedAt}
                            mode="time"
                            display="default"
                            onChange={(event, date) => {
                                setShowTimePicker(false);
                                if (date) setSprayedAt(date);
                            }}
                        />
                    )}
                </View>

                {/* 2. MAIN INPUTS: Recipe & Acres */}
                <View style={styles.section}>
                    <View style={styles.rowBetween}>
                        <Text style={styles.sectionTitle}>
                            {type === 'SPRAY' ? 'RECIPE' : type === 'PLANTING' ? 'SEED' : 'ITEM'}
                        </Text>
                        {type === 'SPRAY' && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={[styles.inputLabelSmall, { marginRight: 5 }]}>Acres:</Text>
                                <TextInput
                                    style={[styles.acreageInput, acreageWarning && { borderColor: Theme.colors.warning, borderWidth: 2 }]}
                                    value={inputAcreage}
                                    onChangeText={setInputAcreage}
                                    keyboardType="numeric"
                                />
                            </View>
                        )}
                    </View>
                    {acreageWarning && <Text style={[styles.warningText, { textAlign: 'right', marginBottom: 5 }]}>⚠️ Variance {'>'} 20%</Text>}

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                        {items.map((item) => {
                            const id = (item as any).id;
                            let label = '';
                            if (type === 'SPRAY') label = (item as Recipe).name;
                            else if (type === 'PLANTING') label = `${(item as SeedVariety).brand}`;
                            else if (type === 'HARVEST') label = (item as Bin).name || (item as Field).name;
                            else if (type === 'DELIVERY') label = (item as Contract).destination_name;

                            return (
                                <TouchableOpacity
                                    key={id}
                                    style={[
                                        styles.itemCard,
                                        selectedItemId === id && styles.itemCardActive
                                    ]}
                                    onPress={async () => {
                                        setSelectedItemId(id);
                                        // Auto-fill population if PLANTING
                                        if (type === 'PLANTING') {
                                            const sId = id;
                                            const lastPop = await getLastPopulation(fixedId, sId);
                                            const seedObj = seeds.find(s => s.id === sId);
                                            if (lastPop) {
                                                setPopulation(lastPop.toString());
                                            } else if (seedObj) {
                                                setPopulation(seedObj.default_population.toString());
                                            }
                                        }
                                    }}
                                >
                                    <Text style={[styles.itemText, selectedItemId === id && styles.itemTextActive]}>
                                        {label}
                                    </Text>
                                    {type === 'SPRAY' && (item as Recipe).items && (
                                        <Text style={{ fontSize: 9, color: Theme.colors.textSecondary }}>{(item as Recipe).items?.length} products</Text>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* 3. OPTIONAL / DETAILS (Collapsed details or simple inputs) */}
                <View style={styles.section}>
                    <TextInput
                        style={styles.simpleNotes}
                        multiline
                        placeholder="Add notes..."
                        value={notes}
                        onChangeText={setNotes}
                    />
                </View>

                {/* Correction Reason (Only if replacing) */}
                {(type === 'SPRAY' || type === 'PLANTING') && replacesLogId && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: Theme.colors.danger }]}>CORRECTION REASON</Text>
                        <TextInput
                            style={[styles.formInputFull, { borderColor: Theme.colors.danger, backgroundColor: '#FFF5F5' }]}
                            placeholder="Reason for voiding the previous record..."
                            value={voidReason}
                            onChangeText={setVoidReason}
                        />
                    </View>
                )}

                {/* Extra Fields (Hidden by default or minimal for Fast Entry, kept for full functionality if needed) */}
                {/* We can expose Applicator Name nearby if needed, but per "Farmer-simple", try to keep it clean. */}

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
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.border,
        backgroundColor: '#fff'
    },
    closeText: { color: Theme.colors.textSecondary, fontSize: 16 },
    headerTitle: { ...Theme.typography.h2 },
    saveHeaderText: { color: Theme.colors.primary, fontWeight: 'bold', fontSize: 16 },

    topCard: {
        backgroundColor: Theme.colors.white,
        padding: Theme.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.border,
        marginBottom: Theme.spacing.md
    },
    fieldName: { ...Theme.typography.h2, color: Theme.colors.text },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

    compactControl: {
        backgroundColor: '#F5F5F5',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        alignItems: 'center'
    },
    compactLabel: { fontSize: 9, color: Theme.colors.textSecondary, fontWeight: 'bold' },
    compactValue: { fontSize: 14, fontWeight: '600', color: Theme.colors.text },

    weatherEditContainer: {
        backgroundColor: '#FAFAFA',
        padding: 10,
        borderRadius: 8,
        marginTop: 8,
        borderWidth: 1,
        borderColor: Theme.colors.border
    },
    weatherInputRow: { flexDirection: 'row', justifyContent: 'space-between' },
    weatherInputGroup: { alignItems: 'center', flex: 1 },
    weatherInput: {
        borderWidth: 1,
        borderColor: Theme.colors.border,
        backgroundColor: '#fff',
        borderRadius: 4,
        width: '90%',
        textAlign: 'center',
        paddingVertical: 4
    },
    inputLabelSmall: { fontSize: 10, color: Theme.colors.textSecondary, marginBottom: 2 },
    warningText: { color: Theme.colors.warning, fontSize: 11, marginTop: 4, fontStyle: 'italic' },

    section: { paddingHorizontal: Theme.spacing.md, marginBottom: Theme.spacing.lg },
    sectionTitle: { fontSize: 11, fontWeight: 'bold', color: Theme.colors.textSecondary, marginBottom: 8, textTransform: 'uppercase' },

    horizontalScroll: { flexDirection: 'row', paddingVertical: 4 },
    itemCard: {
        width: 120,
        height: 80,
        padding: 8,
        marginRight: 10,
        borderRadius: 8,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: Theme.colors.border,
        justifyContent: 'center',
        alignItems: 'center',
        ...Theme.shadows.sm
    },
    itemCardActive: { borderColor: Theme.colors.primary, backgroundColor: '#E3F2FD', borderWidth: 2 },
    itemText: { fontWeight: 'bold', fontSize: 13, textAlign: 'center' },
    itemTextActive: { color: Theme.colors.primary },

    acreageInput: {
        borderWidth: 1,
        borderColor: Theme.colors.border,
        backgroundColor: '#fff',
        borderRadius: 4,
        width: 60,
        textAlign: 'center',
        paddingVertical: 2,
        fontWeight: 'bold'
    },

    simpleNotes: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: Theme.colors.border,
        borderRadius: 8,
        padding: 12,
        minHeight: 60,
        fontSize: 14
    },

    formInputFull: {
        borderWidth: 1,
        borderColor: Theme.colors.border,
        padding: Theme.spacing.md,
        borderRadius: Theme.borderRadius.sm,
        fontSize: 16,
        marginBottom: Theme.spacing.sm,
    },
});
