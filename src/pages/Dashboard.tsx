'use client'

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { FileSpreadsheet, RefreshCw, Send, Plus, Brain, Database, Download, X, AlertCircle, CheckCircle, Sparkles, LogOut } from 'lucide-react'

const HF = "'Helvetica World', 'Helvetica Neue', Helvetica, Arial, sans-serif"

type AIProvider = 'openrouter'

interface ProviderConfig {
  id: AIProvider
  name: string
  icon: React.ReactNode
  model: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  datasetId?: string
  jobId?: string
  status?: 'thinking' | 'analyzing' | 'planning' | 'processing' | 'complete' | 'error'
  steps?: { step: number; message: string; status: 'pending' | 'running' | 'complete' | 'error' }[]
  downloadUrl?: string
  showLiveEditor?: boolean
  showDataWorkspace?: boolean
}

interface Dataset {
  id: string
  name: string
  original_filename: string
  file_type: string
  row_count: number
  column_count: number
  status: string
}

// Typewriter component for AI responses
function Typewriter({ text, speed = 12, isDark }: { text: string; speed?: number; isDark: boolean }) {
  const [displayedText, setDisplayedText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex])
        setCurrentIndex(prev => prev + 1)
      }, speed)
      return () => clearTimeout(timeout)
    } else {
      setIsComplete(true)
    }
  }, [currentIndex, text, speed])

  return (
    <span 
      className="whitespace-pre-wrap"
      dangerouslySetInnerHTML={{ 
        __html: displayedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
      }}
    />
  )
}

export default function ChatDashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const isDark = true // Default to dark theme matching Landing page
  
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)
  const [showDatasetSelector, setShowDatasetSelector] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const providers: ProviderConfig[] = [
    { id: 'openrouter', name: 'OpenRouter (Free)', icon: <Brain size={14} />, model: 'google/gemma-3-4b-it:free' },
  ]

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Load datasets
  useEffect(() => {
    const loadDatasets = async () => {
      if (!user) return
      
      try {
        const { data: datasetsData } = await supabase
          .from('datasets')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
        
        setDatasets(datasetsData || [])
      } catch (err) {
        console.error('Error loading datasets:', err)
      }
    }
    loadDatasets()
  }, [user])

  // Handle file selection - just queue the file, show inline indicator
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) {
      setError('Please sign in and wait for profile to load')
      return
    }

    // Store file for upload when user presses Enter
    setPendingFile(file)
    setHasStarted(true)
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Handle file upload - uploads file and returns dataset info
  const uploadFile = async (file: File): Promise<Dataset | null> => {
    setIsUploading(true)
    setError(null)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('userId', user!.id)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error?.message || data.error || 'Upload failed')
      }

      const result = await res.json()

      // Upload API already creates the DB record - just use the returned data
      const newDataset: Dataset = {
        id: result.id,
        name: result.name || file.name.replace(/\.[^/.]+$/, ''),
        original_filename: file.name,
        file_type: result.type || file.name.split('.').pop()?.toLowerCase() || 'csv',
        row_count: result.rowCount || 0,
        column_count: result.columnCount || 0,
        status: 'uploaded'
      }

      setDatasets(prev => [newDataset, ...prev])
      return newDataset
      
    } catch (error: any) {
      console.error('Upload error:', error)
      setError(error.message || 'Failed to upload file')
      return null
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  // Handle sending a message - uploads pending file + sends chat together
  const handleSend = async () => {
    if ((!input.trim() && !pendingFile) || isLoading) {
      return
    }

    let dataset: Dataset | null = null
    let file = pendingFile
    
    // Upload file first if pending
    if (pendingFile) {
      setPendingFile(null)
      dataset = await uploadFile(pendingFile)
      if (!dataset) return // Upload failed
    }

    // Create combined user message (file + text)
    let messageContent = input.trim()
    if (file) {
      const fileInfo = `📎 **${file.name}** (${(file.size / 1024).toFixed(1)} KB)` 
      messageContent = messageContent 
        ? `${fileInfo}\n${messageContent}` 
        : `${fileInfo}\nProcess this dataset` 
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
      datasetId: dataset?.id || selectedDataset?.id
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)
    setHasStarted(true)
    setError(null)

    // Create AI response with thinking state
    const aiMessageId = (Date.now() + 1).toString()
    
    const aiMessage: Message = {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      datasetId: dataset?.id || selectedDataset?.id,
      status: 'thinking',
      steps: [
        { step: 1, message: 'Analyzing your request...', status: 'running' },
        { step: 2, message: 'Planning preprocessing steps...', status: 'pending' },
        { step: 3, message: 'Processing data...', status: 'pending' },
        { step: 4, message: 'Generating results...', status: 'pending' }
      ],
    }
    setMessages(prev => [...prev, aiMessage])

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          datasetId: dataset?.id || selectedDataset?.id,
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
          provider: 'openrouter' as const,
          model: 'google/gemma-3-4b-it:free',
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `API error: ${response.status}`)
      }

      const data = await response.json()

      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
          ? { 
              ...msg, 
              status: 'complete', 
              content: data.content || 'I processed your request.',
              steps: msg.steps?.map(s => ({ ...s, status: 'complete' })),
              downloadUrl: data.downloadUrl
            }
          : msg
      ))

    } catch (error: any) {
      console.error('Chat API error:', error)
      
      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
          ? { 
              ...msg, 
              status: 'complete', 
              content: `I apologize, but I'm having trouble connecting to the AI service. Here's what I can help you with:\n\n**Data Preprocessing Steps:**\n1. Clean missing values and duplicates\n2. Scale/normalize numeric features\n3. Encode categorical variables\n4. Remove outliers\n5. Feature engineering\n\nPlease try again in a moment, or describe your dataset and I'll guide you through the preprocessing manually.`,
              steps: msg.steps?.map(s => ({ ...s, status: 'complete' }))
            }
          : msg
      ))
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#050505' }}>
        <RefreshCw size={24} className="animate-spin" style={{ color: 'rgba(255,255,255,0.5)' }} />
      </div>
    )
  }

  return (
    <div className="flex h-screen" style={{ fontFamily: HF, background: '#050505' }}>
      {/* Sidebar */}
      <aside style={{
        width: '256px',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        background: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Logo */}
        <div style={{
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <img src="/image.png" alt="Pipeline Labs" style={{ height: '26px', objectFit: 'contain' }} />
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '12px' }}>
          <button 
            onClick={() => setHasStarted(false)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              borderRadius: '8px',
              border: 'none',
              background: !hasStarted ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: !hasStarted ? '#fff' : 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              fontSize: '14px',
              fontFamily: HF,
              marginBottom: '4px',
            }}
          >
            <Sparkles size={16} />
            New Chat
          </button>
          <button 
            onClick={() => setShowDatasetSelector(true)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              fontSize: '14px',
              fontFamily: HF,
            }}
          >
            <Database size={16} />
            Datasets
          </button>
        </nav>

        {/* User Section */}
        <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            padding: '8px 12px',
            marginBottom: '8px'
          }}>
            <div style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '50%', 
              background: 'rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 500,
              color: '#fff',
            }}>
              {user.email?.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ 
                fontSize: '12px', 
                fontWeight: 500, 
                color: '#fff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {user.email}
              </p>
            </div>
          </div>
          <button 
            onClick={handleSignOut}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              borderRadius: '8px',
              border: 'none',
              background: 'transparent',
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              fontSize: '14px',
              fontFamily: HF,
            }}
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col" style={{ background: '#050505' }}>
        {/* Error Banner */}
        {error && (
          <div style={{
            position: 'fixed',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            padding: '12px 16px',
            borderRadius: '12px',
            border: '1px solid rgba(239,68,68,0.3)',
            background: 'rgba(239,68,68,0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <AlertCircle size={18} style={{ color: '#ef4444' }} />
            <span style={{ fontSize: '14px', color: '#ef4444' }}>{error}</span>
            <button onClick={() => setError(null)} style={{ marginLeft: '8px' }}>
              <X size={14} style={{ color: '#ef4444' }} />
            </button>
          </div>
        )}

        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto" style={{ paddingBottom: hasStarted ? '140px' : '0' }}>
          <div style={{ maxWidth: '768px', margin: '0 auto', padding: '32px 16px' }}>
            {/* Empty State */}
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', paddingTop: '80px' }}>
                <h1 style={{ 
                  fontSize: '36px', 
                  marginBottom: '16px',
                  fontFamily: HF, 
                  fontWeight: 200, 
                  color: '#fff'
                }}>
                  Pipeline Labs
                </h1>
                <p style={{ 
                  fontSize: '18px', 
                  marginBottom: '48px',
                  fontFamily: HF, 
                  fontWeight: 300, 
                  color: 'rgba(255,255,255,0.5)'
                }}>
                  Turn raw data into ML-ready datasets with AI
                </p>
                
                {/* Example Prompts */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                  gap: '16px',
                  maxWidth: '600px',
                  margin: '0 auto',
                }}>
                  {[
                    'Clean this dataset and handle missing values',
                    'Normalize features for logistic regression',
                    'Encode categorical variables and remove outliers',
                    'Prepare data for time series forecasting'
                  ].map((prompt, i) => (
                    <button
                      key={i}
                      onClick={() => { setInput(prompt); setHasStarted(true); }}
                      style={{
                        padding: '16px',
                        borderRadius: '16px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        textAlign: 'left',
                        background: 'rgba(255,255,255,0.02)',
                        color: 'rgba(255,255,255,0.7)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.02)'
                      }}
                    >
                      <Sparkles size={16} style={{ marginBottom: '8px', color: 'rgba(255,255,255,0.4)' }} />
                      <span style={{ fontSize: '14px', fontFamily: HF, fontWeight: 300 }}>{prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((message) => (
              <div 
                key={message.id} 
                style={{
                  marginBottom: '24px',
                  marginLeft: message.role === 'user' ? 'auto' : '0',
                  maxWidth: message.role === 'user' ? '80%' : '90%',
                }}
              >
                {message.role === 'assistant' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ 
                      width: '24px', 
                      height: '24px', 
                      borderRadius: '50%', 
                      background: 'rgba(255,255,255,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Sparkles size={14} style={{ color: '#fff' }} />
                    </div>
                    <span style={{ 
                      fontSize: '12px', 
                      fontFamily: HF, 
                      fontWeight: 300, 
                      color: 'rgba(255,255,255,0.5)'
                    }}>
                      Pipeline AI
                    </span>
                  </div>
                )}
                
                <div style={{
                  padding: '16px',
                  borderRadius: '16px',
                  borderBottomLeftRadius: message.role === 'assistant' ? '4px' : '16px',
                  borderBottomRightRadius: message.role === 'user' ? '4px' : '16px',
                  background: message.role === 'user' 
                    ? 'rgba(59,130,246,0.2)' 
                    : 'rgba(255,255,255,0.05)',
                  border: message.role === 'user'
                    ? '1px solid rgba(59,130,246,0.3)'
                    : '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                }}>
                  {/* Message Content with Typewriter Effect for AI */}
                  {message.content && (
                    <div style={{ fontSize: '14px', fontFamily: HF, fontWeight: 300, lineHeight: 1.7 }}>
                      {message.role === 'assistant' && !message.status ? (
                        <Typewriter 
                          text={message.content} 
                          speed={12} 
                          isDark={isDark}
                        />
                      ) : (
                        <div 
                          className="whitespace-pre-wrap"
                          dangerouslySetInnerHTML={{ 
                            __html: message.content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') 
                          }}
                        />
                      )}
                    </div>
                  )}

                  {/* Thinking / Processing Steps */}
                  {message.status && message.status !== 'complete' && message.status !== 'error' && message.steps && (
                    <div style={{ marginTop: '16px' }}>
                      {message.steps.map((step) => (
                        <div key={step.step} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                          <div style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {step.status === 'complete' ? (
                              <CheckCircle size={14} style={{ color: '#22c55e' }} />
                            ) : step.status === 'running' ? (
                              <Loader2 size={14} className="animate-spin" style={{ color: '#3b82f6' }} />
                            ) : (
                              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                            )}
                          </div>
                          <span style={{ 
                            fontSize: '12px', 
                            fontFamily: HF, 
                            fontWeight: 300, 
                            color: step.status === 'complete' ? '#22c55e' : step.status === 'running' ? '#3b82f6' : 'rgba(255,255,255,0.4)'
                          }}>
                            {step.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Download Button */}
                  {message.downloadUrl && (
                    <div style={{ 
                      marginTop: '16px', 
                      padding: '16px', 
                      borderRadius: '12px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(255,255,255,0.02)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Database size={20} style={{ color: 'rgba(255,255,255,0.6)' }} />
                          <div>
                            <p style={{ fontSize: '14px', fontFamily: HF, fontWeight: 300, color: '#fff' }}>
                              Processed Dataset
                            </p>
                            <p style={{ fontSize: '12px', fontFamily: HF, fontWeight: 300, color: 'rgba(255,255,255,0.5)' }}>
                              CSV format - Ready for ML
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => window.open(message.downloadUrl, '_blank')}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 16px',
                            borderRadius: '9999px',
                            fontSize: '12px',
                            fontFamily: HF,
                            fontWeight: 300,
                            background: '#fff',
                            color: '#000',
                            border: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          <Download size={14} />
                          Download
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area - Floating */}
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '280px',
          right: '24px',
          zIndex: 40,
        }}>
          <div style={{
            maxWidth: '896px',
            margin: '0 auto',
            padding: '8px',
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(20,20,20,0.85)',
            backdropFilter: 'blur(20px)',
          }}>
            {/* Selected Dataset Indicator */}
            {selectedDataset && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
                padding: '8px 16px',
                borderRadius: '9999px',
                width: 'fit-content',
                background: 'rgba(59,130,246,0.1)',
                border: '1px solid rgba(59,130,246,0.3)',
              }}>
                <FileSpreadsheet size={14} style={{ color: '#3b82f6' }} />
                <span style={{ fontSize: '12px', fontFamily: HF, fontWeight: 300, color: '#3b82f6' }}>
                  {selectedDataset.original_filename}
                </span>
                <button 
                  onClick={() => setSelectedDataset(null)}
                  style={{ marginLeft: '8px' }}
                >
                  <X size={12} style={{ color: '#3b82f6' }} />
                </button>
              </div>
            )}

            {/* Pending File Indicator */}
            {pendingFile && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
                padding: '8px 16px',
                borderRadius: '9999px',
                width: 'fit-content',
                background: 'rgba(34,197,94,0.1)',
                border: '1px solid rgba(34,197,94,0.3)',
              }}>
                <FileSpreadsheet size={14} style={{ color: '#22c55e' }} />
                <span style={{ fontSize: '12px', fontFamily: HF, fontWeight: 300, color: '#22c55e' }}>
                  {pendingFile.name} ({(pendingFile.size / 1024).toFixed(1)} KB)
                </span>
                <button 
                  onClick={() => setPendingFile(null)}
                  style={{ marginLeft: '8px' }}
                >
                  <X size={12} style={{ color: '#22c55e' }} />
                </button>
              </div>
            )}

            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '8px',
              padding: '12px',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.02)',
            }}>
              {/* File Upload Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                style={{
                  padding: '8px',
                  borderRadius: '12px',
                  border: 'none',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.6)',
                  cursor: isUploading ? 'default' : 'pointer',
                  opacity: isUploading ? 0.5 : 1,
                }}
              >
                {isUploading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Loader2 size={18} className="animate-spin" />
                    {uploadProgress > 0 && (
                      <span style={{ fontSize: '12px', fontWeight: 500 }}>{uploadProgress}%</span>
                    )}
                  </div>
                ) : (
                  <Plus size={20} />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,.json,.parquet"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />

              {/* Dataset Selector */}
              {datasets.length > 0 && (
                <button
                  onClick={() => setShowDatasetSelector(!showDatasetSelector)}
                  style={{
                    padding: '8px',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.6)',
                    cursor: 'pointer',
                  }}
                >
                  <Database size={20} />
                </button>
              )}

              {/* AI Provider - OpenRouter Only */}
              <div style={{
                padding: '8px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                color: 'rgba(255,255,255,0.6)',
              }}>
                <Brain size={16} />
                <span style={{ fontSize: '12px', fontFamily: HF, fontWeight: 300 }}>
                  OpenRouter Free
                </span>
              </div>

              {/* Text Input */}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Describe how you want your data prepared..."
                rows={1}
                disabled={isLoading}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  resize: 'none',
                  outline: 'none',
                  fontSize: '14px',
                  padding: '8px',
                  fontFamily: HF,
                  fontWeight: 300,
                  color: '#fff',
                  minHeight: '24px',
                  maxHeight: '200px',
                }}
              />

              {/* Send Button */}
              <button
                onClick={handleSend}
                disabled={(!input.trim() && !pendingFile) || isLoading}
                style={{
                  padding: '8px',
                  borderRadius: '12px',
                  border: 'none',
                  background: (input.trim() || pendingFile) && !isLoading ? '#fff' : 'transparent',
                  color: (input.trim() || pendingFile) && !isLoading ? '#000' : 'rgba(255,255,255,0.3)',
                  cursor: (input.trim() || pendingFile) && !isLoading ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                }}
              >
                {isLoading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <Send size={20} />
                )}
              </button>
            </div>

            <p style={{
              textAlign: 'center',
              fontSize: '12px',
              marginTop: '12px',
              fontFamily: HF,
              fontWeight: 300,
              color: 'rgba(255,255,255,0.3)',
            }}>
              AI can make mistakes. Always verify your processed data.
            </p>
          </div>
        </div>


        {/* Dataset Selector Dropdown */}
        {showDatasetSelector && (
          <div style={{
            position: 'fixed',
            bottom: '140px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '320px',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: '#0a0a0a',
            boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            zIndex: 50,
            marginLeft: '128px',
          }}>
            <div style={{
              padding: '12px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
            }}>
              <p style={{ fontSize: '12px', fontFamily: HF, fontWeight: 300, color: 'rgba(255,255,255,0.5)' }}>
                Select a dataset
              </p>
            </div>
            <div style={{ maxHeight: '240px', overflow: 'auto' }}>
              {datasets.map((dataset) => (
                <button
                  key={dataset.id}
                  onClick={() => { setSelectedDataset(dataset); setShowDatasetSelector(false); }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    background: 'transparent',
                    color: '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <FileSpreadsheet size={16} style={{ color: 'rgba(255,255,255,0.5)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '14px', fontFamily: HF, fontWeight: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {dataset.name}
                    </p>
                    <p style={{ fontSize: '12px', fontFamily: HF, fontWeight: 300, color: 'rgba(255,255,255,0.4)' }}>
                      {(dataset.row_count || 0).toLocaleString()} rows
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
