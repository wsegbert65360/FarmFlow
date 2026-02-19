// Phase 3 Split Logic Verification
const calculateSplits = (agreement: any, movements: any[]) => {
    const sharePct = agreement.rent_type === 'SHARE' ? agreement.landlord_share_pct : 0;
    const deliveries = [];
    let binBalance = 0;

    for (const m of movements) {
        if (m.type === 'INTO_BIN') {
            binBalance += m.bushels;
        } else if (m.type === 'OUT_OF_BIN') {
            binBalance -= m.bushels;
            deliveries.push({
                total: m.bushels,
                landlord: m.bushels * (sharePct / 100)
            });
        } else if (m.type === 'DIRECT') {
            deliveries.push({
                total: m.bushels,
                landlord: m.bushels * (sharePct / 100)
            });
        }
    }

    const storageLandlordShort = binBalance * (sharePct / 100);
    return { deliveries, storageLandlordShort, binBalance };
};

const runTest = () => {
    console.log("Running Phase 3 Split Test...");

    const mockAgreement = { rent_type: 'SHARE', landlord_share_pct: 33.33 };
    const mockMovements = [
        { type: 'INTO_BIN', bushels: 1000 }, // Harvest into bin
        { type: 'OUT_OF_BIN', bushels: 600 }, // Delivery from bin
        { type: 'DIRECT', bushels: 500 }     // Direct harvest to town
    ];

    const result = calculateSplits(mockAgreement, mockMovements);

    console.log("Deliveries:", result.deliveries);
    console.log("Remaining in Storage (LL Share):", result.storageLandlordShort);

    // Expected: 
    // Delivery 1 (from bin): 600 * 0.3333 = 199.98
    // Delivery 2 (direct): 500 * 0.3333 = 166.65
    // Storage: 400 * 0.3333 = 133.32

    const totalLLDelivered = result.deliveries.reduce((s, d) => s + d.landlord, 0);

    if (Math.abs(totalLLDelivered - 366.63) < 0.1 && Math.abs(result.storageLandlordShort - 133.32) < 0.1) {
        console.log("✅ SPLIT TEST PASSED");
    } else {
        console.error("❌ SPLIT TEST FAILED", { totalLLDelivered, storage: result.storageLandlordShort });
    }
};

runTest();
