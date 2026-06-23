'use client';

import { useEffect, useMemo, useState } from 'react';

type TopItem = { name: string; count: number };
type MonthItem = { month: string; deployments: number; failures: number; total: number; failureRate: number };
type DoraData = {
  project: string;
  totalIssues: number;
  metrics: {
    deployments: number;
    medianLeadTimeDays: number;
    changeFailureRate: number;
    successRate: number;
    failures: number;
    rollbacks: number;
    rollbackRate: number;
  };
  quality?: {
    deployDateCoverage: number;
    missingDeployDates: number;
  };
  top?: {
    categorias?: TopItem[];
    resultados?: TopItem[];
    celulas?: TopItem[];
    sistemas?: TopItem[];
  };
  months?: MonthItem[];
  years?: Array<{ year: string }>;
  insights?: string[];
  sample?: Array<{ key: string; summary: string; resultado: string; categoria: string; celula: string; sistema: string }>;
};

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function pct(value?: number) {
  return `${(value || 0).toLocaleString('es-CL', { maximumFractionDigits: 1 })}%`;
}

function num(value?: number) {
  return (value || 0).toLocaleString('es-CL');
}

export default function DashboardPage() {
  const [data, setData] = useState<DoraData | null>(null);
  const [year, setYear] = useState('all');
  const [month, setMonth] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError('');
        const url = year === 'all' ? '/api/dora' : `/api/dora?year=${encodeURIComponent(year)}`;
        const res = await fetch(url, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || 'No fue posible cargar DORA');
        setData(json);
      } catch (err: any) {
        setError(err?.message || 'Error cargando DORA');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [year]);

  const years = useMemo(() => data?.years?.map((y) => y.year) || ['2025', '2026'], [data]);

  const months = useMemo(() => {
    const all = data?.months || [];
    return year === 'all' ? all : all.filter((m) => m.month.startsWith(`${year}-`));
  }, [data, year]);

  const availableMonths = useMemo(() => {
    return Array.from(new Set(months.map((m) => m.month.split('-')[1]))).filter(Boolean).sort();
  }, [months]);

  const selectedMonths = useMemo(() => {
    return month === 'all' ? months : months.filter((m) => m.month.endsWith(`-${month}`));
  }, [months, month]);

  const displayMetrics = useMemo(() => {
    if (!data?.metrics) return null;
    if (month === 'all') return data.metrics;

    const deployments = selectedMonths.reduce((s, m) => s + (m.deployments || 0), 0);
    const failures = selectedMonths.reduce((s, m) => s + (m.failures || 0), 0);
    const rate = deployments ? Number(((failures / deployments) * 100).toFixed(1)) : 0;
    return { ...data.metrics, deployments, failures, changeFailureRate: rate, successRate: Number((100 - rate).toFixed(1)) };
  }, [data, selectedMonths, month]);

  const topCelulas = data?.top?.celulas || [];
  const rawSystems = data?.top?.sistemas || [];
  const topSistemas = rawSystems.filter((s) => s.name !== 'Sin sistema');
  const sinSistema = rawSystems.find((s) => s.name === 'Sin sistema')?.count || 0;
  const sistemasToShow = topSistemas.length ? topSistemas : rawSystems;

  const maxDeploy = Math.max(1, ...months.map((m) => m.deployments || 0));
  const maxFailure = Math.max(1, ...months.map((m) => m.failureRate || 0));
  const maxCelula = Math.max(1, ...topCelulas.map((i) => i.count || 0));
  const maxSistema = Math.max(1, ...sistemasToShow.map((i) => i.count || 0));

  return (
    <main className="page">
      <header className="hero">
        <div className="brand">
          <strong>klap</strong>
          <div>
            <b>DORA · RELEASE MANAGEMENT</b>
            <span>Jira PAP como fuente oficial · Dashboard V2</span>
          </div>
        </div>

        <section className="heroGrid">
          <div>
            <p className="kicker">Lectura ejecutiva</p>
            <h1>Entregas a producción con control y trazabilidad</h1>
            <p className="lead">Velocidad, calidad, riesgo operativo y tendencias mensuales del flujo de cambios.</p>
          </div>
          <div className="executive">
            <span>Resumen</span>
            <strong>{loading ? 'Cargando…' : pct(displayMetrics?.successRate)}</strong>
            <p>{num(displayMetrics?.deployments)} despliegues · {pct(displayMetrics?.changeFailureRate)} failure rate · {num(displayMetrics?.failures)} fallas.</p>
          </div>
        </section>
      </header>

      <section className="filters">
        <div>
          <p className="kicker">Filtro de período</p>
          <h2>{year === 'all' ? 'Todos los años' : year}{month !== 'all' ? ` · ${MONTHS[Number(month) - 1]}` : ''}</h2>
          <p>Filtra por año y mes usando los datos que ya entrega /api/dora.</p>
        </div>
        <div className="filterButtons">
          <button className={year === 'all' ? 'active' : ''} onClick={() => { setYear('all'); setMonth('all'); }}>Todos</button>
          {years.map((y) => <button key={y} className={year === y ? 'active' : ''} onClick={() => { setYear(y); setMonth('all'); }}>{y}</button>)}
        </div>
      </section>

      <section className="monthFilters">
        <button className={month === 'all' ? 'active' : ''} onClick={() => setMonth('all')}>Todos los meses</button>
        {availableMonths.map((m) => <button key={m} className={month === m ? 'active' : ''} onClick={() => setMonth(m)}>{MONTHS[Number(m) - 1]}</button>)}
      </section>

      {error ? <section className="error">{error}</section> : null}

      <section className="metrics">
        <Metric label="Volumen" title="Deployments" value={num(displayMetrics?.deployments)} note="Cambios con Fecha Deploy." />
        <Metric label="Lead Time" title="Mediana de salida" value={`${displayMetrics?.medianLeadTimeDays || 0} días`} note="Inicio → Deploy." />
        <Metric label="Calidad" title="Success Rate" value={pct(displayMetrics?.successRate)} note="Cambios sin falla." />
        <Metric label="Riesgo" title="Change Failure Rate" value={pct(displayMetrics?.changeFailureRate)} note={`${num(displayMetrics?.failures)} con falla.`} />
        <Metric label="Rollback" title="Rollback Rate" value={pct(displayMetrics?.rollbackRate)} note={`${num(displayMetrics?.rollbacks)} rollbacks.`} />
      </section>

      <section className="grid">
        <Panel title="Tendencia mensual de deployments" tag="Volumen">
          <div className="monthBars">
            {months.map((item) => {
              const [, m] = item.month.split('-');
              const active = month === 'all' || month === m;
              return (
                <div className={active ? 'monthBar activeMonth' : 'monthBar'} key={item.month}>
                  <span>{MONTHS[Number(m) - 1]} {item.month.slice(2, 4)}</span>
                  <b>{item.deployments}</b>
                  <div><i style={{ height: `${Math.max(6, (item.deployments / maxDeploy) * 100)}%` }} /></div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Tendencia mensual de Failure Rate" tag="Calidad">
          <div className="trendRows">
            {months.map((item) => {
              const [, m] = item.month.split('-');
              const active = month === 'all' || month === m;
              return (
                <div className={active ? 'trendRow activeTrend' : 'trendRow'} key={item.month}>
                  <span>{MONTHS[Number(m) - 1]} {item.month.slice(0, 4)}</span>
                  <div><i style={{ width: `${Math.max(2, (item.failureRate / maxFailure) * 100)}%` }} /></div>
                  <b>{pct(item.failureRate)}</b>
                </div>
              );
            })}
          </div>
        </Panel>
      </section>

      <section className="grid">
        <Panel title="Top células" tag="Fallas / Volumen">
          <RankList items={topCelulas} max={maxCelula} />
        </Panel>

        <Panel title="Top sistemas" tag="Producto / Plataforma">
          {sinSistema > 0 ? <div className="warning">{num(sinSistema)} tickets históricos están sin Sistema. Los nuevos PAP creados por el portal ya vienen mejor trazados.</div> : null}
          <RankList items={sistemasToShow} max={maxSistema} />
        </Panel>
      </section>

      <section className="grid">
        <Panel title="Categoría de cambio" tag="Mix operativo">
          <SimpleRows items={data?.top?.categorias || []} />
        </Panel>

        <Panel title="Resultado Deploy" tag="Calidad">
          <SimpleRows items={data?.top?.resultados || []} />
        </Panel>
      </section>

      <section className="grid">
        <Panel title="Insights ejecutivos" tag="Lectura">
          <ol className="insights">
            {(data?.insights || []).map((item, index) => <li key={index}><span>{index + 1}</span>{item}</li>)}
          </ol>
        </Panel>

        <Panel title="Últimos registros consultados" tag="Jira PAP">
          <div className="samples">
            {(data?.sample || []).slice(0, 8).map((item) => (
              <div className="sample" key={item.key}>
                <b>{item.key}</b>
                <span>{item.summary}</span>
                <em>{item.resultado}</em>
                <small>{item.categoria}</small>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <style jsx global>{`
        *{box-sizing:border-box}html,body{margin:0}body{background:var(--bg)}
        .page{min-height:100vh;background:var(--bg);color:var(--ink);font-family:var(--font);position:relative;padding:32px 5vw 70px}
        .page::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,var(--green) 0%,var(--green-d) 50%,var(--navy) 100%)}
        .hero,.filters,.monthFilters,.metrics,.grid,.error{max-width:1320px;margin-left:auto;margin-right:auto}
        .brand{display:flex;align-items:center;gap:18px;margin-bottom:34px}.brand>strong{font-size:38px;font-weight:950;color:var(--green);letter-spacing:-.06em}.brand b{display:block;color:var(--navy);font-size:11px;letter-spacing:.14em;font-weight:900}.brand span{color:var(--ink-soft);font-weight:700;font-size:13px}
        .heroGrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(340px,.6fr);gap:28px;align-items:center}.kicker{margin:0 0 10px;color:var(--green-d);font-size:12px;font-weight:950;letter-spacing:.18em;text-transform:uppercase}h1{margin:0;font-size:clamp(36px,4.5vw,64px);line-height:.95;letter-spacing:-.05em}.lead{color:var(--ink-soft);font-size:18px;line-height:1.5;max-width:750px;margin:18px 0 0}
        .executive{background:linear-gradient(135deg,#013356 0%,#02568c 55%,#005a4e 100%);color:white;border-radius:22px;padding:32px;box-shadow:0 20px 60px rgba(7,59,93,.2);display:flex;flex-direction:column;justify-content:center;position:relative;overflow:hidden}.executive::before{content:'';position:absolute;top:-30%;right:-20%;width:60%;height:100%;border-radius:50%;background:radial-gradient(circle,rgba(0,193,110,.15) 0%,transparent 70%)}.executive span{color:#8fd8ff;font-size:11px;letter-spacing:.18em;font-weight:950;text-transform:uppercase;position:relative}.executive strong{color:#00e587;font-size:44px;letter-spacing:-.05em;margin:10px 0 12px;position:relative}.executive p{margin:0;color:#dff2ff;line-height:1.5;position:relative;font-size:14px}
        .filters,.monthFilters,.metric,.panel,.error{background:white;border:1px solid var(--line);border-radius:var(--radius-lg);box-shadow:var(--shadow-sm)}.filters{margin-top:28px;padding:22px 26px;display:flex;justify-content:space-between;align-items:center;gap:20px}.filters h2{margin:0 0 6px;font-size:24px;letter-spacing:-.03em}.filters p{margin:0;color:var(--ink-soft);font-size:14px}.filterButtons,.monthFilters{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end}.filterButtons button,.monthFilters button{border:1px solid var(--line);background:white;color:var(--ink);font-weight:800;border-radius:var(--radius-pill);padding:10px 16px;cursor:pointer;font-size:13px;transition:all .15s}.filterButtons button:hover,.monthFilters button:hover{background:var(--bg);border-color:var(--green)}.filterButtons button.active,.monthFilters button.active{background:var(--green);color:white;border-color:var(--green);box-shadow:0 3px 10px rgba(0,193,110,.3)}.monthFilters{margin-top:14px;padding:14px 18px;justify-content:flex-start}
        .metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px;margin-top:22px}.metric{padding:22px;min-height:160px;transition:box-shadow .2s,transform .2s}.metric:hover{box-shadow:var(--shadow-md);transform:translateY(-2px)}.metricLabel{color:var(--ink-soft);font-size:11px;letter-spacing:.16em;font-weight:900;text-transform:uppercase}.metric h3{margin:12px 0 18px;font-size:15px;font-weight:800}.metric strong{display:block;font-size:38px;letter-spacing:-.05em;color:var(--navy-d)}.metric p{color:var(--ink-soft);margin:10px 0 0;font-size:13px}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px}.panel{padding:24px;min-height:260px;transition:box-shadow .2s}.panel:hover{box-shadow:var(--shadow-md)}.panelHead{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.panelHead h2{margin:0;font-size:22px;letter-spacing:-.03em;font-weight:800}.panelHead span{background:#ecf7ff;color:var(--navy);border-radius:var(--radius-pill);padding:7px 12px;font-weight:900;font-size:11px;white-space:nowrap;letter-spacing:.04em}
        .monthBars{display:grid;grid-template-columns:repeat(12,1fr);gap:8px;align-items:end;min-height:240px}.monthBar{opacity:.3;display:grid;grid-template-rows:auto auto 1fr;gap:6px;text-align:center;transition:opacity .2s}.monthBar.activeMonth{opacity:1}.monthBar span{font-size:11px;color:var(--ink-soft);font-weight:800}.monthBar b{font-size:13px;font-weight:900}.monthBar div{height:160px;background:var(--bg);border-radius:10px;display:flex;align-items:end;padding:0 6px}.monthBar i{width:100%;display:block;border-radius:8px 8px 0 0;background:linear-gradient(180deg,var(--green),var(--green-d));min-height:6px;transition:height .3s}
        .trendRows,.rankList,.rowsList,.samples{display:grid;gap:8px}.trendRow,.rankRow,.simpleRow,.sample{background:var(--bg);border:1px solid var(--line-soft);border-radius:12px;padding:12px 14px}.trendRow{display:grid;grid-template-columns:80px 1fr 55px;gap:10px;align-items:center;opacity:.4;transition:opacity .2s}.trendRow.activeTrend{opacity:1}.trendRow div{height:8px;background:#e5eef3;border-radius:999px;overflow:hidden}.trendRow i{display:block;height:100%;background:linear-gradient(90deg,var(--green),var(--green-d));border-radius:999px}.trendRow span,.trendRow b{font-size:12px;font-weight:800}
        .rankRow{display:grid;grid-template-columns:minmax(0,1fr) 65px;gap:12px;align-items:center}.rankName{font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}.rankValue{text-align:right;font-weight:900;font-size:14px}.rankBar{grid-column:1/-1;height:7px;background:#e5eef3;border-radius:999px;overflow:hidden}.rankBar i{display:block;height:100%;background:linear-gradient(90deg,var(--green),var(--green-d));border-radius:999px;transition:width .4s}.warning{background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:12px;padding:12px;margin-bottom:12px;font-weight:800;font-size:13px}.simpleRow{display:flex;justify-content:space-between;gap:12px;align-items:center}.simpleRow b{color:var(--ink);font-size:13px}.simpleRow span{font-weight:900;font-size:14px;color:var(--navy-d)}.insights{margin:0;padding:0;list-style:none;display:grid;gap:8px}.insights li{background:var(--bg);border:1px solid var(--line-soft);border-radius:12px;padding:13px 14px;display:flex;gap:12px;color:#315873;font-size:14px;line-height:1.45}.insights span{width:26px;height:26px;border-radius:999px;background:var(--green-soft);color:var(--green-d);display:flex;align-items:center;justify-content:center;font-weight:950;flex:0 0 auto;font-size:12px}
        .sample{display:grid;grid-template-columns:85px minmax(0,1fr) 110px 110px;gap:12px;align-items:center;font-size:13px}.sample b{color:var(--navy);font-weight:800}.sample span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sample em,.sample small{font-style:normal;font-weight:800;color:var(--ink-soft)}.empty{color:var(--ink-soft);padding:14px;text-align:center}.error{margin-top:20px;padding:18px;color:#b42318;background:#fff5f5;border-color:#fecaca}
        @media(max-width:1100px){.heroGrid,.grid{grid-template-columns:1fr}.metrics{grid-template-columns:repeat(2,1fr)}.monthBars{grid-template-columns:repeat(6,1fr)}}@media(max-width:760px){.page{padding:20px 16px 50px}.filters{flex-direction:column;align-items:flex-start}.filterButtons{justify-content:flex-start}.metrics{grid-template-columns:1fr}h1{font-size:36px}.lead{font-size:15px}.monthBars{grid-template-columns:repeat(3,1fr)}.sample{grid-template-columns:1fr}}
      `}</style>
    </main>
  );
}

function Metric({ label, title, value, note }: { label: string; title: string; value: string; note: string }) {
  return <article className="metric"><span className="metricLabel">{label}</span><h3>{title}</h3><strong>{value}</strong><p>{note}</p></article>;
}

function Panel({ title, tag, children }: { title: string; tag: string; children: React.ReactNode }) {
  return <section className="panel"><div className="panelHead"><h2>{title}</h2><span>{tag}</span></div>{children}</section>;
}

function RankList({ items, max }: { items: TopItem[]; max: number }) {
  if (!items.length) return <div className="empty">Sin datos disponibles.</div>;
  return <div className="rankList">{items.slice(0, 8).map((item) => <div className="rankRow" key={item.name}><div className="rankName">{item.name}</div><div className="rankValue">{item.count.toLocaleString('es-CL')}</div><div className="rankBar"><i style={{ width: `${Math.max(4, (item.count / max) * 100)}%` }} /></div></div>)}</div>;
}

function SimpleRows({ items }: { items: TopItem[] }) {
  if (!items.length) return <div className="empty">Sin datos disponibles.</div>;
  return <div className="rowsList">{items.slice(0, 8).map((item) => <div className="simpleRow" key={item.name}><b>{item.name}</b><span>{item.count.toLocaleString('es-CL')}</span></div>)}</div>;
}
