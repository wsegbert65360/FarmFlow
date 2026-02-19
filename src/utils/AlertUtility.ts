import { Alert, Platform } from 'react-native';

/**
 * Unified Alert Utility for FarmFlow.
 * Ensures that alert and confirmation callbacks work predictably on both Web and Mobile.
 */
export const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
        window.alert(`${title}\n\n${message}`);
    } else {
        Alert.alert(title, message);
    }
};

/**
 * Platform-agnostic confirmation dialog.
 * Returns true if confirmed on Web, or executes onConfirm callback on Mobile.
 */
export const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    if (Platform.OS === 'web') {
        if (window.confirm(`${title}\n\n${message}`)) {
            onConfirm();
        }
    } else {
        Alert.alert(title, message, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'OK',
                style: 'destructive',
                onPress: onConfirm
            }
        ]);
    }
};

export const showDeleteConfirm = (itemName: string, onConfirm: () => void) => {
    showConfirm('Delete', `Are you sure you want to delete ${itemName}? This action cannot be undone.`, onConfirm);
};
