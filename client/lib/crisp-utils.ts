export const openCrisp = (): void => {
  if (typeof window === "undefined") return;

  const crispWindow = window as any;

  // Try to open immediately if Crisp is loaded
  if (crispWindow.$crisp?.push) {
    crispWindow.$crisp.push(["do", "chat:open"]);
    return;
  }

  // Retry mechanism with exponential backoff
  let retries = 0;
  const maxRetries = 5;
  const retryDelay = (attempt: number) =>
    Math.min(500 * Math.pow(2, attempt), 5000);

  const attemptOpen = () => {
    if (crispWindow.$crisp?.push) {
      crispWindow.$crisp.push(["do", "chat:open"]);
      return true;
    }
    return false;
  };

  const retry = () => {
    if (attemptOpen()) return;
    if (retries < maxRetries) {
      retries++;
      setTimeout(retry, retryDelay(retries - 1));
    }
  };

  setTimeout(retry, 100);
};
