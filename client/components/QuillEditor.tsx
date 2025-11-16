import React from "react";
import type ReactQuillType from "react-quill";
import "react-quill/dist/quill.snow.css";

interface QuillEditorProps {
  value: string;
  onChange: (value: string) => void;
  modules?: Record<string, any>;
  formats?: string[];
  className?: string;
  style?: React.CSSProperties;
}

let ReactQuillComponent: typeof ReactQuillType | null = null;

const loadQuill = async () => {
  if (!ReactQuillComponent) {
    const module = await import("react-quill");
    ReactQuillComponent = module.default;
  }
  return ReactQuillComponent;
};

const QuillEditor: React.FC<QuillEditorProps> = ({
  value,
  onChange,
  modules,
  formats,
  className,
  style,
}) => {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [RQ, setRQ] = React.useState<typeof ReactQuillType | null>(null);

  React.useEffect(() => {
    loadQuill().then((component) => {
      setRQ(component);
      setIsLoaded(true);
    });
  }, []);

  if (!isLoaded || !RQ) {
    return <div className="h-80 bg-gray-800 rounded-lg animate-pulse" />;
  }

  return (
    <RQ
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
