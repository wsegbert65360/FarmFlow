import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Theme } from '../../constants/Theme';

export type VaultTab = 'CHEMICALS' | 'SEEDS' | 'LANDLORDS' | 'REPORTS' | 'SETTINGS';

interface VaultTabNavigationProps {
    activeTab: VaultTab;
    setActiveTab: (tab: VaultTab) => void;
}

export const VaultTabNavigation: React.FC<VaultTabNavigationProps> = ({ activeTab, setActiveTab }) => {
    const tabs: { type: VaultTab; label: string; activeColor: string }[] = [
        { type: 'CHEMICALS', label: 'Chemicals', activeColor: Theme.colors.primary },
        { type: 'SEEDS', label: 'Seeds', activeColor: Theme.colors.success },
        { type: 'LANDLORDS', label: 'Landlords', activeColor: Theme.colors.warning },
        { type: 'SETTINGS', label: 'Sync & Team', activeColor: Theme.colors.secondary },
    ];

    return (
        <View style={styles.tabContainer}>
            {tabs.map((tab) => (
                <TouchableOpacity
                    key={tab.type}
                    style={[
                        styles.tab,
                        activeTab === tab.type && styles.activeTab,
                        activeTab === tab.type && { borderBottomColor: tab.activeColor }
                    ]}
                    onPress={() => setActiveTab(tab.type)}
                >
                    <Text style={[
                        styles.tabText,
                        activeTab === tab.type && styles.activeTabText,
                        activeTab === tab.type && { color: tab.activeColor }
                    ]}>
                        {tab.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: Theme.colors.white,
        borderBottomWidth: 1,
        borderBottomColor: Theme.colors.border,
    },
    tab: { flex: 1, padding: Theme.spacing.md, alignItems: 'center' },
    activeTab: { borderBottomWidth: 3 },
    tabText: { ...Theme.typography.body, color: Theme.colors.textSecondary },
    activeTabText: { fontWeight: 'bold' },
});
