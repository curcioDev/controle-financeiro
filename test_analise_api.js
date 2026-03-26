const axios = require('axios');

const API_URL_ANALISE_PRODUTOS = 'http://localhost:3001/api/transacoes/analise-produtos';
const API_URL_PROD = 'http://localhost:3001/api/producao/analytics';

async function test() {
    let token = '';
    try {
        const login = await axios.post('http://localhost:3001/api/auth/login', {
            email: 'admin@empresa.com',
            senha: 'admin123'
        });
        token = login.data.token;
        console.log('Login successful, token obtained.');
    } catch (e) {
        console.error('Login Error:', e.response?.data || e.message);
        return;
    }

    console.log('\n--- Testando Analise Produtos ---');
    try {
        const res = await axios.get(API_URL_ANALISE_PRODUTOS, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Status Prod Analise:', res.status);
        console.log('Data keys (sample):', Object.keys(res.data[0] || {}));
    } catch (e) {
        console.error('Error Prod Analise:', e.response?.data || e.message);
    }

    console.log('\n--- Testando Producao Analytics (Granular) ---');
    try {
        const res = await axios.get(API_URL_PROD, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Status Analytics:', res.status);
        console.log('Keys:', Object.keys(res.data));
        if (res.data.producaoGranular) {
            console.log('Granular data sample (producao):', res.data.producaoGranular[0]);
            console.log('Granular data sample (financas):', res.data.financasGranulares[0]);
            console.log('Granular data lengths:', {
                producao: res.data.producaoGranular.length,
                financas: res.data.financasGranulares.length,
                produtos: res.data.produtos.length
            });
        }
    } catch (e) {
        console.error('Error Analytics:', e.response?.data || e.message);
    }
}

test();
