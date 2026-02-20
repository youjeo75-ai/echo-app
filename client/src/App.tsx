import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import html2canvas from 'html2canvas';
import {
  Send, Ghost, TrendingUp, Search, Image as ImageIcon,
  ArrowUp, ArrowDown, MessageCircle, Share2, Bookmark,
  Moon, Sun, Zap, BarChart3, Hash, Download,
  Trash2, FileText, Link, ExternalLink, Shield, Users, Flag, Ban, CheckCircle, XCircle, LogOut, Eye, EyeOff
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

interface Post {
  id: string;
  content: string;
  tags: string[];
  media?: any[];
  upvotes: number;
  downvotes: number;
  netVotes: number;
  timestamp: string;
  ownerId: string;
  comments?: any[];
  commentCount?: number;
  userVote?: 'up' | 'down' | null;
  isOwner?: boolean;
  isBookmarked?: boolean;
  hashtags?: string[];
  color?: number;
}

interface Report {
  id: string;
  postId: string;
  reportedBy: string;
  reason: string;
  timestamp: string;
  status: 'pending' | 'resolved' | 'dismissed';
  postContent?: string;
  postOwner?: string;
}

interface Ban {
  id: string;
  userId: string;
  reason: string;
  timestamp: string;
  expiresAt?: string;
}

function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [trendingHashtags, setTrendingHashtags] = useState<any[]>([]);
  const [userStats, setUserStats] = useState<any>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'bookmarked'>('all');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Admin state
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminPosts, setAdminPosts] = useState<Post[]>([]);
  const [adminReports, setAdminReports] = useState<Report[]>([]);
  const [adminBans, setAdminBans] = useState<Ban[]>([]);
  const [banUserId, setBanUserId] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const fetchData = async () => {
    try {
      const [postsRes, hashtagsRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/api/posts`),
        axios.get(`${API_URL}/api/trending/hashtags`),
        axios.get(`${API_URL}/api/stats`)
      ]);
      setPosts(postsRes.data);
      setTrendingHashtags(hashtagsRes.data);
      setUserStats(statsRes.data);
      setLoading(false);
    } catch (error) {
      toast.error('Connection lost');
    }
  };

  const handleAdminLogin = async () => {
    try {
      const response = await axios.post(`${API_URL}/api/admin/login`, { password: adminPassword });
      if (response.data.success) {
        setIsAdmin(true);
        setShowAdminPanel(true);
        loadAdminData();
        toast.success('Admin access granted! 🔐');
        setAdminPassword('');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Invalid password');
    }
  };

  const loadAdminData = async () => {
    try {
      const [postsRes, reportsRes, bansRes] = await Promise.all([
        axios.get(`${API_URL}/api/admin/posts`, { headers: { Authorization: `Bearer ${ADMIN_PASSWORD}` } }),
        axios.get(`${API_URL}/api/admin/reports`, { headers: { Authorization: `Bearer ${ADMIN_PASSWORD}` } }),
        axios.get(`${API_URL}/api/admin/bans`, { headers: { Authorization: `Bearer ${ADMIN_PASSWORD}` } })
      ]);
      setAdminPosts(postsRes.data);
      setAdminReports(reportsRes.data);
      setAdminBans(bansRes.data);
    } catch (error) {
      toast.error('Failed to load admin data');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }
      const response = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMediaFiles(prev => [...prev, ...response.data.files]);
      toast.success(`${files.length} file(s) uploaded!`);
    } catch (error) {
      toast.error('Failed to upload files');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeMedia = (index: number) => {
    setMediaFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPost.trim()) return;
    try {
      await axios.post(`${API_URL}/api/posts`, {
        content: newPost,
        tags: [],
        media: mediaFiles
      });
      setNewPost('');
      setMediaFiles([]);
      toast.success('Posted! 🎉');
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to post');
    }
  };

  const handleVote = async (id: string, type: 'up' | 'down') => {
    const post = posts.find(p => p.id === id);
    if (!post) return;
    try {
      const response = await axios.post(`${API_URL}/api/posts/${id}/vote`, { type });
      if (response.data.milestone) {
        setShowConfetti(true);
        toast.success(response.data.milestone);
        setTimeout(() => setShowConfetti(false), 5000);
      }
      setPosts(prev => prev.map(p => {
        if (p.id !== id) return p;
        return {
          ...p,
          upvotes: response.data.upvotes,
          downvotes: response.data.downvotes,
          netVotes: response.data.netVotes,
          userVote: response.data.userVote
        };
      }));
    } catch (error) {
      toast.error('Vote failed');
    }
  };

  const handleBookmark = async (id: string) => {
    try {
      const response = await axios.post(`${API_URL}/api/posts/${id}/bookmark`);
      setPosts(prev => prev.map(p =>
        p.id === id ? { ...p, isBookmarked: response.data.bookmarked } : p
      ));
      toast.success(response.data.bookmarked ? 'Bookmarked!' : 'Removed from bookmarks');
    } catch (error) {
      toast.error('Failed to bookmark');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this post?')) return;
    try {
      await axios.delete(`${API_URL}/api/posts/${id}`);
      toast.success('Post deleted');
      fetchData();
    } catch (error: any) {
      if (error.response?.status === 403) {
        toast.error('You can only delete your own posts');
      } else {
        toast.error('Failed to delete');
      }
    }
  };

  const handleReport = async (postId: string) => {
    const reason = prompt('Reason for report (optional):');
    try {
      await axios.post(`${API_URL}/api/posts/${postId}/report`, { reason });
      toast.success('Report submitted');
    } catch (error) {
      toast.error('Failed to submit report');
    }
  };

  const handleDownload = async (post: Post, postRef: React.RefObject<HTMLDivElement>) => {
    if (!postRef.current) return;
    try {
      const canvas = await html2canvas(postRef.current, {
        backgroundColor: darkMode ? '#0f172a' : '#f9fafb',
        scale: 2,
        logging: false,
        useCORS: true
      });
      const link = document.createElement('a');
      link.download = `echo-${post.id.slice(0, 8)}.png`;
      link.href = canvas.toDataURL();
      link.click();
      toast.success('Screenshot downloaded! 📸');
    } catch (error) {
      toast.error('Failed to download');
    }
  };

  const handleShare = async (post: Post) => {
    const shareData = { title: 'Echo Post', text: post.content, url: window.location.href };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (error) { copyToClipboard(post); }
    } else {
      copyToClipboard(post);
    }
  };

  const copyToClipboard = (post: Post) => {
    navigator.clipboard.writeText(`${post.content}\n\nvia Echo`);
    toast.success('Copied to clipboard!');
  };

  // Admin functions
  const handleAdminDelete = async (id: string) => {
    if (!confirm('Delete this post as admin?')) return;
    try {
      await axios.delete(`${API_URL}/api/admin/posts/${id}`, {
        headers: { Authorization: `Bearer ${ADMIN_PASSWORD}` }
      });
      toast.success('Post deleted by admin');
      loadAdminData();
      fetchData();
    } catch (error) {
      toast.error('Failed to delete post');
    }
  };

  const handleBanUser = async () => {
    if (!banUserId) {
      toast.error('User ID is required');
      return;
    }
    try {
      const durationMs = banDuration ? parseInt(banDuration) * 60 * 60 * 1000 : undefined;
      await axios.post(`${API_URL}/api/admin/ban`, {
        userId: banUserId,
        reason: banReason,
        duration: durationMs
      }, {
        headers: { Authorization: `Bearer ${ADMIN_PASSWORD}` }
      });
      toast.success(`User ${banUserId} banned!`);
      setBanUserId('');
      setBanReason('');
      setBanDuration('');
      loadAdminData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to ban user');
    }
  };

  const handleUnbanUser = async (userId: string) => {
    try {
      await axios.delete(`${API_URL}/api/admin/ban/${userId}`, {
        headers: { Authorization: `Bearer ${ADMIN_PASSWORD}` }
      });
      toast.success('User unbanned');
      loadAdminData();
    } catch (error) {
      toast.error('Failed to unban user');
    }
  };

  const handleResolveReport = async (reportId: string, status: 'resolved' | 'dismissed') => {
    try {
      await axios.patch(`${API_URL}/api/admin/reports/${reportId}`, { status }, {
        headers: { Authorization: `Bearer ${ADMIN_PASSWORD}` }
      });
      toast.success(`Report ${status}`);
      loadAdminData();
    } catch (error) {
      toast.error('Failed to update report');
    }
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBookmark = activeFilter === 'all' || post.isBookmarked;
    return matchesSearch && matchesBookmark;
  });

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-slate-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      {showConfetti && <Confetti recycle={false} numberOfPieces={200} />}
      <Toaster position="top-center" />
      
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute top-40 left-1/2 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <motion.div whileHover={{ rotate: 360 }} transition={{ duration: 0.5 }}>
              <Ghost className="w-10 h-10 text-purple-500" />
            </motion.div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">Echo</h1>
              <p className="text-sm opacity-60">Speak freely. Listen deeply.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {userStats && !isAdmin && (
              <div className="hidden md:flex items-center gap-4 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm">
                <div className="flex items-center gap-1">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm font-medium">{userStats.karma} karma</span>
                </div>
                <div className="w-px h-4 bg-white/20" />
                <div className="flex items-center gap-1">
                  <Bookmark className="w-4 h-4 text-purple-500" />
                  <span className="text-sm font-medium">{userStats.bookmarksCount}</span>
                </div>
              </div>
            )}
            {/* Admin Toggle */}
            {isAdmin ? (
              <button onClick={() => { setIsAdmin(false); setShowAdminPanel(false); }} className="p-2 rounded-full hover:bg-white/10 transition-colors" title="Exit admin">
                <LogOut className="w-5 h-5" />
              </button>
            ) : (
              <button onClick={() => setShowAdminPanel(!showAdminPanel)} className="p-2 rounded-full hover:bg-white/10 transition-colors" title="Admin panel">
                <Shield className="w-5 h-5" />
              </button>
            )}
            <button onClick={() => setDarkMode(!darkMode)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>

        {/* Admin Panel */}
        {showAdminPanel && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-purple-500/20 to-cyan-500/20 border border-purple-500/30">
            {!isAdmin ? (
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-sm opacity-60">Admin Password</label>
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
                      className="flex-1 px-4 py-2 rounded-lg bg-white/10 border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Enter admin password"
                    />
                    <button onClick={() => setShowPassword(!showPassword)} className="p-2 hover:bg-white/10 rounded">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button onClick={handleAdminLogin} className="px-4 py-2 bg-purple-500 rounded-lg hover:opacity-90">Login</button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2"><Shield className="w-5 h-5" /> Admin Panel</h2>
                  <button onClick={() => loadAdminData()} className="px-3 py-1 bg-white/10 rounded-lg hover:bg-white/20 text-sm">Refresh</button>
                </div>
                
                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4" /><span className="font-medium">Active Bans</span></div>
                    <p className="text-2xl font-bold">{adminBans.length}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="flex items-center gap-2 mb-2"><Flag className="w-4 h-4" /><span className="font-medium">Pending Reports</span></div>
                    <p className="text-2xl font-bold">{adminReports.filter(r => r.status === 'pending').length}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="flex items-center gap-2 mb-2"><Trash2 className="w-4 h-4" /><span className="font-medium">Total Posts</span></div>
                    <p className="text-2xl font-bold">{adminPosts.length}</p>
                  </div>
                </div>

                {/* Ban User */}
                <div className="p-4 rounded-xl bg-white/5">
                  <h3 className="font-medium mb-3 flex items-center gap-2"><Ban className="w-4 h-4" /> Ban User</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input type="text" value={banUserId} onChange={(e) => setBanUserId(e.target.value)} placeholder="User ID" className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-sm" />
                    <input type="text" value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="Reason" className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-sm" />
                    <input type="number" value={banDuration} onChange={(e) => setBanDuration(e.target.value)} placeholder="Duration (hours)" className="px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-sm" />
                    <button onClick={handleBanUser} className="px-4 py-2 bg-red-500 rounded-lg hover:opacity-90 text-sm">Ban</button>
                  </div>
                </div>

                {/* Reports */}
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2"><Flag className="w-4 h-4" /> Reports</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {adminReports.filter(r => r.status === 'pending').map(report => (
                      <div key={report.id} className="p-3 rounded-lg bg-white/5 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Post: {report.postContent?.substring(0, 50)}...</p>
                          <p className="text-xs opacity-60">Reason: {report.reason} • By: {report.reportedBy.substring(0, 10)}...</p>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleResolveReport(report.id, 'resolved')} className="p-2 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30" title="Resolve"><CheckCircle className="w-4 h-4" /></button>
                          <button onClick={() => handleResolveReport(report.id, 'dismissed')} className="p-2 bg-gray-500/20 text-gray-400 rounded hover:bg-gray-500/30" title="Dismiss"><XCircle className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                    {adminReports.filter(r => r.status === 'pending').length === 0 && <p className="text-sm opacity-50">No pending reports</p>}
                  </div>
                </div>

                {/* Recent Posts (Admin Delete) */}
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Recent Posts</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {adminPosts.slice(0, 10).map(post => (
                      <div key={post.id} className="p-3 rounded-lg bg-white/5 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{post.content}</p>
                          <p className="text-xs opacity-60">By: {post.ownerId.substring(0, 10)}... • {new Date(post.timestamp).toLocaleDateString()}</p>
                        </div>
                        <button onClick={() => handleAdminDelete(post.id)} className="p-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30" title="Delete"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Main Content */}
        {!isAdmin && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 space-y-6">
              {/* Create Post */}
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`rounded-2xl p-6 backdrop-blur-xl border ${darkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-lg'}`}>
                <form onSubmit={handleSubmit}>
                  <textarea value={newPost} onChange={(e) => setNewPost(e.target.value)} placeholder="What's on your mind? (Use #hashtags)" className={`w-full bg-transparent border-none text-lg resize-none focus:outline-none placeholder:opacity-50 ${darkMode ? 'text-white' : 'text-gray-900'}`} rows={3} maxLength={1000} />
                  {mediaFiles.length > 0 && (
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                      {mediaFiles.map((file, index) => (
                        <div key={index} className="relative group">
                          {file.fileType === 'image' ? <img src={file.fileUrl} alt={file.fileName} className="w-full h-24 object-cover rounded-lg" /> : file.fileType === 'video' ? <video src={file.fileUrl} className="w-full h-24 object-cover rounded-lg" controls /> : <div className="w-full h-24 bg-white/5 rounded-lg flex items-center justify-center"><FileText className="w-8 h-8 text-purple-400" /></div>}
                          <button type="button" onClick={() => removeMedia(index)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"><XCircle className="w-3 h-3" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,video/*,.pdf,.doc,.docx,.txt" multiple className="hidden" />
                      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className={`p-2 rounded-lg transition-colors ${uploading ? 'opacity-50' : 'bg-white/5 hover:bg-white/10'}`} title="Upload from device">{uploading ? '⌛' : <ImageIcon className="w-4 h-4" />}</button>
                      <span className="text-sm opacity-60">{newPost.length}/1000</span>
                    </div>
                    <button type="submit" disabled={!newPost.trim() || uploading} className="px-6 py-2 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"><Send className="w-4 h-4" /><span className="hidden sm:inline">Post</span></button>
                  </div>
                </form>
              </motion.div>

              {/* Filters */}
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search echoes..." className={`w-full pl-10 pr-4 py-2 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${darkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-100 border-gray-200'}`} />
                </div>
                <button onClick={() => setActiveFilter(activeFilter === 'all' ? 'bookmarked' : 'all')} className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeFilter === 'bookmarked' ? 'bg-purple-500 text-white' : 'bg-white/5 hover:bg-white/10'}`}><Bookmark className="w-4 h-4 inline mr-2" />{activeFilter === 'all' ? 'Bookmarks' : 'All Posts'}</button>
              </div>

              {/* Posts Feed */}
              <div className="space-y-4">
                {loading ? <div className="text-center py-12 opacity-50">Loading...</div> : filteredPosts.length === 0 ? <div className="text-center py-12 opacity-50"><Ghost className="w-12 h-12 mx-auto mb-3" /><p>No echoes found</p></div> : (
                  <AnimatePresence>{filteredPosts.map((post) => (<PostCard key={post.id} post={post} onVote={handleVote} onBookmark={handleBookmark} onDelete={handleDelete} onDownload={handleDownload} onShare={handleShare} onReport={handleReport} darkMode={darkMode} />))}</AnimatePresence>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="hidden lg:block space-y-6">
              <div className={`rounded-2xl p-6 backdrop-blur-xl border ${darkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-lg'}`}>
                <div className="flex items-center gap-2 mb-4"><TrendingUp className="w-5 h-5 text-purple-500" /><h3 className="font-bold">Trending</h3></div>
                <div className="space-y-2">{trendingHashtags.length === 0 ? <p className="text-sm opacity-50">No hashtags yet</p> : trendingHashtags.map((hashtag) => (<div key={hashtag.tag} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"><div className="flex items-center gap-2"><Hash className="w-4 h-4 opacity-50" /><span className="text-sm font-medium">{hashtag.tag}</span></div><span className="text-xs opacity-50">{hashtag.count}</span></div>))}</div>
              </div>
              {userStats && (<div className={`rounded-2xl p-6 backdrop-blur-xl border ${darkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-lg'}`}><div className="flex items-center gap-2 mb-4"><BarChart3 className="w-5 h-5 text-cyan-500" /><h3 className="font-bold">Your Stats</h3></div><div className="space-y-3"><div className="flex justify-between text-sm"><span className="opacity-60">Posts</span><span className="font-medium">{userStats.postsCount}</span></div><div className="flex justify-between text-sm"><span className="opacity-60">Total Upvotes</span><span className="font-medium text-green-500">{userStats.totalUpvotes}</span></div><div className="flex justify-between text-sm"><span className="opacity-60">Karma</span><span className="font-medium text-purple-500">{userStats.karma}</span></div></div></div>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Post Card Component
function PostCard({ post, onVote, onBookmark, onDelete, onDownload, onShare, onReport, darkMode }: any) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const postRef = useRef<HTMLDivElement>(null);

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      await axios.post(`${API_URL}/api/posts/${post.id}/comments`, { content: commentText });
      setCommentText('');
      toast.success('Comment added!');
    } catch (error) {
      toast.error('Failed to comment');
    }
  };

  return (
    <motion.div ref={postRef} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className={`rounded-2xl p-6 backdrop-blur-xl border transition-all hover:scale-[1.01] ${darkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-lg'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex gap-2 flex-wrap">{post.hashtags?.map((tag: string) => (<span key={tag} className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-400">{tag}</span>))}</div>
        <div className="flex items-center gap-2">
          {post.isOwner && (<button onClick={() => onDelete(post.id)} className="p-1.5 rounded-full hover:bg-red-500/20 text-red-400 transition-colors" title="Delete post"><Trash2 className="w-4 h-4" /></button>)}
          <button onClick={() => onReport(post.id)} className="p-1.5 rounded-full hover:bg-yellow-500/20 text-yellow-400 transition-colors" title="Report"><Flag className="w-4 h-4" /></button>
          <button onClick={() => onDownload(post, postRef)} className="p-1.5 rounded-full hover:bg-white/10 transition-colors" title="Download as image"><Download className="w-4 h-4" /></button>
          <button onClick={() => onBookmark(post.id)} className={`p-1.5 rounded-full transition-colors ${post.isBookmarked ? 'text-purple-500 bg-purple-500/20' : 'opacity-50 hover:opacity-100'}`} title="Bookmark"><Bookmark className="w-4 h-4" /></button>
          <button onClick={() => onShare(post)} className="p-1.5 rounded-full hover:bg-white/10 transition-colors" title="Share"><Share2 className="w-4 h-4" /></button>
        </div>
      </div>
      <p className={`mb-4 leading-relaxed ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{post.content}</p>
      {post.media && post.media.length > 0 && (<div className="mb-4 grid grid-cols-2 md:grid-cols-3 gap-2">{post.media.map((file: any, index: number) => (<div key={index}>{file.fileType === 'image' ? <img src={file.fileUrl} alt={file.fileName} className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-90" /> : file.fileType === 'video' ? <video src={file.fileUrl} className="w-full h-32 object-cover rounded-lg" controls /> : <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" className="w-full h-32 bg-white/5 rounded-lg flex flex-col items-center justify-center gap-2 hover:bg-white/10 transition-colors"><FileText className="w-8 h-8 text-purple-400" /><span className="text-xs text-purple-400 text-center px-2">{file.fileName}</span></a>}</div>))}</div>)}
      <div className="flex items-center justify-between pt-4 border-t border-white/10">
        <div className="flex items-center gap-1">
          <button onClick={() => onVote(post.id, 'up')} className={`p-2 rounded-full transition-colors ${post.userVote === 'up' ? 'text-green-500 bg-green-500/20' : 'hover:bg-white/10'}`}><ArrowUp className="w-4 h-4" /></button>
          <span className="px-3 py-1 rounded-full text-sm font-bold text-green-500">{post.upvotes}</span>
          <span className="px-1 text-gray-500">/</span>
          <span className="px-3 py-1 rounded-full text-sm font-bold text-red-500">{post.downvotes}</span>
          <button onClick={() => onVote(post.id, 'down')} className={`p-2 rounded-full transition-colors ${post.userVote === 'down' ? 'text-red-500 bg-red-500/20' : 'hover:bg-white/10'}`}><ArrowDown className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1 text-sm opacity-60 hover:opacity-100 transition-opacity"><MessageCircle className="w-4 h-4" />{post.commentCount || 0}</button>
        </div>
      </div>
      {showComments && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-4 pt-4 border-t border-white/10 space-y-3">{post.comments?.map((comment: any) => (<div key={comment.id} className={`text-sm p-3 rounded-lg ${darkMode ? 'bg-white/5' : 'bg-gray-100'}`}>{comment.content}</div>))}<form onSubmit={handleComment} className="flex gap-2"><input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add a comment..." className={`flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${darkMode ? 'bg-white/5' : 'bg-gray-100'}`} /><button type="submit" className="px-4 py-2 bg-purple-500 rounded-lg text-sm font-medium hover:opacity-90">Post</button></form></motion.div>)}
    </motion.div>
  );
}

export default App;
