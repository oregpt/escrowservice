export type EscrowStatus =
  | 'CREATED'
  | 'PENDING_ACCEPTANCE'
  | 'PENDING_FUNDING'
  | 'FUNDED'
  | 'PARTY_B_CONFIRMED'
  | 'PARTY_A_CONFIRMED'
  | 'COMPLETED'
  | 'CANCELED'
  | 'EXPIRED'
  | 'DISPUTED';

export type ServiceType = 'TRAFFIC_BUY' | 'DOCUMENT_DELIVERY' | 'API_KEY_EXCHANGE' | 'CUSTOM';

export interface EscrowCardProps {
  id: string;
  serviceType: ServiceType;
  status: EscrowStatus;
  amount: number;
  currency: string;
  partyA: { name: string; avatar?: string };
  partyB: { name: string; avatar?: string } | null;
  createdAt: string;
  expiresAt?: string;
  // New fields for open escrows
  title?: string;
  isOpen?: boolean;
  canAccept?: boolean; // true if user can accept this escrow
  onAccept?: () => void;
  isAccepting?: boolean;
}

export interface AccountSummaryProps {
  totalBalance: number;
  availableBalance: number;
  inContractBalance: number;
  currency: string; // 'USD'
  isLoading?: boolean;
}
