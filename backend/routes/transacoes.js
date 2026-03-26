const express = require('express');
const { getSupabaseClient } = require('../db/supabase');
const { requireRole } = require('../middleware/auth');

const CATEGORIAS_SIGILOSAS = ['Pró-labore', 'Folha de Pagamento'];

const router = express.Router();

router.get('/categorias', async (req, res) => {
    try {
        const supabase = getSupabaseClient(req.token);
        const { data } = await supabase.from('transacoes').select('categoria').eq('tipo', 'DESPESA').order('categoria');
        const cats = [...new Set((data || []).map(t => t.categoria).filter(Boolean))];
        res.json(cats);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar categorias' });
    }
});

router.get('/centros-custo', async (req, res) => {
    try {
        const supabase = getSupabaseClient(req.token);
        const { data } = await supabase.from('transacoes').select('centro_custo').eq('tipo', 'DESPESA');
        const centros = [...new Set((data || []).map(t => t.centro_custo).filter(Boolean))].sort();
        res.json(centros);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar centros de custo' });
    }
});

router.get('/analise-produtos', async (req, res) => {
    try {
        const { start, end } = req.query;
        const supabase = getSupabaseClient(req.token);
        
        const { data: produtos } = await supabase.from('produtos').select('*');
        const { data: allTx } = await supabase.from('transacoes').select('*').neq('status_pagamento', 'CANCELADO');

        const now = new Date();
        const mStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const mEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`;
        const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const pmStart = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-01`;
        const pmEnd = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-31`;

        let filtered = [...(allTx || [])];
        if (start) filtered = filtered.filter(t => t.data_transacao >= start);
        if (end) filtered = filtered.filter(t => t.data_transacao <= end);

        const receitas = filtered.filter(t => t.tipo === 'RECEITA');
        const despesas = filtered.filter(t => t.tipo === 'DESPESA');

        const totalReceitaEmpresa = receitas.reduce((s, t) => s + (Number(t.valor) || 0), 0);
        
        const despesasGerais = despesas.filter(t => t.is_geral || !t.produto_id);
        const catTotaisGerais = {};
        despesasGerais.forEach(t => {
            const cat = t.categoria || 'Geral sem categoria';
            catTotaisGerais[cat] = (catTotaisGerais[cat] || 0) + (Number(t.valor) || 0);
        });
        const totaisGeraisDespesa = Object.values(catTotaisGerais).reduce((s, v) => s + v, 0);

        const analysis = (produtos || []).map(p => {
            const prodReceitas = receitas.filter(t => t.produto_id === p.id);
            const vendasTotal = prodReceitas.reduce((s, t) => s + (Number(t.valor) || 0), 0);
            const qtdVendida = prodReceitas.reduce((s, t) => s + (Number(t.quantidade) || 1), 0);

            const custosDiretos = despesas.filter(t =>
                !t.is_geral && (
                    t.produto_id === p.id ||
                    (t.centro_custo && t.centro_custo.toLowerCase().includes(p.nome.toLowerCase()))
                )
            );
            const custoDiretoTotal = custosDiretos.reduce((s, t) => s + (Number(t.valor) || 0), 0);

            const proporcao = totalReceitaEmpresa > 0 ? (vendasTotal / totalReceitaEmpresa) : 0;
            const rateioGeral = +(totaisGeraisDespesa * proporcao).toFixed(2);
            const custoTotalComRateio = +(custoDiretoTotal + rateioGeral).toFixed(2);

            const margemRealizada = vendasTotal > 0 ? +((((vendasTotal - custoTotalComRateio) / vendasTotal) * 100)).toFixed(2) : 0;
            const margemEsperada = Number(p.preco_venda) > 0 && Number(p.custo_unitario)
                ? +(((Number(p.preco_venda) - Number(p.custo_unitario)) / Number(p.preco_venda)) * 100).toFixed(2) : 0;
            
            const desvio = +(margemRealizada - margemEsperada).toFixed(2);
            const desvioAlerta = desvio < -10;
            const roi = custoTotalComRateio > 0 ? +(((vendasTotal - custoTotalComRateio) / custoTotalComRateio) * 100).toFixed(2) : (vendasTotal > 0 ? 999 : 0);

            const catGrouped = {};
            custosDiretos.forEach(t => {
                const cat = t.categoria || 'Sem categoria';
                catGrouped[cat] = (catGrouped[cat] || 0) + (Number(t.valor) || 0);
            });
            
            Object.entries(catTotaisGerais).forEach(([catGeral, valorTotalGeral]) => {
                const catRateio = +(valorTotalGeral * proporcao).toFixed(2);
                if (catRateio > 0) {
                    const label = `(Rateio) ${catGeral}`;
                    catGrouped[label] = (catGrouped[label] || 0) + catRateio;
                }
            });

            const expenseBreakdown = Object.entries(catGrouped)
                .map(([categoria, valor]) => ({ categoria, valor }))
                .sort((a, b) => b.valor - a.valor);

            const alerts = [];
            const custosMesAll = (allTx || []).filter(t =>
                t.tipo === 'DESPESA' && t.status_pagamento !== 'CANCELADO' && !t.is_geral &&
                (t.produto_id === p.id || (t.centro_custo && t.centro_custo.toLowerCase().includes(p.nome.toLowerCase()))) &&
                t.data_transacao >= mStart && t.data_transacao <= mEnd
            );
            const custosPrevAll = (allTx || []).filter(t =>
                t.tipo === 'DESPESA' && t.status_pagamento !== 'CANCELADO' && !t.is_geral &&
                (t.produto_id === p.id || (t.centro_custo && t.centro_custo.toLowerCase().includes(p.nome.toLowerCase()))) &&
                t.data_transacao >= pmStart && t.data_transacao <= pmEnd
            );
            const catMes = {}, catPrev = {};
            custosMesAll.forEach(t => { const c = t.categoria || 'Outros'; catMes[c] = (catMes[c] || 0) + Number(t.valor); });
            custosPrevAll.forEach(t => { const c = t.categoria || 'Outros'; catPrev[c] = (catPrev[c] || 0) + Number(t.valor); });
            Object.keys(catMes).forEach(cat => {
                const atual = catMes[cat];
                const anterior = catPrev[cat] || 0;
                if (anterior > 0) {
                    const crescimento = +(((atual - anterior) / anterior) * 100).toFixed(0);
                    if (crescimento > 5) {
                        alerts.push({ categoria: cat, crescimento, atual, anterior });
                    }
                }
            });

            const custoMedioMes = custosMesAll.length > 0 ? +(custosMesAll.reduce((s, t) => s + Number(t.valor), 0) / custosMesAll.length).toFixed(2) : 0;
            const custoMedioMesAnterior = custosPrevAll.length > 0 ? +(custosPrevAll.reduce((s, t) => s + Number(t.valor), 0) / custosPrevAll.length).toFixed(2) : 0;
            const dreno = custoMedioMesAnterior > 0 && custoMedioMes > custoMedioMesAnterior * 1.10;

            return {
                id: p.id, nome: p.nome, sku: p.codigo_sku, vendasTotal, qtdVendida, custoTotal: custoTotalComRateio,
                custoDiretoTotal, rateioGeral, margemRealizada, margemEsperada, desvio, desvioAlerta, roi,
                expenseBreakdown, alerts, dreno, custoMedioMes, custoMedioMesAnterior
            };
        });

        const totalReceita = receitas.reduce((s, t) => s + Number(t.valor), 0);
        const totalCustoVariavel = analysis.reduce((s, a) => s + a.custoDiretoTotal, 0);
        const margemContribuicaoGlobal = totalReceita > 0 ? (totalReceita - totalCustoVariavel) / totalReceita : 0;
        const globalBreakEven = margemContribuicaoGlobal > 0 ? +(totaisGeraisDespesa / margemContribuicaoGlobal).toFixed(2) : 0;
        const finalAnalysis = analysis.filter(a => a.vendasTotal > 0);

        res.json({ produtos: finalAnalysis, globalBreakEven });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro na análise de produtos' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { data_transacao, tipo, valor, categoria, produto_id, cliente_id, status_pagamento, forma_pagamento, descricao, centro_custo, quantidade, data_vencimento, tags, is_geral, telefone_contato } = req.body;
        if (!data_transacao || !tipo || !valor || !forma_pagamento) return res.status(400).json({ error: 'Campos obrigatórios: data_transacao, tipo, valor, forma_pagamento' });

        const supabase = getSupabaseClient(req.token);

        const { data: transacao, error } = await supabase.from('transacoes').insert([{
            usuario_id: req.user.id,
            data_transacao, tipo, valor, categoria: categoria || null, produto_id: produto_id || null, 
            cliente_id: cliente_id || null, status_pagamento: status_pagamento || 'PENDENTE', 
            forma_pagamento, descricao: descricao || null, centro_custo: centro_custo || null, 
            quantidade: quantidade || null, data_vencimento: data_vencimento || null, 
            tags: tags || null, is_geral: is_geral || false, telefone_contato: telefone_contato || null
        }]).select().single();

        if (error) throw error;

        if (produto_id && quantidade) {
            const { data: prod } = await supabase.from('produtos').select('estoque_atual').eq('id', produto_id).single();
            if (prod) {
                const factor = tipo === 'RECEITA' ? -1 : 1;
                await supabase.from('produtos').update({ estoque_atual: Number(prod.estoque_atual || 0) + (Number(quantidade) * factor) }).eq('id', produto_id);
            }
        }

        res.status(201).json(transacao);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao criar transação' });
    }
});

router.get('/', async (req, res) => {
    try {
        const { tipo, categoria, data_inicio, data_fim, limit = 50, offset = 0 } = req.query;
        const supabase = getSupabaseClient(req.token);

        let query = supabase.from('transacoes').select('*, produtos(nome), clientes(nome)', { count: 'exact' });
        
        if (tipo) query = query.eq('tipo', tipo);
        if (categoria) query = query.eq('categoria', categoria);
        if (data_inicio) query = query.gte('data_transacao', data_inicio);
        if (data_fim) query = query.lte('data_transacao', data_fim);

        query = query.order('data_transacao', { ascending: false }).order('id', { ascending: false }).range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        let { data: transacoes, count: total, error } = await query;
        if (error) throw error;

        transacoes = (transacoes || []).map(t => ({
            ...t,
            produto_nome: t.produtos?.nome || null,
            cliente_nome: t.clientes?.nome || null
        }));

        if (req.user && req.user.role === 'OPERADOR') {
            transacoes = transacoes.filter(t => !CATEGORIAS_SIGILOSAS.includes(t.categoria));
            total = transacoes.length;
        }

        res.json({ transacoes, total, limit: parseInt(limit), offset: parseInt(offset) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Erro ao listar transações' });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data_transacao, tipo, valor, categoria, produto_id, cliente_id, status_pagamento, forma_pagamento, descricao, centro_custo, quantidade, data_vencimento, tags, is_geral, telefone_contato } = req.body;

        const supabase = getSupabaseClient(req.token);
        const { data: oldTx } = await supabase.from('transacoes').select('*').eq('id', id).single();
        if (!oldTx) return res.status(404).json({ error: 'Não encontrada' });

        if (oldTx.produto_id && oldTx.quantidade) {
            const { data: prod } = await supabase.from('produtos').select('estoque_atual').eq('id', oldTx.produto_id).single();
            if (prod) {
                const oldFactor = oldTx.tipo === 'RECEITA' ? -1 : 1;
                await supabase.from('produtos').update({ estoque_atual: Number(prod.estoque_atual || 0) - (Number(oldTx.quantidade) * oldFactor) }).eq('id', oldTx.produto_id);
            }
        }

        const { data: transacao, error } = await supabase.from('transacoes').update({
            data_transacao, tipo, valor, categoria: categoria || null, produto_id: produto_id || null, 
            cliente_id: cliente_id || null, status_pagamento: status_pagamento || 'PAGO', 
            forma_pagamento, descricao: descricao || null, centro_custo: centro_custo || null, 
            quantidade: quantidade || null, data_vencimento: data_vencimento || null, 
            tags: tags || null, is_geral: is_geral || false, telefone_contato: telefone_contato || null
        }).eq('id', id).select().single();

        if (error) throw error;

        if (produto_id && quantidade) {
            const { data: prod } = await supabase.from('produtos').select('estoque_atual').eq('id', produto_id).single();
            if (prod) {
                const newFactor = tipo === 'RECEITA' ? -1 : 1;
                await supabase.from('produtos').update({ estoque_atual: Number(prod.estoque_atual || 0) + (Number(quantidade) * newFactor) }).eq('id', produto_id);
            }
        }

        res.json(transacao);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao atualizar transação' });
    }
});

router.post('/scan-nf', async (req, res) => {
    try {
        await new Promise(r => setTimeout(r, 1500));
        res.json({
            fornecedor: "Agropecuaria Central Ltda", valorTotal: 1250.75,
            dataEmissao: new Date().toISOString().split('T')[0],
            itens: [{ descricao: "Saco de Ração 50kg", sku: "RAC-001", quantidade: 5, valorUnitario: 200 }]
        });
    } catch(e) { }
});

router.post('/import-bulk', async (req, res) => {
    try {
        const { rows } = req.body;
        if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'Nenhum dado' });

        const supabase = getSupabaseClient(req.token);
        
        let imported = 0; let skipped = 0; let newClients = 0; let newProducts = 0;
        const errors = [];

        const { data: clients } = await supabase.from('clientes').select('id, nome');
        const { data: products } = await supabase.from('produtos').select('id, nome');
        
        const clientMap = new Map((clients || []).map(c => [c.nome.toLowerCase(), c.id]));
        const productMap = new Map((products || []).map(p => [p.nome.toLowerCase(), p.id]));

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const originalRow = i + 2;
            try {
                if (!row.data_transacao || !row.tipo || row.valor === undefined) throw new Error('Campos faltantes');
                
                let cliente_id = null;
                if (row.cliente_nome) {
                    const cName = row.cliente_nome.trim();
                    const cLow = cName.toLowerCase();
                    if (clientMap.has(cLow)) { cliente_id = clientMap.get(cLow); }
                    else {
                        const { data: nc } = await supabase.from('clientes').insert([{ 
                            usuario_id: req.user.id, nome: cName, tipo: 'PF', tipo_contato: row.tipo === 'RECEITA' ? 'Cliente' : 'Fornecedor' 
                        }]).select().single();
                        cliente_id = nc.id; clientMap.set(cLow, cliente_id); newClients++;
                    }
                }

                let produto_id = null;
                if (row.produto_nome) {
                    const pName = row.produto_nome.trim();
                    const pLow = pName.toLowerCase();
                    if (productMap.has(pLow)) { produto_id = productMap.get(pLow); }
                    else {
                        const { data: np } = await supabase.from('produtos').insert([{ 
                            usuario_id: req.user.id, nome: pName, codigo_sku: 'IMP-' + Date.now().toString(36) + '-' + i, 
                            categoria: 'Importado', preco_venda: row.valor > 0 ? row.valor : 0, custo_unitario: 0 
                        }]).select().single();
                        produto_id = np.id; productMap.set(pLow, produto_id); newProducts++;
                    }
                }

                await supabase.from('transacoes').insert([{
                    usuario_id: req.user.id,
                    data_transacao: row.data_transacao, tipo: row.tipo, valor: row.valor,
                    categoria: row.categoria || 'Sem categoria', produto_id, cliente_id,
                    status_pagamento: row.status_pagamento || 'PAGO', forma_pagamento: row.forma_pagamento || 'OUTROS',
                    descricao: row.descricao || null, centro_custo: row.centro_custo || null,
                    quantidade: row.quantidade || 1, is_geral: row.is_geral || false
                }]);
                imported++;
            } catch (err) { skipped++; errors.push(`Linha ${originalRow}: ${err.message}`); }
        }

        res.json({ imported, skipped, newClients, newProducts, errors });
    } catch (err) {
        res.status(500).json({ error: 'Erro interno' });
    }
});

router.delete('/:id', requireRole('ADMIN', 'GERENTE'), async (req, res) => {
    try {
        const { id } = req.params;
        const supabase = getSupabaseClient(req.token);

        const { data: tx } = await supabase.from('transacoes').select('*').eq('id', id).single();
        if (!tx) return res.status(404).json({ error: 'Transação não encontrada' });

        if (tx.produto_id && tx.quantidade) {
            const { data: prod } = await supabase.from('produtos').select('estoque_atual').eq('id', tx.produto_id).single();
            if (prod) {
                const factor = tx.tipo === 'RECEITA' ? -1 : 1;
                await supabase.from('produtos').update({ estoque_atual: Number(prod.estoque_atual || 0) - (Number(tx.quantidade) * factor) }).eq('id', tx.produto_id);
            }
        }

        await supabase.from('transacoes').delete().eq('id', id);
        res.json({ message: 'Removida com sucesso' });
    } catch (err) {
        res.status(500).json({ error: 'Erro interno' });
    }
});

module.exports = router;
