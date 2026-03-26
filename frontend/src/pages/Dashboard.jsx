import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import KPICards from '../components/KPICards';
import { LogOut, Plus, Search, Activity, LayoutDashboard, FileText, Settings, User, Package, TrendingUp, BarChart3, Edit2, CalendarDays, Calculator, AlertTriangle, Trash2, Download, Tag, Clock, ChevronLeft, ChevronRight, Brain, X, Sparkles, Loader2, UploadCloud, Users, Shield, UserPlus, Mail, Factory, Warehouse, Check, Wallet } from 'lucide-react';
import TransactionModal from '../components/TransactionModal';
import ImportModal from '../components/ImportModal';
import ProdutoModal from '../components/ProdutoModal';
import EstoqueModal from '../components/EstoqueModal';
import ImportProdutosModal from '../components/ImportProdutosModal';
import ImportFuncionariosModal from '../components/ImportFuncionariosModal';
import { TimelineChart, MarketShareChart, ExpenseBreakdownChart, MarginBarChart, RevenueExpenseLineChart, PatrimonioLineChart, BalancoBarChart, FluxoCaixaChart, EficienciaChart, CustoUnidadeChart, CustoPorSetorChart, HeadcountPorSetorChart } from '../components/Charts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/* ─── Sub-Pages ─── */

// Categorias sigilosas — ocultas para OPERADOR no frontend também
const CATEGORIAS_SIGILOSAS = ['Pró-labore', 'Folha de Pagamento'];

/* ─── Utils ─── */
const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const thStyle = { padding: '12px 14px', textAlign: 'left', fontWeight: '600', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' };
const tdStyle = { padding: '14px', fontSize: '0.9rem' };

/* ─── Gestão RH Page ─── */
function RhPage() {
    const [funcionarios, setFuncionarios] = useState([]);
    const [produtos, setProdutos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [showAgendar, setShowAgendar] = useState(false);
    const [aba, setAba] = useState('equipe');
    const [agendando, setAgendando] = useState(false);
    const [agendarData, setAgendarData] = useState(() => new Date().toISOString().split('T')[0]);
    const [saving, setSaving] = useState(false);
    const [apontamentos, setApontamentos] = useState([]);
    const [semanaBase, setSemanaBase] = useState(() => {
        const d = new Date();
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        return monday.toISOString().split('T')[0];
    });
    const [form, setForm] = useState({ id: '', nome: '', cargo: '', setor: '', horario_trabalho: '', data_admissao: new Date().toISOString().split('T')[0], salario_base: '', encargos_beneficios: '', status: 'Ativo', is_geral: true, produto_id: '', alocacao_nome: 'Geral', valor_diaria: '' });

    const fetchData = () => {
        setLoading(true);
        Promise.all([
            api.get('/funcionarios'),
            api.get('/produtos'),
            api.get(`/apontamentos?startDate=${semanaBase}&endDate=${getEndDate(semanaBase)}`)
        ]).then(([fRes, pRes, aRes]) => {
            setFuncionarios(fRes.data || []);
            setProdutos(pRes.data || []);
            setApontamentos(aRes.data || []);
        }).catch(() => {}).finally(() => setLoading(false));
    };

    function getEndDate(start) {
        const d = new Date(start);
        d.setDate(d.getDate() + 6);
        return d.toISOString().split('T')[0];
    }

    const changeWeek = (offset) => {
        const d = new Date(semanaBase);
        d.setDate(d.getDate() + (offset * 7));
        setSemanaBase(d.toISOString().split('T')[0]);
    };

    useEffect(() => { fetchData(); }, [semanaBase]);

    // KPIs
    const ativos = funcionarios.filter(f => f.status === 'Ativo');
    const totalAtivos = ativos.length;
    const custoFolha = ativos.reduce((acc, f) => acc + (f.salario_base || 0) + (f.encargos_beneficios || 0), 0);

    // Chart Data Grouping
    const dadosAgrupados = ativos.reduce((acc, f) => {
        const s = f.setor || 'Não Definido';
        if (!acc[s]) acc[s] = { setor: s, valor: 0, quantidade: 0 };
        acc[s].valor += (f.salario_base || 0) + (f.encargos_beneficios || 0);
        acc[s].quantidade += 1;
        return acc;
    }, {});

    const agrupadosArray = Object.values(dadosAgrupados).sort((a, b) => b.valor - a.valor);
    const dadosCustoPorSetor = agrupadosArray.map(d => ({ setor: d.setor, valor: d.valor }));
    const dadosHeadcountPorSetor = agrupadosArray.map(d => ({ setor: d.setor, quantidade: d.quantidade })).sort((a, b) => b.quantidade - a.quantidade);

    const parseCurrency = (val) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        let str = String(val).replace(/R\$\s?/g, '').trim();
        if (str.includes(',') && str.includes('.')) { str = str.replace(/\./g, '').replace(',', '.'); }
        else if (str.includes(',')) { str = str.replace(',', '.'); }
        return parseFloat(str) || 0;
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);

        let is_geral = true;
        let produto_id = null;
        let aloc = (form.alocacao_nome || '').trim();

        if (aloc.toLowerCase() !== 'geral' && aloc !== '') {
            const prod = produtos.find(p => p.nome.toLowerCase() === aloc.toLowerCase());
            if (prod) {
                is_geral = false;
                produto_id = prod.id;
            } else {
                alert('Produção não encontrada. Digite "Geral" ou escolha uma produção existente na lista.');
                setSaving(false);
                return;
            }
        }

        const payload = {
            ...form,
            is_geral,
            produto_id,
            salario_base: parseCurrency(form.salario_base),
            encargos_beneficios: parseCurrency(form.encargos_beneficios)
        };
        try {
            if (form.id) {
                await api.put(`/funcionarios/${form.id}`, payload);
            } else {
                await api.post('/funcionarios', payload);
            }
            setShowModal(false);
            fetchData();
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao salvar funcionário');
        } finally {
            setSaving(false);
        }
    };



    const editFunc = (f) => {
        let alocName = 'Geral';
        if (f.is_geral === false && f.produto_id) {
            alocName = produtos.find(p => p.id === f.produto_id)?.nome || 'Geral';
        }
        setForm({ ...f, id: f.id, salario_base: f.salario_base || '', encargos_beneficios: f.encargos_beneficios || '', is_geral: f.is_geral !== false, produto_id: f.produto_id || '', alocacao_nome: alocName, valor_diaria: f.valor_diaria || '' });
        setShowModal(true);
    };

    const closeAndReset = () => {
        setForm({ id: '', nome: '', cargo: '', setor: '', horario_trabalho: '', data_admissao: new Date().toISOString().split('T')[0], salario_base: '', encargos_beneficios: '', status: 'Ativo', is_geral: true, produto_id: '', alocacao_nome: 'Geral', valor_diaria: '' });
        setShowModal(false);
    };

    const CurrencyInput = ({ value, onChange, label, required = true }) => {
        const [displayValue, setDisplayValue] = useState(value ? fmt(value) : '');
        useEffect(() => { setDisplayValue(value ? fmt(value) : ''); }, [value]);

        const handleBlur = (e) => {
            const val = parseCurrency(e.target.value);
            setDisplayValue(val ? fmt(val) : '');
            onChange(val);
        };

        return (
            <div>
                <label className="input-label">{label}</label>
                <input required={required} className="input-field" type="text" placeholder="R$ 0,00" value={displayValue} onChange={e => setDisplayValue(e.target.value)} onBlur={handleBlur} />
            </div>
        );
    };

    const handleAgendar = async (e) => {
        e.preventDefault();
        setAgendando(true);
        
        // Agrupar ativos por alocação (Geral vs Produto específico)
        const buckets = {};
        ativos.forEach(f => {
            const bucketKey = f.is_geral !== false ? 'geral' : (f.produto_id || 'geral');
            if (!buckets[bucketKey]) {
                buckets[bucketKey] = {
                    total: 0,
                    is_geral: f.is_geral !== false,
                    produto_id: f.is_geral !== false ? null : f.produto_id
                };
            }
            buckets[bucketKey].total += (f.salario_base || 0) + (f.encargos_beneficios || 0);
        });

        const chaves = Object.keys(buckets);
        if (chaves.length === 0) {
            alert('Não há funcionários ativos para programar pagamento.');
            setAgendando(false);
            return;
        }

        try {
            await Promise.all(chaves.map(async (key) => {
                const b = buckets[key];
                const nomeProd = b.produto_id ? (produtos.find(p => p.id === b.produto_id)?.nome || `Prod ${b.produto_id}`) : 'Geral';
                const payload = {
                    tipo: 'DESPESA',
                    categoria: 'Folha de Pagamento',
                    valor: b.total,
                    status_pagamento: 'PENDENTE',
                    forma_pagamento: 'Dinheiro', 
                    data_vencimento: agendarData,
                    data_transacao: new Date().toISOString().split('T')[0],
                    descricao: `Pagamento de Folha (${nomeProd})`,
                    is_geral: b.is_geral,
                    produto_id: b.produto_id
                };
                return api.post('/transacoes', payload);
            }));
            
            setShowAgendar(false);
            alert(`Pagamento programado com sucesso em ${chaves.length} lançamento(s)!`);
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao programar pagamento');
        } finally {
            setAgendando(false);
        }
    };

    const handleTogglePresenca = (funcionario_id, data) => {
        setApontamentos(prev => {
            const index = prev.findIndex(a => a.funcionario_id === funcionario_id && a.data === data);
            if (index > -1) {
                const updated = [...prev];
                const currentStatus = updated[index].status;
                if (currentStatus === 'Presença') {
                    updated.splice(index, 1); // Desmarca = considerado falta implicitamente
                } else {
                    updated[index].status = 'Presença';
                }
                return updated;
            } else {
                return [...prev, { funcionario_id, data, status: 'Presença' }];
            }
        });
    };

    const handleSalvarApontamentos = async () => {
        setSaving(true);
        try {
            const start = new Date(semanaBase);
            const end = new Date(start);
            end.setDate(end.getDate() + 6);
            const endISO = end.toISOString().split('T')[0];
            
            const semanaApontamentos = apontamentos.filter(a => a.data >= semanaBase && a.data <= endISO);
            
            const payload = semanaApontamentos.map(a => {
                const func = funcionarios.find(f => f.id === a.funcionario_id);
                const diaria = parseFloat(func?.valor_diaria || 0);
                let valor = 0;
                if (a.status === 'Presença') valor = diaria;
                
                return { ...a, valor_diaria_pago: valor };
            });

            await api.post('/apontamentos/bulk', { apontamentos: payload });
            alert('Frequência salva com sucesso!');
        } catch (err) {
            alert('Erro ao salvar frequência');
        } finally {
            setSaving(false);
        }
    };

    const handleFecharFolha = async () => {
        if (!window.confirm('Deseja fechar a folha desta semana? Isso gerará lançamentos de despesa no financeiro para cada funcionário com diárias registradas.')) return;
        
        setSaving(true);
        try {
            const start = new Date(semanaBase);
            const end = new Date(start);
            end.setDate(end.getDate() + 6);
            const endISO = end.toISOString().split('T')[0];

            const semanaApontamentos = apontamentos.filter(a => a.data >= semanaBase && a.data <= endISO);
            
            const totaisPorFuncionario = {};

            // Validar e calcular para cada funcionário ativo
            for (const func of ativos) {
                const funcApontamentos = semanaApontamentos.filter(a => a.funcionario_id === func.id);
                
                // Calcular total de dias a receber (P = 1, M = 0.5, outros = 0)
                let totalDiasReceber = 0;
                funcApontamentos.forEach(a => {
                    if (a.status === 'Presença') totalDiasReceber += 1;
                });

                if (totalDiasReceber > 0) {
                    const diaria = parseFloat(func.valor_diaria);
                    
                    // Validação: Se trabalhou, deve ter diária preenchida (> 0, não nula, não NaN)
                    if (!diaria || diaria <= 0 || isNaN(diaria)) {
                        alert(`Por favor, defina a diária para ${func.nome} antes de fechar a folha.`);
                        setSaving(false);
                        return;
                    }

                    totaisPorFuncionario[func.id] = {
                        nome: func.nome,
                        total: totalDiasReceber * diaria,
                        is_geral: func.is_geral !== false,
                        produto_id: func.produto_id || null
                    };
                }
            }

            const ids = Object.keys(totaisPorFuncionario);
            const somaTotalMatematica = ids.reduce((acc, id) => acc + totaisPorFuncionario[id].total, 0);

            if (ids.length === 0 || somaTotalMatematica <= 0) {
                alert('Nenhum valor a ser pago nesta semana!');
                setSaving(false);
                return;
            }

            if (!window.confirm(`Total calculado: ${fmt(somaTotalMatematica)} para ${ids.length} funcionários. Confirmar geração de lançamentos?`)) {
                setSaving(false);
                return;
            }

            await Promise.all(ids.map(id => {
                const info = totaisPorFuncionario[id];
                return api.post('/transacoes', {
                    tipo: 'DESPESA',
                    categoria: 'Folha de Pagamento',
                    valor: info.total,
                    status_pagamento: 'PENDENTE',
                    forma_pagamento: 'Dinheiro',
                    data_transacao: new Date().toISOString().split('T')[0],
                    data_vencimento: new Date().toISOString().split('T')[0],
                    descricao: `Pagamento Semanal - ${info.nome} (Semana ${semanaBase})`,
                    is_geral: info.is_geral,
                    produto_id: info.produto_id
                });
            }));

            alert('Folha fechada e pagamentos lançados com sucesso!');
            fetchData(); // Refresh to ensure data is updated
        } catch (err) {
            console.error(err);
            alert('Erro ao fechar folha');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveDiaria = async (fId, valor) => {
        const func = funcionarios.find(f => f.id === fId);
        if (!func) return;
        try {
            await api.put(`/funcionarios/${fId}`, { ...func, valor_diaria: valor });
            fetchData();
        } catch (err) {
            alert('Erro ao salvar diária');
        }
    };

    const DiariaInlineEditor = ({ funcionario, onSave }) => {
        const [val, setVal] = useState(funcionario.valor_diaria || 0);
        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input 
                    type="number" 
                    className="input-field" 
                    style={{ width: '70px', padding: '4px 8px', fontSize: '0.8rem', background: 'rgba(255,255,255,0.05)' }}
                    value={val}
                    onChange={e => setVal(e.target.value)}
                />
                <button 
                    onClick={() => onSave(funcionario.id, val)}
                    className="btn btn-ghost"
                    style={{ padding: '4px', border: '1px solid var(--glass-border)' }}
                    title="Salvar Diária"
                >
                    <Check size={14} color="var(--revenue)" />
                </button>
            </div>
        );
    };

    const diasSemana = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
    const getDatesOfWeek = (start) => {
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            dates.push(d.toISOString().split('T')[0]);
        }
        return dates;
    };
    const datasSemana = getDatesOfWeek(semanaBase);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                    <h2 style={{ fontSize: '1.875rem', fontWeight: '700', marginBottom: '8px' }}>Gestão RH</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Controle de funcionários e folha de pagamento.</p>
                </div>
                {aba === 'equipe' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setShowImport(true)} className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--glass-border)' }}>
                            <UploadCloud size={18} /> Importar Planilha
                        </button>
                        <button onClick={() => setShowAgendar(true)} disabled={ativos.length === 0} className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--glass-border)' }}>
                            <CalendarDays size={18} /> Programar Pagamento
                        </button>
                        <button onClick={() => { closeAndReset(); setShowModal(true); }} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Plus size={18} /> Novo Funcionário
                        </button>
                    </div>
                )}
                {aba === 'apontamento' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={handleSalvarApontamentos} disabled={saving} className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--glass-border)' }}>
                            <FileText size={18} /> Salvar Frequência
                        </button>
                        <button onClick={handleFecharFolha} disabled={saving} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Wallet size={18} /> {saving ? 'Processando...' : 'Fechar Folha (Semana)'}
                        </button>
                    </div>
                )}
            </div>

            {/* Abas */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid var(--glass-border)' }}>
                <button
                    onClick={() => setAba('equipe')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px',
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600',
                        color: aba === 'equipe' ? 'var(--accent-primary)' : 'var(--text-muted)',
                        borderBottom: aba === 'equipe' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                        transition: 'all 0.2s',
                    }}
                >
                    <Users size={16} /> Equipe & Painel
                </button>
                <button
                    onClick={() => setAba('apontamento')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px',
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600',
                        color: aba === 'apontamento' ? 'var(--accent-primary)' : 'var(--text-muted)',
                        borderBottom: aba === 'apontamento' ? '2px solid var(--accent-primary)' : '2px solid transparent',
                        transition: 'all 0.2s',
                    }}
                >
                    <CalendarDays size={16} /> Apontamento & Pagamentos
                </button>
            </div>

            {aba === 'equipe' ? (
                <>
                    {/* KPIs */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                        <div className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                                <Users size={24} />
                            </div>
                            <div>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>Total de Funcionários Ativos</p>
                                <h3 style={{ fontSize: '1.75rem', fontWeight: '700' }}>{totalAtivos}</h3>
                            </div>
                        </div>
                        <div className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(244, 63, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f43f5e' }}>
                                <Calculator size={24} />
                            </div>
                            <div>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>Custo Estimado da Folha (Mensal)</p>
                                <h3 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--expense)' }}>{fmt(custoFolha)}</h3>
                            </div>
                        </div>
                    </div>

            {/* Charts */}
            {ativos.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                    <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', minHeight: '350px' }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '16px' }}>Custo da Folha por Setor</h3>
                        <div style={{ flex: 1, position: 'relative', minHeight: '250px' }}>
                            <CustoPorSetorChart data={dadosCustoPorSetor} />
                        </div>
                    </div>
                    <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', minHeight: '350px' }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '16px' }}>Distribuição de Equipe</h3>
                        <div style={{ flex: 1, position: 'relative', minHeight: '250px' }}>
                            <HeadcountPorSetorChart data={dadosHeadcountPorSetor} />
                        </div>
                    </div>
                </div>
            )}

            <ImportFuncionariosModal 
                isOpen={showImport} 
                onClose={() => setShowImport(false)} 
                onSuccess={() => { setShowImport(false); fetchData(); }} 
            />

            {/* Modal de Agendamento */}
            {showAgendar && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--overlay)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={(e) => { if (e.target === e.currentTarget) setShowAgendar(false); }}>
                    <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Programar Pagamento</h3>
                            <button onClick={() => setShowAgendar(false)} className="btn btn-ghost" style={{ padding: '6px' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAgendar}>
                            <div style={{ marginBottom: '16px' }}>
                                <label className="input-label">Valor Estimado a Pagar</label>
                                <div style={{ padding: '12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid var(--glass-border)', fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--expense)' }}>
                                    {fmt(custoFolha)}
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '8px' }}>Este valor será lançado como Despesa Pendente no seu Calendário e fluxo de caixa.</p>
                            </div>
                            <div style={{ marginBottom: '24px' }}>
                                <label className="input-label">Data de Pagamento</label>
                                <input required className="input-field" type="date" value={agendarData} onChange={e => setAgendarData(e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                <button type="button" onClick={() => setShowAgendar(false)} className="btn btn-ghost">Cancelar</button>
                                <button type="submit" disabled={agendando} className="btn btn-primary">{agendando ? 'Programando...' : 'Programar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Cadastro/Edição */}
            {showModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--overlay)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={(e) => { if (e.target === e.currentTarget) closeAndReset(); }}>
                    <div className="glass-card" style={{ width: '100%', maxWidth: '600px', padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '600' }}>{form.id ? 'Editar Funcionário' : 'Novo Funcionário'}</h3>
                            <button onClick={closeAndReset} className="btn btn-ghost" style={{ padding: '6px' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label className="input-label">Nome Completo</label>
                                    <input required className="input-field" type="text" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} />
                                </div>
                                <div>
                                    <label className="input-label">Cargo</label>
                                    <input required className="input-field" type="text" value={form.cargo} onChange={e => setForm({...form, cargo: e.target.value})} />
                                </div>
                                <div>
                                    <label className="input-label">Setor</label>
                                    <input required className="input-field" type="text" placeholder="Ex: Administrativo" value={form.setor} onChange={e => setForm({...form, setor: e.target.value})} list="setor-options" />
                                    <datalist id="setor-options">
                                        <option value="Administrativo" />
                                        <option value="Operacional" />
                                        <option value="Campo" />
                                        <option value="Comercial" />
                                        <option value="Diretoria" />
                                    </datalist>
                                </div>
                                <div>
                                    <label className="input-label">Horário de Trabalho</label>
                                    <input className="input-field" type="text" placeholder="Ex: 08h às 18h" value={form.horario_trabalho} onChange={e => setForm({...form, horario_trabalho: e.target.value})} />
                                </div>
                                <div>
                                    <label className="input-label">Data de Admissão</label>
                                    <input required className="input-field" type="date" value={form.data_admissao} onChange={e => setForm({...form, data_admissao: e.target.value})} />
                                </div>
                                <div style={{ gridColumn: '1 / -1' }}>
                                    <label className="input-label">Alocação de Custo (Rateio)</label>
                                    <input 
                                        className="input-field" 
                                        type="text" 
                                        placeholder="Digite 'Geral' ou o nome da Produção" 
                                        value={form.alocacao_nome !== undefined ? form.alocacao_nome : 'Geral'} 
                                        onChange={e => setForm({...form, alocacao_nome: e.target.value})}
                                        list="alocacao-options"
                                    />
                                    <datalist id="alocacao-options">
                                        <option value="Geral" />
                                        {produtos.map(p => (
                                            <option key={p.id} value={p.nome} />
                                        ))}
                                    </datalist>
                                </div>
                                <CurrencyInput label="Salário Base" value={form.salario_base} onChange={(v) => setForm({...form, salario_base: v})} />
                                <CurrencyInput label="Encargos e Benefícios" value={form.encargos_beneficios} onChange={(v) => setForm({...form, encargos_beneficios: v})} required={false} />
                                <CurrencyInput label="Valor da Diária" value={form.valor_diaria} onChange={(v) => setForm({...form, valor_diaria: v})} required={false} />
                                <div>
                                    <label className="input-label">Status</label>
                                    <select className="input-field" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                                        <option value="Ativo">Ativo</option>
                                        <option value="Desligado">Desligado</option>
                                        <option value="Afastado">Afastado</option>
                                        <option value="Férias">Férias</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
                                <button type="button" onClick={closeAndReset} className="btn btn-ghost">Cancelar</button>
                                <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Salvando...' : 'Salvar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Listagem */}
            {loading ? <p style={{ color: 'var(--text-muted)' }}>Carregando...</p> : funcionarios.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
                    <Users size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px', margin: '0 auto' }} />
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '8px' }}>Nenhum funcionário cadastrado</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Adicione seu primeiro funcionário clicando no botão acima.</p>
                </div>
            ) : (
                <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                <th style={thStyle}>Nome</th>
                                <th style={thStyle}>Cargo / Setor</th>
                                <th style={thStyle}>Admissão</th>
                                <th style={{...thStyle, textAlign:'right'}}>Salário Base</th>
                                <th style={{...thStyle, textAlign:'right'}}>Encargos</th>
                                <th style={thStyle}>Status</th>
                                <th style={thStyle}>Alocação</th>
                                <th style={{...thStyle, textAlign:'center'}}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {funcionarios.map(f => (
                                <tr key={f.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                    <td style={{...tdStyle, fontWeight: '600'}}>{f.nome}</td>
                                    <td style={tdStyle}>
                                        {f.cargo}<br/>
                                        <span style={{fontSize:'0.75rem', color:'var(--text-muted)'}}>{f.setor} • {f.horario_trabalho}</span>
                                    </td>
                                    <td style={tdStyle}>{new Date(f.data_admissao).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</td>
                                    <td style={{...tdStyle, textAlign:'right', fontWeight: '600'}}>{fmt(f.salario_base)}</td>
                                    <td style={{...tdStyle, textAlign:'right', color:'var(--expense)'}}>{fmt(f.encargos_beneficios)}</td>
                                    <td style={tdStyle}>
                                        <span className={`badge ${f.status === 'Ativo' ? 'badge-revenue' : f.status === 'Desligado' ? 'badge-expense' : ''}`} style={{ background: f.status === 'Férias' ? 'rgba(56, 189, 248, 0.15)' : f.status === 'Afastado' ? 'rgba(245, 158, 11, 0.15)' : undefined, color: f.status === 'Férias' ? '#38bdf8' : f.status === 'Afastado' ? '#f59e0b' : undefined }}>
                                            {f.status}
                                        </span>
                                    </td>
                                    <td style={tdStyle}>
                                        {f.is_geral !== false ? (
                                            <span style={{ fontSize: '0.8rem', color: '#7c4dff', fontWeight: 'bold' }}>Geral</span>
                                        ) : (
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                {produtos.find(p => p.id === f.produto_id)?.nome || 'Específico'}
                                            </span>
                                        )}
                                    </td>
                                    <td style={{...tdStyle, textAlign:'center'}}>
                                        <button onClick={() => editFunc(f)} className="btn btn-ghost" style={{ padding: '6px' }} title="Editar">
                                            <Edit2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            </>
        ) : (
            <>
                    {/* Seletor de Semana */}
                    <div className="glass-card" style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '24px', marginBottom: '24px' }}>
                        <button onClick={() => changeWeek(-1)} className="btn btn-ghost" style={{ padding: '8px' }}><ChevronLeft size={24} /></button>
                        <div style={{ textAlign: 'center' }}>
                            <h4 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Semana de {new Date(semanaBase).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</h4>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Até {new Date(getEndDate(semanaBase)).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
                        </div>
                        <button onClick={() => changeWeek(1)} className="btn btn-ghost" style={{ padding: '8px' }}><ChevronRight size={24} /></button>
                    </div>

                    {/* Grade de Presença */}
                    <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                    <th style={{...thStyle, width: '180px'}}>Funcionário</th>
                                    <th style={{...thStyle, width: '130px'}}>Diária (R$)</th>
                                    {diasSemana.map((dia, i) => (
                                        <th key={dia} style={{...thStyle, textAlign: 'center'}}>
                                            {dia}<br/>
                                            <span style={{fontSize: '0.7rem', opacity: 0.6}}>{new Date(datasSemana[i]).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit', timeZone: 'UTC'})}</span>
                                        </th>
                                    ))}
                                    <th style={{...thStyle, textAlign: 'center'}}>Total Semana</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ativos.map(f => {
                                    const mDias = datasSemana.map(d => {
                                        const a = apontamentos.find(ap => ap.funcionario_id === f.id && ap.data === d);
                                        return a ? a.status : null;
                                    });
                                    const totalSemana = mDias.reduce((acc, s) => {
                                        const diaria = parseFloat(f.valor_diaria || 0);
                                        if (s === 'Presença') return acc + diaria;
                                        return acc;
                                    }, 0);

                                    return (
                                        <tr key={f.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                            <td style={tdStyle}>
                                                <div style={{fontWeight: '600'}}>{f.nome}</div>
                                                <div style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>{f.setor}</div>
                                            </td>
                                            <td style={tdStyle}>
                                                <DiariaInlineEditor funcionario={f} onSave={handleSaveDiaria} />
                                            </td>
                                            {datasSemana.map(d => {
                                                const a = apontamentos.find(ap => ap.funcionario_id === f.id && ap.data === d);
                                                const status = a ? a.status : null;
                                                return (
                                                    <td key={d} style={{padding: '8px', textAlign: 'center'}}>
                                                        <div 
                                                            onClick={() => handleTogglePresenca(f.id, d)}
                                                            style={{
                                                                width: '32px', height: '32px', borderRadius: '6px', margin: '0 auto', cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
                                                                background: status === 'Presença' ? 'var(--revenue)' : 'rgba(255,255,255,0.05)',
                                                                color: status === 'Presença' ? '#fff' : 'transparent',
                                                                border: '1px solid var(--glass-border)'
                                                            }}
                                                            title={status || 'Falta'}
                                                        >
                                                            {status === 'Presença' ? <Check size={16} /> : null}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                            <td style={{...tdStyle, textAlign: 'center', fontWeight: '700', color: totalSemana > 0 ? 'var(--accent-primary)' : 'var(--text-muted)'}}>
                                                {fmt(totalSemana)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}

/* ─── Estoque & Produção (Unified Page) ─── */
function EstoqueProducaoPage() {
    const [abaEstoque, setAbaEstoque] = useState('inventario');
    const [produtos, setProdutos] = useState([]);
    const [producao, setProducao] = useState([]);
    const [loading, setLoading] = useState(true);

    // Produto modals
    const [isProdutoModalOpen, setIsProdutoModalOpen] = useState(false);
    const [selectedProduto, setSelectedProduto] = useState(null);
    const [isEstoqueModalOpen, setIsEstoqueModalOpen] = useState(false);
    const [isImportProdModalOpen, setIsImportProdModalOpen] = useState(false);

    // Produção state
    const [form, setForm] = useState({ data: new Date().toISOString().split('T')[0], produto_nome: '', quantidade: '', unidade_medida: 'Unidades' });
    const [saving, setSaving] = useState(false);
    const [showImportProd, setShowImportProd] = useState(false);
    const [csvText, setCsvText] = useState('');
    const [importing, setImporting] = useState(false);

    const fetchAll = () => {
        setLoading(true);
        Promise.all([
            api.get('/produtos'),
            api.get('/producao')
        ]).then(([pr, pd]) => {
            setProdutos(pr.data || []);
            setProducao(pd.data || []);
        }).catch(console.error).finally(() => setLoading(false));
    };

    useEffect(() => { fetchAll(); }, []);

    // KPIs
    const totalItens = produtos.length;
    const valorTotalEstoque = produtos.reduce((acc, p) => acc + ((p.estoque_atual || 0) * (p.preco_venda || 0)), 0);

    // ── Produção handlers ──
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.produto_nome || !form.quantidade) return alert('Preencha todos os campos (Nome do Produto e Quantidade).');
        setSaving(true);
        try {
            await api.post('/producao', form);
            setForm(f => ({ ...f, produto_nome: '', quantidade: '' }));
            fetchAll();
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao registrar produção');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Remover este registro de produção?')) return;
        try {
            await api.delete(`/producao/${id}`);
            fetchAll();
        } catch (err) {
            alert('Erro ao remover registro.');
        }
    };

    const handleImportCSV = async () => {
        if (!csvText.trim()) return;
        setImporting(true);
        try {
            const lines = csvText.trim().split('\n');
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            const rows = lines.slice(1).map(line => {
                const vals = line.split(',').map(v => v.trim());
                const obj = {};
                headers.forEach((h, i) => { obj[h] = vals[i]; });
                return obj;
            }).filter(r => r.data && r.produto && r.quantidade);

            const { data } = await api.post('/producao/import-bulk', { rows });
            alert(`Importação concluída!\n✅ Importados: ${data.imported}\n❌ Ignorados: ${data.skipped}${data.errors?.length > 0 ? '\n\nErros:\n' + data.errors.join('\n') : ''}`);
            setCsvText('');
            setShowImportProd(false);
            fetchAll();
        } catch (err) {
            alert('Erro na importação.');
        } finally {
            setImporting(false);
        }
    };

    const unidades = ['Unidades', 'Litros', 'KG', 'Sacas', 'Toneladas', 'Metros', 'Caixas'];

    const abas = [
        { key: 'inventario', label: 'Inventário e Catálogo', icon: Package },
        { key: 'producao', label: 'Registrar Produção', icon: Factory },
    ];

    return (
        <div>
            {/* Abas */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid var(--glass-border)' }}>
                {abas.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setAbaEstoque(tab.key)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px',
                            background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600',
                            color: abaEstoque === tab.key ? 'var(--accent-primary)' : 'var(--text-muted)',
                            borderBottom: abaEstoque === tab.key ? '2px solid var(--accent-primary)' : '2px solid transparent',
                            transition: 'all 0.2s',
                        }}
                    >
                        <tab.icon size={16} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* ═══ ABA 1: Inventário e Catálogo ═══ */}
            {abaEstoque === 'inventario' && (
                <div>
                    {/* KPI Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                        <div className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
                                <Package size={24} />
                            </div>
                            <div>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>Total de Itens Cadastrados</p>
                                <h3 style={{ fontSize: '1.75rem', fontWeight: '700' }}>{totalItens}</h3>
                            </div>
                        </div>
                        <div className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                                <TrendingUp size={24} />
                            </div>
                            <div>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '4px' }}>Valor Total em Estoque</p>
                                <h3 style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--revenue)' }}>{fmt(valorTotalEstoque)}</h3>
                            </div>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '16px' }}>
                        <button
                            onClick={() => setIsImportProdModalOpen(true)}
                            className="btn btn-ghost"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--glass-border)' }}
                        >
                            <UploadCloud size={18} /> Importar CSV/Excel
                        </button>
                        <button
                            onClick={() => { setSelectedProduto(null); setIsProdutoModalOpen(true); }}
                            className="btn btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <Plus size={18} /> Novo Produto
                        </button>
                    </div>

                    {/* Modals */}
                    <ProdutoModal
                        isOpen={isProdutoModalOpen}
                        onClose={() => setIsProdutoModalOpen(false)}
                        produto={selectedProduto}
                        onSuccess={fetchAll}
                    />
                    <EstoqueModal
                        isOpen={isEstoqueModalOpen}
                        onClose={() => setIsEstoqueModalOpen(false)}
                        produto={selectedProduto}
                        onSuccess={fetchAll}
                    />
                    <ImportProdutosModal
                        isOpen={isImportProdModalOpen}
                        onClose={() => setIsImportProdModalOpen(false)}
                        onSuccess={fetchAll}
                    />

                    {/* Product Table */}
                    {loading ? <p style={{ color: 'var(--text-muted)' }}>Carregando...</p> : produtos.length === 0 ? (
                        <div className="glass-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
                            <Package size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '8px' }}>Nenhum produto cadastrado</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Cadastre um novo produto acima para gerenciar seu estoque.</p>
                        </div>
                    ) : (
                        <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                        <th style={thStyle}>Produto</th>
                                        <th style={thStyle}>SKU</th>
                                        <th style={thStyle}>Categoria</th>
                                        <th style={{ ...thStyle, textAlign: 'right' }}>Estoque Atual</th>
                                        <th style={{ ...thStyle, textAlign: 'right' }}>Preço</th>
                                        <th style={{ ...thStyle, textAlign: 'center' }}>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {produtos.map(p => (
                                        <tr key={p.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                            <td style={{ ...tdStyle, fontWeight: '600' }}>
                                                {p.nome}
                                                {p.estoque_minimo > 0 && p.estoque_atual <= p.estoque_minimo && (
                                                    <span style={{ marginLeft: '6px', fontSize: '0.65rem', color: 'var(--expense)', border: '1px solid var(--expense)', padding: '2px 4px', borderRadius: '4px' }}>BAIXO</span>
                                                )}
                                            </td>
                                            <td style={tdStyle}><code style={{ fontSize: '0.8rem', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>{p.codigo_sku}</code></td>
                                            <td style={tdStyle}>{p.categoria}</td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', color: p.estoque_atual > 0 ? 'var(--revenue)' : 'var(--expense)' }}>
                                                {p.estoque_atual || 0} un.
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '600' }}>{fmt(p.preco_venda)}</td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                <button onClick={() => { setSelectedProduto(p); setIsEstoqueModalOpen(true); }} className="btn btn-ghost" style={{ padding: '6px', marginRight: '4px' }} title="Ajuste Rápido de Estoque">
                                                    <Package size={16} />
                                                </button>
                                                <button onClick={() => { setSelectedProduto(p); setIsProdutoModalOpen(true); }} className="btn btn-ghost" style={{ padding: '6px' }} title="Editar">
                                                    <Edit2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ═══ ABA 2: Registrar Produção ═══ */}
            {abaEstoque === 'producao' && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '4px' }}>Lançamento de Produção</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Lance os volumes produzidos por produto. O estoque será atualizado automaticamente.</p>
                        </div>
                        <button onClick={() => setShowImportProd(!showImportProd)} className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--glass-border)' }}>
                            <Download size={18} style={{ transform: 'rotate(180deg)' }} /> Importar Planilha
                        </button>
                    </div>

                    {/* Import CSV */}
                    {showImportProd && (
                        <div className="glass-card" style={{ marginBottom: '24px' }}>
                            <h3 style={{ fontWeight: '600', marginBottom: '12px' }}>Importar Planilha de Produção (CSV)</h3>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Formato: <code>Data,Produto,Quantidade,Unidade_Medida</code> (a primeira linha deve ser o cabeçalho)</p>
                            <textarea
                                className="input-field" value={csvText} onChange={e => setCsvText(e.target.value)}
                                placeholder={"Data,Produto,Quantidade\n2026-03-01,Leite,500\n2026-03-01,Queijo,120"}
                                rows={6} style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem', resize: 'vertical' }}
                            />
                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                <button onClick={handleImportCSV} disabled={importing} className="btn btn-primary">
                                    {importing ? 'Importando...' : 'Processar CSV'}
                                </button>
                                <button onClick={() => setShowImportProd(false)} className="btn btn-ghost">Cancelar</button>
                            </div>
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="glass-card" style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
                            <div>
                                <label className="input-label">Data</label>
                                <input className="input-field" type="date" value={form.data}
                                    onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
                            </div>
                            <div>
                                <label className="input-label">Produto</label>
                                <input className="input-field" type="text" list="produtos-list-prod" placeholder="Digite ou selecione..."
                                    value={form.produto_nome || ''}
                                    onChange={e => setForm(f => ({ ...f, produto_nome: e.target.value }))}
                                />
                                <datalist id="produtos-list-prod">
                                    {produtos.map(p => <option key={p.id} value={p.nome} />)}
                                </datalist>
                            </div>
                            <div>
                                <label className="input-label">Quantidade</label>
                                <input className="input-field" type="number" step="0.01" min="0" placeholder="0"
                                    value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} />
                            </div>
                            <div>
                                <label className="input-label">Unidade</label>
                                <select className="input-field" value={form.unidade_medida}
                                    onChange={e => setForm(f => ({ ...f, unidade_medida: e.target.value }))}>
                                    {unidades.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                            <button type="submit" disabled={saving} className="btn btn-primary" style={{ height: '42px', whiteSpace: 'nowrap' }}>
                                <Plus size={16} /> Registrar
                            </button>
                        </div>
                    </form>

                    {/* Table */}
                    {loading ? <p style={{ color: 'var(--text-muted)' }}>Carregando...</p> : producao.length === 0 ? (
                        <div className="glass-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
                            <Factory size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '8px' }}>Nenhum registro de produção</h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Use o formulário acima para lançar a produção.</p>
                        </div>
                    ) : (
                        <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                        <th style={thStyle}>Data</th>
                                        <th style={thStyle}>Produto</th>
                                        <th style={{ ...thStyle, textAlign: 'right' }}>Quantidade</th>
                                        <th style={thStyle}>Unidade</th>
                                        <th style={{ ...thStyle, textAlign: 'center' }}>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {producao.map(p => (
                                        <tr key={p.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                            <td style={tdStyle}>{p.data}</td>
                                            <td style={tdStyle}><span style={{ fontWeight: '600' }}>{p.produto_nome}</span></td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '600', color: 'var(--accent-primary)' }}>
                                                {Number(p.quantidade).toLocaleString('pt-BR')}
                                            </td>
                                            <td style={tdStyle}>{p.unidade_medida}</td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                <button onClick={() => handleDelete(p.id)} className="btn btn-ghost" style={{ padding: '6px', color: 'var(--expense)' }} title="Remover">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}


function TransacoesPage({ onEdit, onImportSuccess, user }) {
    const [transacoes, setTransacoes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tagFilter, setTagFilter] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    const isAdmin = user && (user.role === 'ADMIN' || user.role === 'GERENTE');

    const fetchTransacoes = () => {
        setLoading(true);
        api.get('/transacoes').then(r => setTransacoes(r.data.transacoes || [])).catch(() => { }).finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchTransacoes();
    }, []);

    const handleDelete = async (id) => {
        if (!window.confirm('Tem certeza que deseja excluir esta transação?')) return;
        try {
            await api.delete(`/transacoes/${id}`);
            fetchTransacoes();
            if (onImportSuccess) onImportSuccess();
        } catch (err) {
            if (err.response?.status === 403) {
                alert('Acesso negado. Apenas administradores podem excluir transações.');
            } else {
                alert('Erro ao excluir transação.');
            }
        }
    };

    // Collect all unique tags
    const allTags = [...new Set(transacoes.flatMap(t => (t.tags || '').split(',').map(s => s.trim()).filter(Boolean)))];
    
    let filtered = transacoes;
    if (tagFilter) {
        filtered = filtered.filter(t => (t.tags || '').toLowerCase().includes(tagFilter.toLowerCase()));
    }
    if (searchTerm) {
        const s = searchTerm.toLowerCase();
        filtered = filtered.filter(t => 
            (t.descricao || '').toLowerCase().includes(s) ||
            (t.categoria || '').toLowerCase().includes(s) ||
            (t.produto_nome || '').toLowerCase().includes(s)
        );
    }

    // Filtrar sigilosas para operador (defesa extra no frontend)
    if (!isAdmin) {
        filtered = filtered.filter(t => !CATEGORIAS_SIGILOSAS.includes(t.categoria));
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                    <h2 style={{ fontSize: '1.875rem', fontWeight: '700', marginBottom: '8px' }}>Lançamentos</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Histórico de receitas e despesas.</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input 
                            type="text" 
                            className="input-field" 
                            placeholder="Buscar lançamentos..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={{ paddingLeft: '40px', width: '250px' }}
                        />
                    </div>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="btn btn-ghost"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--glass-border)' }}
                    >
                        <Download size={18} style={{ transform: 'rotate(180deg)' }} /> Importar CSV
                    </button>
                </div>
            </div>

            <ImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={() => {
                    setIsImportModalOpen(false);
                    fetchTransacoes();
                    if (onImportSuccess) onImportSuccess();
                }}
            />

            {/* Tag Filter */}
            {allTags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px', alignItems: 'center' }}>
                    <Tag size={14} style={{ color: 'var(--text-muted)' }} />
                    <button onClick={() => setTagFilter('')} className={!tagFilter ? 'badge badge-revenue' : 'btn btn-ghost'} style={{ padding: '4px 10px', fontSize: '0.7rem' }}>Todas</button>
                    {allTags.map(tag => (
                        <button key={tag} onClick={() => setTagFilter(tag)} className={tagFilter === tag ? 'badge badge-revenue' : 'btn btn-ghost'} style={{ padding: '4px 10px', fontSize: '0.7rem' }}>
                            {tag}
                        </button>
                    ))}
                </div>
            )}

            {loading ? <p style={{ color: 'var(--text-muted)' }}>Carregando...</p> : filtered.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
                    <FileText size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '8px' }}>Nenhum lançamento ainda</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Use o botão "Novo Lançamento" ou Ctrl+N para começar.</p>
                </div>
            ) : (
                <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                <th style={thStyle}>Data</th>
                                <th style={thStyle}>Tipo</th>
                                <th style={thStyle}>Descrição</th>
                                <th style={thStyle}>Categoria</th>
                                <th style={thStyle}>Tags</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Valor</th>
                                <th style={{ ...thStyle, textAlign: 'center' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(t => (
                                <tr key={t.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                    <td style={tdStyle}>{t.data_transacao}</td>
                                    <td style={tdStyle}>
                                        <span className={t.tipo === 'RECEITA' ? 'badge badge-revenue' : 'badge badge-expense'}>{t.tipo}</span>
                                        {t.is_geral && <span style={{ marginLeft: '4px', fontSize: '0.65rem', color: '#7c4dff', fontWeight: '700' }}>GERAL</span>}
                                    </td>
                                    <td style={tdStyle}>{t.descricao || t.produto_nome || '-'}</td>
                                    <td style={tdStyle}>{t.categoria}</td>
                                    <td style={tdStyle}>
                                        {(t.tags || '').split(',').filter(Boolean).map(tag => (
                                            <span key={tag} style={{ display: 'inline-block', background: 'rgba(124,77,255,0.15)', color: '#7c4dff', padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '600', marginRight: '4px' }}>{tag.trim()}</span>
                                        ))}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '600', color: t.tipo === 'RECEITA' ? 'var(--revenue)' : 'var(--expense)' }}>
                                        {t.tipo === 'RECEITA' ? '+' : '-'}{fmt(t.valor)}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'center', display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                        <button onClick={() => onEdit(t)} className="btn btn-ghost" style={{ padding: '6px' }} title="Editar">
                                            <Edit2 size={16} />
                                        </button>
                                        {isAdmin && (
                                            <button onClick={() => handleDelete(t.id)} className="btn btn-ghost" style={{ padding: '6px', color: 'var(--expense)' }} title="Excluir">
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function ClientesPage() {
    const [contatos, setContatos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtro, setFiltro] = useState('todos');
    const [txData, setTxData] = useState([]);
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [abaContato, setAbaContato] = useState('clientes');

    const fetchClientes = (start, end) => {
        setLoading(true);
        let url = '/clientes/with-sales';
        const params = [];
        if (start) params.push(`start=${start}`);
        if (end) params.push(`end=${end}`);
        if (params.length) url += '?' + params.join('&');
        api.get(url).then(r => setContatos(r.data || [])).catch(() => { }).finally(() => setLoading(false));
    };

    useEffect(() => { fetchClientes(); }, []);

    const aplicarFiltro = (tipo) => {
        setFiltro(tipo);
        const now = new Date();
        let start = '', end = now.toISOString().split('T')[0];
        if (tipo === 'todos') { start = ''; end = ''; }
        else if (tipo === '7d') { const d = new Date(now); d.setDate(d.getDate() - 7); start = d.toISOString().split('T')[0]; }
        else if (tipo === '30d') { const d = new Date(now); d.setDate(d.getDate() - 30); start = d.toISOString().split('T')[0]; }
        else if (tipo === '90d') { const d = new Date(now); d.setDate(d.getDate() - 90); start = d.toISOString().split('T')[0]; }
        else if (tipo === '12m') { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); start = d.toISOString().split('T')[0]; }
        else if (tipo === 'custom') { start = dataInicio; end = dataFim; }
        setDataInicio(start); setDataFim(end);
        fetchClientes(start || undefined, end || undefined);
    };

    // Filtrar por tipo_contato
    const clientes = contatos.filter(c => c.tipo_contato === 'Cliente' || !c.tipo_contato);
    const fornecedores = contatos.filter(c => c.tipo_contato === 'Fornecedor');
    const listaAtual = abaContato === 'clientes' ? clientes : fornecedores;
    const totalGeral = listaAtual.reduce((s, c) => s + (c.totalVendido || 0), 0);

    const abas = [
        { key: 'clientes', label: `Clientes (${clientes.length})`, icon: User },
        { key: 'fornecedores', label: `Fornecedores (${fornecedores.length})`, icon: Package },
    ];

    return (
        <div>
            <h2 style={{ fontSize: '1.875rem', fontWeight: '700', marginBottom: '8px' }}>Clientes / Fornecedores</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Gestão de clientes e fornecedores.</p>

            {/* Abas Cliente / Fornecedor */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid var(--glass-border)' }}>
                {abas.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setAbaContato(tab.key)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px',
                            background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600',
                            color: abaContato === tab.key ? 'var(--accent-primary)' : 'var(--text-muted)',
                            borderBottom: abaContato === tab.key ? '2px solid var(--accent-primary)' : '2px solid transparent',
                            transition: 'all 0.2s',
                        }}
                    >
                        <tab.icon size={16} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* Filtros */}
            <div className="glass-card" style={{ marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', marginRight: '8px' }}>Período:</span>
                {[
                    { key: 'todos', label: 'Todo período' },
                    { key: '7d', label: '7 dias' },
                    { key: '30d', label: '30 dias' },
                    { key: '90d', label: '90 dias' },
                    { key: '12m', label: '12 meses' },
                ].map(f => (
                    <button key={f.key} onClick={() => aplicarFiltro(f.key)}
                        className={filtro === f.key ? 'badge badge-revenue' : 'btn btn-ghost'}
                        style={{ padding: '6px 14px', fontSize: '0.8rem', border: filtro === f.key ? 'none' : undefined, cursor: 'pointer' }}>
                        {f.label}
                    </button>
                ))}
                <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', alignItems: 'center' }}>
                    <input type="date" className="input-field" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.8rem', width: '150px' }} />
                    <span style={{ color: 'var(--text-muted)' }}>até</span>
                    <input type="date" className="input-field" value={dataFim} onChange={e => setDataFim(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.8rem', width: '150px' }} />
                    <button onClick={() => aplicarFiltro('custom')} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>Filtrar</button>
                </div>
            </div>

            {/* Total geral */}
            {listaAtual.length > 0 && totalGeral > 0 && (
                <div className="glass-card" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '600' }}>{abaContato === 'clientes' ? 'Total vendido no período' : 'Total comprado no período'}</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: '700', color: abaContato === 'clientes' ? 'var(--revenue)' : 'var(--expense)' }}>{fmt(totalGeral)}</span>
                </div>
            )}

            {loading ? <p style={{ color: 'var(--text-muted)' }}>Carregando...</p> : listaAtual.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
                    <User size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '8px' }}>Nenhum {abaContato === 'clientes' ? 'cliente' : 'fornecedor'} cadastrado</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{abaContato === 'clientes' ? 'Clientes são criados automaticamente ao lançar receitas.' : 'Fornecedores são criados automaticamente ao lançar despesas.'}</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                    {listaAtual.map(c => (
                        <div key={c.id} className="glass-card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: abaContato === 'clientes' ? 'var(--accent-primary)' : 'var(--expense)', border: `1px solid ${abaContato === 'clientes' ? 'var(--accent-primary)' : 'var(--expense)'}`, fontSize: '1.1rem' }}>
                                    {c.nome.charAt(0)}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <p style={{ fontWeight: '600', fontSize: '0.95rem' }}>{c.nome}</p>
                                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{c.tipo_contato || c.tipo} • {c.segmento}</p>
                                </div>
                            </div>
                            <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: '12px', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{abaContato === 'clientes' ? 'Total vendido' : 'Total comprado'}</p>
                                        <p style={{ fontSize: '1.2rem', fontWeight: '700', color: (c.totalVendido || 0) > 0 ? (abaContato === 'clientes' ? 'var(--revenue)' : 'var(--expense)') : 'var(--text-muted)' }}>{fmt(c.totalVendido)}</p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{abaContato === 'clientes' ? 'Vendas' : 'Compras'}</p>
                                        <p style={{ fontSize: '1.2rem', fontWeight: '700' }}>{c.qtdVendas}</p>
                                    </div>
                                </div>
                            </div>
                            {c.email && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>📧 {c.email}</p>}
                            {c.telefone && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>📞 {c.telefone}</p>}
                            {c.documento && <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>📄 {c.documento}</p>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

/* ProdutosPage removed — merged into EstoqueProducaoPage above */

/* ─── Análise de Produtos ─── */
function AnaliseProdutosPage() {
    const [analise, setAnalise] = useState([]);
    const [globalBreakEven, setGlobalBreakEven] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filtro, setFiltro] = useState('todos');
    const [txData, setTxData] = useState([]);
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [xrayProduct, setXrayProduct] = useState(null); // product X-Ray modal
    const [ocultarExtremos, setOcultarExtremos] = useState(true);



    const fetchAnalise = (start, end) => {
        setLoading(true);
        let url = '/transacoes/analise-produtos';
        const params = [];
        if (start) params.push(`start=${start}`);
        if (end) params.push(`end=${end}`);
        if (params.length) url += '?' + params.join('&');
        api.get(url).then(r => {
            setAnalise(r.data?.produtos || []);
            setGlobalBreakEven(r.data?.globalBreakEven || 0);
        }).catch(() => { }).finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchAnalise();
        api.get('/transacoes?limit=1000').then(r => setTxData(r.data?.transacoes || [])).catch(() => {});
    }, []);

    const aplicarFiltro = (tipo) => {
        setFiltro(tipo);
        const now = new Date();
        let start = '', end = now.toISOString().split('T')[0];
        if (tipo === 'todos') { start = ''; end = ''; }
        else if (tipo === '30d') { const d = new Date(now); d.setDate(d.getDate() - 30); start = d.toISOString().split('T')[0]; }
        else if (tipo === '90d') { const d = new Date(now); d.setDate(d.getDate() - 90); start = d.toISOString().split('T')[0]; }
        else if (tipo === '12m') { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); start = d.toISOString().split('T')[0]; }
        else if (tipo === 'custom') { start = dataInicio; end = dataFim; }
        setDataInicio(start); setDataFim(end);
        fetchAnalise(start || undefined, end || undefined);
    };

    const xrayColors = ['#ef4444', '#f97316', '#f59e0b', '#ec4899', '#8b5cf6', '#6366f1', '#14b8a6', '#06b6d4', '#84cc16', '#a855f7'];
    
    // Ultimate safety for data calculations
    const safeAnalise = Array.isArray(analise) ? analise : [];
    const allAlerts = safeAnalise.flatMap(p => (Array.isArray(p?.alerts) ? p.alerts : []).map(a => ({ ...a, produto: p?.nome || '???' })));
    const drenoProducts = safeAnalise.filter(p => p?.dreno);

    return (
        <div>
            <h2 style={{ fontSize: '1.875rem', fontWeight: '700', marginBottom: '8px' }}>Análise de Produtos</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Rentabilidade, margem, ROI e inteligência de custos.</p>

            <div style={{ background: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', fontSize: '0.85rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Activity size={18} />
                <span><strong>Dica:</strong> Apenas produtos com vendas ou produção registrados aparecem aqui. Despesas gerais e manutenções podem ser consultadas em <strong>Lançamentos</strong>.</span>
            </div>

            {/* Filtros */}
            <div className="glass-card" style={{ marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', marginRight: '8px' }}>Período:</span>
                {[
                    { key: 'todos', label: 'Todo período' },
                    { key: '30d', label: '30 dias' },
                    { key: '90d', label: '90 dias' },
                    { key: '12m', label: '12 meses' },
                ].map(f => (
                    <button key={f.key} onClick={() => aplicarFiltro(f.key)}
                        className={filtro === f.key ? 'badge badge-revenue' : 'btn btn-ghost'}
                        style={{ padding: '6px 14px', fontSize: '0.8rem', border: filtro === f.key ? 'none' : undefined, cursor: 'pointer' }}>
                        {f.label}
                    </button>
                ))}
                <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', alignItems: 'center' }}>
                    <input type="date" className="input-field" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.8rem', width: '150px' }} />
                    <span style={{ color: 'var(--text-muted)' }}>até</span>
                    <input type="date" className="input-field" value={dataFim} onChange={e => setDataFim(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.8rem', width: '150px' }} />
                    <button onClick={() => aplicarFiltro('custom')} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>Filtrar</button>
                    
                    <div style={{ marginLeft: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="checkbox" checked={ocultarExtremos} onChange={e => setOcultarExtremos(e.target.checked)} id="extremos-produtos" style={{ cursor: 'pointer', width: '18px', height: '18px' }} />
                        <label htmlFor="extremos-produtos" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: '600' }}>Ocultar Extremos</label>
                    </div>
                </div>
            </div>

            {/* Cost Alerts */}
            {allAlerts.length > 0 && (
                <div className="glass-card" style={{ marginBottom: '24px', borderLeft: '3px solid var(--expense)' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '1.2rem' }}>⚠️</span> Alertas de Custo
                    </h3>
                    <div style={{ display: 'grid', gap: '8px' }}>
                        {allAlerts.map((a, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                                <span style={{ fontSize: '1.1rem' }}>🔺</span>
                                <div style={{ flex: 1 }}>
                                    <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>{a.produto}</span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}> — O custo com </span>
                                    <span style={{ fontWeight: '600', color: 'var(--expense)', fontSize: '0.85rem' }}>{a.categoria}</span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}> aumentou </span>
                                    <span style={{ fontWeight: '700', color: 'var(--expense)', fontSize: '0.85rem' }}>{a.crescimento}%</span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}> este mês</span>
                                </div>
                                <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    {fmt(a.anterior)} → {fmt(a.atual)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Dreno Alerts */}
            {drenoProducts.length > 0 && (
                <div className="glass-card" style={{ marginBottom: '24px', borderLeft: '3px solid #f59e0b' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertTriangle size={20} style={{ color: '#f59e0b' }} /> Drenos Detectados
                    </h3>
                    <div style={{ display: 'grid', gap: '8px' }}>
                        {drenoProducts.map(p => (
                            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                                <span style={{ fontSize: '1.1rem' }}>💧</span>
                                <div style={{ flex: 1 }}>
                                    <span style={{ fontWeight: '600', fontSize: '0.85rem' }}>{p.nome}</span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}> — Dreno detectado: aumento súbito nos custos de produção. </span>
                                    <span style={{ fontWeight: '600', color: '#f59e0b', fontSize: '0.85rem' }}>Média: {fmt(p.custoMedioMesAnterior)} → {fmt(p.custoMedioMes)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {loading ? <p style={{ color: 'var(--text-muted)' }}>Carregando...</p> : safeAnalise.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
                    <BarChart3 size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '8px' }}>Nenhum dado de produto</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Lance receitas e despesas com centros de custo para ver a análise.</p>
                </div>
            ) : (
                <>
                    {/* Tabela ROI Comparativa */}
                    <div className="glass-card" style={{ overflow: 'auto', padding: 0, marginBottom: '24px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                    <th style={thStyle}>Produto</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>Vendas</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>Custo</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>ROI</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>Margem Esperada</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>Margem Realizada</th>
                                    <th style={{ ...thStyle, textAlign: 'right' }}>Desvio</th>
                                    <th style={{ ...thStyle, textAlign: 'center' }}>Raio-X</th>
                                </tr>
                            </thead>
                            <tbody>
                                {safeAnalise.map(p => (
                                    <tr key={p?.id || Math.random()} style={{ borderBottom: '1px solid var(--glass-border)', background: p?.desvioAlerta ? 'rgba(239, 68, 68, 0.04)' : undefined }}>
                                        <td style={{ ...tdStyle, fontWeight: '600' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {p?.desvioAlerta && <span title="Desvio de margem > 10%">⚠️</span>}
                                                <div>
                                                    {p?.nome || 'Sem nome'}
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{p?.sku || '-'} • Qtd: {p?.qtdVendida || 0}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--revenue)', fontWeight: '600' }}>{fmt(p?.vendasTotal)}</td>
                                        <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--expense)', fontWeight: '600' }}>{fmt(p?.custoTotal)}</td>
                                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700' }}>
                                            <span style={{ color: (p?.roi || 0) >= 0 ? 'var(--revenue)' : 'var(--expense)' }}>{Number(p?.roi) > 900 ? '∞' : (p?.roi || 0) + '%'}</span>
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                                            <span style={{ color: 'var(--accent-primary)', fontWeight: '600' }}>{p?.margemEsperada || 0}%</span>
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                                            <span className={(p?.margemRealizada || 0) >= 0 ? 'badge badge-revenue' : 'badge badge-expense'} style={{ fontSize: '0.8rem' }}>
                                                {p?.margemRealizada || 0}%
                                            </span>
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'right' }}>
                                            <span style={{ fontWeight: '700', color: p?.desvioAlerta ? 'var(--expense)' : (p?.desvio || 0) >= 0 ? 'var(--revenue)' : 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                {(p?.desvio || 0) > 0 ? '+' : ''}{p?.desvio || 0}%
                                            </span>
                                        </td>
                                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', alignItems: 'center' }}>
                                                {p?.dreno && <span title="Dreno detectado" style={{ color: '#f59e0b', cursor: 'help' }}>💧</span>}
                                                <button onClick={() => { console.log('Opening X-Ray for', p?.nome); setXrayProduct(p); }} className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                                                    🔍 Ver
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Margin Chart */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '24px' }}>
                        <div className="glass-card" style={{ height: Math.max(300, safeAnalise.length * 50 + 80) + 'px' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '24px' }}>📊 Margem de Lucro por Produto</h3>
                            <div style={{ height: Math.max(200, safeAnalise.length * 50) + 'px' }}>
                                <MarginBarChart products={safeAnalise.map(p => ({ ...p, margem: p?.margemRealizada || 0 }))} />
                            </div>
                        </div>
                    </div>

                    {/* Receita vs Despesa por Dia */}
                    <div style={{ marginBottom: '24px' }}>
                        <div className="glass-card" style={{ height: '340px' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '20px' }}>📈 Receita vs Despesa por Data</h3>
                            <div style={{ height: '260px' }}>
                                <RevenueExpenseLineChart transacoes={ocultarExtremos ? txData.filter(t => t.valor < 100000) : txData} />
                            </div>
                        </div>
                    </div>

                    {/* Break-even Global */}
                    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px', marginBottom: '32px', borderTop: '4px solid var(--accent-primary)' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '800', marginBottom: '8px', color: 'var(--text-primary)' }}>🎯 Ponto de Equilíbrio (Break-Even Global)</h3>
                        <h2 style={{ fontSize: '2.5rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
                            {fmt(globalBreakEven)}
                        </h2>
                        <span style={{ background: 'rgba(124, 77, 255, 0.1)', color: 'var(--accent-primary)', padding: '6px 14px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: '700', marginTop: '16px' }}>
                            Faturamento mínimo necessário para cobrir custos fixos
                        </span>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '8px', textAlign: 'center', maxWidth: '600px', lineHeight: '1.5' }}>
                            Com base na Margem de Contribuição Média do portfólio.
                        </p>
                    </div>
                </>
            )}

            {/* Product X-Ray Modal */}
            {xrayProduct && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                    <div onClick={() => setXrayProduct(null)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)' }} />
                    <div className="glass-card" style={{ position: 'relative', zIndex: 60, maxWidth: '600px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '700' }}>🔬 Raio-X: {xrayProduct.nome}</h2>
                            <button onClick={() => setXrayProduct(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.5rem' }}>✕</button>
                        </div>

                        {/* KPIs do produto */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
                            {[
                                { label: 'Receita Total', value: fmt(xrayProduct.vendasTotal), color: 'var(--revenue)' },
                                { label: 'Custo Total', value: fmt(xrayProduct.custoTotal), color: 'var(--expense)' },
                                { label: 'Margem', value: xrayProduct.margemRealizada + '%', color: xrayProduct.margemRealizada >= 0 ? 'var(--revenue)' : 'var(--expense)' },
                                { label: 'ROI', value: (xrayProduct.roi > 900 ? '∞' : xrayProduct.roi + '%'), color: xrayProduct.roi >= 0 ? 'var(--revenue)' : 'var(--expense)' },
                            ].map(k => (
                                <div key={k.label} style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: '12px', textAlign: 'center' }}>
                                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>{k.label}</p>
                                    <p style={{ fontSize: '1.1rem', fontWeight: '700', color: k.color }}>{k.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Expense Breakdown Donut */}
                        <h3 style={{ fontWeight: '700', fontSize: '1rem', marginBottom: '16px' }}>Distribuição de Custos</h3>
                        {(xrayProduct.expenseBreakdown || []).length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px' }}>Nenhuma despesa vinculada a este produto.</p>
                        ) : (
                            <>
                                <div style={{ height: '200px', marginBottom: '16px' }}>
                                    <ExpenseBreakdownChart data={{ categorias: (xrayProduct.expenseBreakdown || []).map((c, i) => ({ ...c, percentual: xrayProduct.custoTotal > 0 ? +((c.valor / xrayProduct.custoTotal) * 100).toFixed(1) : 0 })) }} />
                                </div>
                                <div>
                                    {(xrayProduct.expenseBreakdown || []).map((c, i) => (
                                        <div key={c.categoria} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid var(--glass-border)' }}>
                                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0, background: xrayColors[i % xrayColors.length] }} />
                                            <span style={{ fontSize: '0.85rem', flex: 1 }}>{c.categoria}</span>
                                            <span style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{fmt(c.valor)}</span>
                                            <span style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--expense)', minWidth: '45px', textAlign: 'right' }}>
                                                {xrayProduct.custoTotal > 0 ? ((c.valor / xrayProduct.custoTotal) * 100).toFixed(1) : 0}%
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* Margin Comparison */}
                        <div style={{ marginTop: '20px', padding: '16px', borderRadius: 'var(--radius-sm)', background: xrayProduct.desvioAlerta ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-tertiary)', border: xrayProduct.desvioAlerta ? '1px solid rgba(239, 68, 68, 0.2)' : 'none' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', textAlign: 'center' }}>
                                <div>
                                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Margem Esperada</p>
                                    <p style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--accent-primary)' }}>{xrayProduct.margemEsperada}%</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Margem Realizada</p>
                                    <p style={{ fontSize: '1.2rem', fontWeight: '700', color: xrayProduct.margemRealizada >= 0 ? 'var(--revenue)' : 'var(--expense)' }}>{xrayProduct.margemRealizada}%</p>
                                </div>
                                <div>
                                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Desvio</p>
                                    <p style={{ fontSize: '1.2rem', fontWeight: '700', color: xrayProduct.desvioAlerta ? 'var(--expense)' : xrayProduct.desvio >= 0 ? 'var(--revenue)' : 'var(--text-secondary)' }}>
                                        {xrayProduct.desvioAlerta && '⚠️ '}{xrayProduct.desvio > 0 ? '+' : ''}{xrayProduct.desvio}%
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Product Alerts */}
                        {(xrayProduct.alerts || []).length > 0 && (
                            <div style={{ marginTop: '16px' }}>
                                <h4 style={{ fontWeight: '700', fontSize: '0.9rem', marginBottom: '8px' }}>⚠️ Alertas</h4>
                                {(xrayProduct.alerts || []).map((a, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.06)', marginBottom: '4px', fontSize: '0.8rem' }}>
                                        <span>🔺</span>
                                        <span style={{ color: 'var(--text-secondary)' }}>Custo com <b style={{ color: 'var(--expense)' }}>{a.categoria}</b> subiu <b style={{ color: 'var(--expense)' }}>{a.crescimento}%</b> ({fmt(a.anterior)} → {fmt(a.atual)})</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Calendário Financeiro ─── */
function CalendarioPage() {
    const [transacoes, setTransacoes] = useState([]);
    const [saldoAtual, setSaldoAtual] = useState(0);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(() => {
        const now = new Date(2026, 2, 1); // March 2026 (month is 0-indexed)
        return now;
    });
    const [tooltip, setTooltip] = useState(null); // { day, items, x, y }

    useEffect(() => {
        Promise.all([
            api.get('/transacoes'),
            api.get('/dashboard/fluxo-caixa')
        ]).then(([t, f]) => {
            setTransacoes(t.data.transacoes || []);
            setSaldoAtual(f.data?.saldoAtual || 0);
        }).catch(console.error).finally(() => setLoading(false));
    }, []);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth(); // 0-indexed

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    // Build day-keyed event map for the current month
    // key: 'YYYY-MM-DD', value: { aPagar: [], aReceber: [], pagas: [] }
    const eventMap = React.useMemo(() => {
        const map = {};
        const padDate = (d) => String(d).padStart(2, '0');
        const monthStr = `${year}-${padDate(month + 1)}`;

        transacoes.forEach(t => {
            // Determine which date to plot on
            let dateKey = null;
            if (t.tipo === 'DESPESA') {
                // Use data_vencimento if available, else data_transacao
                const raw = t.data_vencimento || t.data_transacao;
                if (raw && raw.startsWith(monthStr)) dateKey = raw;
            } else if (t.tipo === 'RECEITA' && t.status_pagamento === 'PENDENTE') {
                const raw = t.data_vencimento || t.data_transacao;
                if (raw && raw.startsWith(monthStr)) dateKey = raw;
            } else if (t.tipo === 'RECEITA' && t.status_pagamento === 'PAGO') {
                const raw = t.data_transacao;
                if (raw && raw.startsWith(monthStr)) dateKey = raw;
            }
            if (!dateKey) return;
            if (!map[dateKey]) map[dateKey] = { aPagar: [], aReceber: [], pagas: [] };
            const label = t.descricao || t.produto_nome || t.categoria || '-';
            const entry = { label, valor: t.valor, tipo: t.tipo, status: t.status_pagamento };
            if (t.tipo === 'DESPESA') map[dateKey].aPagar.push(entry);
            else if (t.tipo === 'RECEITA' && t.status_pagamento === 'PENDENTE') map[dateKey].aReceber.push(entry);
            else if (t.tipo === 'RECEITA' && t.status_pagamento === 'PAGO') map[dateKey].pagas.push(entry);
        });
        return map;
    }, [transacoes, year, month]);

    // Month summary totals
    const { totalAReceber, totalAPagar, totalPagas } = React.useMemo(() => {
        let rec = 0, pag = 0, pagas = 0;
        Object.values(eventMap).forEach(day => {
            day.aReceber.forEach(e => rec += e.valor);
            day.aPagar.forEach(e => pag += e.valor);
            day.pagas.forEach(e => pagas += e.valor);
        });
        return { totalAReceber: rec, totalAPagar: pag, totalPagas: pagas };
    }, [eventMap]);

    const saldoProjetado = totalPagas + totalAReceber - totalAPagar;

    // Build calendar grid
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    // Convert to Mon-start (0=Mon, 6=Sun)
    const startOffset = (firstDay + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const isToday = (d) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

    const padDate = (d) => String(d).padStart(2, '0');
    const dateKey = (d) => `${year}-${padDate(month + 1)}-${padDate(d)}`;

    const handleMouseEnter = (e, day) => {
        const key = dateKey(day);
        const events = eventMap[key];
        if (!events) return;
        const allItems = [
            ...events.aPagar.map(i => ({ ...i, dot: 'red' })),
            ...events.aReceber.map(i => ({ ...i, dot: 'green' })),
            ...events.pagas.map(i => ({ ...i, dot: 'blue' })),
        ];
        if (allItems.length === 0) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const mainEl = document.querySelector('main');
        const mainRect = mainEl ? mainEl.getBoundingClientRect() : { left: 0, top: 0 };
        setTooltip({
            day,
            items: allItems,
            x: rect.left - mainRect.left,
            y: rect.bottom - mainRect.top + 8,
        });
    };

    const handleMouseLeave = () => setTooltip(null);

    const dotColors = { red: '#ef4444', green: '#10b981', blue: '#60a5fa' };
    const dotLabels = { red: '🔴', green: '🟢', blue: '🔵' };

    return (
        <div style={{ position: 'relative' }}>
            {/* Month Summary Panel */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
                <div className="glass-card" style={{ textAlign: 'center', borderTop: '3px solid #10b981' }}>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>🟢 A Receber</p>
                    <p style={{ fontSize: '1.6rem', fontWeight: '800', color: '#10b981' }}>{fmt(totalAReceber)}</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Receitas pendentes no mês</p>
                </div>
                <div className="glass-card" style={{ textAlign: 'center', borderTop: '3px solid #ef4444' }}>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>🔴 A Pagar</p>
                    <p style={{ fontSize: '1.6rem', fontWeight: '800', color: '#ef4444' }}>{fmt(totalAPagar)}</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Despesas pendentes no mês</p>
                </div>
                <div className="glass-card" style={{ textAlign: 'center', borderTop: `3px solid ${saldoProjetado >= 0 ? 'var(--accent-primary)' : '#ef4444'}` }}>
                    <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>âš¡ Saldo Projetado</p>
                    <p style={{ fontSize: '1.6rem', fontWeight: '800', color: saldoProjetado >= 0 ? 'var(--accent-primary)' : '#ef4444' }}>{fmt(saldoProjetado)}</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Saldo projetado ao fim do mês</p>
                </div>
            </div>

            {/* Calendar Card */}
            <div className="glass-card" style={{ padding: '24px' }}>
                {/* Header: month nav */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <button onClick={prevMonth} className="btn btn-ghost" style={{ padding: '8px 12px' }}>
                        <ChevronLeft size={20} />
                    </button>
                    <h3 style={{ fontSize: '1.35rem', fontWeight: '800', letterSpacing: '-0.3px' }}>
                        {monthNames[month]} <span style={{ color: 'var(--accent-primary)' }}>{year}</span>
                    </h3>
                    <button onClick={nextMonth} className="btn btn-ghost" style={{ padding: '8px 12px' }}>
                        <ChevronRight size={20} />
                    </button>
                </div>

                {loading ? <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>Carregando...</p> : (
                    <>
                        {/* Day-of-week headers */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px' }}>
                            {dayNames.map(d => (
                                <div key={d} style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '6px 0', letterSpacing: '0.5px' }}>{d}</div>
                            ))}
                        </div>

                        {/* Day grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                            {/* Empty cells before first day */}
                            {Array.from({ length: startOffset }).map((_, i) => (
                                <div key={`empty-${i}`} style={{ minHeight: '80px', borderRadius: 'var(--radius-sm)', background: 'rgba(255,255,255,0.01)' }} />
                            ))}

                            {/* Day cells */}
                            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                                const key = dateKey(day);
                                const events = eventMap[key] || { aPagar: [], aReceber: [], pagas: [] };
                                const hasEvents = events.aPagar.length + events.aReceber.length + events.pagas.length > 0;
                                const todayCell = isToday(day);

                                return (
                                    <div
                                        key={day}
                                        onMouseEnter={hasEvents ? (e) => handleMouseEnter(e, day) : undefined}
                                        onMouseLeave={hasEvents ? handleMouseLeave : undefined}
                                        style={{
                                            minHeight: '80px',
                                            padding: '8px',
                                            borderRadius: 'var(--radius-sm)',
                                            background: todayCell
                                                ? 'rgba(124, 77, 255, 0.12)'
                                                : hasEvents
                                                    ? 'rgba(255,255,255,0.03)'
                                                    : 'rgba(255,255,255,0.015)',
                                            border: todayCell
                                                ? '1.5px solid var(--accent-primary)'
                                                : '1px solid var(--glass-border)',
                                            cursor: hasEvents ? 'pointer' : 'default',
                                            transition: 'background 0.15s, border-color 0.15s',
                                            boxShadow: todayCell ? '0 0 12px rgba(124,77,255,0.25)' : 'none',
                                            position: 'relative',
                                        }}
                                    >
                                        {/* Day number */}
                                        <span style={{
                                            fontSize: '0.85rem',
                                            fontWeight: todayCell ? '800' : '600',
                                            color: todayCell ? 'var(--accent-primary)' : 'var(--text-primary)',
                                            display: 'block',
                                            marginBottom: '6px',
                                        }}>
                                            {day}{todayCell && <span style={{ fontSize: '0.55rem', marginLeft: '4px', verticalAlign: 'middle', color: 'var(--accent-primary)' }}>hoje</span>}
                                        </span>

                                        {/* Dots */}
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {events.aPagar.length > 0 && (
                                                <span title={`${events.aPagar.length} a pagar`} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block', boxShadow: '0 0 6px rgba(239,68,68,0.7)' }} />
                                                    {events.aPagar.length > 1 && <span style={{ fontSize: '0.6rem', color: '#ef4444', fontWeight: '700' }}>{events.aPagar.length}</span>}
                                                </span>
                                            )}
                                            {events.aReceber.length > 0 && (
                                                <span title={`${events.aReceber.length} a receber`} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: '0 0 6px rgba(16,185,129,0.7)' }} />
                                                    {events.aReceber.length > 1 && <span style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: '700' }}>{events.aReceber.length}</span>}
                                                </span>
                                            )}
                                            {events.pagas.length > 0 && (
                                                <span title={`${events.pagas.length} vendas pagas`} style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#60a5fa', display: 'inline-block', boxShadow: '0 0 6px rgba(96,165,250,0.7)' }} />
                                                    {events.pagas.length > 1 && <span style={{ fontSize: '0.6rem', color: '#60a5fa', fontWeight: '700' }}>{events.pagas.length}</span>}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Legend */}
                        <div style={{ display: 'flex', gap: '20px', marginTop: '20px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            {[{ dot: '#ef4444', label: 'Despesas' }, { dot: '#10b981', label: 'A Receber (receita pendente)' }, { dot: '#60a5fa', label: 'Venda Realizada (paga)' }].map(l => (
                                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: l.dot, display: 'inline-block', flexShrink: 0, boxShadow: `0 0 6px ${l.dot}99` }} />
                                    {l.label}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Tooltip Popover */}
            {tooltip && (
                <div
                    onMouseEnter={() => { }} onMouseLeave={handleMouseLeave}
                    style={{
                        position: 'absolute',
                        left: Math.min(tooltip.x, window.innerWidth - 320) + 'px',
                        top: tooltip.y + 'px',
                        zIndex: 100,
                        background: 'rgba(20, 20, 28, 0.97)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '14px 18px',
                        minWidth: '260px',
                        maxWidth: '340px',
                        boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
                        backdropFilter: 'blur(12px)',
                        pointerEvents: 'none',
                    }}
                >
                    <p style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {padDate(tooltip.day)}/{padDate(month + 1)}/{year}
                    </p>
                    <div style={{ display: 'grid', gap: '7px' }}>
                        {tooltip.items.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: dotColors[item.dot], flexShrink: 0, boxShadow: `0 0 5px ${dotColors[item.dot]}` }} />
                                <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {item.label}
                                    {item.dot === 'blue' && <span style={{ color: '#10b981', marginLeft: '6px', fontSize: '0.75rem' }}>Recebido ✅</span>}
                                </span>
                                <span style={{ fontSize: '0.82rem', fontWeight: '700', color: item.dot === 'red' ? '#ef4444' : item.dot === 'green' ? '#10b981' : '#60a5fa', flexShrink: 0 }}>
                                    {item.dot === 'red' ? '-' : '+'}{fmt(item.valor)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}



function ConfigPage({ user }) {
    const [wipePeriod, setWipePeriod] = useState('todos');
    const [configTab, setConfigTab] = useState('perfil');

    // Equipe state
    const [equipe, setEquipe] = useState([]);
    const [equipeLoading, setEquipeLoading] = useState(false);
    const [newUser, setNewUser] = useState({ nome: '', email: '', senha: '', role: 'OPERADOR' });
    const [addingUser, setAddingUser] = useState(false);

    const fetchEquipe = () => {
        setEquipeLoading(true);
        api.get('/equipe').then(r => setEquipe(r.data || [])).catch(console.error).finally(() => setEquipeLoading(false));
    };

    useEffect(() => {
        if (configTab === 'equipe') fetchEquipe();
    }, [configTab]);

    const handleAddUser = async () => {
        if (!newUser.nome || !newUser.email || !newUser.senha) {
            return alert('Preencha todos os campos.');
        }
        setAddingUser(true);
        try {
            await api.post('/equipe', newUser);
            setNewUser({ nome: '', email: '', senha: '', role: 'OPERADOR' });
            fetchEquipe();
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao criar usuário');
        } finally {
            setAddingUser(false);
        }
    };

    const handleChangeRole = async (id, newRole) => {
        try {
            await api.put(`/equipe/${id}`, { role: newRole });
            fetchEquipe();
        } catch (err) {
            alert('Erro ao atualizar perfil.');
        }
    };

    const handleDeactivate = async (id) => {
        if (!window.confirm('Desativar este usuário?')) return;
        try {
            await api.delete(`/equipe/${id}`);
            fetchEquipe();
        } catch (err) {
            alert(err.response?.data?.error || 'Erro ao desativar usuário.');
        }
    };

    const handleWipeDatabase = async () => {
        const confirm1 = window.confirm("ATENÇÃO: Você está prestes a apagar os lançamentos deste período, BEM COMO todos os clientes e produtos cadastrados. Deseja continuar?");
        if (!confirm1) return;
        const confirm2 = window.confirm("Tem certeza absoluta? Digite OK para confirmar a limpeza geral.");
        if (confirm2) {
            try {
                await api.delete(`/dashboard/wipe?period=${wipePeriod}`);
                alert('Lançamentos removidos com sucesso! A página será recarregada.');
                window.location.reload();
            } catch (err) {
                alert('Erro ao limpar banco de dados.');
            }
        }
    };

    const tabs = [
        { key: 'perfil', label: 'Perfil', icon: User },
        { key: 'equipe', label: 'Equipe', icon: Users },
        { key: 'dados', label: 'Limpeza de Dados', icon: AlertTriangle },
    ];

    return (
        <div>
            <h2 style={{ fontSize: '1.875rem', fontWeight: '700', marginBottom: '8px' }}>Configurações</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Gerencie as configurações do sistema.</p>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '24px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0' }}>
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setConfigTab(tab.key)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px',
                            background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '600',
                            color: configTab === tab.key ? 'var(--accent-primary)' : 'var(--text-muted)',
                            borderBottom: configTab === tab.key ? '2px solid var(--accent-primary)' : '2px solid transparent',
                            transition: 'all 0.2s',
                        }}
                    >
                        <tab.icon size={16} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab: Perfil */}
            {configTab === 'perfil' && (
                <div className="glass-card" style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontWeight: '600', marginBottom: '16px' }}>Perfil do Usuário</h3>
                    <div style={{ display: 'grid', gap: '12px' }}>
                        <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Nome</span><p style={{ fontWeight: '600' }}>{user.nome}</p></div>
                        <div><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Email</span><p style={{ fontWeight: '600' }}>{user.email}</p></div>
                        <div>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Função</span>
                            <p style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Shield size={16} style={{ color: user.role === 'ADMIN' ? '#7c4dff' : '#10b981' }} />
                                {user.role === 'ADMIN' ? 'Administrador (Dono)' : user.role === 'GERENTE' ? 'Gerente' : 'Operador (Funcionário)'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab: Equipe */}
            {configTab === 'equipe' && (
                <div>
                    {/* Add user form */}
                    <div className="glass-card" style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontWeight: '600', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <UserPlus size={20} /> Convidar Novo Membro
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto auto', gap: '12px', alignItems: 'end' }}>
                            <div>
                                <label className="input-label">Nome</label>
                                <input className="input-field" placeholder="Nome completo" value={newUser.nome}
                                    onChange={e => setNewUser(p => ({ ...p, nome: e.target.value }))} />
                            </div>
                            <div>
                                <label className="input-label">Email</label>
                                <input className="input-field" type="email" placeholder="email@empresa.com" value={newUser.email}
                                    onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} />
                            </div>
                            <div>
                                <label className="input-label">Senha</label>
                                <input className="input-field" type="password" placeholder="Senha inicial" value={newUser.senha}
                                    onChange={e => setNewUser(p => ({ ...p, senha: e.target.value }))} />
                            </div>
                            <div>
                                <label className="input-label">Perfil</label>
                                <select className="input-field" value={newUser.role}
                                    onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
                                    <option value="OPERADOR">Operador</option>
                                    <option value="ADMIN">Admin</option>
                                </select>
                            </div>
                            <button onClick={handleAddUser} disabled={addingUser} className="btn btn-primary" style={{ height: '42px', whiteSpace: 'nowrap' }}>
                                <Plus size={16} /> Adicionar
                            </button>
                        </div>
                    </div>

                    {/* Team list */}
                    <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)' }}>
                            <h3 style={{ fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                                <Users size={20} /> Membros da Equipe ({equipe.filter(u => u.ativo === 1).length})
                            </h3>
                        </div>
                        {equipeLoading ? <p style={{ padding: '20px', color: 'var(--text-muted)' }}>Carregando...</p> : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                        <th style={thStyle}>Nome</th>
                                        <th style={thStyle}>Email</th>
                                        <th style={thStyle}>Perfil</th>
                                        <th style={thStyle}>Status</th>
                                        <th style={{ ...thStyle, textAlign: 'center' }}>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {equipe.map(u => (
                                        <tr key={u.id} style={{ borderBottom: '1px solid var(--glass-border)', opacity: u.ativo === 1 ? 1 : 0.5 }}>
                                            <td style={tdStyle}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{
                                                        width: '32px', height: '32px', borderRadius: '50%',
                                                        background: u.role === 'ADMIN' ? 'rgba(124,77,255,0.15)' : 'rgba(16,185,129,0.15)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        color: u.role === 'ADMIN' ? '#7c4dff' : '#10b981', fontWeight: '700', fontSize: '0.8rem'
                                                    }}>
                                                        {u.nome.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span style={{ fontWeight: '600' }}>{u.nome}</span>
                                                </div>
                                            </td>
                                            <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <Mail size={14} /> {u.email}
                                                </span>
                                            </td>
                                            <td style={tdStyle}>
                                                <select className="input-field" value={u.role}
                                                    onChange={e => handleChangeRole(u.id, e.target.value)}
                                                    disabled={u.id === user.id}
                                                    style={{ padding: '4px 8px', fontSize: '0.8rem', width: '130px', background: u.role === 'ADMIN' ? 'rgba(124,77,255,0.1)' : 'rgba(16,185,129,0.1)' }}>
                                                    <option value="ADMIN">Admin</option>
                                                    <option value="OPERADOR">Operador</option>
                                                </select>
                                            </td>
                                            <td style={tdStyle}>
                                                <span className={u.ativo === 1 ? 'badge badge-revenue' : 'badge badge-expense'}
                                                    style={{ fontSize: '0.7rem' }}>
                                                    {u.ativo === 1 ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                {u.id !== user.id && u.ativo === 1 && (
                                                    <button onClick={() => handleDeactivate(u.id)} className="btn btn-ghost" style={{ padding: '6px', color: 'var(--expense)' }} title="Desativar">
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Tab: Limpeza */}
            {configTab === 'dados' && (
                <div className="glass-card" style={{ border: '1px solid var(--expense)', background: 'rgba(239, 68, 68, 0.05)' }}>
                    <h3 style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--expense)' }}>Limpeza de Dados</h3>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                        Utilize este painel para apagar transações em lote baseado na data de registro.
                        <strong>Atenção:</strong> Os cadastros de Clientes e Produtos também serão apagados para manter a consistência.
                    </p>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <select className="input-field" value={wipePeriod} onChange={(e) => setWipePeriod(e.target.value)} style={{ width: '220px' }}>
                            <option value="todos">Todo o período</option>
                            <option value="7d">Últimos 7 dias</option>
                            <option value="30d">Últimos 30 dias</option>
                            <option value="12m">Últimos 12 meses</option>
                        </select>
                        <button onClick={handleWipeDatabase} className="btn" style={{ background: 'var(--expense)', color: '#fff', padding: '10px 24px' }}>
                            <AlertTriangle size={18} style={{ marginRight: '8px' }} /> Limpar Registros
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}


const marketShareColors = ['#7c4dff', '#00e5ff', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#3b82f6', '#06b6d4', '#14b8a6'];
const expenseColors = ['#ef4444', '#f97316', '#f59e0b', '#ec4899', '#8b5cf6', '#6366f1', '#14b8a6', '#06b6d4', '#84cc16', '#a855f7'];

/* ─── Main Dashboard ─── */

function DashboardContent({ setIsModalOpen, user }) {
    const isAdmin = user && (user.role === 'ADMIN' || user.role === 'GERENTE');
    const [kpis, setKpis] = useState(null);
    const [timeline, setTimeline] = useState(null);
    const [fluxoCaixa, setFluxoCaixa] = useState(null);
    const [marketShare, setMarketShare] = useState(null);
    const [expenseBreakdown, setExpenseBreakdown] = useState(null);
    const [filtro, setFiltro] = useState('todos');
    const [txData, setTxData] = useState([]);
    const [dataInicio, setDataInicio] = useState('');
    const [dataFim, setDataFim] = useState('');
    const [iaLoading, setIaLoading] = useState(false);
    const [iaResult, setIaResult] = useState('');
    const [iaError, setIaError] = useState('');
    const [showIaModal, setShowIaModal] = useState(false);
    const [ocultarExtremos, setOcultarExtremos] = useState(true);

    const fetchDashboard = (start, end) => {
        const qs = (start && end) ? `?start=${start}&end=${end}` : '';
        Promise.all([
            api.get(`/dashboard/kpis${qs}`),
            api.get(`/dashboard/timeline${qs}`),
            api.get(`/dashboard/market-share${qs}`),
            api.get(`/dashboard/expense-breakdown${qs}`),
            api.get('/dashboard/fluxo-caixa')
        ]).then(([k, t, s, e, fc]) => {
            setKpis(k.data);
            setTimeline(t.data);
            setMarketShare(s.data);
            setExpenseBreakdown(e.data);
            setFluxoCaixa(fc.data);
        }).catch(console.error);
    };

    // Dados simplificados para Operador
    const [recentTx, setRecentTx] = useState([]);
    const [stockAlerts, setStockAlerts] = useState([]);

    const fetchOperadorData = () => {
        api.get('/transacoes?limit=10').then(r => setRecentTx(r.data.transacoes || [])).catch(console.error);
        api.get('/produtos').then(r => {
            const prods = (r.data || []).filter(p => p.ativo !== 0 && (p.estoque_atual || 0) <= (p.estoque_minimo || 0));
            setStockAlerts(prods);
        }).catch(console.error);
    };

    useEffect(() => {
        if (isAdmin) {
            fetchDashboard();
        } else {
            fetchOperadorData();
        }
    }, []);

    const aplicarFiltro = (tipo) => {
        setFiltro(tipo);
        const now = new Date();
        let start = '', end = now.toISOString().split('T')[0];
        if (tipo === 'todos') { start = ''; end = ''; }
        else if (tipo === '7d') { const d = new Date(now); d.setDate(d.getDate() - 7); start = d.toISOString().split('T')[0]; }
        else if (tipo === '30d') { const d = new Date(now); d.setDate(d.getDate() - 30); start = d.toISOString().split('T')[0]; }
        else if (tipo === '90d') { const d = new Date(now); d.setDate(d.getDate() - 90); start = d.toISOString().split('T')[0]; }
        else if (tipo === '12m') { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); start = d.toISOString().split('T')[0]; }
        else if (tipo === 'custom') { start = dataInicio; end = dataFim; }
        setDataInicio(start); setDataFim(end);
        fetchDashboard(start || undefined, end || undefined);
    };

    const [iaContextPayload, setIaContextPayload] = useState(null);

    const handleAnaliseIA = async () => {
        const r = (v) => Math.round((v || 0) * 100) / 100;
        const payload = {
            periodo: (dataInicio && dataFim) ? `${dataInicio} a ${dataFim}` : 'Todo o período',
            receita: r(kpis?.receita?.atual),
            despesa: r(kpis?.despesa?.atual),
            lucroLiquido: r(kpis?.lucro?.atual),
            margemGeral: r(kpis?.margem?.atual),
            produtos: (marketShare?.shares || []).map(s => ({
                nome: s.produto,
                receita: r(s.valor),
                participacao: s.percentual + '%',
                margem: (s.margem !== undefined ? s.margem + '%' : 'N/A')
            })),
            despesasPorCategoria: (expenseBreakdown?.categorias || []).map(c => ({
                categoria: c.categoria,
                valor: r(c.valor),
                participacao: c.percentual + '%'
            }))
        };
        setIaContextPayload(payload);
        setShowIaModal(true);
    };

    return (
        <div>
            {/* AI Analysis Button — oculto para OPERADOR */}
            {isAdmin && (
                <button onClick={handleAnaliseIA} disabled={iaLoading || !kpis}
                    style={{
                        width: '100%', marginBottom: '12px', padding: '12px 20px',
                        borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                        background: 'linear-gradient(135deg, #7c4dff 0%, #448aff 50%, #00e5ff 100%)',
                        color: 'white', fontWeight: '700', fontSize: '0.95rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                        transition: 'all 0.3s ease', boxShadow: '0 4px 20px rgba(124, 77, 255, 0.3)',
                        opacity: (!kpis) ? 0.5 : 1,
                    }}>
                    <Brain size={22} /> 🧠 Analisar Atividade Econômica
                </button>
            )}

            {showIaModal && (
                <AnaliseIAModal
                    isOpen={showIaModal}
                    onClose={() => setShowIaModal(false)}
                    contextPayload={iaContextPayload}
                />
            )}

            {/* Time Filter — apenas admin */}
            {isAdmin && (
                <div className="glass-card" style={{ marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', padding: '12px 20px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', marginRight: '8px' }}>Período:</span>
                    {[
                        { key: 'todos', label: 'Todo período' },
                        { key: '7d', label: '7 dias' },
                        { key: '30d', label: '30 dias' },
                        { key: '90d', label: '90 dias' },
                        { key: '12m', label: '12 meses' },
                    ].map(f => (
                        <button key={f.key} onClick={() => aplicarFiltro(f.key)}
                            className={filtro === f.key ? 'badge badge-revenue' : 'btn btn-ghost'}
                            style={{ padding: '6px 14px', fontSize: '0.8rem', border: filtro === f.key ? 'none' : undefined, cursor: 'pointer' }}>
                            {f.label}
                        </button>
                    ))}
                    <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto', alignItems: 'center' }}>
                        <input type="date" className="input-field" value={dataInicio} onChange={e => setDataInicio(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.8rem', width: '150px' }} />
                        <span style={{ color: 'var(--text-muted)' }}>até</span>
                        <input type="date" className="input-field" value={dataFim} onChange={e => setDataFim(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.8rem', width: '150px' }} />
                        <button onClick={() => aplicarFiltro('custom')} className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.8rem' }}>Filtrar</button>
                        <div style={{ marginLeft: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input type="checkbox" checked={ocultarExtremos} onChange={e => setOcultarExtremos(e.target.checked)} id="extremos-dash" style={{ cursor: 'pointer', width: '18px', height: '18px' }} />
                            <label htmlFor="extremos-dash" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: '600' }}>Ocultar Extremos</label>
                        </div>
                    </div>
                </div>
            )}

            {/* KPIs — ocultos para OPERADOR */}
            {isAdmin && <KPICards data={kpis} />}

            {/* Fluxo de Caixa Mensal — apenas admin */}
            {isAdmin && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '16px' }}>
                    <div className="glass-card" style={{ height: '360px', padding: '16px' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '16px' }}>📉 Fluxo de Caixa</h3>
                        <div style={{ height: '280px' }}>
                            <FluxoCaixaChart data={ocultarExtremos && fluxoCaixa?.series ? { ...fluxoCaixa, series: fluxoCaixa.series.map(f => ({ ...f, receitasPrevistas: f.receitasPrevistas > 500000 ? 500000 : f.receitasPrevistas, despesasPrevistas: f.despesasPrevistas > 500000 ? 500000 : f.despesasPrevistas })) } : fluxoCaixa} />
                        </div>
                    </div>
                </div>
            )}

            {/* Pie charts row — apenas admin */}
            {isAdmin && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '32px' }}>
                    <div className="glass-card" style={{ minHeight: '420px', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '24px' }}>📈 Market Share (Receitas)</h3>
                        <div style={{ flex: 1, minHeight: '300px' }}>
                            <MarketShareChart data={marketShare} />
                        </div>
                    </div>

                    <div className="glass-card" style={{ minHeight: '420px', display: 'flex', flexDirection: 'column' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '24px' }}>🏷️ Composição de Despesas</h3>
                        <div style={{ flex: 1, minHeight: '300px' }}>
                            <ExpenseBreakdownChart data={expenseBreakdown} />
                        </div>
                    </div>
                </div>
            )}

            {isAdmin && <ExportButton kpis={kpis} marketShare={marketShare} expenseBreakdown={expenseBreakdown} dataInicio={dataInicio} dataFim={dataFim} />}

            {/* ═══ Análise de Unidade (Admin) ═══ */}
            {isAdmin && <AnaliseUnidadeSection dataInicio={dataInicio} dataFim={dataFim} />}

            {/* ═══ Dashboard Simplificado do Operador ═══ */}
            {!isAdmin && (
                <div>
                    {/* Alertas de Estoque */}
                    <div className="glass-card" style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <AlertTriangle size={22} style={{ color: stockAlerts.length > 0 ? 'var(--expense)' : 'var(--revenue)' }} />
                            Alertas de Estoque
                            {stockAlerts.length > 0 && (
                                <span className="badge badge-expense" style={{ fontSize: '0.7rem' }}>{stockAlerts.length} produto{stockAlerts.length > 1 ? 's' : ''} abaixo do mínimo</span>
                            )}
                        </h3>
                        {stockAlerts.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>✅ Todos os produtos estão com estoque adequado.</p>
                        ) : (
                            <div style={{ display: 'grid', gap: '8px' }}>
                                {stockAlerts.map(p => (
                                    <div key={p.id} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '12px 16px', borderRadius: '8px',
                                        background: (p.estoque_atual || 0) <= 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                        border: `1px solid ${(p.estoque_atual || 0) <= 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <Package size={18} style={{ color: (p.estoque_atual || 0) <= 0 ? 'var(--expense)' : '#f59e0b' }} />
                                            <div>
                                                <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{p.nome}</span>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '8px' }}>{p.codigo_sku}</span>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{ fontWeight: '700', fontSize: '1rem', color: (p.estoque_atual || 0) <= 0 ? 'var(--expense)' : '#f59e0b' }}>
                                                {p.estoque_atual || 0}
                                            </span>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}> / mín. {p.estoque_minimo || 0}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Lançamentos Recentes */}
                    <div className="glass-card" style={{ overflow: 'hidden', padding: 0 }}>
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--glass-border)' }}>
                            <h3 style={{ fontWeight: '700', fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Clock size={22} /> Lançamentos Recentes
                            </h3>
                        </div>
                        {recentTx.length === 0 ? (
                            <p style={{ padding: '24px', color: 'var(--text-muted)', textAlign: 'center' }}>Nenhum lançamento encontrado.</p>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                        <th style={thStyle}>Data</th>
                                        <th style={thStyle}>Tipo</th>
                                        <th style={thStyle}>Descrição</th>
                                        <th style={thStyle}>Categoria</th>
                                        <th style={{ ...thStyle, textAlign: 'right' }}>Valor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentTx.map(t => (
                                        <tr key={t.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                            <td style={tdStyle}>{t.data_transacao}</td>
                                            <td style={tdStyle}>
                                                <span className={t.tipo === 'RECEITA' ? 'badge badge-revenue' : 'badge badge-expense'}>{t.tipo}</span>
                                            </td>
                                            <td style={tdStyle}>{t.descricao || t.produto_nome || '-'}</td>
                                            <td style={tdStyle}>{t.categoria}</td>
                                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '600', color: t.tipo === 'RECEITA' ? 'var(--revenue)' : 'var(--expense)' }}>
                                                {t.tipo === 'RECEITA' ? '+' : '-'}{fmt(t.valor)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Análise de Unidade (Admin) ─── */
function AnaliseUnidadeSection({ dataInicio, dataFim }) {
    const [analytics, setAnalytics] = useState(null);
    const [produtoSelecionado, setProdutoSelecionado] = useState('todos');

    useEffect(() => {
        const qs = (dataInicio && dataFim) ? `?start=${dataInicio}&end=${dataFim}` : '';
        api.get(`/producao/analytics${qs}`).then(r => setAnalytics(r.data)).catch(console.error);
    }, [dataInicio, dataFim]);

    // 1b. Definir automaticamente o primeiro produto se estiver em "todos" ou vazio
    useEffect(() => {
        if (analytics) {
            const producaoGranular = analytics.producaoGranular || [];
            const financasGranulares = analytics.financasGranulares || [];
            const idsProducao = new Set(producaoGranular.filter(p => (p.quantidade || 0) > 0).map(p => p.produto_id));
            const idsReceita = new Set(financasGranulares.filter(f => (f.receitas || 0) > 0).map(f => f.produto_id));
            const idsProdutosValidos = new Set([...idsProducao, ...idsReceita]);
            const lista = Array.from(idsProdutosValidos).filter(id => id && id !== '__sem_produto__');

            if (lista.length > 0 && (produtoSelecionado === 'todos' || !produtoSelecionado)) {
                setProdutoSelecionado(String(lista[0]));
            }
        }
    }, [analytics, produtoSelecionado]);

    if (!analytics) return null;

    // 1. Extrair produtos únicos de PRODUÇÃO ou RECEITA (excluir insumos/despesas puras)
    const producaoGranular = analytics.producaoGranular || [];
    const financasGranulares = analytics.financasGranulares || [];
    const produtosMap = new Map((analytics.produtos || []).map(p => [Number(p.id), p.nome]));

    const idsProdutosValidos = new Set([
        ...producaoGranular.filter(p => (p.quantidade || 0) > 0).map(p => Number(p.produto_id)),
        ...financasGranulares.filter(f => (f.receitas || 0) > 0).map(f => Number(f.produto_id))
    ]);

    const listaProdutos = Array.from(idsProdutosValidos)
        .filter(id => id && !isNaN(id) && produtosMap.has(id))
        .map(id => ({ id, nome: produtosMap.get(id) }))
        .sort((a, b) => a.nome.localeCompare(b.nome));

    // 2. Filtrar dados reativamente
    const pSel = produtoSelecionado;
    const producaoFiltrada = pSel === 'todos' 
        ? producaoGranular 
        : producaoGranular.filter(p => String(p.produto_id) === String(pSel));
    
    const financasFiltradas = pSel === 'todos'
        ? financasGranulares
        : financasGranulares.filter(f => String(f.produto_id) === String(pSel));

    // 3. Recalcular KPIs
    const totalProduzido = producaoFiltrada.reduce((acc, p) => acc + (p.quantidade || 0), 0);
    const totalDespesas = financasFiltradas.reduce((acc, f) => acc + (f.despesas || 0), 0);
    const totalReceitas = financasFiltradas.reduce((acc, f) => acc + (f.receitas || 0), 0);
    
    const custoPorUnidade = totalProduzido > 0 ? (totalDespesas / totalProduzido) : 0;
    const receitaPvVenda = totalProduzido > 0 ? (totalReceitas / totalProduzido) : 0;
    const lucroPorUnidade = receitaPvVenda - custoPorUnidade;

    // 4. Recalcular dados do gráfico de volume
    const dailyData = {};
    producaoFiltrada.forEach(p => {
        if (!p.data) return;
        
        let dObj;
        if (typeof p.data === 'string') {
            const cleanDate = p.data.split('T')[0];
            if (cleanDate.includes('-')) {
                const [y, m, d] = cleanDate.split('-');
                dObj = new Date(Number(y), Number(m) - 1, Number(d));
            } else if (cleanDate.includes('/')) {
                const parts = cleanDate.split('/');
                if (parts[0].length === 4) dObj = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                else dObj = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
            } else {
                dObj = new Date(p.data);
            }
        } else {
            dObj = new Date(p.data);
        }

        if (isNaN(dObj.getTime())) return;

        // Consistent key: YYYY-MM-DD local
        const y = dObj.getFullYear();
        const m = String(dObj.getMonth() + 1).padStart(2, '0');
        const d = String(dObj.getDate()).padStart(2, '0');
        const key = `${y}-${m}-${d}`;

        if (!dailyData[key]) {
            dailyData[key] = {
                quantidade: 0,
                label: `${d}/${m}`,
                timestamp: dObj.getTime()
            };
        }
        dailyData[key].quantidade += p.quantidade || 0;
    });

    // Explicit chronological sort
    const eficienciaFiltrada = Object.values(dailyData).sort((a, b) => a.timestamp - b.timestamp);

    return (
        <div style={{ marginTop: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Factory size={22} style={{ color: 'var(--accent-primary)' }} /> Análise de Unidade Produzida
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>Filtrar Produto:</span>
                    <select 
                        className="input-field" 
                        value={produtoSelecionado} 
                        onChange={e => setProdutoSelecionado(e.target.value)}
                        style={{ padding: '6px 12px', fontSize: '0.85rem', width: '220px', background: 'var(--bg-tertiary)' }}
                    >
                        <option value="todos">Todos os Produtos</option>
                        {listaProdutos.map(p => (
                            <option key={p.id} value={p.id}>{p.nome}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div className="glass-card" style={{ textAlign: 'center', padding: '20px' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', marginBottom: '8px' }}>Total Produzido</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#00e5ff' }}>
                        {totalProduzido.toLocaleString('pt-BR')}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>unidades</p>
                </div>
                <div className="glass-card" style={{ textAlign: 'center', padding: '20px' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', marginBottom: '8px' }}>Custo Médio p/ Unidade</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--expense)' }}>
                        {fmt(custoPorUnidade)}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>despesas / produção</p>
                </div>
                <div className="glass-card" style={{ textAlign: 'center', padding: '20px' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', marginBottom: '8px' }}>Receita p/ Unidade Vendida</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--revenue)' }}>
                        {fmt(receitaPvVenda)}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>receitas / vendas</p>
                </div>
                <div className="glass-card" style={{ textAlign: 'center', padding: '20px', border: lucroPorUnidade >= 0 ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.3)' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700', marginBottom: '8px' }}>Margem Real p/ Unidade</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: '700', color: lucroPorUnidade >= 0 ? 'var(--revenue)' : 'var(--expense)' }}>
                        {lucroPorUnidade >= 0 ? '+' : ''}{fmt(lucroPorUnidade)}
                    </p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>receita/un. - custo/un.</p>
                </div>
            </div>

            {/* Gráfico de Volume */}
            <div className="glass-card" style={{ height: '400px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '24px' }}>📦 Volume Produzido ({produtoSelecionado === 'todos' ? 'Total' : listaProdutos.find(p => String(p.id) === String(produtoSelecionado))?.nome})</h3>
                <div style={{ height: '310px' }}>
                    <EficienciaChart data={eficienciaFiltrada} />
                </div>
            </div>
        </div>
    );
}

/* ─── AI Analysis Modal ─── */
const AnaliseIAModal = ({ isOpen, onClose, contextPayload }) => {
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = React.useRef(null);

    useEffect(() => {
        if (!isOpen) return;
        if (!contextPayload || messages.length > 0) return;
        setLoading(true);
        api.post('/dashboard/analise-ia', { messages: null, payload: contextPayload })
            .then(r => {
                setMessages([{ role: 'assistant', content: r.data.analise, isInitial: true }]);
            })
            .catch(err => {
                setMessages([{ role: 'assistant', content: 'Erro ao conectar ao Consultor IA. ' + (err.response?.data?.error || err.message), isError: true }]);
            })
            .finally(() => setLoading(false));
    }, [isOpen, contextPayload]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    const handleSend = async () => {
        if (!inputValue.trim() || loading) return;
        const newMsg = { role: 'user', content: inputValue };
        const updatedMsgs = [...messages, newMsg];
        setMessages(updatedMsgs);
        setInputValue('');
        setLoading(true);

        try {
            // prepare history: only send role/content
            const hist = updatedMsgs.map(m => ({ role: m.role, content: m.content }));
            const r = await api.post('/dashboard/analise-ia', { messages: hist, payload: contextPayload });
            setMessages([...updatedMsgs, { role: 'assistant', content: r.data.analise }]);
        } catch (err) {
            setMessages([...updatedMsgs, { role: 'assistant', content: 'Desculpe, ocorreu um erro. ' + (err.response?.data?.error || err.message), isError: true }]);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 201, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }} />
            <div className="glass-card" style={{ position: 'relative', zIndex: 110, maxWidth: '800px', width: '100%', height: '85vh', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid rgba(124, 77, 255, 0.3)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>

                {/* Header estático */}
                <div style={{ padding: '20px 24px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: 'linear-gradient(135deg, #7c4dff 0%, #00e5ff 100%)', width: '40px', height: '40px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(124,77,255,0.3)' }}>
                            <Brain size={20} color="white" />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0 }}>Consultor Financeiro IA</h2>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Desenvolvido com Llama 3 API</p>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)', color: 'var(--text-muted)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Chat History */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', background: 'var(--bg-primary)' }}>
                    {messages.length === 0 && loading && (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <div style={{
                                width: '60px', height: '60px', borderRadius: '50%', margin: '0 auto 16px',
                                background: 'linear-gradient(135deg, rgba(124,77,255,0.1), rgba(0,229,255,0.1))',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                animation: 'pulse 2s ease-in-out infinite',
                            }}>
                                <Sparkles size={28} color="#7c4dff" />
                            </div>
                            <p style={{ marginTop: '16px', color: 'var(--text-primary)', fontWeight: '600' }}>Analisando seus dados financeiros iniciais...</p>
                        </div>
                    )}

                    {messages.map((m, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                            {m.role === 'assistant' && (
                                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, #7c4dff, #00e5ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px', flexShrink: 0, marginTop: '8px' }}>
                                    <Brain size={16} color="white" />
                                </div>
                            )}
                            <div style={{
                                maxWidth: '85%',
                                padding: '16px 20px',
                                borderRadius: m.role === 'user' ? '20px 20px 0 20px' : '0 20px 20px 20px',
                                background: m.role === 'user' ? 'var(--accent-primary)' : (m.isError ? 'rgba(239,68,68,0.1)' : 'var(--bg-tertiary)'),
                                border: m.role === 'user' ? 'none' : '1px solid var(--glass-border)',
                                color: m.role === 'user' ? '#fff' : 'var(--text-primary)',
                                boxShadow: m.role === 'user' ? '0 4px 12px rgba(124, 77, 255, 0.3)' : 'none'
                            }}>
                                {m.role === 'assistant' ? (
                                    <div className="ia-markdown-body" style={{ lineHeight: '1.6', fontSize: '0.95rem' }}>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}
                                            components={{
                                                h1: ({ children }) => <h1 style={{ fontSize: '1.2rem', fontWeight: '700', margin: '16px 0 8px', color: 'var(--text-primary)' }}>{children}</h1>,
                                                h2: ({ children }) => <h2 style={{ fontSize: '1.1rem', fontWeight: '700', margin: '16px 0 8px', color: '#7c4dff' }}>{children}</h2>,
                                                h3: ({ children }) => <h3 style={{ fontSize: '1rem', fontWeight: '700', margin: '12px 0 8px', color: 'var(--text-primary)' }}>{children}</h3>,
                                                p: ({ children }) => <p style={{ margin: '0 0 10px', color: 'var(--text-secondary)', lineHeight: '1.6' }}>{children}</p>,
                                                strong: ({ children }) => <strong style={{ color: 'var(--text-primary)', fontWeight: '700' }}>{children}</strong>,
                                                ul: ({ children }) => <ul style={{ paddingLeft: '20px', margin: '8px 0 12px' }}>{children}</ul>,
                                                ol: ({ children }) => <ol style={{ paddingLeft: '20px', margin: '8px 0 12px' }}>{children}</ol>,
                                                li: ({ children }) => <li style={{ marginBottom: '4px', color: 'var(--text-secondary)' }}>{children}</li>,
                                                blockquote: ({ children }) => <blockquote style={{ borderLeft: '3px solid #7c4dff', paddingLeft: '12px', margin: '12px 0', color: 'var(--text-muted)', fontStyle: 'italic' }}>{children}</blockquote>,
                                                table: ({ children }) => <div style={{ overflowX: 'auto', margin: '12px 0' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}>{children}</table></div>,
                                                th: ({ children }) => <th style={{ padding: '8px 10px', textAlign: 'left', background: 'var(--bg-primary)', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', borderBottom: '1px solid var(--glass-border)' }}>{children}</th>,
                                                td: ({ children }) => <td style={{ padding: '8px 10px', borderBottom: '1px solid var(--glass-border)', fontSize: '0.85rem' }}>{children}</td>,
                                            }}
                                        >
                                            {m.content}
                                        </ReactMarkdown>
                                    </div>
                                ) : (
                                    <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: '1.5' }}>{m.content}</p>
                                )}
                            </div>
                        </div>
                    ))}

                    {loading && messages.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                            <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, #7c4dff, #00e5ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '12px', flexShrink: 0, marginTop: '8px' }}>
                                <Brain size={16} color="white" />
                            </div>
                            <div style={{ padding: '12px 20px', borderRadius: '0 20px 20px 20px', background: 'var(--bg-tertiary)', border: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center' }}>
                                <Loader2 size={20} className="spin" color="var(--accent-primary)" />
                                <span style={{ marginLeft: '10px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Processando resposta...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div style={{ padding: '20px 24px', borderTop: '1px solid var(--glass-border)', background: 'var(--bg-secondary)' }}>
                    <form onSubmit={e => { e.preventDefault(); handleSend(); }} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Pergunte ao Consultor IA..."
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            disabled={loading || messages.length === 0}
                            style={{ flex: 1, padding: '16px 24px', borderRadius: '30px', fontSize: '1rem', background: 'var(--bg-primary)', border: '1px solid var(--glass-border)' }}
                        />
                        <button type="submit" disabled={loading || !inputValue.trim()} style={{
                            background: (loading || !inputValue.trim()) ? 'var(--bg-tertiary)' : 'linear-gradient(135deg, #7c4dff, #00e5ff)',
                            color: (loading || !inputValue.trim()) ? 'var(--text-muted)' : '#fff',
                            border: 'none', borderRadius: '30px', padding: '0 28px', height: '54px',
                            fontWeight: '700', fontSize: '1rem', cursor: (loading || !inputValue.trim()) ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.3s',
                            boxShadow: (!loading && inputValue.trim()) ? '0 4px 15px rgba(124, 77, 255, 0.4)' : 'none'
                        }}>
                            Enviar
                        </button>
                    </form>
                </div>
            </div>

            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { 100% { transform: rotate(360deg); } }
                @keyframes pulse { 0%,100% { transform: scale(1); opacity: 0.8; } 50% { transform: scale(1.1); opacity: 1; } }
            `}</style>
        </div>
    );
};

/* ─── Export Helper ─── */
const ExportButton = ({ kpis, marketShare, expenseBreakdown, dataInicio, dataFim }) => {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            // Fetch transacoes
            const qs = `?limit=100000${dataInicio ? `&data_inicio=${dataInicio}` : ''}${dataFim ? `&data_fim=${dataFim}` : ''}`;
            const res = await api.get(`/transacoes${qs}`);
            const transacoes = res.data.transacoes || [];

            // Calcular DRE Cascata
            let receitaBruta = 0;
            let custosVariaveis = 0;
            let despesasFixas = 0;
            let impostosFinanceiras = 0;

            const cvCategories = ['estoque', 'semente', 'ração', 'racao', 'insumo', 'matéria-prima', 'materia-prima', 'mão de obra direta', 'mao de obra direta'];
            const impCategories = ['imposto', 'taxa', 'juro', 'financeir'];

            transacoes.forEach(tx => {
                if (tx.status_pagamento === 'CANCELADO') return;
                
                if (tx.tipo === 'RECEITA') {
                    receitaBruta += tx.valor;
                } else if (tx.tipo === 'DESPESA') {
                    const cat = (tx.categoria || '').toLowerCase();
                    if (cvCategories.some(c => cat.includes(c))) {
                        custosVariaveis += tx.valor;
                    } else if (impCategories.some(c => cat.includes(c))) {
                        impostosFinanceiras += tx.valor;
                    } else {
                        despesasFixas += tx.valor;
                    }
                }
            });

            const margemContribuicao = receitaBruta - custosVariaveis;
            const ebitda = margemContribuicao - despesasFixas;
            const lucroLiquido = ebitda - impostosFinanceiras;

            const pw = window.open('', '_blank');
            const r = kpis?.receita?.atual || 0, d = kpis?.despesa?.atual || 0;
            const l = kpis?.lucro?.atual || 0, m = kpis?.margem?.atual || 0;
            const fmtN = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

            let periodoStr = 'Todo o período';
            if (dataInicio && dataFim) {
                const formatData = dStr => dStr.split('-').reverse().join('/');
                periodoStr = `${formatData(dataInicio)} a ${formatData(dataFim)}`;
            } else if (dataInicio) {
                periodoStr = `A partir de ${dataInicio.split('-').reverse().join('/')}`;
            } else if (dataFim) {
                periodoStr = `Até ${dataFim.split('-').reverse().join('/')}`;
            }

            pw.document.write('<html><head><title>Relatorio Nexus Finance</title><style>body{font-family:Segoe UI,sans-serif;padding:40px;color:#1a1a2e}h1{color:#7c4dff;margin-bottom:4px}p.meta{color:#888;font-size:0.9rem;margin:2px 0}h2{color:#444;font-size:1.1rem;margin:24px 0 8px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{padding:10px 16px;text-align:left;border-bottom:1px solid #ddd}th{background:#f5f5f5;font-size:.8rem;text-transform:uppercase;color:#666}.pos{color:#10b981;font-weight:700}.neg{color:#ef4444;font-weight:700}.dre-table th, .dre-table td { padding: 12px 16px; border-bottom: 1px solid #eee; } .dre-table .bold-row { font-weight: 700; background: #f8fafc; } .page-break { page-break-before: always; border-top: 1px dashed #ccc; margin-top: 40px; padding-top: 40px; } @media print{ .no-print{display:none} .page-break { border-top: none; margin-top: 0; padding-top: 0; } }</style></head><body>');
            pw.document.write('<div class="no-print" style="display:flex;gap:12px;margin-bottom:24px;">');
            pw.document.write('<button onclick="window.print()" style="padding:10px 24px;background:#334155;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600">🖨️ Imprimir</button>');
            pw.document.write('<button onclick="var opt={margin:10,filename:\'Relatorio_Nexus_Finance.pdf\'};html2pdf().set(opt).from(document.body).save();" style="padding:10px 24px;background:#7c4dff;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:600">📄 Salvar PDF</button>');
            pw.document.write('</div>');
            pw.document.write('<h1>Relatório Financeiro</h1>');
            pw.document.write('<p class="meta">Gerado: ' + new Date().toLocaleDateString('pt-BR') + ' ' + new Date().toLocaleTimeString('pt-BR') + '</p>');
            pw.document.write('<p class="meta" style="margin-bottom: 24px">Período analisado: <strong>' + periodoStr + '</strong></p>');
            pw.document.write('<h2>KPIs</h2><table><tr><th>Indicador</th><th>Valor</th></tr>');
            pw.document.write('<tr><td>Receita</td><td class="pos">R$ ' + fmtN(r) + '</td></tr>');
            pw.document.write('<tr><td>Despesa</td><td class="neg">R$ ' + fmtN(d) + '</td></tr>');
            pw.document.write('<tr><td>Lucro</td><td class="' + (l >= 0 ? 'pos' : 'neg') + '">R$ ' + fmtN(l) + '</td></tr>');
            pw.document.write('<tr><td>Margem</td><td>' + m + '%</td></tr></table>');
            pw.document.write('<h2>Performance por Produto</h2><table><tr><th>Produto</th><th>Receita</th><th>% Part.</th><th>Margem (%)</th></tr>');
            (marketShare?.shares || []).forEach(s => pw.document.write('<tr><td>' + s.produto + '</td><td>R$ ' + fmtN(s.valor) + '</td><td>' + s.percentual + '%</td><td class="' + (s.margem >= 0 ? 'pos' : 'neg') + '">' + (s.margem !== undefined ? s.margem + '%' : '-') + '</td></tr>'));
            pw.document.write('</table><h2>Despesas</h2><table><tr><th>Categoria</th><th>Valor</th><th>%</th></tr>');
            (expenseBreakdown?.categorias || []).forEach(c => pw.document.write('<tr><td>' + c.categoria + '</td><td>R$ ' + fmtN(c.valor) + '</td><td>' + c.percentual + '%</td></tr>'));
            pw.document.write('</table><br/>');
            
            // Nova Seção: DRE
            pw.document.write('<div class="page-break">');
            pw.document.write('<h1 style="margin-bottom: 24px">Demonstração do Resultado do Exercício (DRE)</h1>');
            pw.document.write('<table class="dre-table">');
            pw.document.write('<tr><td>(=) Receita Bruta de Vendas/Produção</td><td style="text-align: right" class="pos">R$ ' + fmtN(receitaBruta) + '</td></tr>');
            pw.document.write('<tr><td>(-) Custos Variáveis / Insumos</td><td style="text-align: right" class="neg">R$ ' + fmtN(custosVariaveis) + '</td></tr>');
            pw.document.write('<tr class="bold-row"><td>(=) Margem de Contribuição (Lucro Bruto)</td><td style="text-align: right" class="' + (margemContribuicao >= 0 ? 'pos' : 'neg') + '">R$ ' + fmtN(margemContribuicao) + '</td></tr>');
            pw.document.write('<tr><td>(-) Despesas Operacionais Fixas</td><td style="text-align: right" class="neg">R$ ' + fmtN(despesasFixas) + '</td></tr>');
            pw.document.write('<tr class="bold-row"><td>(=) EBITDA (Resultado Operacional)</td><td style="text-align: right" class="' + (ebitda >= 0 ? 'pos' : 'neg') + '">R$ ' + fmtN(ebitda) + '</td></tr>');
            pw.document.write('<tr><td>(-) Impostos / Despesas Financeiras</td><td style="text-align: right" class="neg">R$ ' + fmtN(impostosFinanceiras) + '</td></tr>');
            pw.document.write('<tr class="bold-row" style="font-size: 1.1rem; background: #f1f5f9;"><td>(=) Lucro Líquido do Exercício</td><td style="text-align: right" class="' + (lucroLiquido >= 0 ? 'pos' : 'neg') + '">R$ ' + fmtN(lucroLiquido) + '</td></tr>');
            pw.document.write('</table>');
            pw.document.write('</div>');

            pw.document.write('<script async src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>');
            pw.document.write('</body></html>');
            pw.document.close();
        } catch (err) {
            console.error('Erro ao gerar relatorio:', err);
            alert('Não foi possível gerar o relatório com a DRE no momento.');
        } finally {
            setIsExporting(false);
        }
    };
    return (
        <div className="glass-card" style={{ textAlign: 'center' }}>
            <button onClick={handleExport} disabled={isExporting} className="btn btn-primary" style={{ gap: '8px' }}>
                {isExporting ? <Loader2 size={18} className="spin" /> : <Download size={18} />}
                {isExporting ? 'Gerando Relatório...' : 'Exportar Relatório'}
            </button>
        </div>
    );
};

/* ─── Layout ─── */

function Dashboard({ user, onLogout }) {
    const navigate = useNavigate();
    const location = useLocation();
    
    // Initialize page directly from URL
    const getCurrentPage = () => {
        const path = location.pathname.split('/')[1] || 'dashboard';
        const validPages = ['dashboard', 'lancamentos', 'estoque-producao', 'rh', 'clientes', 'analise-produtos', 'calendario', 'config'];
        return validPages.includes(path) ? path : 'dashboard';
    };

    const [page, setPage] = useState(getCurrentPage());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0); // Force refetch

    // Sincronizar estado local 'page' com a URL
    useEffect(() => {
        const path = location.pathname.replace('/', '') || 'dashboard';
        console.log('Navigation Path:', path);
        const validPages = ['dashboard', 'lancamentos', 'estoque-producao', 'rh', 'clientes', 'analise-produtos', 'calendario', 'config'];
        if (validPages.includes(path)) {
            setPage(path);
        }
    }, [location]);

    const openCreateModal = () => {
        setEditingTransaction(null);
        setIsModalOpen(true);
    };

    const openEditModal = (tx) => {
        setEditingTransaction(tx);
        setIsModalOpen(true);
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.key === 'n') { e.preventDefault(); openCreateModal(); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const isAdmin = user && (user.role === 'ADMIN' || user.role === 'GERENTE');

    const allMenuItems = [
        { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { key: 'lancamentos', label: 'Lançamentos', icon: FileText },
        { key: 'estoque-producao', label: 'Estoque & Produção', icon: Warehouse },
        { key: 'rh', label: 'Gestão RH', icon: Users },
        { key: 'clientes', label: 'Clientes / Fornecedores', icon: User },
        { key: 'analise-produtos', label: 'Análise de Produtos', icon: BarChart3, adminOnly: true },
        { key: 'calendario', label: 'Calendário', icon: CalendarDays, adminOnly: true },
                  
        { key: 'config', label: 'Configurações', icon: Settings, adminOnly: true },
        { key: 'logout', label: 'Sair do sistema', icon: LogOut, adminOnly: false },
    ];

    // Filtrar itens do menu com base no role
    const menuItems = isAdmin ? allMenuItems : allMenuItems.filter(item => !item.adminOnly);

    const pageTitle = {
        dashboard: { title: 'Dashboard', subtitle: 'Bem-vindo de volta ao seu controle empresarial.' },
        lancamentos: { title: 'Lançamentos', subtitle: 'Gerencie suas receitas e despesas.' },
        'estoque-producao': { title: 'Estoque & Produção', subtitle: 'Gerencie inventário, catálogo e registros de produção.' },
        rh: { title: 'Gestão RH', subtitle: 'Controle de funcionários e folha de pagamento.' },
        clientes: { title: 'Clientes / Fornecedores', subtitle: 'Gerencie seus clientes e fornecedores.' },
        'analise-produtos': { title: 'Análise de Produtos', subtitle: 'Rentabilidade e inteligência de custos.' },
        calendario: { title: 'Calendário Financeiro', subtitle: 'Visualize compromissos, vencimentos e projeção do mês.' },

        config: { title: 'Configurações', subtitle: 'Ajuste o sistema.' },
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)', position: 'relative' }}>
            {/* Sidebar */}
            <aside style={{ 
                width: '260px', 
                borderRight: '1px solid var(--glass-border)', 
                display: 'flex', 
                flexDirection: 'column', 
                padding: '24px',
                position: 'sticky',
                top: 0,
                height: '100vh',
                flexShrink: 0
            }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginBottom: '36px', cursor: 'pointer' }} onClick={() => navigate('/')}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: 'linear-gradient(135deg, rgba(34, 211, 238, 0.12), rgba(8, 145, 178, 0.06))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(34, 211, 238, 0.35), 0 0 6px rgba(34, 211, 238, 0.2), inset 0 0 8px rgba(34, 211, 238, 0.05)', border: '1px solid rgba(34, 211, 238, 0.15)' }}>
                        <svg width="34" height="34" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <linearGradient id="growthGrad" x1="32" y1="8" x2="32" y2="56" gradientUnits="userSpaceOnUse">
                                    <stop offset="0%" stopColor="#22D3EE" />
                                    <stop offset="100%" stopColor="#0891B2" />
                                </linearGradient>
                                <filter id="iconGlow" x="-50%" y="-50%" width="200%" height="200%">
                                    <feGaussianBlur stdDeviation="2.5" result="glow" />
                                    <feMerge><feMergeNode in="glow" /><feMergeNode in="SourceGraphic" /></feMerge>
                                </filter>
                            </defs>
                            <g filter="url(#iconGlow)">
                                <rect x="10" y="40" width="8" height="12" rx="2" fill="url(#growthGrad)" />
                                <rect x="22" y="30" width="8" height="22" rx="2" fill="url(#growthGrad)" />
                                <rect x="34" y="24" width="8" height="28" rx="2" fill="url(#growthGrad)" />
                                <rect x="46" y="14" width="8" height="38" rx="2" fill="url(#growthGrad)" />
                                <path d="M10 44 L22 34 L34 28 L46 18" stroke="#67E8F9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M42 18 L46 18 L46 22" stroke="#67E8F9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                            </g>
                        </svg>
                    </div>
                    <span style={{ fontWeight: '700', fontSize: '1.1rem', letterSpacing: '-0.3px', color: '#F9FAFB' }}>Nexus Finance</span>
                </div>

                <nav style={{ flex: 1 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '1px' }}>Menu Principal</div>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        {menuItems.map(item => (
                            <li key={item.key} style={{ marginBottom: '8px' }}>
                                {item.key === 'logout' ? (
                                    <button onClick={onLogout} className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start' }}>
                                        <item.icon size={18} /> {item.label}
                                    </button>
                                ) : (
                                    <Link
                                        to={item.key === 'dashboard' ? '/' : `/${item.key}`}
                                        className={page === item.key ? 'btn' : 'btn btn-ghost'}
                                        style={{
                                            width: '100%', justifyContent: 'flex-start',
                                            textDecoration: 'none',
                                            background: page === item.key ? 'var(--glass-highlight)' : undefined,
                                            color: page === item.key ? 'var(--text-primary)' : 'var(--text-secondary)',
                                            borderColor: page === item.key ? 'var(--accent-primary)' : 'transparent',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        <item.icon size={18} /> {item.label}
                                    </Link>
                                )}
                            </li>
                        ))}
                    </ul>
                </nav>

                <div className="glass" style={{ padding: '16px', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--accent-primary)' }}>
                            {user.nome.charAt(0)}
                        </div>
                        <div>
                            <p style={{ fontSize: '0.875rem', fontWeight: '600', margin: 0 }}>{user.nome}</p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{user.role}</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main style={{ flex: 1, padding: '24px 32px', minWidth: 0 }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h2 style={{ fontSize: '1.875rem', fontWeight: '700' }}>{pageTitle[page]?.title}</h2>
                        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>{pageTitle[page]?.subtitle}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input type="text" className="input-field" placeholder="Buscar..." style={{ width: '240px', paddingLeft: '40px' }} />
                        </div>
                        <button onClick={openCreateModal} className="btn btn-primary">
                            <Plus size={18} /> Novo Lançamento
                            <span style={{ fontSize: '0.7rem', opacity: 0.7, marginLeft: '4px' }}>(Ctrl+N)</span>
                        </button>
                    </div>
                </header>

                {page === 'dashboard' && <DashboardContent key={refreshKey} setIsModalOpen={setIsModalOpen} user={user} />}
                {page === 'lancamentos' && <TransacoesPage key={refreshKey} onEdit={openEditModal} onImportSuccess={() => setRefreshKey(prev => prev + 1)} user={user} />}
                {page === 'estoque-producao' && <EstoqueProducaoPage />}
                {page === 'rh' && <RhPage />}
                {page === 'clientes' && <ClientesPage />}
                {page === 'analise-produtos' && <AnaliseProdutosPage />}
                {page === 'calendario' && <CalendarioPage />}

                {page === 'config' && isAdmin && <ConfigPage user={user} />}
            </main>

            {isModalOpen && (
                <TransactionModal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setEditingTransaction(null);
                        setRefreshKey(prev => prev + 1); // Refresh dashboard on closing transaction modal
                    }}
                    transaction={editingTransaction}
                />
            )}
        </div>
    );
}

export default Dashboard;
