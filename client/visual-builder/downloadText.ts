export function downloadText(name: string, value: string) {
  const url = URL.createObjectURL(new Blob([value], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
