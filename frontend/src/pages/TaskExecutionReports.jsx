
import { useCallback, useEffect, useState } from "react";

const API = "http://127.0.0.1:8000/api";

function tr(t, key, fallback) {
  const value = t(key);
  return value === key ? fallback : value;
}

function localDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatQuantity(value) {
  const number = Number(value ?? 0);

  return Number.isFinite(number)
    ? number.toLocaleString(undefined, {
        maximumFractionDigits: 3,
      })
    : "0";
}

async function readResponse(response) {
  if (response.ok) {
    return response.json();
  }

  let message = `Request failed (${response.status})`;

  try {
    const body = await response.json();

    if (body?.detail) {
      message = Array.isArray(body.detail)
        ? body.detail.map((item) => item.msg || String(item)).join(", ")
        : String(body.detail);
    }
  } catch {
    // Keep the HTTP error message.
  }

  throw new Error(message);
}

export default function TaskExecutionReports({ taskId, t }) {
  const [reports, setReports] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedDate, setSelectedDate] = useState(localDateString());

  const [periodQuantity, setPeriodQuantity] = useState("");
  const [notes, setNotes] = useState("");

  const [editingReportId, setEditingReportId] = useState(null);
  const [correctionReason, setCorrectionReason] = useState("");

  const [historyReportId, setHistoryReportId] = useState(null);
  const [history, setHistory] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [reportsResponse, summaryResponse] = await Promise.all([
        fetch(`${API}/tasks/${taskId}/execution-reports`),
        fetch(
          `${API}/tasks/${taskId}/execution-summary?as_of_date=${selectedDate}`
        ),
      ]);

      const [reportsData, summaryData] = await Promise.all([
        readResponse(reportsResponse),
        readResponse(summaryResponse),
      ]);

      setReports(reportsData);
      setSummary(summaryData);
    } catch (loadError) {
      console.error(loadError);
      setError(
        loadError.message ||
          tr(t, "executionReportsLoadFailed", "Unable to load execution reports.")
      );
    } finally {
      setLoading(false);
    }
  }, [taskId, selectedDate, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setEditingReportId(null);
    setPeriodQuantity("");
    setNotes("");
    setCorrectionReason("");
    setMessage("");
  };

  const startEditing = (report) => {
    setEditingReportId(report.id);
    setPeriodQuantity(String(report.period_quantity));
    setNotes(report.notes || "");
    setCorrectionReason("");
    setMessage("");
    setError("");
  };

  const submitReport = async (event) => {
    event.preventDefault();

    setError("");
    setMessage("");

    if (
      periodQuantity.trim() === "" ||
      !Number.isFinite(Number(periodQuantity)) ||
      Number(periodQuantity) < 0
    ) {
      setError(
        tr(
          t,
          "executionQuantityInvalid",
          "Enter a valid quantity greater than or equal to zero."
        )
      );
      return;
    }

    if (editingReportId !== null && !correctionReason.trim()) {
      setError(
        tr(
          t,
          "correctionReasonRequired",
          "Enter the reason for correcting this report."
        )
      );
      return;
    }

    setSaving(true);

    try {
      let response;

      if (editingReportId !== null) {
        response = await fetch(
          `${API}/execution-reports/${editingReportId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              period_quantity: Number(periodQuantity),
              notes,
              reason: correctionReason.trim(),
            }),
          }
        );
      } else {
        response = await fetch(
          `${API}/tasks/${taskId}/execution-reports`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              task_id: Number(taskId),
              report_date: selectedDate,
              period_quantity: Number(periodQuantity),
              notes: notes.trim() || null,
            }),
          }
        );
      }

      await readResponse(response);

      setMessage(
        editingReportId !== null
          ? tr(t, "executionReportCorrected", "Report corrected successfully.")
          : tr(t, "executionReportCreated", "Daily report saved successfully.")
      );

      resetForm();
      await loadData();
    } catch (saveError) {
      console.error(saveError);
      setError(saveError.message || tr(t, "saveFailed", "Unable to save the report."));
    } finally {
      setSaving(false);
    }
  };

  const showHistory = async (reportId) => {
    setError("");
    setMessage("");

    if (historyReportId === reportId) {
      setHistoryReportId(null);
      setHistory([]);
      return;
    }

    try {
      const response = await fetch(
        `${API}/execution-reports/${reportId}/history`
      );
      const data = await readResponse(response);

      setHistory(data);
      setHistoryReportId(reportId);
    } catch (historyError) {
      console.error(historyError);
      setError(
        historyError.message ||
          tr(t, "executionHistoryLoadFailed", "Unable to load correction history.")
      );
    }
  };

  const unit = summary?.unit;

  return (
    <section className="execution-reports-panel">
      <div className="execution-reports-heading">
        <div>
          <span className="project-section-eyebrow">
            {tr(t, "executionControl", "Execution Control")}
          </span>
          <h5>
            {tr(t, "dailyExecutionReports", "Daily Execution Reports")}
          </h5>
        </div>
      </div>

      {error && (
        <div className="execution-report-alert error" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="execution-report-alert success" role="status">
          {message}
        </div>
      )}

      {loading && (
        <p className="execution-report-muted">
          {tr(t, "loadingReports", "Loading reports...")}
        </p>
      )}

      {!loading && summary && !unit && (
        <p className="execution-report-muted">
          {tr(
            t,
            "quantityNotConfigured",
            "Quantity reporting is unavailable because this task has no quantity record or unit configured."
          )}
        </p>
      )}

      {!loading && summary && unit && (
        <>
          <div className="execution-summary-grid">
            <div className="execution-summary-item">
              <span>
                {tr(t, "openingQuantity", "Opening Quantity")}
              </span>
              <strong>
                {formatQuantity(summary.opening_quantity)} {unit}
              </strong>
            </div>

            <div className="execution-summary-item">
              <span>
                {tr(t, "reportedQuantity", "Reported Quantity")}
              </span>
              <strong>
                {formatQuantity(summary.period_quantity_total)} {unit}
              </strong>
            </div>

            <div className="execution-summary-item">
              <span>
                {tr(t, "cumulativeQuantity", "Cumulative Quantity")}
              </span>
              <strong>
                {formatQuantity(summary.cumulative_quantity)} {unit}
              </strong>
            </div>

            <div className="execution-summary-item">
              <span>
                {tr(t, "plannedQuantity", "Planned Quantity")}
              </span>
              <strong>
                {formatQuantity(summary.planned_quantity)} {unit}
              </strong>
            </div>
          </div>

          <div className="execution-summary-progress">
            <div className="execution-summary-progress-heading">
              <span>{tr(t, "quantityProgress", "Quantity Progress")}</span>
              <strong>{Number(summary.quantity_progress || 0).toFixed(1)}%</strong>
            </div>

            <div className="project-overview-progress-track">
              <div
                className="project-overview-progress-fill"
                style={{
                  width: `${Math.min(
                    Math.max(Number(summary.quantity_progress || 0), 0),
                    100
                  )}%`,
                }}
              />
            </div>
          </div>

          <form className="execution-report-form" onSubmit={submitReport}>
            <h6>
              {editingReportId !== null
                ? tr(t, "correctExecutionReport", "Correct Execution Report")
                : tr(t, "recordDailyExecution", "Record Daily Execution")}
            </h6>

            <div className="execution-report-form-grid">
              <div className="form-group">
                <label htmlFor={`execution-date-${taskId}`}>
                  {tr(t, "reportDate", "Report Date")}
                </label>

                <input
                  id={`execution-date-${taskId}`}
                  type="date"
                  value={selectedDate}
                  max={localDateString()}
                  disabled={saving || editingReportId !== null}
                  onChange={(event) => {
                    setSelectedDate(event.target.value);
                    setMessage("");
                  }}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor={`execution-quantity-${taskId}`}>
                  {tr(t, "periodQuantity", "Quantity for This Day")} ({unit})
                </label>

                <input
                  id={`execution-quantity-${taskId}`}
                  type="number"
                  min="0"
                  step="0.001"
                  value={periodQuantity}
                  onChange={(event) => setPeriodQuantity(event.target.value)}
                  disabled={saving}
                  required
                />
              </div>

              <div className="form-group execution-report-notes">
                <label htmlFor={`execution-notes-${taskId}`}>
                  {tr(t, "notes", "Notes")}
                </label>

                <textarea
                  id={`execution-notes-${taskId}`}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                  disabled={saving}
                />
              </div>

              {editingReportId !== null && (
                <div className="form-group execution-report-notes">
                  <label htmlFor={`execution-reason-${taskId}`}>
                    {tr(t, "correctionReason", "Correction Reason")} *
                  </label>

                  <textarea
                    id={`execution-reason-${taskId}`}
                    value={correctionReason}
                    onChange={(event) => setCorrectionReason(event.target.value)}
                    rows={2}
                    disabled={saving}
                    required
                  />
                </div>
              )}
            </div>

            <div className="execution-report-form-actions">
              {editingReportId !== null && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={resetForm}
                  disabled={saving}
                >
                  {tr(t, "cancel", "Cancel")}
                </button>
              )}

              <button
                type="submit"
                className="primary-button"
                disabled={saving}
              >
                {saving
                  ? tr(t, "saving", "Saving...")
                  : editingReportId !== null
                    ? tr(t, "saveCorrection", "Save Correction")
                    : tr(t, "saveReport", "Save Report")}
              </button>
            </div>
          </form>

          <div className="execution-report-list">
            <h6>{tr(t, "reportHistory", "Daily Reports")}</h6>

            {reports.length === 0 ? (
              <p className="execution-report-muted">
                {tr(t, "noExecutionReports", "No daily reports have been recorded yet.")}
              </p>
            ) : (
              <div className="execution-report-table-wrapper">
                <table className="execution-report-table">
                  <thead>
                    <tr>
                      <th>{tr(t, "reportDate", "Date")}</th>
                      <th>{tr(t, "periodQuantity", "Daily Quantity")}</th>
                      <th>{tr(t, "notes", "Notes")}</th>
                      <th>{tr(t, "actions", "Actions")}</th>
                    </tr>
                  </thead>

                  <tbody>
                    {reports.map((report) => (
                      <tr key={report.id}>
                        <td>{report.report_date}</td>
                        <td>
                          {formatQuantity(report.period_quantity)} {unit}
                        </td>
                        <td>{report.notes || "—"}</td>
                        <td>
                          <div className="execution-report-row-actions">
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => startEditing(report)}
                              disabled={saving}
                            >
                              {tr(t, "correct", "Correct")}
                            </button>

                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => showHistory(report.id)}
                            >
                              {tr(t, "viewHistory", "History")}
                            </button>
                          </div>

                          {historyReportId === report.id && (
                            <div className="execution-report-history">
                              <strong>
                                {tr(t, "correctionHistory", "Correction History")}
                              </strong>

                              {history.length === 0 ? (
                                <p>
                                  {tr(t, "noCorrections", "No corrections recorded.")}
                                </p>
                              ) : (
                                history.map((item) => (
                                  <div
                                    className="execution-report-history-item"
                                    key={item.id}
                                  >
                                    <span>
                                      {formatQuantity(item.previous_quantity)} →{" "}
                                      {formatQuantity(item.recorded_quantity)} {unit}
                                    </span>

                                    <span>{item.reason}</span>

                                    <small>
                                      {String(item.changed_at || "").replace("T", " ")}
                                    </small>
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
