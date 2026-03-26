async function run() {
    try {
        console.log('Logging in...');
        const loginRes = await fetch('http://localhost:3001/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@financepro.com', senha: 'admin' })
        });
        const loginData = await loginRes.json();
        const token = loginData.token;
        if (!token) throw new Error('Falha no login');

        console.log('Sending to /transacoes/import-bulk...');
        const financeiroPayload = {
            rows: [
                {
                    data_transacao: '2024-10-15',
                    tipo: 'RECEITA',
                    valor: 500.0,
                    produto_nome: 'Soja Safra TESTE API',
                    quantidade: 100,
                    cliente_nome: 'Cliente A'
                },
                {
                    data_transacao: '2024-10-16',
                    tipo: 'DESPESA',
                    valor: 150.0,
                    produto_nome: 'Adubo TESTE API',
                    quantidade: 50,
                    cliente_nome: 'Fornecedor B'
                }
            ]
        };

        const resFin = await fetch('http://localhost:3001/api/transacoes/import-bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(financeiroPayload)
        });
        const finData = await resFin.json();
        console.log('Financeiro result:', finData);

        console.log('\nSending to /producao/import-bulk...');
        const producaoPayload = {
            rows: [
                {
                    data: '2024-10-15',
                    produto: 'Soja Safra TESTE API',
                    quantidade: 100
                }
            ]
        };

        const resProd = await fetch('http://localhost:3001/api/producao/import-bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(producaoPayload)
        });
        const prodData = await resProd.json();
        console.log('Producao result:', prodData);

    } catch (err) {
        console.error('Error:', err.message);
    }
}

run();
