// src/app/dashboard/page.jsx
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import DashboardLayout from './layout'; // Assuming layout is in the same folder or adjust path

// --- Helper Functions (Define or Import these) ---
const formatCurrency = (value) => {
    if (value === null || value === undefined || isNaN(value)) {
        return 'LKR 0.00'; // Or some other placeholder
    }
    return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 2 }).format(value);
};

const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
        // Attempt to create a date object and format it
        return new Date(dateString).toLocaleDateString('en-CA'); // YYYY-MM-DD
    } catch (e) {
        console.error("Error formatting date:", dateString, e);
        return 'Invalid Date';
    }
};
// --- End Helper Functions ---


export default function DashboardPage() {
    // --- State Variables ---
    const [userInfo, setUserInfo] = useState(null); // Includes balance, transactions, etc.
    const [marketData, setMarketData] = useState(null); // Latest price, change, etc.
    const [overviewSuggestion, setOverviewSuggestion] = useState('Loading overview...');
    const [trendSummary, setTrendSummary] = useState('Loading trend info...');
    const [growthForecast, setGrowthForecast] = useState('...'); // For "Buy now" section %
    const [pageLoading, setPageLoading] = useState(true);
    const [error, setError] = useState('');
    const router = useRouter();

    // --- Data Fetching ---
    useEffect(() => {
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';
        const token = localStorage.getItem('userToken');

        const fetchDashboardData = async () => {
            setPageLoading(true);
            setError(''); // Clear previous errors

            if (!token) {
                setError("Authentication token not found. Please log in.");
                setPageLoading(false);
                router.push('/'); // Redirect home if not logged in
                return;
            }
            const config = { headers: { Authorization: `Bearer ${token}` } };

            try {
                // Fetch all required data in parallel
                const [userRes, overviewRes, trendRes, forecastRes, marketRes] = await Promise.all([
                    axios.get(`${backendUrl}/api/users/me`, config).catch(e => { console.error('User fetch failed:', e); return { data: null, error: e }; }), // Catch individual errors
                    axios.get(`${backendUrl}/api/ai/dashboard-overview`, config).catch(e => { console.error('Overview fetch failed:', e); return { data: { overview: 'Error loading overview.' }, error: e }; }),
                    axios.get(`${backendUrl}/api/ai/trend-summary`).catch(e => { console.error('Trend fetch failed:', e); return { data: { summary: 'Error loading trend info.' }, error: e }; }), // Public
                    axios.get(`${backendUrl}/api/ai/monthly-forecast`).catch(e => { console.error('Forecast fetch failed:', e); return { data: { forecast: 'N/A' }, error: e }; }), // Public
                    axios.get(`${backendUrl}/api/market/gold-summary`).catch(e => { console.error('Market fetch failed:', e); return { data: null, error: e }; }) // Public
                ]);

                // Check for critical failures
                if (!userRes.data || !marketRes.data) {
                    throw new Error("Failed to load essential dashboard data (User or Market).");
                }
                 if (userRes.error?.response?.status === 401 || userRes.error?.response?.status === 404) {
                    localStorage.clear();
                    throw new Error("Authentication failed. Please log in again.");
                }


                // Set State with fetched data (or defaults from error objects)
                setUserInfo(userRes.data);
                setOverviewSuggestion(overviewRes.data.overview);
                setTrendSummary(trendRes.data.summary);
                setGrowthForecast(forecastRes.data.forecast);
                setMarketData(marketRes.data);

            } catch (err) {
                console.error("Dashboard fetch error:", err);
                setError(err.message || "An error occurred while loading dashboard data.");
                 // Optionally clear states if critical data failed
                 setUserInfo(null);
                 setMarketData(null);
            } finally {
                setPageLoading(false);
            }
        };

        fetchDashboardData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router]); // Run once on mount, or re-run if router changes (though unlikely needed)


    // --- Loading / Error State Rendering ---
    if (pageLoading) {
        return <DashboardLayout><div className="p-10 text-center">Loading Dashboard...</div></DashboardLayout>;
    }
    // Handle error state more gracefully
    if (error) {
         return <DashboardLayout><div className="p-10 text-center text-red-600">Error: {error} <Link href="/" className="text-blue-600 underline ml-2">Go Home</Link></div></DashboardLayout>;
    }
    // Handle case where essential data couldn't load even if no specific error was thrown
    if (!userInfo || !marketData) {
        return <DashboardLayout><div className="p-10 text-center text-orange-600">Could not load complete dashboard data. Please try refreshing.</div></DashboardLayout>;
    }


    // --- Calculate Derived Values ---
    const goldBalanceGrams = userInfo.goldBalanceGrams ?? 0;
    const currentPricePerGram = marketData.latestPricePerGram ?? 0;
    const goldValueLKR = goldBalanceGrams * currentPricePerGram;

    // Find last purchase info (handle empty transactions)
    const lastInvestment = userInfo.transactions?.filter(t => t.type === 'investment').sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    const lastPurchaseDate = lastInvestment ? formatDate(lastInvestment.date) : 'N/A';
    const lastPurchaseAmount = lastInvestment ? formatCurrency(lastInvestment.amountLKR) : 'N/A';
    const lastPurchaseGrams = lastInvestment ? lastInvestment.amountGrams.toFixed(3) + 'g' : 'N/A';


    // --- Render Dashboard Content ---
    return (
        <DashboardLayout>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column (col-span-2) - User Holdings & Overview */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Your Gold Holdings Section */}
                    <section className="bg-white p-4 md:p-6 rounded-lg shadow-md">
                        <h2 className="text-lg md:text-xl font-semibold mb-4">Your Gold Holdings</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Balance Display */}
                            <div className="md:col-span-1">
                                <p className="text-xs md:text-sm text-gray-500">Total gold owned</p>
                                <p className="text-xl md:text-2xl font-bold">{goldBalanceGrams.toFixed(3)} g</p>
                                <p className="text-sm md:text-base text-gray-700">~ {formatCurrency(goldValueLKR)}</p>
                            </div>
                             {/* Last Purchase Display */}
                             <div className="md:col-span-1 border-t md:border-t-0 md:border-l md:pl-4 pt-4 md:pt-0">
                                <p className="text-xs md:text-sm text-gray-500">Last purchase</p>
                                 <p className="text-sm md:text-base font-semibold">{lastPurchaseAmount} ({lastPurchaseGrams})</p>
                                <p className="text-xs text-gray-500">{lastPurchaseDate}</p>
                             </div>
                            {/* Overview (AI) */}
                             <div className="md:col-span-1 border-t md:border-t-0 md:border-l md:pl-4 pt-4 md:pt-0">
                                 <h3 className="text-sm md:text-base font-semibold mb-1">Overview</h3>
                                 <p className="text-xs md:text-sm text-gray-600 leading-relaxed">{overviewSuggestion}</p>
                             </div>
                        </div>
                    </section>

                    {/* Buy your gold now Section */}
                    <section className="bg-gradient-to-r from-yellow-400 to-amber-500 p-6 rounded-lg shadow-md text-white">
                        <h2 className="text-xl font-bold mb-2">Buy your gold now with just 2 clicks!</h2>
                        <p className="text-sm mb-4">
                            📈 Trend shows potential growth according to this month. <br />
                            Estimated growth in next month: <span className="font-bold">{growthForecast}</span>
                        </p>
                        <Link href="/invest">
                            <button className="bg-white text-yellow-600 font-bold py-2 px-6 rounded hover:bg-gray-100 transition-colors">Buy Gold</button>
                        </Link>
                    </section>

                    {/* Gamification / Alerts / Redeem (Placeholders/Simulated) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                        <section className="bg-white p-4 rounded-lg shadow-md">
                            <h3 className="font-semibold mb-2 text-sm md:text-base">Gamification</h3>
                            <p className="text-xs md:text-sm text-gray-500">Earn badges & rewards!</p>
                            <Link href="/wallet#gamification"> {/* Link to relevant section */}
                               <span className="text-xs text-yellow-600 hover:underline cursor-pointer mt-1 inline-block">View Progress</span>
                            </Link>
                        </section>
                        <section className="bg-white p-4 rounded-lg shadow-md">
                            <h3 className="font-semibold mb-2 text-sm md:text-base">Alerts</h3>
                            {/* Logic to show real alerts would go here */}
                             <p className="text-xs md:text-sm text-gray-500">No new alerts.</p>
                             {/* <button className="text-xs text-yellow-600 hover:underline cursor-pointer mt-1 inline-block">See All</button> */}
                        </section>
                        <section className="bg-white p-4 rounded-lg shadow-md">
                            <h3 className="font-semibold mb-2 text-sm md:text-base">Redeem Gold</h3>
                             <p className="text-xs md:text-sm text-gray-500">Convert digital gold to physical coins.</p>
                             <Link href="/wallet#redeem"> {/* Link to relevant section */}
                               <span className="text-xs text-yellow-600 hover:underline cursor-pointer mt-1 inline-block">Redeem Now</span>
                             </Link>
                        </section>
                    </div>
                </div>

                {/* Right Column (col-span-1) - Gold Live Price */}
                <div className="lg:col-span-1 space-y-6">
                    <section className="bg-white p-4 md:p-6 rounded-lg shadow-md">
                        <h2 className="text-lg md:text-xl font-semibold mb-4">Gold Live Price <span className="text-xs text-gray-500 font-normal">(LKR / gram)</span></h2>
                        <div className="text-center mb-4">
                            <p className="text-2xl md:text-3xl font-bold">{formatCurrency(currentPricePerGram)}</p>
                            <p className="text-xs md:text-sm text-gray-500">As of {formatDate(marketData.latestDate)}</p>
                            <p className={`text-sm font-medium ${marketData.priceChangePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {marketData.priceChangePercent >= 0 ? '▲' : '▼'} {marketData.priceChangePercent.toFixed(2)}% <span className="text-gray-500 text-xs">(vs yesterday)</span>
                            </p>
                        </div>
                        {/* Small chart/previous days */}
                        <div className="space-y-2 border-t pt-4 mb-4">
                            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Recent Prices</h4>
                            {marketData.previousDaysData?.length > 0 ? (
                                marketData.previousDaysData.map((dayData, index) => (
                                    <div key={index} className="flex justify-between text-xs md:text-sm">
                                        <span className="text-gray-500">{new Date(dayData.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                                        <span className="font-medium">{formatCurrency(dayData.pricePerOz / 31.1034768)}</span> {/* Convert to per gram */}
                                    </div>
                                ))
                            ) : (
                                <p className="text-xs text-gray-400">Previous data not available.</p>
                            )}
                        </div>
                        {/* AI Trend Summary */}
                        <div className="border-t pt-4">
                             <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Trend Insight</h4>
                            <p className="text-xs md:text-sm text-gray-600 leading-relaxed">{trendSummary}</p>
                        </div>
                        {/* Link to see full history maybe */}
                         <div className="text-center mt-4">
                             <Link href="/market"> {/* Assuming market page shows more history */}
                                <span className="text-xs text-yellow-600 hover:underline cursor-pointer">See Full Market Details</span>
                             </Link>
                         </div>
                    </section>
                </div>

            </div>
        </DashboardLayout>
    );
}