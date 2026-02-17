import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Alert, Modal } from 'react-native';
import { Theme } from '../constants/Theme';
import { useSettings } from '../hooks/useSettings';
import { CameraView, useCameraPermissions } from 'expo-camera';

export const OnboardingScreen = ({ onComplete }: { onComplete: () => void }) => {
    const { saveSettings } = useSettings();
    const [farmName, setFarmName] = useState('');
    const [state, setState] = useState('');
    const [units, setUnits] = useState<'US' | 'Metric'>('US');
    const [mode, setMode] = useState<'NEW' | 'JOIN'>('NEW');
    const [showScanner, setShowScanner] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    const handleFinish = async () => {
        if (mode === 'NEW') {
            if (!farmName || !state) return;
            try {
                await saveSettings({
                    farm_name: farmName,
                    state: state,
                    units: units,
                    onboarding_completed: true,
                });
                onComplete();
            } catch (error) {
                Alert.alert('Error', 'Failed to save settings. Please try again.');
            }
        }
    };

    const handleScanJoin = async (data: string) => {
        try {
            const parsed = JSON.parse(data);
            if (parsed.k && parsed.t && parsed.f) {
                await saveSettings({
                    supabase_anon_key: parsed.k,
                    farm_join_token: parsed.t,
                    farm_id: parsed.f,
                    farm_name: parsed.n || 'Joined Farm',
                    onboarding_completed: true
                });
                setShowScanner(false);
                onComplete();
                Alert.alert('Success', 'Joined farm successfully!');
            } else {
                Alert.alert('Invalid QR', 'This QR code does not contain valid farm invitation data.');
            }
        } catch (e) {
            Alert.alert('Scan Error', 'Could not parse invite token.');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>Welcome to FarmFlow</Text>
                <Text style={styles.subtitle}>The simple, secure Anti-ERP for modern farms.</Text>

                <View style={styles.modeToggle}>
                    <TouchableOpacity
                        style={[styles.modeButton, mode === 'NEW' && styles.modeActive]}
                        onPress={() => setMode('NEW')}
                    >
                        <Text style={[styles.modeText, mode === 'NEW' && styles.textWhite]}>Start New Farm</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.modeButton, mode === 'JOIN' && styles.modeActive]}
                        onPress={() => setMode('JOIN')}
                    >
                        <Text style={[styles.modeText, mode === 'JOIN' && styles.textWhite]}>Join Existing</Text>
                    </TouchableOpacity>
                </View>

                {mode === 'NEW' ? (
                    <>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Farm Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Miller Family Farms"
                                value={farmName}
                                onChangeText={setFarmName}
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
                        >
                            <Text style={styles.finishButtonText}>Start Farming</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <View style={styles.joinContainer}>
                        <Text style={styles.joinHint}>Ask a farm administrator to show you their Invite Token or Sync QR from the Vault settings.</Text>
                        <TouchableOpacity
                            style={styles.scanButton}
                            onPress={async () => {
                                const { status } = await requestPermission();
                                if (status === 'granted') setShowScanner(true);
                                else Alert.alert('Permission Required', 'Camera access is needed to scan invite tokens.');
                            }}
                        >
                            <Text style={styles.scanButtonText}>Scan Visit Invitation</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>

            <Modal visible={showScanner} animationType="slide">
                <SafeAreaView style={{ flex: 1, backgroundColor: 'black' }}>
                    <CameraView
                        style={StyleSheet.absoluteFill}
                        onBarcodeScanned={(res) => handleScanJoin(res.data)}
                    />
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
    joinContainer: { alignItems: 'center', marginTop: Theme.spacing.xl, padding: Theme.spacing.xl, backgroundColor: Theme.colors.surface, borderRadius: Theme.borderRadius.lg, borderStyle: 'dashed', borderWidth: 2, borderColor: Theme.colors.border },
    joinHint: { textAlign: 'center', ...Theme.typography.body, color: Theme.colors.textSecondary, marginBottom: Theme.spacing.xl },
    scanButton: { backgroundColor: Theme.colors.secondary, paddingHorizontal: Theme.spacing.xl, paddingVertical: Theme.spacing.lg, borderRadius: Theme.borderRadius.md },
    scanButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    closeScanner: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: Theme.colors.danger, paddingHorizontal: 40, paddingVertical: 15, borderRadius: 30 },
    closeScannerText: { color: 'white', fontWeight: 'bold' }
});
