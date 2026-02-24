import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, SafeAreaView } from 'react-native';
import { Theme } from '../constants/Theme';

interface HarvestSubmenuModalProps {
    visible: boolean;
    onClose: () => void;
    onContinue: (cropType: string, destination: 'BIN' | 'TOWN') => void;
    fieldName: string;
}

const CROPS = ['Corn', 'Soybeans', 'Wheat', 'Hay'];

export const HarvestSubmenuModal: React.FC<HarvestSubmenuModalProps> = ({ visible, onClose, onContinue, fieldName }) => {
    const [step, setStep] = useState<1 | 2>(1);
    const [selectedCrop, setSelectedCrop] = useState<string | null>(null);

    const handleCropSelect = (crop: string) => {
        setSelectedCrop(crop);
        setStep(2);
    };

    const handleDestSelect = (dest: 'BIN' | 'TOWN') => {
        if (selectedCrop) {
            onContinue(selectedCrop, dest);
            // Reset for next time
            setStep(1);
            setSelectedCrop(null);
        }
    };

    const handleBack = () => {
        if (step === 2) setStep(1);
        else onClose();
    };

    return (
        <Modal visible={visible} animationType="fade" transparent={true}>
            <SafeAreaView style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{fieldName}</Text>
                        <Text style={styles.subtitle}>{step === 1 ? 'What was harvested?' : 'Where is it going?'}</Text>
                    </View>

                    <View style={styles.content}>
                        {step === 1 ? (
                            <View style={styles.grid}>
                                {CROPS.map(crop => (
                                    <TouchableOpacity
                                        key={crop}
                                        style={styles.cropButton}
                                        onPress={() => handleCropSelect(crop)}
                                        testID={`harvest-crop-${crop.toLowerCase()}`}
                                    >
                                        <Text style={styles.buttonText}>{crop.toUpperCase()}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : (
                            <View style={styles.destContainer}>
                                <TouchableOpacity
                                    style={[styles.destButton, { backgroundColor: Theme.colors.primary }]}
                                    onPress={() => handleDestSelect('BIN')}
                                    testID="harvest-dest-bin"
                                >
                                    <Text style={styles.destText}>BIN</Text>
                                    <Text style={styles.destSubtext}>On-farm Storage</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.destButton, { backgroundColor: '#7e22ce' }]}
                                    onPress={() => handleDestSelect('TOWN')}
                                    testID="harvest-dest-town"
                                >
                                    <Text style={styles.destText}>TOWN</Text>
                                    <Text style={styles.destSubtext}>Direct delivery</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>

                    <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                        <Text style={styles.backButtonText}>{step === 2 ? '← BACK' : 'CANCEL'}</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    container: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 32,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10
    },
    header: {
        alignItems: 'center',
        marginBottom: 24
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: Theme.colors.text
    },
    subtitle: {
        fontSize: 16,
        color: Theme.colors.textSecondary,
        marginTop: 4
    },
    content: {
        marginBottom: 24
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between'
    },
    cropButton: {
        width: '48%',
        backgroundColor: Theme.colors.surface,
        paddingVertical: 24,
        borderRadius: 16,
        marginBottom: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Theme.colors.border,
        minHeight: 80
    },
    buttonText: {
        fontWeight: 'bold',
        color: Theme.colors.text,
        fontSize: 14
    },
    destContainer: {
        gap: 16
    },
    destButton: {
        width: '100%',
        paddingVertical: 20,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 100
    },
    destText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 24
    },
    destSubtext: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        marginTop: 4
    },
    backButton: {
        alignItems: 'center',
        paddingVertical: 12,
        minHeight: 44,
        justifyContent: 'center'
    },
    backButtonText: {
        color: Theme.colors.textSecondary,
        fontWeight: 'bold',
        letterSpacing: 1
    }
});
