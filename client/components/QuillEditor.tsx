import React, { forwardRef, useRef, useEffect } from "react";
import ReactQuill, { Quill } from "react-quill";
import "react-quill/dist/quill.snow.css";

interface QuillEditorProps {
  value: string;
  onChange: (value: string) => void;
  modules?: Record<string, any>;
  formats?: string[];
  className?: string;
  style?: React.CSSProperties;
}

const QuillEditor = forwardRef<ReactQuill, QuillEditorProps>(
  ({ value, onChange, modules, formats, className, style }, ref) => {
    const internalRef = useRef<ReactQuill>(null);

    useEffect(() => {
      if (ref && "current" in ref) {
        ref.current = internalRef.current;
      }
    }, [ref]);

    return (
      <ReactQuill
        ref={internalRef}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        className={className}
        style={style}
      />
    );
  },
);

QuillEditor.displayName = "QuillEditor";

export default QuillEditor;
