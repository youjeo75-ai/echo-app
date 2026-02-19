import { motion } from 'framer-motion';
import { X, Twitter, Facebook, Link, Download } from 'lucide-react';

interface ShareModalProps {
  post: { content: string; votes: number };
  onClose: () => void;
  onDownload: () => void;
}

export default function ShareModal({ post, onClose, onDownload }: ShareModalProps) {
  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    onDownload();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-card border border-white/10 rounded-2xl p-6 max-w-md w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold">Share this Echo</h3>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-dark/50 rounded-xl p-4 mb-6">
          <p className="text-gray-300 italic">"{post.content}"</p>
          <p className="text-accent mt-2 text-sm">{post.votes} votes</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button className="flex items-center justify-center gap-2 bg-[#1DA1F2] hover:bg-[#1a91da] text-white py-3 rounded-xl transition-colors">
            <Twitter className="w-5 h-5" /> Twitter
          </button>
          <button className="flex items-center justify-center gap-2 bg-[#4267B2] hover:bg-[#3b5998] text-white py-3 rounded-xl transition-colors">
            <Facebook className="w-5 h-5" /> Facebook
          </button>
          <button onClick={copyLink} className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl transition-colors">
            <Link className="w-5 h-5" /> Copy Link
          </button>
          <button onClick={onDownload} className="flex items-center justify-center gap-2 bg-accent hover:bg-indigo-500 text-white py-3 rounded-xl transition-colors">
            <Download className="w-5 h-5" /> Save Image
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}