import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSyncController } from '../sync/useSyncController';
import { Theme } from '../constants/Theme';

export const SyncIndicator = () => {
    const { mode, pendingUploads, sync, lastError } = useSyncController();

    const getStatusColor = () => {
        switch (mode) {
            case 'SYNCED': return Theme.colors.success;
            case 'SYNCING': return Theme.colors.warning;
            case 'OFFLINE': return Theme.colors.textSecondary;
            case 'ERROR': return Theme.colors.danger;
            default: return Theme.colors.textSecondary;
        }
    };

    const getStatusText = () => {
        switch (mode) {
            case 'SYNCED': return 'SYNCED ✓';
            case 'SYNCING': return 'SYNCING...';
            case 'OFFLINE': return 'OFFLINE (SAVED LOCALLY)';
            case 'ERROR': return 'SYNC ERROR (TAP TO RETRY)';
            default: return 'LOCAL ONLY';
        }
    };

    return (
        <TouchableOpacity style={styles.container} onPress={sync}>
            <View style={[styles.dot, { backgroundColor: getStatusColor() }]} />
            <Text style={styles.text}>{getStatusText()}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6
    },
    text: {
        ...Theme.typography.caption,
        color: Theme.colors.white,
        fontWeight: 'bold'
    }
});
