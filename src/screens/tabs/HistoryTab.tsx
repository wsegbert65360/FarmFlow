import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Theme } from '../../constants/Theme';

export const HistoryTab = () => {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>History</Text>
            <View style={styles.placeholder}>
                <Text style={styles.text}>Unified Feed Coming Soon.</Text>
                <Text style={styles.subtext}>Filter by Field, Type, Crop, Date</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: Theme.spacing.lg, backgroundColor: Theme.colors.background },
    title: { ...Theme.typography.h1, marginBottom: Theme.spacing.lg },
    placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    text: { ...Theme.typography.h2, color: Theme.colors.textSecondary },
    subtext: { marginTop: 8, color: Theme.colors.textSecondary }
});
