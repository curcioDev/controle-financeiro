import React, { useState, useEffect } from 'react';
import { X, Package, DollarSign, Archive, Save, Loader2 } from 'lucide-react';
import api from '../api/client';
import { motion, AnimatePresence } from 'framer-motion';

function ProdutoModal({ isOpen, onClose, produto = null, onSuccess }) {
    const [nome, setNome] = useState('');
    const [sku, setSku] = useState('');
    const [categoria, setCategoria] = useState('');
    const [precoVenda, setPrecoVenda] = useState('');
    const [custoUnitario, setCustoUnitario] = useState('');
    const [estoqueAtual, setEstoqueAtual] = useState('');
    const [estoqueMinimo, setEstoqueMinimo] = useState('');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (produto && isOpen) {
            setNome(produto.nome || '');
            setSku(produto.codigo_sku || '');
            setCategoria(produto.categoria || '');
            setPrecoVenda(produto.preco_venda || '');
            setCustoUnitario(produto.custo_unitario || '');
            setEstoqueAtual(produto.estoque_atual || '');
            setEstoqueMinimo(produto.estoque_minimo || '');
        } else if (isOpen) {
            setNome('');
            setSku('');
            setCategoria('');
            setPrecoVenda('');
            setCustoUnitario('');
            setEstoqueAtual('');
            setEstoqueMinimo('');
        }
    }, [produto, isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!nome) {
            setError('O nome do produto é obrigatório.');
            return;
        }

        setLoading(true);
        const payload = {
            nome,
            codigo_sku: sku,
            categoria: categoria || 'Geral',
            preco_venda: precoVenda ? Number(precoVenda) : 0,
            custo_unitario: custoUnitario ? Number(custoUnitario) : 0,
            estoque_atual: estoqueAtual ? Number(estoqueAtual) : 0,
            estoque_minimo: estoqueMinimo ? Number(estoqueMinimo) : 0
        };

        try {
            if (produto && produto.id) {
                await api.put(`/produtos/${produto.id}`, payload);
            } else {
                await api.post('/produtos', payload);
            }
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            console.error('Erro ao salvar produto:', err);
            setError('Falha ao salvar o produto no servidor.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} />

                <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="glass-card" style={{ position: 'relative', width: '95%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '0', border: '1px solid var(--glass-border)' }}>

                    <header style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(124,77,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c4dff' }}>
                                <Package size={20} />
                            </div>
                            <div>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>{produto ? 'Editar Produto' : 'Novo Produto'}</h3>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Preencha os dados do item e estoque inicial.</p>
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

                        <div style={{ display: 'grid', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Nome do Produto *</label>
                                <input type="text" className="input-field" value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Ração 50kg, Tomate Kg..." required />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Código SKU</label>
                                    <input type="text" className="input-field" value={sku} onChange={e => setSku(e.target.value)} placeholder="Opcional" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Categoria</label>
                                    <input type="text" className="input-field" value={categoria} onChange={e => setCategoria(e.target.value)} placeholder="Ex: Insumos" />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}><DollarSign size={14} style={{ display: 'inline', marginBottom: '-2px' }} /> Preço de Venda</label>
                                    <input type="number" step="0.01" min="0" className="input-field" value={precoVenda} onChange={e => setPrecoVenda(e.target.value)} placeholder="0.00" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}><DollarSign size={14} style={{ display: 'inline', marginBottom: '-2px' }} /> Custo Unitário</label>
                                    <input type="number" step="0.01" min="0" className="input-field" value={custoUnitario} onChange={e => setCustoUnitario(e.target.value)} placeholder="0.00" />
                                </div>
                            </div>

                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '16px', marginTop: '8px' }}>
                                <h4 style={{ fontSize: '0.85rem', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                                    <Archive size={16} /> Controle de Estoque Inicial
                                </h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Estoque Atual</label>
                                        <input type="number" step="0.01" className="input-field" value={estoqueAtual} onChange={e => setEstoqueAtual(e.target.value)} placeholder="Qtd. atual" />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>Estoque Mín. (Alerta)</label>
                                        <input type="number" step="0.01" className="input-field" value={estoqueMinimo} onChange={e => setEstoqueMinimo(e.target.value)} placeholder="Ex: 5" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
                            <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
                            <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                                {loading ? <Loader2 size={18} className="spin" /> : <Save size={18} />}
                                {produto ? 'Atualizar' : 'Salvar Cadastro'}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

export default ProdutoModal;
