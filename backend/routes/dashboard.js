const express = require('express');
const { getSupabaseClient } = require('../db/supabase');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

function sanitizeNumber(valor) {
    if (typeof valor === 'number' && !isNaN(valor)) return valor;
    const cleaned = parseFloat(String(valor).replace(/\./g, '').replace(',', '.'));
    return isNaN(cleaned) ? 0 : cleaned;
}

router.get('/kpis', async (req, res) => {
    try {
        const { start, end } = req.query;
        let currentStart, currentEnd, prevStart, prevEnd;

        if (start && end) {
            currentStart = start;
            currentEnd = end;
            const s = new Date(start), e = new Date(end);
            const diffMs = e - s;
            const prevE = new Date(s.getTime() - 86400000); 
            const prevS = new Date(prevE.getTime() - diffMs);
            prevStart = prevS.toISOString().split('T')[0];
            prevEnd = prevE.toISOString().split('T')[0];
        } else {
            const now = new Date();
            const cy = now.getFullYear(), cm = now.getMonth() + 1;
            currentStart = `${cy}-${String(cm).padStart(2, '0')}-01`;
            currentEnd = `${cy}-${String(cm).padStart(2, '0')}-31`;
            const pd = new Date(cy, cm - 2, 1);
            prevStart = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, '0')}-01`;
            prevEnd = `${pd.getFullYear()}-${String(pd.getMonth() + 1).padStart(2, '0')}-31`;
        }

        const getMetrics = async (s, e) => {
            const supabase = getSupabaseClient(req.token);
            const { data: txs } = await supabase.from('transacoes').select('tipo, valor, status_pagamento').gte('data_transacao', s).lte('data_transacao', e).neq('status_pagamento', 'CANCELADO');
            let receita = 0, despesa = 0;
            (txs || []).forEach(t => { 
                if (t.tipo === 'RECEITA') receita += Number(t.valor); 
                if (t.tipo === 'DESPESA') despesa += Number(t.valor); 
            });
            return { receita, despesa };
        };

        const current = await getMetrics(currentStart, currentEnd);
        const prev = await getMetrics(prevStart, prevEnd);
        const calcVar = (curr, prev) => prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / Math.abs(prev)) * 100;

        res.json({
            receita: { atual: current.receita, anterior: prev.receita, variacao: +calcVar(current.receita, prev.receita).toFixed(1) },
            despesa: { atual: current.despesa, anterior: prev.despesa, variacao: +calcVar(current.despesa, prev.despesa).toFixed(1) },
            lucro: { atual: current.receita - current.despesa, anterior: prev.receita - prev.despesa, variacao: +calcVar(current.receita - current.despesa, prev.receita - prev.despesa).toFixed(1) },
            margem: {
                atual: current.receita > 0 ? +(((current.receita - current.despesa) / current.receita) * 100).toFixed(1) : 0,
                anterior: prev.receita > 0 ? +(((prev.receita - prev.despesa) / prev.receita) * 100).toFixed(1) : 0
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao calcular KPIs' });
    }
});

router.get('/market-share', async (req, res) => {
    try {
        const { start, end } = req.query;
        const supabase = getSupabaseClient(req.token);
        let q = supabase.from('transacoes').select('*').eq('tipo', 'RECEITA').neq('status_pagamento', 'CANCELADO');
        if (start) q = q.gte('data_transacao', start);
        if (end) q = q.lte('data_transacao', end);
        
        const { data: transacoes } = await q;
        const { data: produtos } = await supabase.from('produtos').select('*');

        const prodMap = {};
        (produtos || []).forEach(p => { prodMap[p.id] = p; });

        const grouped = {};
        (transacoes || []).forEach(t => {
            if (t.produto_id && prodMap[t.produto_id]) {
                const prod = prodMap[t.produto_id];
                const nome = prod.nome;
                if (!grouped[nome]) {
                    grouped[nome] = { valor: 0, custoTotal: 0 };
                }
                grouped[nome].valor += sanitizeNumber(t.valor);
                const qtd = t.quantidade || 1;
                const cost = qtd * (prod.custo_unitario || 0);
                grouped[nome].custoTotal += cost;
            }
        });

        const shares = Object.entries(grouped)
            .map(([produto, data]) => {
                const lucro = data.valor - data.custoTotal;
                const margem = data.valor > 0 ? (lucro / data.valor) * 100 : 0;
                return { produto, valor: data.valor, margem: +margem.toFixed(1) };
            })
            .sort((a, b) => b.valor - a.valor);

        const total = shares.reduce((sum, s) => sum + s.valor, 0);
        res.json({ shares: shares.map(s => ({ ...s, percentual: total > 0 ? +((s.valor / total) * 100).toFixed(1) : 0 })), total });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao calcular market share' });
    }
});

router.get('/expense-breakdown', async (req, res) => {
    try {
        const { start, end } = req.query;
        const supabase = getSupabaseClient(req.token);
        let q = supabase.from('transacoes').select('*').eq('tipo', 'DESPESA').neq('status_pagamento', 'CANCELADO');
        if (start) q = q.gte('data_transacao', start);
        if (end) q = q.lte('data_transacao', end);
        
        const { data: transacoes } = await q;

        const grouped = {};
        (transacoes || []).forEach(t => {
            const cat = t.categoria || 'Sem categoria';
            grouped[cat] = (grouped[cat] || 0) + sanitizeNumber(t.valor);
        });

        const categorias = Object.entries(grouped).map(([categoria, valor]) => ({ categoria, valor })).sort((a, b) => b.valor - a.valor);
        const total = categorias.reduce((sum, c) => sum + c.valor, 0);
        res.json({ categorias: categorias.map(c => ({ ...c, percentual: total > 0 ? +((c.valor / total) * 100).toFixed(1) : 0 })), total });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao calcular despesas' });
    }
});

router.get('/timeline', async (req, res) => {
    try {
        const { start, end } = req.query;
        const supabase = getSupabaseClient(req.token);
        const now = new Date();
        const series = [];
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

        let months = 6;
        let startDate;
        if (start) {
            startDate = new Date(start);
            const endDate = end ? new Date(end) : now;
            months = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24 * 30)));
            if (months > 24) months = 24;
        }

        const { data: allTx } = await supabase.from('transacoes').select('data_transacao, tipo, valor').neq('status_pagamento', 'CANCELADO');

        for (let i = months - 1; i >= 0; i--) {
            const refDate = startDate ? new Date(startDate.getFullYear(), startDate.getMonth() + (months - 1 - i), 1) : new Date(now.getFullYear(), now.getMonth() - i, 1);
            const mStart = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}-01`;
            const mEnd = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}-31`;

            let filtered = (allTx || []).filter(t => {
                const dt = (t.data_transacao || '').slice(0, 10);
                return dt >= mStart && dt <= mEnd;
            });
            const r = filtered.filter(t => t.tipo === 'RECEITA').reduce((s, t) => s + sanitizeNumber(t.valor), 0);
            const d = filtered.filter(t => t.tipo === 'DESPESA').reduce((s, t) => s + sanitizeNumber(t.valor), 0);

            series.push({
                mes: `${monthNames[refDate.getMonth()]}/${refDate.getFullYear()}`,
                receita: r, despesa: d, lucro: r - d
            });
        }
        res.json({ series });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao calcular timeline' });
    }
});

router.get('/fluxo-caixa', async (req, res) => {
    try {
        const supabase = getSupabaseClient(req.token);
        const { data: allTx } = await supabase.from('transacoes').select('data_vencimento, data_transacao, tipo, valor').neq('status_pagamento', 'CANCELADO');
        
        const now = new Date();
        const endDateObj = new Date(now);
        const startDateObj = new Date(now);
        startDateObj.setDate(startDateObj.getDate() - 30);

        const startStr = startDateObj.toISOString().split('T')[0];

        const pastTx = (allTx || []).filter(t => t.data_transacao < startStr);
        let saldoAtual = pastTx.reduce((s, t) => s + (t.tipo === 'RECEITA' ? sanitizeNumber(t.valor) : -sanitizeNumber(t.valor)), 0);

        const series = [];
        for (let i = 0; i <= 30; i++) {
            const d = new Date(startDateObj);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split('T')[0];
            const dayLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

            const todayTx = (allTx || []).filter(t => (t.data_vencimento || (t.data_transacao ? t.data_transacao.slice(0, 10) : '')) === dateStr);
            const receitasDia = todayTx.filter(t => t.tipo === 'RECEITA').reduce((s, t) => s + sanitizeNumber(t.valor), 0);
            const despesasDia = todayTx.filter(t => t.tipo === 'DESPESA').reduce((s, t) => s + sanitizeNumber(t.valor), 0);
            const saldoDia = receitasDia - despesasDia;

            series.push({
                dia: dayLabel,
                data: dateStr,
                timestamp: d.getTime(), 
                saldo: +saldoDia.toFixed(2),
                receitasPrevistas: +receitasDia.toFixed(2),
                despesasPrevistas: +despesasDia.toFixed(2),
                isRealizado: d <= now,
            });
        }

        res.json({ series, saldoAtual: +saldoAtual.toFixed(2) });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao calcular fluxo de caixa' });
    }
});

router.delete('/wipe', requireRole('ADMIN', 'GERENTE'), async (req, res) => {
    try {
        const { period } = req.query; 
        const supabase = getSupabaseClient(req.token);
        
        let query = supabase.from('transacoes').delete();

        if (period && period !== 'todos') {
            const now = new Date();
            let cutoff = new Date(now);
            if (period === '7d') cutoff.setDate(cutoff.getDate() - 7);
            else if (period === '30d') cutoff.setDate(cutoff.getDate() - 30);
            else if (period === '12m') cutoff.setFullYear(cutoff.getFullYear() - 1);

            const cutoffStr = cutoff.toISOString().split('T')[0];
            query = query.gte('data_transacao', cutoffStr);
        } else {
            query = query.neq('id', 0); // Hack to delete all allowed by RLS
        }

        await query;

        if (!period || period === 'todos') {
            await supabase.from('clientes').delete().neq('id', 0);
            await supabase.from('produtos').delete().neq('id', 0);
        }

        res.json({ message: 'Lançamentos removidos com sucesso' });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao limpar banco' });
    }
});

router.get('/proximos-vencimentos', async (req, res) => {
    try {
        const supabase = getSupabaseClient(req.token);
        const { data: allTx } = await supabase.from('transacoes').select('*').eq('status_pagamento', 'PENDENTE');
        const { data: produtos } = await supabase.from('produtos').select('id, nome');
        const { data: clientes } = await supabase.from('clientes').select('id, nome');
        
        const prodMap = {}; (produtos || []).forEach(p => { prodMap[p.id] = p.nome; });
        const cliMap = {}; (clientes || []).forEach(c => { cliMap[c.id] = c.nome; });

        const now = new Date();
        const limit = new Date(now);
        limit.setDate(limit.getDate() + 7);
        const limitStr = limit.toISOString().split('T')[0];
        const todayStr = now.toISOString().split('T')[0];

        const proximos = (allTx || [])
            .filter(t => {
                const venc = t.data_vencimento || t.data_transacao;
                return venc >= todayStr && venc <= limitStr;
            })
            .map(t => ({
                ...t,
                produto_nome: prodMap[t.produto_id] || null,
                cliente_nome: cliMap[t.cliente_id] || null,
                dias_restantes: Math.ceil((new Date(t.data_vencimento || t.data_transacao) - now) / (1000 * 60 * 60 * 24)),
            }))
            .sort((a, b) => (a.data_vencimento || a.data_transacao).localeCompare(b.data_vencimento || b.data_transacao));

        res.json(proximos);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao calcular proximos vencimentos' });
    }
});

router.post('/analise-ia', async (req, res) => {
    try {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey || apiKey === 'sua_chave_aqui') {
            return res.status(400).json({ error: 'Chave da API Groq nao configurada. Edite o arquivo backend/.env com sua GROQ_API_KEY.' });
        }

        const { payload, messages: historyMessages } = req.body;

        if (!historyMessages && (!payload || payload.receita === undefined)) {
            return res.status(400).json({ error: 'Payload de dados financeiros ou histórico de mensagens obrigatorio.' });
        }

        const systemInstruction = `Voce e um Consultor Economico Senior e Diretor Financeiro (CFO). Sua missao e analisar os dados financeiros recebidos e entregar um diagnostico profundo e tecnico, porem acessivel para o dono da empresa. Nao repita os numeros de forma robotica. Sua primeira resposta deve seguir a estrutura informada, e nas mensagens subsequentes você deve agir de forma conversacional, direta e estratégica.

REGRA DE FORMATACAO: Todo e qualquer valor monetario citado na sua resposta DEVE obrigatoriamente ser formatado no padrao da moeda brasileira. Exemplo: R$ 1.500,00 ou -R$ 9.300,00. Nunca exiba numeros puros com varias casas decimais. Seja incisivo e consultivo.`;

        let finalMessages = [{ role: 'system', content: systemInstruction }];

        if (historyMessages && Array.isArray(historyMessages)) {
            finalMessages = finalMessages.concat(historyMessages);
        } else {
            const userMessage = `Aqui estao os dados financeiros da empresa para o periodo analisado. Faça um diagnóstico macro, por setor, riscos e dê um plano de ação (formato Markdown):\n\n${JSON.stringify(payload, null, 2)}`;
            finalMessages.push({ role: 'user', content: userMessage });
        }

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: finalMessages,
                temperature: 0.7,
                max_tokens: 4096
            })
        });

        const data = await response.json();

        if (!response.ok) {
            const errMsg = data?.error?.message || 'Erro desconhecido na API';
            console.error('Erro Groq:', errMsg);
            return res.status(response.status).json({ error: errMsg });
        }

        const text = data?.choices?.[0]?.message?.content;
        if (!text) {
            return res.status(500).json({ error: 'A IA nao retornou uma resposta valida.' });
        }

        res.json({ analise: text });
    } catch (err) {
        console.error('Erro na analise IA:', err);
        res.status(500).json({ error: err.message || 'Erro ao gerar analise com IA' });
    }
});

module.exports = router;
