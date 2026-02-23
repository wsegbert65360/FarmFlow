import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Field } from '../hooks/useFields';

interface FieldCardProps {
    field: Field;
    onAction: (type: 'PLANTING' | 'SPRAY' | 'HARVEST' | 'HARVEST_TO_TOWN') => void;
}

export const FieldCard: React.FC<FieldCardProps> = ({ field, onAction }) => {
    const formatDate = (dateStr?: string) => {
        if (!dateStr) return 'Not set';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <View
            className="bg-white rounded-3xl mb-4 border border-gray-100 shadow-sm overflow-hidden"
            style={{ backgroundColor: 'white', borderRadius: 24, marginBottom: 16, borderWidth: 1, borderColor: '#f3f4f6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2, overflow: 'hidden' }}
        >
            {/* Header */}
            <View
                className="flex-row justify-between items-center px-6 py-4 border-b border-gray-50"
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f9fafb' }}
            >
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#111827' }}>{field.name}</Text>
                {field.sync_status === 'SYNCED' ? (
                    <View
                        className="flex-row items-center bg-green-50 px-2.5 py-1 rounded-full border border-green-100"
                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0fdf4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, borderWidth: 1, borderColor: '#dcfce7' }}
                    >
                        <Text style={{ color: '#15803d', fontSize: 10, fontWeight: 'bold' }}>✅ SYNCED</Text>
                    </View>
                ) : (
                    <TouchableOpacity
                        className="flex-row items-center bg-orange-50 px-2.5 py-1 rounded-full border border-orange-100"
                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff7ed', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, borderWidth: 1, borderColor: '#ffedd5', minHeight: 32 }}
                        onPress={() => console.log('[Sync] Triggering manual sync from FieldCard...')}
                        testID={`field-sync-pill-${field.id}`}
                    >
                        <Text style={{ color: '#c2410c', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>⏳ Pending</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Metadata Grid */}
            <View className="p-6 flex-row flex-wrap" style={{ padding: 24, flexDirection: 'row', flexWrap: 'wrap' }}>
                <View style={{ width: '50%', marginBottom: 16 }}>
                    <Text style={{ color: '#9ca3af', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Acres</Text>
                    <Text style={{ color: '#111827', fontSize: 18, fontWeight: 'bold' }}>{field.acreage}</Text>
                </View>
                <View style={{ width: '50%', marginBottom: 16 }}>
                    <Text style={{ color: '#9ca3af', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Crop</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={{ color: '#111827', fontSize: 18, fontWeight: 'bold' }}>{field.crop || '--'}</Text>
                    </View>
                </View>
                <View style={{ width: '50%' }}>
                    <Text style={{ color: '#9ca3af', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Variety</Text>
                    <Text style={{ color: '#111827', fontSize: 18, fontWeight: 'bold' }}>{field.variety || '--'}</Text>
                </View>
                <View style={{ width: '50%' }}>
                    <Text style={{ color: '#9ca3af', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 }}>Planted</Text>
                    <Text style={{ color: '#111827', fontSize: 18, fontWeight: 'bold' }}>{formatDate(field.planted_date)}</Text>
                </View>
            </View>

            {/* Actions */}
            <View
                className="flex-row border-t border-gray-50"
                style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f9fafb' }}
            >
                <TouchableOpacity
                    className="flex-1 bg-blue-600 py-4 rounded-xl items-center shadow-sm active:bg-blue-700"
                    style={{ flex: 1, backgroundColor: '#2563eb', paddingVertical: 16, alignItems: 'center' }}
                    onPress={() => onAction('PLANTING')}
                    testID={`field-card-plant-${field.id}`}
                >
                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>PLANT</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    className="flex-1 bg-yellow-600 py-4 rounded-xl items-center shadow-sm active:bg-yellow-700"
                    style={{ flex: 1, backgroundColor: '#ca8a04', paddingVertical: 16, alignItems: 'center' }}
                    onPress={() => onAction('SPRAY')}
                    testID={`field-card-spray-${field.id}`}
                >
                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>SPRAY</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    className="flex-1 bg-orange-600 py-4 rounded-xl items-center shadow-sm active:bg-orange-700"
                    style={{ flex: 1, backgroundColor: '#ea580c', paddingVertical: 16, alignItems: 'center' }}
                    onPress={() => onAction('HARVEST_TO_TOWN')}
                    testID={`field-card-harvest-${field.id}`}
                >
                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>HARVEST</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};
