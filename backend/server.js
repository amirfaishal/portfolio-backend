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

// Helper to check if the input contains any phrase in a list
function containsPhrase(input, phrases) {
  const lowerInput = input.toLowerCase();
  return phrases.some(phrase => lowerInput.includes(phrase));
}

// Conversational data
const greetings = ["hello", "hi", "hey", "good morning", "good afternoon", "good evening", "howdy"];
const greetingsResponses = [
  "Hello! How can I assist you today?",
  "Hi there! What would you like to know?",
  "Hey! I'm here to help you with any questions.",
  "Greetings! How can I help?"
];

const howAreYouQuestions = ["how are you", "how's it going", "how do you do", "what's up"];
const howAreYouResponses = [
  "I'm doing great, thanks for asking! How about you?",
  "I'm here and ready to help anytime!",
  "All good here! What can I do for you today?"
];

const thanksPhrases = ["thank you", "thanks", "thank"];
const thanksResponses = [
  "You're welcome! Happy to help.",
  "No problem! Let me know if you have more questions.",
  "Anytime! Feel free to ask me anything."
];

const emotions = {
  happy: ["happy", "glad", "joyful", "excited", "good"],
  sad: ["sad", "down", "unhappy", "depressed", "blue"],
  tired: ["tired", "sleepy", "exhausted", "fatigued"],
  stressed: ["stressed", "anxious", "nervous", "worried"]
};

const emotionReplies = {
  happy: ["That's awesome! I'm glad to hear you're feeling good.", "Yay! Keep that positive energy going!"],
  sad: ["I'm sorry you're feeling down. If you want to talk, I'm here.", "Hope things get better soon!"],
  tired: ["Make sure to get some rest. Your health is important!", "Maybe a quick break will help you recharge."],
  stressed: ["Take a deep breath, everything will be okay.", "Try to relax and take it one step at a time."]
};

const smallTalkQuestions = {
  weather: ["how's the weather", "what's the weather like", "weather today"],
  hobbies: ["what are your hobbies", "what do you like to do", "your interests"]
};

const smallTalkReplies = {
  weather: [
    "I don't experience weather, but I hope it's nice where you are!",
    "Weather is always changing — hope you're having a good day regardless!"
  ],
  hobbies: [
    "I enjoy helping people like you with their questions!",
    "I love learning new things and chatting with interesting folks."
  ]
};

app.post('/ask', async (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: "Please provide a question" });

  const lowerQ = question.toLowerCase();

  // Handle greetings
  if (containsPhrase(lowerQ, greetings)) {
    const reply = greetingsResponses[Math.floor(Math.random() * greetingsResponses.length)];
    return res.json({ answer: reply });
  }

  // Handle "how are you" questions
  if (containsPhrase(lowerQ, howAreYouQuestions)) {
    const reply = howAreYouResponses[Math.floor(Math.random() * howAreYouResponses.length)];
    return res.json({ answer: reply });
  }

  // Handle thanks
  if (containsPhrase(lowerQ, thanksPhrases)) {
    const reply = thanksResponses[Math.floor(Math.random() * thanksResponses.length)];
    return res.json({ answer: reply });
  }

  // Handle emotions
  for (const [emotion, keywords] of Object.entries(emotions)) {
    if (containsPhrase(lowerQ, keywords)) {
      const replies = emotionReplies[emotion];
      const reply = replies[Math.floor(Math.random() * replies.length)];
      return res.json({ answer: reply });
    }
  }

  // Handle small talk
  for (const [topic, keywords] of Object.entries(smallTalkQuestions)) {
    if (containsPhrase(lowerQ, keywords)) {
      const replies = smallTalkReplies[topic];
      const reply = replies[Math.floor(Math.random() * replies.length)];
      return res.json({ answer: reply });
    }
  }

  // Else: use resume-based Q&A
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

    let answer = response.data.answer;

    if (!answer || answer.toLowerCase() === 'no answer found.') {
      answer = "I'm sorry, I don't have that information right now. Could you please ask something else?";
    }

    res.json({ answer, context });
  } catch (error) {
    console.error("Hugging Face API error:", error.message);
    res.status(500).json({ error: "Error fetching answer from Hugging Face API" });
  }
});

app.get('/', (req, res) => res.send('Chatbot backend running'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
