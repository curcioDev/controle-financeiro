const text = 'Nome;Cargo;Setor;Salario\nJoão;Operador;Campo;1000';
const normalize = str => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const lines = text.trim().split('\n').filter(l => l.trim() !== '');

let headerIdx = -1;
let headers = [];
let separator = ',';

for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const currentLine = lines[i];
    const sep = currentLine.includes(';') ? ';' : (currentLine.includes('\t') ? '\t' : ',');
    const currentHeaders = currentLine.split(sep).map(normalize);
    console.log('line h', currentHeaders);
    if (currentHeaders.some(h => h.includes('nome') || h.includes('funcionario') || h.includes('colaborador'))) {
        headerIdx = i;
        headers = currentHeaders;
        separator = sep;
        break;
    }
}
console.log(headerIdx, headers);
