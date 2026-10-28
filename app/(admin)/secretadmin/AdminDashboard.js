import ThemeToggle from "@/components/ThemeToggle";
import { RANGES } from "@/lib/adminData";
import { logout } from "./actions";

const ROUTES = [
  ["generate", "/api/generate", "Plan & refine trips"],
  ["directions", "/api/directions", "Map routes"],
  ["maps_load", "/api/maps/load", "Trip map load check"],
  ["trips_join", "/api/trips/join", "Join from invite link"],
  ["trips_members", "/api/trips/members", "List trip members"],
];
const CACHES = [
  ["directions", "Map routes", "/api/directions, per server process"],
  ["places", "Google Places", "place grounding, per server process"],
];
const SERVICES = [
  ["groq", "Groq", "guardrail, place extraction, generation"],
  ["google_places", "Google Places", "text & nearby search"],
  ["google_routes", "Google Routes", "street routing"],
  ["osm", "OpenStreetMap", "fallback routing"],
];

const numberFormat = new Intl.NumberFormat("en");
const fmt = (n) => (n == null ? "—" : numberFormat.format(n));
const pct = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");
const monthLabel = (month) => new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en", { month: "long", year: "numeric", timeZone: "UTC" });
const dayLabel = (day) => new Date(`${day}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });

function Stat({ label, value, note }) {
  return (
    <div className="admin-stat">
      <p className="admin-stat-label">{label}</p>
      <p className="admin-stat-value">{value}</p>
      {note && <p className="admin-stat-note">{note}</p>}
    </div>
  );
}

function Section({ title, note, children }) {
  return (
    <section className="admin-section">
      <header>
        <h2>{title}</h2>
        {note && <p>{note}</p>}
      </header>
      {children}
    </section>
  );
}

function RequestsChart({ series }) {
  const max = Math.max(1, ...series.map((point) => point.requests));
  const total = series.reduce((sum, point) => sum + point.requests, 0);
  return (
    <figure className="admin-chart" aria-label="API requests per day">
      <div className="admin-chart-plot" style={{ "--bars": series.length }}>
        <span className="admin-chart-max">{fmt(max)}</span>
        {series.map((point) => (
          <div key={point.day} className="admin-bar" tabIndex={0} aria-label={`${dayLabel(point.day)}: ${fmt(point.requests)} requests`}>
            <span className="admin-bar-fill" style={{ height: `${(point.requests / max) * 100}%` }} />
            <span className="admin-tooltip" role="tooltip">
              <strong>{fmt(point.requests)}</strong> requests · {dayLabel(point.day)}
            </span>
          </div>
        ))}
      </div>
      <figcaption className="admin-chart-axis">
        <span>{dayLabel(series[0].day)}</span>
        <span>{fmt(total)} requests</span>
        <span>{series.length > 1 ? dayLabel(series.at(-1).day) : "UTC"}</span>
      </figcaption>
    </figure>
  );
}

function GoogleQuota({ google }) {
  const capped = google.capPercent != null;
  return (
    <Section
      title={`Google free tier · ${monthLabel(google.month)}`}
      note={capped ? `Each API pauses at ${google.capPercent}% of its free allowance until the month turns (UTC)` : "Capping is off (GOOGLE_FREE_TIER_CAP=off): usage is counted, never stopped"}
    >
      {!google.tracked && (
        <p className="admin-banner" role="status">
          This month’s Google usage couldn’t be read, so nothing is being paused yet.
        </p>
      )}
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">SKU</th>
              <th scope="col">Used</th>
              <th scope="col">Cap</th>
              <th scope="col" className="admin-quota-col">Of cap</th>
              <th scope="col">Skipped</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {google.skus.map((sku) => {
              const share = capped && sku.used != null ? Math.min(1, sku.limit ? sku.used / sku.limit : 1) : null;
              const paused = capped && sku.used != null && sku.used >= sku.limit;
              return (
                <tr key={sku.key}>
                  <th scope="row">{sku.name}<span>{sku.api} · {sku.use}</span></th>
                  <td>{fmt(sku.used)}</td>
                  <td>{capped ? fmt(sku.limit) : "—"}<span className="admin-quota-free">of {fmt(sku.free)} free</span></td>
                  <td className="admin-quota-col">
                    {share == null ? "—" : (
                      <span className="admin-quota" data-paused={paused || undefined}>
                        <span className="admin-quota-track"><span style={{ width: `${share * 100}%` }} /></span>
                        {Math.round(share * 100)}%
                      </span>
                    )}
                  </td>
                  <td>{fmt(sku.blocked)}</td>
                  <td className={paused ? "admin-quota-paused" : undefined}>{paused ? `Paused · ${sku.paused}` : "Active"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

export default function AdminDashboard({ admin, data }) {
  const t = (metric) => data.totals[metric] || 0;
  const apiTotal = ROUTES.reduce((sum, [key]) => sum + t(`api.${key}.requests`), 0);
  const cacheHits = CACHES.reduce((sum, [key]) => sum + t(`cache.${key}.hit`), 0);
  const cacheLookups = cacheHits + CACHES.reduce((sum, [key]) => sum + t(`cache.${key}.miss`), 0);
  const plans = t("generate.create") + t("generate.refine");
  const lastLogin = admin.lastLoginAt
    ? new Date(admin.lastLoginAt).toLocaleString("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC"
    : "first sign-in";

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Roam admin</p>
          <h1>Analytics</h1>
        </div>
        <div className="admin-header-actions">
          <p className="admin-whoami">
            {admin.username}
            <span>Previous sign-in: {lastLogin}</span>
          </p>
          <ThemeToggle />
          <form action={logout}>
            <button type="submit" className="outline-pill">Sign out</button>
          </form>
        </div>
      </header>

      <nav className="admin-ranges" aria-label="Time range">
        {Object.entries(RANGES).map(([key, range]) => (
          <a key={key} href={`?range=${key}`} aria-current={data.range.key === key ? "page" : undefined}>
            {range.label}
          </a>
        ))}
        <span className="admin-range-note">{data.range.fromDay ? `Since ${dayLabel(data.range.fromDay)} (UTC)` : "Everything recorded"}</span>
      </nav>

      {!data.metricsAvailable && (
        <p className="admin-banner" role="status">
          Usage metrics couldn’t be read. Run <code>npm run setup:appwrite</code> to create the metrics table, and check that{" "}
          <code>APPWRITE_ADMIN_API_KEY</code> has the <code>rows.read</code> and <code>rows.write</code> scopes.
        </p>
      )}

      <div className="admin-stats">
        <Stat label="Users" value={fmt(data.users.total)} note={`${fmt(data.users.new)} new · ${fmt(data.users.verified)} verified`} />
        <Stat label="Trips saved" value={fmt(data.trips.total)} note={`${fmt(data.trips.new)} new in range`} />
        <Stat label="Shared · group trips" value={`${fmt(data.trips.shared)} · ${fmt(data.trips.group)}`} note="view-only links · with invitees" />
        <Stat label="Expenses logged" value={fmt(data.expenses)} note="all time" />
        <Stat label="API requests" value={fmt(apiTotal)} note={`${fmt(plans)} plans & refinements`} />
        <Stat label="Cache hit rate" value={pct(cacheHits, cacheLookups)} note={`${fmt(cacheHits)} of ${fmt(cacheLookups)} lookups`} />
      </div>

      <GoogleQuota google={data.google} />

      <Section title="API requests per day" note={data.range.days ? undefined : "The last 30 days"}>
        <RequestsChart series={data.series} />
      </Section>

      <Section title="API routes">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Route</th>
                <th scope="col">Requests</th>
                <th scope="col">Success</th>
                <th scope="col">4xx</th>
                <th scope="col">5xx</th>
                <th scope="col">Avg time</th>
              </tr>
            </thead>
            <tbody>
              {ROUTES.map(([key, path, purpose]) => {
                const requests = t(`api.${key}.requests`);
                return (
                  <tr key={key}>
                    <th scope="row"><code>{path}</code><span>{purpose}</span></th>
                    <td>{fmt(requests)}</td>
                    <td>{pct(t(`api.${key}.2xx`), requests)}</td>
                    <td>{fmt(t(`api.${key}.4xx`))}</td>
                    <td>{fmt(t(`api.${key}.5xx`))}</td>
                    <td>{requests ? `${fmt(Math.round(t(`api.${key}.ms`) / requests))} ms` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="admin-columns">
        <Section title="Caches" note="In-memory caches start empty whenever the server restarts.">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Cache</th>
                <th scope="col">Hits</th>
                <th scope="col">Misses</th>
                <th scope="col">Hit rate</th>
              </tr>
            </thead>
            <tbody>
              {CACHES.map(([key, name, where]) => (
                <tr key={key}>
                  <th scope="row">{name}<span>{where}</span></th>
                  <td>{fmt(t(`cache.${key}.hit`))}</td>
                  <td>{fmt(t(`cache.${key}.miss`))}</td>
                  <td>{pct(t(`cache.${key}.hit`), t(`cache.${key}.hit`) + t(`cache.${key}.miss`))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Outside services" note="Every HTTP call, retries included.">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Service</th>
                <th scope="col">Calls</th>
                <th scope="col">Errors</th>
              </tr>
            </thead>
            <tbody>
              {SERVICES.map(([key, name, use]) => (
                <tr key={key}>
                  <th scope="row">{name}<span>{use}</span></th>
                  <td>{fmt(t(`upstream.${key}.calls`))}</td>
                  <td>{fmt(t(`upstream.${key}.errors`))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>

      <Section title="Trip generation">
        <div className="admin-stats is-compact">
          <Stat label="New plans" value={fmt(t("generate.create"))} />
          <Stat label="Refinements" value={fmt(t("generate.refine"))} />
          <Stat label="Succeeded" value={fmt(t("generate.succeeded"))} note={pct(t("generate.succeeded"), plans) + " of requests"} />
          <Stat label="Blocked by guardrail" value={fmt(t("generate.guardrail_rejected"))} />
          <Stat label="Grounded in real places" value={fmt(t("generate.grounded"))} />
          <Stat label="Generation tokens" value={fmt(t("generate.tokens"))} note="the itinerary call only" />
          <Stat label="Routes via Google · OSM" value={`${fmt(t("directions.source.google"))} · ${fmt(t("directions.source.osm"))}`} />
        </div>
      </Section>

      <p className="admin-footnote">
        Counts are recorded per UTC day from when tracking was added. Admin accounts are managed only in the database
        (<code>npm run seed:admin</code>).
      </p>
    </div>
  );
}
