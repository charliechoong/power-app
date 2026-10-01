"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";
import { useCanEdit } from "@/lib/edit-access";
import { useStorageMode } from "@/lib/storage-mode";
import { PLANS_STORAGE_PREFIX } from "./local-repository";
import { usePlansRepository } from "./client-repository";
import {
  KIND_LABELS,
  PLAN_KINDS,
  PLAN_STATUSES,
  STATUS_LABELS,
  planPercent,
  validatePlan,
  type Plan,
  type PlanInput,
  type PlanKind,
  type PlanStatus,
} from "./model";
import "./plans.css";

const blank: PlanInput = {
  title: "",
  kind: "task",
  details: "",
  url: "",
  status: "planned",
  current: 0,
  target: null,
  unit: "",
};
type Filter = PlanStatus | "all";

export function PlansWorkspace() {
  const repository = usePlansRepository();
  const canEdit = useCanEdit();
  const mode = useStorageMode();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [draft, setDraft] = useState<PlanInput>(blank);
  const [extra, setExtra] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      repository
        .list()
        .then((items) => {
          if (active) {
            setPlans(items);
            setReady(true);
            setError("");
          }
        })
        .catch((reason) => {
          if (active) {
            setError(
              reason instanceof Error
                ? reason.message
                : "Could not load plans.",
            );
            setReady(false);
          }
        });
    void load();
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith(PLANS_STORAGE_PREFIX))
        void load();
    };
    const onFocus = () => {
      if (mode === "cloud") void load();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
    };
  }, [repository, mode, retry]);

  async function run(action: () => Promise<void>) {
    if (busyRef.current || !ready || !canEdit) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not save your changes.",
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function save(input: PlanInput, existing?: Plan) {
    const clean = validatePlan(input);
    const saved = await repository.save(clean, existing);
    setPlans((previous) =>
      existing
        ? previous.map((item) => (item.id === saved.id ? saved : item))
        : [saved, ...previous],
    );
    if (!existing || editing === existing.id) {
      setDraft(blank);
      setExtra(false);
      setEditing(null);
    }
    if (!existing) {
      setFilter("all");
      setQuery("");
    }
    setMessage(existing ? "Plan updated." : "Plan added.");
  }
  function edit(plan: Plan) {
    setEditing(plan.id);
    setDraft({
      title: plan.title,
      kind: plan.kind,
      details: plan.details,
      url: plan.url,
      status: plan.status,
      current: plan.current,
      target: plan.target,
      unit: plan.unit,
    });
    setExtra(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const visible = plans.filter(
    (plan) =>
      (filter === "all" || plan.status === filter) &&
      `${plan.title} ${plan.details} ${KIND_LABELS[plan.kind]}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  const remaining = plans.filter((plan) => plan.status !== "done").length;

  return (
    <div className="plans-page">
      <header className="plans-heading">
        <p className="eyebrow">THINGS YOU WANT TO MOVE FORWARD</p>
        <h1>
          Plans<span>.</span>
        </h1>
        <p>
          Books to read, courses to take, questions to explore, and projects to
          finish. Keep each one moving at your own pace.
        </p>
      </header>
      {canEdit && (
        <section className="plans-capture" aria-labelledby="plans-form-heading">
          <div className="plans-capture-head">
            <Icon name="list" size={19} />
            <h2 id="plans-form-heading">
              {editing ? "Edit plan" : "Add a plan"}
            </h2>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(() =>
                save(
                  draft,
                  plans.find((item) => item.id === editing),
                ),
              );
            }}
          >
            <div className="plans-quick-row">
              <label className="plans-title-field">
                <span className="sr-only">What do you want to do?</span>
                <input
                  autoFocus={false}
                  required
                  maxLength={300}
                  placeholder="What do you want to do?"
                  value={draft.title}
                  onChange={(event) =>
                    setDraft({ ...draft, title: event.target.value })
                  }
                />
              </label>
              <label className="plans-type-field">
                <span className="sr-only">Type</span>
                <select
                  value={draft.kind}
                  onChange={(event) =>
                    setDraft({ ...draft, kind: event.target.value as PlanKind })
                  }
                >
                  {PLAN_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="button primary"
                disabled={!ready || busy}
                type="submit"
              >
                {editing ? "Save changes" : "Add plan"}
              </button>
            </div>
            <button
              type="button"
              className="plans-more"
              aria-expanded={extra}
              onClick={() => setExtra(!extra)}
            >
              {extra ? "Hide details" : "Add details, link or progress goal"}
            </button>
            {extra && (
              <div className="plans-extra">
                <label>
                  Notes or next step
                  <textarea
                    maxLength={5000}
                    rows={3}
                    value={draft.details}
                    onChange={(event) =>
                      setDraft({ ...draft, details: event.target.value })
                    }
                    placeholder="A small note to remember why or what comes next"
                  />
                </label>
                <label>
                  Link (optional)
                  <input
                    type="url"
                    maxLength={1000}
                    value={draft.url}
                    onChange={(event) =>
                      setDraft({ ...draft, url: event.target.value })
                    }
                    placeholder="https://..."
                  />
                </label>
                <div className="plans-extra-row">
                  <label>
                    Status
                    <select
                      value={draft.status}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          status: event.target.value as PlanStatus,
                        })
                      }
                    >
                      {PLAN_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Progress goal (optional)
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={draft.target ?? ""}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          target: event.target.value
                            ? Number(event.target.value)
                            : null,
                          current: event.target.value ? draft.current : 0,
                          unit: event.target.value ? draft.unit : "",
                        })
                      }
                      placeholder="e.g. 12"
                    />
                  </label>
                  {draft.target !== null && (
                    <>
                      <label>
                        Done so far
                        <input
                          type="number"
                          min="0"
                          max={draft.target}
                          step="1"
                          value={draft.current}
                          onChange={(event) =>
                            setDraft({
                              ...draft,
                              current: Number(event.target.value),
                            })
                          }
                        />
                      </label>
                      <label>
                        Unit
                        <input
                          maxLength={40}
                          value={draft.unit}
                          onChange={(event) =>
                            setDraft({ ...draft, unit: event.target.value })
                          }
                          placeholder="pages, lessons..."
                        />
                      </label>
                    </>
                  )}
                </div>
                {editing && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setEditing(null);
                      setDraft(blank);
                      setExtra(false);
                    }}
                  >
                    Cancel editing
                  </button>
                )}
              </div>
            )}
          </form>
        </section>
      )}
      {error && (
        <div className="plans-error" role="alert">
          {error}{" "}
          {!ready && (
            <button
              className="text-button"
              onClick={() => setRetry((value) => value + 1)}
            >
              Retry
            </button>
          )}
        </div>
      )}
      <p className="plans-message" role="status" aria-live="polite">
        {message}
      </p>
      <section className="plans-list" aria-labelledby="plans-list-heading">
        <div className="plans-list-head">
          <h2 id="plans-list-heading">
            Your plans <span>{remaining} to go</span>
          </h2>
          <p>{plans.length} total</p>
        </div>
        <div className="plans-toolbar">
          <div className="plans-filters" role="group" aria-label="Filter plans">
            {(["all", ...PLAN_STATUSES] as const).map((status) => (
              <button
                key={status}
                type="button"
                aria-pressed={filter === status}
                onClick={() => setFilter(status)}
              >
                {status === "all" ? "All" : STATUS_LABELS[status]}{" "}
                <span>
                  {status === "all"
                    ? plans.length
                    : plans.filter((plan) => plan.status === status).length}
                </span>
              </button>
            ))}
          </div>
          <label className="plans-search">
            <Icon name="search" size={16} />
            <span className="sr-only">Search plans</span>
            <input
              type="search"
              placeholder="Search plans"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        {!ready && !error && <p className="plans-empty">Loading plans…</p>}
        {ready && !visible.length && (
          <p className="plans-empty">
            {plans.length
              ? "No plans match this view."
              : "Your plans will appear here. Add one above whenever something is on your mind."}
          </p>
        )}
        <div className="plans-grid">
          {visible.map((plan) => {
            const percent = planPercent(plan);
            return (
              <article
                className={`plan-card ${plan.status === "done" ? "is-done" : ""}`}
                key={plan.id}
              >
                <div className="plan-card-top">
                  <span className="plan-kind">{KIND_LABELS[plan.kind]}</span>
                  <span className={`plan-status status-${plan.status}`}>
                    {STATUS_LABELS[plan.status]}
                  </span>
                </div>
                <h3>{plan.title}</h3>
                {plan.details && <p className="plan-details">{plan.details}</p>}
                {plan.url && (
                  <a
                    className="plan-link"
                    href={plan.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open link <Icon name="arrow" size={14} />
                  </a>
                )}
                {plan.target !== null && (
                  <div className="plan-progress">
                    <div className="plan-progress-text">
                      <span>
                        {plan.current} / {plan.target} {plan.unit}
                      </span>
                      <strong>{percent}%</strong>
                    </div>
                    <div
                      className="plan-progress-track"
                      role="progressbar"
                      aria-valuenow={percent ?? 0}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${plan.title} progress`}
                    >
                      <span style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                )}
                {canEdit && (
                  <div className="plan-actions">
                    {plan.status === "planned" && (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            save({ ...plan, status: "doing" }, plan),
                          )
                        }
                      >
                        Start
                      </button>
                    )}
                    {plan.target !== null &&
                      plan.status !== "done" &&
                      plan.current < plan.target && (
                        <button
                          disabled={busy}
                          onClick={() =>
                            void run(() =>
                              save(
                                { ...plan, current: plan.current + 1 },
                                plan,
                              ),
                            )
                          }
                        >
                          +1 {plan.unit || "step"}
                        </button>
                      )}
                    {plan.status !== "done" ? (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            save({ ...plan, status: "done" }, plan),
                          )
                        }
                      >
                        <Icon name="check" size={15} /> Complete
                      </button>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            save(
                              {
                                ...plan,
                                status: "doing",
                                current:
                                  plan.target === null
                                    ? 0
                                    : Math.max(0, plan.target - 1),
                              },
                              plan,
                            ),
                          )
                        }
                      >
                        Reopen
                      </button>
                    )}
                    <button
                      disabled={busy}
                      className="plan-icon-action"
                      aria-label={`Edit ${plan.title}`}
                      onClick={() => edit(plan)}
                    >
                      <Icon name="edit" size={16} />
                    </button>
                    <button
                      disabled={busy}
                      className="plan-icon-action"
                      aria-label={`Delete ${plan.title}`}
                      onClick={() => {
                        if (window.confirm(`Delete “${plan.title}”?`))
                          void run(async () => {
                            await repository.remove(plan.id);
                            setPlans((previous) =>
                              previous.filter((item) => item.id !== plan.id),
                            );
                            setMessage("Plan deleted.");
                          });
                      }}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>
      <p className="plans-footnote">
        For book notes and detailed reading progress, use the separate{" "}
        <Link href="/reading">Reading list</Link>.
      </p>
    </div>
  );
}
