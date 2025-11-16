import React from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";

interface QuillEditorProps {
  value: string;
  onChange: (value: string) => void;
  modules?: Record<string, any>;
  formats?: string[];
  className?: string;
  style?: React.CSSProperties;
}

const QuillEditor: React.FC<QuillEditorProps> = ({
  value,
  onChange,
  modules,
  formats,
  className,
  style,
}) => {
  return (
    <ReactQuill
      theme="snow"
      value={value}
      onChange={onChange}
      modules={modules}
      formats={formats}
      className={className}
      style={style}
    />
  );
};

QuillEditor.displayName = "QuillEditor";

export default QuillEditor;
