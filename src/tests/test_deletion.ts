// Verification script for Deletion Synchronization logic
// This simulates the behavior of the updated deleteBin and deleteGrainLog functions

const simulateDB = () => {
    let logs = [
        { id: 'LOG-1', farm_id: 'FARM-1', bin_id: 'BIN-1' }
    ];
    let movements = [
        { id: 'MOV-1', farm_id: 'FARM-1', bin_id: 'BIN-1', source_grain_log_id: 'LOG-1' },
        { id: 'MOV-2', farm_id: 'FARM-1', bin_id: 'BIN-1', source_grain_log_id: 'LOG-2' }
    ];
    let bins = [
        { id: 'BIN-1', farm_id: 'FARM-1' }
    ];

    return {
        getRecordCount: () => ({ logs: logs.length, movements: movements.length, bins: bins.length }),

        deleteGrainLog: (id, farmId) => {
            console.log(`Simulating deleteGrainLog(${id})`);
            // The actual code uses: DELETE FROM lot_movements WHERE source_grain_log_id = ? AND farm_id = ?
            movements = movements.filter(m => !(m.source_grain_log_id === id && m.farm_id === farmId));
            logs = logs.filter(l => !(l.id === id && l.farm_id === farmId));
        },

        deleteBin: (id, farmId) => {
            console.log(`Simulating deleteBin(${id})`);
            // The actual code uses: DELETE FROM lot_movements WHERE bin_id = ? AND farm_id = ?
            movements = movements.filter(m => !(m.bin_id === id && m.farm_id === farmId));
            bins = bins.filter(b => !(b.id === id && b.farm_id === farmId));
        }
    };
};

const runTest = () => {
    console.log("Running Deletion Sync Test...");
    const db = simulateDB();
    const farmId = 'FARM-1';

    console.log("Initial state:", db.getRecordCount());

    // Test log deletion
    db.deleteGrainLog('LOG-1', farmId);
    console.log("After deleting LOG-1:", db.getRecordCount());
    if (db.getRecordCount().movements === 1 && db.getRecordCount().logs === 0) {
        console.log("✅ Log deletion sync passed (Movement linked to LOG-1 removed, LOG-2 remains)");
    } else {
        console.error("❌ Log deletion sync failed");
    }

    // Reset and test bin deletion
    const db2 = simulateDB();
    db2.deleteBin('BIN-1', farmId);
    console.log("After deleting BIN-1:", db2.getRecordCount());
    if (db2.getRecordCount().movements === 0 && db2.getRecordCount().bins === 0) {
        console.log("✅ Bin deletion sync passed (All movements for BIN-1 removed)");
    } else {
        console.error("❌ Bin deletion sync failed");
    }
};

runTest();
