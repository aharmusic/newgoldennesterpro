// src/app/wallet/page.jsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import DashboardLayout from '../dashboard/layout';

// --- Helper Functions ---
const formatCurrency = (value) => {
  return value?.toLocaleString('en-LK', {
    style: 'currency',
    currency: 'LKR',
    maximumFractionDigits: 2,
  });
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function WalletPage() {
  const [walletData, setWalletData] = useState(null);
  const [marketData, setMarketData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const fetchPageData = async () => {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('userToken');
      if (!token) {
        router.push('/');
        return;
      }

      const config = { headers: { Authorization: `Bearer ${token}` } };
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';

      try {
        const [walletRes, marketRes] = await Promise.all([
          axios.get(`${backendUrl}/api/users/me`, config),
          axios.get(`${backendUrl}/api/market/gold-summary`)
        ]);
        setWalletData(walletRes.data);
        setMarketData(marketRes.data);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError(err.response?.data?.message || "Failed to load data.");
        if (err.response?.status === 401 || err.response?.status === 404) {
          localStorage.clear();
          router.push('/');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPageData();
  }, [router]);

  // --- Derived Data ---
  const userInfo = walletData;
  const transactions = walletData?.transactions || [];
  const allBadges = walletData?.gamificationDefs?.badges || [];
  const activeChallenges = walletData?.gamificationDefs?.challenges || [];
  const earnedBadgeIds = walletData?.earnedBadgeIds || [];
  const challengeProgressMap = walletData?.challengeProgress || {};
  const growthForecast = walletData?.gamificationDefs?.monthlyForecast || 'N/A';

  const goldBalanceGrams = userInfo?.goldBalanceGrams ?? 0;
  const currentPricePerGram = marketData?.latestPricePerGram || 0;
  const goldValueLKR = goldBalanceGrams * currentPricePerGram;
  const earningsLKR = goldValueLKR * 0.1; // Placeholder logic

  const investmentHistory = transactions.filter(tx => tx.type === 'investment');
  const redemptionHistory = transactions.filter(tx => tx.type === 'redemption');

  const getRedemptionProgress = (targetGrams) => {
    if (goldBalanceGrams <= 0 || targetGrams <= 0) return 0;
    return Math.min(100, (goldBalanceGrams / targetGrams) * 100);
  };

  const progress10g = getRedemptionProgress(10);
  const progress5g = getRedemptionProgress(5);
  const progress1g = getRedemptionProgress(1);

  const earnedBadgesDetails = allBadges.filter(badge => earnedBadgeIds.includes(badge.id));

  if (loading || !marketData) return <DashboardLayout><div className="text-center p-10">Loading Wallet...</div></DashboardLayout>;
  if (error) return <DashboardLayout><div className="text-center p-10 text-red-500">Error: {error}</div></DashboardLayout>;
  if (!userInfo) return <DashboardLayout><div className="text-center p-10">Could not load user data.</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="wallet-container space-y-8">

        {/* Overview */}
        <section className="bg-white p-6 rounded-lg shadow-md grid grid-cols-2 md:grid-cols-4 gap-4 items-center">
          <div className="col-span-2 md:col-span-1 border-r pr-4">
            <h3 className="text-sm text-gray-500 mb-1">Gold Owned</h3>
            <p className="text-xl font-bold">{goldBalanceGrams.toFixed(3)} grams</p>
            <p className="text-md text-gray-700">{formatCurrency(goldValueLKR)}</p>
          </div>
          <div className="border-r pr-4 hidden md:block">
            <h3 className="text-sm text-gray-500 mb-1">Est. Earnings</h3>
            <p className="text-xl font-bold text-green-600">{formatCurrency(earningsLKR)}</p>
          </div>
          <div className="border-r pr-4">
            <h3 className="text-sm text-gray-500 mb-1">Est. Growth (Next Month)</h3>
            <p className="text-xl font-bold">{growthForecast}%</p>
          </div>
          <div>
            <Link href="/invest" className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-4 rounded text-center block">
              Invest in GOLD
            </Link>
          </div>
        </section>

        {/* Transaction History */}
        <section className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Transaction History</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Date</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Type</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Grams</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Value (LKR)</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.length > 0 ? (
                  transactions.map((tx, index) => (
                    <tr key={tx._id || index}>
                      <td className="px-4 py-2 whitespace-nowrap">{formatDate(tx.date)}</td>
                      <td className="px-4 py-2 whitespace-nowrap capitalize">{tx.type}</td>
                      <td className={`px-4 py-2 whitespace-nowrap ${tx.type === 'investment' ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.type === 'investment' ? '+' : '-'}{tx.amountGrams?.toFixed(4)} g
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">{formatCurrency(tx.amountLKR)}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="4" className="text-center py-4 text-gray-500">No transactions yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Redemption Progress */}
        <section className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Redeem Gold Coin</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            {[{ grams: 10, progress: progress10g }, { grams: 5, progress: progress5g }, { grams: 1, progress: progress1g }].map(({ grams, progress }) => (
              <div key={grams}>
                <h3 className="font-medium mb-2">Progress for {grams}g Coin</h3>
                <div className="relative w-24 h-24 mx-auto mb-2 rounded-full border-4 border-gray-200 flex items-center justify-center"
                  style={{ background: `conic-gradient(#fbbf24 ${progress}%, #e5e7eb ${progress}%)` }}>
                  <span className="text-lg font-bold">{progress.toFixed(1)}%</span>
                </div>
                <button disabled={progress < 100} className={`w-full py-2 px-4 rounded text-sm font-medium ${progress < 100 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-yellow-500 text-white hover:bg-yellow-600'}`}>
                  Redeem {grams}g
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Redemption History */}
        <section className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Redeem History</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Date</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Grams Redeemed</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500">Fees/Charges (LKR)</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {redemptionHistory.length > 0 ? (
                  redemptionHistory.map((tx, index) => (
                    <tr key={tx._id || index}>
                      <td className="px-4 py-2 whitespace-nowrap">{formatDate(tx.date)}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{tx.amountGrams?.toFixed(4)} g</td>
                      <td className="px-4 py-2 whitespace-nowrap">{formatCurrency(tx.amountLKR - (tx.amountGrams * currentPricePerGram))}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan="3" className="text-center py-4 text-gray-500">No redemption history yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Gamification */}
        <section className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">Gamifications & Rewards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium mb-3 text-lg">Your Badges</h3>
              {earnedBadgesDetails.length > 0 ? (
                <div className="flex flex-wrap gap-4 items-center text-center">
                  {earnedBadgesDetails.map((badge, index) => (
                    <div key={index} className="flex flex-col items-center p-2 border rounded-md w-24">
                      <span className="text-3xl mb-1 text-yellow-500">
                        <i className={badge.icon || 'fas fa-certificate'}></i>
                      </span>
                      <p className="text-xs font-semibold">{badge.name}</p>
                      <p className="text-xs text-gray-500" title={badge.description}>Earned!</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Start investing to earn badges!</p>
              )}
            </div>
            <div>
              <h3 className="font-medium mb-3 text-lg">Active Challenges</h3>
              {activeChallenges.length > 0 ? (
                <div className="space-y-4">
                  {activeChallenges.map((challenge, index) => {
                    let currentProgressValue = challengeProgressMap[challenge.id] || 0;
                    if (challenge.type === 'investment_amount_monthly') {
                      currentProgressValue = transactions
                        .filter(t => t.type === 'investment')
                        .reduce((sum, t) => sum + t.amountLKR, 0);
                    } else if (challenge.type === 'investment_count_weekly') {
                      currentProgressValue = transactions
                        .filter(t => t.type === 'investment').length;
                    }
                    currentProgressValue = Math.max(challengeProgressMap[challenge.id] || 0, currentProgressValue);
                    const goal = challenge.goal;
                    const progressPercent = Math.min(100, (currentProgressValue / goal) * 100);
                    const needed = Math.max(0, goal - currentProgressValue);

                    return (
                      <div key={index}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{challenge.name}</span>
                          <span className="text-gray-500">
                            {needed > 0 ? `${challenge.unit === 'LKR' ? formatCurrency(needed) : needed.toFixed(0)} more` : 'Completed!'}
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div className="bg-yellow-400 h-2.5 rounded-full" style={{ width: `${progressPercent}%` }}></div>
                        </div>
                        <p className="text-xs text-gray-600 mt-1" title={challenge.description}>Reward: {challenge.reward}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No active challenges right now.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
