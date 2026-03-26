import React from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
    Filler,
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import { AreaChart, Area, ComposedChart, Line as RechartsLine, BarChart as RechartsBarChart, Bar as RechartsBar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend as RechartsLegend, ResponsiveContainer, Cell, LabelList, ReferenceLine } from 'recharts';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

export function TimelineChart({ data }) {
    if (!data || !data.series) return null;

    const allZero = data.series.every(s => s.receita === 0 && s.despesa === 0);
    if (allZero) {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '0.9rem', marginBottom: '4px' }}>📊 Sem dados para exibir</p>
                <p style={{ fontSize: '0.75rem' }}>Adicione lançamentos para ver o gráfico.</p>
            </div>
        );
    }

    const chartData = {
        labels: data.series.map(s => s.mes),
        datasets: [
            {
                label: 'Receitas',
                data: data.series.map(s => s.receita || 0),
                backgroundColor: 'rgba(16, 185, 129, 0.75)',
                borderColor: '#10b981',
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.7,
                categoryPercentage: 0.6,
            },
            {
                label: 'Despesas',
                data: data.series.map(s => s.despesa || 0),
                backgroundColor: 'rgba(239, 68, 68, 0.75)',
                borderColor: '#ef4444',
                borderWidth: 1,
                borderRadius: 4,
                barPercentage: 0.7,
                categoryPercentage: 0.6,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', labels: { color: '#a0a0ab', font: { family: 'Inter' }, usePointStyle: true, pointStyle: 'rect' } },
            tooltip: {
                backgroundColor: '#1c1c21',
                titleColor: '#fff',
                bodyColor: '#a0a0ab',
                borderColor: '#3f3f46',
                borderWidth: 1,
                callbacks: {
                    label: (ctx) => {
                        const val = ctx.parsed.y || 0;
                        return `${ctx.dataset.label}: R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                    }
                }
            },
        },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#a0a0ab', font: { size: 11 } } },
            y: {
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: {
                    color: '#a0a0ab',
                    callback: (v) => 'R$ ' + v.toLocaleString('pt-BR'),
                },
                beginAtZero: true,
            },
        },
    };

    return <Bar data={chartData} options={options} />;
}

export function MarketShareChart({ data }) {
    if (!data || !data.shares || data.shares.length === 0) {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '0.9rem', marginBottom: '4px' }}>🥧 Sem dados para exibir</p>
                <p style={{ fontSize: '0.75rem' }}>Adicione receitas para ver o market share.</p>
            </div>
        );
    }

    const colors = ['#7c4dff', '#00e5ff', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#3b82f6', '#06b6d4', '#14b8a6'];
    const chartData = {
        labels: data.shares.map(s => s.produto),
        datasets: [{
            data: data.shares.map(s => s.valor),
            backgroundColor: colors,
            borderWidth: 0,
        }],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: '#1c1c21', padding: 12 },
        },
        cutout: '70%',
    };

    return (
        <div style={{ display: 'flex', height: '100%', alignItems: 'center', gap: '20px' }}>
            <div style={{ height: '100%', width: '180px', flexShrink: 0 }}>
                <Doughnut data={chartData} options={options} />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {data.shares.map((s, i) => (
                    <div key={s.produto} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: colors[i % colors.length] }} />
                        <span style={{ color: 'var(--text-secondary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.produto}>{s.produto}</span>
                        <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{s.percentual}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

export function ExpenseBreakdownChart({ data }) {
    if (!data || !data.categorias || data.categorias.length === 0) {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '0.9rem', marginBottom: '4px' }}>🏷️ Sem despesas registradas</p>
                <p style={{ fontSize: '0.75rem' }}>Adicione despesas para ver a composição.</p>
            </div>
        );
    }

    const colors = ['#ef4444', '#f97316', '#f59e0b', '#ec4899', '#8b5cf6', '#6366f1', '#14b8a6', '#06b6d4', '#84cc16', '#a855f7'];
    const chartData = {
        labels: data.categorias.map(c => c.categoria),
        datasets: [{
            data: data.categorias.map(c => c.valor),
            backgroundColor: colors,
            borderWidth: 0,
        }],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: '#1c1c21', padding: 12 },
        },
        cutout: '70%',
    };

    return (
        <div style={{ display: 'flex', height: '100%', alignItems: 'center', gap: '20px' }}>
            <div style={{ height: '100%', width: '180px', flexShrink: 0 }}>
                <Doughnut data={chartData} options={options} />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {data.categorias.map((c, i) => (
                    <div key={c.categoria} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: colors[i % colors.length] }} />
                        <span style={{ color: 'var(--text-secondary)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={c.categoria}>{c.categoria}</span>
                        <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{c.percentual}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

const CustomLabel = (props) => {
    const { x, y, width, height, value, payload } = props;
    if (value === undefined || value === null) return null;

    // Use payload.margemReal if available, otherwise fallback to value
    const displayValue = payload && payload.margemReal !== undefined ? payload.margemReal : value;
    const isPositive = Number(displayValue) >= 0;

    return (
        <text
            x={Number(x) + Number(width) + (isPositive ? 5 : -5)}
            y={Number(y) + Number(height) / 2}
            fill="var(--text-primary)"
            fontSize={11}
            fontWeight="700"
            textAnchor={isPositive ? "start" : "end"}
            dominantBaseline="central"
        >
            {displayValue}%
        </text>
    );
};

export const MarginBarChart = ({ products = [] }) => {
    // Sort: descending by absolute profit (Receita - Custo) if possible, otherwise by margin
    const rawData = Array.isArray(products) ? products : [];
    
    // Safety processing of products
    const processedProducts = rawData.map(p => {
        const margem = Number(p?.margem) || Number(p?.margemRealizada) || 0;
        const receita = Number(p?.vendasTotal) || 0;
        const custo = Number(p?.custoTotal) || 0;
        const lucro = receita - custo;
        return {
            ...p,
            nome: p?.nome || p?.name || 'Sem nome',
            vendasTotal: receita,
            custoTotal: custo,
            lucro: lucro,
            margemReal: margem
        };
    });

    // Final sorting
    const sorted = processedProducts.sort((a, b) => b.lucro - a.lucro);

    if (sorted.length === 0) {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '0.9rem', marginBottom: '4px' }}>📊 Sem dados de margem</p>
                <p style={{ fontSize: '0.75rem' }}>Lance receitas e despesas para ver a análise.</p>
            </div>
        );
    }

    // Clamp extreme values to ±100% for display axis, but show real value in label/tooltip
    const CLAMP = 100;
    const chartData = sorted.map(p => ({
        ...p,
        margemDisplay: Math.max(-CLAMP, Math.min(CLAMP, p.margemReal)),
        isClamped: Math.abs(p.margemReal) > CLAMP,
        color: p.margemReal >= 0 ? 'var(--revenue)' : 'var(--expense)'
    }));

    const hasOutlier = chartData.some(d => d.isClamped);

    const CustomMarginTooltip = ({ active, payload }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            const fmtN = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
            return (
                <div style={{ backgroundColor: '#1c1c21', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', minWidth: '200px' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '6px' }}>{data.nome}</p>
                    <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#a0a0ab' }}>Receita: <span style={{ color: 'var(--revenue)', fontWeight: 'bold' }}>{fmtN(data.vendasTotal)}</span></p>
                    <p style={{ margin: '0 0 4px 0', fontSize: '12px', color: '#a0a0ab' }}>Custo: <span style={{ color: 'var(--expense)', fontWeight: 'bold' }}>{fmtN(data.custoTotal)}</span></p>
                    <p style={{ margin: 0, fontSize: '12px', color: '#a0a0ab' }}>
                        Margem: <span style={{ color: data.margemReal >= 0 ? 'var(--revenue)' : 'var(--expense)', fontWeight: 'bold' }}>{data.margemReal}%</span>
                        {data.isClamped && <span style={{ color: '#f59e0b', fontSize: '10px', marginLeft: '6px' }}>(escala limitada)</span>}
                    </p>
                </div>
            );
        }
        return null;
    };



    return (
        <div style={{ height: '100%' }}>
            {hasOutlier && (
                <p style={{ fontSize: '0.7rem', color: '#f59e0b', textAlign: 'right', marginBottom: '4px', paddingRight: '8px' }}>
                    * Valores fora da escala (±200%) — veja o tooltip para o valor real
                </p>
            )}
            <div style={{ height: hasOutlier ? 'calc(100% - 20px)' : '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={chartData} layout="vertical" margin={{ top: 10, right: 100, bottom: 10, left: 10 }} barCategoryGap="25%">
                        <defs>
                            <linearGradient id="emeraldGradient" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#059669" />
                                <stop offset="100%" stopColor="#10b981" />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={true} vertical={false} />
                        <XAxis type="number" domain={[-CLAMP, CLAMP]} stroke="#a0a0ab" tick={{ fill: '#a0a0ab', fontSize: 12 }} tickFormatter={v => v + '%'} />
                        <YAxis dataKey="nome" type="category" width={130} stroke="#a0a0ab" tick={{ fill: '#a0a0ab', fontSize: 12, fontWeight: '600' }} />
                        <RechartsTooltip content={<CustomMarginTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                        <ReferenceLine x={0} stroke="rgba(255,255,255,0.2)" strokeWidth={1} />
                        <RechartsBar dataKey="margemDisplay" radius={[0, 4, 4, 0]} label={<CustomLabel />} isAnimationActive={true}>
                            {chartData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.margemDisplay >= 0
                                        ? 'url(#emeraldGradient)'
                                        : entry.isClamped ? '#7f1d1d' : '#ef4444'}
                                />
                            ))}
                        </RechartsBar>
                    </RechartsBarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

// ── NEW: Revenue vs Expense line chart (date-grouped, sorted) ──
export function RevenueExpenseLineChart({ transacoes }) {
    if (!transacoes || transacoes.length === 0) {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '0.9rem', marginBottom: '4px' }}>📈 Sem lançamentos para exibir</p>
                <p style={{ fontSize: '0.75rem' }}>Adicione receitas e despesas para ver o gráfico.</p>
            </div>
        );
    }

    // 1. Group by date with reduce — sum receita and despesa per day
    const grouped = transacoes
        .filter(t => t.data_transacao && t.status_pagamento !== 'CANCELADO')
        .reduce((acc, t) => {
            const rawDate = t.data_transacao.slice(0, 10); // YYYY-MM-DD
            if (!acc[rawDate]) acc[rawDate] = { rawDate, receita: 0, despesa: 0 };
            if (t.tipo === 'RECEITA') acc[rawDate].receita += (t.valor || 0);
            if (t.tipo === 'DESPESA') acc[rawDate].despesa += (t.valor || 0);
            return acc;
        }, {});

    // 2. Sort chronologically (oldest → newest) by comparing ISO date strings
    const series = Object.values(grouped).sort((a, b) =>
        a.rawDate.localeCompare(b.rawDate)
    ).map(d => ({
        data: d.rawDate.slice(5).replace('-', '/'), // MM/DD → DD/MM visual
        receita: +d.receita.toFixed(2),
        despesa: +d.despesa.toFixed(2),
        rawDate: d.rawDate,
    }));

    const fmt = (v) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const item = payload[0]?.payload;
            const [y, m, dd] = (item?.rawDate || '').split('-');
            const dateLabel = item?.rawDate ? `${dd}/${m}/${y}` : label;
            return (
                <div style={{ backgroundColor: '#1c1c21', border: '1px solid rgba(255,255,255,0.1)', padding: '12px', borderRadius: '8px', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 'bold', color: '#a0a0ab' }}>{dateLabel}</p>
                    {payload.map((entry, i) => (
                        <p key={i} style={{ margin: '3px 0', fontSize: '13px' }}>
                            <span style={{ color: entry.color }}>●</span> {entry.name}: <strong>{fmt(entry.value)}</strong>
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <defs>
                    <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradDespesa" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                    dataKey="data"
                    stroke="#a0a0ab"
                    tick={{ fill: '#a0a0ab', fontSize: 11 }}
                    dy={6}
                    minTickGap={24}
                />
                <YAxis
                    stroke="#a0a0ab"
                    tick={{ fill: '#a0a0ab', fontSize: 11 }}
                    tickFormatter={v => v === 0 ? 'R$0' : `R$${(v / 1000).toFixed(0)}k`}
                    domain={[0, 'auto']}
                />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} />
                <RechartsLegend wrapperStyle={{ color: '#a0a0ab', fontFamily: 'Inter', paddingTop: '10px', fontSize: '13px' }} />
                <Area type="monotone" dataKey="receita" name="Receita" stroke="#10b981" strokeWidth={2.5} fill="url(#gradReceita)" dot={false} activeDot={{ r: 5, fill: '#10b981', strokeWidth: 0 }} />
                <Area type="monotone" dataKey="despesa" name="Despesa" stroke="#ef4444" strokeWidth={2.5} fill="url(#gradDespesa)" dot={false} activeDot={{ r: 5, fill: '#ef4444', strokeWidth: 0 }} />
            </ComposedChart>
        </ResponsiveContainer>
    );
}

export function PatrimonioLineChart({ data }) {
    if (!data || !data.series || data.series.length === 0) {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '0.9rem', marginBottom: '4px' }}>📈 Sem dados de patrimônio</p>
                <p style={{ fontSize: '0.75rem' }}>Adicione lançamentos para ver a evolução.</p>
            </div>
        );
    }

    const chartData = {
        labels: data.series.map(s => s.mes),
        datasets: [{
            label: 'Patrimônio Líquido',
            data: data.series.map(s => s.patrimonio),
            borderColor: '#7c4dff',
            backgroundColor: 'rgba(124, 77, 255, 0.1)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: data.series.map(s => s.patrimonio >= 0 ? '#10b981' : '#ef4444'),
            pointBorderColor: data.series.map(s => s.patrimonio >= 0 ? '#10b981' : '#ef4444'),
            pointRadius: 4,
        }],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#1c1c21',
                titleColor: '#fff',
                bodyColor: '#a0a0ab',
                callbacks: {
                    label: (ctx) => `Patrimônio: R$ ${ctx.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                }
            },
        },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#a0a0ab', font: { size: 11 } } },
            y: {
                grid: { color: 'rgba(255, 255, 255, 0.05)' },
                ticks: {
                    color: '#a0a0ab',
                    callback: v => 'R$ ' + (v / 1000).toFixed(0) + 'k'
                }
            },
        },
    };

    return <Line data={chartData} options={options} />;
}

export function BalancoBarChart({ ativos, passivos }) {
    const chartData = {
        labels: ['Ativos', 'Passivos'],
        datasets: [{
            data: [ativos, passivos],
            backgroundColor: ['rgba(16, 185, 129, 0.7)', 'rgba(239, 68, 68, 0.7)'],
            borderColor: ['#10b981', '#ef4444'],
            borderWidth: 1,
            borderRadius: 8,
            barPercentage: 0.5,
        }],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#1c1c21',
                callbacks: {
                    label: (ctx) => `R$ ${ctx.parsed.x.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                }
            },
        },
        scales: {
            x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a0a0ab', callback: v => 'R$ ' + v.toLocaleString('pt-BR') } },
            y: { grid: { display: false }, ticks: { color: '#a0a0ab', font: { size: 14, weight: '600' } } },
        },
    };

    return <Bar data={chartData} options={options} />;
}

export function FluxoCaixaChart({ data }) {
    if (!data || !data.series || data.series.length === 0) {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '0.9rem', marginBottom: '4px' }}>📉 Sem dados para exibir</p>
                <p style={{ fontSize: '0.75rem' }}>Adicione lançamentos para ver o fluxo de caixa.</p>
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data.series} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <defs>
                    <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" vertical={false} />
                <XAxis
                    dataKey="timestamp"
                    scale="time"
                    type="number"
                    domain={['dataMin', 'dataMax']}
                    stroke="#a0a0ab"
                    tick={{ fill: '#a0a0ab', fontSize: 11 }}
                    dy={5}
                    minTickGap={20}
                    tickFormatter={(unixTime) => new Date(unixTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                />
                <YAxis
                    stroke="#a0a0ab"
                    tick={{ fill: '#a0a0ab', fontSize: 11 }}
                    domain={['auto', 'auto']}
                    tickFormatter={(v) => v === 0 ? 'R$ 0' : `R$ ${(v / 1000).toFixed(0)}k`}
                />
                <RechartsTooltip
                    cursor={{ stroke: 'rgba(255, 255, 255, 0.1)', strokeWidth: 1 }}
                    contentStyle={{ backgroundColor: '#1c1c21', borderColor: 'rgba(255, 255, 255, 0.1)', color: '#fff', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                    labelFormatter={(unixTime) => new Date(unixTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    formatter={(value, name) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, name]}
                />
                <RechartsLegend wrapperStyle={{ color: '#a0a0ab', fontFamily: 'Inter', paddingTop: '10px' }} />
                <RechartsLine type="monotone" dataKey="receitasPrevistas" name="Receitas" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: '#10b981', strokeWidth: 0 }} />
                <RechartsLine type="monotone" dataKey="despesasPrevistas" name="Despesas" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 5, fill: '#ef4444', strokeWidth: 0 }} />
                <Area type="monotone" dataKey="saldo" name="Saldo" stroke="#8b5cf6" strokeWidth={2} fill="url(#gradSaldo)" dot={false} activeDot={{ r: 5, fill: '#8b5cf6', strokeWidth: 0 }} />
            </ComposedChart>
        </ResponsiveContainer>
    );
}

export function EficienciaChart({ data }) {
    if (!data || data.length === 0) {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '0.9rem', marginBottom: '4px' }}>📦 Sem dados de produção</p>
                <p style={{ fontSize: '0.75rem' }}>Registre produção para ver o gráfico de volume.</p>
            </div>
        );
    }

    // Calculate 5-day moving average ignoring 0 to prevent harsh dips
    const processedData = data.map((d, index, arr) => {
        let sum = 0;
        let count = 0;
        for (let i = Math.max(0, index - 4); i <= index; i++) {
            if (arr[i].quantidade > 0) {
                sum += arr[i].quantidade;
                count++;
            }
        }
        return {
            ...d,
            tendencia: count > 0 ? +(sum / count).toFixed(0) : null
        };
    });

    // Custom Tooltip Renderer
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const dateStr = label ? new Date(label).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '';
            return (
                <div style={{ backgroundColor: '#1c1c21', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '12px', borderRadius: '8px', color: '#fff', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
                    <p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>
                        Data: <span style={{ color: '#22d3ee' }}>{dateStr}</span>
                    </p>
                    {payload.map((entry, index) => {
                        const isVol = entry.name === 'Volume Produzido';
                        const valFormat = `${Number(entry.value).toLocaleString('pt-BR')}`;
                        return (
                            <p key={index} style={{ margin: '4px 0', fontSize: '13px' }}>
                                <span style={{ color: '#a0a0ab' }}>{isVol ? 'Volume:' : 'Tendência:'}</span>{' '}
                                <span style={{ fontWeight: 'bold' }}>{valFormat} {isVol ? 'un.' : '(calculado)'}</span>
                            </p>
                        );
                    })}
                </div>
            );
        }
        return null;
    };

    return (
        <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={processedData} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                <XAxis
                    dataKey="label"
                    stroke="#a0a0ab"
                    tick={{ fill: '#a0a0ab', fontSize: 11 }}
                    dy={10}
                    minTickGap={20}
                />
                <YAxis
                    stroke="#a0a0ab"
                    tick={{ fill: '#a0a0ab', fontSize: 11 }}
                    tickCount={5}
                    tickFormatter={(v) => v.toLocaleString('pt-BR')}
                />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} />
                
                <RechartsBar dataKey="quantidade" name="Volume Produzido" fill="#06b6d4" radius={[4, 4, 0, 0]} maxBarSize={50} />
                <RechartsLine type="linear" dataKey="quantidade" name="Tendência" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }} isAnimationActive={true} connectNulls={true} />
            </ComposedChart>
        </ResponsiveContainer>
    );
}

export function CustoUnidadeChart({ data }) {
    if (!data || data.length === 0) {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '0.9rem', marginBottom: '4px' }}>⚙️ Sem dados de produção</p>
                <p style={{ fontSize: '0.75rem' }}>Registre produção para ver a evolução do custo.</p>
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                <XAxis dataKey="label" stroke="#a0a0ab" tick={{ fill: '#a0a0ab', fontSize: 12 }} dy={10} />
                <YAxis
                    stroke="#00e5ff"
                    tick={{ fill: '#00e5ff', fontSize: 12 }}
                    tickFormatter={(value) => value.toLocaleString('pt-BR')}
                />
                <RechartsTooltip
                    contentStyle={{ backgroundColor: '#1c1c21', borderColor: 'rgba(124, 77, 255, 0.3)', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value, name) => [`${value.toLocaleString('pt-BR')} un.`, name]}
                />
                <RechartsLegend wrapperStyle={{ color: '#a0a0ab', fontFamily: 'Inter', paddingTop: '10px' }} />
                <RechartsBar dataKey="producao" name="Volume Produzido" fill="rgba(0, 229, 255, 0.6)" stroke="#00e5ff" strokeWidth={1} radius={[4, 4, 0, 0]} />
            </RechartsBarChart>
        </ResponsiveContainer>
    );
}

export function CustoPorSetorChart({ data }) {
    if (!data || data.length === 0) {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '0.9rem', marginBottom: '4px' }}>📊 Sem dados para exibir</p>
                <p style={{ fontSize: '0.75rem' }}>Adicione funcionários para ver a distribuição.</p>
            </div>
        );
    }

    const chartData = {
        labels: data.map(d => d.setor),
        datasets: [{
            data: data.map(d => d.valor),
            backgroundColor: ['#7c4dff', '#00e5ff', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#3b82f6', '#06b6d4', '#14b8a6'],
            borderWidth: 0,
        }],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right',
                labels: { color: '#a0a0ab', font: { family: 'Inter', size: 12 }, usePointStyle: true, pointStyle: 'circle' }
            },
            tooltip: {
                backgroundColor: '#1c1c21',
                padding: 12,
                callbacks: {
                    label: (ctx) => {
                        const val = ctx.parsed || 0;
                        return `${ctx.label}: R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                    }
                }
            },
        },
        cutout: '70%',
    };

    return <Doughnut data={chartData} options={options} />;
}

export function HeadcountPorSetorChart({ data }) {
    if (!data || data.length === 0) {
        return (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-muted)' }}>
                <p style={{ fontSize: '0.9rem', marginBottom: '4px' }}>👥 Sem dados para exibir</p>
                <p style={{ fontSize: '0.75rem' }}>Adicione funcionários para ver a distribuição.</p>
            </div>
        );
    }

    return (
        <ResponsiveContainer width="100%" height="100%">
            <RechartsBarChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: -20 }}>
                <defs>
                    <linearGradient id="barGradientHR" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                </defs>
                <CartesianGrid vertical={false} horizontal={false} />
                <XAxis dataKey="setor" stroke="#a0a0ab" tick={{ fill: '#a0a0ab', fontSize: 12 }} dy={10} axisLine={false} tickLine={false} />
                <YAxis stroke="#a0a0ab" tick={{ fill: '#a0a0ab', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <RechartsTooltip
                    cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                    contentStyle={{ backgroundColor: '#1c1c21', borderColor: 'rgba(255, 255, 255, 0.1)', color: '#fff', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value) => [value, 'Colaboradores']}
                />
                <RechartsBar dataKey="quantidade" fill="url(#barGradientHR)" radius={[4, 4, 0, 0]} maxBarSize={60}>
                    <LabelList dataKey="quantidade" position="top" fill="#fff" fontSize={12} fontWeight="bold" />
                </RechartsBar>
            </RechartsBarChart>
        </ResponsiveContainer>
    );
}
