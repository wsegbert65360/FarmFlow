import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ActivityIndicator, Platform, TextInput, ScrollView, Switch, Alert } from 'react-native';
import { showAlert } from '../utils/AlertUtility';
import { Theme } from '../constants/Theme';
import { useSpray } from '../hooks/useSpray';
import { Recipe } from '../types/spray';
import { usePlanting, SeedVariety } from '../hooks/usePlanting';
import { useGrain, Bin } from '../hooks/useGrain';
import { useFields, Field } from '../hooks/useFields';
import { useContracts, Contract } from '../hooks/useContracts';
import { fetchCurrentWeather, WeatherData } from '../utils/WeatherUtility';
import { useLandlords } from '../hooks/useLandlords';
import { useSettings } from '../hooks/useSettings';
import { parseNumericInput } from '../utils/NumberUtility';

// Web-safe DateTimePicker import
let DateTimePicker: React.ComponentType<any> | null = null;
if (Platform.OS !== 'web') {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const module = require('@react-native-community/datetimepicker');
        DateTimePicker = module?.default || module || null;
    } catch (error) {
        console.warn('[LogSessionScreen] DateTimePicker import failed:', error);
        DateTimePicker = null;
    }
}

export type LogType = 'SPRAY' | 'PLANTING' | 'HARVEST' | 'DELIVERY' | 'ADJUSTMENT' | 'HARVEST_TO_TOWN';

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
    const [showSuccess, setShowSuccess] = useState(false);

    // TIME Control
    const [sprayedAt, setSprayedAt] = useState(() => new Date());
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [manualTime, setManualTime] = useState(() => new Date().toISOString().slice(11, 16));

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
            loadWeather().catch(e => console.error('[LogSession] Weather load failed:', e));
        }
    }, [type]);

    useEffect(() => {
        // Initial setup for spray (non-weather related)
        if (type === 'SPRAY') {
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
        const w = parseNumericInput(wind);
        if (isNaN(w) || w <= 0) {
            setWindWarning(true);
        } else {
            setWindWarning(false);
        }

        // Acreage Check
        const ac = parseNumericInput(inputAcreage);
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

    const [isReusing, setIsReusing] = useState(false);

    useEffect(() => {
        if (showSuccess) {
            const timer = setTimeout(() => {
                if (isReusing) {
                    // Reset for next entry
                    setShowSuccess(false);
                    setBushels('');
                    setNotes('');
                    // Keep acreage? Usually yes for same field, but maybe clear it to be safe?
                    // Let's keep acreage/recipe context as that's the point of reuse.
                    // But if it's Harvest, we clear bushels.
                    setIsReusing(false);
                } else {
                    onClose();
                }
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [showSuccess, isReusing]);

    const handleLog = async (reuse = false) => {
        if (!selectedItemId && type !== 'DELIVERY' && type !== 'HARVEST' && type !== 'HARVEST_TO_TOWN') {
            showAlert('Selection Required', 'Please select an item to continue.');
            return;
        }

        setIsReusing(reuse);
        setSaving(true);
        try {
            // ... (rest of logic same until success)
            if (type === 'SPRAY') {
                const finalAcres = parseNumericInput(inputAcreage);
                if (isNaN(finalAcres) || finalAcres <= 0) throw new Error('Valid acreage required');

                const selectedRecipe = recipes.find(r => r.id === selectedItemId);
                const totalChemicalVolume = selectedRecipe?.items?.reduce((acc, i) => acc + i.rate, 0) || (selectedRecipe?.rate_per_acre || 0);

                await addSprayLog({
                    fieldId: fixedId,
                    recipeId: selectedItemId!,
                    totalGallons: (selectedRecipe?.water_rate_per_acre || 0) * finalAcres,
                    totalProduct: totalChemicalVolume * finalAcres,
                    weather: {
                        temp: parseNumericInput(temp),
                        windSpeed: parseNumericInput(wind),
                        windDir: windDir,
                        humidity: parseNumericInput(humidity)
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
                    replacesLogId: replacesLogId || undefined,
                    voidReason: replacesLogId ? voidReason : undefined
                });
            } else if (type === 'PLANTING') {
                await addPlantingLog({
                    fieldId: fixedId,
                    seedId: selectedItemId!,
                    population: parseNumericInput(population),
                    depth: parseNumericInput(depth),
                    notes: notes,
                    plantedAt: sprayedAt.toISOString(),
                    replacesLogId: replacesLogId || undefined,
                    voidReason: replacesLogId ? voidReason : undefined
                });
            } else if (type === 'HARVEST') { // ... existing log logic
                const fieldId = fixedType === 'FIELD' ? fixedId : null;
                const binId = fixedType === 'BIN' ? fixedId : selectedItemId!;
                await addGrainLog({
                    type: 'HARVEST',
                    field_id: fieldId,
                    bin_id: binId,
                    destination_type: 'BIN',
                    destination_name: 'On-Farm Storage',
                    bushels_net: parseNumericInput(bushels) || 0,
                    moisture: parseNumericInput(moisture) || 15.0,
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
                    bushels_net: parseNumericInput(bushels) || 0,
                    moisture: parseNumericInput(moisture) || 15.0,
                    notes: notes,
                    end_time: new Date().toISOString()
                });
            } else if (type === 'HARVEST_TO_TOWN') {
                const fieldId = fixedType === 'FIELD' ? fixedId : null;
                await addGrainLog({
                    type: 'HARVEST_TO_TOWN',
                    field_id: fieldId,
                    bin_id: null,
                    destination_type: 'ELEVATOR',
                    destination_name: 'Town Elevator',
                    bushels_net: parseNumericInput(bushels) || 0,
                    moisture: parseNumericInput(moisture) || 15.0,
                    notes: notes,
                    end_time: new Date().toISOString()
                });
            }

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
                <Text style={{ fontSize: 32, color: '#fff', fontWeight: 'bold', marginTop: 20 }}>
                    {isReusing ? 'SAVED (Next...)' : 'SAVED'}
                </Text>
            </View>
        );
    }

    // ... loading check ...
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
                <TouchableOpacity onPress={onClose} style={{ padding: 8, minHeight: 44, justifyContent: 'center' }} accessibilityLabel="Cancel Log" accessibilityRole="button">
                    <Text style={styles.closeText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle} accessibilityRole="header">{type.replace(/_/g, ' ')} Log</Text>
                <TouchableOpacity onPress={() => handleLog(false)} disabled={saving} style={{ padding: 8, minHeight: 44, justifyContent: 'center' }} accessibilityLabel="Save and Close" accessibilityRole="button" accessibilityState={{ disabled: saving }}>
                    <Text style={[styles.saveHeaderText, saving && { color: Theme.colors.textSecondary }]}>
                        {saving ? 'Saving' : 'SAVE'}
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                {/* ... (Top Card & Inputs remain same) ... */}
                <View style={styles.topCard}>
                    <View style={styles.rowBetween}>
                        <View accessible accessibilityLabel={`Field: ${fixedName}`}>
                            <Text style={styles.fieldName}>{fixedName}</Text>
                            {replacesLogId && <Text style={{ color: Theme.colors.warning, fontWeight: 'bold', fontSize: 10 }}>CORRECTING RECORD</Text>}
                        </View>
                        {/* ... (Time Control) ... */}
                        <TouchableOpacity
                            style={styles.compactControl}
                            onPress={() => setShowTimePicker(true)}
                            accessibilityLabel={`Time: ${sprayedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Tap to change.`}
                            accessibilityRole="button"
                        >
                            <Text style={styles.compactLabel}>TIME</Text>
                            <Text style={styles.compactValue}>
                                {sprayedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* ... (Weather Control) ... */}
                    <View style={{ marginTop: 12 }}>
                        <TouchableOpacity
                            style={[styles.rowBetween, { paddingVertical: 12 }]}
                            onPress={() => setExpandedWeather(!expandedWeather)}
                            accessibilityLabel={`Weather: ${temp} degrees, wind ${wind} mph ${windDir}. Tap to ${expandedWeather ? 'collapse' : 'edit'}.`}
                            accessibilityRole="button"
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Text style={[styles.compactLabel, { marginRight: 8 }]}>WEATHER {weatherSource === 'MANUAL' ? '(Edited)' : '(Auto)'}</Text>
                            </View>
                            <View style={{ flexDirection: 'row' }}>
                                <Text style={styles.compactValue}>{temp}°F  {wind} mph {windDir}</Text>
                                <Text style={{ marginLeft: 6, color: Theme.colors.primary, fontSize: 12 }}>{expandedWeather ? '▲' : '▼'}</Text>
                            </View>
                        </TouchableOpacity>
                        {/* ... (Weather Edit Container) ... */}
                        {expandedWeather && (
                            <View style={styles.weatherEditContainer}>
                                <View style={styles.weatherInputRow}>
                                    <View style={styles.weatherInputGroup}>
                                        <Text style={styles.inputLabelSmall}>Temp</Text>
                                        <TextInput
                                            style={styles.weatherInput}
                                            value={temp}
                                            onChangeText={t => handleWeatherChange('temp', t)}
                                            keyboardType="numeric"
                                            accessibilityLabel="Temperature"
                                        />
                                    </View>
                                    <View style={styles.weatherInputGroup}>
                                        <Text style={styles.inputLabelSmall}>Wind</Text>
                                        <TextInput
                                            style={[styles.weatherInput, windWarning && { borderColor: Theme.colors.danger, borderWidth: 2 }]}
                                            value={wind}
                                            onChangeText={t => handleWeatherChange('wind', t)}
                                            keyboardType="numeric"
                                            accessibilityLabel="Wind Speed"
                                        />
                                    </View>
                                    <View style={styles.weatherInputGroup}>
                                        <Text style={styles.inputLabelSmall}>Dir</Text>
                                        <TextInput
                                            style={styles.weatherInput}
                                            value={windDir}
                                            onChangeText={t => handleWeatherChange('dir', t)}
                                            accessibilityLabel="Wind Direction"
                                        />
                                    </View>
                                    <View style={styles.weatherInputGroup}>
                                        <Text style={styles.inputLabelSmall}>Hum %</Text>
                                        <TextInput
                                            style={styles.weatherInput}
                                            value={humidity}
                                            onChangeText={t => handleWeatherChange('hum', t)}
                                            keyboardType="numeric"
                                            accessibilityLabel="Humidity Percentage"
                                        />
                                    </View>
                                </View>
                                {windWarning && <Text style={styles.warningText}>⚠️ Please confirm wind speed (required)</Text>}
                            </View>
                        )}
                    </View>
                    {/* ... (Date Picker) ... */}
                    {showTimePicker && (DateTimePicker ? (
                        <DateTimePicker
                            value={sprayedAt}
                            mode="time"
                            display="default"
                            onChange={(event: any, date: Date | undefined) => {
                                setShowTimePicker(false);
                                if (date) {
                                    setSprayedAt(date);
                                    setManualTime(date.toISOString().slice(11, 16));
                                }
                            }}
                        />
                    ) : (
                        <View style={styles.dateFallback}>
                            <Text style={styles.dateFallbackText}>Update the time manually:</Text>
                            <TextInput
                                style={styles.timeInput}
                                value={manualTime}
                                onChangeText={(value) => {
                                    setManualTime(value);
                                    const [hour = '00', minute = '00'] = value.split(':');
                                    const updated = new Date(sprayedAt);
                                    updated.setHours(Number(hour));
                                    updated.setMinutes(Number(minute));
                                    setSprayedAt(updated);
                                }}
                                placeholder="HH:MM"
                                keyboardType="numeric"
                                maxLength={5}
                                accessibilityLabel="Manual time input"
                            />
                            <TouchableOpacity
                                onPress={() => setShowTimePicker(false)}
                                style={styles.dateFallbackButton}
                                accessibilityRole="button"
                                accessibilityLabel="Done editing time"
                            >
                                <Text style={{ color: Theme.colors.primary, fontWeight: 'bold' }}>DONE</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>

                {/* 2. MAIN INPUTS: Recipe & Acres */}
                <View style={styles.section}>
                    {/* ... (Section Header) ... */}
                    <View style={styles.rowBetween}>
                        <Text style={styles.sectionTitle} accessibilityRole="header">
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
                                    accessibilityLabel="Acres Treated"
                                />
                            </View>
                        )}
                    </View>
                    {acreageWarning && <Text style={[styles.warningText, { textAlign: 'right', marginBottom: 5 }]}>⚠️ Variance {" > "} 20%</Text>}

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
                                    accessibilityLabel={`${label} ${selectedItemId === id ? 'Selected' : ''}`}
                                    accessibilityRole="radio"
                                    accessibilityState={{ checked: selectedItemId === id }}
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

                {/* 2.5 GRAIN INPUTS (Harvest/Delivery/Adjustment) */}
                {(type === 'HARVEST' || type === 'DELIVERY' || type === 'ADJUSTMENT' || type === 'HARVEST_TO_TOWN') && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle} accessibilityRole="header">AMOUNTS</Text>
                        <View style={styles.amountRow}>
                            <View style={styles.amountGroup}>
                                <Text style={styles.inputLabelSmall}>Bushels</Text>
                                <TextInput
                                    style={styles.amountInput}
                                    placeholder="Bushels"
                                    value={bushels}
                                    onChangeText={setBushels}
                                    keyboardType="numeric"
                                    accessibilityLabel="Bushels"
                                />
                            </View>
                            <View style={styles.amountGroup}>
                                <Text style={styles.inputLabelSmall}>Moisture %</Text>
                                <TextInput
                                    style={styles.amountInput}
                                    placeholder="Moisture"
                                    value={moisture}
                                    onChangeText={setMoisture}
                                    keyboardType="numeric"
                                    accessibilityLabel="Moisture"
                                />
                            </View>
                        </View>
                    </View>
                )}

                {/* 3. OPTIONAL / DETAILS */}
                <View style={styles.section}>
                    <TextInput
                        style={styles.simpleNotes}
                        multiline
                        placeholder="Add notes..."
                        value={notes}
                        onChangeText={setNotes}
                        accessibilityLabel="Notes"
                    />
                </View>

                {/* Correction Reason */}
                {(type === 'SPRAY' || type === 'PLANTING') && replacesLogId && (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: Theme.colors.danger }]}>CORRECTION REASON</Text>
                        <TextInput
                            style={[styles.formInputFull, { borderColor: Theme.colors.danger, backgroundColor: '#FFF5F5' }]}
                            placeholder="Reason for voiding the previous record..."
                            value={voidReason}
                            onChangeText={setVoidReason}
                            accessibilityLabel="Void Reason"
                        />
                    </View>
                )}

                {/* SAVE AND REUSE BUTTON */}
                <View style={{ paddingHorizontal: Theme.spacing.md, marginTop: Theme.spacing.lg }}>
                    <TouchableOpacity
                        style={styles.saveReuseButton}
                        onPress={() => handleLog(true)}
                        disabled={saving}
                        accessibilityLabel="Save and Add Another"
                        accessibilityRole="button"
                    >
                        <Text style={styles.saveReuseText}>{saving ? 'Saving...' : 'SAVE & ADD ANOTHER ＋'}</Text>
                    </TouchableOpacity>
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
        paddingHorizontal: Theme.spacing.lg,
        paddingVertical: Theme.spacing.sm, // Reduced padding as we added padding to buttons
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.border,
        backgroundColor: '#fff',
        minHeight: 50 // Ensure header has height
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
        paddingVertical: 10, // Increased for touch target
        borderRadius: 8,
        alignItems: 'center',
        minWidth: 80,
        minHeight: 44 // Ensure min height
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
        paddingVertical: 8, // More padding
        minHeight: 40
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
        width: 70, // Wider for easier tap
        textAlign: 'center',
        paddingVertical: 6,
        fontWeight: 'bold',
        minHeight: 40
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
    saveReuseButton: {
        backgroundColor: Theme.colors.secondary, // Or a distinct color like Theme.colors.info
        padding: Theme.spacing.lg,
        borderRadius: Theme.borderRadius.md,
        alignItems: 'center',
        marginBottom: Theme.spacing.lg,
        ...Theme.shadows.md
    },
    saveReuseText: {
        color: Theme.colors.primary,
        fontWeight: 'bold',
        fontSize: 16
    },

    dateFallback: {
        marginTop: 16,
        padding: Theme.spacing.sm,
        borderRadius: Theme.borderRadius.sm,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        backgroundColor: '#fff',
        alignItems: 'center'
    },
    dateFallbackText: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 12
    },
    timeInput: {
        width: '60%',
        textAlign: 'center',
        borderWidth: 1,
        borderColor: Theme.colors.border,
        borderRadius: Theme.borderRadius.sm,
        paddingVertical: 10,
        fontSize: 16,
        marginBottom: 12,
        minHeight: 44
    },
    dateFallbackButton: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: Theme.borderRadius.sm,
        borderWidth: 1,
        borderColor: Theme.colors.primary,
        minHeight: 44,
        justifyContent: 'center'
    },

    amountRow: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    amountGroup: {
        flex: 1
    },
    amountInput: {
        borderWidth: 1,
        borderColor: Theme.colors.border,
        backgroundColor: '#fff',
        borderRadius: Theme.borderRadius.sm,
        paddingHorizontal: Theme.spacing.md,
        fontSize: 16,
        minHeight: 64,
        justifyContent: 'center'
    }
});
