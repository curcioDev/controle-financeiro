const { getSupabaseClient } = require('../db/supabase');

async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return res.status(401).json({ error: 'Token mal formatado' });
    }

    try {
        const token = parts[1];
        const supabase = getSupabaseClient(token);
        
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
            return res.status(401).json({ error: 'Token inválido ou expirado' });
        }

        // Buscar a role (perfil) do usuário
        const { data: perfil } = await supabase
            .from('usuarios')
            .select('role')
            .eq('id', user.id)
            .single();

        req.user = {
            id: user.id,
            email: user.email,
            role: perfil?.role || 'OPERADOR'
        };
        req.token = token; // Armazena p/ uso posterior nas rotas
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido ou expirado' });
    }
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Não autenticado' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Sem permissão para esta ação' });
        }
        next();
    };
}

module.exports = { authMiddleware, requireRole };
