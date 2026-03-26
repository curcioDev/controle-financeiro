import React, { useState, useEffect } from 'react';
import { X, ArrowUpRight, ArrowDownRight, AlertCircle, Check, Camera } from 'lucide-react';
import api from '../api/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Scanner } from '@yudiel/react-qr-scanner';

function TransactionModal({ isOpen, onClose, transaction = null }) {
    const [tipo, setTipo] = useState('RECEITA');
    const [showScanner, setShowScanner] = useState(false);
    const [scanMessage, setScanMessage] = useState('');
    const [valor, setValor] = useState('');
    const [categoria, setCategoria] = useState('Vendas');
    const [descricao, setDescricao] = useState('');
    const [formaPagamento, setFormaPagamento] = useState('PIX');
    const [dataTransacao, setDataTransacao] = useState(new Date().toISOString().split('T')[0]);
    const [dataVencimento, setDataVencimento] = useState('');
    const [statusPagamento, setStatusPagamento] = useState('PAGO');
    const [centroCusto, setCentroCusto] = useState('');
    const [quantidade, setQuantidade] = useState('1');
    const [tags, setTags] = useState('');
    const [isGeral, setIsGeral] = useState(false);
    const [isParcelado, setIsParcelado] = useState(false);
    const [qntParcelas, setQntParcelas] = useState(2);
    const [telefoneContato, setTelefoneContato] = useState('');
    const [isPurchaseForStock, setIsPurchaseForStock] = useState(false);

    // Centro de custo autocomplete
    const [ccSuggestions, setCcSuggestions] = useState([]);
    const [ccSelected, setCcSelected] = useState(false);
    const ccFiltered = ccSuggestions.filter(c => c.toLowerCase().includes(centroCusto.toLowerCase()));
    const fetchCentrosCusto = async () => {
        try {
            const { data } = await api.get('/transacoes/centros-custo');
            setCcSuggestions(data);
        } catch (e) { }
    };

    // Produto
    const [produto, setProduto] = useState(null);       // selected obj {id, nome}
    const [searchProd, setSearchProd] = useState('');     // typed text
    const [prodResults, setProdResults] = useState([]);
    const [prodSearched, setProdSearched] = useState(false);

    // Cliente
    const [cliente, setCliente] = useState(null);
    const [searchCli, setSearchCli] = useState('');
    const [cliResults, setCliResults] = useState([]);
    const [cliSearched, setCliSearched] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    // Category autocomplete for expenses
    const [catSuggestions, setCatSuggestions] = useState([]);
    const [catSelected, setCatSelected] = useState(false);
    const catFiltered = catSuggestions.filter(c => c.toLowerCase().includes(categoria.toLowerCase()));
    const fetchCategorias = async () => {
        try {
            const { data } = await api.get('/transacoes/categorias');
            setCatSuggestions(data);
        } catch (e) { }
    };

    // Autocomplete products
    useEffect(() => {
        if (searchProd.length < 2) { setProdResults([]); setProdSearched(false); return; }
        const timeout = setTimeout(async () => {
            try {
                const { data } = await api.get(`/produtos/search?q=${searchProd}`);
                setProdResults(data);
            } catch (e) { setProdResults([]); }
            setProdSearched(true);
        }, 300);
        return () => clearTimeout(timeout);
    }, [searchProd]);

    // Autocomplete clients
    useEffect(() => {
        if (searchCli.length < 2) { setCliResults([]); setCliSearched(false); return; }
        const timeout = setTimeout(async () => {
            try {
                const { data } = await api.get(`/clientes/search?q=${searchCli}`);
                setCliResults(data);
            } catch (e) { setCliResults([]); }
            setCliSearched(true);
        }, 300);
        return () => clearTimeout(timeout);
    }, [searchCli]);

    // Populate state for edit mode
    useEffect(() => {
        if (transaction) {
            setTipo(transaction.tipo || 'RECEITA');
            setValor(transaction.valor?.toString() || '');
            setCategoria(transaction.categoria || '');
            setDescricao(transaction.descricao || '');
            setFormaPagamento(transaction.forma_pagamento || 'PIX');
            setDataTransacao(transaction.data_transacao || new Date().toISOString().split('T')[0]);
            setDataVencimento(transaction.data_vencimento || '');
            setStatusPagamento(transaction.status_pagamento || 'PAGO');
            setCentroCusto(transaction.centro_custo || '');
            setQuantidade(transaction.quantidade?.toString() || '1');
            setTags(transaction.tags || '');
            setIsGeral(transaction.is_geral || false);
            setTelefoneContato(transaction.telefone_contato || '');

            if (transaction.produto_id) {
                setProduto({ id: transaction.produto_id, nome: transaction.produto_nome });
                setSearchProd(transaction.produto_nome || '');
            } else {
                setProduto(null);
                setSearchProd('');
            }

            if (transaction.cliente_id) {
                setCliente({ id: transaction.cliente_id, nome: transaction.cliente_nome });
                setSearchCli(transaction.cliente_nome || '');
            } else {
                setCliente(null);
                setSearchCli('');
            }
        } else {
            // Reset state for new transaction
            setTipo('RECEITA');
            setValor('');
            setCategoria('Vendas');
            setDescricao('');
            setFormaPagamento('PIX');
            setDataTransacao(new Date().toISOString().split('T')[0]);
            setDataVencimento('');
            setStatusPagamento('PAGO');
            setCentroCusto('');
            setQuantidade('1');
            setTags('');
            setIsGeral(false);
            setIsParcelado(false);
            setQntParcelas(2);
            setProduto(null);
            setSearchProd('');
            setCliente(null);
            setSearchCli('');
            setTelefoneContato('');
            setIsPurchaseForStock(false);
        }
    }, [transaction]);

    // ── QR Code Parser: extracts monetary value from scanned text ──
    const processScannedData = (text) => {
        if (!text || typeof text !== 'string') return null;

        // 1) PIX EMV / BR Code (Padrão Banco Central)
        // TLV format: each field = [2-digit ID][2-digit length][value]
        // ID 54 = Transaction Amount
        try {
            let pos = 0;
            while (pos < text.length - 4) {
                const id = text.substring(pos, pos + 2);
                const len = parseInt(text.substring(pos + 2, pos + 4), 10);
                if (isNaN(len) || len <= 0) break;
                const val = text.substring(pos + 4, pos + 4 + len);
                if (id === '54') {
                    const parsed = parseFloat(val);
                    if (!isNaN(parsed) && parsed > 0) return parsed;
                }
                pos += 4 + len;
            }
        } catch (_) { /* not EMV format, continue */ }

        // 2) NF-e / NFC-e URL parameters (vNF=, vTotTrib=, valor=, total=)
        const nfeMatch = text.match(/[?&](vNF|vTotTrib|valor|total)=([0-9]+[.,]?[0-9]*)/i);
        if (nfeMatch) {
            const parsed = parseFloat(nfeMatch[2].replace(',', '.'));
            if (!isNaN(parsed) && parsed > 0) return parsed;
        }

        // 3) Fallback: find first monetary value in the string
        // Matches patterns like: R$ 200,00 | R$200.00 | 200.00 | 200,50
        const moneyMatch = text.match(/R?\$?\s?(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/i)
            || text.match(/(\d+[.,]\d{2})/);
        if (moneyMatch) {
            const clean = moneyMatch[1].replace(/\./g, '').replace(',', '.');
            const parsed = parseFloat(clean);
            // Handle case where dots were thousand separators: e.g. "1.500,00" -> cleaned to "1500.00"
            if (!isNaN(parsed) && parsed > 0) return parsed;
        }

        return null;
    };

    const handleScanNF = (result) => {
        if (!result || !result.length) return;
        const text = result[0].rawValue;
        setShowScanner(false);

        const extractedValue = processScannedData(text);

        if (extractedValue !== null) {
            setValor(extractedValue.toString());
            setTipo('DESPESA');
            setCategoria('Suprimentos');
            setDescricao(text.length > 80 ? 'QR Code Escaneado' : text);

            const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(extractedValue);
            setScanMessage(`✅ QR Code lido! Valor de ${formatted} identificado.`);
            setTimeout(() => setScanMessage(''), 5000);
        } else {
            setScanMessage('⚠️ Código lido, mas valor não encontrado. Preencha manualmente.');
            setTimeout(() => setScanMessage(''), 5000);
        }
    };

    const handlePhoneChange = (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);
        if (value.length > 2) {
            value = `(${value.slice(0, 2)}) ` + value.slice(2);
        }
        if (value.length > 9) {
            value = value.slice(0, 10) + '-' + value.slice(10);
        }
        setTelefoneContato(value);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!valor || parseFloat(valor) <= 0) {
            setError('Informe um valor maior que zero.');
            return;
        }

        const produtoNome = produto ? produto.nome : searchProd.trim();
        const clienteNome = cliente ? cliente.nome : searchCli.trim();

        if (tipo === 'RECEITA' && (!produtoNome || !clienteNome)) {
            setError('Informe o nome do produto e do cliente.');
            return;
        }

        setLoading(true);
        try {
            let produtoId = produto?.id || null;
            let clienteId = cliente?.id || null;

            // Auto-create product if typed but not selected (For RECEITA or DESPESA entering stock)
            if ((tipo === 'RECEITA' || (tipo === 'DESPESA' && isPurchaseForStock)) && !produtoId && produtoNome) {
                // Determine category and cost/price based on type
                const pCat = tipo === 'RECEITA' ? categoria : 'Insumos / Revenda';
                const pCost = tipo === 'DESPESA' ? parseFloat(valor) / (parseFloat(quantidade) || 1) : 0;
                const pPrice = tipo === 'RECEITA' ? parseFloat(valor) / (parseFloat(quantidade) || 1) : 0;

                const { data } = await api.post('/produtos', { nome: produtoNome, preco_venda: pPrice, custo_unitario: pCost, categoria: pCat });
                produtoId = data.id;
            }

            // Auto-create client if typed but not selected
            if (tipo === 'RECEITA' && !clienteId && clienteNome) {
                const { data } = await api.post('/clientes', { nome: clienteNome, telefone: telefoneContato || null });
                clienteId = data.id;
            }

            if (transaction) {
                // Editing existing transaction (disable multi-parcelas logic to prevent duplication issues on edit)
                const txData = {
                    data_transacao: dataTransacao,
                    tipo,
                    valor: parseFloat(valor),
                    categoria,
                    produto_id: produtoId,
                    cliente_id: clienteId,
                    status_pagamento: statusPagamento,
                    forma_pagamento: formaPagamento,
                    descricao,
                    centro_custo: tipo === 'DESPESA' ? centroCusto || null : null,
                    quantidade: (tipo === 'RECEITA' || (tipo === 'DESPESA' && isPurchaseForStock)) ? parseFloat(quantidade) || 1 : null,
                    data_vencimento: dataVencimento || null,
                    tags: tags.trim() || null,
                    is_geral: tipo === 'DESPESA' ? isGeral : false,
                    telefone_contato: telefoneContato || null
                };
                await api.put(`/transacoes/${transaction.id}`, txData);
            } else {
                // New transaction
                if (isParcelado && qntParcelas > 1) {
                    const vlTotal = parseFloat(valor);
                    const vlParcela = parseFloat((vlTotal / qntParcelas).toFixed(2));
                    const requests = [];
                    const baseDate = new Date(dataVencimento || dataTransacao);

                    for (let i = 1; i <= qntParcelas; i++) {
                        // For each parcel, add roughly (i-1) months (30 days)
                        const parcelDate = new Date(baseDate);
                        parcelDate.setDate(parcelDate.getDate() + ((i - 1) * 30));
                        const dStr = parcelDate.toISOString().split('T')[0];

                        // Adjust description
                        const descFinal = descricao ? `${descricao} (Parcela ${i}/${qntParcelas})` : `(Parcela ${i}/${qntParcelas})`;
                        // First payment usually uses selected status, subsequents are PENDENTE
                        const pStatus = (i === 1) ? statusPagamento : 'PENDENTE';

                        requests.push(api.post('/transacoes', {
                            data_transacao: dataTransacao,
                            tipo,
                            valor: vlParcela,
                            categoria,
                            produto_id: produtoId,
                            cliente_id: clienteId,
                            status_pagamento: pStatus,
                            forma_pagamento: formaPagamento,
                            descricao: descFinal,
                            centro_custo: tipo === 'DESPESA' ? centroCusto || null : null,
                            quantidade: tipo === 'RECEITA' ? parseFloat(quantidade) || 1 : null,
                            data_vencimento: dStr,
                            tags: tags.trim() || null,
                            is_geral: tipo === 'DESPESA' ? isGeral : false,
                            telefone_contato: telefoneContato || null
                        }));
                    }
                    await Promise.all(requests);
                } else {
                    const txData = {
                        data_transacao: dataTransacao,
                        tipo,
                        valor: parseFloat(valor),
                        categoria,
                        produto_id: produtoId,
                        cliente_id: clienteId,
                        status_pagamento: statusPagamento,
                        forma_pagamento: formaPagamento,
                        descricao,
                        centro_custo: tipo === 'DESPESA' ? centroCusto || null : null,
                        quantidade: tipo === 'RECEITA' ? parseFloat(quantidade) || 1 : null,
                        data_vencimento: dataVencimento || null,
                        tags: tags.trim() || null,
                        is_geral: tipo === 'DESPESA' ? isGeral : false,
                        telefone_contato: telefoneContato || null
                    };
                    await api.post('/transacoes', txData);
                }
            }

            setSuccess(true);
            setTimeout(() => { onClose(); window.location.reload(); }, 1200);
        } catch (err) {
            setError(err.response?.data?.error || 'Erro ao salvar lançamento');
        } finally {
            setLoading(false);
        }
    };

    const categoriasReceita = ['Vendas', 'Serviços', 'Comissões', 'Outros'];
    const categoriasDespesa = ['Aluguel', 'Salários', 'Suprimentos', 'Marketing', 'Manutenção', 'Infraestrutura', 'Outros'];
    const formasPagamento = ['PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'BOLETO', 'TRANSFERENCIA', 'DINHEIRO'];
    const formasLabel = { PIX: 'PIX', CARTAO_CREDITO: 'Cartão Crédito', CARTAO_DEBITO: 'Cartão Débito', BOLETO: 'Boleto', TRANSFERENCIA: 'Transferência', DINHEIRO: 'Dinheiro' };

    if (success) {
        return (
            <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }} />
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    className="glass-card" style={{ maxWidth: '400px', textAlign: 'center', position: 'relative', zIndex: 60 }}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--revenue)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                        <Check size={32} color="white" />
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '8px' }}>Lançamento Registrado!</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        {tipo === 'RECEITA' ? 'Receita' : 'Despesa'} de {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseFloat(valor))} salva com sucesso.
                    </p>
                </motion.div>
            </div>
        );
    }

    return (
        <AnimatePresence>
            <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }}
                    onClick={onClose}
                />
                <motion.div
                    initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
                    className="glass-card"
                    style={{ width: '100%', maxWidth: '520px', position: 'relative', zIndex: 60, overflow: 'visible', maxHeight: '90vh', overflowY: 'auto' }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>
                            {transaction ? 'Editar Lançamento' : 'Novo Lançamento Rápido'}
                        </h2>
                        <button onClick={onClose} className="btn btn-ghost" style={{ padding: '8px' }}><X size={20} /></button>
                    </div>

                    {!transaction && (
                        <button type="button" onClick={() => setShowScanner(!showScanner)}
                            style={{ width: '100%', marginBottom: '16px', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--revenue)', background: 'rgba(16, 185, 129, 0.05)', color: 'var(--revenue)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}>
                            <Camera size={18} /> {showScanner ? 'Cancelar Leitura' : 'Escanear Nota Fiscal (QR Code)'}
                        </button>
                    )}

                    {showScanner && (
                        <div style={{ marginBottom: '16px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '2px solid var(--revenue)', position: 'relative', height: '300px' }}>
                            <Scanner onScan={handleScanNF} onError={(e) => console.log(e)} components={{ audio: false }} styles={{ container: { width: '100%', height: '100%' } }} />
                        </div>
                    )}

                    {scanMessage && (
                        <div style={{
                            background: scanMessage.startsWith('⚠️') ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.1)',
                            color: scanMessage.startsWith('⚠️') ? '#f59e0b' : 'var(--revenue)',
                            padding: '12px',
                            borderRadius: '8px',
                            marginBottom: '16px',
                            fontSize: '0.875rem',
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: '600',
                            border: `1px solid ${scanMessage.startsWith('⚠️') ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.2)'}`
                        }}>
                            {!scanMessage.startsWith('⚠️') && <Check size={18} />}
                            <span>{scanMessage}</span>
                        </div>
                    )}

                    {/* Toggle Receita / Despesa */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '24px', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
                        <button onClick={() => { setTipo('RECEITA'); setCategoria('Vendas'); }}
                            style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: '600', background: tipo === 'RECEITA' ? 'var(--revenue)' : 'transparent', color: tipo === 'RECEITA' ? 'white' : 'var(--text-secondary)' }}>
                            <ArrowUpRight size={18} /> Receita
                        </button>
                        <button onClick={() => { setTipo('DESPESA'); setCategoria(''); setProduto(null); setCliente(null); setSearchProd(''); setSearchCli(''); }}
                            style={{ padding: '10px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: '600', background: tipo === 'DESPESA' ? 'var(--expense)' : 'transparent', color: tipo === 'DESPESA' ? 'white' : 'var(--text-secondary)' }}>
                            <ArrowDownRight size={18} /> Despesa
                        </button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {error && (
                            <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.875rem', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} /> <span>{error}</span>
                            </div>
                        )}

                        {tipo === 'RECEITA' && (
                            <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.8rem', color: 'var(--revenue)' }}>
                                💡 Digite o nome do produto/cliente. Se já existir, selecione da lista. Se não existir, será criado automaticamente.
                            </div>
                        )}

                        {/* Data, Valor, Vencimento */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="input-group">
                                <label className="input-label">Data</label>
                                <input type="date" className="input-field" value={dataTransacao} onChange={e => setDataTransacao(e.target.value)} required />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Valor (R$)</label>
                                <input type="number" step="0.01" min="0.01" className="input-field" value={valor} onChange={e => setValor(e.target.value)} required placeholder="0,00" />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="input-group">
                                <label className="input-label">Vencimento (Opcional)</label>
                                <input type="date" className="input-field" value={dataVencimento} onChange={e => setDataVencimento(e.target.value)} />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Status</label>
                                <select className="input-field" value={statusPagamento} onChange={e => setStatusPagamento(e.target.value)}>
                                    <option value="PAGO">Pago</option>
                                    <option value="PENDENTE">Pendente</option>
                                    <option value="CANCELADO">Cancelado</option>
                                </select>
                            </div>
                        </div>

                        {/* Parcelamento UI (Only visible for new transactions) */}
                        {!transaction && (
                            <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <input type="checkbox" id="isParcelado" checked={isParcelado} onChange={e => setIsParcelado(e.target.checked)}
                                        style={{ width: '18px', height: '18px', accentColor: '#7c4dff' }} />
                                    <label htmlFor="isParcelado" style={{ fontSize: '0.85rem', cursor: 'pointer', fontWeight: '600' }}>
                                        {tipo === 'RECEITA' ? 'Recebimento Parcelado' : 'Pagamento Parcelado'}
                                    </label>
                                </div>
                                {isParcelado && (
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                        <div style={{ flex: 1 }}>
                                            <label className="input-label">Número de Parcelas</label>
                                            <input type="number" min="2" step="1" className="input-field" value={qntParcelas} onChange={e => setQntParcelas(parseInt(e.target.value) || 2)} />
                                        </div>
                                        <div style={{ flex: 2 }}>
                                            <label className="input-label">Valor da Parcela (R$)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0.01"
                                                className="input-field"
                                                value={valor ? +(parseFloat(valor) / qntParcelas).toFixed(2) : ''}
                                                onChange={e => {
                                                    const pVal = parseFloat(e.target.value);
                                                    if (!isNaN(pVal) && pVal > 0) {
                                                        setValor((pVal * qntParcelas).toFixed(2));
                                                    } else {
                                                        setValor('');
                                                    }
                                                }}
                                                placeholder="0.00"
                                            />
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                Total atualizado: R$ {valor ? parseFloat(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Categoria */}
                        <div className="input-group" style={{ position: 'relative' }}>
                            <label className="input-label">Categoria</label>
                            {tipo === 'RECEITA' ? (
                                <select className="input-field" value={categoria} onChange={e => setCategoria(e.target.value)}>
                                    {categoriasReceita.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            ) : (
                                <>
                                    <input type="text" className="input-field" value={categoria}
                                        onChange={e => { setCategoria(e.target.value); setCatSelected(false); }}
                                        onFocus={() => { if (!catSuggestions.length) fetchCategorias(); }}
                                        placeholder="Ex: Aluguel, Marketing, Salários..." required
                                        style={{ borderColor: catSelected ? 'var(--expense)' : undefined }}
                                    />
                                    {catFiltered.length > 0 && !catSelected && categoria.length > 0 && (
                                        <div className="glass" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: '4px', maxHeight: '160px', overflowY: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
                                            {catFiltered.map(c => (
                                                <div key={c} onClick={() => { setCategoria(c); setCatSelected(true); }}
                                                    style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--glass-border)', fontSize: '0.875rem', transition: 'background 0.15s' }}
                                                    onMouseOver={e => e.currentTarget.style.background = 'var(--glass-highlight)'}
                                                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                                    {c}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Forma Pagamento */}
                        <div className="input-group">
                            <label className="input-label">Forma de Pagamento</label>
                            <select className="input-field" value={formaPagamento} onChange={e => setFormaPagamento(e.target.value)}>
                                {formasPagamento.map(f => (
                                    <option key={f} value={f}>{formasLabel[f]}</option>
                                ))}
                            </select>
                        </div>

                        {/* Centro de Custo (DESPESA only) */}
                        {tipo === 'DESPESA' && (
                            <div className="input-group" style={{ position: 'relative' }}>
                                <label className="input-label">Centro de Custo</label>
                                <input type="text" className="input-field" value={centroCusto}
                                    onChange={e => { setCentroCusto(e.target.value); setCcSelected(false); }}
                                    onFocus={() => { if (!ccSuggestions.length) fetchCentrosCusto(); }}
                                    placeholder="Ex: Produção de Silagem, Criação de Carneiro..."
                                    style={{ borderColor: ccSelected ? 'var(--expense)' : undefined }}
                                />
                                {ccFiltered.length > 0 && !ccSelected && centroCusto.length > 0 && (
                                    <div className="glass" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: '4px', maxHeight: '160px', overflowY: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
                                        {ccFiltered.map(c => (
                                            <div key={c} onClick={() => { setCentroCusto(c); setCcSelected(true); }}
                                                style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--glass-border)', fontSize: '0.875rem', transition: 'background 0.15s' }}
                                                onMouseOver={e => e.currentTarget.style.background = 'var(--glass-highlight)'}
                                                onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                                {c}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Quantidade (RECEITA only) */}
                        {tipo === 'RECEITA' && (
                            <div className="input-group">
                                <label className="input-label">Quantidade</label>
                                <input type="number" step="1" min="1" className="input-field" value={quantidade} onChange={e => setQuantidade(e.target.value)} placeholder="1" />
                            </div>
                        )}

                        {/* Produto e Cliente (only for Receita OR Stock Purchases) */}
                        <AnimatePresence>
                            {tipo === 'DESPESA' && (
                                <div style={{ marginBottom: '16px', marginTop: '8px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <input type="checkbox" id="isPurchaseForStock" checked={isPurchaseForStock} onChange={e => setIsPurchaseForStock(e.target.checked)}
                                            style={{ width: '18px', height: '18px', accentColor: '#7c4dff' }} />
                                        <label htmlFor="isPurchaseForStock" style={{ fontSize: '0.85rem', cursor: 'pointer', fontWeight: '600' }}>
                                            Adicionar e Lançar ao Estoque
                                        </label>
                                    </div>
                                    {isPurchaseForStock && (
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Vincule ou crie o produto automaticamente. O estoque de destino subirá pela "Quantidade" digitada.</p>
                                    )}
                                </div>
                            )}
                        </AnimatePresence>

                        {(tipo === 'RECEITA' || (tipo === 'DESPESA' && isPurchaseForStock)) && (
                            <>
                                <div className="input-group" style={{ position: 'relative' }}>
                                    <label className="input-label">
                                        Produto / Serviço
                                        {produto && <span style={{ color: 'var(--revenue)', marginLeft: '8px', fontSize: '0.75rem' }}>✓ Existente</span>}
                                        {!produto && searchProd.trim().length > 0 && <span style={{ color: 'var(--accent-primary)', marginLeft: '8px', fontSize: '0.75rem' }}>+ Novo</span>}
                                    </label>
                                    <input type="text" className="input-field"
                                        value={produto ? produto.nome : searchProd}
                                        onChange={e => { setProduto(null); setSearchProd(e.target.value); }}
                                        placeholder="Nome do produto ou serviço..."
                                        style={{ borderColor: produto ? 'var(--revenue)' : (searchProd.trim() ? 'var(--accent-primary)' : undefined) }}
                                    />
                                    {prodResults.length > 0 && !produto && (
                                        <div className="glass" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: '4px', maxHeight: '200px', overflowY: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
                                            {prodResults.map(p => (
                                                <div key={p.id} onClick={() => { setProduto(p); setSearchProd(p.nome); setProdResults([]); }}
                                                    style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--glass-border)', transition: 'background 0.15s' }}
                                                    onMouseOver={e => e.currentTarget.style.background = 'var(--glass-highlight)'}
                                                    onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                                    <p style={{ fontSize: '0.875rem', fontWeight: '600' }}>{p.nome}</p>
                                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SKU: {p.codigo_sku} | {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.preco_venda)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {prodSearched && prodResults.length === 0 && !produto && searchProd.length >= 2 && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', marginTop: '4px' }}>
                                            ✨ Produto "<strong>{searchProd}</strong>" será criado automaticamente no estoque.
                                        </div>
                                    )}
                                </div>

                                {tipo === 'RECEITA' && (
                                    <div className="input-group" style={{ position: 'relative' }}>
                                        <label className="input-label">
                                            Cliente
                                            {cliente && <span style={{ color: 'var(--revenue)', marginLeft: '8px', fontSize: '0.75rem' }}>✓ Existente</span>}
                                            {!cliente && searchCli.trim().length > 0 && <span style={{ color: 'var(--accent-primary)', marginLeft: '8px', fontSize: '0.75rem' }}>+ Novo</span>}
                                        </label>
                                        <input type="text" className="input-field"
                                            value={cliente ? cliente.nome : searchCli}
                                            onChange={e => { setCliente(null); setSearchCli(e.target.value); }}
                                            placeholder="Nome do cliente..."
                                            style={{ borderColor: cliente ? 'var(--revenue)' : (searchCli.trim() ? 'var(--accent-primary)' : undefined) }}
                                        />
                                        {cliResults.length > 0 && !cliente && (
                                            <div className="glass" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, marginTop: '4px', maxHeight: '200px', overflowY: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
                                                {cliResults.map(c => (
                                                    <div key={c.id} onClick={() => { setCliente(c); setSearchCli(c.nome); setCliResults([]); }}
                                                        style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--glass-border)', transition: 'background 0.15s' }}
                                                        onMouseOver={e => e.currentTarget.style.background = 'var(--glass-highlight)'}
                                                        onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                                                        <p style={{ fontSize: '0.875rem', fontWeight: '600' }}>{c.nome}</p>
                                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.tipo} | {c.documento || 'Sem documento'}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {cliSearched && cliResults.length === 0 && !cliente && searchCli.length >= 2 && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', marginTop: '4px' }}>
                                                ✨ Cliente "<strong>{searchCli}</strong>" será criado automaticamente ao confirmar.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Telefone / WhatsApp */}
                        <div className="input-group">
                            <label className="input-label">Telefone / WhatsApp (Opcional)</label>
                            <input
                                type="text"
                                className="input-field"
                                value={telefoneContato}
                                onChange={handlePhoneChange}
                                placeholder="(00) 00000-0000"
                            />
                        </div>

                        {/* Descrição */}
                        <div className="input-group">
                            <label className="input-label">Descrição / Observação (Opcional)</label>
                            <textarea className="input-field" rows="2" value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhes do lançamento (ex: Mecânico do trator)..." />
                        </div>

                        {/* Tags */}
                        <div className="input-group">
                            <label className="input-label">Tags (separadas por vírgula)</label>
                            <input type="text" className="input-field" value={tags} onChange={e => setTags(e.target.value)} placeholder="ex: projeto-x, safra-2026" />
                        </div>

                        {/* Geral checkbox (only DESPESA) */}
                        {tipo === 'DESPESA' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0' }}>
                                <input type="checkbox" id="isGeral" checked={isGeral} onChange={e => setIsGeral(e.target.checked)}
                                    style={{ width: '18px', height: '18px', accentColor: '#7c4dff' }} />
                                <label htmlFor="isGeral" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>
                                    Despesa <strong>Geral</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>(será rateada entre os produtos ativos)</span>
                                </label>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                            <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }}>Cancelar</button>
                            <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={loading}>
                                {loading ? 'Processando...' : transaction ? 'Salvar Alterações' : 'Confirmar Lançamento'}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence >
    );
}

export default TransactionModal;
