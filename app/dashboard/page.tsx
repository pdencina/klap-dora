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
        *{box-sizing:border-box}html,body{margin:0}body{background:#f2f7fa}
        .page{min-height:100vh;background:#f2f7fa;color:#073b5d;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;border-top:6px solid #00c16e;padding:28px 6vw 70px}
        .hero,.filters,.monthFilters,.metrics,.grid,.error{max-width:1320px;margin-left:auto;margin-right:auto}
        .brand{display:flex;align-items:center;gap:18px;margin-bottom:32px}.brand>strong{font-size:40px;font-weight:950;color:#00c16e;letter-spacing:-.08em}.brand b{display:block;color:#02568c;font-size:12px;letter-spacing:.12em}.brand span{color:#557086;font-weight:700}
        .heroGrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,.65fr);gap:28px}.kicker{margin:0 0 10px;color:#00a967;font-size:13px;font-weight:950;letter-spacing:.18em;text-transform:uppercase}h1{margin:0;font-size:clamp(44px,5.2vw,78px);line-height:.92;letter-spacing:-.07em}.lead{color:#557086;font-size:21px;line-height:1.45;max-width:850px;margin:22px 0 0}
        .executive{background:linear-gradient(135deg,#073b5d,#02568c 55%,#006b6b);color:white;border-radius:24px;padding:34px;box-shadow:0 28px 70px rgba(7,59,93,.18);display:flex;flex-direction:column;justify-content:center}.executive span{color:#8fd8ff;font-size:12px;letter-spacing:.18em;font-weight:950;text-transform:uppercase}.executive strong{color:#00e587;font-size:42px;letter-spacing:-.05em;margin:10px 0 12px}.executive p{margin:0;color:#effbff;line-height:1.45}
        .filters,.monthFilters,.metric,.panel,.error{background:white;border:1px solid #dfeaf0;border-radius:22px;box-shadow:0 18px 45px rgba(7,59,93,.07)}.filters{margin-top:28px;padding:22px;display:flex;justify-content:space-between;align-items:center;gap:20px}.filters h2{margin:0 0 6px;font-size:26px;letter-spacing:-.04em}.filters p{margin:0;color:#557086}.filterButtons,.monthFilters{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end}.filterButtons button,.monthFilters button{border:1px solid #cfe1ec;background:#f7fbfd;color:#073b5d;font-weight:900;border-radius:999px;padding:12px 18px;cursor:pointer}.filterButtons button.active,.monthFilters button.active{background:#00c16e;color:white;border-color:#00c16e}.monthFilters{margin-top:14px;padding:14px;justify-content:flex-start}
        .metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:16px;margin-top:22px}.metric{padding:22px;min-height:170px}.metricLabel{color:#6b8398;font-size:12px;letter-spacing:.18em;font-weight:950;text-transform:uppercase}.metric h3{margin:14px 0 22px;font-size:17px}.metric strong{display:block;font-size:40px;letter-spacing:-.06em}.metric p{color:#6b8398;margin:12px 0 0}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px}.panel{padding:22px;min-height:260px}.panelHead{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.panelHead h2{margin:0;font-size:25px;letter-spacing:-.04em}.panelHead span{background:#ecf7ff;color:#02568c;border-radius:999px;padding:8px 12px;font-weight:950;font-size:12px;white-space:nowrap}
        .monthBars{display:grid;grid-template-columns:repeat(12,1fr);gap:10px;align-items:end;min-height:250px}.monthBar{opacity:.35;display:grid;grid-template-rows:auto auto 1fr;gap:8px;text-align:center}.monthBar.activeMonth{opacity:1}.monthBar span{font-size:12px;color:#557086;font-weight:900}.monthBar b{font-size:14px}.monthBar div{height:160px;background:#f1f6f9;border-radius:12px;display:flex;align-items:end;padding:0 8px}.monthBar i{width:100%;display:block;border-radius:8px 8px 0 0;background:#00c16e;min-height:6px}
        .trendRows,.rankList,.rowsList,.samples{display:grid;gap:10px}.trendRow,.rankRow,.simpleRow,.sample{background:#f8fbfd;border:1px solid #e5eef3;border-radius:14px;padding:12px}.trendRow{display:grid;grid-template-columns:90px 1fr 60px;gap:10px;align-items:center;opacity:.45}.trendRow.activeTrend{opacity:1}.trendRow div{height:10px;background:#e9f2f6;border-radius:999px;overflow:hidden}.trendRow i{display:block;height:100%;background:#00c16e;border-radius:999px}.trendRow span,.trendRow b{font-size:13px}
        .rankRow{display:grid;grid-template-columns:minmax(0,1fr) 70px;gap:12px;align-items:center}.rankName{font-weight:900;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.rankValue{text-align:right;font-weight:950}.rankBar{grid-column:1/-1;height:9px;background:#e9f2f6;border-radius:999px;overflow:hidden}.rankBar i{display:block;height:100%;background:#00c16e;border-radius:999px}.warning{background:#fff7e6;border:1px solid #ffecbd;color:#8a6100;border-radius:14px;padding:12px;margin-bottom:12px;font-weight:800}.simpleRow{display:flex;justify-content:space-between;gap:12px}.simpleRow b{color:#073b5d}.simpleRow span{font-weight:950}.insights{margin:0;padding:0;list-style:none;display:grid;gap:10px}.insights li{background:#f8fbfd;border:1px solid #e5eef3;border-radius:14px;padding:12px;display:flex;gap:12px;color:#315873}.insights span{width:26px;height:26px;border-radius:999px;background:#e8fff3;color:#008f57;display:flex;align-items:center;justify-content:center;font-weight:950;flex:0 0 auto}
        .sample{display:grid;grid-template-columns:90px minmax(0,1fr) 120px 120px;gap:12px;align-items:center}.sample b{color:#02568c}.sample span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sample em,.sample small{font-style:normal;font-weight:800;color:#557086}.empty{color:#557086;padding:14px}.error{margin-top:20px;padding:18px;color:#b42318;background:#fff1f0;border-color:#ffd6d2}
        @media(max-width:1100px){.heroGrid,.grid{grid-template-columns:1fr}.metrics{grid-template-columns:repeat(2,1fr)}.monthBars{grid-template-columns:repeat(6,1fr)}}@media(max-width:760px){.page{padding:20px 18px 50px}.filters{flex-direction:column;align-items:flex-start}.filterButtons{justify-content:flex-start}.metrics{grid-template-columns:1fr}h1{font-size:42px}.lead{font-size:16px}.monthBars{grid-template-columns:repeat(3,1fr)}.sample{grid-template-columns:1fr}}
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
