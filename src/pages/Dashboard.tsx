import { useState, useRef, useEffect, useCallback } from 'react'
import { AICleanPage as AIDataScientist } from '@/components/AICleanPage'
import { usePipeline } from '@/context/PipelineContext'
import { useNavigate, useLocation, Routes, Route, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { toast } from 'sonner'
import { parseCSV, parseJSON, analyzeColumns, cleanData, transformData } from '@/lib/dataProcessing'

const AIDataScientistWrapper = () => {
  const { loadDatasetRecord } = usePipeline();
  const location = useLocation();
  const datasetId = new URLSearchParams(location.search).get('dataset');
  
  useEffect(() => {
    if (datasetId) {
      loadDatasetRecord(datasetId);
    }
  }, [datasetId, loadDatasetRecord]);

  return <AIDataScientist />;
};

const HF = "'Inter', sans-serif"

interface Dataset {
  id: string
  name: string
  file_name: string
  file_type: string
  row_count: number
  column_count: number
  status: string
  created_at?: string
  updated_at?: string
  column_analysis?: any
}

interface Profile {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
  created_at: string | null
}

// Sidebar Navigation Items
const navItems = [
  { id: 'overview', label: 'Overview', icon: 'dashboard', path: '/dashboard' },
  { id: 'datasets', label: 'Datasets', icon: 'database', path: '/dashboard/datasets' },
  { id: 'explore-ai', label: 'AI Data Scientist', icon: 'auto_fix', path: '/dashboard/clean-ai' },
]

// Sidebar Component
function Sidebar({ 
  profile, 
  isMobileOpen, 
  setIsMobileOpen,
  onSignOut,
  onAvatarChange,
  isHidden
}: { 
  profile: Profile | null
  isMobileOpen: boolean
  setIsMobileOpen: (open: boolean) => void
  onSignOut: () => void
  onAvatarChange: (file: File) => Promise<void>
  isHidden?: boolean
}) {
  const location = useLocation()
  const { user } = useAuth()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  if (isHidden) return null
  
  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/dashboard/'
    }
    return location.pathname.startsWith(path)
  }

  const handleAvatarClick = () => {
    setShowProfileMenu(!showProfileMenu)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setIsUploadingAvatar(true)
    try {
      await onAvatarChange(file)
      toast.success('Avatar updated successfully')
    } catch (error) {
      toast.error('Failed to update avatar')
    } finally {
      setIsUploadingAvatar(false)
      setShowProfileMenu(false)
    }
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky top-0 left-0 h-screen w-64 bg-neutral-950 border-r border-neutral-800 
        flex flex-col py-6 px-4 shrink-0 z-50
        transition-transform duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="mb-8 px-4">
          <Link to="/" className="block">
            <h1 className="text-xl font-bold tracking-tighter text-white">Pipeline Labs</h1>
          </Link>
          <p className="text-[10px] uppercase tracking-wider text-neutral-500 mt-1" style={{ fontFamily: "'Space Grotesk', monospace" }}>
            AI Data Platform
          </p>
        </div>
        
        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.id}
              to={item.path}
              onClick={() => setIsMobileOpen(false)}
              className={`
                w-full flex items-center gap-3 rounded-lg px-4 py-3 transition-all duration-200
                ${isActive(item.path) 
                  ? 'bg-white text-neutral-950 font-medium' 
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                }
              `}
            >
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </Link>
          ))}
        </nav>
        
        {/* User Profile Section with Dropdown */}
        <div className="mt-auto pt-6 border-t border-neutral-800 relative" ref={menuRef}>
          {profile && (
            <div className="px-4">
              {/* Clickable Profile Row */}
              <button 
                onClick={handleAvatarClick}
                className="w-full flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-neutral-800 transition-colors text-left"
              >
                <div className="relative">
                  {profile.avatar_url ? (
                    <img 
                      src={profile.avatar_url} 
                      alt={profile.full_name || 'Profile'}
                      className="w-10 h-10 rounded-full object-cover border border-neutral-700"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                      <span className="material-symbols-outlined text-neutral-400">person</span>
                    </div>
                  )}
                  {isUploadingAvatar && (
                    <div className="absolute inset-0 flex items-center justify-center bg-neutral-950/80 rounded-full">
                      <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {profile.full_name || 'User'}
                  </p>
                  <p className="text-xs text-neutral-500 truncate">
                    {profile.email || user?.email}
                  </p>
                </div>
                <span className="material-symbols-outlined text-neutral-500 text-sm">
                  {showProfileMenu ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {/* Profile Dropdown Menu */}
              {showProfileMenu && (
                <div className="mt-2 py-2 bg-neutral-800 rounded-lg border border-neutral-700 shadow-lg">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">image</span>
                    Change Avatar
                  </button>
                  <button
                    onClick={() => {
                      onSignOut()
                      setShowProfileMenu(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-neutral-300 hover:text-red-400 hover:bg-neutral-700 transition-colors"
                  >
                    <span className="material-symbols-outlined text-lg">logout</span>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

// Mobile Header
function MobileHeader({ 
  onMenuClick, 
  profile,
  notificationCount = 0
}: { 
  onMenuClick: () => void
  profile: Profile | null
  notificationCount?: number
}) {
  return (
    <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-16 bg-neutral-950/95 backdrop-blur-xl border-b border-neutral-800">
      <button 
        onClick={onMenuClick}
        className="p-2 -ml-2 text-white hover:bg-neutral-800 rounded-lg transition-colors"
      >
        <span className="material-symbols-outlined">menu</span>
      </button>
      
      <Link to="/dashboard" className="flex items-center gap-2">
        <span className="text-lg font-bold text-white">Pipeline Labs</span>
      </Link>
      
      <div className="flex items-center gap-3">
        <button className="relative p-2 text-white hover:bg-neutral-800 rounded-lg transition-colors">
          <span className="material-symbols-outlined">notifications</span>
          {notificationCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>
        {profile?.avatar_url ? (
          <img 
            src={profile.avatar_url} 
            alt="Profile" 
            className="w-8 h-8 rounded-full object-cover border border-neutral-700"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center">
            <span className="material-symbols-outlined text-sm text-neutral-400">person</span>
          </div>
        )}
      </div>
    </header>
  )
}

// Overview Page
function OverviewPage({ 
  datasets, 
  isUploading, 
  onUploadClick,
  profile
}: { 
  datasets: Dataset[]
  isUploading: boolean
  onUploadClick: () => void
  profile: Profile | null
}) {
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
    if (type?.includes('image') || type?.includes('medical')) return 'image'
    if (type?.includes('text') || type?.includes('nlp')) return 'text_fields'
    return 'table_chart'
  }

  const getDatasetType = (dataset: Dataset) => {
    const ext = dataset.file_name?.split('.').pop()?.toLowerCase() || ''
    const typeMap: Record<string, string> = {
      'csv': 'Behavioral Data',
      'json': 'Structured Data',
      'xlsx': 'Spreadsheet',
      'xls': 'Spreadsheet',
      'parquet': 'Columnar Storage',
      'pdf': 'Document',
      'txt': 'Text Data'
    }
    return typeMap[ext] || 'Raw Data'
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Welcome Section */}
      <section className="flex flex-col md:flex-row gap-6 items-end justify-between">
        <div className="max-w-2xl space-y-3">
          <span className="text-xs text-[#d5c5a6] uppercase tracking-wider" style={{ fontFamily: "'Space Grotesk', monospace" }}>
            Dashboard
          </span>
          <h2 className="text-4xl lg:text-5xl font-light tracking-tighter leading-none text-white">
            Welcome back, {profile?.full_name?.split(' ')[0] || 'User'}
          </h2>
          <p className="text-neutral-400 text-lg font-light leading-relaxed">
            Transform your messy data into trainable AI models. Upload datasets, clean them with AI, and export ready-to-train data.
          </p>
        </div>
        <div className="flex flex-col items-end gap-4 shrink-0">
          <button 
            onClick={onUploadClick}
            disabled={isUploading}
            className="bg-white text-neutral-900 px-6 py-3 rounded-full font-bold text-sm hover:scale-105 transition-transform disabled:opacity-50 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">upload</span>
            {isUploading ? 'Uploading...' : 'New Dataset'}
          </button>
        </div>
      </section>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1c1b1b] rounded-xl p-6 border border-white/5">
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs text-neutral-500 uppercase tracking-wider">Total Datasets</span>
            <span className="material-symbols-outlined text-neutral-600">database</span>
          </div>
          <h4 className="text-3xl font-light text-white">{datasets.length}</h4>
          <p className="text-xs text-neutral-500 mt-1">
            {datasets.filter(d => {
              const date = new Date(d.updated_at || '')
              const now = new Date()
              return (now.getTime() - date.getTime()) < (24 * 60 * 60 * 1000)
            }).length} new today
          </p>
        </div>
        
        <div className="bg-[#1c1b1b] rounded-xl p-6 border border-white/5">
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs text-neutral-500 uppercase tracking-wider">AI Cleaned</span>
            <span className="material-symbols-outlined text-neutral-600">auto_fix</span>
          </div>
          <h4 className="text-3xl font-light text-white">
            {datasets.filter(d => d.status === 'cleaned' || d.status === 'ready').length}
          </h4>
          <p className="text-xs text-neutral-500 mt-1">Ready for training</p>
        </div>
        
        <div className="bg-[#1c1b1b] rounded-xl p-6 border border-white/5">
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs text-neutral-500 uppercase tracking-wider">Total Rows</span>
            <span className="material-symbols-outlined text-neutral-600">table_rows</span>
          </div>
          <h4 className="text-3xl font-light text-white">
            {formatNumber(datasets.reduce((acc, d) => acc + (d.row_count || 0), 0))}
          </h4>
          <p className="text-xs text-neutral-500 mt-1">Across all datasets</p>
        </div>
        
        <div className="bg-[#1c1b1b] rounded-xl p-6 border border-white/5">
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs text-neutral-500 uppercase tracking-wider">Storage</span>
            <span className="material-symbols-outlined text-neutral-600">storage</span>
          </div>
          <h4 className="text-3xl font-light text-white">{Math.min(99, datasets.length * 5)}%</h4>
          <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-[#d5c5a6]" style={{ width: `${Math.min(100, datasets.length * 5)}%` }} />
          </div>
        </div>
      </div>

      {/* Recent Datasets */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-light text-white">Recent Datasets</h3>
          <Link to="/dashboard/datasets" className="text-[#d5c5a6] text-sm hover:underline">
            View All
          </Link>
        </div>
        
        <div className="bg-[#0e0e0e] rounded-xl overflow-hidden border border-white/5">
          {datasets.length === 0 ? (
            <div className="p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-neutral-600 mb-4 block">database</span>
              <p className="text-neutral-400 mb-4">No datasets yet. Upload your first dataset to get started.</p>
              <button 
                onClick={onUploadClick}
                className="bg-white text-neutral-900 px-6 py-2 rounded-full text-sm font-bold hover:opacity-90 transition-opacity"
              >
                Upload Dataset
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-6 py-4 text-xs text-neutral-500 uppercase tracking-wider">Dataset</th>
                    <th className="px-6 py-4 text-xs text-neutral-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-4 text-xs text-neutral-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-xs text-neutral-500 uppercase tracking-wider">Rows</th>
                    <th className="px-6 py-4 text-xs text-neutral-500 uppercase tracking-wider">Last Modified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {datasets.slice(0, 5).map((dataset) => (
                    <tr key={dataset.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-white/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-white">{getDatasetIcon(dataset.file_type)}</span>
                          </div>
                          <div>
                            <p className="font-medium text-white text-sm">{dataset.file_name}</p>
                            <p className="text-xs text-neutral-500">{formatNumber(dataset.column_count || 0)} columns</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-neutral-400">{getDatasetType(dataset)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          dataset.status === 'ready' || dataset.status === 'cleaned'
                            ? 'bg-green-500/20 text-green-400'
                            : dataset.status === 'processing'
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-neutral-700 text-neutral-400'
                        }`}>
                          {dataset.status || 'Uploaded'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-neutral-400 text-sm">{formatNumber(dataset.row_count || 0)}</td>
                      <td className="px-6 py-4 text-neutral-500 text-sm">{formatRelativeTime(dataset.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

// Datasets Page
function DatasetsPage({ 
  datasets, 
  isUploading, 
  onUploadClick,
  onDeleteDataset
}: { 
  datasets: Dataset[]
  isUploading: boolean
  onUploadClick: () => void
  onDeleteDataset: (id: string) => void
}) {
  const [filter, setFilter] = useState('all')

  const filteredDatasets = datasets.filter(d => {
    if (filter === 'all') return true
    if (filter === 'ready') return d.status === 'ready' || d.status === 'cleaned'
    if (filter === 'processing') return d.status === 'processing' || d.status === 'uploaded'
    return true
  })

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
    return num.toLocaleString()
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-light text-white tracking-tight">Datasets</h2>
          <p className="text-neutral-400 mt-1">Manage and clean your data for AI training</p>
        </div>
        <button 
          onClick={onUploadClick}
          disabled={isUploading}
          className="bg-white text-neutral-900 px-5 py-2.5 rounded-full font-bold text-sm hover:scale-105 transition-transform disabled:opacity-50 flex items-center gap-2"
        >
          <span className="material-symbols-outlined">upload</span>
          {isUploading ? 'Uploading...' : 'Upload Dataset'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'ready', 'processing'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filter === f 
                ? 'bg-white text-neutral-900' 
                : 'bg-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Datasets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDatasets.map((dataset) => (
          <div key={dataset.id} className="bg-[#1c1b1b] rounded-xl p-6 border border-white/5 hover:border-white/10 transition-colors">
            <div className="flex justify-between items-start mb-4">
              <div className="w-12 h-12 rounded-lg bg-neutral-900 border border-white/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-2xl text-white">table_chart</span>
              </div>
              <button 
                onClick={() => onDeleteDataset(dataset.id)}
                className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
              >
                <span className="material-symbols-outlined">delete</span>
              </button>
            </div>
            
            <h4 className="font-medium text-white mb-1 truncate">{dataset.file_name}</h4>
            <p className="text-xs text-neutral-500 mb-4">
              {formatNumber(dataset.row_count || 0)} rows • {dataset.column_count || 0} columns
            </p>
            
            <div className="flex items-center justify-between">
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                dataset.status === 'ready' || dataset.status === 'cleaned'
                  ? 'bg-green-500/20 text-green-400'
                  : dataset.status === 'processing'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-neutral-700 text-neutral-400'
              }`}>
                {dataset.status || 'Uploaded'}
              </span>
              <Link 
                to={`/dashboard/clean-ai?dataset=${dataset.id}`}
                className="text-[#d5c5a6] text-sm hover:underline flex items-center gap-1"
              >
                Clean with AI
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </Link>
            </div>
          </div>
        ))}
      </div>

      {filteredDatasets.length === 0 && (
        <div className="text-center py-16">
          <span className="material-symbols-outlined text-4xl text-neutral-600 mb-4 block">folder_open</span>
          <p className="text-neutral-400">No datasets found</p>
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load profile
  const loadProfile = async () => {
    if (!user) {
      console.log('[DEBUG] No user, skipping profile load')
      return
    }
    
    // Check session
    const { data: { session } } = await supabase.auth.getSession()
    console.log('[DEBUG] Session:', session ? 'Present' : 'Missing', 'User ID:', user.id)
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (error) {
        console.error('[DEBUG] Profile load error:', error)
        throw error
      }
      
      console.log('[DEBUG] Profile loaded:', data)
      setProfile(data)
    } catch (err) {
      console.error('Error loading profile:', err)
    }
  }

  // Load datasets
  const loadDatasets = async () => {
    if (!user) {
      console.log('[DEBUG] No user, skipping datasets load')
      return
    }
    
    try {
      const { data: datasetsData, error } = await supabase
        .from('datasets')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('[DEBUG] Datasets load error:', error)
        throw error
      }
      
      console.log('[DEBUG] Datasets loaded:', datasetsData?.length || 0)
      
      setDatasets(datasetsData?.map((d: any) => ({
        id: d.id,
        name: d.file_name,
        file_name: d.file_name,
          file_type: d.mime_type || d.file_name?.split('.').pop(),
        row_count: d.row_count || 0,
        column_count: d.column_count || 0,
        status: d.status || 'uploaded',
        created_at: d.created_at,
        updated_at: d.updated_at,
        column_analysis: d.column_analysis
      })) || [])
    } catch (err) {
      console.error('Error loading datasets:', err)
      toast.error('Failed to load datasets')
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      await Promise.all([loadProfile(), loadDatasets()])
      setIsLoading(false)
    }
    loadData()
  }, [user])

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) {
      console.log('[DEBUG] No file or no user:', { file: !!file, user: !!user })
      return
    }

    console.log('[DEBUG] Starting upload:', { fileName: file.name, fileSize: file.size, userId: user.id })
    setIsUploading(true)
    
    try {
      const lowerFileName = file.name.toLowerCase()
      const isJson = lowerFileName.endsWith('.json')
      const isCsv = lowerFileName.endsWith('.csv')

      if (!isJson && !isCsv) {
        throw new Error('Only CSV and JSON datasets are supported right now.')
      }

      // Parse file first before upload
      const fileText = await file.text()
      const rawData = isJson ? parseJSON(fileText) : parseCSV(fileText)
      
      // Create new File object for upload (avoid consumed stream issues)
      const fileBlob = new Blob([fileText], { type: file.type || (isJson ? 'application/json' : 'text/csv') })
      const uploadFile = new File([fileBlob], file.name, { type: fileBlob.type })
      
      const filePath = `${user.id}/${Date.now()}_${file.name}`
      const contentType = uploadFile.type

      console.log('[DEBUG] Uploading to storage:', { filePath, contentType, bucket: 'datasets', size: uploadFile.size })
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('datasets')
        .upload(filePath, uploadFile, {
          contentType,
          upsert: true,
        })

      if (uploadError) {
        console.error('[DEBUG] Storage upload error:', uploadError)
        throw new Error(`Storage upload failed: ${uploadError.message}`)
      }
      
      console.log('[DEBUG] Storage upload success:', uploadData)

      console.log('[DEBUG] Inserting dataset record:', { user_id: user.id, file_name: file.name, rows: rawData.length })
      
      // Get fresh user to ensure auth token is current
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) throw new Error('Not authenticated')
      
      const { data: insertData, error: insertError } = await supabase
        .from('datasets')
        .insert([{
          user_id: currentUser.id,
          file_name: file.name,
          mime_type: contentType,
          storage_path: filePath,
          row_count: rawData.length,
          column_count: rawData.length > 0 ? Object.keys(rawData[0]).length : 0,
          status: 'uploaded',
          preview_rows: rawData.slice(0, 20),
        }])

      if (insertError) {
        console.error('[DEBUG] DB insert error:', insertError)
        await supabase.storage.from('datasets').remove([filePath])
        throw new Error(`Database insert failed: ${insertError.message}`)
      }
      
      console.log('[DEBUG] Insert success:', insertData)

      toast.success(`Dataset "${file.name}" uploaded successfully (${rawData.length} rows)`)
      await loadDatasets()
    } catch (error) {
      console.error('[DEBUG] Upload error details:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to upload dataset')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteDataset = async (id: string) => {
    try {
      const { error } = await supabase
        .from('datasets')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      
      toast.success('Dataset deleted')
      await loadDatasets()
    } catch (error) {
      toast.error('Failed to delete dataset')
    }
  }

  // Handle avatar upload from sidebar
  const handleAvatarChange = async (file: File) => {
    if (!user) throw new Error('No user')
    
    const fileExt = file.name.split('.').pop()
    const filePath = `${user.id}/avatar.${fileExt}`
    
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, { upsert: true })
    
    if (uploadError) throw uploadError
    
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath)
    
    const { error: updateError } = await supabase
      .from('profiles')
      .upsert({ 
        id: user.id,
        avatar_url: publicUrl,
        updated_at: new Date().toISOString()
      })
    
    if (updateError) throw updateError
    
    await loadProfile()
  }

  if (!user || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#131313' }}>
        <span className="material-symbols-outlined animate-spin text-white" style={{ fontSize: '32px' }}>refresh</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#131313] text-[#e5e2e1]" style={{ fontFamily: HF }}>
      {/* Fonts */}
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Space+Grotesk:wght@300..700&display=swap" rel="stylesheet"/>
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
      
      {/* Hidden file input for uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.json"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Mobile Header */}
      <MobileHeader 
        onMenuClick={() => setIsMobileMenuOpen(true)} 
        profile={profile}
      />

      <div className="flex">
        {/* Sidebar */}
        <Sidebar 
          profile={profile} 
          isMobileOpen={isMobileMenuOpen}
          setIsMobileOpen={setIsMobileMenuOpen}
          onSignOut={handleSignOut}
          onAvatarChange={handleAvatarChange}
          isHidden={location.pathname === '/dashboard/clean-ai'}
        />

        {/* Main Content */}
        <main className="flex-1 min-w-0 lg:h-screen lg:overflow-y-auto">
          <Routes>
            <Route 
              path="/" 
              element={
                <OverviewPage 
                  datasets={datasets} 
                  isUploading={isUploading}
                  onUploadClick={() => fileInputRef.current?.click()}
                  profile={profile}
                />
              } 
            />
            <Route 
              path="/datasets" 
              element={
                <DatasetsPage 
                  datasets={datasets}
                  isUploading={isUploading}
                  onUploadClick={() => fileInputRef.current?.click()}
                  onDeleteDataset={handleDeleteDataset}
                />
              } 
            />
            <Route path="/clean-ai" element={<AIDataScientistWrapper />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
