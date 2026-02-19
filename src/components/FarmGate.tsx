export const FarmGate = ({ children }: { children: React.ReactNode }) => {
    const { settings, loading } = useSettings();
    const { session } = useAuth();

    React.useEffect(() => {
        if (settings?.onboarding_completed && session?.user) {
            const { syncController } = require('../sync/SyncController');
            syncController.init(session.user.id);
        }
    }, [settings?.onboarding_completed, session?.user]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Theme.colors.primary} />
                <Text style={styles.loadingText}>Loading Farm Settings...</Text>
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
        backgroundColor: Theme.colors.background
    },
    loadingText: {
        marginTop: Theme.spacing.md,
        ...Theme.typography.body,
        color: Theme.colors.textSecondary
    }
});
