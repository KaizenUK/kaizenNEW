import { expect, it, vi } from "vitest";
import { observeAuthSession } from "./authSession";
import {
  readAuthLink,
  cleanAuthLink,
  trackPasswordRecovery,
  passwordRecoveryAccount,
  finishPasswordRecovery,
} from "../lib/authRedirect";
import { passwordResetRedirect, authErrorMessage } from "./authState";
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const session = (id: string) => ({
  user: { id },
  access_token: `${id}-fixture-token`,
});
function fixture() {
  const initial = deferred<any>();
  let changed!: (event: any, value: any) => void;
  const unsubscribe = vi.fn(),
    accept = vi.fn();
  const auth: any = {
    getSession: vi.fn(() => initial.promise),
    onAuthStateChange: (fn: any) => {
      changed = fn;
      return { data: { subscription: { unsubscribe } } };
    },
  };
  const stop = observeAuthSession(auth, accept);
  return {
    initial,
    accept,
    stop,
    unsubscribe,
    changed: (event: string, value: any) => changed(event, value),
  };
}
it("does not copy callback credentials or provider descriptions into link state", () => {
  const state = readAuthLink(
    "https://builder.example.test/builder/?password=setup#type=recovery&access_token=private-fixture-token&refresh_token=private-fixture-refresh&error_description=private-provider-text&error_code=otp_expired",
  );
  expect(state).toEqual({
    setupRequested: true,
    callback: true,
    failed: true,
    errorCode: "otp_expired",
  });
  expect(JSON.stringify(state)).not.toContain("private-");
});
it("retains only intent from an ordinary bookmarked setup page", () => {
  expect(
    readAuthLink("https://builder.example.test/builder/?password=setup"),
  ).toEqual({
    setupRequested: true,
    callback: false,
    failed: false,
    errorCode: undefined,
  });
});
it("cleans callback material while retaining the selected project and account view", () => {
  const url = cleanAuthLink(
    "https://builder.example.test/builder/?project=kaizen&view=account&password=setup&error_description=private-text#access_token=private-token&refresh_token=private-refresh&type=invite",
  );
  expect(url.href).toBe(
    "https://builder.example.test/builder/?project=kaizen&view=account",
  );
  expect(
    cleanAuthLink("https://builder.example.test/builder/?project=kaizen#help")
      .hash,
  ).toBe("#help");
});
it("constructs a same-origin reset destination using only a valid project", () => {
  expect(
    passwordResetRedirect(
      "https://builder.example.test/builder/?project=kaizen&redirect=https://evil.test&view=account",
    ),
  ).toBe("https://builder.example.test/builder/?password=setup&project=kaizen");
  expect(
    passwordResetRedirect(
      "https://builder.example.test/builder/?project=../private",
    ),
  ).toBe("https://builder.example.test/builder/?password=setup");
});
it("captures recovery before React, keeps it for that account, and clears it after account changes", () => {
  let changed!: (event: any, value: any) => void;
  trackPasswordRecovery({
    onAuthStateChange: (fn: any) => {
      changed = fn;
      return { data: { subscription: { unsubscribe() {} } } };
    },
  } as any);
  changed("PASSWORD_RECOVERY", session("one"));
  expect(passwordRecoveryAccount()).toBe("one");
  changed("TOKEN_REFRESHED", session("one"));
  finishPasswordRecovery("two");
  expect(passwordRecoveryAccount()).toBe("one");
  changed("SIGNED_IN", session("two"));
  expect(passwordRecoveryAccount()).toBeUndefined();
  changed("PASSWORD_RECOVERY", session("two"));
  finishPasswordRecovery("two");
  expect(passwordRecoveryAccount()).toBeUndefined();
});
it("maps redirect errors by their structured details instead of echoing raw text", () => {
  expect(
    authErrorMessage(
      { details: { code: "otp_expired" }, message: "private detail" },
      "check",
    ),
  ).toContain("invalid or has expired");
  expect(authErrorMessage(new Error("private detail"), "reset")).toContain(
    "may have sent an email",
  );
});
it("delivers the initial session outside the SDK callback", async () => {
  const f = fixture();
  f.initial.resolve({ data: { session: session("one") }, error: null });
  await vi.waitFor(() => expect(f.accept).toHaveBeenCalledTimes(1));
  expect(f.accept).toHaveBeenCalledWith(
    "INITIAL_SESSION",
    session("one"),
    null,
  );
  f.stop();
});
it("ignores a late initial account after sign-out", async () => {
  const f = fixture();
  f.changed("SIGNED_OUT", null);
  f.initial.resolve({ data: { session: session("old") }, error: null });
  await vi.waitFor(() => expect(f.accept).toHaveBeenCalledTimes(1));
  expect(f.accept).toHaveBeenCalledWith("SIGNED_OUT", null, undefined);
  f.stop();
});
it("does not queue a reload for a superseded sign-in or restore it after unsubscribe", async () => {
  const f = fixture();
  f.changed("SIGNED_IN", session("one"));
  f.changed("SIGNED_OUT", null);
  await Promise.resolve();
  expect(f.accept).toHaveBeenCalledExactlyOnceWith(
    "SIGNED_OUT",
    null,
    undefined,
  );
  f.changed("SIGNED_IN", session("two"));
  f.stop();
  f.initial.resolve({ data: { session: session("old") }, error: null });
  await Promise.resolve();
  expect(f.accept).toHaveBeenCalledTimes(1);
  expect(f.unsubscribe).toHaveBeenCalledTimes(1);
});
it("does not replace a newer account with an older failed initial read", async () => {
  const f = fixture();
  f.changed("SIGNED_IN", session("new"));
  f.initial.resolve({ data: { session: null }, error: new Error("old error") });
  await vi.waitFor(() => expect(f.accept).toHaveBeenCalledTimes(1));
  expect(f.accept).toHaveBeenCalledWith("SIGNED_IN", session("new"), undefined);
  f.stop();
});
it("reports a current initial lookup failure without a stale session", async () => {
  const f = fixture(),
    error = new Error("offline");
  f.initial.resolve({ data: { session: session("stale") }, error });
  await vi.waitFor(() => expect(f.accept).toHaveBeenCalledTimes(1));
  expect(f.accept).toHaveBeenCalledWith("INITIAL_SESSION", null, error);
  f.stop();
});
