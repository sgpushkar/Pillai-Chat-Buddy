const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.static('public'));
app.use(express.json());

const datasetPath = path.join(__dirname, 'data', 'pillai_full.json');
const data = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));

// Session store for multi-turn context (simple in-memory, keyed by session id)
const sessions = new Map();

function resetContext(sessionId) {
  sessions.set(sessionId, { lastTopic: null, lastIntent: null });
}

// Basic NLP intents and keywords mapping
const intents = [
  {
    name: 'phcet_info',
    keywords: ['phcet', 'entrance exam', 'entrance test', 'admission test', 'phc common entrance']
  },
  {
    name: 'phcet_apply',
    keywords: ['how to apply phcet', 'phcet application', 'phcet registration', 'phcet form']
  },
  {
    name: 'phcet_syllabus',
    keywords: ['phcet syllabus', 'phcet subjects', 'phcet exam pattern']
  },
  {
    name: 'phcasc_info',
    keywords: ['phcasc', 'arts college', 'commerce college', 'science college', 'pillai arts science']
  },
  {
    name: 'phcp_info',
    keywords: ['polytechnic', 'phcp', 'diploma', 'pillai polytechnic']
  },
  {
    name: 'phcer_info',
    keywords: ['phcer', 'education college', 'b.ed', 'teacher education']
  },
  {
    name: 'campus_info',
    keywords: ['campus', 'facilities', 'hostel', 'transport', 'library', 'wifi']
  },
  {
    name: 'placements_info',
    keywords: ['placements', 'jobs', 'recruiters', 'salary', 'internship']
  },
  {
    name: 'contact_info',
    keywords: ['contact', 'phone', 'email', 'address', 'location']
  },
  {
    name: 'faq',
    keywords: ['faq', 'questions', 'doubt', 'help']
  }
];

// Helper: identify intent from query text
function detectIntent(text) {
  const query = text.toLowerCase();
  for (const intent of intents) {
    for (const kw of intent.keywords) {
      if (query.includes(kw)) return intent.name;
    }
  }
  return null;
}

// Helper: fetch answer based on intent & optionally follow-up questions
function getAnswer(intent, query, context) {
  switch (intent) {
    case 'phcet_info':
      return data.phcet.overview + "\n\nYou can ask how to apply or about the syllabus.";
    case 'phcet_apply':
      return data.phcet.application_process || data.phcet.application_process || "You can apply online at https://phcet.in during registration window.";
    case 'phcet_syllabus':
      return "PHCET syllabus includes Physics, Chemistry, Mathematics, and Biology (for Pharmacy). The exam pattern is multiple choice questions lasting 2 hours.";
    case 'phcasc_info':
      return data.phcasc.overview || data.phcasc.name + "\n\nCourses offered: " + (data.phcasc.courses ? data.phcasc.courses.join(", ") : "");
    case 'phcp_info':
      return data.phcp.overview || "PHCP offers diploma engineering courses like Computer, Mechanical, Civil, Electronics.";
    case 'phcer_info':
      return data.phcer.overview || "PHCER offers B.Ed and M.Ed programs for teacher education.";
    case 'campus_info':
      return data.general.campus.overview + "\nFacilities include library, sports, hostel, transport, wifi.";
    case 'placements_info':
      return "Placement cell organizes drives with companies like TCS, Infosys. Average package ₹2.5 LPA, highest ₹4 LPA.";
    case 'contact_info':
      return `Main Contact:\nPhone: ${data.general.contacts.main_phone}\nEmail: ${data.general.contacts.email}\nWebsite: ${data.general.contacts.website}`;
    case 'faq':
      // Return first FAQ or generic message
      if (data.phcet.faq.length > 0) {
        return `Example FAQ:\nQ: ${data.phcet.faq[0].question}\nA: ${data.phcet.faq[0].answer}`;
      }
      return "You can ask me anything about the college!";
    default:
      return "Sorry, I didn't understand that. You can ask about PHCET exam, courses, campus, or placements.";
  }
}

// API endpoint for chatbot query
app.post('/api/query', (req, res) => {
  const { query, sessionId } = req.body;
  if (!query || query.trim() === '') {
    return res.json({ answer: "Please enter a question." });
  }
  // Setup or get session context
  if (!sessions.has(sessionId)) resetContext(sessionId);
  const context = sessions.get(sessionId);

  // Detect intent
  let intent = detectIntent(query);

  // Handle multi-turn logic: if no new intent but context exists, use last intent
  if (!intent && context.lastIntent) {
    intent = context.lastIntent;
  }

  // Get answer
  const answer = getAnswer(intent, query, context);

  // Update context
  context.lastIntent = intent;
  context.lastTopic = intent;
  sessions.set(sessionId, context);

  res.json({ answer });
});

// Reset context endpoint (optional)
app.post('/api/reset', (req, res) => {
  const { sessionId } = req.body;
  resetContext(sessionId);
  res.json({ message: "Context reset." });
});

app.listen(port, () => {
  console.log(`PHOCCy multi-turn chatbot listening at http://localhost:${port}`);
});
