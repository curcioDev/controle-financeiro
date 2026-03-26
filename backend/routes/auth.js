const express = require('express');
const { getSupabaseClient, supabaseAdmin } = require('../db/supabase');

const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const { nome, email, senha } = req.body;
        
        if (!nome || !email || !senha) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
        }

        // Criar usuário pelo painel admin (bypass de email confirmation e RLS)
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: senha,
            email_confirm: true,
            user_metadata: { nome }
        });

        if (error) {
            console.error('Erro Auth:', error);
            return res.status(400).json({ error: error.message });
        }
        
        res.json({ message: 'Conta criada com sucesso!' });
    } catch (err) {
        console.error('Erro no catch:', err);
        res.status(500).json({ error: 'Erro interno ao criar conta' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, senha } = req.body;

        if (!email || !senha) {
            return res.status(400).json({ error: 'Email e senha são obrigatórios' });
        }

        const supabase = getSupabaseClient(''); // using anon key to sign in
        
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ 
            email, 
            password: senha 
        });

        if (authError || !authData.user) {
            return res.status(401).json({ error: 'Credenciais inválidas' });
        }

        // Instanciar cliente autenticado para ler os dados complementares
        const authClient = getSupabaseClient(authData.session.access_token);
        
        const { data: usuario, error: userErr } = await authClient
            .from('usuarios')
            .select('*')
            .eq('id', authData.user.id)
            .single();

        res.json({
            token: authData.session.access_token,
            usuario: usuario || { 
                id: authData.user.id, 
                nome: authData.user.user_metadata.nome || email, 
                email, 
                role: 'ADMIN' 
            },
        });
    } catch (err) {
        console.error('Erro no login:', err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
