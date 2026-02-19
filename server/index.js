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

// ============================================
// CREATE UPLOADS DIRECTORY
// ============================================

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    console.log('📁 Uploads directory created');
}

// ============================================
// CONFIGURE MULTER FOR FILE UPLOADS
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
        fileSize: 50 * 1024 * 1024, // 50MB limit
        files: 5 // Max 5 files per post
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|webm|pdf|doc|docx|txt/;
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
        'http://localhost:5174',
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
// DATABASE FUNCTIONS (FIXED - No More Undefined Errors!)
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
    console.log('✅ Database initialized with correct structure');
    return data;
};

const readDB = async () => {
    try {
        const exists = await fsPromises.access(DB_FILE)
            .then(() => true)
            .catch(() => false);
        
        if (!exists) {
            console.log('📁 Database file not found, creating new one...');
            return await initializeDB();
        }
        
        const data = await fsPromises.readFile(DB_FILE, 'utf8');
        const parsed = JSON.parse(data);
        
        // CRITICAL FIX: Ensure ALL arrays exist (fixes undefined errors)
        if (!parsed.posts || !Array.isArray(parsed.posts)) {
            console.log('⚠️ Fixing posts array');
            parsed.posts = [];
        }
        if (!parsed.comments || !Array.isArray(parsed.comments)) {
            console.log('⚠️ Fixing comments array');
            parsed.comments = [];
        }
        if (!parsed.votes || !Array.isArray(parsed.votes)) {
            console.log('⚠️ Fixing votes array');
            parsed.votes = [];
        }
        if (!parsed.bookmarks || !Array.isArray(parsed.bookmarks)) {
            console.log('⚠️ Fixing bookmarks array');
            parsed.bookmarks = [];
        }
        if (!parsed.users || !Array.isArray(parsed.users)) {
            console.log('⚠️ Fixing users array');
            parsed.users = [];
        }
        if (!parsed.reports || !Array.isArray(parsed.reports)) {
            console.log('⚠️ Fixing reports array');
            parsed.reports = [];
        }
        
        return parsed;
    } catch (error) {
        console.error('❌ Database read error:', error.message);
        console.log('🔄 Reinitializing database...');
        return await initializeDB();
    }
};

const writeDB = async (data) => {
    try {
        await fsPromises.writeFile(DB_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('❌ Database write error:', error.message);
    }
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

// ============================================
// API ROUTES - POSTS
// ============================================

// GET all posts
app.get('/api/posts', async (req, res) => {
    try {
        const db = await readDB();
        const voterId = getVoterId(req);
        
        if (!db.posts || !Array.isArray(db.posts)) {
            return res.json([]);
        }
        
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
        console.error('❌ Get posts error:', error);
        res.status(500).json({ error: 'Failed to load posts', details: error.message });
    }
});

// GET trending hashtags
app.get('/api/trending/hashtags', async (req, res) => {
    try {
        const db = await readDB();
        const hashtagCount = {};
        
        if (!db.posts || !Array.isArray(db.posts)) {
            return res.json([]);
        }
        
        db.posts.forEach(post => {
            const hashtags = extractHashtags(post.content);
            hashtags.forEach(tag => {
                hashtagCount[tag] = (hashtagCount[tag] || 0) + 1;
            });
        });
        
        const trending = Object.entries(hashtagCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([tag, count]) => ({ tag, count }));
        
        res.json(trending);
    } catch (error) {
        console.error('❌ Get trending hashtags error:', error);
        res.status(500).json({ error: 'Failed to load hashtags' });
    }
});

// GET trending posts
app.get('/api/trending', async (req, res) => {
    try {
        const db = await readDB();
        const now = new Date();
        const yesterday = new Date(now - 24 * 60 * 60 * 1000);
        
        if (!db.posts || !Array.isArray(db.posts)) {
            return res.json([]);
        }
        
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
        console.error('❌ Get trending error:', error);
        res.status(500).json({ error: 'Failed to load trending' });
    }
});

// POST create post
app.post('/api/posts', async (req, res) => {
    try {
        const { content, tags, imageUrl, fileUrl, fileName, fileType, media } = req.body;
        
        // Validation
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
            imageUrl: imageUrl || null,
            fileUrl: fileUrl || null,
            fileName: fileName || null,
            fileType: fileType || null,
            media: media || [],
            ownerId: ownerId,
            timestamp: new Date().toISOString(),
            color: Math.floor(Math.random() * 5),
            views: 0,
            edited: false
        };
        
        if (!db.posts || !Array.isArray(db.posts)) {
            db.posts = [];
        }
        
        db.posts.unshift(newPost);
        await writeDB(db);
        
        console.log('✅ Post created:', newPost.id);
        res.status(201).json(newPost);
    } catch (error) {
        console.error('❌ Create post error:', error);
        res.status(500).json({ error: 'Failed to create post', details: error.message });
    }
});

// POST vote
app.post('/api/posts/:id/vote', async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body;
        
        if (!['up', 'down'].includes(type)) {
            return res.status(400).json({ error: 'Invalid vote type' });
        }
        
        const db = await readDB();
        const voterId = getVoterId(req);
        
        if (!db.posts || !Array.isArray(db.posts)) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        const postIndex = db.posts.findIndex(p => p.id === id);
        if (postIndex === -1) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        if (!db.votes || !Array.isArray(db.votes)) {
            db.votes = [];
        }
        
        const existingVoteIndex = db.votes.findIndex(
            v => v.postId === id && v.voterId === voterId
        );
        
        let milestone = null;
        
        if (existingVoteIndex !== -1) {
            const existingVote = db.votes[existingVoteIndex];
            if (existingVote.type === type) {
                db.votes.splice(existingVoteIndex, 1);
            } else {
                db.votes[existingVoteIndex].type = type;
            }
        } else {
            db.votes.push({
                postId: id,
                voterId,
                type,
                timestamp: new Date().toISOString()
            });
        }
        
        const postVotes = db.votes.filter(v => v.postId === id);
        const upvotes = postVotes.filter(v => v.type === 'up').length;
        const downvotes = postVotes.filter(v => v.type === 'down').length;
        const netVotes = upvotes - downvotes;
        
        // Check for milestones
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
        console.error('❌ Vote error:', error);
        res.status(500).json({ error: 'Failed to vote', details: error.message });
    }
});

// POST bookmark
app.post('/api/posts/:id/bookmark', async (req, res) => {
    try {
        const { id } = req.params;
        const db = await readDB();
        const userId = getVoterId(req);
        
        if (!db.bookmarks || !Array.isArray(db.bookmarks)) {
            db.bookmarks = [];
        }
        
        const existingBookmark = db.bookmarks.find(
            b => b.postId === id && b.userId === userId
        );
        
        if (existingBookmark) {
            db.bookmarks = db.bookmarks.filter(b => b !== existingBookmark);
            await writeDB(db);
            return res.json({ success: true, bookmarked: false });
        } else {
            db.bookmarks.push({
                postId: id,
                userId,
                timestamp: new Date().toISOString()
            });
            await writeDB(db);
            return res.json({ success: true, bookmarked: true });
        }
    } catch (error) {
        console.error('❌ Bookmark error:', error);
        res.status(500).json({ error: 'Failed to toggle bookmark' });
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
        console.error('❌ Stats error:', error);
        res.status(500).json({ error: 'Failed to load stats' });
    }
});

// POST upload file
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
        
        res.json({
            success: true,
            files: files
        });
    } catch (error) {
        console.error('❌ Upload error:', error);
        res.status(500).json({ error: 'Failed to upload files' });
    }
});

// POST comment
app.post('/api/posts/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Comment required' });
        }
        
        if (content.length > 500) {
            return res.status(400).json({ error: 'Comment too long' });
        }
        
        const db = await readDB();
        
        if (!db.posts || !Array.isArray(db.posts)) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        const post = db.posts.find(p => p.id === id);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        if (!db.comments || !Array.isArray(db.comments)) {
            db.comments = [];
        }
        
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
        console.error('❌ Add comment error:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// DELETE post
app.delete('/api/posts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = await readDB();
        const voterId = getVoterId(req);
        
        if (!db.posts || !Array.isArray(db.posts)) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        const post = db.posts.find(p => p.id === id);
        
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }
        
        if (post.ownerId !== voterId) {
            return res.status(403).json({ error: 'You can only delete your own posts' });
        }
        
        // Delete uploaded files if they exist
        if (post.media && Array.isArray(post.media)) {
            for (const file of post.media) {
                if (file.fileUrl) {
                    const filePath = path.join(UPLOAD_DIR, path.basename(file.fileUrl));
                    try {
                        await fsPromises.unlink(filePath);
                    } catch (e) {
                        console.log('File already deleted or not found');
                    }
                }
            }
        }
        
        db.posts = db.posts.filter(p => p.id !== id);
        
        if (db.comments && Array.isArray(db.comments)) {
            db.comments = db.comments.filter(c => c.postId !== id);
        }
        
        if (db.votes && Array.isArray(db.votes)) {
            db.votes = db.votes.filter(v => v.postId !== id);
        }
        
        if (db.bookmarks && Array.isArray(db.bookmarks)) {
            db.bookmarks = db.bookmarks.filter(b => b.postId !== id);
        }
        
        await writeDB(db);
        
        console.log('✅ Post deleted:', id);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Delete error:', error);
        res.status(500).json({ error: 'Failed to delete', details: error.message });
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
    console.log('✨ Features: Direct File Upload, Voting, Bookmarks, Images, Videos, Files, Delete, Share, Download');
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
