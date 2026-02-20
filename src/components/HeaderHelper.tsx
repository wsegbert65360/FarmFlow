import React, { useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { Theme } from '../constants/Theme';
import { TabType } from './navigation/TabBar';
import { db } from '../db/powersync';

interface HeaderHelperProps {
    activeTab: TabType;
}

export const HeaderHelper: React.FC<HeaderHelperProps> = ({ activeTab }) => {
    const [contextLine, setContextLine] = useState<string>('');

    useEffect(() => {
        const loadContext = async () => {
            switch (activeTab) {
                case 'DASHBOARD':
                    // Example: "3 fields need updates"
                    // Real logic: count fields without logs in last X days?
                    // For now, simpler: "Overview of your operation"
                    setContextLine('Overview of your operation');
                    break;
                case 'LOG':
                    setContextLine('Record activities & conditions');
                    break;
                case 'HISTORY':
                    setContextLine('Recent activity feed');
                    break;
                case 'MORE':
                    setContextLine('Settings & Management');
                    break;
                case 'MANAGE':
                    setContextLine('Farm assets & configurations');
                    break;
                case 'SETTINGS':
                    setContextLine('App preferences');
                    break;
                default:
                    setContextLine('');
            }
        };
        loadContext();
    }, [activeTab]);

    return <Text style={styles.helperText}>{contextLine}</Text>;
};

const styles = StyleSheet.create({
    helperText: {
        ...Theme.typography.caption,
        color: Theme.colors.whiteMuted,
        marginTop: 2,
    }
});
