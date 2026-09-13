import React, { useState } from "react";
import { projectRequest } from "./projectStorage";
import { invitationNotice, inviteProjectMember } from "./invitations";
type Member = {
  user_id: string;
  email: string;
  name: string;
  role: "owner" | "editor";
  can_publish: boolean;
  invitation_state: "invited" | "setup" | "active";
};
export default function ProjectMembers({ id }: { id: string }) {
  const [members, setMembers] = useState<Member[]>(),
    [editing, setEditing] = useState<Member>(),
    [removing, setRemoving] = useState<string>(),
    [email, setEmail] = useState(""),
    [role, setRole] = useState<"owner" | "editor">("editor"),
    [publish, setPublish] = useState(false),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  async function load() {
    try {
      setMembers(await projectRequest({ action: "members", id }));
    } catch (error) {
      setMembers(undefined);
      throw error;
    }
  }
  async function run(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function clearForm() {
    setEditing(undefined);
    setEmail("");
    setRole("editor");
    setPublish(false);
  }
  const onlyOwner =
    members?.filter((member) => member.role === "owner").length === 1;
  return (
    <details
      className="builder-project-members"
      onToggle={(event) => {
        if (event.currentTarget.open && !members) void run(load);
      }}
    >
      <summary>Project access</summary>
      <p>
        Invite someone by email and choose what they can do. Permission to
        publish is separate from their role.
      </p>
      <button type="button" disabled={busy} onClick={() => void run(load)}>
        Refresh members
      </button>
      {members?.map((member) => (
        <div
          className="builder-member-row"
          role="group"
          aria-label={"Access for " + member.email}
          key={member.user_id}
        >
          <div>
            <strong>{member.name || member.email}</strong>
            {member.name && <div>{member.email}</div>}
          </div>
          <span>
            {member.role === "owner" ? "Owner" : "Editor"} ·{" "}
            {member.can_publish ? "May publish" : "Cannot publish"} ·{" "}
            {member.invitation_state === "invited"
              ? "Invitation pending"
              : member.invitation_state === "setup"
                ? "Account setup needed"
                : "Account ready"}
          </span>
          <div className="builder-member-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setEditing(member);
                setEmail(member.email);
                setRole(member.role);
                setPublish(member.can_publish);
                setRemoving(undefined);
              }}
            >
              Edit access
            </button>
            {member.invitation_state === "invited" && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    setNotice(
                      invitationNotice(
                        await inviteProjectMember({
                          action: "resend",
                          projectId: id,
                          userId: member.user_id,
                        }),
                      ),
                    );
                    await load();
                  })
                }
              >
                Resend invitation
              </button>
            )}
            <button
              type="button"
              disabled={busy || (onlyOwner && member.role === "owner")}
              onClick={() => setRemoving(member.user_id)}
            >
              Remove access
            </button>
          </div>
          {onlyOwner && member.role === "owner" && (
            <small>Keep at least one project owner.</small>
          )}
          {removing === member.user_id && (
            <div className="builder-member-confirm">
              <p>
                Remove {member.email} from this project? Their account and work
                will remain.
              </p>
              <button
                type="button"
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
                    setRemoving(undefined);
                    if (editing?.user_id === member.user_id) clearForm();
                    setNotice("Project access removed.");
                    await load();
                  })
                }
              >
                Confirm removal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setRemoving(undefined)}
              >
                Keep access
              </button>
            </div>
          )}
        </div>
      ))}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            if (editing) {
              await projectRequest({
                action: "set-member",
                id,
                userId: editing.user_id,
                role,
                canPublish: publish,
              });
              setNotice("Project access updated.");
            } else {
              setNotice(
                invitationNotice(
                  await inviteProjectMember({
                    action: "invite",
                    projectId: id,
                    email,
                    role,
                    canPublish: publish,
                  }),
                ),
              );
            }
            clearForm();
            await load();
          });
        }}
      >
        <h3>{editing ? "Edit project access" : "Invite to this project"}</h3>
        <label>
          Email address
          <input
            required
            name="invite-email"
            type="email"
            autoComplete="email"
            maxLength={254}
            value={email}
            disabled={busy || Boolean(editing)}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Role
          <select
            value={role}
            disabled={busy}
            onChange={(event) =>
              setRole(event.target.value as "owner" | "editor")
            }
          >
            <option value="editor">Editor</option>
            <option value="owner">Owner</option>
          </select>
        </label>
        <label className="builder-project-filter">
          <input
            type="checkbox"
            checked={publish}
            disabled={busy}
            onChange={(event) => setPublish(event.target.checked)}
          />
          Allow publishing
        </label>
        <div className="builder-member-actions">
          <button className="builder-primary" disabled={busy}>
            {busy
              ? "Please wait…"
              : editing
                ? "Save access"
                : "Send invitation"}
          </button>
          {editing && (
            <button type="button" disabled={busy} onClick={clearForm}>
              Cancel editing access
            </button>
          )}
        </div>
      </form>
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
    </details>
  );
}
