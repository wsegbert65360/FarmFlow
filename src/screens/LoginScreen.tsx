import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { showAlert } from '../utils/AlertUtility';
import { Theme } from '../constants/Theme';
import { connector } from '../db/SupabaseConnector';
import { supabase } from '../supabase/client';

export const LoginScreen = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cooldown, setCooldown] = useState(0);

    // Handle cooldown timer
    React.useEffect(() => {
        let timer: NodeJS.Timeout;
        if (cooldown > 0) {
            timer = setInterval(() => {
                setCooldown((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [cooldown]);

    const handleLogin = async () => {
        if (!email) return showAlert('Email Required', 'Please enter your email address.');

        console.log('[LoginScreen] Attempting magic link login for:', email);
        setLoading(true);
        try {
            await connector.ensureInitialized();

            const { error } = await connector.client.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: Platform.OS === 'web' ? window.location.origin : undefined,
                },
            });

            if (error) {
                console.error('[LoginScreen] Supabase auth error:', error);
                throw error;
            }

            console.log('[LoginScreen] Magic link request successful');
            showAlert('Magic Link Sent', `Check ${email} for your login link!`);
            setSent(true);
            setCooldown(60); // Start 60s cooldown
            setError(null);
        } catch (error: any) {
            console.error('Login failed:', error);

            let message = error.message || 'An unexpected error occurred.';
            const details = error.status ? `(Status: ${error.status}, Code: ${error.code})` : '';

            if (error.status === 429 || message.toLowerCase().includes('rate limit')) {
                setCooldown(300); // 5 minute cooldown on actual rate limit error
                message = `Security: Rate limit exceeded ${details}. For your protection, magic links are temporarily paused. Please try again in 5 minutes.`;
            } else {
                message = `${message} ${details}`;
            }

            setError(message);
            showAlert('Login Failed', message);
        } finally {
            setLoading(false);
        }
    };

    const [devLoading, setDevLoading] = useState(false);

    const handleDeveloperLogin = async () => {
        setDevLoading(true);
        setError(null);
        try {
            console.log('[LoginScreen] Using local mock bypass for developer login (Sample Farm)...');

            // Local mock bypass for development speed and consistency
            const projectId = 'skkbmmxjclpbbijcrgyi';
            const mockSession = {
                access_token: 'dev-mock-token-' + Date.now(),
                refresh_token: 'dev-mock-refresh-' + Date.now(),
                expires_in: 3600,
                expires_at: Math.floor(Date.now() / 1000) + 3600,
                token_type: 'bearer',
                user: {
                    id: 'dev-guest-user',
                    aud: 'authenticated',
                    email: email || 'developer@farmflow.app',
                    phone: '',
                    app_metadata: { provider: 'email', providers: ['email'] },
                    user_metadata: { role: 'developer', guest: true },
                    identities: [],
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                },
            };

            await connector.ensureInitialized();

            // Use the official setSession method for the mock bypass.
            const { data: sessionData, error: sessionError } = await connector.client.auth.setSession({
                access_token: mockSession.access_token,
                refresh_token: mockSession.refresh_token
            });

            if (sessionError) throw sessionError;

            console.log('[LoginScreen] Mock session injected successfully via setSession.');

            if (Platform.OS === 'web') {
                // Short delay to ensure session is persisted before reload
                setTimeout(() => {
                    window.location.reload();
                }, 500);
            }
        } catch (storageError: any) {
            console.error('[LoginScreen] Failed to inject mock session:', storageError);
            setError(`Developer Login Failed: ${storageError.message}`);

            // Fallback to manual storage if setSession fails
            if (Platform.OS === 'web') {
                const projectId = 'skkbmmxjclpbbijcrgyi';
                const storageKey = `sb-${projectId}-auth-token`;
                // Re-prepare mockSession if needed but it's in scope
                const mockSession = {
                    access_token: 'dev-mock-token-' + Date.now(),
                    refresh_token: 'dev-mock-refresh-' + Date.now(),
                    expires_in: 3600,
                    expires_at: Math.floor(Date.now() / 1000) + 3600,
                    token_type: 'bearer',
                    user: {
                        id: 'dev-guest-user',
                        aud: 'authenticated',
                        email: email || 'developer@farmflow.app',
                        phone: '',
                        app_metadata: { provider: 'email', providers: ['email'] },
                        user_metadata: { role: 'developer', guest: true },
                        identities: [],
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    },
                };
                localStorage.setItem(storageKey, JSON.stringify(mockSession));
                window.location.reload();
            }
        } finally {
            setDevLoading(false);
        }
    };

    const handleReset = async () => {
        try {
            localStorage.clear();
            sessionStorage.clear();
            await supabase.auth.signOut();
            window.location.reload();
        } catch (e) {
            window.location.reload();
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
                            testID="login-email-input"
                        />
                    </View>

                    {showPassword && (
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Password</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Enter your password"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                editable={!loading}
                            />
                        </View>
                    )}

                    <TouchableOpacity
                        style={[
                            styles.loginButton,
                            (loading || cooldown > 0) && { opacity: 0.7, backgroundColor: Theme.colors.textSecondary }
                        ]}
                        onPress={handleLogin}
                        disabled={loading || cooldown > 0}
                        testID="login-submit-button"
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFF" testID="login-loading-indicator" />
                        ) : (
                            <Text style={styles.loginButtonText}>
                                {cooldown > 0 ? `Wait ${cooldown}s` : 'Send Magic Link'}
                            </Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.secondaryButton, { marginTop: 10, borderWidth: 1, borderColor: Theme.colors.primary, borderRadius: Theme.borderRadius.md }]}
                        onPress={handleDeveloperLogin}
                        disabled={loading || devLoading}
                    >
                        {devLoading ? (
                            <ActivityIndicator color={Theme.colors.primary} />
                        ) : (
                            <Text style={styles.secondaryButtonText}>Developer Quick-Login (No Password)</Text>
                        )}
                    </TouchableOpacity>

                    <Text style={styles.footerText}>
                        We'll email you a secure link to sign in instantly. Use Developer Quick-Login to skip the email wait during testing.
                    </Text>

                    <TouchableOpacity
                        style={[styles.secondaryButton, { marginTop: 40 }]}
                        onPress={handleReset}
                    >
                        <Text style={[styles.secondaryButtonText, { color: Theme.colors.danger }]}>
                            Reset App (Clear Local State)
                        </Text>
                    </TouchableOpacity>
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
