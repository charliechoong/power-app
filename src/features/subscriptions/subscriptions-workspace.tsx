"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { useCanEdit } from "@/lib/edit-access";
import { useStorageMode } from "@/lib/storage-mode";
import { useSubscriptionsRepository } from "./client-repository";
import { SUBSCRIPTIONS_STORAGE_PREFIX } from "./local-repository";
import {
  BILLING_CYCLES,
  CYCLE_LABELS,
  STATUS_LABELS,
  SUBSCRIPTION_STATUSES,
  currentSubscriptionStatus,
  formatPrice,
  singaporeDate,
  sortSubscriptions,
  validateSubscription,
  type Subscription,
  type SubscriptionInput,
  type SubscriptionStatus,
} from "./model";
import "./subscriptions.css";

const blank: SubscriptionInput = {
  name: "",
  amount: null,
  currency: "SGD",
  billingCycle: "monthly",
  nextRenewal: null,
  status: "active",
  url: "",
  notes: "",
};
type Filter = SubscriptionStatus | "all";
function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-SG", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}

export function SubscriptionsWorkspace() {
  const repository = useSubscriptionsRepository();
  const canEdit = useCanEdit();
  const mode = useStorageMode();
  const [items, setItems] = useState<Subscription[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [filter, setFilter] = useState<Filter>("active");
  const [draft, setDraft] = useState<SubscriptionInput>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [today, setToday] = useState(singaporeDate);

  useEffect(() => {
    let active = true;
    const load = () =>
      repository
        .list()
        .then((records) => {
          if (active) {
            setItems(records);
            setReady(true);
            setError("");
          }
        })
        .catch((reason) => {
          if (active) {
            setError(
              reason instanceof Error
                ? reason.message
                : "Could not load subscriptions.",
            );
            setReady(false);
          }
        });
    void load();
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key.startsWith(SUBSCRIPTIONS_STORAGE_PREFIX)
      )
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

  useEffect(() => {
    const refreshDate = () => setToday(singaporeDate());
    const timer = window.setInterval(refreshDate, 60_000);
    window.addEventListener("focus", refreshDate);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshDate);
    };
  }, []);

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
  async function save(input: SubscriptionInput, existing?: Subscription) {
    const saved = await repository.save(validateSubscription(input), existing);
    setItems((previous) =>
      sortSubscriptions(
        existing
          ? previous.map((item) => (item.id === saved.id ? saved : item))
          : [saved, ...previous],
      ),
    );
    if (!existing || editing === existing.id) {
      setDraft(blank);
      setEditing(null);
      setShowMore(false);
    }
    if (!existing) setFilter("active");
    setMessage(existing ? "Subscription updated." : "Subscription added.");
  }
  function edit(
    item: Subscription,
    status = currentSubscriptionStatus(item, today),
  ) {
    setEditing(item.id);
    setDraft({
      name: item.name,
      amount: item.amount,
      currency: item.currency,
      billingCycle: item.billingCycle,
      nextRenewal: item.nextRenewal,
      status,
      url: item.url,
      notes: item.notes,
    });
    setShowMore(true);
    document
      .getElementById("subscription-form-heading")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const activeCount = items.filter((item) =>
    ["active", "ending"].includes(currentSubscriptionStatus(item, today)),
  ).length;
  const visible = sortSubscriptions(
    items.filter((item) => {
      const status = currentSubscriptionStatus(item, today);
      return (
        filter === "all" ||
        status === filter ||
        (filter === "active" && status === "ending")
      );
    }),
  );

  return (
    <section
      className="subscriptions-page"
      id="subscriptions"
      aria-labelledby="subscriptions-heading"
    >
      <div className="subscriptions-heading">
        <div>
          <p className="eyebrow">KEEP TRACK OF WHAT RENEWS</p>
          <h2 id="subscriptions-heading">
            Subscriptions<span>.</span>
          </h2>
        </div>
        <span className="subscriptions-count">{activeCount} active</span>
      </div>
      <p className="subscriptions-intro">
        Keep your paid tools in one place, with their price, billing cycle and
        next renewal or access-end date. Ending means you can still use a
        subscription but it will not renew. This list is publicly readable, like
        the rest of the app. Changing a status here does not change your
        subscription with the provider.
      </p>

      {canEdit && (
        <div className="subscriptions-capture">
          <h3 id="subscription-form-heading">
            <Icon name="plus" size={18} />{" "}
            {editing ? "Edit subscription" : "Add a subscription"}
          </h3>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void run(() =>
                save(
                  draft,
                  items.find((item) => item.id === editing),
                ),
              );
            }}
          >
            <div className="subscriptions-form-grid">
              <label className="subscription-name">
                Service name
                <input
                  required
                  maxLength={200}
                  placeholder="e.g. GPT Pro"
                  value={draft.name}
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                />
              </label>
              <label>
                Price (optional)
                <input
                  type="number"
                  min="0"
                  max="999999.99"
                  step="0.01"
                  placeholder="Amount"
                  value={draft.amount ?? ""}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      amount:
                        event.target.value === ""
                          ? null
                          : Number(event.target.value),
                    })
                  }
                />
              </label>
              <label>
                Currency
                <input
                  maxLength={3}
                  list="subscription-currencies"
                  value={draft.currency}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      currency: event.target.value.toUpperCase(),
                    })
                  }
                />
                <datalist id="subscription-currencies">
                  <option value="SGD" />
                  <option value="USD" />
                  <option value="MYR" />
                  <option value="EUR" />
                  <option value="GBP" />
                </datalist>
              </label>
              <label>
                Billing cycle
                <select
                  value={draft.billingCycle}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      billingCycle: event.target
                        .value as SubscriptionInput["billingCycle"],
                    })
                  }
                >
                  {BILLING_CYCLES.map((cycle) => (
                    <option key={cycle} value={cycle}>
                      {CYCLE_LABELS[cycle]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {draft.status === "ending"
                  ? "Access ends (required)"
                  : "Next renewal (optional)"}
                <input
                  type="date"
                  required={draft.status === "ending"}
                  value={draft.nextRenewal ?? ""}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      nextRenewal: event.target.value || null,
                    })
                  }
                />
              </label>
            </div>
            <button
              type="button"
              className="subscriptions-more"
              aria-expanded={showMore}
              onClick={() => setShowMore(!showMore)}
            >
              {showMore ? "Hide more details" : "Add a link, note or status"}
            </button>
            {showMore && (
              <div className="subscriptions-extra">
                <label>
                  Status
                  <select
                    value={draft.status}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        status: event.target.value as SubscriptionStatus,
                      })
                    }
                  >
                    {SUBSCRIPTION_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                  {draft.status === "ending" && (
                    <span className="subscription-status-help">
                      Access continues through the date above, then appears as
                      Canceled. Update auto-renew with the provider separately.
                    </span>
                  )}
                </label>
                <label>
                  Manage subscription link (optional)
                  <input
                    type="url"
                    maxLength={1000}
                    placeholder="https://..."
                    value={draft.url}
                    onChange={(event) =>
                      setDraft({ ...draft, url: event.target.value })
                    }
                  />
                </label>
                <label>
                  Notes (optional)
                  <textarea
                    rows={2}
                    maxLength={2000}
                    placeholder="Plan name or cancellation instructions (no passwords or secrets)"
                    value={draft.notes}
                    onChange={(event) =>
                      setDraft({ ...draft, notes: event.target.value })
                    }
                  />
                </label>
              </div>
            )}
            <div className="subscriptions-form-actions">
              <button
                className="button primary"
                disabled={!ready || busy}
                type="submit"
              >
                {editing ? "Save changes" : "Add subscription"}
              </button>
              {editing && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setEditing(null);
                    setDraft(blank);
                    setShowMore(false);
                  }}
                >
                  Cancel editing
                </button>
              )}
            </div>
          </form>
        </div>
      )}
      {error && (
        <div className="subscriptions-error" role="alert">
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
      <p className="subscriptions-message" role="status" aria-live="polite">
        {message}
      </p>
      <div className="subscriptions-list-head">
        <div>
          <h3>Your subscriptions</h3>
          <p>Earliest date first</p>
        </div>
        <div
          className="subscriptions-filters"
          role="group"
          aria-label="Filter subscriptions"
        >
          {(["active", "ending", "paused", "canceled", "all"] as const).map(
            (status) => (
              <button
                key={status}
                aria-pressed={filter === status}
                onClick={() => setFilter(status)}
              >
                {status === "all" ? "All" : STATUS_LABELS[status]}
              </button>
            ),
          )}
        </div>
      </div>
      {!ready && !error && (
        <p className="subscriptions-empty">Loading subscriptions…</p>
      )}
      {ready && !visible.length && (
        <p className="subscriptions-empty">
          {items.length
            ? "No subscriptions in this view."
            : "Your subscriptions will appear here. Add one above when you are ready."}
        </p>
      )}
      <div className="subscriptions-grid">
        {visible.map((item) => {
          const status = currentSubscriptionStatus(item, today);
          return (
            <article className="subscription-card" key={item.id}>
              <div className="subscription-card-top">
                <h4>{item.name}</h4>
                <span className={`subscription-status status-${status}`}>
                  {STATUS_LABELS[status]}
                </span>
              </div>
              <p className="subscription-price">{formatPrice(item)}</p>
              <p className="subscription-renewal">
                {item.nextRenewal ? (
                  <>
                    {item.status === "ending"
                      ? status === "ending"
                        ? "Access ends"
                        : "Access ended"
                      : status === "active"
                        ? "Next renewal"
                        : "Renewal date"}
                    : <strong>{formatDate(item.nextRenewal)}</strong>
                  </>
                ) : (
                  "Renewal date not set"
                )}
              </p>
              {canEdit && (
                <div className="subscription-actions">
                  {status === "active" && (
                    <>
                      <button
                        disabled={busy}
                        onClick={() =>
                          void run(() =>
                            save({ ...item, status: "paused" }, item),
                          )
                        }
                      >
                        Pause
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          item.nextRenewal && item.nextRenewal >= today
                            ? void run(() =>
                                save({ ...item, status: "ending" }, item),
                              )
                            : edit(item, "ending")
                        }
                      >
                        Mark ending
                      </button>
                    </>
                  )}
                  {status !== "active" && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          save({ ...item, status: "active" }, item),
                        )
                      }
                    >
                      Mark active
                    </button>
                  )}
                  {status !== "canceled" && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          save({ ...item, status: "canceled" }, item),
                        )
                      }
                    >
                      Mark canceled
                    </button>
                  )}
                  <button
                    className="subscription-icon-action"
                    disabled={busy}
                    aria-label={`Edit ${item.name}`}
                    onClick={() => edit(item)}
                  >
                    <Icon name="edit" size={16} />
                  </button>
                  <button
                    className="subscription-icon-action"
                    disabled={busy}
                    aria-label={`Delete ${item.name}`}
                    onClick={() => {
                      if (
                        window.confirm(`Delete “${item.name}” from your list?`)
                      )
                        void run(async () => {
                          await repository.remove(item.id);
                          setItems((previous) =>
                            previous.filter((record) => record.id !== item.id),
                          );
                          setMessage("Subscription deleted.");
                        });
                    }}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              )}
              {(item.notes || item.url) && (
                <div className="subscription-details">
                  {item.notes && (
                    <p className="subscription-notes">{item.notes}</p>
                  )}
                  {item.url && (
                    <a
                      className="subscription-link"
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Manage with provider <Icon name="arrow" size={14} />
                    </a>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
