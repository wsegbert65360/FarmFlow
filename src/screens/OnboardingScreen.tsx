import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Modal } from 'react-native';
import { showAlert } from '../utils/AlertUtility';
import { Theme } from '../constants/Theme';
import { useSettings } from '../hooks/useSettings';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { connector } from '../db/SupabaseConnector';
import { db } from '../db/powersync';
import { v4 as uuidv4 } from 'uuid';
import { useFarms } from '../hooks/useFarms';

export const OnboardingScreen = ({ onComplete }: { onComplete: () => void }) => {
    const { saveSettings } = useSettings();
    const { farms, acceptInvite, switchFarm } = useFarms();
    const [farmName, setFarmName] = useState('');
    const [state, setState] = useState('');
    const [units, setUnits] = useState<'US' | 'Metric'>('US');
    const [mode, setMode] = useState<'NEW' | 'JOIN' | 'SWITCH'>('NEW');
    const [showScanner, setShowScanner] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [manualId, setManualId] = useState('');
    const [joiningManual, setJoiningManual] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    useEffect(() => {
        if (farms.length > 0 && mode === 'NEW') {
            setMode('SWITCH');
        }
    }, [farms]);

    const handleFinish = async () => {
        if (mode === 'NEW') {
            if (!farmName || !state) return;
            try {
                const farmId = uuidv4();
                const user = await connector.getUser();

                if (!user) throw new Error('User not authenticated');

                // 1. Create the farm record
                const { error: farmError } = await connector.client
                    .from('farms')
                    .insert({
                        id: farmId,
                        name: farmName,
                        owner_id: user.id.toString(),
                        created_at: new Date().toISOString()
                    });

                if (farmError) throw farmError;

                // 2. Create the membership record
                const { error: memberError } = await connector.client
                    .from('farm_members')
                    .insert({
                        id: uuidv4(),
                        user_id: user.id.toString(),
                        farm_id: farmId,
                        role: 'OWNER',
                        created_at: new Date().toISOString()
                    });

                if (memberError) throw memberError;

                // 3. Save settings locally
                await saveSettings({
                    farm_name: farmName,
                    state: state,
                    units: units,
                    onboarding_completed: true,
                    farm_id: farmId,
                });

                // 4. Trigger full sync
                const { SyncUtility } = require('../utils/SyncUtility');
                SyncUtility.performFullSync(user.id).catch(console.error);

                onComplete();
            } catch (error: any) {
                console.error('Registration Error:', error);
                const msg = error.message || 'Unknown network error';
                showAlert('Registration Failed', `Could not create farm: ${msg}`);
            }
        }
    };

    const handleScanJoin = async (data: string) => {
        if (isScanning) return;
        setIsScanning(true);
        try {
            let token = data;
            try {
                const parsed = JSON.parse(data);
                token = parsed.token || parsed.t || data;
            } catch (e) {
                // Not JSON, assume data is the raw token
            }

            const user = await connector.getUser();
            if (!user) throw new Error('User not authenticated');

            // Use the secure RPC hook from useFarms
            const result = await acceptInvite(token);

            if (!result) {
                throw new Error('Invalid or expired invitation token.');
            }

            setShowScanner(false);
            onComplete();
            showAlert('Success', `Joined ${result.farm_name} successfully!`);

            // Trigger full sync
            const { SyncUtility } = require('../utils/SyncUtility');
            SyncUtility.performFullSync(user.id).catch(console.error);
        } catch (error: any) {
            console.error('Join failed:', error);
            const msg = error.message || 'Unknown network error';
            showAlert('Join Failed', `Could not join farm: ${msg} `);
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>Welcome to FarmFlow</Text>
                <Text style={styles.subtitle}>The simple, secure Anti-ERP for modern farms.</Text>

                <View style={styles.modeToggle}>
                    {farms.length > 0 && (
                        <TouchableOpacity
                            style={[styles.modeButton, mode === 'SWITCH' && styles.modeActive]}
                            onPress={() => setMode('SWITCH')}
                        >
                            <Text style={[styles.modeText, mode === 'SWITCH' && styles.textWhite]}>Switch Farm</Text>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        style={[styles.modeButton, mode === 'NEW' && styles.modeActive]}
                        onPress={() => setMode('NEW')}
                        testID="mode-new-button"
                    >
                        <Text style={[styles.modeText, mode === 'NEW' && styles.textWhite]}>Start New</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.modeButton, mode === 'JOIN' && styles.modeActive]}
                        onPress={() => setMode('JOIN')}
                    >
                        <Text style={[styles.modeText, mode === 'JOIN' && styles.textWhite]}>Scan Invite</Text>
                    </TouchableOpacity>
                </View>

                {mode === 'SWITCH' && (
                    <View style={styles.farmList}>
                        <Text style={styles.joinTitle}>Select Active Farm</Text>
                        <Text style={styles.joinHint}>Choose which farm environment you want to work in today.</Text>
                        {farms.map(f => (
                            <TouchableOpacity
                                key={f.id}
                                style={styles.farmCard}
                                onPress={async () => {
                                    await switchFarm(f.id, f.name);
                                    onComplete();
                                }}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.farmCardName}>{f.name}</Text>
                                    <Text style={styles.farmCardRole}>{f.role}</Text>
                                </View>
                                <Text style={styles.chevron}>›</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {mode === 'NEW' && (
                    <>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Farm Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Miller Family Farms"
                                value={farmName}
                                onChangeText={setFarmName}
                                testID="farm-name-input"
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>State / Region</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Iowa"
                                value={state}
                                onChangeText={setState}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Measurement System</Text>
                            <View style={styles.toggleRow}>
                                <TouchableOpacity
                                    style={[styles.toggleButton, units === 'US' && styles.toggleActive]}
                                    onPress={() => setUnits('US')}
                                >
                                    <Text style={[styles.toggleText, units === 'US' && styles.textWhite]}>US (Acres/Gal)</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.toggleButton, units === 'Metric' && styles.toggleActive]}
                                    onPress={() => setUnits('Metric')}
                                >
                                    <Text style={[styles.toggleText, units === 'Metric' && styles.textWhite]}>Metric (Ha/Litre)</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.finishButton, (!farmName || !state) && styles.disabledButton]}
                            onPress={handleFinish}
                            disabled={!farmName || !state}
                            testID="start-farming-button"
                        >
                            <Text style={styles.finishButtonText}>Start Farming</Text>
                        </TouchableOpacity>
                    </>
                )}

                {mode === 'JOIN' && (
                    <View style={styles.joinContainer}>
                        <Text style={styles.joinTitle}>Connect to your Farm</Text>
                        <Text style={styles.joinHint}>Ask a farm administrator to show you their Sync QR from the Vault on their device or PC.</Text>

                        <TouchableOpacity
                            style={styles.scanButton}
                            onPress={async () => {
                                const { status } = await requestPermission();
                                if (status === 'granted') setShowScanner(true);
                                else showAlert('Permission Required', 'Camera access is needed to scan invite tokens.');
                            }}
                        >
                            <Text style={styles.scanButtonText}>📸 Scan QR Code</Text>
                        </TouchableOpacity>

                        <View style={styles.divider}>
                            <View style={styles.line} />
                            <Text style={styles.dividerText}>OR</Text>
                            <View style={styles.line} />
                        </View>

                        <View style={styles.manualGroup}>
                            <Text style={styles.label}>Enter Invitation Token</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Token from farm owner"
                                value={manualId}
                                onChangeText={setManualId}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            <TouchableOpacity
                                style={[styles.manualButton, !manualId && styles.disabledButton]}
                                onPress={() => handleScanJoin(manualId)}
                                disabled={!manualId || joiningManual}
                            >
                                <Text style={styles.manualButtonText}>{joiningManual ? 'Joining...' : 'Join with Token'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </ScrollView>

            <Modal visible={showScanner} animationType="slide">
                <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
                    <CameraView
                        style={StyleSheet.absoluteFill}
                        facing="back"
                        barcodeScannerSettings={{
                            barcodeTypes: ['qr'],
                        }}
                        onBarcodeScanned={(res) => handleScanJoin(res.data)}
                    />

                    <View style={styles.overlay}>
                        <View style={styles.unfocusedContainer}></View>
                        <View style={styles.focusedContainer}>
                            <View style={styles.focusedCornerTopLeft}></View>
                            <View style={styles.focusedCornerTopRight}></View>
                            <View style={styles.focusedCornerBottomLeft}></View>
                            <View style={styles.focusedCornerBottomRight}></View>
                        </View>
                        <View style={styles.unfocusedContainer}>
                            <Text style={styles.scannerHint}>Point camera at the QR code on your PC screen</Text>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.closeScanner} onPress={() => setShowScanner(false)}>
                        <Text style={styles.closeScannerText}>Cancel</Text>
                    </TouchableOpacity>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Theme.colors.background },
    content: { padding: Theme.spacing.xl },
    title: { ...Theme.typography.h1, marginBottom: Theme.spacing.xs },
    subtitle: { ...Theme.typography.body, color: Theme.colors.textSecondary, marginBottom: Theme.spacing.xl },
    inputGroup: { marginBottom: Theme.spacing.lg },
    label: { ...Theme.typography.caption, fontWeight: 'bold', marginBottom: Theme.spacing.xs, textTransform: 'uppercase', color: Theme.colors.textSecondary },
    input: { borderWidth: 1, borderColor: Theme.colors.border, padding: Theme.spacing.md, borderRadius: Theme.borderRadius.sm, fontSize: 18, backgroundColor: Theme.colors.surface },
    toggleRow: { flexDirection: 'row', gap: Theme.spacing.sm },
    toggleButton: { flex: 1, padding: Theme.spacing.md, borderRadius: Theme.borderRadius.sm, borderWidth: 1, borderColor: Theme.colors.border, alignItems: 'center' },
    toggleActive: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
    toggleText: { fontWeight: 'bold' },
    textWhite: { color: Theme.colors.white },
    finishButton: { backgroundColor: Theme.colors.primary, padding: Theme.spacing.lg, borderRadius: Theme.borderRadius.md, alignItems: 'center', marginTop: Theme.spacing.xl },
    disabledButton: { backgroundColor: Theme.colors.border },
    finishButtonText: { color: Theme.colors.white, fontSize: 18, fontWeight: 'bold' },
    modeToggle: { flexDirection: 'row', backgroundColor: Theme.colors.surface, borderRadius: Theme.borderRadius.md, marginBottom: Theme.spacing.xl, padding: 4 },
    modeButton: { flex: 1, padding: Theme.spacing.md, alignItems: 'center', borderRadius: Theme.borderRadius.sm },
    modeActive: { backgroundColor: Theme.colors.primary },
    modeText: { fontWeight: 'bold', color: Theme.colors.textSecondary },
    joinContainer: { alignItems: 'center', marginTop: Theme.spacing.lg, padding: Theme.spacing.xl, backgroundColor: Theme.colors.surface, borderRadius: Theme.borderRadius.lg, borderStyle: 'dashed', borderWidth: 2, borderColor: Theme.colors.border },
    joinTitle: { ...Theme.typography.h2, marginBottom: Theme.spacing.md },
    joinHint: { textAlign: 'center', ...Theme.typography.body, color: Theme.colors.textSecondary, marginBottom: Theme.spacing.xl },
    scanButton: { backgroundColor: Theme.colors.primary, paddingHorizontal: Theme.spacing.xl, paddingVertical: Theme.spacing.lg, borderRadius: Theme.borderRadius.md, width: '100%', alignItems: 'center' },
    scanButtonText: { color: 'white', fontWeight: 'bold', fontSize: 18 },
    divider: { flexDirection: 'row', alignItems: 'center', marginVertical: Theme.spacing.xl, width: '100%' },
    line: { flex: 1, height: 1, backgroundColor: Theme.colors.border },
    dividerText: { marginHorizontal: Theme.spacing.md, color: Theme.colors.textSecondary, fontWeight: 'bold' },
    manualGroup: { width: '100%' },
    manualButton: { backgroundColor: Theme.colors.secondary, padding: Theme.spacing.md, borderRadius: Theme.borderRadius.sm, alignItems: 'center', marginTop: Theme.spacing.md },
    manualButtonText: { color: 'white', fontWeight: 'bold' },
    farmList: { marginTop: Theme.spacing.lg },
    farmCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Theme.spacing.lg,
        backgroundColor: Theme.colors.surface,
        borderRadius: Theme.borderRadius.md,
        marginBottom: Theme.spacing.md,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        ...Theme.shadows.sm,
    },
    farmCardName: { ...Theme.typography.body, fontWeight: 'bold', color: Theme.colors.text },
    farmCardRole: { ...Theme.typography.caption, color: Theme.colors.primary, fontWeight: 'bold' },
    chevron: { fontSize: 24, color: Theme.colors.border, marginLeft: Theme.spacing.md },
    closeScanner: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 40, paddingVertical: 15, borderRadius: 30, borderWidth: 1, borderColor: 'white' },
    closeScannerText: { color: 'white', fontWeight: 'bold' },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
    unfocusedContainer: { flex: 1, width: '100%', backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    focusedContainer: { width: 250, height: 250, backgroundColor: 'transparent' },
    scannerHint: { color: 'white', fontWeight: 'bold', textAlign: 'center', padding: 20 },
    focusedCornerTopLeft: { position: 'absolute', top: 0, left: 0, width: 40, height: 40, borderTopWidth: 4, borderLeftWidth: 4, borderColor: Theme.colors.primary },
    focusedCornerTopRight: { position: 'absolute', top: 0, right: 0, width: 40, height: 40, borderTopWidth: 4, borderRightWidth: 4, borderColor: Theme.colors.primary },
    focusedCornerBottomLeft: { position: 'absolute', bottom: 0, left: 0, width: 40, height: 40, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: Theme.colors.primary },
    focusedCornerBottomRight: { position: 'absolute', bottom: 0, right: 0, width: 40, height: 40, borderBottomWidth: 4, borderRightWidth: 4, borderColor: Theme.colors.primary }
});
