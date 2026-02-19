import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { Theme } from '../constants/Theme';
import { useAgreements, RentAgreement } from '../hooks/useAgreements';
import { useLandlords } from '../hooks/useLandlords';
import { useFields } from '../hooks/useFields';
import { useLandlordReports } from '../hooks/useLandlordReports';
import { generateReport } from '../utils/ReportUtility';
import { useDatabase } from '../hooks/useDatabase';
import { useSettings } from '../hooks/useSettings';

interface LandlordSummaryProps {
    visible: boolean;
    onClose: () => void;
    cropYear: number;
}

export const LandlordSummaryModal = ({ visible, onClose, cropYear }: LandlordSummaryProps) => {
    const { agreements, loading: agreementsLoading, getAgreementFields } = useAgreements(cropYear);
    const { landlords } = useLandlords();
    const { fields } = useFields();
    const { getLandlordSeasonSummary } = useLandlordReports();
    const { farmId } = useDatabase();
    const { settings } = useSettings();
    const [summaryData, setSummaryData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [generatingId, setGeneratingId] = useState<string | null>(null);

    useEffect(() => {
        if (!visible || agreementsLoading) return;

        const loadData = async () => {
            setLoading(true);
            const data = await Promise.all(agreements.map(async (ag: RentAgreement) => {
                const landlord = landlords.find(l => l.id === ag.landlord_id);
                const linkedFieldIds = await getAgreementFields(ag.id);
                const linkedFields = fields.filter(f => linkedFieldIds.includes(f.id));
                const totalAcreage = linkedFields.reduce((sum, f) => sum + (f.acreage || 0), 0);

                return {
                    ...ag,
                    landlordName: landlord?.name || 'Unknown',
                    totalAcreage,
                    linkedFields
                };
            }));
            setSummaryData(data);
            setLoading(false);
        };

        loadData();
    }, [visible, agreements, agreementsLoading, landlords, fields]);

    const handleDownloadPacket = async (landlordId: string, landlordName: string) => {
        try {
            setGeneratingId(landlordId);
            const settlementData = await getLandlordSeasonSummary(landlordId, cropYear);

            await generateReport({
                type: 'LANDLORD_PACKET',
                farmName: settings?.farm_name || `Farm ${farmId?.substring(0, 5)}`,
                landlordName: landlordName,
                dateRange: cropYear.toString(),
                logs: settlementData
            });
        } catch (error) {
            console.error('Failed to generate packet', error);
        } finally {
            setGeneratingId(null);
        }
    };

    const renderItem = ({ item }: { item: any }) => (
        <View style={styles.summaryCard}>
            <View style={styles.cardHeader}>
                <View>
                    <Text style={styles.landlordName}>{item.landlordName}</Text>
                    <View style={[styles.badge, { backgroundColor: item.rent_type === 'CASH' ? Theme.colors.primary : Theme.colors.warning, alignSelf: 'flex-start', marginTop: 4 }]}>
                        <Text style={styles.badgeText}>{item.rent_type}</Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.downloadButton}
                    onPress={() => handleDownloadPacket(item.landlord_id, item.landlordName)}
                    disabled={generatingId === item.landlord_id}
                >
                    {generatingId === item.landlord_id ? (
                        <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                        <Text style={styles.downloadButtonText}>Landlord Packet 📄</Text>
                    )}
                </TouchableOpacity>
            </View>

            <View style={styles.cardContent}>
                {item.rent_type === 'CASH' ? (
                    <View>
                        <Text style={styles.mainStat}>
                            ${(item.totalAcreage * (item.cash_rent_per_acre || 0)).toFixed(2)}
                        </Text>
                        <Text style={styles.subStat}>
                            {item.totalAcreage} acres @ ${item.cash_rent_per_acre}/ac
                        </Text>
                    </View>
                ) : (
                    <View>
                        <Text style={styles.mainStat}>
                            {(item.landlord_share_pct * 100).toFixed(0)}% Share
                        </Text>
                        <Text style={styles.subStat}>
                            {item.totalAcreage} total acres covered
                        </Text>
                    </View>
                )}
            </View>

            <View style={styles.fieldList}>
                <Text style={styles.fieldListTitle}>Covered Fields:</Text>
                <Text style={styles.fieldNames}>
                    {item.linkedFields.map((f: any) => `${f.name} (${f.acreage}ac)`).join(', ') || 'None'}
                </Text>
            </View>
        </View>
    );

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View style={styles.overlay}>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{cropYear} Landlord Summary</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Text style={styles.closeText}>Close</Text>
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <ActivityIndicator style={{ marginTop: 50 }} color={Theme.colors.primary} />
                    ) : (
                        <FlatList
                            data={summaryData}
                            renderItem={renderItem}
                            keyExtractor={item => item.id}
                            contentContainerStyle={styles.list}
                            ListEmptyComponent={
                                <Text style={styles.emptyText}>No agreements for {cropYear}</Text>
                            }
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    content: { backgroundColor: '#FFF', borderRadius: 16, height: '80%', paddingBottom: 20 },
    header: { padding: 20, borderBottomWidth: 1, borderBottomColor: Theme.colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { ...Theme.typography.h2 },
    closeText: { color: Theme.colors.primary, fontWeight: 'bold' },
    list: { padding: 16 },
    summaryCard: { backgroundColor: Theme.colors.surface, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: Theme.colors.border },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    landlordName: { ...Theme.typography.body, fontWeight: 'bold', fontSize: 18 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    badgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
    cardContent: { marginBottom: 12 },
    mainStat: { fontSize: 24, fontWeight: 'bold', color: Theme.colors.text },
    subStat: { ...Theme.typography.caption, color: Theme.colors.textSecondary },
    fieldList: { borderTopWidth: 1, borderTopColor: Theme.colors.border, paddingTop: 8 },
    fieldListTitle: { fontSize: 12, fontWeight: '600', color: Theme.colors.textSecondary, marginBottom: 4 },
    fieldNames: { fontSize: 13, color: Theme.colors.text },
    emptyText: { textAlign: 'center', marginTop: 100, color: Theme.colors.textSecondary },
    downloadButton: { backgroundColor: Theme.colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center' },
    downloadButtonText: { color: '#FFF', fontSize: 13, fontWeight: 'bold' }
});
