const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const path = require('path');

/**
 * @route   GET /api/admin/forecast/:productId
 * @desc    Get 4-week sales forecast for a product
 * @access  Admin (Assumed)
 */
router.get('/forecast/:productId', (req, res) => {
    const { productId } = req.params;
    
    // Construct Path to forecast.py script
    const scriptPath = path.join(__dirname, '../scripts/forecast.py');

    // Spawn Python process
    // Note: Use 'python' or 'python3' depending on your environment
    const pythonProcess = spawn('python', [scriptPath, productId]);

    let stdoutData = '';
    let stderrData = '';

    // Capture stdout
    pythonProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
    });

    // Capture stderr
    pythonProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
    });

    // Process completion
    pythonProcess.on('close', (code) => {
        if (code !== 0) {
            console.error(`Forecasting script failed (code ${code}): ${stderrData}`);
            return res.status(500).json({ 
                status: 'error', 
                message: 'Forecasting script failed', 
                details: stderrData 
            });
        }

        try {
            const result = JSON.parse(stdoutData.trim());
            res.status(200).json(result);
        } catch (error) {
            console.error('Invalid JSON from script:', stdoutData);
            res.status(500).json({ 
                status: 'error', 
                message: 'Failed to parse forecasting data', 
                raw: stdoutData 
            });
        }
    });
});

module.exports = router;
