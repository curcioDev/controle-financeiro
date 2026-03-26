const express = require('express');
const { getSupabaseClient, supabaseAdmin } = require('../db/supabase');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireRole('ADMIN'), async (req, res) => {
    try {
        const supabase = getSupabaseClient(req.token);
        const { data, error } = await supabase.from('usuarios').select('*');
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.post('/', requireRole('ADMIN'), async (req, res) => {
    try {
        const { nome, email, senha, role } = req.body;
        if (!nome || !email || !senha) return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });

        const validRoles = ['ADMIN', 'GERENTE', 'OPERADOR'];
        const userRole = validRoles.includes(role?.toUpperCase()) ? role.toUpperCase() : 'OPERADOR';

        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email, password: senha, email_confirm: true, user_metadata: { nome }
        });
        if (error) return res.status(409).json({ error: error.message });
        
        await supabaseAdmin.from('usuarios').update({ role: userRole }).eq('id', data.user.id);
        
        res.status(201).json({ id: data.user.id, nome, email, role: userRole, ativo: true });
    } catch (err) {
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

router.put('/:id', requireRole('ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        const { role, nome } = req.body;

        const supabase = getSupabaseClient(req.token);
        const payload = {};
        if (role) payload.role = role.toUpperCase();
        if (nome) payload.nome = nome;

        const { data, error } = await supabase.from('usuarios').update(payload).eq('id', id).select().single();
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Erro interno' });
    }
});

router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
    try {
        const { id } = req.params;
        if (id === req.user.id) return res.status(400).json({ error: 'Você não pode desativar sua própria conta' });
        
        const supabase = getSupabaseClient(req.token);
        await supabase.from('usuarios').update({ ativo: false }).eq('id', id);
        
        res.json({ message: 'Usuário desativado com sucesso' });
    } catch (err) {
        res.status(500).json({ error: 'Erro interno' });
    }
});
module.exports = router;
