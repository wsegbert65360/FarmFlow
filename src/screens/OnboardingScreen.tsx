import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { Theme } from '../constants/Theme';
import { useSettings } from '../hooks/useSettings';

export const OnboardingScreen = ({ onComplete }: { onComplete: () => void }) => {
    const { saveSettings } = useSettings();
    const [farmName, setFarmName] = useState('');
    const [state, setState] = useState('');
    const [units, setUnits] = useState<'US' | 'Metric'>('US');

    const handleFinish = async () => {
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
            alert('Failed to save settings. Please try again.');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.title}>Welcome to FarmFlow</Text>
                <Text style={styles.subtitle}>Setup your farm to get started.</Text>

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
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Theme.colors.background,
    },
    content: {
        padding: Theme.spacing.xl,
    },
    title: {
        ...Theme.typography.h1,
        marginBottom: Theme.spacing.xs,
    },
    subtitle: {
        ...Theme.typography.body,
        color: Theme.colors.textSecondary,
        marginBottom: Theme.spacing.xl,
    },
    inputGroup: {
        marginBottom: Theme.spacing.lg,
    },
    label: {
        ...Theme.typography.caption,
        fontWeight: 'bold',
        marginBottom: Theme.spacing.xs,
        textTransform: 'uppercase',
        color: Theme.colors.textSecondary,
    },
    input: {
        borderWidth: 1,
        borderColor: Theme.colors.border,
        padding: Theme.spacing.md,
        borderRadius: Theme.borderRadius.sm,
        fontSize: 18,
        backgroundColor: Theme.colors.surface,
    },
    toggleRow: {
        flexDirection: 'row',
        gap: Theme.spacing.sm,
    },
    toggleButton: {
        flex: 1,
        padding: Theme.spacing.md,
        borderRadius: Theme.borderRadius.sm,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        alignItems: 'center',
    },
    toggleActive: {
        backgroundColor: Theme.colors.primary,
        borderColor: Theme.colors.primary,
    },
    toggleText: {
        fontWeight: 'bold',
    },
    textWhite: {
        color: Theme.colors.white,
    },
    finishButton: {
        backgroundColor: Theme.colors.primary,
        padding: Theme.spacing.lg,
        borderRadius: Theme.borderRadius.md,
        alignItems: 'center',
        marginTop: Theme.spacing.xl,
    },
    disabledButton: {
        backgroundColor: Theme.colors.border,
    },
    finishButtonText: {
        color: Theme.colors.white,
        fontSize: 18,
        fontWeight: 'bold',
    },
});
