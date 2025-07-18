// useAnchorProvider.js
import { useMemo } from 'react';
import { AnchorProvider, Program, web3 } from '@coral-xyz/anchor';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';

export function useAnchorProvider() {
  const wallet = useWallet();
  const { connection } = useConnection();

  const provider = useMemo(() => {
    if (!wallet || !wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) return null;

    return new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });
  }, [wallet, connection]);

  return provider;
}
