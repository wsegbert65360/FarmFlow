import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Modal, FlatList } from 'react-native';
import { Theme } from '../../constants/Theme';

interface Farm {
    id: string;
    name: string;
}

interface FarmSwitcherModalProps {
    visible: boolean;
    onClose: () => void;
    myFarms: Farm[];
    currentFarmId?: string;
    onSwitchFarm: (farmId: string) => void;
}

export const FarmSwitcherModal: React.FC<FarmSwitcherModalProps> = ({
    visible,
    onClose,
    myFarms,
    currentFarmId,
    onSwitchFarm
}) => {
    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={onClose}
            >
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Switch Farm</Text>
                    <FlatList
                        data={myFarms}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[styles.farmItem, item.id === currentFarmId && styles.activeFarmItem]}
                                onPress={() => onSwitchFarm(item.id)}
                            >
                                <Text style={[styles.farmName, item.id === currentFarmId && styles.activeFarmName]}>{item.name}</Text>
                                {item.id === currentFarmId && <Text style={styles.activeCheck}>✓</Text>}
                            </TouchableOpacity>
                        )}
                    />
                    <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                        <Text style={styles.closeButtonText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: Theme.spacing.lg
    },
    modalContent: {
        backgroundColor: Theme.colors.background,
        borderRadius: 12,
        padding: Theme.spacing.lg,
        maxHeight: '60%'
    },
    modalTitle: { ...Theme.typography.h2, marginBottom: Theme.spacing.md },
    farmItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: Theme.spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.border
    },
    activeFarmItem: { backgroundColor: Theme.colors.surface },
    farmName: { ...Theme.typography.body },
    activeFarmName: { fontWeight: 'bold', color: Theme.colors.primary },
    activeCheck: { color: Theme.colors.primary, fontWeight: 'bold' },
    closeButton: {
        marginTop: Theme.spacing.md,
        alignItems: 'center',
        padding: Theme.spacing.md
    },
    closeButtonText: { color: Theme.colors.textSecondary }
});

