// backend/controllers/investmentController.js
const User = require('../models/User');
const mongoose = require('mongoose');
const { getGoldMarketSummary } = require('../utils/goldDataUtils'); // Import summary function

// @desc    Make a new investment (with optional auto-payment setup)
// @route   POST /api/investments/invest
// @access  Private (Requires authentication)
const makeInvestment = async (req, res) => {
    const { amountLKR, saveAsAuto, frequency } = req.body;
    const userId = req.user._id;

    // --- Basic Validation ---
    // Using Number() explicitly for clarity and consistency
    const investmentAmount = Number(amountLKR);
    if (isNaN(investmentAmount) || investmentAmount <= 0 || investmentAmount < 100) {
        return res.status(400).json({ message: 'Invalid investment amount (min Rs. 100).' });
    }

    // --- Auto Payment Frequency Validation ---
    const validFrequencies = ['daily', 'weekly', 'monthly', 'yearly'];
    if (saveAsAuto && (!frequency || !validFrequencies.includes(frequency))) {
        return res.status(400).json({ message: 'Invalid frequency selected for automatic payment.' });
    }

    try {
        // --- Get Current Gold Price ---
        const marketSummary = getGoldMarketSummary(); // Assuming this is synchronous or handles its own async if needed
        const currentPricePerGram = marketSummary.latestPricePerGram;

        if (!currentPricePerGram || currentPricePerGram <= 0) {
            console.error("CRITICAL: Failed to get valid gold price for investment calculation.");
            return res.status(500).json({ message: 'Could not determine current gold price. Please try again later.' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // --- Calculation ---
        const amountGrams = investmentAmount / currentPricePerGram; // Use dynamic price

        // --- Update User Document ---
        // 1. Update Gold Balance
        user.goldBalanceGrams += amountGrams;

        // 2. Add Transaction Record
        user.transactions.push({
            _id: new mongoose.Types.ObjectId(), // Generate explicit ID for transaction
            type: 'investment',
            amountGrams: amountGrams,
            amountLKR: investmentAmount,
            pricePerGramLKR: currentPricePerGram, // Store the price used for this transaction
            timestamp: new Date(), // Explicitly set timestamp
            description: `Invested Rs. ${investmentAmount.toFixed(2)} @ ~${currentPricePerGram.toFixed(0)} LKR/g`, // Add price context
        });

        // 3. Save Automatic Payment (if requested and not already existing)
        if (saveAsAuto === true && frequency) {
            const existingAutoPayment = user.automaticPayments.find(
                p => p.frequency === frequency && p.amountLKR === investmentAmount
            );

            if (!existingAutoPayment) {
                user.automaticPayments.push({
                    _id: new mongoose.Types.ObjectId(), // Generate explicit ID
                    frequency: frequency,
                    amountLKR: investmentAmount,
                    createdAt: new Date() // Add creation timestamp
                });
                console.log(`Auto payment added: ${frequency}, ${investmentAmount}`);
            } else {
                console.log(`Auto payment already exists, skipping add: ${frequency}, ${investmentAmount}`);
                // Optionally update existing auto-payment last attempted/succeeded timestamp if needed in future
            }
        }

        const updatedUser = await user.save();

        // Get the latest transaction (safer than relying on index if parallel ops happen, though unlikely here)
        const latestTransaction = updatedUser.transactions[updatedUser.transactions.length - 1];

        // --- Success Response ---
        res.status(200).json({
            message: `Investment successful! ${saveAsAuto && !existingAutoPayment ? `Automatic ${frequency} payment saved.` : (saveAsAuto && existingAutoPayment ? `Automatic ${frequency} payment already exists.` : '')}`.trim(),
            newGoldBalanceGrams: updatedUser.goldBalanceGrams,
            transaction: latestTransaction, // Send back the newly created transaction
            updatedUserInfo: { // Return comprehensive user info as before
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.phone,
                nic: updatedUser.nic,
                address: updatedUser.address,
                city: updatedUser.city,
                goldBalanceGrams: updatedUser.goldBalanceGrams,
                automaticPayments: updatedUser.automaticPayments,
                earnedBadgeIds: updatedUser.earnedBadgeIds,
                challengeProgress: updatedUser.challengeProgress,
                // Consider adding other relevant fields if needed by the frontend
            }
        });

    } catch (error) {
        console.error('Investment processing error:', error);
        // More specific error handling if possible (e.g., distinguish DB errors from logic errors)
        if (error.name === 'ValidationError') {
             return res.status(400).json({ message: 'Data validation failed.', details: error.message });
        }
        res.status(500).json({ message: 'Server error during investment process.' });
    }
};

module.exports = { makeInvestment };