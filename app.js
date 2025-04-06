const express = require('express');
const multer = require('multer');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/generated_pdfs', express.static(path.join(__dirname, 'generated_pdfs')));

// Ensure necessary folders exist
['uploads', 'generated_pdfs', 'assets'].forEach((dir) => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath);
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

const DATA_FILE = 'data.json';
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');

// 📥 Upload Route
app.post('/upload', upload.single('image'), (req, res) => {
  const { flatNumber, personName } = req.body;
  const imagePath = req.file.path;
  const date = new Date();

  const record = { flatNumber, personName, imagePath, date };
  const data = JSON.parse(fs.readFileSync(DATA_FILE));
  data.push(record);
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));

  const timestamp = path.basename(imagePath).split('-')[0];
  const pdfName = `${timestamp}-${personName}.pdf`;
  const pdfPath = path.join(__dirname, 'generated_pdfs', pdfName);

  generatePDF(record, pdfPath, () => {
    res.download(pdfPath);
  });
});

// 👨‍💼 Admin Panel
app.get('/admin', (req, res) => {
  const data = JSON.parse(fs.readFileSync(DATA_FILE));
  let html = `
    <style>
      table { border-collapse: collapse; width: 100%; margin-top: 20px; }
      th, td { padding: 12px; border: 1px solid #ccc; text-align: left; }
      th { background-color: #f2f2f2; }
      body { font-family: Arial, sans-serif; margin: 20px; }
    </style>
    <h2>Uploaded Records</h2>
    <table>
      <tr>
        <th>Date</th>
        <th>Person Name</th>
        <th>Flat Number</th>
        <th>Download PDF</th>
      </tr>
  `;

  data.forEach((d) => {
    const formattedDate = formatDate(d.date);
    const timestamp = path.basename(d.imagePath).split('-')[0];
    const pdfName = `${timestamp}-${d.personName}.pdf`;
    html += `
      <tr>
        <td>${formattedDate}</td>
        <td>${d.personName}</td>
        <td>${d.flatNumber}</td>
        <td><a href="/generated_pdfs/${pdfName}" target="_blank">Download</a></td>
      </tr>
    `;
  });

  html += '</table>';
  res.send(html);
});

// 📄 Generate PDF
function generatePDF(record, filePath, callback) {
  const doc = new PDFDocument();
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const logoPath = path.join(__dirname, 'assets/society_logo.png');
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 50, 50, { width: 100 });
  }

  doc.fontSize(18).text('Society Entry Record', 200, 50);
  doc.moveDown();
  doc.fontSize(14).text(`Flat Number: ${record.flatNumber}`);
  doc.text(`Name: ${record.personName}`);
  doc.text(`${formatDate(record.date)}`);
  doc.moveDown();

  doc.text('Uploaded Image:', { underline: true });
  doc.moveDown(0.5);
  doc.image(record.imagePath, {
    fit: [400, 300],
    align: 'center',
  });

  // Move signature to the bottom of the page
  const signaturePath = path.join(__dirname, 'assets/signature.png');
  if (fs.existsSync(signaturePath)) {
    const pageHeight = doc.page.height;
    const bottomY = pageHeight - 120; // push it near the bottom

    doc.image(signaturePath, 50, bottomY, { width: 100 });
    doc.text('Chairman Signature', 160, bottomY + 30);
  }

  doc.end();
  stream.on('finish', callback);
}

// 🗓 Format date like "Date: 06/04/2025, 1:50 PM"
function formatDate(date) {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `Date: ${day}/${month}/${year}, ${hours}:${minutes} ${ampm}`;
}

app.listen(3000, () => {
  console.log('✅ Server running at http://localhost:3000');
});
