const express = require('express');
const { getSupabaseClient } = require('../db/supabase');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const { start, end, produto_id } = req.query;
        const supabase = getSupabaseClient(req.token);
        let query = supabase.from('producao').select('*, produtos(nome)');
        
        if (produto_id) query = query.eq('produto_id', produto_id);
        if (start) query = query.gte('data', start);
        if (end) query = query.lte('data', end);
        
        const { data, error } = await query;
        if (error) throw error;

        const producao = (data || []).map(p => ({ ...p, produto_nome: p.produtos?.nome || 'Desconhecido' })).sort((a,b) => (b.data||'').localeCompare(a.data||''));
        res.json(producao);
    } catch (err) {
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { data: dataProducao, produto_nome, quantidade, unidade_medida } = req.body;
        if (!dataProducao || !produto_nome || !quantidade) return res.status(400).json({ error: 'Campos obrigatórios' });
        
        const supabase = getSupabaseClient(req.token);
        const { data: produtos } = await supabase.from('produtos').select('*').ilike('nome', produto_nome.trim());
        let produto_id = produtos?.[0]?.id;

        if (!produto_id) {
            const { data: np } = await supabase.from('produtos').insert([{ 
                usuario_id: req.user.id, nome: produto_nome.trim(), codigo_sku: 'AUTO-' + Date.now().toString(36), 
                categoria: 'Outros', preco_venda: 0, custo_unitario: 0, ativo: true 
            }]).select().single();
            produto_id = np.id;
        }

        const { data: item } = await supabase.from('producao').insert([{
            usuario_id: req.user.id, data: dataProducao, produto_id, quantidade: Number(quantidade), unidade_medida: unidade_medida || 'Unidades'
        }]).select().single();

        const { data: prod } = await supabase.from('produtos').select('estoque_atual').eq('id', produto_id).single();
        if (prod) {
            await supabase.from('produtos').update({ estoque_atual: Number(prod.estoque_atual || 0) + Number(quantidade) }).eq('id', produto_id);
        }

        res.status(201).json({ ...item, produto_nome });
    } catch (err) {
        res.status(500).json({ error: 'Erro interno' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const supabase = getSupabaseClient(req.token);
        await supabase.from('producao').delete().eq('id', id);
        res.json({ message: 'Removido com sucesso' });
    } catch (err) {
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.post('/import-bulk', async (req, res) => {
    try {
        const { rows } = req.body;
        if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'Nenhum dado para importar.' });
        
        const supabase = getSupabaseClient(req.token);
        const { data: produtos } = await supabase.from('produtos').select('id, nome');
        const prodMap = new Map((produtos||[]).map(p => [p.nome.toLowerCase(), p.id]));

        const inserts = [];
        const errors = [];
        let skipped = 0;

        rows.forEach((row, i) => {
            if (!row.data || !row.produto || !row.quantidade) {
                skipped++; errors.push(`Linha ${i+2}: Campos faltantes`); return;
            }
            const prodId = prodMap.get(row.produto.trim().toLowerCase());
            if (!prodId) {
                skipped++; errors.push(`Linha ${i+2}: Produto não encontrado`); return;
            }
            inserts.push({
                usuario_id: req.user.id, data: row.data, produto_id: prodId, quantidade: Number(row.quantidade), unidade_medida: row.unidade_medida || 'Unidades'
            });
        });

        if (inserts.length > 0) {
            await supabase.from('producao').insert(inserts);
        }
        res.json({ imported: inserts.length, skipped, errors });
    } catch (err) {
        res.status(500).json({ error: 'Erro interno' });
    }
});

router.get('/analytics', async (req, res) => {
    try {
        const { start, end } = req.query;
        const supabase = getSupabaseClient(req.token);
        let qP = supabase.from('producao').select('*');
        let qT = supabase.from('transacoes').select('*').neq('status_pagamento', 'CANCELADO');

        if (start) { qP = qP.gte('data', start); qT = qT.gte('data_transacao', start); }
        if (end) { qP = qP.lte('data', end); qT = qT.lte('data_transacao', end); }

        const { data: producao } = await qP;
        const { data: transacoes } = await qT;
        const { data: produtosList } = await supabase.from('produtos').select('*');

        let totalProduzido = 0;
        let totalDespesas = 0;
        let totalReceitas = 0;
        let unidadesVendidas = 0;
        const dailyData = {};

        (producao || []).forEach(p => {
            const val = Number(p.quantidade) || 0;
            totalProduzido += val;
            if (p.data) {
                if (!dailyData[p.data]) dailyData[p.data] = 0;
                dailyData[p.data] += val;
            }
        });

        (transacoes || []).forEach(t => {
            const val = Number(t.valor) || 0;
            if (t.tipo === 'DESPESA') totalDespesas += val;
            else if (t.tipo === 'RECEITA') {
                totalReceitas += val;
                unidadesVendidas += Number(t.quantidade) || 1;
            }
        });

        let volumeTotal = totalProduzido || 0;
        let custoPorUnidade = volumeTotal > 0 ? (totalDespesas / volumeTotal) : 0;
        let lucroPorUnidade = volumeTotal > 0 ? ((totalReceitas / volumeTotal) - custoPorUnidade) : 0;
        let receitaPorUnidade = volumeTotal > 0 ? (totalReceitas / volumeTotal) : 0;

        const eficiencia = Object.entries(dailyData)
            .map(([data, producao]) => {
                const [y, m, d] = data.split('-');
                return { producao, label: `${d}/${m}`, timestamp: new Date(y, m-1, d).getTime() };
            })
            .sort((a,b) => a.timestamp - b.timestamp);

        res.json({
            totalProduzido, totalDespesas, totalReceitas, unidadesVendidas,
            custoPorUnidade, receitaPorUnidade, lucroPorUnidade, eficiencia,
            produtos: produtosList || []
        });
    } catch (err) {
        res.status(500).json({ error: 'Erro ao calcular analytics' });
    }
});

module.exports = router;
