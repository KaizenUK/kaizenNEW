import { useEffect, useRef, useState, type RefObject } from "react";
import { repositoryConnection } from "./repositoryConnection";
import type { SourceInspection } from "../../shared/builderSourceEditing";
import type { useSourceEditingDraft } from "./useSourceEditingDraft";
import type { SourceFrame } from "./useSiteBuild";
import { registrationFor } from "../../shared/builderRegistry";

type State = {
  values: Record<string, string>;
  orders: Record<string, string[]>;
  assets: ReturnType<typeof useSourceEditingDraft>["assets"];
};
export type SourceImagePreview = {
  assetId: string;
  key: string;
  blob: Blob;
};
export function useSourceCanvas(
  inspection: SourceInspection | undefined,
  frameRef: RefObject<HTMLIFrameElement | null>,
  draft: ReturnType<typeof useSourceEditingDraft>,
  frame?: SourceFrame,
  previews: Record<string, SourceImagePreview> = {},
) {
  const [ids, setIds] = useState<string[]>([]),
    [reason, setReason] = useState("");
  const [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const [registration, setRegistration] =
    useState<ReturnType<typeof registrationFor>>();
  const [, refresh] = useState(0);
  const current = useRef({ draft, inspection, frame, previews });
  current.current = { draft, inspection, frame, previews };
  const undoStack = useRef<State[]>([]),
    redoStack = useRef<State[]>([]);
  const last = useRef({ id: "", at: 0 });
  const scroll = useRef(0);
  const matchingFrame = () =>
    JSON.stringify(current.current.frame?.files) ===
    JSON.stringify(current.current.inspection?.files);
  const state = (): State => ({
    values: current.current.draft.values,
    orders: current.current.draft.orders,
    assets: current.current.draft.assets,
  });
  const send = (data: Record<string, unknown>) => {
    const preview = current.current.frame;
    if (preview)
      frameRef.current?.contentWindow?.postMessage(
        { ...data, nonce: preview.nonce },
        repositoryConnection.frameTarget(preview.url),
      );
  };
  const push = () => {
    const images: Record<string, SourceImagePreview> = {};
    for (const asset of state().assets) {
      const field = current.current.inspection?.fields.find(
        (f) => f.id === asset.fieldId,
      );
      const preview = current.current.previews[asset.fieldId];
      if (!field || preview?.assetId !== asset.assetId) continue;
      images[field.id] = preview;
      if (!field.elementId) continue;
      for (const sibling of current.current.inspection!.fields)
        if (
          sibling.elementId === field.elementId &&
          /srcset/i.test(sibling.attribute || "")
        )
          images[sibling.id] = preview;
    }
    send({
      type: "kaizen-source-state",
      ...state(),
      images,
      locked:
        !matchingFrame() ||
        !current.current.draft.ready ||
        Boolean(current.current.draft.stale),
    });
  };
  const replace = (next: State) => {
    current.current.draft.setValues(next.values);
    current.current.draft.setOrders(next.orders);
    current.current.draft.setAssets(next.assets);
    refresh((n) => n + 1);
  };
  const record = (id: string) => {
    if (last.current.id !== id || Date.now() - last.current.at > 500) {
      undoStack.current.push(structuredClone(state()));
      if (undoStack.current.length > 100) undoStack.current.shift();
    }
    last.current = { id, at: Date.now() };
    redoStack.current = [];
    refresh((n) => n + 1);
  };
  const edit = (id: string, value: string) => {
    const field = current.current.inspection?.fields.find((f) => f.id === id);
    if (
      !field ||
      typeof value !== "string" ||
      value.length > 20000 ||
      !current.current.draft.ready ||
      current.current.draft.stale
    )
      return;
    if ((state().values[id] ?? field.value) === value) return;
    record(id);
    const values = { ...state().values };
    if (value === field.value) delete values[id];
    else values[id] = value;
    current.current.draft.setValues(values);
  };
  const order = (id: string, value: string[]) => {
    const group = current.current.inspection?.groups.find((g) => g.id === id);
    if (
      !group ||
      !current.current.draft.ready ||
      current.current.draft.stale ||
      value.length !== group.items.length ||
      new Set(value).size !== value.length ||
      value.some((item) => !group.items.some((i) => i.id === item))
    )
      return;
    record(id);
    const orders = { ...state().orders };
    if (value.every((item, i) => item === group.items[i].id)) delete orders[id];
    else orders[id] = value;
    current.current.draft.setOrders(orders);
  };
  const undo = () => {
    if (!current.current.draft.ready || current.current.draft.stale) return;
    const previous = undoStack.current.pop();
    if (previous) {
      redoStack.current.push(structuredClone(state()));
      last.current.id = "";
      replace(previous);
    }
  };
  const redo = () => {
    if (!current.current.draft.ready || current.current.draft.stale) return;
    const next = redoStack.current.pop();
    if (next) {
      undoStack.current.push(structuredClone(state()));
      last.current.id = "";
      replace(next);
    }
  };
  useEffect(() => {
    setReady(false);
    setError("");
    if (!frame) return;
    const timeout = setTimeout(
      () =>
        setError(
          "The page did not connect. Allow access to this computer in your browser, retry, or open the preview in a window.",
        ),
      15000,
    );
    const receive = (event: MessageEvent) => {
      if (
        event.source !== frameRef.current?.contentWindow ||
        event.origin !== repositoryConnection.frameOrigin(frame.url) ||
        event.data?.nonce !== frame.nonce
      )
        return;
      const data = event.data;
      if (!matchingFrame() && data.type !== "kaizen-source-ready") return;
      if (data.type === "kaizen-source-ready") {
        clearTimeout(timeout);
        setReady(true);
        setError("");
        push();
        send({ type: "kaizen-source-scroll", y: scroll.current });
      } else if (
        data.type === "kaizen-source-select" &&
        Array.isArray(data.ids)
      ) {
        setIds([
          ...new Set<string>(
            data.ids.filter(
              (id: unknown): id is string =>
                typeof id === "string" &&
                Boolean(
                  current.current.inspection?.fields.some((f) => f.id === id),
                ),
            ),
          ),
        ]);
        setReason(
          typeof data.reason === "string" ? data.reason.slice(0, 2000) : "",
        );
        setRegistration(registrationFor(data.registrationId));
      } else if (data.type === "kaizen-source-edit") edit(data.id, data.value);
      else if (data.type === "kaizen-source-order" && Array.isArray(data.order))
        order(data.id, data.order);
      else if (data.type === "kaizen-source-scroll" && Number.isFinite(data.y))
        scroll.current = Math.max(0, data.y);
      else if (data.type === "kaizen-source-undo") undo();
      else if (data.type === "kaizen-source-redo") redo();
    };
    window.addEventListener("message", receive);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("message", receive);
    };
  }, [frame]);
  useEffect(() => {
    if (ready) push();
  }, [
    draft.values,
    draft.orders,
    draft.ready,
    draft.stale,
    ready,
    previews,
    inspection,
  ]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        !(event.ctrlKey || event.metaKey) ||
        event.key.toLowerCase() !== "z" ||
        (event.target as Element)?.closest("input,textarea,[contenteditable]")
      )
        return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    undoStack.current = [];
    redoStack.current = [];
  }, [inspection]);
  return {
    ids,
    reason,
    ready,
    error,
    edit,
    order,
    undo,
    redo,
    registration,
    replaceAsset: (fieldId: string, assetId: string, path: string) => {
      if (!current.current.draft.ready || current.current.draft.stale) return;
      const field = current.current.inspection?.fields.find(
        (f) => f.id === fieldId && f.kind === "image",
      );
      if (!field) return;
      record(fieldId);
      const next = structuredClone(state());
      next.values[fieldId] = `/${path.slice(7)}`;
      next.assets = [
        ...next.assets.filter((a) => a.fieldId !== fieldId),
        { fieldId, assetId, path },
      ];
      // A replaced image uses the chosen original at every size, avoiding an old srcset winning over src.
      for (const sibling of current.current.inspection!.fields)
        if (
          field.elementId &&
          sibling.elementId === field.elementId &&
          /srcset/i.test(sibling.attribute || "")
        )
          next.values[sibling.id] = next.values[fieldId];
      replace(next);
    },
    canUndo: undoStack.current.length > 0,
    canRedo: redoStack.current.length > 0,
    select: (id: string) => {
      setIds([id]);
      setReason("");
      setRegistration(
        registrationFor(
          current.current.inspection?.fields.find((f) => f.id === id)
            ?.registration?.id,
        ),
      );
      send({ type: "kaizen-source-focus", id });
    },
    hello: () => send({ type: "kaizen-source-hello" }),
    clear: () => {
      setIds([]);
      setReason("");
      setRegistration(undefined);
    },
  };
}
