require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

const HF_API_URL = "https://api-inference.huggingface.co/models/deepset/roberta-base-squad2";

// Load resume text and split into chunks (~500 chars)
const resumeText = fs.readFileSync('resume.txt', 'utf-8');
const chunkSize = 500;
const resumeChunks = [];

for (let i = 0; i < resumeText.length; i += chunkSize) {
  resumeChunks.push(resumeText.slice(i, i + chunkSize));
}

// Simple function to find best matching chunk by keyword overlap
function findBestChunk(question) {
  const questionWords = question.toLowerCase().split(/\W+/);
  let bestChunk = resumeChunks[0];
  let bestScore = 0;

  for (const chunk of resumeChunks) {
    const chunkWords = chunk.toLowerCase().split(/\W+/);
    const commonWords = questionWords.filter(word => chunkWords.includes(word));
    if (commonWords.length > bestScore) {
      bestScore = commonWords.length;
      bestChunk = chunk;
    }
  }
  return bestChunk;
}

app.post('/ask', async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: "Please provide a question" });

  const context = findBestChunk(question);

  try {
    const response = await axios.post(
      HF_API_URL,
      { inputs: { question, context } },
      { headers: { Authorization: `Bearer ${process.env.HF_API_TOKEN}` } }
    );

    if (response.data.error) {
      return res.status(500).json({ error: response.data.error });
    }

    res.json({ answer: response.data.answer, context });
  } catch (error) {
    console.error("Hugging Face API error:", error.message);
    res.status(500).json({ error: "Error fetching answer from Hugging Face API" });
  }
});

app.get('/', (req, res) => res.send('Chatbot backend running'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
