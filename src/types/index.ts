export type Role = 'household' | 'business' | 'collector' | 'recycler' | 'government' | 'admin';
export type WasteType = 'Plastic' | 'Paper' | 'Glass' | 'Metal' | 'Organic' | 'E-Waste' | 'Construction' | 'Industrial';
export type PickupStatus = 'pending' | 'accepted' | 'active' | 'completed' | 'cancelled';
export interface Pickup { id: string; requester: string; wasteType: WasteType; quantityKg: number; neighborhood: string; address: string; status: PickupStatus; ecoCoinsAwarded?: number; }
export interface SmartBin { id: string; neighborhood: string; fillPercentage: number; weightKg: number; status: 'Empty'|'Half Full'|'Nearly Full'|'Full'; }
