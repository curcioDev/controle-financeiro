const express = require('express');
const { getSupabaseClient } = require('../db/supabase');

const router = express.Router();

router.get('/search', async (req, res) => {
    try {
        const { q = '' } = req.query;
        if (q.length < 1) return res.json([]);
        const supabase = getSupabaseClient(req.token);

        const { data, error } = await supabase
            .from('clientes')
            .select('id, nome, tipo, documento, email, telefone, segmento')
            .eq('ativo', true)
            .or(`nome.ilike.%${q}%,documento.ilike.%${q}%`)
            .order('nome')
            .limit(10);
            
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro na busca de clientes' });
    }
});

router.get('/with-sales', async (req, res) => {
    try {
        const { start, end } = req.query;
        const supabase = getSupabaseClient(req.token);

        let query = supabase.from('transacoes').select('*').neq('status_pagamento', 'CANCELADO');
        if (start) query = query.gte('data_transacao', start);
        if (end) query = query.lte('data_transacao', end);

        const { data: clientes } = await supabase.from('clientes').select('*').eq('ativo', true).order('nome');
        const { data: transacoes } = await query;

        const result = (clientes || []).map(c => {
            const isFornecedor = c.tipo_contato === 'Fornecedor';
            const tipoFiltro = isFornecedor ? 'DESPESA' : 'RECEITA';
            const related = (transacoes || []).filter(t => t.cliente_id === c.id && t.tipo === tipoFiltro);
            const totalVendido = related.reduce((sum, t) => sum + (Number(t.valor) || 0), 0);
            return { ...c, totalVendido, qtdVendas: related.length };
        });

        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao buscar clientes com vendas' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { nome, tipo = 'PF', segmento = 'Individual', telefone = null, tipo_contato = 'Cliente' } = req.body;
        if (!nome) return res.status(400).json({ error: 'Nome é obrigatório' });

        const supabase = getSupabaseClient(req.token);
        const { data, error } = await supabase.from('clientes').insert([{
            usuario_id: req.user.id,
            nome, tipo, documento: null, email: null, telefone, segmento, tipo_contato, ativo: true
        }]).select().single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao criar cliente' });
    }
});

router.get('/', async (req, res) => {
    try {
        const supabase = getSupabaseClient(req.token);
        const { data, error } = await supabase.from('clientes').select('*').eq('ativo', true).order('nome');
        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao listar clientes' });
    }
});

module.exports = router;
