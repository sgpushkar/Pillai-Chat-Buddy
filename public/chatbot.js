const chatBox = document.getElementById('chat-box');
const form = document.getElementById('input-form');
const input = document.getElementById('user-input');
const typingIndicator = document.getElementById('typing');
const suggestions = document.getElementById('suggestions');
const feedback = document.getElementById('feedback');

const sessionId = 'session-' + Math.random().toString(36).substring(2, 15);

function addMessage(text, sender = 'bot') {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'msg ' + sender;
  msgDiv.textContent = text;
  chatBox.appendChild(msgDiv);

  if (sender === 'bot') {
    msgDiv.title = "Click to copy";
    msgDiv.style.cursor = "pointer";
    msgDiv.onclick = () => {
      navigator.clipboard.writeText(text);
      msgDiv.style.background = '#d4ebd9';
      setTimeout(() => msgDiv.style.background = '', 600);
    };
  }
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendQuery(query) {
  typingIndicator.style.display = 'block';
  try {
    const res = await fetch('/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, sessionId })
    });
    const data = await res.json();
    typingIndicator.style.display = 'none';

    addMessage(data.answer, 'bot');
    if (Array.isArray(data.nextQuestions)) showSuggestions(data.nextQuestions);
    else showSuggestions();

    showFeedback();
  } catch (error) {
    typingIndicator.style.display = 'none';
    addMessage("Oops! Something went wrong.", 'bot');
  }
}

function showSuggestions(list) {
  suggestions.innerHTML = '';
  const suggList = Array.isArray(list) && list.length > 0 ? list : [
    "PHCET exam details",
    "Campus facilities",
    "Placements statistics",
    "How to apply?",
    "Fee structure"
  ];
  suggList.forEach(text => {
    const btn = document.createElement('button');
    btn.className = 'suggest-btn';
    btn.textContent = text;
    suggestions.appendChild(btn);
  });
}

function showFeedback() {
  feedback.innerHTML = `
    <span>Was this helpful?</span>
    <button onclick="addMessage('Thank you for your feedback!','bot')" class="feedback-btn">👍</button>
    <button onclick="addMessage('We will try to improve.','bot')" class="feedback-btn">👎</button>
  `;
}

form.addEventListener('submit', e => {
  e.preventDefault();
  const userText = input.value.trim();
  if (!userText) return;
  addMessage(userText, 'user');
  input.value = '';
  sendQuery(userText);
});

suggestions.addEventListener('click', e => {
  if (e.target.classList.contains('suggest-btn')) {
    const text = e.target.textContent;
    addMessage(text, 'user');
    sendQuery(text);
  }
});

addMessage("Hello! I'm PHOCCy, your Pillai HOC College chatbot. Ask me anything about PHCET exam, courses, campus, placements, or contacts!");
showSuggestions();
showFeedback();
