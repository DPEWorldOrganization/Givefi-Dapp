// src/components/CreateRaffleForm.jsx
import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

const CreateRaffleForm = () => {
  const { publicKey, connected } = useWallet();
  const [formData, setFormData] = useState({
    entryCost: '',
    maxEntries: '',
    prizeDescription: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!connected || !publicKey) {
      alert('Please connect your wallet first.');
      return;
    }

    console.log('Submitting Raffle:', {
      ...formData,
      creator: publicKey.toBase58(),
    });

    // Here is where you would trigger your Anchor interaction or send to backend.
  };

  return (
    <div className="p-4 max-w-md mx-auto">
      <h2 className="text-xl font-bold mb-4">Create Raffle</h2>
      <WalletMultiButton className="mb-4" />

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          name="entryCost"
          type="number"
          placeholder="Entry Cost (in SOL)"
          value={formData.entryCost}
          onChange={handleChange}
          className="w-full border px-3 py-2"
        />
        <input
          name="maxEntries"
          type="number"
          placeholder="Max Entries"
          value={formData.maxEntries}
          onChange={handleChange}
          className="w-full border px-3 py-2"
        />
        <input
          name="prizeDescription"
          type="text"
          placeholder="Prize Description"
          value={formData.prizeDescription}
          onChange={handleChange}
          className="w-full border px-3 py-2"
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Submit Raffle
        </button>
      </form>
    </div>
  );
};

export default CreateRaffleForm;
