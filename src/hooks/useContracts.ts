import { useState, useEffect } from 'react';
import { db } from '../db/powersync';
import { v4 as uuidv4 } from 'uuid';

export interface Contract {
    id: string;
    commodity: string;
    total_bushels: number;
    price_per_bushel: number;
    delivery_deadline: string;
    destination_name: string;
    delivered_bushels?: number;
}

export const useContracts = () => {
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchContracts = async () => {
        try {
            const result = await db.execute(`
                SELECT 
                    c.*,
                    COALESCE((SELECT SUM(bushels_net) FROM grain_logs WHERE destination_name = c.destination_name AND type = 'DELIVERY'), 0) as delivered_bushels
                FROM contracts c
            `);
            setContracts(result.rows?._array || []);
        } catch (error) {
            console.error('Failed to fetch contracts', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContracts();
    }, []);

    const createContract = async (contract: Omit<Contract, 'id' | 'delivered_bushels'>) => {
        const id = uuidv4(); // Make sure to import uuidv4
        await db.execute(
            'INSERT INTO contracts (id, commodity, total_bushels, price_per_bushel, delivery_deadline, destination_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [id, contract.commodity, contract.total_bushels, contract.price_per_bushel, contract.delivery_deadline, contract.destination_name, new Date().toISOString()]
        );
        await fetchContracts();
    };

    const updateContract = async (id: string, contract: Partial<Contract>) => {
        // Simplified update for now
        await db.execute(
            'UPDATE contracts SET commodity = ?, total_bushels = ?, price_per_bushel = ?, delivery_deadline = ?, destination_name = ? WHERE id = ?',
            [contract.commodity, contract.total_bushels, contract.price_per_bushel, contract.delivery_deadline, contract.destination_name, id]
        );
        await fetchContracts();
    };

    const deleteContract = async (id: string) => {
        await db.execute('DELETE FROM contracts WHERE id = ?', [id]);
        await fetchContracts();
    };

    return { contracts, loading, createContract, updateContract, deleteContract, refreshContracts: fetchContracts };
};
