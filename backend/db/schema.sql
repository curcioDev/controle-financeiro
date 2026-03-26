-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('ADMIN', 'GERENTE', 'OPERADOR')) DEFAULT 'OPERADOR',
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Tabela de Produtos
CREATE TABLE IF NOT EXISTS produtos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  codigo_sku TEXT NOT NULL UNIQUE,
  categoria TEXT NOT NULL,
  preco_venda REAL NOT NULL CHECK(preco_venda >= 0),
  custo_unitario REAL NOT NULL CHECK(custo_unitario >= 0),
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Tabela de Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK(tipo IN ('PF', 'PJ')),
  documento TEXT NOT NULL UNIQUE,
  email TEXT,
  telefone TEXT,
  segmento TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Tabela de Transações
CREATE TABLE IF NOT EXISTS transacoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data_transacao TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK(tipo IN ('RECEITA', 'DESPESA')),
  valor REAL NOT NULL CHECK(valor > 0),
  categoria TEXT NOT NULL,
  produto_id INTEGER,
  cliente_id INTEGER,
  status_pagamento TEXT NOT NULL CHECK(status_pagamento IN ('PAGO', 'PENDENTE', 'CANCELADO')) DEFAULT 'PENDENTE',
  forma_pagamento TEXT NOT NULL CHECK(forma_pagamento IN ('PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'BOLETO', 'TRANSFERENCIA', 'DINHEIRO')),
  descricao TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (produto_id) REFERENCES produtos(id),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_transacoes_data ON transacoes(data_transacao);
CREATE INDEX IF NOT EXISTS idx_transacoes_tipo ON transacoes(tipo);
CREATE INDEX IF NOT EXISTS idx_transacoes_produto ON transacoes(produto_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_cliente ON transacoes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_produtos_sku ON produtos(codigo_sku);
CREATE INDEX IF NOT EXISTS idx_clientes_documento ON clientes(documento);
