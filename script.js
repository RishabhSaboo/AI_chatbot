import { GoogleGenerativeAI } from "@google/generative-ai";

// DOM Elements
const sendMessage = document.querySelector(".chat-input span");
const chatInput = document.querySelector(".chat-input textarea");
const chatbox = document.querySelector(".chatbox");
const chatbotToggler = document.querySelector(".chatbot-toggler");

// Gemini API setup
const API_KEY = "AIzaSyD_R6VbRXeXKKhu9aoULkq3bmpAa4J3M1E";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Chat modes with system prompts
const chatModes = {
  default: {
    name: "General Assistant",
    systemPrompt: "You are a helpful, friendly AI assistant that provides accurate and concise information."
  },
  creative: {
    name: "Creative Writer",
    systemPrompt: "You are a creative writing assistant. Be imaginative, descriptive, and engaging in your responses."
  },
  code: {
    name: "Code Helper",
    systemPrompt: "You are a coding assistant. Provide clear, efficient code examples with explanations. Focus on best practices."
  },
  study: {
    name: "Study Buddy",
    systemPrompt: "You are a study assistant. Explain concepts clearly, provide examples, and help with learning."
  }
};

// Current state
let currentMode = "default";
let chatHistory = [];
let userMessage;

// Initialize chat with system prompt
let chat = model.startChat({
  history: [{
    role: "user",
    parts: [{ text: chatModes[currentMode].systemPrompt }]
  }, {
    role: "model",
    parts: [{ text: "I understand and will act accordingly." }]
  }],
  generationConfig: {
    maxOutputTokens: 500,
  },
});

// Create chat list item
const createChatLi = (message, className) => {
  const chatLi = document.createElement("li");
  chatLi.classList.add("chat", className);
  let chatContent = className === "incoming" 
    ? `<span class="material-symbols-outlined">smart_toy</span><p>${message}</p>` 
    : `<p>${message}</p>`;
  chatLi.innerHTML = chatContent;
  return chatLi;
};

// Initialize UI elements after page load
const setupUI = () => {
  // Setup action buttons
  document.getElementById('copy-last').addEventListener('click', copyLastMessage);
  document.getElementById('voice-input').addEventListener('click', startVoiceInput);
  document.getElementById('clear-chat').addEventListener('click', clearChat);
  document.getElementById('export-chat').addEventListener('click', exportChat);
  
  // Setup mode selector
  document.getElementById('chat-mode').addEventListener('change', (e) => {
    changeChatMode(e.target.value);
  });
  
  // Load saved chat history
  loadChatHistory();
  
  // Setup voice input if available
  setupVoiceRecognition();
};

// Generate response
const generateResponse = async (chatLi) => {
  try {
    // Show typing indicator
    chatLi.innerHTML = `<span class="material-symbols-outlined">smart_toy</span><p><span class="typing-indicator"><span>.</span><span>.</span><span>.</span></span></p>`;
    
    const result = await chat.sendMessage(userMessage);
    const response = result.response;
    
    // Check if the message might benefit from search (contains questions about facts, events, etc.)
    const mightNeedSearch = /what|who|when|where|why|how|latest|recent|news|update|current/i.test(userMessage);
    
    // For potentially factual questions, encourage search
    let messageToSend = userMessage;
    if (mightNeedSearch) {
      // We don't modify the user's message, the system prompt already instructs the model to search when needed
      // The model will determine if search is necessary based on the query and its knowledge
    // const result = await chat.sendMessage(messageToSend);
    // const response = result.response;       
    }
    
    
    if (response && response.candidates && response.candidates.length > 0) {
        const msg = response.candidates[0].content.parts[0].text;
        
        // Format message (basic markdown handling)
        const formattedMsg = formatMessage(msg);
        chatLi.innerHTML = `<span class="material-symbols-outlined">smart_toy</span><p>${formattedMsg}</p>`;
      
      // Add copy button to this message
      addCopyButton(chatLi);
      
      // Save this exchange to history
      saveToHistory(userMessage, response.text);
    } else {
      chatLi.innerHTML = `<span class="material-symbols-outlined">smart_toy</span><p>Sorry, I couldn't generate a response.</p>`;
      console.error("Empty or invalid response from Gemini API", response);
    }
  } catch (error) {
    chatLi.innerHTML = `<span class="material-symbols-outlined">smart_toy</span><p>Error: ${error.message || "Something went wrong"}</p>`;
    console.error("Gemini API Error:", error);
  }
};

// Format message with basic markdown
const formatMessage = (text) => {
  // Handle code blocks
  text = text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  
  // Handle inline code
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Handle bold
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Handle italic
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Handle newlines
  text = text.replace(/\n/g, '<br>');
  
  return text;
};

// Add copy button to message
const addCopyButton = (chatLi) => {
  const copyBtn = document.createElement("button");
  copyBtn.className = "copy-btn";
  copyBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">content_copy</span>';
  copyBtn.addEventListener("click", () => {
    const textToCopy = chatLi.querySelector("p").innerText;
    navigator.clipboard.writeText(textToCopy).then(() => {
      copyBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">check</span>';
      setTimeout(() => {
        copyBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 16px;">content_copy</span>';
      }, 2000);
    });
  });
  chatLi.appendChild(copyBtn);
};

// Handle chat
const handleChat = () => {
  userMessage = chatInput.value.trim();
  if (!userMessage) return;

  chatbox.appendChild(createChatLi(userMessage, "outgoing"));
  chatInput.value = "";
  
  const incomingChatLi = createChatLi("", "incoming");
  chatbox.appendChild(incomingChatLi);
  chatbox.scrollTop = chatbox.scrollHeight;
  
  generateResponse(incomingChatLi);
};

// Save to history
const saveToHistory = (user, bot) => {
  chatHistory.push({ user, bot });
  localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
};

// Load chat history
const loadChatHistory = () => {
  const savedHistory = localStorage.getItem('chatHistory');
  if (savedHistory) {
    chatHistory = JSON.parse(savedHistory);
    
    // Ask if user wants to load history
    if (chatHistory.length > 0) {
      const loadHistoryLi = createChatLi("Would you like to load your previous conversation?", "incoming");
      const buttonContainer = document.createElement("div");
      buttonContainer.style.display = "flex";
      buttonContainer.style.justifyContent = "center";
      buttonContainer.style.gap = "10px";
      buttonContainer.style.marginTop = "10px";
      
      const buttonYes = document.createElement("button");
      buttonYes.textContent = "Yes";
      buttonYes.style.padding = "5px 15px";
      buttonYes.style.background = "#724ae8";
      buttonYes.style.color = "white";
      buttonYes.style.border = "none";
      buttonYes.style.borderRadius = "5px";
      buttonYes.style.cursor = "pointer";
      buttonYes.addEventListener("click", () => {
        displaySavedHistory();
        loadHistoryLi.remove();
      });
      
      const buttonNo = document.createElement("button");
      buttonNo.textContent = "No";
      buttonNo.style.padding = "5px 15px";
      buttonNo.style.background = "#f2f2f2";
      buttonNo.style.color = "black";
      buttonNo.style.border = "1px solid #ddd";
      buttonNo.style.borderRadius = "5px";
      buttonNo.style.cursor = "pointer";
      buttonNo.addEventListener("click", () => {
        loadHistoryLi.remove();
      });
      
      buttonContainer.appendChild(buttonYes);
      buttonContainer.appendChild(buttonNo);
      loadHistoryLi.querySelector("p").appendChild(buttonContainer);
      chatbox.appendChild(loadHistoryLi);
    }
  }
};

// Display saved history
const displaySavedHistory = () => {
  // Clear current chat except first welcome message
  while (chatbox.children.length > 1) {
    chatbox.removeChild(chatbox.lastChild);
  }
  
  // Add history messages
  chatHistory.forEach(entry => {
    chatbox.appendChild(createChatLi(entry.user, "outgoing"));
    const botLi = createChatLi(formatMessage(entry.bot), "incoming");
    addCopyButton(botLi);
    chatbox.appendChild(botLi);
  });
  
  // Scroll to bottom
  chatbox.scrollTop = chatbox.scrollHeight;
};

// Copy last message
const copyLastMessage = () => {
  const lastBotMessage = chatbox.querySelector('.chat.incoming:last-of-type p');
  if (lastBotMessage) {
    navigator.clipboard.writeText(lastBotMessage.innerText);
    
    // Show feedback
    const feedback = document.createElement("div");
    feedback.textContent = "Copied!";
    feedback.style.position = "fixed";
    feedback.style.top = "20px";
    feedback.style.left = "50%";
    feedback.style.transform = "translateX(-50%)";
    feedback.style.background = "#724ae8";
    feedback.style.color = "white";
    feedback.style.padding = "8px 16px";
    feedback.style.borderRadius = "5px";
    feedback.style.zIndex = "1000";
    document.body.appendChild(feedback);
    
    setTimeout(() => {
      document.body.removeChild(feedback);
    }, 2000);
  }
};

// Clear chat
const clearChat = () => {
  if (confirm("Are you sure you want to clear the chat history?")) {
    // Keep only the first welcome message
    while (chatbox.children.length > 1) {
      chatbox.removeChild(chatbox.lastChild);
    }
    
    chatHistory = [];
    localStorage.removeItem('chatHistory');
    
    // Add confirmation message
    const clearMsg = `Chat history cleared. I'm your ${chatModes[currentMode].name}. How can I help you?`;
    chatbox.appendChild(createChatLi(clearMsg, "incoming"));
  }
};

// Export chat
const exportChat = () => {
  if (chatHistory.length === 0) {
    alert("No chat history to export!");
    return;
  }
  
  let chatText = "# Chat Export\n\n";
  chatHistory.forEach((entry, index) => {
    chatText += `## Exchange ${index + 1}\n\n`;
    chatText += `**You:** ${entry.user}\n\n`;
    chatText += `**AI:** ${entry.bot}\n\n`;
    chatText += `${'='.repeat(50)}\n\n`;
  });
  
  const blob = new Blob([chatText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat-export-${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  
  // Show feedback
  const feedback = document.createElement("div");
  feedback.textContent = "Chat exported!";
  feedback.style.position = "fixed";
  feedback.style.top = "20px";
  feedback.style.left = "50%";
  feedback.style.transform = "translateX(-50%)";
  feedback.style.background = "#724ae8";
  feedback.style.color = "white";
  feedback.style.padding = "8px 16px";
  feedback.style.borderRadius = "5px";
  feedback.style.zIndex = "1000";
  document.body.appendChild(feedback);
  
  setTimeout(() => {
    document.body.removeChild(feedback);
  }, 2000);
};

// Setup voice recognition
const setupVoiceRecognition = () => {
  const voiceButton = document.getElementById('voice-input');
  
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US'; // Set language
    
    recognition.onstart = () => {
      chatInput.placeholder = "Listening...";
      voiceButton.style.background = "#ff4444";
    };
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      chatInput.value = transcript;
    };
    
    recognition.onend = () => {
      chatInput.placeholder = "Write your message here";
      voiceButton.style.background = "#724ae8";
    };
    
    recognition.onerror = (event) => {
      console.error("Speech Recognition Error", event.error);
      chatInput.placeholder = "Voice recognition error. Try again.";
      voiceButton.style.background = "#724ae8";
      
      setTimeout(() => {
        chatInput.placeholder = "Write your message here";
      }, 3000);
    };
    
    voiceButton.addEventListener('click', () => {
      if (voiceButton.style.background === "rgb(255, 68, 68)") {
        recognition.stop();
      } else {
        recognition.start();
      }
    });
  } else {
    voiceButton.style.display = 'none';
    console.warn("Speech Recognition not supported");
  }
};

// Change chat mode
const changeChatMode = (mode) => {
  if (chatModes[mode]) {
    currentMode = mode;
    
    // Create new chat with the selected mode's system prompt
    chat = model.startChat({
      history: [{
        role: "user",
        parts: [{ text: chatModes[mode].systemPrompt }]
      }, {
        role: "model",
        parts: [{ text: "I understand and will act accordingly." }]
      }],
      generationConfig: {
        maxOutputTokens: 500,
      },
    });
    
    // Add mode change notification
    const modeChangeLi = createChatLi(`Switched to ${chatModes[mode].name} mode`, "incoming");
    chatbox.appendChild(modeChangeLi);
    chatbox.scrollTop = chatbox.scrollHeight;
  }
};

// Start voice input
const startVoiceInput = () => {
  document.getElementById('voice-input').click();
};

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Setup initial UI elements
  setupUI();
  
  // Chat send button
  sendMessage.addEventListener("click", handleChat);
  
  // Enter key to send
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChat();
    }
  });
  
  // Chatbot toggle
  chatbotToggler.addEventListener("click", () => {
    document.body.classList.toggle("show-chatbot");
  });
});