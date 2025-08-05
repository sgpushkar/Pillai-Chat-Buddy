require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());

const datasetPath = path.join(__dirname, 'pillai_full.json');
const data = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));

// Session management
const sessions = new Map();
function resetContext(sessionId) {
  sessions.set(sessionId, { lastTopic: null, lastIntent: null });
}

// Intent definitions
const intents = [
  { name: 'phcet_info', keywords: ['phcet', 'entrance exam', 'entrance test'] },
  { name: 'phcet_apply', keywords: ['apply phcet', 'phcet application', 'registration'] },
  { name: 'phcet_syllabus', keywords: ['phcet syllabus', 'exam pattern', 'subjects', 'course syllabus'] },
  { name: 'phcet_negativemarking', keywords: ['negative marking', 'penalty for wrong', 'mark deduction'] },
  { name: 'degree_computer_science_subjects', keywords: ['computer science subjects', 'cs degree subjects', 'b.sc cs syllabus'] },
  { name: 'phcasc_info', keywords: ['phcasc', 'arts college', 'science college'] },
  { name: 'phcp_info', keywords: ['phcp', 'polytechnic', 'diploma'] },
  { name: 'phcer_info', keywords: ['phcer', 'b.ed', 'teacher education'] },
  { name: 'campus_info', keywords: ['campus', 'facilities', 'hostel', 'wifi', 'library'] },
  { name: 'placements_info', keywords: ['placements', 'salary', 'jobs'] },
  { name: 'contact_info', keywords: ['contact', 'phone', 'email', 'address'] },
  { name: 'faq', keywords: ['faq', 'question', 'help', 'doubt'] }
];

// Intent detection (fuzzy)
function fuzzyDetectIntent(text) {
  const query = text.toLowerCase();
  for (const intent of intents) {
    for (const kw of intent.keywords) {
      if (query.includes(kw)) return { intent: intent.name, confidence: 1 };
    }
  }
  return { intent: null, confidence: 0 };
}

// Get answer for intent and query
function getAnswer(intent, query, context) {
  switch (intent) {
    case 'phcet_info':
      return data.phcet.overview;
    case 'phcet_apply':
      return data.phcet.application_process;
    case 'phcet_syllabus':
      return data.phcet.exam_pattern;
    case 'phcet_negativemarking':
      return data.phcet_negativemarking.answer;
    case 'degree_computer_science_subjects':
      return data.degree_computer_science_subjects.answer;
    case 'phcasc_info':
      return data.phcasc.history +
        "\n\nPrograms offered: " +
        Object.values(data.phcasc.programs_offered).flat().join(", ");
    case 'phcp_info':
      return data.phcp.overview +
        "\n\nCourses: " +
        data.phcp.courses_offered.join(', ');
    case 'phcer_info':
      return data.phcer.overview +
        "\n\nPrograms: " +
        data.phcer.programs.join(', ');
    case 'campus_info':
      // In your JSON, campus info is a nested object. Provide summary.
      return Object.entries(data.phcasc.infrastructure)
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join('\n');
    case 'placements_info':
      return `Placement support includes training and internships.\nAvg: ${data.phcasc.placements.average_package}, Highest: ${data.phcasc.placements.highest_package}\nTop recruiters: ${data.phcasc.placements.top_recruiters.join(', ')}`;
    case 'contact_info':
      return `Phone: ${data.phcasc.contact.phone}\nEmail: ${data.phcasc.contact.email}\nWebsite: ${data.phcasc.contact.website}`;
    case 'faq':
      // Sample FAQ from PHCET and PHCASC
      if (query && query.toLowerCase().includes('hostel')) {
        const match = data.phcasc.faq.find(fq => fq.question.toLowerCase().includes('hostel'));
        if (match) return `Q: ${match.question}\nA: ${match.answer}`;
      }
      const example = data.phcet.faq[0];
      return example ? `Q: ${example.question}\nA: ${example.answer}` : "Ask me anything!";
    default:
      return null;
  }
}

// Next question recommendations
const recommendations = {
  phcet_info: ["How do I apply for PHCET?", "What is PHCET syllabus?", "PHCET important dates"],
  phcet_apply: ["What documents are required?", "Is there an application fee?"],
  phcet_syllabus: ["Is there any negative marking?", "What subjects are covered?"],
  phcasc_info: ["What UG or PG programs are available?", "What are the fees?", "Campus facilities?"],
  campus_info: ["Does the hostel have WiFi?", "Are sports and library available?"],
  placements_info: ["Top recruiters?", "What is the highest package?", "Internship opportunities?"],
  contact_info: ["College location?", "Admission phone/email?"],
  faq: ["How safe is the campus?", "Are scholarships available?"]
};

// LLaMA API query
async function queryLLaMA(prompt) {
  try {
    const response = await axios.post('http://localhost:11434/api/generate', {
      model: 'llama3',
      prompt: prompt,
      stream: false
    });
    return response.data.response.trim();
  } catch (err) {
    console.error('LLaMA error:', err.message);
    return null;
  }
}

// OpenAI fallback
async function queryOpenAIFallback(prompt) {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const result = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100
      },
      { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
    );
    return result.data.choices[0].message.content.trim();
  } catch (err) {
    console.error('OpenAI error:', err.message);
    return null;
  }
}

// MAIN CHAT ENDPOINT
app.post('/api/query', async (req, res) => {
  const { query, sessionId } = req.body;
  if (!query || query.trim() === '') {
    return res.json({ answer: "Please enter a question." });
  }
  if (!sessions.has(sessionId)) resetContext(sessionId);
  const context = sessions.get(sessionId);
  const { intent, confidence } = fuzzyDetectIntent(query);
  let finalIntent = (confidence >= 0.9) ? intent : null; // confidence always 1 here; else fallback to last intent
  if (!finalIntent && context.lastIntent) finalIntent = context.lastIntent;
  let answer = finalIntent ? getAnswer(finalIntent, query, context) : null;

  // LLM fallback
  if (!answer) {
    answer = await queryLLaMA(query);
    if (!answer) answer = await queryOpenAIFallback(query);
    if (!answer) answer = "Sorry, I couldn't understand. Please choose a suggestion below or rephrase your question.";
    fs.appendFileSync("missed-queries.log", `[${new Date().toISOString()}] ${query}\n`);
  }

  let nextQuestions = [];
  if (finalIntent && recommendations[finalIntent]) nextQuestions = recommendations[finalIntent];

  context.lastIntent = finalIntent;
  context.lastTopic = finalIntent;
  sessions.set(sessionId, context);

  res.json({ answer, nextQuestions });
});

// CONTEXT RESET ENDPOINT
app.post('/api/reset', (req, res) => {
  const { sessionId } = req.body;
  resetContext(sessionId);
  res.json({ message: "Context reset." });
});

// SERVER LAUNCH
app.listen(port, () => {
  console.log(`🚀 PHOCCy chatbot server running at http://localhost:${port}`);
});
