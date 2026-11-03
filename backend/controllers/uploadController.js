const path = require('path');
const fileExtractionService = require('../services/fileExtractionService');

async function handleFileUpload(req, res, next) {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        const file = req.file;
        const filePath = file.path;
        const mimeType = file.mimetype;

        const extractedText = await fileExtractionService.extractTextFromFile(filePath, mimeType);

        res.json({
            message: 'File uploaded and processed successfully',
            file: {
                original_name: file.originalname,
                saved_name: file.filename,
                path: filePath,
                size: file.size,
                mime_type: mimeType,
                extracted_text: extractedText
            }
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    handleFileUpload
};
