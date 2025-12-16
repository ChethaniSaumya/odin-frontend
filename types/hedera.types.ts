export interface WalletMetadata {
  name: string;
  description: string;
  url: string;
  icons: string[];
}

export interface AccountInfo {
  session: any;
  accountId: string;
}

export interface BalanceResult {
  hbars: number;
}

export interface TransactionResult {
  transactionId: string;
  status: string;
}

export interface TransferParams {
  accountId: string;
  amount: number;
}