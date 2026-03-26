const express = require('express');
const { getSupabaseClient } = require('../db/supabase');
const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const supabase = getSupabaseClient(req.token);
        let query = supabase.from('apontamentos').select('*');
        if (startDate && endDate) {
            query = query.gte('data', startDate).lte('data', endDate);
        }
        const { data, error } = await query;
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao carregar registros de presença' });
    }
});

router.post('/bulk', async (req, res) => {
    try {
        const { apontamentos } = req.body; 
        if (!apontamentos || !Array.isArray(apontamentos)) return res.status(400).json({ error: 'Dados inválidos' });
        
        const supabase = getSupabaseClient(req.token);
        const inserts = apontamentos.map(a => ({
            usuario_id: req.user.id,
            funcionario_id: a.funcionario_id,
            data: a.data,
            status: a.status,
            valor_diaria_pago: a.valor_diaria_pago || 0
        }));

        const { error } = await supabase.from('apontamentos').insert(inserts);
        if (error) throw error;
        res.json({ success: true, message: 'Apontamentos salvos com sucesso' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao salvar registros de presença' });
    }
});
module.exports = router;
