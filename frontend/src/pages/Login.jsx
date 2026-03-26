import React, { useState } from 'react';
import api from '../api/client';
import { LogIn, Mail, Lock, AlertCircle, User, UserPlus } from 'lucide-react';

function Login({ onLogin }) {
    const [mode, setMode] = useState('login'); // 'login' or 'register'
    const [nome, setNome] = useState('');
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        setLoading(true);

        try {
            if (mode === 'login') {
                const { data } = await api.post('/auth/login', { email, senha });
                onLogin(data.usuario, data.token);
            } else {
                await api.post('/auth/register', { nome, email, senha });
                setSuccessMsg('Conta criada com sucesso! Você já pode fazer o login.');
                setMode('login');
                setSenha('');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Erro ao processar requisição. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
            <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '400px' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '16px', background: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', boxShadow: '0 0 20px rgba(124, 77, 255, 0.4)' }}>
                        {mode === 'login' ? <LogIn size={32} color="white" /> : <UserPlus size={32} color="white" />}
                    </div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: '700' }}>Controle Financeiro</h1>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
                        {mode === 'login' ? 'Entre com suas credenciais para acessar o painel' : 'Crie sua conta para começar a usar o sistema'}
                    </p>
                </div>

                <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '24px' }}>
                    <button 
                        type="button" 
                        onClick={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
                        style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', borderBottom: mode === 'login' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: mode === 'login' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: mode === 'login' ? '600' : '400', cursor: 'pointer', transition: 'all 0.2s' }}>
                        Entrar
                    </button>
                    <button 
                        type="button" 
                        onClick={() => { setMode('register'); setError(''); setSuccessMsg(''); }}
                        style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', borderBottom: mode === 'register' ? '2px solid var(--accent-primary)' : '2px solid transparent', color: mode === 'register' ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: mode === 'register' ? '600' : '400', cursor: 'pointer', transition: 'all 0.2s' }}>
                        Criar Conta
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    {error && (
                        <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--danger)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem' }}>
                            <AlertCircle size={16} />
                            {error}
                        </div>
                    )}
                    
                    {successMsg && (
                        <div style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.2)', color: 'var(--success)', padding: '12px', borderRadius: 'var(--radius-sm)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem' }}>
                            {successMsg}
                        </div>
                    )}

                    {mode === 'register' && (
                        <div className="input-group">
                            <label className="input-label">Nome Completo</label>
                            <div style={{ position: 'relative' }}>
                                <User size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input
                                    type="text"
                                    className="input-field"
                                    style={{ paddingLeft: '40px' }}
                                    value={nome}
                                    onChange={(e) => setNome(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                    )}

                    <div className="input-group">
                        <label className="input-label">E-mail</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="email"
                                className="input-field"
                                style={{ paddingLeft: '40px' }}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label className="input-label">Senha</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input
                                type="password"
                                className="input-field"
                                style={{ paddingLeft: '40px' }}
                                value={senha}
                                onChange={(e) => setSenha(e.target.value)}
                                required
                                minLength={6}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: '12px', height: '48px', justifyContent: 'center' }}
                        disabled={loading}
                    >
                        {loading ? 'Processando...' : mode === 'login' ? 'Entrar no Sistema' : 'Criar Conta'}
                    </button>
                </form>

                <p style={{ marginTop: '24px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Enterprise Management System v2.0
                </p>
            </div>
        </div>
    );
}

export default Login;
