export const openCrisp = (): void => {
  if (typeof window !== "undefined" && (window as any).$crisp?.push) {
    (window as any).$crisp.push(["do", "chat:open"]);
    return;
  }

  // Retry after a brief delay if Crisp hasn't loaded yet
  setTimeout(() => {
    if (typeof window !== "undefined" && (window as any).$crisp?.push) {
      (window as any).$crisp.push(["do", "chat:open"]);
    }
  }, 500);
};
