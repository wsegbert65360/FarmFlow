import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Plus } from 'lucide-react-native';

interface FABProps {
    onPress: () => void;
}

export const FloatingActionButton: React.FC<FABProps> = ({ onPress }) => {
    return (
        <TouchableOpacity
            className="absolute bottom-28 right-6 bg-green-600 w-16 h-16 rounded-full items-center justify-center shadow-xl elevation-5"
            onPress={onPress}
            activeOpacity={0.8}
            testID="floating-action-button"
        >
            <Plus color="white" size={32} strokeWidth={3} />
        </TouchableOpacity>
    );
};
