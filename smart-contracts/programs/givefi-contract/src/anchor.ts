
import { AnchorProvider, Program, Idl } from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import idl from '../target/idl/givefi.json';

export const useGivefiProgram = () => {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const provider = new AnchorProvider(connection, wallet as any, {});
  const programId = new PublicKey(idl.metadata.address);
  return new Program(idl as Idl, programId,