'use client'

import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/context/AuthContext'

const HF = "'Inter', sans-serif"

interface Dataset {
  id: string
  name: string
  original_filename: string
  file_type: string
  row_count: number
  column_count: number
  status: string
  last_modified?: string
}

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [activeNav, setActiveNav] = useState('overview')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
        
        setDatasets(datasetsData?.map((d: any) => ({
          id: d.id,
          name: d.name,
          original_filename: d.original_filename,
          file_type: d.file_type,
          row_count: d.row_count || 0,
          column_count: d.column_count || 0,
          status: d.status || 'uploaded',
          last_modified: d.updated_at || d.created_at
        })) || [])
      } catch (err) {
        console.error('Error loading datasets:', err)
      }
    }
    loadDatasets()
  }, [user])

  const handleNavClick = (nav: string) => {
    setActiveNav(nav)
    if (nav === 'chat') {
      navigate('/dashboard/chat')
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    setIsUploading(true)
    
    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          const base64Data = result.split(',')[1]
          resolve(base64Data)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: { name: file.name, type: file.type || 'text/csv', data: base64 },
          userId: user.id,
        })
      })

      if (!res.ok) throw new Error('Upload failed')

      const result = await res.json()
      
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
    } catch (error) {
      console.error('Upload error:', error)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return 'Recently'
    const date = new Date(dateStr)
    const now = new Date()
    const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours}h ago`
    return `${Math.floor(diffHours / 24)}d ago`
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
    return num.toLocaleString()
  }

  const getDatasetIcon = (type: string) => {
    if (type.includes('image') || type.includes('medical')) return 'image'
    if (type.includes('text') || type.includes('nlp')) return 'text_fields'
    return 'fingerprint'
  }

  const getDatasetType = (dataset: Dataset) => {
    const typeMap: Record<string, string> = {
      'csv': 'Behavioral Data',
      'json': 'Structured Data',
      'xlsx': 'Spreadsheet',
      'parquet': 'Columnar Storage'
    }
    return typeMap[dataset.file_type] || 'Raw Data'
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#131313' }}>
        <span className="material-symbols-outlined animate-spin text-white" style={{ fontSize: '24px' }}>refresh</span>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen" style={{ background: '#131313', color: '#e5e2e1', fontFamily: HF }}>
      {/* Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&amp;family=Space+Grotesk:wght@300..700&amp;display=swap" rel="stylesheet"/>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
      
      {/* SideNavBar */}
      <aside className="h-screen w-64 border-r border-neutral-800 bg-neutral-950 flex flex-col py-8 px-4 shrink-0">
        <div className="mb-10 px-4">
          <h1 className="text-xl font-bold tracking-tighter text-white">NeuralLabs</h1>
          <p className="text-[10px] uppercase tracking-wider text-neutral-500" style={{ fontFamily: "'Space Grotesk', monospace" }}>AI Data Platform</p>
        </div>
        
        <nav className="flex-1 space-y-2">
          <button 
            onClick={() => handleNavClick('overview')}
            className={`w-full flex items-center gap-3 rounded-full px-4 py-2 transition-all duration-300 ${activeNav === 'overview' ? 'bg-neutral-100 text-neutral-950 scale-95' : 'text-neutral-400 hover:text-white hover:bg-neutral-800 scale-95'}`}
          >
            <span className="material-symbols-outlined text-xl">dashboard</span>
            <span className="font-medium text-sm">Overview</span>
          </button>
          
          <button 
            onClick={() => handleNavClick('datasets')}
            className={`w-full flex items-center gap-3 text-neutral-400 hover:text-white px-4 py-2 rounded-full hover:bg-neutral-800 transition-transform scale-95 ${activeNav === 'datasets' ? 'bg-neutral-800 text-white' : ''}`}
          >
            <span className="material-symbols-outlined text-xl">database</span>
            <span className="font-medium text-sm">Datasets</span>
          </button>
          
          <button 
            onClick={() => handleNavClick('chat')}
            className={`w-full flex items-center gap-3 text-neutral-400 hover:text-white px-4 py-2 rounded-full hover:bg-neutral-800 transition-transform scale-95 ${activeNav === 'chat' ? 'bg-neutral-800 text-white' : ''}`}
          >
            <span className="material-symbols-outlined text-xl">chat_bubble</span>
            <span className="font-medium text-sm">Chat Editor</span>
          </button>
          
          <button 
            onClick={() => handleNavClick('models')}
            className="w-full flex items-center gap-3 text-neutral-400 hover:text-white px-4 py-2 rounded-full hover:bg-neutral-800 transition-transform scale-95"
          >
            <span className="material-symbols-outlined text-xl">model_training</span>
            <span className="font-medium text-sm">Model Training</span>
          </button>
          
          <button 
            onClick={() => handleNavClick('settings')}
            className="w-full flex items-center gap-3 text-neutral-400 hover:text-white px-4 py-2 rounded-full hover:bg-neutral-800 transition-transform scale-95"
          >
            <span className="material-symbols-outlined text-xl">settings</span>
            <span className="font-medium text-sm">Settings</span>
          </button>
        </nav>
        
        <div className="mt-auto space-y-2 border-t border-neutral-800 pt-6">
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full bg-white text-neutral-900 rounded-full py-3 mb-4 font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isUploading ? 'Uploading...' : 'New Experiment'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.json,.parquet"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <a className="flex items-center gap-3 text-neutral-400 hover:text-white px-4 py-2 text-sm" href="#">
            <span className="material-symbols-outlined text-lg">description</span>
            <span>Docs</span>
          </a>
          <button 
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 text-neutral-400 hover:text-white px-4 py-2 text-sm"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* TopNavBar */}
        <header className="sticky top-0 z-50 flex justify-between items-center px-8 h-16 w-full bg-neutral-950/60 backdrop-blur-xl shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-6">
              <span className="text-white font-semibold border-b-2 border-white pb-1 text-sm tracking-tight">Models</span>
              <span className="text-neutral-400 hover:text-white transition-colors text-sm tracking-tight cursor-pointer">Infrastructure</span>
              <span className="text-neutral-400 hover:text-white transition-colors text-sm tracking-tight cursor-pointer">Compute</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex gap-4 items-center">
              <span className="material-symbols-outlined text-white cursor-pointer hover:opacity-80 transition-opacity">notifications</span>
              <span className="material-symbols-outlined text-white cursor-pointer hover:opacity-80 transition-opacity">account_circle</span>
            </div>
            <button className="bg-white text-neutral-900 px-6 py-2 rounded-full text-sm font-bold scale-102 hover:opacity-90 transition-all duration-200">
              Deploy Model
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-12 space-y-12">
          {/* Hero Section */}
          <section className="flex flex-col md:flex-row gap-8 items-end justify-between">
            <div className="max-w-2xl space-y-4">
              <span className="text-xs text-[#d5c5a6] uppercase tracking-wider" style={{ fontFamily: "'Space Grotesk', monospace" }}>System Overview</span>
              <h2 className="text-6xl font-light tracking-tighter leading-none">Core Architecture Overview</h2>
              <p className="text-[#c4c7c8] text-lg font-light leading-relaxed">High-performance neural compute distribution across distributed nodes. Optimization levels are currently operating at peak efficiency with minimal latency.</p>
            </div>
            <div className="flex flex-col items-end gap-4 shrink-0">
              <div className="bg-[#201f1f] rounded-full px-8 py-6 flex items-center gap-6 border border-white/5">
                <div className="text-right">
                  <p className="text-[10px] text-[#d5c5a6] uppercase tracking-wider" style={{ fontFamily: "'Space Grotesk', monospace" }}>AI Suggestions Ready</p>
                  <h3 className="text-2xl font-bold tracking-tight text-white">{Math.max(0, datasets.filter(d => d.status === 'uploaded').length)} Actions</h3>
                </div>
                <button className="bg-white text-neutral-950 px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform">
                  View
                </button>
              </div>
            </div>
          </section>

          {/* Metrics Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#1c1b1b] rounded-xl p-8 flex flex-col justify-between h-48 border border-white/5 group hover:bg-[#201f1f] transition-colors">
              <div className="flex justify-between items-start">
                <span className="text-xs text-neutral-500 uppercase tracking-wider" style={{ fontFamily: "'Space Grotesk', monospace" }}>Total Datasets</span>
                <span className="material-symbols-outlined text-neutral-600 group-hover:text-white transition-colors">database</span>
              </div>
              <div className="flex items-baseline gap-2">
                <h4 className="text-5xl font-light tracking-tighter text-white">{datasets.length}</h4>
                <span className="text-xs text-[#d5c5a6] font-bold">+{datasets.filter(d => {
                  const date = new Date(d.last_modified || '')
                  const now = new Date()
                  return (now.getTime() - date.getTime()) < (24 * 60 * 60 * 1000)
                }).length}%</span>
              </div>
            </div>
            
            <div className="bg-[#1c1b1b] rounded-xl p-8 flex flex-col justify-between h-48 border border-white/5 group hover:bg-[#201f1f] transition-colors">
              <div className="flex justify-between items-start">
                <span className="text-xs text-neutral-500 uppercase tracking-wider" style={{ fontFamily: "'Space Grotesk', monospace" }}>Models Trained</span>
                <span className="material-symbols-outlined text-neutral-600 group-hover:text-white transition-colors">model_training</span>
              </div>
              <div className="flex items-baseline gap-2">
                <h4 className="text-5xl font-light tracking-tighter text-white">{Math.floor(datasets.length * 0.3)}</h4>
                <span className="text-xs text-[#d5c5a6] font-bold">Active</span>
              </div>
            </div>
            
            <div className="bg-[#1c1b1b] rounded-xl p-8 flex flex-col justify-between h-48 border border-white/5 group hover:bg-[#201f1f] transition-colors">
              <div className="flex justify-between items-start">
                <span className="text-xs text-neutral-500 uppercase tracking-wider" style={{ fontFamily: "'Space Grotesk', monospace" }}>Storage Used</span>
                <span className="material-symbols-outlined text-neutral-600 group-hover:text-white transition-colors">storage</span>
              </div>
              <div className="space-y-4">
                <h4 className="text-5xl font-light tracking-tighter text-white">{Math.min(99, datasets.length * 8)}%</h4>
                <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                  <div className="h-full bg-[#d5c5a6]" style={{ width: `${Math.min(100, datasets.length * 8)}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Dashboard Area */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Bar Chart Column */}
            <div className="lg:col-span-7 bg-[#1c1b1b] rounded-[2rem] p-10 border border-white/5">
              <div className="flex justify-between items-center mb-12">
                <h3 className="text-2xl font-light tracking-tight">Dataset Growth</h3>
                <div className="flex gap-2">
                  <span className="bg-neutral-800 text-neutral-400 px-4 py-1.5 rounded-full text-[10px] uppercase tracking-wider" style={{ fontFamily: "'Space Grotesk', monospace" }}>Weekly</span>
                  <span className="bg-white text-neutral-950 px-4 py-1.5 rounded-full text-[10px] uppercase tracking-wider font-bold" style={{ fontFamily: "'Space Grotesk', monospace" }}>Monthly</span>
                </div>
              </div>
              <div className="h-64 flex items-end justify-between gap-4">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                  <div key={day} className="flex-1 bg-white/5 hover:bg-white/20 transition-all rounded-full h-[60%] flex items-end justify-center pb-4 relative group" style={{ height: `${40 + (i % 3) * 20}%` }}>
                    <div className="w-2 bg-white rounded-full transition-all" style={{ height: `${30 + (i % 4) * 15}%` }}></div>
                    <span className="absolute -bottom-8 text-[9px] text-neutral-600 uppercase tracking-wider" style={{ fontFamily: "'Space Grotesk', monospace" }}>{day}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Featured Card */}
            <div className="lg:col-span-5 relative group overflow-hidden rounded-[2rem] h-[400px]">
              <img 
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                src="https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&auto=format&fit=crop&q=80" 
                alt="Abstract neural network visualization"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent flex flex-col justify-end p-10">
                <span className="text-xs text-[#d5c5a6] uppercase tracking-wider mb-2" style={{ fontFamily: "'Space Grotesk', monospace" }}>Advanced Inference</span>
                <h3 className="text-3xl font-light tracking-tighter text-white mb-4">Real-time optimization engine active</h3>
                <p className="text-neutral-400 font-light text-sm">Neural patterns being re-mapped for cluster efficiency in your workspace.</p>
              </div>
            </div>
          </div>

          {/* Recent Datasets Table */}
          <section className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-light tracking-tight">Recent Datasets</h3>
              <button className="text-[#d5c5a6] text-sm font-bold border-b border-[#d5c5a6]/30 hover:border-[#d5c5a6] transition-all pb-0.5">Explore All</button>
            </div>
            <div className="bg-[#0e0e0e] rounded-xl overflow-hidden border border-white/5">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-8 py-6 text-[10px] text-neutral-500 uppercase tracking-wider" style={{ fontFamily: "'Space Grotesk', monospace" }}>Dataset Identity</th>
                    <th className="px-8 py-6 text-[10px] text-neutral-500 uppercase tracking-wider" style={{ fontFamily: "'Space Grotesk', monospace" }}>Status</th>
                    <th className="px-8 py-6 text-[10px] text-neutral-500 uppercase tracking-wider" style={{ fontFamily: "'Space Grotesk', monospace" }}>Entries</th>
                    <th className="px-8 py-6 text-[10px] text-neutral-500 uppercase tracking-wider" style={{ fontFamily: "'Space Grotesk', monospace" }}>Last Modified</th>
                    <th className="px-8 py-6 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {datasets.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-12 text-center text-neutral-500">
                        <span className="material-symbols-outlined text-4xl mb-4 block">database</span>
                        <p className="text-sm">No datasets yet. Upload your first dataset to get started.</p>
                      </td>
                    </tr>
                  ) : (
                    datasets.slice(0, 5).map((dataset) => (
                      <tr key={dataset.id} className="hover:bg-white/5 transition-colors group">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-neutral-900 border border-white/10 flex items-center justify-center">
                              <span className="material-symbols-outlined text-sm text-white">{getDatasetIcon(dataset.file_type)}</span>
                            </div>
                            <div>
                              <p className="font-bold text-white text-sm">{dataset.name}</p>
                              <p className="text-[10px] text-neutral-600 uppercase tracking-wider" style={{ fontFamily: "'Space Grotesk', monospace" }}>{getDatasetType(dataset)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <span className="px-4 py-1.5 bg-[#534830] text-[#d5c5a6] text-[10px] font-bold rounded-full uppercase tracking-wider" style={{ fontFamily: "'Space Grotesk', monospace" }}>
                            {dataset.status === 'ready' ? 'Optimized' : dataset.status}
                          </span>
                        </td>
                        <td className="px-8 py-6 text-neutral-400 text-sm" style={{ fontFamily: "'Space Grotesk', monospace" }}>{formatNumber(dataset.row_count)}</td>
                        <td className="px-8 py-6 text-neutral-400 text-sm" style={{ fontFamily: "'Space Grotesk', monospace" }}>{formatRelativeTime(dataset.last_modified)}</td>
                        <td className="px-8 py-6 text-right">
                          <button className="material-symbols-outlined text-neutral-600 hover:text-white transition-colors">more_horiz</button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
