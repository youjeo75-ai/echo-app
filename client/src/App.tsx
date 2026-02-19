import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import Confetti from 'react-confetti';
import html2canvas from 'html2canvas';
import {
  Send, Ghost, TrendingUp, Search, X, Image as ImageIcon,
  ArrowUp, ArrowDown, MessageCircle, Share2, Bookmark,
  Moon, Sun, Zap, BarChart3, Hash, Download,
  Trash2, FileText, Link, ExternalLink, Video, File, Plus
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface MediaFile {
  fileUrl: string;
  fileName: string;
  fileType: 'image' | 'video' | 'file';
  fileSize: number;
}

interface Post {
  id: string;
  content: string;
  tags: string[];
  media?: MediaFile[];
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

function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const [trendingHashtags, setTrendingHashtags] = useState<any[]>([]);
  const [userStats, setUserStats] = useState<any>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'bookmarked'>('all');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const [postsRes, hashtagsRes, statsRes, trendingRes] = await Promise.all([
        axios.get(`${API_URL}/api/posts`),
        axios.get(`${API_URL}/api/trending/hashtags`),
        axios.get(`${API_URL}/api/stats`),
        axios.get(`${API_URL}/api/trending`)
      ]);
      setPosts(postsRes.data);
      setTrendingHashtags(hashtagsRes.data);
      setUserStats(statsRes.data);
      setLoading(false);
    } catch (error) {
      toast.error('Connection lost - check if server is running');
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
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setMediaFiles(prev => [...prev, ...response.data.files]);
      toast.success(`${files.length} file(s) uploaded!`);
    } catch (error) {
      toast.error('Failed to upload files');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
    if (!confirm('Delete this post? This cannot be undone.')) return;
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
    const shareData = {
      title: 'Echo Post',
      text: post.content,
      url: window.location.href
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (error) {
        copyToClipboard(post);
      }
    } else {
      copyToClipboard(post);
    }
  };

  const copyToClipboard = (post: Post) => {
    navigator.clipboard.writeText(`${post.content}\n\nvia Echo`);
    toast.success('Copied to clipboard!');
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBookmark = activeFilter === 'all' || post.isBookmarked;
    return matchesSearch && matchesBookmark;
  });

  const cardColors = [
    'from-purple-500/20 to-blue-500/20',
    'from-pink-500/20 to-rose-500/20',
    'from-cyan-500/20 to-blue-500/20',
    'from-amber-500/20 to-orange-500/20',
    'from-emerald-500/20 to-teal-500/20'
  ];

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
            {userStats && (
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
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            {/* Create Post */}
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className={`rounded-2xl p-6 backdrop-blur-xl border ${darkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-lg'}`}
            >
              <form onSubmit={handleSubmit}>
                <textarea
                  value={newPost}
                  onChange={(e) => setNewPost(e.target.value)}
                  placeholder="What's on your mind? (Use #hashtags)"
                  className={`w-full bg-transparent border-none text-lg resize-none focus:outline-none placeholder:opacity-50 ${darkMode ? 'text-white' : 'text-gray-900'}`}
                  rows={3}
                  maxLength={1000}
                />
                
                {/* Media Preview */}
                {mediaFiles.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2">
                    {mediaFiles.map((file, index) => (
                      <div key={index} className="relative group">
                        {file.fileType === 'image' ? (
                          <img src={file.fileUrl} alt={file.fileName} className="w-full h-24 object-cover rounded-lg" />
                        ) : file.fileType === 'video' ? (
                          <video src={file.fileUrl} className="w-full h-24 object-cover rounded-lg" controls />
                        ) : (
                          <div className="w-full h-24 bg-white/5 rounded-lg flex items-center justify-center">
                            <File className="w-8 h-8 text-purple-400" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeMedia(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                      multiple
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className={`p-2 rounded-lg transition-colors ${uploading ? 'opacity-50' : 'bg-white/5 hover:bg-white/10'}`}
                      title="Upload from device"
                    >
                      {uploading ? (
                        <span className="animate-spin">⌛</span>
                      ) : (
                        <Plus className="w-4 h-4" />
                      )}
                    </button>
                    <span className="text-sm opacity-60">{newPost.length}/1000</span>
                  </div>
                  <button 
                    type="submit" 
                    disabled={!newPost.trim() || uploading}
                    className="px-6 py-2 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Post</span>
                  </button>
                </div>
              </form>
            </motion.div>

            {/* Filters */}
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search echoes..."
                  className={`w-full pl-10 pr-4 py-2 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${darkMode ? 'bg-white/5 border border-white/10' : 'bg-gray-100 border-gray-200'}`}
                />
              </div>
              <button
                onClick={() => setActiveFilter(activeFilter === 'all' ? 'bookmarked' : 'all')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeFilter === 'bookmarked' ? 'bg-purple-500 text-white' : 'bg-white/5 hover:bg-white/10'}`}
              >
                <Bookmark className="w-4 h-4 inline mr-2" />
                {activeFilter === 'all' ? 'Bookmarks' : 'All Posts'}
              </button>
            </div>

            {/* Posts Feed */}
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-12 opacity-50">Loading...</div>
              ) : filteredPosts.length === 0 ? (
                <div className="text-center py-12 opacity-50">
                  <Ghost className="w-12 h-12 mx-auto mb-3" />
                  <p>No echoes found</p>
                </div>
              ) : (
                <AnimatePresence>
                  {filteredPosts.map((post) => (
                    <PostCard 
                      key={post.id} 
                      post={post} 
                      onVote={handleVote}
                      onBookmark={handleBookmark}
                      onDelete={handleDelete}
                      onDownload={handleDownload}
                      onShare={handleShare}
                      darkMode={darkMode}
                      cardColors={cardColors}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="hidden lg:block space-y-6">
            {/* Trending Hashtags */}
            <div className={`rounded-2xl p-6 backdrop-blur-xl border ${darkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-lg'}`}>
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-purple-500" />
                <h3 className="font-bold">Trending</h3>
              </div>
              <div className="space-y-2">
                {trendingHashtags.length === 0 ? (
                  <p className="text-sm opacity-50">No hashtags yet</p>
                ) : (
                  trendingHashtags.map((hashtag) => (
                    <div key={hashtag.tag} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 opacity-50" />
                        <span className="text-sm font-medium">{hashtag.tag}</span>
                      </div>
                      <span className="text-xs opacity-50">{hashtag.count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Stats */}
            {userStats && (
              <div className={`rounded-2xl p-6 backdrop-blur-xl border ${darkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-lg'}`}>
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-cyan-500" />
                  <h3 className="font-bold">Your Stats</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="opacity-60">Posts</span>
                    <span className="font-medium">{userStats.postsCount}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="opacity-60">Total Upvotes</span>
                    <span className="font-medium text-green-500">{userStats.totalUpvotes}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="opacity-60">Karma</span>
                    <span className="font-medium text-purple-500">{userStats.karma}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Post Card Component
function PostCard({ post, onVote, onBookmark, onDelete, onDownload, onShare, darkMode, cardColors }: any) {
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
    <motion.div
      ref={postRef}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`rounded-2xl p-6 backdrop-blur-xl border transition-all hover:scale-[1.01] ${darkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-lg'}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex gap-2 flex-wrap">
          {post.hashtags?.map((tag: string) => (
            <span key={tag} className="text-xs px-2 py-1 rounded-full bg-purple-500/20 text-purple-400">
              {tag}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {post.isOwner && (
            <button
              onClick={() => onDelete(post.id)}
              className="p-1.5 rounded-full hover:bg-red-500/20 text-red-400 transition-colors"
              title="Delete post"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onDownload(post, postRef)}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
            title="Download as image"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => onBookmark(post.id)}
            className={`p-1.5 rounded-full transition-colors ${post.isBookmarked ? 'text-purple-500 bg-purple-500/20' : 'opacity-50 hover:opacity-100'}`}
            title="Bookmark"
          >
            <Bookmark className="w-4 h-4" />
          </button>
          <button
            onClick={() => onShare(post)}
            className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
            title="Share"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <p className={`mb-4 leading-relaxed ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>{post.content}</p>
      
      {/* Media Gallery */}
      {post.media && post.media.length > 0 && (
        <div className="mb-4 grid grid-cols-2 md:grid-cols-3 gap-2">
          {post.media.map((file: MediaFile, index: number) => (
            <div key={index}>
              {file.fileType === 'image' ? (
                <img src={file.fileUrl} alt={file.fileName} className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-90" />
              ) : file.fileType === 'video' ? (
                <video src={file.fileUrl} className="w-full h-32 object-cover rounded-lg" controls />
              ) : (
                <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" className="w-full h-32 bg-white/5 rounded-lg flex flex-col items-center justify-center gap-2 hover:bg-white/10 transition-colors">
                  <File className="w-8 h-8 text-purple-400" />
                  <span className="text-xs text-purple-400 text-center px-2">{file.fileName}</span>
                </a>
              )}
            </div>
          ))}
        </div>
      )}
      
      <div className="flex items-center justify-between pt-4 border-t border-white/10">
        <div className="flex items-center gap-1">
          <button onClick={() => onVote(post.id, 'up')} className={`p-2 rounded-full transition-colors ${post.userVote === 'up' ? 'text-green-500 bg-green-500/20' : 'hover:bg-white/10'}`}>
            <ArrowUp className="w-4 h-4" />
          </button>
          <span className="px-3 py-1 rounded-full text-sm font-bold text-green-500">{post.upvotes}</span>
          <span className="px-1 text-gray-500">/</span>
          <span className="px-3 py-1 rounded-full text-sm font-bold text-red-500">{post.downvotes}</span>
          <button onClick={() => onVote(post.id, 'down')} className={`p-2 rounded-full transition-colors ${post.userVote === 'down' ? 'text-red-500 bg-red-500/20' : 'hover:bg-white/10'}`}>
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1 text-sm opacity-60 hover:opacity-100 transition-opacity">
            <MessageCircle className="w-4 h-4" />
            {post.commentCount || 0}
          </button>
        </div>
      </div>
      {showComments && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-4 pt-4 border-t border-white/10 space-y-3">
          {post.comments?.map((comment: any) => (
            <div key={comment.id} className={`text-sm p-3 rounded-lg ${darkMode ? 'bg-white/5' : 'bg-gray-100'}`}>
              {comment.content}
            </div>
          ))}
          <form onSubmit={handleComment} className="flex gap-2">
            <input type="text" value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Add a comment..." className={`flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${darkMode ? 'bg-white/5' : 'bg-gray-100'}`} />
            <button type="submit" className="px-4 py-2 bg-purple-500 rounded-lg text-sm font-medium hover:opacity-90">Post</button>
          </form>
        </motion.div>
      )}
    </motion.div>
  );
}

export default App;
