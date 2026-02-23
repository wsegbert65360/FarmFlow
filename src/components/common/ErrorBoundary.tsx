import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Theme } from '../../constants/Theme';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    public render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                    <Text style={styles.title}>Critical Error</Text>
                    <Text style={styles.subtitle}>
                        FarmFlow encountered a crash. We've captured the details below:
                    </Text>
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>
                            {this.state.error?.name}: {this.state.error?.message}
                        </Text>
                        <Text style={styles.stackText}>
                            {this.state.error?.stack?.split('\n').slice(0, 5).join('\n')}
                        </Text>
                    </View>
                    <TouchableOpacity style={styles.button} onPress={this.handleReset}>
                        <Text style={styles.buttonText}>Reload Application</Text>
                    </TouchableOpacity>
                    <Text style={styles.footer}>
                        Please send a screenshot of this error to support.
                    </Text>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: Theme.colors.background
    },
    title: {
        ...Theme.typography.h2,
        color: Theme.colors.danger,
        marginBottom: 10
    },
    subtitle: {
        ...Theme.typography.body,
        color: Theme.colors.textSecondary,
        textAlign: 'center',
        marginBottom: 30
    },
    button: {
        backgroundColor: Theme.colors.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: Theme.borderRadius.md
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold'
    },
    errorBox: {
        backgroundColor: '#FFF0F0',
        padding: 15,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FFC0C0',
        width: '100%',
        marginVertical: 20,
    },
    errorText: {
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        fontSize: 14,
        color: '#D00',
        fontWeight: 'bold',
        marginBottom: 8,
    },
    stackText: {
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        fontSize: 12,
        color: '#666',
    },
    footer: {
        marginTop: 30,
        fontSize: 12,
        color: Theme.colors.textSecondary,
        textAlign: 'center',
    }
});
