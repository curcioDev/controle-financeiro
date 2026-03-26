const express = require('express');
const { getSupabaseClient } = require('../db/supabase');

const router = express.Router();

router.get('/search', async (req, res) => {
    try {
        const { q = '' } = req.query;
        if (q.length < 1) return res.json([]);
        const supabase = getSupabaseClient(req.token);

        const { data, error } = await supabase
            .from('produtos')
            .select('id, nome, codigo_sku, categoria, preco_venda, custo_unitario')
            .eq('ativo', true)
            .or(`nome.ilike.%${q}%,codigo_sku.ilike.%${q}%`)
            .order('nome')
            .limit(10);
        
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        console.error('Erro:', err);
        res.status(500).json({ error: 'Erro na busca de produtos' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { nome, codigo_sku, preco_venda = 0, custo_unitario = 0, categoria = 'Geral', estoque_atual = 0, estoque_minimo = 0 } = req.body;
        if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

        const sku = codigo_sku || 'AUTO-' + Date.now().toString(36).toUpperCase();
        const supabase = getSupabaseClient(req.token);

        const payload = {
            usuario_id: req.user.id,
            nome, codigo_sku: sku, categoria, preco_venda, custo_unitario, estoque_atual, estoque_minimo, ativo: true
        };

        const { data, error } = await supabase.from('produtos').insert([payload]).select().single();
        if (error) throw error;
        
        res.status(201).json(data);
    } catch (err) {
        console.error('Erro ao criar produto:', err);
        res.status(500).json({ error: 'Erro ao criar produto' });
    }
});

router.get('/', async (req, res) => {
    try {
        const supabase = getSupabaseClient(req.token);
        const { data, error } = await supabase
            .from('produtos')
            .select('*')
            .eq('ativo', true)
            .order('nome');
        
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar produtos' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, codigo_sku, categoria, preco_venda, custo_unitario, estoque_atual, estoque_minimo } = req.body;
        if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

        const supabase = getSupabaseClient(req.token);
        const { data, error } = await supabase
            .from('produtos')
            .update({ nome, codigo_sku, categoria, preco_venda, custo_unitario, estoque_atual, estoque_minimo })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Erro ao editar produto:', err);
        res.status(500).json({ error: 'Erro ao editar produto' });
    }
});

router.patch('/:id/estoque', async (req, res) => {
    try {
        const { id } = req.params;
        const { nova_quantidade } = req.body;
        
        if (typeof nova_quantidade !== 'number') return res.status(400).json({ error: 'Inválido' });

        const supabase = getSupabaseClient(req.token);
        const { data, error } = await supabase
            .from('produtos')
            .update({ estoque_atual: nova_quantidade })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Erro interno ao ajustar estoque' });
    }
});

router.post('/import-bulk', async (req, res) => {
    try {
        const { rows } = req.body;
        if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'Nenhum dado' });

        const supabase = getSupabaseClient(req.token);
        const inserts = rows.map((row, i) => ({
            usuario_id: req.user.id,
            nome: row.nome || 'Produto Sem Nome',
            codigo_sku: row.codigo_sku || 'AUTO-' + Date.now().toString(36).toUpperCase() + '-' + i,
            categoria: row.categoria || 'Geral',
            preco_venda: row.preco_venda || 0,
            custo_unitario: row.custo_unitario || 0,
            estoque_atual: row.estoque_atual || 0,
            estoque_minimo: row.estoque_minimo || 0,
            ativo: true
        }));

        const { data, error } = await supabase.from('produtos').insert(inserts);
        if (error) throw error;

        res.json({ imported: inserts.length, skipped: 0 });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro na importação em lote' });
    }
});

module.exports = router;
