import React, { Suspense, lazy } from "react";
import "react-quill/dist/quill.snow.css";

interface QuillEditorProps {
  value: string;
  onChange: (value: string) => void;
  modules?: Record<string, any>;
  formats?: string[];
  className?: string;
  style?: React.CSSProperties;
}

const ReactQuillComponent = lazy(() => import("react-quill"));

const LoadingFallback = () => (
  <div className="h-80 bg-gray-800 rounded-lg animate-pulse" />
);

const QuillEditor: React.FC<QuillEditorProps> = ({
  value,
  onChange,
  modules,
  formats,
  className,
  style,
}) => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ReactQuillComponent
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        className={className}
        style={style}
      />
    </Suspense>
  );
};

QuillEditor.displayName = "QuillEditor";

export default QuillEditor;
