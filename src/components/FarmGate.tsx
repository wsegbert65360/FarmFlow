import React from 'react';
import { StyleSheet, Text, View, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../context/AuthProvider';
import { Theme } from '../constants/Theme';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { useSyncController } from '../sync/useSyncController';

export const FarmGate = ({ children }: { children: React.ReactNode }) => {
    const { settings, loading } = useSettings();
    const { session } = useAuth();
    const sync = useSyncController();
    const [showDiagnostics, setShowDiagnostics] = React.useState(false);

    React.useEffect(() => {
        let timer: any;
        if (loading) {
            timer = setTimeout(() => {
                setShowDiagnostics(true);
            }, 8000); // Show diagnostics if stuck for 8s
        }
        return () => clearTimeout(timer);
    }, [loading]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Theme.colors.primary} />
                <Text style={styles.loadingText}>Loading Farm Settings...</Text>

                {showDiagnostics && (
                    <View style={styles.diagnosticBox}>
                        <Text style={styles.diagnosticTitle}>Connection Status</Text>
                        <Text style={styles.diagnosticLine}>Network: {sync.isConnected ? 'Online' : 'Offline'}</Text>
                        <Text style={styles.diagnosticLine}>Sync Mode: {sync.mode}</Text>
                        <Text style={styles.diagnosticLine}>Auth: {session ? 'LoggedIn' : 'NoSession'}</Text>

                        <TouchableOpacity
                            style={[styles.retryButton, { backgroundColor: Theme.colors.primary }]}
                            onPress={() => window.location.reload()}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.retryButtonText}>Refresh Application</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.retryButton, { marginTop: 12, backgroundColor: Theme.colors.danger }]}
                            onPress={async () => {
                                console.log('[FarmGate] User requested full reset');
                                const { supabase } = require('../supabase/client');
                                await supabase.auth.signOut();
                                if (typeof window !== 'undefined') {
                                    localStorage.clear();
                                    sessionStorage.clear();
                                    window.location.reload();
                                }
                            }}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.retryButtonText}>Full Reset (Sign Out)</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    }

    // Logic from App.tsx: If settings exist but onboarding not completed, or no settings
    // Treating `!settings?.onboarding_completed` as "No Active Farm / Needs Setup"
    if (!settings?.onboarding_completed) {
        return <OnboardingScreen onComplete={() => { /* Reload settings or handled by useSettings live query */ }} />;
    }

    return <>{children}</>;
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Theme.colors.background,
        padding: 20
    },
    loadingText: {
        marginTop: Theme.spacing.md,
        ...Theme.typography.body,
        color: Theme.colors.textSecondary
    },
    diagnosticBox: {
        marginTop: 40,
        padding: 20,
        backgroundColor: Theme.colors.surface,
        borderRadius: Theme.borderRadius.md,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        width: '100%',
        maxWidth: 400
    },
    diagnosticTitle: {
        ...Theme.typography.h3,
        marginBottom: 10,
        color: Theme.colors.text
    },
    diagnosticLine: {
        ...Theme.typography.caption,
        marginBottom: 5,
        color: Theme.colors.textSecondary
    },
    retryButton: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: Theme.borderRadius.md,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    retryButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold'
    }
});
