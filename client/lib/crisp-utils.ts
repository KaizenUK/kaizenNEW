export const openCrisp = async (retries = 3): Promise<boolean> => {
  const attemptOpen = (): boolean => {
    if (typeof window !== "undefined" && (window as any).$crisp?.push) {
      (window as any).$crisp.push(["do", "chat:open"]);
      return true;
    }
    return false;
  };

  if (attemptOpen()) return true;

  for (let i = 0; i < retries; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (attemptOpen()) return true;
  }

  return false;
};
