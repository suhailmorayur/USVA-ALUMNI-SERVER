const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Downloads an image from a URL as an ArrayBuffer
 */
const downloadImageBuffer = async (url) => {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  } catch (error) {
    console.error(`Error downloading image from ${url}:`, error.message);
    throw new Error(`Failed to retrieve student photo: ${error.message}`);
  }
};

const sharp = require('sharp');

/**
 * Applies rounded corners to an image buffer using sharp
 */
const roundImageCorners = async (imageBuffer, width, height, radius) => {
  const svgMask = Buffer.from(
    `<svg width="${width}" height="${height}">
       <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="white"/>
     </svg>`
  );

  return await sharp(imageBuffer)
    .resize(width, height, { fit: 'cover' })
    .composite([{
      input: svgMask,
      blend: 'dest-in'
    }])
    .png()
    .toBuffer();
};

/**
 * Generates a two-page PDF for a member: Page 1 Front, Page 2 Back
 * Supports both portrait and landscape layouts.
 * @param {Object} member - The member document
 * @param {String} validity - Configured membership validity date (e.g., 'Mar 2028')
 * @param {String} layout - Layout format: 'portrait' (student) or 'landscape' (admin bulk print)
 * @returns {Promise<Buffer>} The PDF buffer
 */
const generateMemberPDF = async (member, validity = 'Mar 2028', layout = 'portrait') => {
  try {
    const pdfDoc = await PDFDocument.create();

    // Map Template Assets based on Layout
    let frontPath, backPath, cardWidth, cardHeight;

    if (layout === 'portrait') {
      frontPath = path.join(__dirname, '../assets/card-front-portrait.png');
      backPath = path.join(__dirname, '../assets/card-back-portrait.png');
      cardWidth = 638;
      cardHeight = 1004;
    } else {
      frontPath = path.join(__dirname, '../assets/card-front.png');
      backPath = path.join(__dirname, '../assets/card-back.jpg');
      cardWidth = 1004;
      cardHeight = 638;
    }

    if (!fs.existsSync(frontPath) || !fs.existsSync(backPath)) {
      throw new Error(`Card templates for layout [${layout}] not found on server.`);
    }

    const frontBytes = fs.readFileSync(frontPath);
    const backBytes = fs.readFileSync(backPath);

    const frontImage = await pdfDoc.embedPng(frontBytes);
    
    // Embed back image template dynamically depending on extension (.png vs .jpg)
    const backImage = backPath.toLowerCase().endsWith('.png')
      ? await pdfDoc.embedPng(backBytes)
      : await pdfDoc.embedJpg(backBytes);

    // Set Up Pages
    const page1 = pdfDoc.addPage([cardWidth, cardHeight]);
    const page2 = pdfDoc.addPage([cardWidth, cardHeight]);

    // Draw backgrounds
    page1.drawImage(frontImage, { x: 0, y: 0, width: cardWidth, height: cardHeight });
    page2.drawImage(backImage, { x: 0, y: 0, width: cardWidth, height: cardHeight });

    // Embed fonts
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const hasSanad = member.sand && member.sand.length > 0;
    let sanadText = '';
    if (hasSanad) {
      if (member.sand.includes('umari') && member.sand.includes('faizy')) {
        sanadText = 'Umari Faizy';
      } else if (member.sand.includes('umari')) {
        sanadText = 'Umari';
      } else if (member.sand.includes('faizy')) {
        sanadText = 'Faizy';
      }
    }

    // Coordinate Math based on Layout
    if (layout === 'portrait') {
      // 1. Mask validity text area "Valid up to Mar 2028" in the top right box
      // Solid background color at validity box: #08aed0 (rgb: 8, 170, 208)
      const valBoxWidth = 220;
      const valBoxHeight = 62;
      const valBoxX = 388;
      const valBoxY = 805;

      page1.drawRectangle({
        x: valBoxX,
        y: valBoxY,
        width: valBoxWidth,
        height: valBoxHeight,
        color: rgb(8 / 255, 170 / 255, 208 / 255)
      });

      // Draw validity text (Centered inside validity box)
      const validityText = `Valid up to ${validity}`;
      const valTextWidth = helvetica.widthOfTextAtSize(validityText, 13);
      const valX = valBoxX + (valBoxWidth - valTextWidth) / 2;
      page1.drawText(validityText, {
        x: valX,
        y: valBoxY + 24,
        size: 13,
        font: helvetica,
        color: rgb(1, 1, 1)
      });

      // 2. Student Photo Box (Reference coordinates)
      const containerX = 93;
      const containerY = 1004 - 210 - 274; // bottom-up Y from top-down Y=210 and height=274
      const containerWidth = 209;
      const containerHeight = 274;
      const borderWidth = 8;

      // Draw white container card behind photo
      page1.drawRectangle({
        x: containerX,
        y: containerY,
        width: containerWidth,
        height: containerHeight,
        color: rgb(1, 1, 1)
      });

      // Draw photo inside container card
      const photoX = containerX + borderWidth;
      const photoY = containerY + borderWidth;
      const photoWidth = containerWidth - (2 * borderWidth);
      const photoHeight = containerHeight - (2 * borderWidth);

      try {
        const photoBuffer = await downloadImageBuffer(member.photoUrl);
        const isPng = member.photoUrl.toLowerCase().endsWith('.png');
        const studentPhoto = isPng 
          ? await pdfDoc.embedPng(photoBuffer) 
          : await pdfDoc.embedJpg(photoBuffer);

        page1.drawImage(studentPhoto, {
          x: photoX,
          y: photoY,
          width: photoWidth,
          height: photoHeight
        });
      } catch (photoError) {
        console.error('Failed to embed portrait photo, using placeholder:', photoError.message);
        page1.drawRectangle({
          x: photoX,
          y: photoY,
          width: photoWidth,
          height: photoHeight,
          color: rgb(0.95, 0.95, 0.95)
        });
      }

      // 3. Student Name (Reference specifications)
      const name = member.fullName.toUpperCase();
      const nameFontSize = 28; // 40px proportional translation
      const nameX = 96;
      const nameY = 1004 - 546 - nameFontSize; // top-down Y=546 and font offset

      page1.drawText(name, {
        x: nameX,
        y: nameY,
        size: nameFontSize,
        font: helveticaBold,
        color: rgb(1, 1, 1)
      });

      // 4. Sanad (Reference specifications)
      if (hasSanad) {
        const sanad = sanadText.toUpperCase();
        const sanadFontSize = 24; // 36px proportional translation
        const sanadX = 96;
        const sanadY = 1004 - 589 - sanadFontSize; // top-down Y=589 and font offset

        page1.drawText(sanad, {
          x: sanadX,
          y: sanadY,
          size: sanadFontSize,
          font: helveticaBold,
          color: rgb(226 / 255, 235 / 255, 18 / 255)
        });
      }

      // 5. Details rows (Place, Ad. No, Phone only - Reference specifications)
      const detailColor = rgb(0, 0, 0); // Solid black details text
      const detailSize = 16;            // 25px proportional translation
      const startX = 155;               // Starts at X=155
      const colonX = 266;               // Colon aligned at X=266
      const valueX = 300;               // Value aligned at X=300

      // Rows top-down Y values: Place=704, Ad.No=736, Phone=766
      const details = [
        { label: 'Place', value: member.place, topDownY: 704 },
        { label: 'Ad. No', value: member.admissionNumber, topDownY: 736 },
        { label: 'Phone', value: member.phone, topDownY: 766 }
      ];

      details.forEach((item) => {
        const yOffset = 1004 - item.topDownY - detailSize;
        
        // Draw label
        page1.drawText(item.label, {
          x: startX,
          y: yOffset,
          size: detailSize,
          font: helveticaBold,
          color: detailColor
        });

        // Draw colon
        page1.drawText(':', {
          x: colonX,
          y: yOffset,
          size: detailSize,
          font: helveticaBold,
          color: detailColor
        });

        // Draw value
        page1.drawText(item.value, {
          x: valueX,
          y: yOffset,
          size: detailSize,
          font: helveticaBold,
          color: detailColor
        });
      });

    } else {
      const photoX = 100;
      const photoY = 638 - 80 - 310; // top-down Y=80, height=310
      const photoWidth = 240;
      const photoHeight = 310;

      try {
        const photoBuffer = await downloadImageBuffer(member.photoUrl);
        const roundedPhotoBuffer = await roundImageCorners(photoBuffer, photoWidth, photoHeight, 28);
        const studentPhoto = await pdfDoc.embedPng(roundedPhotoBuffer);

        page1.drawImage(studentPhoto, {
          x: photoX,
          y: photoY,
          width: photoWidth,
          height: photoHeight
        });
      } catch (photoError) {
        console.error('Failed to embed landscape photo, using placeholder:', photoError.message);
        try {
          const placeholderBuffer = await sharp({
            create: {
              width: photoWidth,
              height: photoHeight,
              channels: 3,
              background: { r: 242, g: 242, b: 242 }
            }
          }).png().toBuffer();
          const roundedPlaceholder = await roundImageCorners(placeholderBuffer, photoWidth, photoHeight, 28);
          const placeholderPhoto = await pdfDoc.embedPng(roundedPlaceholder);
          page1.drawImage(placeholderPhoto, {
            x: photoX,
            y: photoY,
            width: photoWidth,
            height: photoHeight
          });
        } catch (err) {
          page1.drawRectangle({
            x: photoX,
            y: photoY,
            width: photoWidth,
            height: photoHeight,
            color: rgb(0.95, 0.95, 0.95)
          });
        }
      }

      // 3. Align text layout (Name, Sanad on the right of photo)
      const name = member.fullName.toUpperCase();
      const nameFontSize = 34;
      const nameX = 400;
      const nameY = 638 - 120 - nameFontSize; // top-down Y=120

      page1.drawText(name, {
        x: nameX,
        y: nameY,
        size: nameFontSize,
        font: helveticaBold,
        color: rgb(1, 1, 1)
      });

      // Draw Sanad directly below name with no vertical gap
      if (hasSanad) {
        const sanad = sanadText.toUpperCase();
        const sanadFontSize = 34;
        const sanadX = 400;
        const sanadY = 638 - 154 - sanadFontSize; // top-down Y=154 (120 name + 34 name size)

        page1.drawText(sanad, {
          x: sanadX,
          y: sanadY,
          size: sanadFontSize,
          font: helveticaBold,
          color: rgb(226 / 255, 235 / 255, 18 / 255)
        });
      }

      // 4. Draw Details inside the dark blue section (bold black text, 50px gap below Sanad)
      const detailColor = rgb(0, 0, 0); // Bold black details text
      const detailSize = 18;
      const startX = 400;
      const colonX = 490;
      const valueX = 510;

      const details = [
        { label: 'Place', value: member.place, topDownY: 238 },
        { label: 'Ad. No', value: member.admissionNumber, topDownY: 270 },
        { label: 'Phone', value: member.phone, topDownY: 302 }
      ];

      details.forEach((item) => {
        const yOffset = 638 - item.topDownY - detailSize;
        
        page1.drawText(item.label, {
          x: startX,
          y: yOffset,
          size: detailSize,
          font: helveticaBold,
          color: detailColor
        });

        page1.drawText(':', {
          x: colonX,
          y: yOffset,
          size: detailSize,
          font: helveticaBold,
          color: detailColor
        });

        page1.drawText(item.value, {
          x: valueX,
          y: yOffset,
          size: detailSize,
          font: helveticaBold,
          color: detailColor
        });
      });
    }

    // Save and Return Buffer
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error('PDF Generation Service error:', error);
    throw new Error('PDF Generation failed: ' + (error.message || error));
  }
};

/**
 * Server-side merges multiple individual PDF buffers into a single bulk PDF doc
 * @param {Array<Buffer>} pdfBuffers - List of PDF buffers
 * @returns {Promise<Buffer>} Merged PDF buffer
 */
const mergePDFs = async (pdfBuffers) => {
  try {
    const mergedDoc = await PDFDocument.create();
    
    for (const buffer of pdfBuffers) {
      const doc = await PDFDocument.load(buffer);
      const copiedPages = await mergedDoc.copyPages(doc, doc.getPageIndices());
      copiedPages.forEach((page) => mergedDoc.addPage(page));
    }
    
    const mergedBytes = await mergedDoc.save();
    return Buffer.from(mergedBytes);
  } catch (error) {
    console.error('PDF Merging Service error:', error);
    throw new Error('PDF Merging failed: ' + error.message);
  }
};

module.exports = {
  generateMemberPDF,
  mergePDFs
};
