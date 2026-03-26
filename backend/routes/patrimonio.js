const express = require('express');
const { getSupabaseClient } = require('../db/supabase');
const router = express.Router();

router.get('/balanco', async (req, res) => {
    try {
        const supabase = getSupabaseClient(req.token);
        const { data: allTx } = await supabase.from('transacoes').select('tipo, status_pagamento, valor').neq('status_pagamento', 'CANCELADO');
        const { data: produtos } = await supabase.from('produtos').select('custo_unitario');
        const { data: patrimonioEntries } = await supabase.from('patrimonio').select('*');

        const contasReceber = (allTx||[]).filter(t => t.tipo === 'RECEITA' && t.status_pagamento === 'PENDENTE').reduce((s, t) => s + (Number(t.valor) || 0), 0);
        const estoqueValorizado = (produtos||[]).reduce((s, p) => s + (Number(p.custo_unitario) || 0) * 10, 0);
        const saldosConta = (patrimonioEntries||[]).filter(e => e.tipo === 'ATIVO').reduce((s, e) => s + (Number(e.valor) || 0), 0);

        const contasPagar = (allTx||[]).filter(t => t.tipo === 'DESPESA' && t.status_pagamento === 'PENDENTE').reduce((s, t) => s + (Number(t.valor) || 0), 0);
        const emprestimos = (patrimonioEntries||[]).filter(e => e.tipo === 'PASSIVO').reduce((s, e) => s + (Number(e.valor) || 0), 0);

        const totalAtivos = contasReceber + estoqueValorizado + saldosConta;
        const totalPassivos = contasPagar + emprestimos;
        const patrimonioLiquido = totalAtivos - totalPassivos;

        res.json({
            ativos: { total: totalAtivos, contasReceber, estoqueValorizado, saldosConta },
            passivos: { total: totalPassivos, contasPagar, emprestimos },
            patrimonioLiquido
        });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao calcular balanço patrimonial' });
    }
});

router.get('/timeline', async (req, res) => {
    try {
        const supabase = getSupabaseClient(req.token);
        const { data: allTx } = await supabase.from('transacoes').select('data_transacao, tipo, valor').neq('status_pagamento', 'CANCELADO');
        const now = new Date();
        const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const series = [];

        for (let i = 11; i >= 0; i--) {
            const refDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const mEnd = `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, '0')}-31`;

            const cumulativeTx = (allTx||[]).filter(t => t.data_transacao <= mEnd);
            const receitas = cumulativeTx.filter(t => t.tipo === 'RECEITA').reduce((s, t) => s + (Number(t.valor) || 0), 0);
            const despesas = cumulativeTx.filter(t => t.tipo === 'DESPESA').reduce((s, t) => s + (Number(t.valor) || 0), 0);
            const patrimonio = receitas - despesas;

            series.push({
                mes: `${monthNames[refDate.getMonth()]}/${refDate.getFullYear()}`,
                patrimonio: +patrimonio.toFixed(2), receitas: +receitas.toFixed(2), despesas: +despesas.toFixed(2),
            });
        }
        res.json({ series });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao calcular timeline de patrimônio' });
    }
});

router.get('/', async (req, res) => {
    try {
        const supabase = getSupabaseClient(req.token);
        const { data, error } = await supabase.from('patrimonio').select('*').order('data_registro', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar patrimônio' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { tipo, descricao, valor, data_registro } = req.body;
        if (!tipo || !descricao || !valor) return res.status(400).json({ error: 'Campos obrigatórios' });
        const dataReg = data_registro || new Date().toISOString().split('T')[0];
        
        const supabase = getSupabaseClient(req.token);
        const { data, error } = await supabase.from('patrimonio').insert([{
            usuario_id: req.user.id, tipo, descricao, valor, data_registro: dataReg
        }]).select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const supabase = getSupabaseClient(req.token);
        const { error } = await supabase.from('patrimonio').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao remover patrimônio' });
    }
});
module.exports = router;
