const express = require('express');
const { getSupabaseClient } = require('../db/supabase');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const supabase = getSupabaseClient(req.token);
        const { data, error } = await supabase.from('funcionarios').select('*').order('nome');
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Erro interno do servidor ao carregar funcionários' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { nome, cargo, setor, horario_trabalho, data_admissao, salario_base, encargos_beneficios, status, is_geral, produto_id, valor_diaria } = req.body;
        if (!nome || !cargo || !setor || !data_admissao) return res.status(400).json({ error: 'Campos obrigatórios' });

        const supabase = getSupabaseClient(req.token);
        const { data, error } = await supabase.from('funcionarios').insert([{
            usuario_id: req.user.id, nome, cargo, setor, horario_trabalho: horario_trabalho || null, 
            data_admissao, salario_base: salario_base || 0, encargos_beneficios: encargos_beneficios || 0, 
            status: status || 'Ativo', is_geral: is_geral !== false, produto_id: produto_id || null, valor_diaria: valor_diaria || 0
        }]).select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        res.status(500).json({ error: 'Erro interno ao salvar funcionário' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nome, cargo, setor, horario_trabalho, data_admissao, salario_base, encargos_beneficios, status, is_geral, produto_id, valor_diaria } = req.body;
        if (!nome || !cargo || !setor || !data_admissao) return res.status(400).json({ error: 'Campos obrigatórios' });

        const supabase = getSupabaseClient(req.token);
        const { error } = await supabase.from('funcionarios').update({
            nome, cargo, setor, horario_trabalho: horario_trabalho || null, data_admissao, 
            salario_base: salario_base || 0, encargos_beneficios: encargos_beneficios || 0, 
            status: status || 'Ativo', is_geral: is_geral !== false, produto_id: produto_id || null, valor_diaria: valor_diaria || 0
        }).eq('id', id);

        if (error) throw error;
        res.json({ success: true, message: 'Atualizado com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro interno ao atualizar funcionário' });
    }
});

router.post('/import-bulk', async (req, res) => {
    try {
        const { rows } = req.body;
        if (!rows || !Array.isArray(rows)) return res.status(400).json({ error: 'Dados inválidos' });

        const supabase = getSupabaseClient(req.token);
        const inserts = rows.map((row) => ({
            usuario_id: req.user.id, nome: row.nome, cargo: row.cargo, setor: row.setor,
            horario_trabalho: row.horario_trabalho || null, data_admissao: row.data_admissao,
            salario_base: Number(row.salario_base) || 0, encargos_beneficios: Number(row.encargos_beneficios) || 0, status: row.status || 'Ativo'
        })).filter(r => r.nome && r.cargo && r.setor && r.data_admissao);

        if (inserts.length > 0) {
            const { error } = await supabase.from('funcionarios').insert(inserts);
            if (error) throw error;
        }

        res.json({ imported: inserts.length, skipped: rows.length - inserts.length, errors: [] });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao processar importação' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const supabase = getSupabaseClient(req.token);
        const { error } = await supabase.from('funcionarios').delete().eq('id', id);
        if (error) throw error;
        res.json({ message: 'Excluído com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro interno ao excluir funcionário' });
    }
});
module.exports = router;
