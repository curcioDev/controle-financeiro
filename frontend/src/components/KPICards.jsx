import React from 'react';
import { TrendingUp, TrendingDown, DollarSign, Activity, Percent } from 'lucide-react';

function KPICard({ title, value, variation, type }) {
    const isPositive = variation >= 0;
    let Icon = DollarSign;
    let color = 'var(--accent-primary)';

    if (type === 'receita') { Icon = TrendingUp; color = 'var(--revenue)'; }
    if (type === 'despesa') { Icon = TrendingDown; color = 'var(--expense)'; }
    if (type === 'lucro') { Icon = Activity; color = 'var(--accent-secondary)'; }
    if (type === 'margem') { Icon = Percent; color = 'var(--accent-primary)'; }

    const formattedValue = type === 'margem'
        ? `${value || 0}%`
        : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

    const hasData = value !== 0 && value !== undefined;

    return (
        <div className="glass-card" style={{ padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div style={{ padding: '8px', borderRadius: '10px', background: `rgba(${color === 'var(--revenue)' ? '16, 185, 129' : color === 'var(--expense)' ? '239, 68, 68' : '124, 77, 255'}, 0.1)`, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={20} />
                </div>
                {hasData && variation !== undefined && (
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '0.7rem', fontWeight: '700', color: isPositive ? 'var(--success)' : 'var(--danger)', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            {isPositive ? '+' : ''}{variation}%
                        </span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>vs mês ant.</span>
                    </div>
                )}
            </div>
            <div>
                <h3 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '2px', fontWeight: '500' }}>{title}</h3>
                <p style={{ fontSize: '1.4rem', fontWeight: '800', letterSpacing: '-0.5px' }}>{formattedValue}</p>
            </div>
        </div>
    );
}

function KPICards({ data }) {
    if (!data) return <div className="dashboard-grid">
        {[1, 2, 3, 4].map(i => <div key={i} className="glass-card" style={{ height: '140px', opacity: 0.5 }}>Carregando...</div>)}
    </div>;

    return (
        <div className="dashboard-grid">
            <KPICard title="Receita Total" value={data.receita.atual} variation={data.receita.variacao} type="receita" />
            <KPICard title="Despesa Total" value={data.despesa.atual} variation={data.despesa.variacao} type="despesa" />
            <KPICard title="Lucro Líquido" value={data.lucro.atual} variation={data.lucro.variacao} type="lucro" />
            <KPICard title="Margem %" value={data.margem.atual} variation={data.margem.variacao} type="margem" />
        </div>
    );
}

export default KPICards;
