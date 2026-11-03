const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Extracts plain text from various file formats
 */
async function extractTextFromFile(filePath, mimeType) {
    if (!fs.existsSync(filePath)) {
        throw new Error('File does not exist on server.');
    }

    const ext = path.extname(filePath).toLowerCase();

    try {
        if (ext === '.pdf' || mimeType === 'application/pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer);
            return data.text || '';
        }

        if (ext === '.docx' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ path: filePath });
            return result.value || '';
        }

        if (['.txt', '.csv', '.json', '.md', '.js', '.ts', '.py', '.html', '.css', '.xml'].includes(ext) ||
            mimeType.startsWith('text/') || mimeType.includes('json') || mimeType.includes('csv')) {
            return fs.readFileSync(filePath, 'utf8');
        }

        if (isImageFile(ext, mimeType)) {
            // For images, return base64 representation
            const buffer = fs.readFileSync(filePath);
            const base64 = buffer.toString('base64');
            const actualMime = mimeType || getImageMime(ext);
            return `data:${actualMime};base64,${base64}`;
        }

        return '[Binary file content unsupported for direct text extraction]';
    } catch (error) {
        console.error(`Error extracting content from ${filePath}:`, error.message);
        return `[Error extracting text from file: ${error.message}]`;
    }
}

function isImageFile(ext, mimeType) {
    const imgExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
    return imgExts.includes(ext) || (mimeType && mimeType.startsWith('image/'));
}

function getImageMime(ext) {
    switch (ext) {
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.png':
            return 'image/png';
        case '.webp':
            return 'image/webp';
        case '.gif':
            return 'image/gif';
        default:
            return 'image/jpeg';
    }
}

module.exports = {
    extractTextFromFile,
    isImageFile
};
