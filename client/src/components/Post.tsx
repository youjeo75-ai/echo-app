import { motion } from 'framer-motion';
import { ArrowUp, ArrowDown, MessageCircle, Share2, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface PostProps {
  post: any;
  onVote: (id: string, type: 'up' | 'down') => void;
  onComment: (postId: string, content: string) => void;
  onShare: (post: any) => void;
  onDelete?: (id: string) => void;
}

export default function Post({ post, onVote, onComment, onShare, onDelete }: PostProps) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onComment(post.id, commentText);
    setCommentText('');
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-card/30 backdrop-blur-sm border border-white/5 p-6 rounded-xl hover:bg-card/50 transition-colors group"
    >
      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {post.tags.map((tag: string, i: number) => (
            <span key={i} className="text-xs bg-accent/20 text-accent px-2 py-1 rounded-full">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Content */}
      <p className="text-lg text-gray-200 mb-4 leading-relaxed">{post.content}</p>

      {/* Actions */}
      <div className="flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center gap-4">
          {/* Vote */}
          <div className="flex items-center gap-2 bg-dark/50 px-3 py-1.5 rounded-full">
            <button
              onClick={() => onVote(post.id, 'up')}
              className="hover:text-green-400 transition-colors flex items-center gap-1"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <span className={`font-semibold ${post.votes > 0 ? 'text-green-400' : post.votes < 0 ? 'text-red-400' : ''}`}>
              {post.votes}
            </span>
            <button
              onClick={() => onVote(post.id, 'down')}
              className="hover:text-red-400 transition-colors"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          </div>

          {/* Comments */}
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1 hover:text-accent transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            {post.comments?.length || 0}
          </button>

          {/* Share */}
          <button
            onClick={() => onShare(post)}
            className="flex items-center gap-1 hover:text-accent transition-colors"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span>{new Date(post.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {onDelete && (
            <button onClick={() => onDelete(post.id)} className="hover:text-red-400 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Comments Section */}
      {showComments && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          className="mt-4 pt-4 border-t border-white/10"
        >
          <form onSubmit={handleSubmitComment} className="flex gap-2 mb-4">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 bg-dark/50 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
            />
            <button
              type="submit"
              className="bg-accent hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Post
            </button>
          </form>

          <div className="space-y-2">
            {post.comments?.map((comment: any) => (
              <div key={comment.id} className="bg-dark/30 rounded-lg p-3 text-sm text-gray-400">
                {comment.content}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
