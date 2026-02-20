import React from 'react';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Theme } from '../../constants/Theme';

interface VaultCardProps {
    title: string;
    subtitle: string;
    onPress: () => void;
    numColumns: number;
    accentColor?: string;
}

export const VaultCard: React.FC<VaultCardProps> = ({ title, subtitle, onPress, numColumns, accentColor }) => {
    const { width } = useWindowDimensions();
    const isDesktop = width > 768;

    return (
        <TouchableOpacity
            style={[
                styles.card,
                isDesktop && { flex: 1 / numColumns - 0.05 },
                accentColor ? { borderLeftWidth: 4, borderLeftColor: accentColor } : null
            ]}
            onPress={onPress}
            accessibilityLabel={`${title}, ${subtitle}`}
            accessibilityRole="button"
        >
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardSub}>{subtitle}</Text>
            {accentColor && (
                <Text style={[styles.cardSub, { color: accentColor, fontWeight: 'bold', marginTop: 8 }]}>PDF EXPORT 📄</Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: Theme.colors.white,
        padding: Theme.spacing.lg,
        borderRadius: Theme.borderRadius.md,
        marginBottom: Theme.spacing.md,
        ...Theme.shadows.sm
    },
    cardTitle: { ...Theme.typography.body, fontWeight: 'bold' },
    cardSub: { ...Theme.typography.caption, color: Theme.colors.textSecondary, marginTop: 4 },
});
