// FILE LOCATION: frontend/src/pages/ChatRAG/components/MessageBubble.jsx

import React, { useState } from 'react';
import { User, Bot, Clock, Camera, Video, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import Badge from '../../../shared/components/ui/Badge';

const MessageBubble = ({ message, theme }) => {
  const [showSources, setShowSources] = useState(false);
  const isUser = message.type === 'user';
  const isError = message.type === 'error';

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (isUser) {
    return (
      <div className="flex justify-end gap-3">
        <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${
          theme === 'dark'
            ? 'bg-blue-600 text-white'
            : 'bg-blue-500 text-white'
        }`}>
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          <div className="flex items-center justify-end gap-1 mt-2">
            <Clock className="w-3 h-3 opacity-70" />
            <span className="text-xs opacity-70">
              {formatTime(message.timestamp)}
            </span>
          </div>
        </div>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
          theme === 'dark'
            ? 'bg-blue-600'
            : 'bg-blue-500'
        }`}>
          <User className="w-5 h-5 text-white" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
          theme === 'dark'
            ? 'bg-red-600'
            : 'bg-red-500'
        }`}>
          <AlertCircle className="w-5 h-5 text-white" />
        </div>
        <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${
          theme === 'dark'
            ? 'bg-red-900/30 border border-red-800 text-red-200'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <p className="text-sm">{message.content}</p>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex gap-3">
      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-blue-500 to-purple-500">
        <Bot className="w-5 h-5 text-white" />
      </div>
      
      <div className="flex-1 max-w-[80%]">
        {/* Main answer */}
        <div className={`rounded-2xl px-4 py-3 ${
          theme === 'dark'
            ? 'bg-slate-900/50 border border-slate-700'
            : 'bg-slate-50 border border-slate-200'
        }`}>
          {/* Summary badge if available */}
          {message.summary && (
            <div className="mb-3 pb-3 border-b border-slate-700">
              <Badge variant="info" size="sm">Summary</Badge>
              <p className={`text-sm mt-2 italic ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                {message.summary}
              </p>
            </div>
          )}

          {/* Main content */}
          <div className={`text-sm whitespace-pre-wrap leading-relaxed ${
            theme === 'dark' ? 'text-slate-200' : 'text-slate-700'
          }`}>
            {message.content}
          </div>

          {/* Key events */}
          {message.keyEvents && message.keyEvents.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className={`text-xs font-semibold mb-2 uppercase ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Key Events
              </p>
              <div className="space-y-2">
                {message.keyEvents.map((event, index) => (
                  <div 
                    key={index}
                    className={`flex items-start gap-2 text-xs p-2 rounded ${
                      theme === 'dark' ? 'bg-slate-800/50' : 'bg-white'
                    }`}
                  >
                    <Clock className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                      theme === 'dark' ? 'text-blue-400' : 'text-blue-500'
                    }`} />
                    <div className="flex-1">
                      <p className={`font-medium ${
                        theme === 'dark' ? 'text-white' : 'text-slate-900'
                      }`}>
                        {event.time}
                      </p>
                      <p className={theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}>
                        {event.camera} • {event.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-slate-700">
            {message.eventCount > 0 && (
              <div className={`flex items-center gap-1 text-xs ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                <Video className="w-3 h-3" />
                <span>{message.eventCount} event{message.eventCount !== 1 ? 's' : ''}</span>
              </div>
            )}
            
            {message.cameras && message.cameras.length > 0 && (
              <div className={`flex items-center gap-1 text-xs ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                <Camera className="w-3 h-3" />
                <span>{message.cameras.length} camera{message.cameras.length !== 1 ? 's' : ''}</span>
              </div>
            )}
            
            <div className={`flex items-center gap-1 text-xs ml-auto ${
              theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
            }`}>
              <Clock className="w-3 h-3" />
              <span>{formatTime(message.timestamp)}</span>
            </div>
          </div>
        </div>

        {/* Sources toggle */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-2">
            <button
              onClick={() => setShowSources(!showSources)}
              className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg transition-colors ${
                theme === 'dark'
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {showSources ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Hide {message.sources.length} source{message.sources.length !== 1 ? 's' : ''}
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Show {message.sources.length} source{message.sources.length !== 1 ? 's' : ''}
                </>
              )}
            </button>

            {/* Sources list */}
            {showSources && (
              <div className="mt-2 space-y-2">
                {message.sources.map((source, index) => (
                  <div
                    key={index}
                    className={`rounded-lg border p-3 ${
                      theme === 'dark'
                        ? 'bg-slate-900/30 border-slate-700'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Camera className={`w-3 h-3 ${
                            theme === 'dark' ? 'text-blue-400' : 'text-blue-500'
                          }`} />
                          <span className={`text-xs font-medium ${
                            theme === 'dark' ? 'text-white' : 'text-slate-900'
                          }`}>
                            {source.camera.name}
                          </span>
                        </div>
                        <p className={`text-xs ${
                          theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                        }`}>
                          {source.camera.location}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-medium ${
                          theme === 'dark' ? 'text-slate-300' : 'text-slate-700'
                        }`}>
                          {source.time}
                        </p>
                        <p className={`text-xs ${
                          theme === 'dark' ? 'text-slate-500' : 'text-slate-400'
                        }`}>
                          {source.date}
                        </p>
                      </div>
                    </div>
                    
                    <p className={`text-xs leading-relaxed ${
                      theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
                    }`}>
                      {source.caption}
                    </p>
                    
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700">
                      <Badge 
                        variant={source.confidence > 0.8 ? 'success' : 'warning'} 
                        size="sm"
                      >
                        {(source.confidence * 100).toFixed(0)}% confident
                      </Badge>
                      
                      {source.video_reference && (
                        <button className={`text-xs ${
                          theme === 'dark'
                            ? 'text-blue-400 hover:text-blue-300'
                            : 'text-blue-600 hover:text-blue-700'
                        }`}>
                          View Video
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Follow-up suggestions */}
        {message.followUpSuggestions && message.followUpSuggestions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.followUpSuggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => {
                  // This would trigger sending a new message
                  // Implementation handled by parent component
                }}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  theme === 'dark'
                    ? 'border-slate-700 text-slate-400 hover:border-blue-500 hover:text-blue-400 hover:bg-slate-800'
                    : 'border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50'
                }`}
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;