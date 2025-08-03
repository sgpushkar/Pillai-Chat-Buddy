const chatBox = document.getElementById('chat-box');
const form = document.getElementById('input-form');
const input = document.getElementById('user-input');
const typingIndicator = document.getElementById('typing');
const suggestions = document.getElementById('suggestions');

// Generate a random session ID (simple)
const sessionId = 'session-' + Math.random().toString(36).substring(2, 15);

// Add message to chat box
function addMessage(text, sender = 'bot') {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'msg ' + sender;
  msgDiv.textContent = text;
  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Send user query to backend
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
  } catch (error) {
    typingIndicator.style.display = 'none';
    addMessage("Oops! Something went wrong.", 'bot');
  }
}

form.addEventListener('submit', e => {
  e.preventDefault();
  const userText = input.value.trim();
  if (!userText) return;

  addMessage(userText, 'user');
  input.value = '';
  sendQuery(userText);
});

// Suggestions buttons
suggestions.addEventListener('click', e => {
  if (e.target.classList.contains('suggest-btn')) {
    const text = e.target.textContent;
    addMessage(text, 'user');
    sendQuery(text);
  }
});

// Initial greeting
addMessage("Hello! I'm PHOCCy, your Pillai HOC College chatbot. Ask me anything about PHCET exam, courses, campus, placements, or contacts!");
