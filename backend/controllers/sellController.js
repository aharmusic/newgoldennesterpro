// backend/controllers/sellController.js
const User = require('../models/User');
const { getGoldMarketSummary } = require('../utils/goldDataUtils'); // Need current price

// @desc    Sell user's gold
// @route   POST /api/sell/gold
// @access  Private
const sellGold = async (req, res) => {
    const { amountGrams } = req.body; // User specifies how many grams to sell
    const userId = req.user._id;

    // Validation
    if (!amountGrams || isNaN(amountGrams) || Number(amountGrams) <= 0) {
        return res.status(400).json({ message: 'Invalid amount of grams to sell.' });
    }
    // Add minimum sell amount if desired (e.g., 0.01 grams)
    if (Number(amountGrams) < 0.001) {
        return res.status(400).json({ message: 'Minimum sell amount is 0.001 grams.' });
    }


    try {
        // --- Get Current Gold Price ---
        const marketSummary = getGoldMarketSummary();
        const currentPricePerGram = marketSummary.latestPricePerGram;

        if (currentPricePerGram <= 0) {
            return res.status(500).json({ message: 'Could not determine current gold selling price.' });
        }

        // --- Get User ---
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // --- Check Sufficient Gold Balance ---
        if (user.goldBalanceGrams < Number(amountGrams)) {
            return res.status(400).json({ message: 'Insufficient gold balance.' });
        }

        // --- Calculation ---
        const proceedsLKR = Number(amountGrams) * currentPricePerGram;
        // Consider adding a small transaction fee/spread here in a real app

        // --- Update Balances ---
        user.goldBalanceGrams -= Number(amountGrams);
        user.cashBalanceLKR += proceedsLKR; // Add proceeds to cash wallet

        // --- Add Transaction Record ---
        user.transactions.push({
            type: 'sell_gold',
            amountGrams: Number(amountGrams), // Record grams sold
            amountLKR: proceedsLKR, // Record LKR received
            description: `Sold ${Number(amountGrams).toFixed(4)}g gold @ ~${currentPricePerGram.toFixed(0)} LKR/g`,
            status: 'completed' // Selling is usually instant
        });

        const updatedUser = await user.save();

        // --- Success Response ---
        res.status(200).json({
            message: `Successfully sold ${Number(amountGrams).toFixed(4)}g of gold.`,
            newGoldBalanceGrams: updatedUser.goldBalanceGrams,
            newCashBalanceLKR: updatedUser.cashBalanceLKR,
            transaction: updatedUser.transactions[updatedUser.transactions.length - 1]
        });

    } catch (error) {
        console.error("Error during gold sell:", error);
        res.status(500).json({ message: 'Server Error during gold sell process.' });
    }
};

module.exports = { sellGold };