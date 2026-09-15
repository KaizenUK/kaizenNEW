import React, { useState } from "react";
import { buildProblemReport } from "../../shared/builderDiagnostics";
import { repositoryConnection } from "./repositoryConnection";
import { diagnosticPage, lastDiagnosticError } from "./diagnostics";
import { activeProjectId } from "./projectStorage";
import { localMode } from "./storage";
import { downloadText } from "./downloadText";
import { Card, Notice } from "./shell";

export default function ProblemReport() {
  const [report, setReport] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function copy() {
    setBusy(true);
    try {
      const value = JSON.stringify(
        await buildProblemReport({
          projectId: activeProjectId,
          page: diagnosticPage(),
          userAgent: navigator.userAgent,
          helper: {
            local: localMode,
            status: repositoryConnection.snapshot().status,
          },
          lastError: lastDiagnosticError(),
        }),
        null,
        2,
      );
      setReport(value);
      try {
        await navigator.clipboard.writeText(value);
        setNotice(
          "Report copied. Share it with Kaizen and describe what you were trying to do.",
        );
      } catch {
        setNotice(
          "The browser could not copy the report. Download it instead.",
        );
      }
    } catch {
      setNotice("The report could not be created. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card title="Help and feedback">
      <div className="builder-row builder-actions">
        <button
          type="button"
          className="builder-primary"
          disabled={busy}
          onClick={() => void copy()}
        >
          {busy ? "Preparing report…" : "Report a problem"}
        </button>
        {report && (
          <button
            type="button"
            onClick={() => downloadText("kaizen-problem-report.json", report)}
          >
            Download report
          </button>
        )}
      </div>
      {notice && <Notice>{notice}</Notice>}
      {report && (
        <details className="builder-problem-report">
          <summary>View report</summary>
          <pre>{report}</pre>
        </details>
      )}
    </Card>
  );
}
