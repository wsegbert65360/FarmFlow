// Simple test script for FIFO logic
// This is a mockup of how the logic should be tested in a controlled environment

const simulateFIFO = (lots: { id: string, balance: number, date: string }[], outboundAmount: number) => {
    let remaining = outboundAmount;
    const allocations = [];

    // Sort by date (asc)
    const sortedLots = [...lots].sort((a, b) => a.date.localeCompare(b.date));

    for (const lot of sortedLots) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, lot.balance);
        allocations.push({ lotId: lot.id, amount: take });
        remaining -= take;
    }

    return { allocations, remaining };
};

const runTest = () => {
    console.log("Running FIFO Test...");

    const mockLots = [
        { id: 'LOT-A (Field 1)', balance: 500, date: '2024-10-01' },
        { id: 'LOT-B (Field 2)', balance: 300, date: '2024-10-02' },
        { id: 'LOT-C (Field 1)', balance: 200, date: '2024-10-05' }
    ];

    const deliveryAmount = 600;
    const result = simulateFIFO(mockLots, deliveryAmount);

    console.log(`Requested: ${deliveryAmount} bu`);
    console.log("Allocations:", JSON.stringify(result.allocations, null, 2));

    // Assertions
    const expected = [
        { lotId: 'LOT-A (Field 1)', amount: 500 },
        { lotId: 'LOT-B (Field 2)', amount: 100 }
    ];

    if (JSON.stringify(result.allocations) === JSON.stringify(expected) && result.remaining === 0) {
        console.log("✅ TEST PASSED");
    } else {
        console.log("❌ TEST FAILED");
    }
};

runTest();
