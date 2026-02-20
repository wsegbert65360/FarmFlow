import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { Theme } from '../../constants/Theme';

// --- Loading State ---
export const LoadingState = ({ message = 'Loading...' }: { message?: string }) => (
    <View style={styles.centered}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={styles.loadingText}>{message}</Text>
    </View>
);

// --- Empty State ---
interface EmptyStateProps {
    title: string;
    message: string;
    icon?: any; // Require syntax or uri
    actionLabel?: string;
    onAction?: () => void;
}

export const EmptyState = ({ title, message, icon, actionLabel, onAction }: EmptyStateProps) => (
    <View style={styles.centered}>
        {icon && <Image source={icon} style={styles.emptyIcon} resizeMode="contain" />}
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyMessage}>{message}</Text>
        {actionLabel && onAction && (
            <TouchableOpacity style={styles.actionButton} onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel}>
                <Text style={styles.actionButtonText}>{actionLabel}</Text>
            </TouchableOpacity>
        )}
    </View>
);

// --- Error State ---
interface ErrorStateProps {
    message: string;
    onRetry?: () => void;
}

export const ErrorState = ({ message, onRetry }: ErrorStateProps) => (
    <View style={styles.centered}>
        <Text style={styles.errorTitle}>Oops!</Text>
        <Text style={styles.errorMessage}>{message}</Text>
        {onRetry && (
            <TouchableOpacity style={styles.retryButton} onPress={onRetry} accessibilityRole="button" accessibilityLabel="Retry">
                <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
        )}
    </View>
);

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: Theme.spacing.xl,
        backgroundColor: Theme.colors.background
    },
    loadingText: {
        marginTop: Theme.spacing.md,
        color: Theme.colors.textSecondary,
        fontWeight: '500'
    },
    emptyIcon: {
        width: 120,
        height: 120,
        marginBottom: Theme.spacing.lg,
        opacity: 0.5
    },
    emptyTitle: {
        ...Theme.typography.h2,
        color: Theme.colors.text,
        marginBottom: Theme.spacing.sm,
        textAlign: 'center'
    },
    emptyMessage: {
        fontSize: 16,
        color: Theme.colors.textSecondary,
        textAlign: 'center',
        marginBottom: Theme.spacing.xl,
        lineHeight: 22
    },
    actionButton: {
        backgroundColor: Theme.colors.primary,
        paddingHorizontal: Theme.spacing.xl,
        paddingVertical: Theme.spacing.md,
        borderRadius: Theme.borderRadius.md,
        ...Theme.shadows.sm
    },
    actionButtonText: {
        color: Theme.colors.white,
        fontWeight: 'bold',
        fontSize: 16
    },
    errorTitle: {
        ...Theme.typography.h2,
        color: Theme.colors.danger,
        marginBottom: Theme.spacing.sm
    },
    errorMessage: {
        fontSize: 16,
        color: Theme.colors.textSecondary,
        textAlign: 'center',
        marginBottom: Theme.spacing.lg
    },
    retryButton: {
        paddingHorizontal: Theme.spacing.lg,
        paddingVertical: Theme.spacing.sm,
        borderWidth: 1,
        borderColor: Theme.colors.danger,
        borderRadius: Theme.borderRadius.md
    },
    retryText: {
        color: Theme.colors.danger,
        fontWeight: 'bold'
    }
});
