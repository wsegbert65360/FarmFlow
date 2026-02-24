import React, { useState } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    SafeAreaView,
    Modal,
    TextInput,
    ActivityIndicator
} from 'react-native';
import { showAlert } from '../utils/AlertUtility';
import { Theme } from '../constants/Theme';
import { useFields, Field } from '../hooks/useFields';
import { parseNumericInput } from '../utils/NumberUtility';
import { useDatabase } from '../hooks/useDatabase';
import { FieldCard } from '../components/FieldCard';
import { LogSessionScreen, LogType } from '../screens/LogSessionScreen';
import { HarvestSubmenuModal } from '../components/HarvestSubmenuModal';

export type FieldListMode = 'DEFAULT' | 'SELECT' | 'MANAGE';
export type FieldActionType = 'PLANTING' | 'SPRAY' | 'HARVEST' | 'HARVEST_TO_TOWN';

interface FieldListScreenProps {
    mode?: FieldListMode;
    /**
     * Optional override for parent-controlled behavior.
     * - mode=SELECT: called when a field row is tapped
     * - mode=MANAGE/DEFAULT: called when an action is chosen
     */
    onSelectAction?: (field: Field, actionType?: FieldActionType) => void;
}

export const FieldListScreen: React.FC<FieldListScreenProps> = ({ mode = 'DEFAULT', onSelectAction }) => {
    const { fields, loading, addField, updateField, deleteField } = useFields();
    const { farmId } = useDatabase();

    const [selectedField, setSelectedField] = useState<Field | null>(null);
    const [isAddModalVisible, setIsAddModalVisible] = useState(false);
    const [isEditModalVisible, setIsEditModalVisible] = useState(false);
    const [isLogSessionVisible, setIsLogSessionVisible] = useState(false);
    const [isHarvestModalVisible, setIsHarvestModalVisible] = useState(false);
    const [activeLogType, setActiveLogType] = useState<LogType>('SPRAY');
    const [selectedCrop, setSelectedCrop] = useState<string>('Corn');

    const [newName, setNewName] = useState('');
    const [newAcreage, setNewAcreage] = useState('');

    const handleAddField = async () => {
        if (!newName || !newAcreage) {
            showAlert('Missing Info', 'Please enter both a name and acreage.');
            return;
        }
        try {
            await addField(newName, parseNumericInput(newAcreage));
            setNewName('');
            setNewAcreage('');
            setIsAddModalVisible(false);
        } catch (error) {
            showAlert('Error', 'Failed to add field.');
        }
    };

    const handleUpdateField = async () => {
        if (!selectedField || !newName || !newAcreage) return;
        try {
            await updateField(selectedField.id, newName, parseNumericInput(newAcreage));
            setIsEditModalVisible(false);
            setSelectedField(null);
        } catch (error) {
            showAlert('Error', 'Failed to update field.');
        }
    };

    const handleDeleteField = async () => {
        if (!selectedField) return;
        try {
            await deleteField(selectedField.id);
            setIsEditModalVisible(false);
            setSelectedField(null);
        } catch (error) {
            showAlert('Error', 'Failed to delete field.');
        }
    };

    const handleAction = (field: Field, type: FieldActionType) => {
        if (onSelectAction) {
            onSelectAction(field, type);
            return;
        }

        setSelectedField(field);

        if (type === 'HARVEST') {
            setIsHarvestModalVisible(true);
        } else {
            setActiveLogType(type as LogType);
            setIsLogSessionVisible(true);
        }
    };

    const handleHarvestContinue = (crop: string, dest: 'BIN' | 'TOWN') => {
        setSelectedCrop(crop);
        setActiveLogType(dest === 'BIN' ? 'HARVEST' : 'HARVEST_TO_TOWN');
        setIsHarvestModalVisible(false);
        setIsLogSessionVisible(true);
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center bg-gray-50/50">
                <Text className="mt-4 text-gray-400 font-medium">{'Loading fields...'}</Text>
            </View>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-50/50" style={{ flex: 1 }}>
            <FlatList
                data={fields}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                    mode === 'SELECT' ? (
                        <TouchableOpacity
                            className="bg-white rounded-3xl mb-4 border border-gray-100 px-6 py-5"
                            style={{ minHeight: 64, justifyContent: 'center' }}
                            onPress={() => onSelectAction?.(item)}
                            accessibilityRole="button"
                            accessibilityLabel={`Select field ${item.name}`}
                            testID={`select-field-${item.id}`}
                        >
                            <Text className="text-lg font-bold text-gray-900">{item.name}</Text>
                            <Text className="text-gray-500 mt-1">{item.acreage}{' acres'}</Text>
                        </TouchableOpacity>
                    ) : (
                        <FieldCard
                            field={item}
                            onAction={(type) => handleAction(item, type)}
                        />
                    )
                )}
                ListEmptyComponent={
                    <View className="items-center justify-center py-20 px-10">
                        <Text className="text-gray-400 font-medium text-center">{'No fields found. Add your first field to start tracking activities.'}</Text>
                        {mode !== 'SELECT' && (
                            <TouchableOpacity
                                className="mt-6 bg-blue-600 px-8 py-4 rounded-2xl shadow-md"
                                onPress={() => setIsAddModalVisible(true)}
                                testID="add-field-btn"
                                style={{ minHeight: 64, justifyContent: 'center' }}
                            >
                                <Text className="text-white font-bold text-lg">{'+ Add Field'}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                }
            />

            {/* Add Field Modal */}
            {mode !== 'SELECT' && (
                <Modal visible={isAddModalVisible} transparent animationType="slide">
                    <View className="flex-1 justify-end bg-black/50">
                        <View className="bg-white rounded-t-[40px] p-8 pb-12 shadow-2xl">
                            <Text className="text-2xl font-bold text-gray-900 mb-6">{'New Field'}</Text>
                            <TextInput
                                className="bg-gray-50 border border-gray-100 p-4 rounded-2xl text-lg mb-4"
                                placeholder="Field Name"
                                value={newName}
                                onChangeText={setNewName}
                                testID="add-field-name-input"
                            />
                            <TextInput
                                className="bg-gray-50 border border-gray-100 p-4 rounded-2xl text-lg mb-8"
                                placeholder="Acreage"
                                keyboardType="numeric"
                                value={newAcreage}
                                onChangeText={setNewAcreage}
                                testID="add-field-acreage-input"
                            />
                            <TouchableOpacity
                                className="bg-blue-600 p-4 rounded-2xl items-center shadow-md mb-4"
                                onPress={handleAddField}
                                testID="add-field-save-btn"
                                style={{ minHeight: 64, justifyContent: 'center' }}
                            >
                                <Text className="text-white font-bold text-lg">{'Save Field'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setIsAddModalVisible(false)}
                                testID="add-field-cancel-btn"
                                style={{ minHeight: 64, justifyContent: 'center' }}
                            >
                                <Text className="text-center text-red-500 font-bold p-2">{'Cancel'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            )}

            {!onSelectAction && (
                <Modal visible={isLogSessionVisible && !!selectedField} animationType="slide" transparent={false}>
                    {selectedField && (
                        <LogSessionScreen
                            type={activeLogType}
                            fixedId={selectedField.id}
                            fixedName={selectedField.name}
                            fixedType="FIELD"
                            preferredCrop={selectedCrop}
                            onClose={() => {
                                setIsLogSessionVisible(false);
                                setSelectedField(null);
                            }}
                        />
                    )}
                </Modal>
            )}

            <HarvestSubmenuModal
                visible={isHarvestModalVisible}
                fieldName={selectedField?.name || ''}
                onClose={() => setIsHarvestModalVisible(false)}
                onContinue={handleHarvestContinue}
            />
        </SafeAreaView>
    );
};
