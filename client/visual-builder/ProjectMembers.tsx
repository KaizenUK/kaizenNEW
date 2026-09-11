import React, { useState } from "react";
import { projectRequest } from "./projectStorage";
type Member = {
  user_id: string;
  role: "owner" | "editor";
  can_publish: boolean;
};
export default function ProjectMembers({ id }: { id: string }) {
  const [members, setMembers] = useState<Member[]>(),
    [userId, setUserId] = useState(""),
    [role, setRole] = useState("editor"),
    [publish, setPublish] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function load() {
    setMembers(await projectRequest({ action: "members", id }));
  }
  async function run(operation: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      onToggle={(event) => {
        if (event.currentTarget.open && !members) void run(load);
      }}
    >
      <summary>Project access</summary>
      <p>
        Add an existing account by its Supabase user ID. Editor access and
        permission to publish are separate. No invitation email is sent.
      </p>
      {members?.map((member) => (
        <div className="builder-member-row" key={member.user_id}>
          <code>{member.user_id}</code>
          <span>
            {member.role} ·{" "}
            {member.can_publish ? "May publish" : "Cannot publish"}
          </span>
          <button
            disabled={busy}
            onClick={() => {
              setUserId(member.user_id);
              setRole(member.role);
              setPublish(member.can_publish);
            }}
          >
            Edit access
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await projectRequest({
                  action: "set-member",
                  id,
                  userId: member.user_id,
                  role: null,
                  canPublish: false,
                });
                await load();
              })
            }
          >
            Remove access
          </button>
        </div>
      ))}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            await projectRequest({
              action: "set-member",
              id,
              userId,
              role,
              canPublish: publish,
            });
            await load();
            setUserId("");
          });
        }}
      >
        <label>
          Account user ID
          <input
            required
            value={userId}
            pattern="[a-fA-F0-9-]{36}"
            onChange={(event) => setUserId(event.target.value)}
          />
        </label>
        <label>
          Role
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="editor">Editor</option>
            <option value="owner">Owner</option>
          </select>
        </label>
        <label className="builder-project-filter">
          <input
            type="checkbox"
            checked={publish}
            onChange={(event) => setPublish(event.target.checked)}
          />
          Allow publishing
        </label>
        <button disabled={busy}>Save access</button>
      </form>
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
