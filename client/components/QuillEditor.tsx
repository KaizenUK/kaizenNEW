import React, { Suspense } from "react";
import dynamic from "next/dynamic";

interface QuillEditorProps {
  value: string;
  onChange: (value: string) => void;
  modules?: Record<string, any>;
  formats?: string[];
  className?: string;
  style?: React.CSSProperties;
}

const ReactQuillComponent = dynamic(
  async () => {
    const { default: ReactQuill } = await import("react-quill");
    return ReactQuill;
  },
  {
    ssr: false,
    loading: () => <div className="h-80 bg-gray-800 rounded-lg animate-pulse" />,
  }
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
    <Suspense fallback={<div className="h-80 bg-gray-800 rounded-lg animate-pulse" />}>
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
