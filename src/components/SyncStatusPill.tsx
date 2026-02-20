import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Animated, Easing } from 'react-native';
import { useSyncController } from '../sync/useSyncController';
import { Theme } from '../constants/Theme';

export const SyncStatusPill = () => {
    const { mode, pendingUploads, sync, lastError } = useSyncController();

    const getStatusColor = () => {
        switch (mode) {
            case 'SYNCED': return Theme.colors.success;
            case 'SYNCING': return Theme.colors.primary; // Blue/Primary for activity
            case 'OFFLINE': return Theme.colors.textSecondary;
            case 'ERROR': return Theme.colors.danger;
            default: return Theme.colors.textSecondary;
        }
    };

    const getStatusText = () => {
        switch (mode) {
            case 'SYNCED': return 'Saved';
            case 'SYNCING': return 'Syncing...';
            case 'OFFLINE': return 'Offline';
            case 'ERROR': return 'Error';
            default: return 'Local';
        }
    };

    const isSyncing = mode === 'SYNCING';

    return (
        <TouchableOpacity
            style={[styles.container, { borderColor: getStatusColor() + '40', backgroundColor: getStatusColor() + '15' }]}
            onPress={sync}
            activeOpacity={0.7}
        >
            {isSyncing ? (
                <ActivityIndicator size="small" color={Theme.colors.primary} style={styles.icon} />
            ) : (
                <View style={[styles.dot, { backgroundColor: getStatusColor() }]} />
            )}
            <Text style={[styles.text, { color: getStatusColor() }]}>{getStatusText()}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6
    },
    icon: {
        marginRight: 6,
        transform: [{ scale: 0.7 }]
    },
    text: {
        fontSize: 12,
        fontWeight: 'bold',
        textTransform: 'uppercase'
    }
});
