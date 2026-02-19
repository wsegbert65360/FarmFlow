import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { showAlert } from '../utils/AlertUtility';
import { Theme } from '../constants/Theme';
import { connector } from '../db/SupabaseConnector';

export const LoginScreen = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async () => {
        if (!email) return showAlert('Email Required', 'Please enter your email address.');

        setLoading(true);
        try {
            await connector.ensureInitialized();
            const { error } = await connector.client.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: Platform.OS === 'web' ? window.location.origin : undefined,
                },
            });

            if (error) throw error;
            showAlert('Magic Link Sent', `Check ${email} for your login link!`);
            setSent(true);
            setError(null);
        } catch (error: any) {
            console.error('Login failed:', error);
            setError(error.message || 'An unexpected error occurred.');
            showAlert('Login Failed', error.message || 'An unexpected error occurred.');
        } finally {
            setLoading(false);
        }
    };

    if (sent) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.content}>
                    <Text style={styles.emoji}>Check your email! 📧</Text>
                    <Text style={styles.title}>Magic Link Sent</Text>
                    <Text style={styles.subtitle}>
                        We've sent a secure login link to <Text style={{ fontWeight: 'bold' }}>{email}</Text>.
                        Click the link in your email to sign in to FarmFlow.
                    </Text>
                    <TouchableOpacity style={styles.secondaryButton} onPress={() => setSent(false)}>
                        <Text style={styles.secondaryButtonText}>Try a different email</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={styles.content}>
                    <Image
                        source={require('../../assets/icon.png')}
                        style={styles.logo}
                    />
                    <Text style={styles.title}>FarmFlow</Text>
                    <Text style={styles.subtitle}>The Anti-ERP for modern farming.</Text>

                    {error && (
                        <View style={styles.errorContainer}>
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Email Address</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="farmer@example.com"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            editable={!loading}
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.loginButton, loading && { opacity: 0.7 }]}
                        onPress={handleLogin}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <Text style={styles.loginButtonText}>Send Magic Link</Text>
                        )}
                    </TouchableOpacity>

                    <Text style={styles.footerText}>
                        No password needed. We'll email you a secure link to sign in instantly.
                    </Text>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Theme.colors.background,
    },
    keyboardView: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: Theme.spacing.xl * 1.5,
    },
    logo: {
        width: 80,
        height: 80,
        borderRadius: 20,
        marginBottom: Theme.spacing.lg,
        alignSelf: 'center',
    },
    emoji: {
        fontSize: 48,
        textAlign: 'center',
        marginBottom: Theme.spacing.lg,
    },
    title: {
        ...Theme.typography.h1,
        fontSize: 32,
        textAlign: 'center',
        marginBottom: Theme.spacing.xs,
    },
    subtitle: {
        ...Theme.typography.body,
        textAlign: 'center',
        color: Theme.colors.textSecondary,
        marginBottom: Theme.spacing.xl * 2,
    },
    inputContainer: {
        marginBottom: Theme.spacing.xl,
    },
    label: {
        ...Theme.typography.caption,
        fontWeight: 'bold',
        marginBottom: Theme.spacing.xs,
        color: Theme.colors.textSecondary,
    },
    input: {
        backgroundColor: Theme.colors.white,
        borderWidth: 1,
        borderColor: Theme.colors.border,
        borderRadius: Theme.borderRadius.md,
        padding: Theme.spacing.lg,
        fontSize: 18,
    },
    loginButton: {
        backgroundColor: Theme.colors.primary,
        padding: Theme.spacing.lg,
        borderRadius: Theme.borderRadius.md,
        alignItems: 'center',
        shadowColor: Theme.colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    loginButtonText: {
        color: Theme.colors.white,
        fontSize: 18,
        fontWeight: 'bold',
    },
    secondaryButton: {
        marginTop: Theme.spacing.xl,
        padding: Theme.spacing.md,
    },
    secondaryButtonText: {
        color: Theme.colors.primary,
        textAlign: 'center',
        fontWeight: 'bold',
    },
    footerText: {
        ...Theme.typography.caption,
        textAlign: 'center',
        color: Theme.colors.textSecondary,
        marginTop: Theme.spacing.xl,
        lineHeight: 20,
    },
    errorContainer: {
        backgroundColor: '#FFEBEE',
        padding: Theme.spacing.md,
        borderRadius: Theme.borderRadius.md,
        marginBottom: Theme.spacing.lg,
        borderWidth: 1,
        borderColor: '#FFCDD2',
    },
    errorText: {
        color: Theme.colors.danger,
        textAlign: 'center',
        fontWeight: 'bold',
    },
});
