import React, { useState } from 'react';
import { UploadCloud, CheckCircle, AlertTriangle, XCircle, ArrowRight, RefreshCcw, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import api from '../api/client';

const REQUIRED_FIELDS = [
    { key: 'nome', label: 'Nome Completo', type: 'string', required: true },
    { key: 'cargo', label: 'Cargo', type: 'string', required: true },
    { key: 'setor', label: 'Setor', type: 'string', required: true },
    { key: 'horario_trabalho', label: 'Horário de Trabalho', type: 'string', required: false },
    { key: 'data_admissao', label: 'Data de Admissão', type: 'date', required: true },
    { key: 'salario_base', label: 'Salário Base', type: 'number', required: false, default: 0 },
    { key: 'encargos_beneficios', label: 'Encargos e Benefícios', type: 'number', required: false, default: 0 },
    { key: 'status', label: 'Status', type: 'string', required: false, default: 'Ativo' }
];

function ImportFuncionariosModal({ isOpen, onClose, onSuccess }) {
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
            str = str.replace(/,/g, '');
        } else if (lastComma > lastDot) {
            str = str.replace(/\./g, '');
            str = str.replace(',', '.');
        }

        let finalNumber = parseFloat(str);
        return isNaN(finalNumber) ? 0 : finalNumber;
    }

    function parseDate(dateStr) {
        if (!dateStr) return '';
        const str = String(dateStr).trim();
        // Check if it's already YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
        
        // Try to convert DD/MM/YYYY to YYYY-MM-DD
        const parts = str.split('/');
        if (parts.length === 3) {
            return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
        return str;
    }

    const handleFileUpload = async (e) => {
        const uploadedFile = e.target.files[0] || (e.dataTransfer && e.dataTransfer.files[0]);
        if (!uploadedFile) return;

        setFile(uploadedFile);

        const processCSV = (csvData) => {
            Papa.parse(csvData, {
                header: true,
                skipEmptyLines: 'greedy',
                delimiter: ';',
                transformHeader: (header) => String(header).trim().replace(/\r?\n|\r/g, ''),
                complete: (results) => {
                    console.log('Dados Lidos do Arquivo:', results.data);

                    if (!results.meta.fields || results.meta.fields.length === 0) {
                        alert('Arquivo vazio ou inválido.');
                        return;
                    }

                    const fields = results.meta.fields;
                    if (fields.length === 1 && fields[0].includes(',')) {
                        alert('Parece que o arquivo usa vírgula como delimitador em vez de ponto-e-vírgula. Tente salvar como "CSV UTF-8 (delimitado por vírgulas)".');
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
                                (field.key === 'nome' && (normH === 'funcionario' || normH === 'colaborador' || normH === 'nome')) ||
                                (field.key === 'salario_base' && (normH === 'salario' || normH === 'remuneracao' || normH === 'base')) ||
                                (field.key === 'encargos_beneficios' && (normH === 'encargo' || normH === 'beneficio' || normH === 'custo')) ||
                                (field.key === 'data_admissao' && (normH === 'admissao' || normH === 'data' || normH === 'inicio'));
                        });
                        if (match) autoMap[field.key] = match;
                    });

                    if (Object.keys(autoMap).length === 0) {
                        alert('Cabeçalhos inválidos. Verifique se a primeira linha contém os nomes das colunas.');
                    }

                    setMapping(autoMap);
                    setStep(2);
                },
                error: () => alert('Erro ao ler arquivo.')
            });
        };

        const filename = uploadedFile.name.toLowerCase();
        if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                try {
                    const data = new Uint8Array(evt.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const wsname = workbook.SheetNames[0];
                    const ws = workbook.Sheets[wsname];
                    const csvStr = XLSX.utils.sheet_to_csv(ws, { FS: ';' });
                    processCSV(csvStr);
                } catch (err) {
                    alert('Erro ao converter arquivo Excel para CSV.');
                }
            };
            reader.readAsArrayBuffer(uploadedFile);
        } else {
            processCSV(uploadedFile);
        }
    };

    const handleMappingChange = (fieldKey, headerValue) => {
        setMapping(prev => ({ ...prev, [fieldKey]: headerValue }));
    };

    const processPreview = () => {
        const missingReq = REQUIRED_FIELDS.filter(f => f.required && (!mapping[f.key] || mapping[f.key] === ''));
        if (missingReq.length > 0) {
            alert(`Por favor, mapeie os campos obrigatórios:\n${missingReq.map(f => f.label).join(', ')}`);
            return;
        }

        const valid = [];
        const invalid = [];

        const filteredCsvRows = csvRows.filter(row => {
            const nameCol = mapping['nome'];
            return (nameCol && row[nameCol]);
        });

        filteredCsvRows.forEach((row, i) => {
            const mappedRow = {};
            let hasError = false;
            let errMsg = '';

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

                if (f.type === 'number' && val) {
                    const num = parseBrazilianCurrency(val);
                    if (isNaN(num)) {
                        hasError = true;
                        errMsg = `Valor numérico inválido: ${val}`;
                    } else {
                        val = Number(num.toFixed(2));
                    }
                }
                
                if (f.type === 'date' && val) {
                    val = parseDate(val);
                }

                // Apply defaults for missing optional fields that have a default
                if ((val === '' || val === undefined) && f.default !== undefined) {
                    val = f.default;
                }

                mappedRow[f.key] = val || (f.type === 'number' ? 0 : '');
            });

            if (!hasError) {
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
            invalid: invalid.length
        });
        setStep(3);
    };

    const confirmImport = async () => {
        setLoading(true);
        setToastError(null);
        try {
            const res = await api.post('/funcionarios/import-bulk', { rows: validRows });
            setResult(res.data);
            setStep(4);
            onSuccess();
        } catch (err) {
            setToastError(err.response?.data?.error || 'Erro interno ao importar funcionários.');
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
                    <h2>Importação de Funcionários</h2>
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
                            onClick={() => document.getElementById('csvUploadRH').click()}
                        >
                            <input
                                id="csvUploadRH"
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
                                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Mapeie os cabeçalhos da sua planilha com os campos do sistema.</p>
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
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '24px' }}>
                                <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--revenue)' }}>{summary.valid}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Funcionários Válidos</div>
                                </div>
                                <div className="glass-card" style={{ padding: '16px', textAlign: 'center' }}>
                                    <div style={{ fontSize: '2rem', fontWeight: 'bold', color: summary.invalid > 0 ? 'var(--expense)' : 'var(--text-muted)' }}>{summary.invalid}</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Com Erros</div>
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
                                            <th style={{ padding: '8px', textAlign: 'left' }}>Nome</th>
                                            <th style={{ padding: '8px', textAlign: 'left' }}>Cargo</th>
                                            <th style={{ padding: '8px', textAlign: 'left' }}>Setor</th>
                                            <th style={{ padding: '8px', textAlign: 'right' }}>Salário</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {validRows.slice(0, 5).map((r, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                                <td style={{ padding: '8px' }}>{r.nome}</td>
                                                <td style={{ padding: '8px' }}>{r.cargo}</td>
                                                <td style={{ padding: '8px' }}>{r.setor}</td>
                                                <td style={{ padding: '8px', textAlign: 'right' }}>
                                                    {r.salario_base.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
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
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Seus funcionários foram cadastrados com sucesso.</p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Funcionários Importados:</span>
                                    <span style={{ fontWeight: 'bold', color: 'var(--revenue)' }}>{result.imported}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Linhas Ignoradas / Erros:</span>
                                    <span style={{ fontWeight: 'bold', color: result.skipped > 0 ? 'var(--expense)' : 'var(--text-muted)' }}>{result.skipped}</span>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* MODAL FOOTER */}
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '24px' }}>
                    {step < 4 ? <button onClick={onClose} className="btn-ghost" disabled={loading}>Cancelar</button> : <div></div>}

                    {step === 2 && (
                        <button onClick={processPreview} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            Avançar para Revisão <ArrowRight size={18} />
                        </button>
                    )}

                    {step === 3 && (
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => setStep(2)} className="btn-ghost" disabled={loading}>Voltar</button>
                            <button onClick={confirmImport} className="btn btn-primary" disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {loading ? <RefreshCcw size={18} className="spin" /> : <UploadCloud size={18} />}
                                Confirmar Importação
                            </button>
                        </div>
                    )}

                    {step === 4 && (
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={reset} className="btn-ghost">Importar Mais</button>
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

export default ImportFuncionariosModal;
