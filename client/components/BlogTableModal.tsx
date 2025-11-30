import { X } from "lucide-react";

interface BlogTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  htmlContent: string;
}

const BlogTableModal: React.FC<BlogTableModalProps> = ({
  isOpen,
  onClose,
  htmlContent,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Table comparison modal"
    >
      <div
        className="relative max-w-4xl w-full max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="sticky top-0 right-0 z-10 float-right m-4 p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-800 transition-colors"
          aria-label="Close modal"
        >
          <X className="h-6 w-6 text-gray-600 dark:text-gray-300" />
        </button>

        {/* Table Content */}
        <div className="p-6 overflow-x-auto">
          <div
            dangerouslySetInnerHTML={{ __html: htmlContent }}
            className="prose dark:prose-invert max-w-none"
          />
        </div>
      </div>
    </div>
  );
};

export default BlogTableModal;
