import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Theme } from '../constants/Theme';
import { generateReport } from '../utils/ReportUtility';
import { useSpray } from '../hooks/useSpray';
import { useGrain } from '../hooks/useGrain';
import { usePlanting } from '../hooks/usePlanting';
import { useSettings } from '../hooks/useSettings';

export const ReportsScreen = () => {
    const [generating, setGenerating] = useState(false);
    const { sprayLogs } = useSpray();
    const { grainLogs } = useGrain();
    const { plantingLogs } = usePlanting();
    const { settings } = useSettings();

    const handleExport = async (type: 'SPRAY' | 'PLANTING' | 'GRAIN', format: 'PDF' | 'CSV') => {
        setGenerating(true);
        try {
            if (format === 'CSV') {
                Alert.alert('Info', 'CSV Export not yet implemented for these compliance items.');
                return;
            }

            if (type === 'SPRAY') {
                await generateReport({
                    farmName: settings?.farm_name || 'My Farm',
                    dateRange: 'All Time',
                    logs: sprayLogs,
                    type: 'EPA_SPRAY'
                });
            } else if (type === 'GRAIN') {
                // Simplified harvest report from operational logs
                await generateReport({
                    farmName: settings?.farm_name || 'My Farm',
                    dateRange: 'All Time',
                    logs: grainLogs.map(g => ({
                        fieldName: g.field_id || 'Unknown',
                        totalBushels: g.bushels_net,
                        sharePercentage: 1.0,
                        landlordBushels: 0
                    })),
                    type: 'LANDLORD_HARVEST'
                });
            } else if (type === 'PLANTING') {
                await generateReport({
                    farmName: settings?.farm_name || 'My Farm',
                    dateRange: 'All Time',
                    logs: plantingLogs.map(p => ({
                        start_time: p.start_time,
                        field_name: p.field_name || 'N/A',
                        product_name: `${p.brand || ''} ${p.variety_name || 'Seed'}`,
                        epa_number: 'N/A',
                        rate_per_acre: p.population,
                        unit: 'Seeds/Ac',
                        wind_speed: 0,
                        wind_dir: '-'
                    })),
                    type: 'EPA_SPRAY' // Reusing EPA layout for simplicity for now
                });
            } else {
                Alert.alert('Info', 'Report type not recognized.');
            }
            Alert.alert('Success', 'Report generated and ready to share.');
        } catch (error) {
            console.error('Report error:', error);
            Alert.alert('Error', 'Failed to generate report');
        } finally {
            setGenerating(false);
        }
    };

    const ReportCard = ({ title, type }: { title: string, type: 'SPRAY' | 'PLANTING' | 'GRAIN' }) => (
        <View style={styles.card}>
            <Text style={styles.cardTitle}>{title}</Text>
            <View style={styles.buttonRow}>
                <TouchableOpacity
                    style={[styles.button, styles.pdfButton]}
                    onPress={() => handleExport(type, 'PDF')}
                    disabled={generating}
                >
                    <Text style={styles.buttonText}>PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.button, styles.csvButton]}
                    onPress={() => handleExport(type, 'CSV')}
                    disabled={generating}
                >
                    <Text style={styles.buttonText}>CSV</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <Text style={styles.sectionTitle}>Operational Audits</Text>
                <ReportCard title="Spray Logs (Chemicals)" type="SPRAY" />
                <ReportCard title="Planting Logs (Seed)" type="PLANTING" />
                <ReportCard title="Grain Logs (Harvest)" type="GRAIN" />

                {generating && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color={Theme.colors.primary} />
                        <Text style={styles.loadingText}>Generating Report...</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Theme.colors.background },
    scrollContent: { padding: Theme.spacing.lg },
    sectionTitle: { ...Theme.typography.h2, color: Theme.colors.primary, marginBottom: Theme.spacing.lg },
    card: {
        backgroundColor: '#FFF',
        borderRadius: Theme.borderRadius.md,
        padding: Theme.spacing.lg,
        marginBottom: Theme.spacing.md,
        ...Theme.shadows.sm,
    },
    cardTitle: { ...Theme.typography.body, fontWeight: 'bold', marginBottom: Theme.spacing.md },
    buttonRow: { flexDirection: 'row', gap: Theme.spacing.md },
    button: {
        flex: 1,
        padding: Theme.spacing.md,
        borderRadius: Theme.borderRadius.sm,
        alignItems: 'center',
    },
    pdfButton: { backgroundColor: Theme.colors.primary },
    csvButton: { backgroundColor: Theme.colors.secondary },
    buttonText: { color: '#FFF', fontWeight: 'bold' },
    loadingOverlay: {
        marginTop: Theme.spacing.xl,
        alignItems: 'center',
    },
    loadingText: { marginTop: Theme.spacing.md, color: Theme.colors.textSecondary },
});
