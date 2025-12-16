/// <reference types="react-scripts" />

declare namespace NodeJS {
  interface ProcessEnv {
    readonly REACT_APP_HEDERA_CONTRACT_ID: string;
    readonly REACT_APP_HEDERA_NETWORK: string;
    readonly REACT_APP_API_URL: string;
    readonly REACT_APP_WALLETCONNECT_PROJECT_ID: string;
  }
}

interface Window {
  hashpack?: any;
  bladeSDK?: any;
}