const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3001;
const DB_FILE = path.join(__dirname, 'db.json');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const BANNED_FILE = path.join(__dirname, 'banned.json');

// Admin password from env or default (CHANGE IN PRODUCTION!)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// ============================================
// CREATE DIRECTORIES
// ============================================

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ============================================
// CONFIGURE MULTER FOR DIRECT FILE UPLOAD
// ============================================

const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        try {
            await fsPromises.mkdir(UPLOAD_DIR, { recursive: true });
            cb(null, UPLOAD_DIR);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `upload-${uniqueSuffix}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { 
        fileSize: 50 * 1024 * 1024, // 50MB per file
        files: 5 // Max 5 files per post
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|webm|mov|pdf|doc|docx|txt/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only images, videos, PDFs, and documents allowed'));
        }
    }
});

// ============================================
// CORS & MIDDLEWARE
// ============================================

app.use(cors({
    origin: [
        'http://localhost:5173',
        'http://localhost:3001',
        process.env.CLIENT_URL || '*',
        /.vercel.app$/,
        /.onrender.com$/,
        /.replit.dev$/,
        /.repl.co$/
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));

// ============================================
// DATABASE & BANNED USERS FUNCTIONS
// ============================================

const initializeDB = async () => {
    const data = {
        posts: [],
        comments: [],
        votes: [],
        bookmarks: [],
        users: [],
        reports: []
    };
    await fsPromises.writeFile(DB_FILE, JSON.stringify(data, null, 2));
    return data;
};

const readDB = async () => {
    try {
        const exists = await fsPromises.access(DB_FILE).then(() => true).catch(() => false);
        if (!exists) return await initializeDB();
        
        const data = await fsPromises.readFile(DB_FILE, 'utf8');
        const parsed = JSON.parse(data);
        
        // Ensure ALL arrays exist
        if (!parsed.posts || !Array.isArray(parsed.posts)) parsed.posts = [];
        if (!parsed.comments || !Array.isArray(parsed.comments)) parsed.comments = [];
        if (!parsed.votes || !Array.isArray(parsed.votes)) parsed.votes = [];
        if (!parsed.bookmarks || !Array.isArray(parsed.bookmarks)) parsed.bookmarks = [];
        if (!parsed.users || !Array.isArray(parsed.users)) parsed.users = [];
        if (!parsed.reports || !Array.isArray(parsed.reports)) parsed.reports = [];
        
        return parsed;
    } catch (error) {
        console.error('DB Error:', error.message);
        return await initializeDB();
    }
};

const writeDB = async (data) => {
    await fsPromises.writeFile(DB_FILE, JSON.stringify(data, null, 2));
};

// Banned users functions
const loadBanned = async () => {
    try {
        const exists = await fsPromises.access(BANNED_FILE).then(() => true).catch(() => false);
        if (!exists) {
            await fsPromises.writeFile(BANNED_FILE, JSON.stringify({ banned: [] }, null, 2));
            return [];
        }
        const data = await fsPromises.readFile(BANNED_FILE, 'utf8');
        const parsed = JSON.parse(data);
        return parsed.banned || [];
    } catch (error) {
        return [];
    }
};

const saveBanned = async (banned) => {
    await fsPromises.writeFile(BANNED_FILE, JSON.stringify({ banned }, null, 2));
};

const getVoterId = (req) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const ua = req.headers['user-agent'] || '';
    return `${ip}-${ua}`.replace(/[^a-zA-Z0-9]/g, '').slice(0, 64);
};

const extractHashtags = (content) => {
    if (!content || typeof content !== 'string') return [];
    const matches = content.match(/#\w+/g) || [];
    return [...new Set(matches.map(tag => tag.toLowerCase()))];
};

// Admin check middleware
const requireAdmin = (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth || auth.replace('Bearer ', '') !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// Check if user is banned
const checkBan = async (req, res, next) => {
    const voterId = getVoterId(req);
    const banned = await loadBanned();
    if (banned.includes(voterId)) {
        return res.status(403).json({ error: 'Your account has been banned' });
    }
    next();
};

// ============================================
// PUBLIC API ROUTES
// ============================================

// GET all posts
app.get('/api/posts', async (req, res) => {
    try {
        const db = await readDB();
        const voterId = getVoterId(req);
        
        if (!db.posts || !Array.isArray(db.posts)) return res.json([]);
        
        const posts = db.posts.map(post => {
            const userVote = db.votes.find(v => v.postId === post.id && v.voterId === voterId);
            const postComments = db.comments.filter(c => c.postId === post.id);
            const postVotes = db.votes.filter(v => v.postId === post.id);
            const isBookmarked = db.bookmarks.some(b => b.postId === post.id && b.userId === voterId);
            
            return {
                ...post,
                comments: postComments || [],
                commentCount: postComments ? postComments.length : 0,
                upvotes: postVotes.filter(v => v.type === 'up').length,
                downvotes: postVotes.filter(v => v.type === 'down').length,
                netVotes: postVotes.filter(v => v.type === 'up').length - postVotes.filter(v => v.type === 'down').length,
                userVote: userVote ? userVote.type : null,
                isOwner: post.ownerId === voterId,
                isBookmarked: isBookmarked || false,
                hashtags: extractHashtags(post.content)
            };
        });
        
        posts.sort((a, b) => b.netVotes - a.netVotes);
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load posts' });
    }
});

// GET trending hashtags
app.get('/api/trending/hashtags', async (req, res) => {
    try {
        const db = await readDB();
        const hashtagCount = {};
        
        if (!db.posts || !Array.isArray(db.posts)) return res.json([]);
        
        db.posts.forEach(post => {
            extractHashtags(post.content).forEach(tag => {
                hashtagCount[tag] = (hashtagCount[tag] || 0) + 1;
            });
        });
        
        const trending = Object.entries(hashtagCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([tag, count]) => ({ tag, count }));
        
        res.json(trending);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load hashtags' });
    }
});

// GET trending posts
app.get('/api/trending', async (req, res) => {
    try {
        const db = await readDB();
        const now = new Date();
        const yesterday = new Date(now - 24 * 60 * 60 * 1000);
        
        if (!db.posts || !Array.isArray(db.posts)) return res.json([]);
        
        const trending = db.posts
            .filter(p => new Date(p.timestamp) > yesterday)
            .map(post => {
                const postVotes = db.votes.filter(v => v.postId === post.id);
                return {
                    ...post,
                    netVotes: postVotes.filter(v => v.type === 'up').length - postVotes.filter(v => v.type === 'down').length
                };
            })
            .sort((a, b) => b.netVotes - a.netVotes)
            .slice(0, 5);
        
        res.json(trending);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load trending' });
    }
});

// GET user stats
app.get('/api/stats', async (req, res) => {
    try {
        const db = await readDB();
        const voterId = getVoterId(req);
        
        if (!db.posts || !Array.isArray(db.posts)) db.posts = [];
        if (!db.votes || !Array.isArray(db.votes)) db.votes = [];
        if (!db.bookmarks || !Array.isArray(db.bookmarks)) db.bookmarks = [];
        
        const userPosts = db.posts.filter(p => p.ownerId === voterId);
        const userVotes = db.votes.filter(v => v.voterId === voterId);
        const userBookmarks = db.bookmarks.filter(b => b.userId === voterId);
        
        const totalUpvotes = userPosts.reduce((acc, post) => {
            const votes = db.votes.filter(v => v.postId === post.id);
            return acc + votes.filter(v => v.type === 'up').length;
        }, 0);
        
        const totalDownvotes = userPosts.reduce((acc, post) => {
            const votes = db.votes.filter(v => v.postId === post.id);
            return acc + votes.filter(v => v.type === 'down').length;
        }, 0);
        
        res.json({
            postsCount: userPosts.length,
            votesCount: userVotes.length,
            bookmarksCount: userBookmarks.length,
            totalUpvotes,
            karma: totalUpvotes - totalDownvotes
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load stats' });
    }
});

// POST upload files (DIRECT UPLOAD - Opens gallery/file picker)
app.post('/api/upload', upload.array('files', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        
        const files = req.files.map(file => ({
            fileUrl: `${req.protocol}://${req.get('host')}/uploads/${file.filename}`,
            fileName: file.originalname,
            fileType: file.mimetype.startsWith('image/') ? 'image' : 
                     file.mimetype.startsWith('video/') ? 'video' : 'file',
            fileSize: file.size
        }));
        
        res.json({ success: true, files });
    } catch (error) {
        res.status(500).json({ error: 'Failed to upload files' });
    }
});

// POST create post (with direct file upload support)
app.post('/api/posts', checkBan, async (req, res) => {
    try {
        const { content, tags, media } = req.body;
        
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Content is required' });
        }
        if (content.length > 1000) {
            return res.status(400).json({ error: 'Content must be under 1000 characters' });
        }
        
        const db = await readDB();
        const ownerId = getVoterId(req);
        
        const newPost = {
            id: uuidv4(),
            content: content.trim(),
            tags: tags || [],
            media: media || [], // Array of uploaded files from /api/upload
            ownerId,
            timestamp: new Date().toISOString(),
            color: Math.floor(Math.random() * 5)
        };
        
        if (!db.posts || !Array.isArray(db.posts)) db.posts = [];
        db.posts.unshift(newPost);
        await writeDB(db);
        
        res.status(201).json(newPost);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create post' });
    }
});

// POST vote
app.post('/api/posts/:id/vote', checkBan, async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body;
        
        if (!['up', 'down'].includes(type)) {
            return res.status(400).json({ error: 'Invalid vote type' });
        }
        
        const db = await readDB();
        const voterId = getVoterId(req);
        
        if (!db.posts || !Array.isArray(db.posts)) return res.status(404).json({ error: 'Post not found' });
        
        const postIndex = db.posts.findIndex(p => p.id === id);
        if (postIndex === -1) return res.status(404).json({ error: 'Post not found' });
        
        if (!db.votes || !Array.isArray(db.votes)) db.votes = [];
        
        const existingVoteIndex = db.votes.findIndex(v => v.postId === id && v.voterId === voterId);
        let milestone = null;
        
        if (existingVoteIndex !== -1) {
            if (db.votes[existingVoteIndex].type === type) {
                db.votes.splice(existingVoteIndex, 1); // Toggle off
            } else {
                db.votes[existingVoteIndex].type = type; // Change vote
            }
        } else {
            db.votes.push({ postId: id, voterId, type, timestamp: new Date().toISOString() });
        }
        
        const postVotes = db.votes.filter(v => v.postId === id);
        const upvotes = postVotes.filter(v => v.type === 'up').length;
        const downvotes = postVotes.filter(v => v.type === 'down').length;
        const netVotes = upvotes - downvotes;
        
        if (netVotes === 10) milestone = '🔥 Hot Post!';
        if (netVotes === 50) milestone = '⚡ Viral!';
        if (netVotes === 100) milestone = '🚀 Legendary!';
        
        await writeDB(db);
        
        res.json({
            success: true,
            upvotes,
            downvotes,
            netVotes,
            milestone,
            userVote: db.votes.find(v => v.postId === id && v.voterId === voterId)?.type || null
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to vote' });
    }
});

// POST bookmark
app.post('/api/posts/:id/bookmark', checkBan, async (req, res) => {
    try {
        const { id } = req.params;
        const db = await readDB();
        const userId = getVoterId(req);
        
        if (!db.bookmarks || !Array.isArray(db.bookmarks)) db.bookmarks = [];
        
        const existingBookmark = db.bookmarks.find(b => b.postId === id && b.userId === userId);
        
        if (existingBookmark) {
            db.bookmarks = db.bookmarks.filter(b => b !== existingBookmark);
            await writeDB(db);
            return res.json({ success: true, bookmarked: false });
        } else {
            db.bookmarks.push({ postId: id, userId, timestamp: new Date().toISOString() });
            await writeDB(db);
            return res.json({ success: true, bookmarked: true });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to toggle bookmark' });
    }
});

// POST comment
app.post('/api/posts/:id/comments', checkBan, async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        
        if (!content || content.trim().length === 0) return res.status(400).json({ error: 'Comment required' });
        if (content.length > 500) return res.status(400).json({ error: 'Comment too long' });
        
        const db = await readDB();
        
        if (!db.posts || !Array.isArray(db.posts)) return res.status(404).json({ error: 'Post not found' });
        const post = db.posts.find(p => p.id === id);
        if (!post) return res.status(404).json({ error: 'Post not found' });
        
        if (!db.comments || !Array.isArray(db.comments)) db.comments = [];
        
        const newComment = {
            id: uuidv4(),
            postId: id,
            content: content.trim(),
            timestamp: new Date().toISOString()
        };
        
        db.comments.push(newComment);
        await writeDB(db);
        res.status(201).json(newComment);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// POST report post
app.post('/api/posts/:id/report', checkBan, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;
        const db = await readDB();
        
        if (!db.posts || !Array.isArray(db.posts)) return res.status(404).json({ error: 'Post not found' });
        const post = db.posts.find(p => p.id === id);
        if (!post) return res.status(404).json({ error: 'Post not found' });
        
        if (!db.reports || !Array.isArray(db.reports)) db.reports = [];
        
        db.reports.push({
            id: uuidv4(),
            postId: id,
            reason: reason || 'No reason provided',
            reportedBy: getVoterId(req),
            timestamp: new Date().toISOString()
        });
        
        await writeDB(db);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to submit report' });
    }
});

// DELETE own post
app.delete('/api/posts/:id', checkBan, async (req, res) => {
    try {
        const { id } = req.params;
        const db = await readDB();
        const voterId = getVoterId(req);
        
        if (!db.posts || !Array.isArray(db.posts)) return res.status(404).json({ error: 'Post not found' });
        const post = db.posts.find(p => p.id === id);
        if (!post) return res.status(404).json({ error: 'Post not found' });
        if (post.ownerId !== voterId) return res.status(403).json({ error: 'You can only delete your own posts' });
        
        // Delete uploaded files
        if (post.media && Array.isArray(post.media)) {
            for (const file of post.media) {
                if (file.fileUrl) {
                    try {
                        await fsPromises.unlink(path.join(UPLOAD_DIR, path.basename(file.fileUrl)));
                    } catch (e) {}
                }
            }
        }
        
        db.posts = db.posts.filter(p => p.id !== id);
        if (db.comments && Array.isArray(db.comments)) db.comments = db.comments.filter(c => c.postId !== id);
        if (db.votes && Array.isArray(db.votes)) db.votes = db.votes.filter(v => v.postId !== id);
        if (db.bookmarks && Array.isArray(db.bookmarks)) db.bookmarks = db.bookmarks.filter(b => b.postId !== id);
        
        await writeDB(db);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete' });
    }
});

// ============================================
// ADMIN API ROUTES
// ============================================

// Admin login
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ success: true, token: ADMIN_PASSWORD });
    } else {
        res.status(401).json({ error: 'Invalid admin password' });
    }
});

// GET all posts (admin view)
app.get('/api/admin/posts', requireAdmin, async (req, res) => {
    try {
        const db = await readDB();
        const banned = await loadBanned();
        
        if (!db.posts || !Array.isArray(db.posts)) return res.json([]);
        
        const posts = db.posts.map(post => ({
            ...post,
            commentCount: db.comments?.filter(c => c.postId === post.id).length || 0,
            voteCount: db.votes?.filter(v => v.postId === post.id).length || 0,
            isBanned: banned.includes(post.ownerId)
        }));
        
        res.json(posts);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load admin posts' });
    }
});

// GET banned users
app.get('/api/admin/banned', requireAdmin, async (req, res) => {
    try {
        const banned = await loadBanned();
        res.json({ banned });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load banned users' });
    }
});

// GET reports
app.get('/api/admin/reports', requireAdmin, async (req, res) => {
    try {
        const db = await readDB();
        res.json(db.reports || []);
    } catch (error) {
        res.status(500).json({ error: 'Failed to load reports' });
    }
});

// BAN user
app.post('/api/admin/ban', requireAdmin, async (req, res) => {
    try {
        const { voterId, reason, deletePosts } = req.body;
        if (!voterId) return res.status(400).json({ error: 'voterId is required' });
        
        let banned = await loadBanned();
        if (!banned.includes(voterId)) {
            banned.push(voterId);
            await saveBanned(banned);
        }
        
        // Optionally delete all posts by banned user
        if (deletePosts) {
            const db = await readDB();
            db.posts = db.posts.filter(p => p.ownerId !== voterId);
            if (db.comments && Array.isArray(db.comments)) {
                db.comments = db.comments.filter(c => {
                    const post = db.posts.find(p => p.id === c.postId);
                    return !post || post.ownerId !== voterId;
                });
            }
            if (db.votes && Array.isArray(db.votes)) {
                db.votes = db.votes.filter(v => {
                    const post = db.posts.find(p => p.id === v.postId);
                    return !post || post.ownerId !== voterId;
                });
            }
            await writeDB(db);
        }
        
        res.json({ success: true, message: `User banned` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to ban user' });
    }
});

// UNBAN user
app.post('/api/admin/unban', requireAdmin, async (req, res) => {
    try {
        const { voterId } = req.body;
        if (!voterId) return res.status(400).json({ error: 'voterId is required' });
        
        let banned = await loadBanned();
        banned = banned.filter(id => id !== voterId);
        await saveBanned(banned);
        
        res.json({ success: true, message: 'User unbanned' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to unban user' });
    }
});

// DELETE any post (admin)
app.delete('/api/admin/posts/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const db = await readDB();
        
        if (!db.posts || !Array.isArray(db.posts)) return res.status(404).json({ error: 'Post not found' });
        const postIndex = db.posts.findIndex(p => p.id === id);
        if (postIndex === -1) return res.status(404).json({ error: 'Post not found' });
        
        // Delete uploaded files
        const post = db.posts[postIndex];
        if (post.media && Array.isArray(post.media)) {
            for (const file of post.media) {
                if (file.fileUrl) {
                    try {
                        await fsPromises.unlink(path.join(UPLOAD_DIR, path.basename(file.fileUrl)));
                    } catch (e) {}
                }
            }
        }
        
        db.posts.splice(postIndex, 1);
        if (db.comments && Array.isArray(db.comments)) db.comments = db.comments.filter(c => c.postId !== id);
        if (db.votes && Array.isArray(db.votes)) db.votes = db.votes.filter(v => v.postId !== id);
        if (db.bookmarks && Array.isArray(db.bookmarks)) db.bookmarks = db.bookmarks.filter(b => b.postId !== id);
        
        await writeDB(db);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete post' });
    }
});

// ============================================
// SERVE FRONTEND IN PRODUCTION
// ============================================

const distPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('✅ Frontend will be served from client/dist');
}

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log('🚀 ============================================');
    console.log(`🚀 Echo Server running on http://localhost:${PORT}`);
    console.log(`📁 Database: ${DB_FILE}`);
    console.log(`📁 Uploads: ${UPLOAD_DIR}`);
    console.log(`🔐 Admin password: ${ADMIN_PASSWORD} (CHANGE IN PRODUCTION!)`);
    console.log('✨ Features: Direct File Upload, Voting, Bookmarks, Images, Videos, Admin Panel, Ban System');
    console.log('🚀 ============================================');
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});
