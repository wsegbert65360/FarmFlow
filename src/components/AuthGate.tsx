import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity, Platform } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { LoginScreen } from '../screens/LoginScreen';
import { Theme } from '../constants/Theme';

export const AuthGate = ({ children }: { children: React.ReactNode }) => {
    const { session, loading } = useAuth();

    const [showDiagnostics, setShowDiagnostics] = React.useState(false);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            if (loading) setShowDiagnostics(true);
        }, 8000);
        return () => clearTimeout(timer);
    }, [loading]);

    const syncInitRef = React.useRef<string | null>(null);

    React.useEffect(() => {
        if (session?.user && syncInitRef.current !== session.user.id) {
            console.log(`[AuthGate] Initializing SyncController for user: ${session.user.id}`);
            syncInitRef.current = session.user.id;
            const { syncController } = require('../sync/SyncController');
            syncController.init(session.user.id);
        }
    }, [session?.user?.id]);

    const [isSyncReady, setIsSyncReady] = React.useState(false);

    React.useEffect(() => {
        const { syncController } = require('../sync/SyncController');
        const unsubscribe = syncController.subscribe((state: any) => {
            setIsSyncReady(state.isHydrated);
        });
        return unsubscribe;
    }, []);

    if (loading || (!isSyncReady && session)) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Theme.colors.primary} />
                <Text style={styles.loadingText}>
                    {loading ? 'Verifying session...' : 'Syncing Farm Data...'}
                </Text>

                {showDiagnostics && (
                    <View style={styles.diagnosticContainer}>
                        <Text style={styles.diagnosticTitle}>Boot Diagnostics</Text>
                        <Text style={styles.diagnosticLine}>Auth Loading: {loading ? 'YES' : 'NO'}</Text>
                        <Text style={styles.diagnosticLine}>Session: {session ? 'PRESENT' : 'MISSING'}</Text>
                        <Text style={styles.diagnosticLine}>User ID: {session?.user?.id.substring(0, 8) || 'N/A'}</Text>
                        <Text style={styles.diagnosticLine}>Sync Ready: {isSyncReady ? 'YES' : 'NO'}</Text>
                        <Text style={styles.diagnosticLine}>Platform: {Platform.OS}</Text>
                    </View>
                )}

                <TouchableOpacity
                    style={styles.resetButton}
                    activeOpacity={0.7}
                    onPress={async () => {
                        console.log('[AuthGate] User requested session reset');
                        const { supabase } = require('../supabase/client');
                        await supabase.auth.signOut();
                        if (Platform.OS === 'web') {
                            localStorage.clear();
                            sessionStorage.clear();
                            window.location.reload();
                        }
                    }}
                >
                    <View style={styles.resetButtonInner}>
                        <Text style={styles.resetButtonText}>Stuck? Clear Session</Text>
                    </View>
                </TouchableOpacity>
            </View>
        );
    }

    if (!session) {
        return <LoginScreen />;
    }

    return <>{children}</>;
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Theme.colors.background
    },
    loadingText: {
        marginTop: 15,
        ...Theme.typography.caption,
        color: Theme.colors.textSecondary,
        marginBottom: 20
    },
    diagnosticContainer: {
        backgroundColor: '#F5F5F5',
        padding: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#DDD',
        width: '80%',
        marginTop: 20
    },
    diagnosticTitle: {
        fontWeight: 'bold',
        fontSize: 14,
        marginBottom: 8,
        color: '#333'
    },
    diagnosticLine: {
        fontSize: 12,
        color: '#666',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        marginBottom: 4
    },
    resetButton: {
        marginTop: 40,
        zIndex: 9999,
    },
    resetButtonInner: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: Theme.borderRadius.md,
        backgroundColor: Theme.colors.surface,
        borderWidth: 1,
        borderColor: Theme.colors.primary,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    resetButtonText: {
        color: Theme.colors.primary,
        fontWeight: 'bold',
        textAlign: 'center',
    }
});
