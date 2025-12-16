const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

moment.locale('id');

class PDFService {
  
  // BAPB PDF GENERATION
  buildBAPBPDF(data, signatures, stream) {
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 50,
      info: {
        Title: `BAPB - ${data.bapbNumber}`,
        Author: 'BA Digital System',
        Subject: 'Berita Acara Pemeriksaan Barang'
      }
    });

    doc.pipe(stream);

    // ========== HEADER SECTION ==========
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .text('BERITA ACARA PEMERIKSAAN BARANG', { align: 'center' })
       .moveDown(0.3);
    
    doc.fontSize(12)
       .font('Helvetica')
       .text('(BAPB)', { align: 'center' })
       .moveDown(0.5);
    
    doc.fontSize(10)
       .text(`Nomor: ${data.bapbNumber}`, { align: 'center' })
       .moveDown(1.5);

    // ========== INFORMASI UMUM ==========
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('I. INFORMASI UMUM', { underline: true })
       .moveDown(0.5);

    doc.fontSize(10)
       .font('Helvetica');
    
    // Data rows dengan proper alignment
    const infoData = [
      ['Nomor Order', `: ${data.orderNumber}`],
      ['Tanggal Pengiriman', `: ${moment(data.deliveryDate).format('DD MMMM YYYY')}`],
      ['Nama Vendor', `: ${data.vendor?.name || '-'}`],
      ['Perusahaan', `: ${data.vendor?.company || '-'}`],
      ['Status', `: ${this.getStatusLabel(data.status)}`]
    ];

    infoData.forEach(([label, value]) => {
      doc.text(label, 50, doc.y, { continued: true, width: 150 })
         .text(value, { width: 350 });
    });

    doc.moveDown(1);

    // ========== DAFTAR BARANG ==========
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('II. DAFTAR BARANG YANG DITERIMA', { underline: true })
       .moveDown(0.5);

    // Table Header
    const tableTop = doc.y;
    const colWidths = [30, 180, 70, 70, 60, 80];
    const colPositions = [50];
    
    for (let i = 1; i < colWidths.length; i++) {
      colPositions.push(colPositions[i-1] + colWidths[i-1]);
    }

    const headers = ['No', 'Nama Barang', 'Qty Order', 'Qty Terima', 'Satuan', 'Kondisi'];
    
    doc.fontSize(9).font('Helvetica-Bold');
    headers.forEach((header, i) => {
      doc.text(header, colPositions[i], tableTop, { 
        width: colWidths[i], 
        align: i === 0 ? 'center' : 'left' 
      });
    });

    // Table line
    doc.moveTo(50, tableTop + 15)
       .lineTo(545, tableTop + 15)
       .stroke();

    // Table Body
    let yPosition = tableTop + 25;
    doc.fontSize(9).font('Helvetica');

    data.items?.forEach((item, index) => {
      // Check for page break
      if (yPosition > 720) {
        doc.addPage();
        yPosition = 50;
      }

      const rowData = [
        (index + 1).toString(),
        item.itemName,
        item.quantityOrdered.toString(),
        item.quantityReceived.toString(),
        item.unit,
        this.getConditionLabel(item.condition)
      ];

      rowData.forEach((text, i) => {
        doc.text(text, colPositions[i], yPosition, { 
          width: colWidths[i],
          align: i === 0 || i === 2 || i === 3 ? 'center' : 'left'
        });
      });

      // Add notes if exists
      if (item.notes) {
        yPosition += 15;
        doc.fontSize(8)
           .fillColor('#666666')
           .text(`Catatan: ${item.notes}`, colPositions[1], yPosition, { width: 400 })
           .fillColor('#000000')
           .fontSize(9);
      }

      yPosition += 25;
    });

    // ========== CATATAN ==========
    if (data.notes) {
      doc.moveDown(2);
      if (doc.y > 650) doc.addPage();
      
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('III. CATATAN', { underline: true })
         .moveDown(0.5);
      
      doc.fontSize(10)
         .font('Helvetica')
         .text(data.notes)
         .moveDown(1);
    }

    // ========== REJECTION REASON (if applicable) ==========
    if (data.status === 'rejected' && data.rejectionReason) {
      if (doc.y > 650) doc.addPage();
      
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .fillColor('#DC2626')
         .text('ALASAN PENOLAKAN', { underline: true })
         .moveDown(0.5);
      
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor('#000000')
         .text(data.rejectionReason)
         .moveDown(1);
    }

    // ========== TANDA TANGAN ==========
    doc.addPage();
    
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('IV. PERSETUJUAN', { underline: true })
       .moveDown(1);

    const signatureY = doc.y;
    const leftX = 100;
    const rightX = 380;

    // Vendor Signature (Left)
    doc.fontSize(10).font('Helvetica');
    doc.text('Diserahkan oleh:', leftX - 30, signatureY, { align: 'left' });
    doc.text('Vendor/Penyedia', leftX - 30, signatureY + 15, { align: 'left' });

    if (signatures.vendorSignature && fs.existsSync(signatures.vendorSignature)) {
      try {
        doc.image(signatures.vendorSignature, leftX - 20, signatureY + 35, { 
          width: 120, 
          height: 60,
          fit: [120, 60]
        });
      } catch (err) {
        console.error('Error loading vendor signature:', err);
        doc.text('[Tanda tangan tidak tersedia]', leftX, signatureY + 35);
      }
    } else {
      doc.text('(Belum ditandatangani)', leftX, signatureY + 50, { 
        align: 'center',
        width: 120 
      });
    }

    doc.text(`${data.vendor?.name || '_________________'}`, leftX - 30, signatureY + 105);
    doc.fontSize(8).text('Nama Vendor', leftX - 30, signatureY + 118);

    // PIC Gudang Signature (Right)
    doc.fontSize(10);
    doc.text('Diperiksa oleh:', rightX - 30, signatureY, { align: 'left' });
    doc.text('PIC Gudang', rightX - 30, signatureY + 15, { align: 'left' });

    if (signatures.picGudangSignature && fs.existsSync(signatures.picGudangSignature)) {
      try {
        doc.image(signatures.picGudangSignature, rightX - 20, signatureY + 35, { 
          width: 120, 
          height: 60,
          fit: [120, 60]
        });
      } catch (err) {
        console.error('Error loading PIC signature:', err);
        doc.text('[Tanda tangan tidak tersedia]', rightX, signatureY + 35);
      }
    } else {
      doc.text('(Belum ditandatangani)', rightX, signatureY + 50, { 
        align: 'center',
        width: 120 
      });
    }

    doc.text(`${data.picGudang?.name || '_________________'}`, rightX - 30, signatureY + 105);
    doc.fontSize(8).text('Nama PIC Gudang', rightX - 30, signatureY + 118);

    // ========== FOOTER ==========
    doc.fontSize(8)
       .fillColor('#666666')
       .text(
         `Dokumen ini digenerate oleh BA Digital System pada ${moment().format('DD MMMM YYYY HH:mm')} WIB`,
         50,
         750,
         { align: 'center', width: 495 }
       );

    doc.end();
  }

  // BAPP PDF GENERATION (Berita Acara Pemeriksaan Pekerjaan)
  buildBAPPPDF(data, signatures, stream) {
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 50,
      info: {
        Title: `BAPP - ${data.bappNumber}`,
        Author: 'BA Digital System',
        Subject: 'Berita Acara Pemeriksaan Pekerjaan'
      }
    });

    doc.pipe(stream);

    // ========== HEADER ==========
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .text('BERITA ACARA PEMERIKSAAN PEKERJAAN', { align: 'center' })
       .moveDown(0.3);
    
    doc.fontSize(12)
       .font('Helvetica')
       .text('(BAPP)', { align: 'center' })
       .moveDown(0.5);
    
    doc.fontSize(10)
       .text(`Nomor: ${data.bappNumber}`, { align: 'center' })
       .moveDown(1.5);

    // ========== INFORMASI PEKERJAAN ==========
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('I. INFORMASI PEKERJAAN', { underline: true })
       .moveDown(0.5);

    doc.fontSize(10).font('Helvetica');
    
    const projectInfo = [
      ['Nomor Kontrak/SPK', `: ${data.contractNumber}`],
      ['Nama Proyek', `: ${data.projectName}`],
      ['Lokasi Proyek', `: ${data.projectLocation}`],
      ['Periode Pelaksanaan', `: ${moment(data.startDate).format('DD MMMM YYYY')} s/d ${moment(data.endDate).format('DD MMMM YYYY')}`],
      ['Tanggal Selesai', `: ${data.completionDate ? moment(data.completionDate).format('DD MMMM YYYY') : 'Belum selesai'}`],
      ['Progress Keseluruhan', `: ${data.totalProgress}%`]
    ];

    projectInfo.forEach(([label, value]) => {
      doc.text(label, 50, doc.y, { continued: true, width: 150 })
         .text(value, { width: 350 });
    });

    doc.moveDown(1);

    // ========== DETAIL REKANAN ==========
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('II. DETAIL REKANAN', { underline: true })
       .moveDown(0.5);

    doc.fontSize(10).font('Helvetica');
    doc.text(`Nama Rekanan: ${data.vendor?.name || '-'}`);
    doc.text(`Perusahaan: ${data.vendor?.company || '-'}`);
    doc.moveDown(1);

    // ========== HASIL PEMERIKSAAN PEKERJAAN ==========
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('III. HASIL PEMERIKSAAN PEKERJAAN', { underline: true })
       .moveDown(0.5);

    // Work Items Table
    const tableTop = doc.y;
    const colWidths = [30, 140, 50, 80, 80, 60, 70];
    const colPositions = [50];
    
    for (let i = 1; i < colWidths.length; i++) {
      colPositions.push(colPositions[i-1] + colWidths[i-1]);
    }

    const headers = ['No', 'Item Pekerjaan', 'Unit', 'Rencana (%)', 'Aktual (%)', 'Deviasi', 'Kualitas'];
    
    doc.fontSize(8).font('Helvetica-Bold');
    headers.forEach((header, i) => {
      doc.text(header, colPositions[i], tableTop, { 
        width: colWidths[i], 
        align: 'center'
      });
    });

    doc.moveTo(50, tableTop + 20)
       .lineTo(545, tableTop + 20)
       .stroke();

    // Table Body
    let yPosition = tableTop + 28;
    doc.fontSize(8).font('Helvetica');

    data.workItems?.forEach((item, index) => {
      if (yPosition > 720) {
        doc.addPage();
        yPosition = 50;
      }

      const deviation = (parseFloat(item.actualProgress) - parseFloat(item.plannedProgress)).toFixed(2);
      const deviationColor = deviation >= 0 ? '#059669' : '#DC2626';

      const rowData = [
        (index + 1).toString(),
        item.workItemName,
        item.unit,
        item.plannedProgress.toString(),
        item.actualProgress.toString(),
        `${deviation > 0 ? '+' : ''}${deviation}%`,
        this.getQualityLabel(item.quality)
      ];

      rowData.forEach((text, i) => {
        if (i === 5) doc.fillColor(deviationColor);
        
        doc.text(text, colPositions[i], yPosition, { 
          width: colWidths[i],
          align: i === 0 || i > 2 ? 'center' : 'left'
        });
        
        if (i === 5) doc.fillColor('#000000');
      });

      if (item.notes) {
        yPosition += 15;
        doc.fontSize(7)
           .fillColor('#666666')
           .text(`Catatan: ${item.notes}`, colPositions[1], yPosition, { width: 350 })
           .fillColor('#000000')
           .fontSize(8);
      }

      yPosition += 25;
    });

    // ========== CATATAN UMUM ==========
    if (data.notes) {
      doc.moveDown(2);
      if (doc.y > 650) doc.addPage();
      
      doc.fontSize(12)
         .font('Helvetica-Bold')
         .text('IV. CATATAN UMUM', { underline: true })
         .moveDown(0.5);
      
      doc.fontSize(10)
         .font('Helvetica')
         .text(data.notes)
         .moveDown(1);
    }

    // ========== STATUS & PERSETUJUAN ==========
    doc.addPage();
    
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .text('V. STATUS DAN PERSETUJUAN', { underline: true })
       .moveDown(0.5);

    doc.fontSize(10).font('Helvetica');
    doc.text(`Status Dokumen: ${this.getStatusLabel(data.status)}`);
    
    if (data.status === 'rejected' && data.rejectionReason) {
      doc.fillColor('#DC2626')
         .text(`Alasan Penolakan: ${data.rejectionReason}`)
         .fillColor('#000000');
    }
    
    doc.moveDown(2);

    // Signatures
    const signatureY = doc.y;
    const leftX = 100;
    const rightX = 380;

    // Vendor Signature
    doc.text('Dibuat oleh:', leftX - 30, signatureY);
    doc.text('Vendor/Kontraktor', leftX - 30, signatureY + 15);

    if (signatures.vendorSignature && fs.existsSync(signatures.vendorSignature)) {
      try {
        doc.image(signatures.vendorSignature, leftX - 20, signatureY + 35, { 
          width: 120, 
          height: 60,
          fit: [120, 60]
        });
      } catch (err) {
        console.error('Error loading vendor signature:', err);
      }
    } else {
      doc.text('(Belum ditandatangani)', leftX, signatureY + 50, { 
        align: 'center',
        width: 120 
      });
    }

    doc.text(`${data.vendor?.name || '_________________'}`, leftX - 30, signatureY + 105);
    doc.fontSize(8).text('Nama Vendor', leftX - 30, signatureY + 118);

    // Direksi Pekerjaan Signature
    doc.fontSize(10);
    doc.text('Disetujui oleh:', rightX - 30, signatureY);
    doc.text('Direksi Pekerjaan', rightX - 30, signatureY + 15);

    if (signatures.approverSignature && fs.existsSync(signatures.approverSignature)) {
      try {
        doc.image(signatures.approverSignature, rightX - 20, signatureY + 35, { 
          width: 120, 
          height: 60,
          fit: [120, 60]
        });
      } catch (err) {
        console.error('Error loading approver signature:', err);
      }
    } else {
      doc.text('(Belum ditandatangani)', rightX, signatureY + 50, { 
        align: 'center',
        width: 120 
      });
    }

    const approverName = data.direksiPekerjaan?.name || 'Belum Ditunjuk';
    doc.text(approverName, rightX - 30, signatureY + 105);
    doc.fontSize(8).text('Direksi Pekerjaan', rightX - 30, signatureY + 118);

    // Footer
    doc.fontSize(8)
       .fillColor('#666666')
       .text(
         `Dokumen ini digenerate oleh BA Digital System pada ${moment().format('DD MMMM YYYY HH:mm')} WIB`,
         50,
         750,
         { align: 'center', width: 495 }
       );

    doc.end();
  }

  // PUBLIC API METHODS
  async generateBAPBPDF(bapbData, signatures = {}) {
    const outputDir = path.join(__dirname, '../../uploads/temp');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const fileName = `BAPB-${bapbData.bapbNumber.replace(/\//g, '-')}-${Date.now()}.pdf`;
    const outputPath = path.join(outputDir, fileName);

    return new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(outputPath);
      
      stream.on('finish', () => {
        resolve({ filePath: outputPath, fileName });
      });
      
      stream.on('error', (err) => {
        reject(new Error(`PDF generation failed: ${err.message}`));
      });

      this.buildBAPBPDF(bapbData, signatures, stream);
    });
  }

  async generateBAPPPDF(bappData, signatures = {}) {
    const outputDir = path.join(__dirname, '../../uploads/temp');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const fileName = `BAPP-${bappData.bappNumber.replace(/\//g, '-')}-${Date.now()}.pdf`;
    const outputPath = path.join(outputDir, fileName);

    return new Promise((resolve, reject) => {
      const stream = fs.createWriteStream(outputPath);
      
      stream.on('finish', () => {
        resolve({ filePath: outputPath, fileName });
      });
      
      stream.on('error', (err) => {
        reject(new Error(`PDF generation failed: ${err.message}`));
      });

      this.buildBAPPPDF(bappData, signatures, stream);
    });
  }

  // HELPER METHODS
  getStatusLabel(status) {
    const labels = {
      'draft': 'Draft',
      'submitted': 'Menunggu Review',
      'in_review': 'Sedang Direview',
      'approved': 'Disetujui',
      'rejected': 'Ditolak',
      'revision_required': 'Perlu Revisi'
    };
    return labels[status] || status;
  }

  getConditionLabel(condition) {
    const labels = {
      'baik': 'Baik',
      'rusak': 'Rusak',
      'kurang': 'Kurang Baik'
    };
    return labels[condition] || condition;
  }

  getQualityLabel(quality) {
    const labels = {
      'excellent': 'Sangat Baik',
      'good': 'Baik',
      'acceptable': 'Cukup',
      'poor': 'Kurang',
      'rejected': 'Ditolak'
    };
    return labels[quality] || quality;
  }
}

module.exports = new PDFService();