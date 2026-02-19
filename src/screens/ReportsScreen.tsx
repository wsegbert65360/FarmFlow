import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Platform } from 'react-native';
import { showAlert } from '../utils/AlertUtility';
import { Theme } from '../constants/Theme';
import { generateReport } from '../utils/ReportUtility';
import { exportToCSV } from '../utils/ExportUtility';
import { useSpray } from '../hooks/useSpray';
import { useGrain } from '../hooks/useGrain';
import { usePlanting } from '../hooks/usePlanting';
import { useSettings } from '../hooks/useSettings';
import { LandlordSummaryModal } from '../components/LandlordSummaryModal';

export const ReportsScreen = () => {
    const [generating, setGenerating] = useState(false);
    const [landlordSummaryVisible, setLandlordSummaryVisible] = useState(false);
    const { sprayLogs } = useSpray();
    const { grainLogs } = useGrain();
    const { plantingLogs } = usePlanting();
    const { settings } = useSettings();

    const handleExport = async (type: 'SPRAY' | 'PLANTING' | 'GRAIN' | 'SEASON', format: 'PDF' | 'CSV') => {
        setGenerating(true);
        try {
            if (format === 'CSV') {
                if (type === 'SPRAY') {
                    exportToCSV(sprayLogs, `spray_logs_${new Date().toISOString().split('T')[0]}`);
                } else if (type === 'PLANTING') {
                    exportToCSV(plantingLogs, `planting_logs_${new Date().toISOString().split('T')[0]}`);
                } else if (type === 'GRAIN') {
                    exportToCSV(grainLogs, `harvest_logs_${new Date().toISOString().split('T')[0]}`);
                } else if (type === 'SEASON') {
                    const aggregated = [
                        ...plantingLogs.map(p => ({ ...p, type: 'PLANTING' })),
                        ...sprayLogs.map(s => ({ ...s, type: 'SPRAYING' })),
                        ...grainLogs.map(g => ({ ...g, type: 'HARVEST' }))
                    ];
                    exportToCSV(aggregated, `full_season_${new Date().getFullYear()}`);
                }
                setGenerating(false);
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
                        product_name: `${p.brand || ''} ${p.variety_name || 'Seed'} `,
                        epa_number: 'N/A',
                        rate_per_acre: p.population,
                        unit: 'Seeds/Ac',
                        wind_speed: 0,
                        wind_dir: '-'
                    })),
                    type: 'EPA_SPRAY'
                });
            } else if (type === 'SEASON') {
                // AGGREGATE ALL DATA
                const aggregatedLogs = [
                    ...plantingLogs.map(p => ({ ...p, reportType: 'PLANTING', product_name: `${p.brand || ''} ${p.variety_name || 'Seed'} `, rate_per_acre: p.population, unit: 'Seeds/Ac' })),
                    ...sprayLogs.map(s => ({ ...s, reportType: 'SPRAYING' })),
                    ...grainLogs.map(g => ({ ...g, reportType: 'HARVEST', fieldName: g.field_id || 'Unknown', totalBushels: g.bushels_net, sharePercentage: 1.0, landlordBushels: 0 }))
                ];

                await generateReport({
                    farmName: settings?.farm_name || 'My Farm',
                    dateRange: new Date().getFullYear().toString(),
                    logs: aggregatedLogs,
                    type: 'SEASON_PACKET'
                });
            }
            showAlert('Success', 'Report generated and ready to share.');
        } catch (error) {
            console.error('Report error:', error);
            showAlert('Error', 'Failed to generate report');
        } finally {
            setGenerating(false);
        }
    };

    const ReportCard = ({ title, type, subtitle }: { title: string, type: 'SPRAY' | 'PLANTING' | 'GRAIN' | 'SEASON', subtitle?: string }) => (
        <View style={styles.card}>
            <View>
                <Text style={styles.cardTitle}>{title}</Text>
                {subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
            </View>
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
                <Text style={styles.sectionTitle}>Season Preparation</Text>
                <ReportCard
                    title="Season Packet (Master Report)"
                    subtitle="Aggregated Seed, Chem, and Harvest logs for landlords."
                    type="SEASON"
                />

                <Text style={[styles.sectionTitle, { marginTop: Theme.spacing.xl }]}>Operational Audits</Text>
                <ReportCard title="Spray Logs (Chemicals)" type="SPRAY" />
                <ReportCard title="Planting Logs (Seed)" type="PLANTING" />
                <ReportCard title="Grain Logs (Harvest)" type="GRAIN" />

                <Text style={[styles.sectionTitle, { marginTop: Theme.spacing.xl }]}>Landlord Reporting</Text>
                <View style={styles.card}>
                    <View>
                        <Text style={styles.cardTitle}>Landlord Summary (New)</Text>
                        <Text style={styles.cardSubtitle}>Overview of Cash vs Share rent by field.</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.button, styles.pdfButton]}
                        onPress={() => setLandlordSummaryVisible(true)}
                    >
                        <Text style={styles.buttonText}>View Summary</Text>
                    </TouchableOpacity>
                </View>

                {generating && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color={Theme.colors.primary} />
                        <Text style={styles.loadingText}>Generating Report...</Text>
                    </View>
                )}
            </ScrollView>

            <LandlordSummaryModal
                visible={landlordSummaryVisible}
                onClose={() => setLandlordSummaryVisible(false)}
                cropYear={new Date().getFullYear()}
            />
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
    cardTitle: { ...Theme.typography.body, fontWeight: 'bold', marginBottom: 4 },
    cardSubtitle: { ...Theme.typography.caption, color: Theme.colors.textSecondary, marginBottom: Theme.spacing.md },
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
