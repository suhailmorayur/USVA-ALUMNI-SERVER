const sharp = require('sharp');
const path = require('path');

async function check() {
  const dir = path.join(__dirname, 'assets');
  const frontMeta = await sharp(path.join(dir, 'card-front-portrait.webp')).metadata();
  const backMeta = await sharp(path.join(dir, 'card-back-portrait.webp')).metadata();
  
  console.log('Front portrait metadata:', {
    width: frontMeta.width,
    height: frontMeta.height,
    orientation: frontMeta.orientation
  });
  
  console.log('Back portrait metadata:', {
    width: backMeta.width,
    height: backMeta.height,
    orientation: backMeta.orientation
  });
}

check().catch(console.error);
