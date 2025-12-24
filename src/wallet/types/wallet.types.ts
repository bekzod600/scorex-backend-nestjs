export type WalletTransactionType =
  | 'TOPUP'
  | 'SIGNAL_BUY'
  | 'SUBSCRIPTION_BUY'
  | 'REFUND'
  | 'ADJUSTMENT';

export type WalletTransactionStatus = 'pending' | 'confirmed' | 'rejected';
