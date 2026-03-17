import sharp from 'sharp';
import fs from 'fs';

async function processImage(inputPath, outputPath) {
    if (!fs.existsSync(inputPath)) {
        console.log(`File not found: ${inputPath}`);
        return;
    }

    try {
        console.log(`Processing ${inputPath}...`);
        await sharp(inputPath)
            .trim()
            .toFile(outputPath);
        console.log(`Successfully cropped and saved to ${outputPath}`);
    } catch (err) {
        console.error(`Error processing ${inputPath}:`, err);
    }
}

async function main() {
    await processImage('dist/CSSuper.png', 'public/CSSuper.png');
    await processImage('dist/CSicon.png', 'public/CSicon.png');
}

main();
