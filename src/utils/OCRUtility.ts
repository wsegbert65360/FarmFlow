import { z } from 'zod';

export const ScaleTicketSchema = z.object({
    bushels: z.number().positive(),
    moisture: z.number().min(5).max(40),
    commodity: z.string().optional(),
    ticketNumber: z.string().optional(),
    date: z.string().optional()
});

export type ScaleTicket = z.infer<typeof ScaleTicketSchema>;

export const mockScanTicket = async (): Promise<ScaleTicket> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Mock results
    const result = {
        bushels: parseFloat((Math.random() * 500 + 800).toFixed(2)),
        moisture: parseFloat((Math.random() * 5 + 13).toFixed(1)),
        commodity: 'Corn',
        ticketNumber: `TK-${Math.floor(Math.random() * 100000)}`,
        date: new Date().toISOString()
    };

    return ScaleTicketSchema.parse(result);
};
