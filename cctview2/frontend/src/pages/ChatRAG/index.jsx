// FILE LOCATION: frontend/src/pages/ChatRAG/index.jsx

import React, { useState, useEffect, useRef } from 'react';
import { Send, Loader2, Sparkles, Clock, Camera, AlertCircle } from 'lucide-react';
import Button from '../../shared/components/ui/Button';
import { useTheme } from '../../shared/contexts/ThemeContext';
//import ChatWindow from './components/ChatWindow';
import MessageBubble from './components/MessageBubble';
//import QuerySuggestions from './components/QuerySuggestions';
//import VideoResultCard from './components/VideoResultCard';
import apiService from '../../services/api.service';

function ChatRAG() {
  const { theme } = useTheme();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const messagesEndRef = useRef(null);

  // Generate session ID on mount
  useEffect(() => {
    const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setSessionId(newSessionId);
    loadSuggestions();
  }, []);

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadSuggestions = async () => {
    try {
      const response = await apiService.get('/chat/suggestions');
      setSuggestions(response.data.suggestions || []);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  const handleSendMessage = async (messageText = null) => {
  const message = messageText || inputValue.trim();
  
  if (!message || isLoading) return;

  // Add user message to chat - FIXED ID GENERATION
  const userMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'user',
    content: message,
    timestamp: new Date().toISOString()
  };

  setMessages(prev => [...prev, userMessage]);
  setInputValue('');
  setIsLoading(true);

  try {
    const response = await apiService.post('/chat/message', {
      message: message,
      session_id: sessionId
    });

    const data = response.data;

    // Add assistant response - ENSURE UNIQUE ID
    const assistantMessage = {
      id: data.query_id || `assistant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'assistant',
      content: data.answer,
      summary: data.summary,
      keyEvents: data.key_events || [],
      sources: data.sources || [],
      eventCount: data.event_count,
      cameras: data.cameras || [],
      timeRange: data.time_range,
      followUpSuggestions: data.follow_up_suggestions || [],
      metadata: data.metadata,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, assistantMessage]);

  } catch (error) {
    console.error('Error sending message:', error);
    
    // Add error message - FIXED ID GENERATION
    const errorMessage = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'error',
      content: 'Sorry, I encountered an error processing your request. Please try again.',
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, errorMessage]);
  } finally {
    setIsLoading(false);
  }
};

  const handleSuggestionClick = (suggestion) => {
    handleSendMessage(suggestion);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className={`rounded-xl border backdrop-blur-sm p-6 mb-4 ${
        theme === 'dark'
          ? 'bg-slate-800/50 border-slate-700'
          : 'bg-white border-slate-200 shadow-sm'
      }`}>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className={`text-2xl font-bold ${
              theme === 'dark' ? 'text-white' : 'text-slate-900'
            }`}>
              AI Surveillance Assistant
            </h1>
            <p className={`text-sm ${
              theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
            }`}>
              Ask me anything about your surveillance footage
            </p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex gap-4 mt-4">
          <div className={`flex items-center gap-2 text-sm ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            <Clock className="w-4 h-4" />
            <span>Real-time search</span>
          </div>
          <div className={`flex items-center gap-2 text-sm ${
            theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
          }`}>
            <Camera className="w-4 h-4" />
            <span>All cameras</span>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className={`flex-1 rounded-xl border backdrop-blur-sm overflow-hidden flex flex-col ${
        theme === 'dark'
          ? 'bg-slate-800/50 border-slate-700'
          : 'bg-white border-slate-200 shadow-sm'
      }`}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="text-center mb-8">
                <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 mb-4">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h2 className={`text-xl font-semibold mb-2 ${
                  theme === 'dark' ? 'text-white' : 'text-slate-900'
                }`}>
                  How can I help you today?
                </h2>
                <p className={`text-sm ${
                  theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                }`}>
                  Ask me about events, people, or activities in your surveillance footage
                </p>
              </div>

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="w-full max-w-2xl">
                  <p className={`text-sm font-medium mb-3 ${
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    Try asking:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {suggestions.slice(0, 4).map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className={`p-4 rounded-lg border text-left transition-all hover:scale-[1.02] ${
                          theme === 'dark'
                            ? 'bg-slate-900/50 border-slate-700 hover:border-blue-500 text-slate-300 hover:text-white'
                            : 'bg-slate-50 border-slate-200 hover:border-blue-400 text-slate-700 hover:text-slate-900'
                        }`}
                      >
                        <span className="text-sm">{suggestion}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} theme={theme} />
              ))}
              
              {isLoading && (
                <div className="flex items-center gap-2">
                  <div className={`p-3 rounded-lg ${
                    theme === 'dark' ? 'bg-slate-900/50' : 'bg-slate-100'
                  }`}>
                    <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                  </div>
                  <span className={`text-sm ${
                    theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                  }`}>
                    Analyzing footage...
                  </span>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input area */}
        <div className={`border-t p-4 ${
          theme === 'dark' ? 'border-slate-700' : 'border-slate-200'
        }`}>
          <div className="flex gap-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about events, people, or activities..."
              disabled={isLoading}
              className={`flex-1 px-4 py-3 rounded-lg border transition-all ${
                theme === 'dark'
                  ? 'bg-slate-900/50 border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                  : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
            
            <Button
              variant="primary"
              icon={isLoading ? Loader2 : Send}
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || isLoading}
              className={isLoading ? 'animate-pulse' : ''}
            >
              {isLoading ? 'Sending...' : 'Send'}
            </Button>
          </div>
          
          <p className={`text-xs mt-2 ${
            theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
          }`}>
            Press Enter to send, Shift + Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}

export default ChatRAG;