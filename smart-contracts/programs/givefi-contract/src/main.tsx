import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  WalletProvider,
  ConnectionProvider,
} from '@solana/wallet-adapter-react';
import {
  PhantomWalletAdapter,
  BackpackWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import '@solana/wallet-adapter-react-ui/styles.css';

const App = () => {
  const wallets = [new PhantomWalletAdapter(), new BackpackWalletAdapter()];

  return (
    <ConnectionProvider endpoint={'https://api.devnet.solana.com'}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <YourApp />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
