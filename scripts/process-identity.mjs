/** Exact local process identity. Boot ID plus kernel start time identifies one
 * process even after its PID is reused; another host is never observable. */
import { readFile } from "node:fs/promises";
import { hostname } from "node:os";

const uuid = /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const unavailable = () =>
  new Error("This operation requires the Linux host's process identity.");

export async function processStart(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) throw unavailable();
  let text;
  try {
    text = await readFile(`/proc/${pid}/stat`, "utf8");
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "ESRCH") return null;
    throw error;
  }
  const fields = text.slice(text.lastIndexOf(")") + 2).split(" ");
  const startTime = Number(fields[19]);
  if (!fields[0] || !Number.isSafeInteger(startTime) || startTime < 0)
    throw unavailable();
  return { state: fields[0], startTime };
}

export async function currentBoot() {
  const value = (
    await readFile("/proc/sys/kernel/random/boot_id", "utf8")
  ).trim();
  if (!uuid.test(value)) throw unavailable();
  return value;
}

export async function currentProcessIdentity() {
  if (process.platform !== "linux") throw unavailable();
  const current = await processStart(process.pid);
  if (!current) throw unavailable();
  return Object.freeze({
    host: hostname(),
    processId: process.pid,
    bootId: await currentBoot(),
    startTime: current.startTime,
  });
}

export function validProcessIdentity(value) {
  return (
    !!value &&
    typeof value === "object" &&
    Object.keys(value).sort().join(",") === "bootId,host,processId,startTime" &&
    /^[a-zA-Z0-9_.-]{1,253}$/.test(value.host) &&
    Number.isSafeInteger(value.processId) &&
    value.processId > 0 &&
    value.processId <= 2147483647 &&
    uuid.test(value.bootId) &&
    Number.isSafeInteger(value.startTime) &&
    value.startTime >= 0
  );
}

/** True only when `previous` is proven gone from this host. */
export async function processStopped(previous, current) {
  if (!validProcessIdentity(previous) || previous.host !== current.host)
    return false;
  if (previous.bootId !== current.bootId) return true;
  const observed = await processStart(previous.processId);
  return (
    !observed ||
    observed.startTime !== previous.startTime ||
    observed.state === "Z"
  );
}
