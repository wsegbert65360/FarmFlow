import { Share } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { db } from '../db/powersync';
import { SyncController } from '../sync/SyncController';
import { supabase } from '../supabase/client';

export const exportDiagnostics = async () => {
    try {
        const syncController = SyncController.getInstance();
        const session = await supabase.auth.getSession();

        const diagnosticData = {
            timestamp: new Date().toISOString(),
            app: {
                name: 'FarmFlow',
                version: '1.0.0', // TODO: Pull from Constants.manifest
                platform: process.platform,
            },
            auth: {
                userId: session.data.session?.user.id || null,
                authenticated: !!session.data.session,
            },
            sync: {
                status: syncController.getStatus(),
                lastSyncedAt: syncController.getLastSyncedAt()?.toISOString(),
                isOnline: syncController.isOnline(),
            },
            storage: {
                // Quick check of record counts
                fields: (await db.getAll('SELECT count(*) as c FROM fields'))[0]['c'],
                logs: (await db.getAll('SELECT count(*) as c FROM spray_logs'))[0]['c'],
            },
            errors: syncController.getErrorLog(), // We need to add this method to SyncController
        };

        const fileName = `${FileSystem.documentDirectory}diagnostics_${new Date().getTime()}.json`;
        await FileSystem.writeAsStringAsync(fileName, JSON.stringify(diagnosticData, null, 2));

        if (await FileSystem.getInfoAsync(fileName)) {
            await Share.share({
                url: fileName,
                title: 'FarmFlow Diagnostics',
                message: 'Here is the FarmFlow diagnostics report.'
            });
        }
    } catch (error) {
        console.error('Failed to export diagnostics', error);
        alert('Failed to generate diagnostic report.');
    }
};
