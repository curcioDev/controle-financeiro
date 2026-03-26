import React, { useState, useCallback } from 'react';
import { UploadCloud, CheckCircle, AlertTriangle, XCircle, ArrowRight, RefreshCcw, Tag, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import api from '../api/client';

const REQUIRED_FIELDS = [
    { key: 'data_transacao', label: 'Data', type: 'date', required: true },
    { key: 'tipo', label: 'Tipo (RECEITA/DESPESA)', type: 'string', required: true },
    { key: 'valor', label: 'Valor', type: 'number', required: true },
    { key: 'descricao', label: 'Descrição', type: 'string', required: false },
    { key: 'categoria', label: 'Categoria', type: 'string', required: false },
    { key: 'produto_nome', label: 'Produto (Nome)', type: 'string', required: false },
    { key: 'quantidade', label: 'Quantidade/Volume', type: 'number', required: false },
    { key: 'cliente_nome', label: 'Cliente (Nome)', type: 'string', required: false },
    { key: 'status_pagamento', label: 'Status (PAGO/PENDENTE)', type: 'string', required: false, default: 'PAGO' },
    { key: 'forma_pagamento', label: 'Forma Pgto', type: 'string', required: false, default: 'OUTROS' }
];

function ImportModal({ isOpen, onClose, onSuccess }) {
    const [step, setStep] = useState(1); // 1: Upload, 2: Mapping, 3: Preview, 4: Result
    const [file, setFile] = useState(null);
    const [csvHeaders, setCsvHeaders] = useState([]);
    const [csvRows, setCsvRows] = useState([]);
    const [mapping, setMapping] = useState({});

    // Preview & Results
    const [validRows, setValidRows] = useState([]);
    const [invalidRows, setInvalidRows] = useState([]);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [toastError, setToastError] = useState(null);

    // Normalize strings for auto-mapping
    const normalize = (str) => String(str).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");

    function parseBrazilianCurrency(value) {
        if (!value) return 0;
        if (typeof value === 'number') return value;

        // Remove currency symbols and spaces
        let str = String(value).replace(/[R$\s]/g, '').trim();
        if (!str) return 0;

        // Auto-detect the decimal separator (dot or comma)
        const lastDot = str.lastIndexOf('.');
        const lastComma = str.lastIndexOf(',');

        if (lastDot > lastComma) {
            // Dot is the decimal separator (American format: 1,200.00 or 500.00)
            str = str.replace(/,/g, ''); // Remove all commas
        } else if (lastComma > lastDot) {
            // Comma is the decimal separator (Brazilian format: 1.200,00 or 500,00)
            str = str.replace(/\./g, ''); // Remove all dots
            str = str.replace(',', '.');  // Replace the decimal comma with a dot
        }

        // Convert to Float
        let finalNumber = parseFloat(str);
        return isNaN(finalNumber) ? 0 : finalNumber;
    }

    const handleFileUpload = async (e) => {
        const uploadedFile = e.target.files[0] || (e.dataTransfer && e.dataTransfer.files[0]);
        if (!uploadedFile) return;

        setFile(uploadedFile);

        const processCSV = (csvData) => {
            Papa.parse(csvData, {
                header: true,
                skipEmptyLines: 'greedy', // Better empty line handling
                delimiter: ';', // Force semicolon instead of comma for Brazilian excel, or use "auto"
                transformHeader: (header) => String(header).trim().replace(/\r?\n|\r/g, ''), // Clean invisible chars from headers
                complete: (results) => {
                    console.log('Dados Lidos do Arquivo:', results.data); // Debug visual requested

                    if (!results.meta.fields || results.meta.fields.length === 0) {
                        alert('Arquivo vazio ou inválido.');
                        return;
                    }

                    // Header mapping validation check
                    const fields = results.meta.fields;
                    // If it parsed the whole CSV as a single column because of wrong delimiter, fallback check
                    if (fields.length === 1 && fields[0].includes(',')) {
                        alert('Parece que o arquivo usa vírgula como delimitador em vez de ponto-e-vírgula. Tente salvar como "CSV UTF-8 (delimitado por vírgulas)" ou ajuste o arquivo.');
                        return;
                    }

                    setCsvHeaders(fields);
                    setCsvRows(results.data);

                    // Auto-map columns
                    const autoMap = {};
                    REQUIRED_FIELDS.forEach(field => {
                        const normField = normalize(field.label);
                        const match = fields.find(h => {
                            if (!h) return false;
                            const normH = normalize(h);
                            return normH === normField ||
                                (field.key === 'data_transacao' && normH === 'data') ||
                                (field.key === 'produto_nome' && normH === 'produto') ||
                                (field.key === 'quantidade' && (normH === 'quantidade' || normH === 'volume')) ||
                                (field.key === 'cliente_nome' && normH === 'cliente');
                        });
                        if (match) autoMap[field.key] = match;
                    });

                    if (Object.keys(autoMap).length === 0) {
                        alert('Cabeçalhos inválidos. Verifique se a primeira linha do seu arquivo contém os nomes das colunas.');
                    }

                    setMapping(autoMap);
                    setStep(2);
                },
                error: () => alert('Erro ao ler arquivo.')
            });
        };

        // If it's an Excel file, use SheetJS to convert to CSV first
        const filename = uploadedFile.name.toLowerCase();
        if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const data = new Uint8Array(evt.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    // Get first worksheet
                    const wsname = workbook.SheetNames[0];
                    const ws = workbook.Sheets[wsname];
                    // Convert to CSV using semicolon to match our PapaParse config
                    const csvStr = XLSX.utils.sheet_to_csv(ws, { FS: ';' });
                    processCSV(csvStr);
                } catch (err) {
                    alert('Erro ao converter arquivo Excel para CSV.');
                }
            };
            reader.readAsArrayBuffer(uploadedFile);
        } else {
            // Native CSV
            processCSV(uploadedFile);
        }
    };

    const handleMappingChange = (fieldKey, headerValue) => {
        setMapping(prev => ({ ...prev, [fieldKey]: headerValue }));
    };

    const processPreview = () => {
        // Validate required mappings
        const missingReq = REQUIRED_FIELDS.filter(f => f.required && (!mapping[f.key] || mapping[f.key] === ''));
        if (missingReq.length > 0) {
            alert(`Por favor, mapeie os campos obrigatórios:\n${missingReq.map(f => f.label).join(', ')}`);
            return;
        }

        const valid = [];
        const invalid = [];
        let newCli = new Set();
        let newProd = new Set();
        let totalReceita = 0;
        let totalDespesa = 0;
        // Empty rows filter before parsing: ensure at least the row has some data in mapped 'data_transacao' or 'valor' target columns
        const filteredCsvRows = csvRows.filter(row => {
            const dateCol = mapping['data_transacao'];
            const valCol = mapping['valor'];
            return (dateCol && row[dateCol]) || (valCol && row[valCol]);
        });

        filteredCsvRows.forEach((row, i) => {
            const mappedRow = {};
            let hasError = false;
            let errMsg = '';

            // Map fields
            REQUIRED_FIELDS.forEach(f => {
                const csvCol = mapping[f.key];
                let val = csvCol ? row[csvCol] : undefined;

                if (val !== undefined && val !== null) {
                    val = String(val).trim();
                }

                if (f.required && !val) {
                    hasError = true;
                    errMsg = `Campo obrigatório ausente: ${f.label}`;
                }

                // Parse value
                if (f.type === 'number' && val) {
                    const originalVal = val;
                    const num = parseBrazilianCurrency(val);
                    console.log(`Valor Original: ${originalVal} -> Valor Limpo: ${num}`);

                    if (isNaN(num)) {
                        hasError = true;
                        errMsg = `Valor numérico inválido: ${val}`;
                    } else {
                        if (f.key === 'valor') {
                            // Strict validation: store as absolute float with exactly 2 decimal precision
                            val = Number(Math.abs(num).toFixed(2));
                            // Auto-detect negative sign and force type to DESPESA
                            if (num < 0) {
                                mappedRow['tipo'] = 'DESPESA';
                            }
                        } else {
                            // Para campos como quantidade
                            val = Number(num);
                        }
                    }
                } else if (f.type === 'date' && val) {
                    // Convert DD/MM/YYYY to YYYY-MM-DD
                    if (val.includes('/')) {
                        const parts = val.split('/');
                        if (parts.length === 3) {
                            // Assumes format is DD/MM/YYYY if first part is > 12 or if standard BR format
                            val = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                        }
                    }
                } else if (f.key === 'tipo' && val) {
                    // Only assign if it hasn't been auto-detected as negative value earlier
                    if (!mappedRow['tipo']) {
                        val = val.toUpperCase().startsWith('R') ? 'RECEITA' : 'DESPESA';
                    }
                }

                if (f.key !== 'tipo' || !mappedRow['tipo']) {
                    mappedRow[f.key] = val || f.default || null;
                }
            });

            if (!hasError) {
                if (mappedRow.tipo === 'RECEITA') totalReceita += mappedRow.valor;
                else if (mappedRow.tipo === 'DESPESA') totalDespesa += mappedRow.valor;

                if (mappedRow.cliente_nome) newCli.add(mappedRow.cliente_nome.toLowerCase());
                if (mappedRow.produto_nome) newProd.add(mappedRow.produto_nome.toLowerCase());

                valid.push(mappedRow);
            } else {
                invalid.push({ line: i + 2, reason: errMsg, data: row });
            }
        });

        setValidRows(valid);
        setInvalidRows(invalid);
        setSummary({
            total: valid.length + invalid.length,
            valid: valid.length,
            invalid: invalid.length,
            uniqueClients: newCli.size,
            uniqueProducts: newProd.size,
            totalReceita,
            totalDespesa
        });
        setStep(3);
    };

    const confirmImport = async () => {
        setLoading(true);
        setToastError(null);
        try {
            // 1. Financeiro (cria também clientes e produtos automaticamente via API)
            const res = await api.post('/transacoes/import-bulk', { rows: validRows });
            const financialResult = res.data;

            // 2. Produção (Interceptação de Receitas com Volume)
            const prodRows = validRows
                .filter(r => r.tipo === 'RECEITA' && r.quantidade > 0 && r.produto_nome)
                .map(r => ({
                    data: r.data_transacao,
                    produto: r.produto_nome,
                    quantidade: r.quantidade
                }));

            let producaoResult = { imported: 0, skipped: 0 };
            if (prodRows.length > 0) {
                const pRes = await api.post('/producao/import-bulk', { rows: prodRows });
                producaoResult = pRes.data;
            }

            // Consolidate Results
            const combinedResult = {
                imported: financialResult.imported,
                producaoImported: producaoResult.imported,
                newProducts: financialResult.newProducts,
                newClients: financialResult.newClients,
                skipped: financialResult.skipped + producaoResult.skipped
            };

            setResult(combinedResult);

            // Console Batch Log (Requested by User for final check)
            console.log(`==== RESUMO DE IMPORTAÇÃO BATCH ====`);
            console.log(`Total enviado: R$ ${(summary.totalReceita + summary.totalDespesa).toFixed(2)} | Lançamentos: ${combinedResult.imported} | Produção: ${combinedResult.producaoImported}`);

            setStep(4);
            onSuccess(); // Refresh parent data (Dashboard)
        } catch (err) {
            setToastError(err.response?.data?.error || 'Erro interno ao importar dados.');
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        setStep(1);
        setFile(null);
        setCsvHeaders([]);
        setCsvRows([]);
        setMapping({});
        setValidRows([]);
        setInvalidRows([]);
        setSummary(null);
        setResult(null);
        setToastError(null);
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-container" style={{ maxWidth: step === 4 ? '500px' : '800px', transition: 'all 0.3s' }}>
                <div className="modal-header">
                    <h2>Importação Inteligente</h2>
                    <button onClick={onClose} className="btn-close"><XCircle size={24} /></button>
                </div>

                <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>

                    {/* STEP 1: UPLOAD */}
                    {step === 1 && (
                        <div
                            style={{
                                border: '2px dashed var(--glass-border)',
                                borderRadius: '12px',
                                padding: '60px 20px',
                                textAlign: 'center',
                                background: 'rgba(255,255,255,0.02)',
                                cursor: 'pointer'
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => { e.preventDefault(); handleFileUpload(e); }}
                            onClick={() => document.getElementById('csvUpload').click()}
                        >
                            <input
                                id="csvUpload"
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                style={{ display: 'none' }}
                                onChange={handleFileUpload}
                            />
                            <UploadCloud size={48} style={{ color: '#7c4dff', marginBottom: '16px' }} />
                            <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Arraste seu arquivo Excel ou CSV aqui</h3>
                            <p style={{ color: 'var(--text-muted)' }}>ou clique para procurar no seu computador</p>
                            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                <span className="badge" style={{ background: 'rgba(255,255,255,0.1)' }}>Max 5MB</span>
                                <span className="badge" style={{ background: 'rgba(255,255,255,0.1)' }}>.xlsx, .xls, .csv</span>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: MAPPING */}
                    {step === 2 && (
                        <div>
                            <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(124, 77, 255, 0.1)', borderRadius: '8px', borderLeft: '4px solid #7c4dff' }}>
                                <h4 style={{ color: '#7c4dff', marginBottom: '4px' }}>Arquivo carregado: {file?.name}</h4>
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Encontramos {csvHeaders.length} colunas. Mapeie os cabeçalhos da sua planilha com os campos do sistema.</p>
                            </div>

                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                                        <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Campo no Sistema</th>
                                        <th style={{ padding: '12px', color: 'var(--text-muted)' }}>Coluna na Planilha</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {REQUIRED_FIELDS.map(f => (
                                        <tr key={f.key} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                            <td style={{ padding: '16px 12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{ fontWeight: '600' }}>{f.label}</span>
                                                    {f.required && <span style={{ color: 'var(--expense)', fontSize: '0.75rem', fontWeight: 'bold' }}>*</span>}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Tipo: {f.type}</div>
                                            </td>
                                            <td style={{ padding: '16px 12px' }}>
                                                <select
                                                    className="input-field"
                                                    value={mapping[f.key] || ''}
                                                    onChange={(e) => handleMappingChange(f.key, e.target.value)}
                                                >
                                                    <option value="">-- Ignorar este campo --</option>
                                                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* STEP 3: PREVIEW */}
                    {step === 3 && summary && (
                        <div style={{ position: 'relative' }}>
                            {loading && (
                                <div style={{
                                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
                                    zIndex: 50, display: 'flex', flexDirection: 'column',
                                    alignItems: 'center', justifyContent: 'center', borderRadius: '8px'
                                }}>
                                    <Loader2 size={40} className="spin" style={{ color: '#7c4dff', marginBottom: '16px' }} />
                                    <h3 style={{ color: '#fff', margin: 0 }}>Processando Lote...</h3>
                                    <p style={{ color: 'var(--text-muted)' }}>Isso pode levar alguns segundos.</p>
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                                <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--revenue)' }}>{summary.valid}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Válidas</div>
                                </div>
                                <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: summary.invalid > 0 ? 'var(--expense)' : 'var(--text-muted)' }}>{summary.invalid}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Erros</div>
                                </div>
                                <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3b82f6' }}>{summary.uniqueClients}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Novos Clientes</div>
                                </div>
                                <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#a855f7' }}>{summary.uniqueProducts}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Novos Produtos</div>
                                </div>
                            </div>

                            {invalidRows.length > 0 && (
                                <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', borderLeft: '4px solid var(--expense)' }}>
                                    <h4 style={{ color: 'var(--expense)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <AlertTriangle size={18} /> Foram encontrados erros
                                    </h4>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                        {invalidRows.length} linhas serão ignoradas. Exemplos:
                                    </p>
                                    <ul style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingLeft: '20px' }}>
                                        {invalidRows.slice(0, 3).map((err, i) => (
                                            <li key={i}>Linha {err.line}: {err.reason}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <h4 style={{ marginBottom: '12px' }}>Amostra dos Dados Válidos (Primeiros 5)</h4>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                                    <thead>
                                        <tr style={{ background: 'rgba(255,255,255,0.05)' }}>
                                            <th style={{ padding: '8px', textAlign: 'left' }}>Data</th>
                                            <th style={{ padding: '8px', textAlign: 'left' }}>Tipo</th>
                                            <th style={{ padding: '8px', textAlign: 'left' }}>Descrição</th>
                                            <th style={{ padding: '8px', textAlign: 'right' }}>Valor</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {validRows.slice(0, 5).map((r, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                                <td style={{ padding: '8px' }}>{r.data_transacao}</td>
                                                <td style={{ padding: '8px' }}><span className={r.tipo === 'RECEITA' ? 'badge badge-revenue' : 'badge badge-expense'}>{r.tipo}</span></td>
                                                <td style={{ padding: '8px' }}>{r.descricao || r.produto_nome || '-'}</td>
                                                <td style={{ padding: '8px', textAlign: 'right', color: r.tipo === 'RECEITA' ? 'var(--revenue)' : 'var(--expense)' }}>
                                                    {r.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: RESULT */}
                    {step === 4 && result && (
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--revenue)', marginBottom: '24px' }}>
                                <CheckCircle size={40} />
                            </div>
                            <h3 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Importação Concluída!</h3>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Seus dados numéricos foram processados.</p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Lançamentos financeiros criados:</span>
                                    <span style={{ fontWeight: 'bold', color: 'var(--revenue)' }}>{result.imported}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Registros de produção criados:</span>
                                    <span style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>{result.producaoImported}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Novos produtos cadastrados:</span>
                                    <span style={{ fontWeight: 'bold' }}>{result.newProducts}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Novos clientes cadastrados:</span>
                                    <span style={{ fontWeight: 'bold' }}>{result.newClients}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Linhas ignoradas / erro:</span>
                                    <span style={{ fontWeight: 'bold', color: result.skipped > 0 ? 'var(--expense)' : 'var(--text-muted)' }}>{result.skipped}</span>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* MODAL FOOTER */}
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
                    {step < 4 ? <button onClick={onClose} className="btn btn-ghost" disabled={loading}>Cancelar</button> : <div></div>}

                    {step === 2 && (
                        <button onClick={processPreview} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            Avançar para Revisão <ArrowRight size={18} />
                        </button>
                    )}

                    {step === 3 && (
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => setStep(2)} className="btn btn-ghost" disabled={loading}>Voltar</button>
                            <button onClick={confirmImport} className="btn btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {loading ? <RefreshCcw size={18} className="spin" /> : <UploadCloud size={18} />}
                                Confirmar Importação
                            </button>
                        </div>
                    )}

                    {step === 4 && (
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={reset} className="btn btn-ghost">Importar Mais</button>
                            <button onClick={onClose} className="btn btn-primary">Fechar</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Error Toast Feedback */}
            {toastError && (
                <div style={{
                    position: 'fixed', bottom: '24px', right: '24px',
                    background: '#ef4444', color: '#fff', padding: '16px 24px',
                    borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    display: 'flex', alignItems: 'center', gap: '12px', zIndex: 1000,
                    animation: 'slideUp 0.3s ease-out'
                }}>
                    <AlertTriangle size={20} />
                    <div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.875rem' }}>Erro na Importação</div>
                        <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>{toastError}</div>
                    </div>
                    <button onClick={() => setToastError(null)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', marginLeft: '8px' }}>
                        <XCircle size={16} />
                    </button>
                </div>
            )}
        </div>
    );
}

export default ImportModal;
