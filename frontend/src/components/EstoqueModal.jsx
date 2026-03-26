import React, { useState, useEffect } from 'react';
import { X, CheckCircle, PackageSearch, Loader2, ArrowRight } from 'lucide-react';
import api from '../api/client';
import { motion, AnimatePresence } from 'framer-motion';

function EstoqueModal({ isOpen, onClose, produto = null, onSuccess }) {
    const [novaQuantidade, setNovaQuantidade] = useState('');
    const [motivo, setMotivo] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (produto && isOpen) {
            setNovaQuantidade(produto.estoque_atual || 0);
            setMotivo('');
            setError('');
        }
    }, [produto, isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (novaQuantidade === '') {
            setError('Digite a nova quantidade.');
            return;
        }

        setLoading(true);
        try {
            await api.patch(`/produtos/${produto.id}/estoque`, {
                nova_quantidade: Number(novaQuantidade),
                motivo: motivo || 'Ajuste Manual'
            });
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Erro ao ajustar estoque:', err);
            setError('Falha ao registrar ajuste de estoque.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !produto) return null;

    const diff = Number(novaQuantidade) - (produto.estoque_atual || 0);

    return (
        <AnimatePresence>
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />

                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="glass-card" style={{ position: 'relative', width: '90%', maxWidth: '400px', padding: '0', border: '1px solid var(--glass-border)' }}>

                    <header style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(124,77,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c4dff' }}>
                                <PackageSearch size={20} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Ajuste de Estoque</h3>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Inventário Rápido</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="btn-ghost" style={{ padding: '8px', color: 'var(--text-muted)' }}>
                            <X size={20} />
                        </button>
                    </header>

                    <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
                        {error && (
                            <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '8px', fontSize: '0.875rem', marginBottom: '16px' }}>
                                {error}
                            </div>
                        )}

                        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
                            <p style={{ fontWeight: '600', fontSize: '1.1rem', marginBottom: '4px' }}>{produto.nome}</p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Estoque atual no sistema: <strong style={{ color: 'var(--text-primary)' }}>{produto.estoque_atual || 0}</strong>
                            </p>
                        </div>

                        <div style={{ display: 'grid', gap: '20px' }}>
                            <div>
                                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                    <span>Nova Quantidade (Contagem Real)</span>
                                    {diff !== 0 && novaQuantidade !== '' && (
                                        <span style={{ color: diff > 0 ? 'var(--revenue)' : 'var(--expense)' }}>
                                            {diff > 0 ? '+' : ''}{diff} un.
                                        </span>
                                    )}
                                </label>
                                <input type="number" step="0.01" className="input-field" value={novaQuantidade} onChange={e => setNovaQuantidade(e.target.value)} placeholder="0" style={{ fontSize: '1.2rem', textAlign: 'center', fontWeight: '700', letterSpacing: '2px' }} required autoFocus />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Motivo do Ajuste (Opcional)</label>
                                <select className="input-field" value={motivo} onChange={e => setMotivo(e.target.value)}>
                                    <option value="Ajuste Manual">Ajuste Manual (Contagem)</option>
                                    <option value="Perda / Danificado">Perda / Produto Danificado</option>
                                    <option value="Brinde / Doação">Saída para Brinde / Doação</option>
                                    <option value="Compra sem nota">Entrada Extra (Sem transação financeira)</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                            <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
                            <button type="submit" disabled={loading || Number(novaQuantidade) === (produto.estoque_atual || 0)} className="btn btn-primary" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                                {loading ? <Loader2 size={18} className="spin" /> : <CheckCircle size={18} />}
                                Confirmar
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

export default EstoqueModal;
