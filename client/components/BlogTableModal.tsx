import { X } from "lucide-react";
import { useState } from "react";

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
  const [scale, setScale] = useState(1);

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
        className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Close Button and Zoom Controls */}
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700">
            Table View
          </h2>
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setScale((s) => Math.max(0.75, s - 0.1))}
                className="px-2 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900 transition"
                aria-label="Zoom out"
              >
                −
              </button>
              <span className="text-xs text-gray-600 min-w-[2.5rem] text-center">
                {Math.round(scale * 100)}%
              </span>
              <button
                onClick={() => setScale((s) => Math.min(1.5, s + 0.1))}
                className="px-2 py-1 text-xs font-semibold text-gray-600 hover:text-gray-900 transition"
                aria-label="Zoom in"
              >
                +
              </button>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="ml-2 p-1.5 rounded-lg hover:bg-gray-200 transition-colors"
              aria-label="Close modal"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Table Content with Zoom Applied */}
        <div className="flex-1 overflow-auto p-4">
          <div
            style={{
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              width: `${100 / scale}%`,
            }}
          >
            <div
              dangerouslySetInnerHTML={{ __html: htmlContent }}
              className="prose max-w-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlogTableModal;
