import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
                    <Text style={styles.title}>Something went wrong.</Text>
                    <Text style={styles.subtitle}>
                        {this.state.error?.message || 'An unexpected error occurred.'}
                    </Text>
                    <TouchableOpacity style={styles.button} onPress={this.handleReset}>
                        <Text style={styles.buttonText}>Attempt Recovery</Text>
                    </TouchableOpacity>
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
    }
});
