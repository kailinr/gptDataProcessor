const cors = require('cors');
const express = require('express');
const multer = require('multer');
const pdf = require('pdf-parse');
const { convertToPlainText } = require('mammoth');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let fetch;
import('node-fetch').then(module => {
    fetch = module.default;
});

const app = express();
const port = 3000;
app.use(cors());

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.json());

app.post('/upload', upload.array('documents'), async (req, res) => {

  console.log("Upload endpoint hit. Processing uploaded files...");

  const files = req.files;
  let textData = [];
  let unsupportedFiles = [];
  
  for (let file of files) {
      if (file.mimetype === 'application/pdf') {
          const data = await pdf(file.buffer);
          textData.push(data.text);
      } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          const { value: text } = await convertToPlainText({ buffer: file.buffer });
          textData.push(text);
      } else {
          unsupportedFiles.push(file.originalname); // Track unsupported files
      }
  }

  // If there are unsupported files, send an error response
  if (unsupportedFiles.length > 0) {
      return res.status(400).json({ 
          error: "Unsupported file types uploaded", 
          files: unsupportedFiles
      });
  }

  const jsonlData = textData.map(text => JSON.stringify({ text: text })).join('\n');
  fs.writeFileSync('output.jsonl', jsonlData);

  res.json({ success: true });
});
    
  
app.post('/fetch-url', async (req, res) => {
    const url = req.body.url;
    const response = await fetch(url);
    const html = await response.text();
    fs.appendFileSync('output.jsonl', JSON.stringify({ text: html }) + '\n');
    res.json({ success: true });
});

//This method uses a Blob object, which represents file-like objects of immutable raw data.
app.get('/download', (req, res) => {
  const filePath = path.join(__dirname, 'output.jsonl');
  if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      console.log("Downloaded");
      res.json({ fileContent: content });
  } else {
      res.status(404).json({ error: "File not found" });
  }
});



app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});

